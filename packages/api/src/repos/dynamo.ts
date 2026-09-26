import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
  TransactWriteCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import { conflict, insufficientStock, notFound } from "../lib/errors";
import type {
  CreateSaleTransactionInput,
  ListMovementsOptions,
  ListProductsOptions,
  ListSalesOptions,
  MovementRecord,
  MovementRepository,
  ProductRecord,
  ProductRepository,
  SaleRecord,
  SaleRepository,
} from "./types";

function tables() {
  return {
    products: process.env.PRODUCTS_TABLE!,
    movements: process.env.MOVEMENTS_TABLE!,
    sales: process.env.SALES_TABLE!,
  };
}

let docClient: DynamoDBDocumentClient | null = null;

function client(): DynamoDBDocumentClient {
  if (!docClient) {
    docClient = DynamoDBDocumentClient.from(new DynamoDBClient({}), {
      marshallOptions: { removeUndefinedValues: true },
    });
  }
  return docClient;
}

export class DynamoProductRepository implements ProductRepository {
  async getById(productId: string): Promise<ProductRecord | null> {
    const result = await client().send(
      new GetCommand({
        TableName: tables().products,
        Key: { productId },
      }),
    );
    return (result.Item as ProductRecord | undefined) ?? null;
  }

  async list(options: ListProductsOptions = {}): Promise<ProductRecord[]> {
    const pk =
      options.inactiveOnly
        ? "STATUS#INACTIVE"
        : "STATUS#ACTIVE";

    // If neither flag, fetch both active and inactive.
    if (!options.activeOnly && !options.inactiveOnly) {
      const [active, inactive] = await Promise.all([
        this.queryByStatus("STATUS#ACTIVE"),
        this.queryByStatus("STATUS#INACTIVE"),
      ]);
      return [...active, ...inactive].sort((a, b) =>
        a.name.localeCompare(b.name, "es"),
      );
    }

    return this.queryByStatus(pk);
  }

  private async queryByStatus(gsi1pk: string): Promise<ProductRecord[]> {
    const items: ProductRecord[] = [];
    let ExclusiveStartKey: Record<string, unknown> | undefined;
    do {
      const result = await client().send(
        new QueryCommand({
          TableName: tables().products,
          IndexName: "GSI1",
          KeyConditionExpression: "gsi1pk = :pk",
          ExpressionAttributeValues: { ":pk": gsi1pk },
          ExclusiveStartKey,
        }),
      );
      for (const item of result.Items ?? []) {
        items.push(item as ProductRecord);
      }
      ExclusiveStartKey = result.LastEvaluatedKey as
        | Record<string, unknown>
        | undefined;
    } while (ExclusiveStartKey);
    return items;
  }

  async put(product: ProductRecord): Promise<void> {
    await client().send(
      new PutCommand({
        TableName: tables().products,
        Item: product,
        ConditionExpression: "attribute_not_exists(productId)",
      }),
    );
  }

  async update(product: ProductRecord): Promise<void> {
    await client().send(
      new PutCommand({
        TableName: tables().products,
        Item: product,
        ConditionExpression: "attribute_exists(productId)",
      }),
    );
  }

  async adjustStock(
    productId: string,
    delta: number,
    extras?: { lastPurchaseCost?: number; updatedAt: string },
  ): Promise<ProductRecord> {
    const names: Record<string, string> = {
      "#stock": "stock",
      "#updatedAt": "updatedAt",
    };
    const values: Record<string, unknown> = {
      ":delta": delta,
      ":zero": 0,
      ":updatedAt": extras?.updatedAt,
    };

    let updateExpression = "SET #stock = #stock + :delta, #updatedAt = :updatedAt";
    if (extras?.lastPurchaseCost !== undefined) {
      names["#lastPurchaseCost"] = "lastPurchaseCost";
      values[":lastPurchaseCost"] = extras.lastPurchaseCost;
      updateExpression += ", #lastPurchaseCost = :lastPurchaseCost";
    }

    try {
      const result = await client().send(
        new UpdateCommand({
          TableName: tables().products,
          Key: { productId },
          UpdateExpression: updateExpression,
          ConditionExpression:
            "attribute_exists(productId) AND #stock >= :minStock",
          ExpressionAttributeNames: names,
          ExpressionAttributeValues: {
            ...values,
            ":minStock": delta < 0 ? Math.abs(delta) : 0,
          },
          ReturnValues: "ALL_NEW",
        }),
      );
      return result.Attributes as ProductRecord;
    } catch (err: unknown) {
      const name = (err as { name?: string })?.name;
      if (name === "ConditionalCheckFailedException") {
        const current = await this.getById(productId);
        if (!current) throw notFound("Producto no encontrado");
        if (delta < 0 && current.stock < Math.abs(delta)) {
          throw insufficientStock(current.stock, Math.abs(delta), current.name);
        }
        throw conflict("No se pudo actualizar el stock");
      }
      throw err;
    }
  }
}

export class DynamoMovementRepository implements MovementRepository {
  async put(movement: MovementRecord): Promise<void> {
    await client().send(
      new PutCommand({
        TableName: tables().movements,
        Item: movement,
      }),
    );
  }

  async list(options: ListMovementsOptions = {}): Promise<MovementRecord[]> {
    if (options.productId) {
      return this.queryProduct(options.productId, options);
    }
    return this.queryGlobal(options);
  }

  private async queryGlobal(
    options: ListMovementsOptions,
  ): Promise<MovementRecord[]> {
    const values: Record<string, unknown> = { ":pk": "MOVEMENT" };
    let keyCondition = "gsi1pk = :pk";
    if (options.from && options.to) {
      keyCondition += " AND gsi1sk BETWEEN :from AND :to";
      values[":from"] = options.from;
      values[":to"] = `${options.to}\uffff`;
    } else if (options.from) {
      keyCondition += " AND gsi1sk >= :from";
      values[":from"] = options.from;
    } else if (options.to) {
      keyCondition += " AND gsi1sk <= :to";
      values[":to"] = `${options.to}\uffff`;
    }

    const items = await this.pagedQuery({
      TableName: tables().movements,
      IndexName: "GSI1",
      KeyConditionExpression: keyCondition,
      ExpressionAttributeValues: values,
      ScanIndexForward: false,
    });

    return this.filterMovements(items, options);
  }

  private async queryProduct(
    productId: string,
    options: ListMovementsOptions,
  ): Promise<MovementRecord[]> {
    const values: Record<string, unknown> = {
      ":pk": `PRODUCT#${productId}`,
    };
    let keyCondition = "gsi2pk = :pk";
    if (options.from && options.to) {
      keyCondition += " AND gsi2sk BETWEEN :from AND :to";
      values[":from"] = options.from;
      values[":to"] = `${options.to}\uffff`;
    } else if (options.from) {
      keyCondition += " AND gsi2sk >= :from";
      values[":from"] = options.from;
    }

    const items = await this.pagedQuery({
      TableName: tables().movements,
      IndexName: "GSI2",
      KeyConditionExpression: keyCondition,
      ExpressionAttributeValues: values,
      ScanIndexForward: false,
    });

    return this.filterMovements(items, options);
  }

  private filterMovements(
    items: MovementRecord[],
    options: ListMovementsOptions,
  ): MovementRecord[] {
    let result = items;
    if (options.type) {
      result = result.filter((m) => m.type === options.type);
    }
    if (options.to) {
      result = result.filter((m) => m.createdAt <= options.to!);
    }
    return result;
  }

  private async pagedQuery(
    input: ConstructorParameters<typeof QueryCommand>[0],
  ): Promise<MovementRecord[]> {
    const items: MovementRecord[] = [];
    let ExclusiveStartKey: Record<string, unknown> | undefined;
    do {
      const result = await client().send(
        new QueryCommand({ ...input, ExclusiveStartKey }),
      );
      for (const item of result.Items ?? []) {
        items.push(item as MovementRecord);
      }
      ExclusiveStartKey = result.LastEvaluatedKey as
        | Record<string, unknown>
        | undefined;
    } while (ExclusiveStartKey);
    return items;
  }
}

export class DynamoSaleRepository implements SaleRepository {
  async getById(saleId: string): Promise<SaleRecord | null> {
    const result = await client().send(
      new GetCommand({
        TableName: tables().sales,
        Key: { saleId },
      }),
    );
    return (result.Item as SaleRecord | undefined) ?? null;
  }

  async list(options: ListSalesOptions = {}): Promise<SaleRecord[]> {
    const values: Record<string, unknown> = { ":pk": "SALE" };
    let keyCondition = "gsi1pk = :pk";
    if (options.from && options.to) {
      keyCondition += " AND gsi1sk BETWEEN :from AND :to";
      values[":from"] = options.from;
      values[":to"] = `${options.to}\uffff`;
    } else if (options.from) {
      keyCondition += " AND gsi1sk >= :from";
      values[":from"] = options.from;
    }

    const items: SaleRecord[] = [];
    let ExclusiveStartKey: Record<string, unknown> | undefined;
    do {
      const result = await client().send(
        new QueryCommand({
          TableName: tables().sales,
          IndexName: "GSI1",
          KeyConditionExpression: keyCondition,
          ExpressionAttributeValues: values,
          ScanIndexForward: false,
          ExclusiveStartKey,
        }),
      );
      for (const item of result.Items ?? []) {
        items.push(item as SaleRecord);
      }
      ExclusiveStartKey = result.LastEvaluatedKey as
        | Record<string, unknown>
        | undefined;
    } while (ExclusiveStartKey);

    if (options.to) {
      return items.filter((s) => s.createdAt <= options.to!);
    }
    return items;
  }

  async createSaleAtomic(input: CreateSaleTransactionInput): Promise<void> {
    const t = tables();
    const transactItems = [
      {
        Put: {
          TableName: t.sales,
          Item: input.sale,
          ConditionExpression: "attribute_not_exists(saleId)",
        },
      },
      ...input.movements.map((movement) => ({
        Put: {
          TableName: t.movements,
          Item: movement,
          ConditionExpression: "attribute_not_exists(movementId)",
        },
      })),
      ...input.stockUpdates.map((update) => ({
        Update: {
          TableName: t.products,
          Key: { productId: update.productId },
          UpdateExpression: "SET #stock = #stock - :qty, #updatedAt = :updatedAt",
          ConditionExpression:
            "attribute_exists(productId) AND isActive = :true AND #stock >= :qty",
          ExpressionAttributeNames: {
            "#stock": "stock",
            "#updatedAt": "updatedAt",
          },
          ExpressionAttributeValues: {
            ":qty": update.quantity,
            ":true": true,
            ":updatedAt": input.sale.createdAt,
          },
        },
      })),
    ];

    try {
      await client().send(
        new TransactWriteCommand({ TransactItems: transactItems }),
      );
    } catch (err: unknown) {
      const name = (err as { name?: string })?.name;
      if (
        name === "TransactionCanceledException" ||
        name === "ConditionalCheckFailedException"
      ) {
        // Resolve a clearer error for the first failing product.
        for (const update of input.stockUpdates) {
          const product = await new DynamoProductRepository().getById(
            update.productId,
          );
          if (!product) throw notFound("Producto no encontrado");
          if (!product.isActive) {
            throw conflict(
              `El producto ${product.name} está inactivo y no puede venderse`,
              "INACTIVE_PRODUCT",
            );
          }
          if (product.stock < update.quantity) {
            throw insufficientStock(
              product.stock,
              update.quantity,
              product.name,
            );
          }
        }
        throw conflict(
          "No se pudo completar la venta. Intenta de nuevo.",
          "SALE_TRANSACTION_FAILED",
        );
      }
      throw err;
    }
  }
}
