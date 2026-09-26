import type {
  InventoryAdjustmentInput,
  InventoryEntryInput,
  InventoryMovement,
} from "@motory/shared";
import { badRequest, conflict, notFound } from "../lib/errors";
import { newId, nowIso } from "../lib/ids";
import type {
  MovementRecord,
  MovementRepository,
  ProductRepository,
} from "../repos/types";
import { movementGsi, toPublicMovement } from "../repos/types";

export class InventoryService {
  constructor(
    private readonly products: ProductRepository,
    private readonly movements: MovementRepository,
  ) {}

  async createEntry(input: InventoryEntryInput): Promise<{
    product: Awaited<ReturnType<ProductRepository["getById"]>>;
    movement: InventoryMovement;
  }> {
    if (input.quantity <= 0) {
      throw badRequest("La cantidad debe ser mayor a 0");
    }
    if (input.unitCost < 0) {
      throw badRequest("El costo no puede ser negativo");
    }

    const product = await this.products.getById(input.productId);
    if (!product) throw notFound("Producto no encontrado");
    if (!product.isActive) {
      throw conflict(
        "No se puede ingresar inventario a un producto inactivo",
        "INACTIVE_PRODUCT",
      );
    }

    const createdAt = input.createdAt ?? nowIso();
    const movementId = newId();
    const movement: MovementRecord = {
      movementId,
      productId: product.productId,
      productName: product.name,
      type: "PURCHASE",
      quantity: input.quantity,
      unitCost: input.unitCost,
      supplier: input.supplier?.trim() || undefined,
      createdAt,
      ...movementGsi(product.productId, createdAt, movementId),
    };

    await this.products.adjustStock(product.productId, input.quantity, {
      lastPurchaseCost: input.unitCost,
      updatedAt: createdAt,
    });
    await this.movements.put(movement);

    const updated = await this.products.getById(product.productId);
    return { product: updated, movement: toPublicMovement(movement) };
  }

  async createAdjustment(input: InventoryAdjustmentInput): Promise<{
    product: Awaited<ReturnType<ProductRepository["getById"]>>;
    movement: InventoryMovement;
  }> {
    if (input.quantity === 0) {
      throw badRequest("La cantidad de ajuste no puede ser 0");
    }

    const product = await this.products.getById(input.productId);
    if (!product) throw notFound("Producto no encontrado");

    const createdAt = input.createdAt ?? nowIso();
    const movementId = newId();
    const movement: MovementRecord = {
      movementId,
      productId: product.productId,
      productName: product.name,
      type: "ADJUSTMENT",
      quantity: input.quantity,
      notes: input.notes?.trim() || undefined,
      createdAt,
      ...movementGsi(product.productId, createdAt, movementId),
    };

    await this.products.adjustStock(product.productId, input.quantity, {
      updatedAt: createdAt,
    });
    await this.movements.put(movement);

    const updated = await this.products.getById(product.productId);
    return { product: updated, movement: toPublicMovement(movement) };
  }

  async listMovements(options: {
    from?: string;
    to?: string;
    type?: string;
    productId?: string;
  }): Promise<InventoryMovement[]> {
    const items = await this.movements.list(options);
    return items.map(toPublicMovement);
  }
}
