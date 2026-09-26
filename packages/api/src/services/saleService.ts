import type {
  CreateSaleInput,
  Sale,
} from "@motory/shared";
import {
  badRequest,
  conflict,
  insufficientStock,
  notFound,
} from "../lib/errors";
import { newId, nowIso } from "../lib/ids";
import type {
  MovementRecord,
  ProductRepository,
  SaleRecord,
  SaleRepository,
} from "../repos/types";
import { movementGsi, saleGsi, toPublicSale } from "../repos/types";

export class SaleService {
  constructor(
    private readonly products: ProductRepository,
    private readonly sales: SaleRepository,
  ) {}

  async create(input: CreateSaleInput): Promise<Sale> {
    if (!input.items.length) {
      throw badRequest("La venta debe tener al menos un producto");
    }

    for (const item of input.items) {
      if (item.quantity <= 0) {
        throw badRequest("Las cantidades deben ser mayores a 0");
      }
      if (item.salePrice < 0) {
        throw badRequest("Los precios no pueden ser negativos");
      }
    }

    // Aggregate quantities per product for stock checks.
    const qtyByProduct = new Map<string, number>();
    for (const item of input.items) {
      qtyByProduct.set(
        item.productId,
        (qtyByProduct.get(item.productId) ?? 0) + item.quantity,
      );
    }

    const productCache = new Map<
      string,
      NonNullable<Awaited<ReturnType<ProductRepository["getById"]>>>
    >();

    for (const [productId, qty] of qtyByProduct) {
      const product = await this.products.getById(productId);
      if (!product) throw notFound(`Producto no encontrado: ${productId}`);
      if (!product.isActive) {
        throw conflict(
          `El producto ${product.name} está inactivo y no puede venderse`,
          "INACTIVE_PRODUCT",
        );
      }
      if (product.stock < qty) {
        throw insufficientStock(product.stock, qty, product.name);
      }
      productCache.set(productId, product);
    }

    const createdAt = nowIso();
    const saleId = newId();

    const saleItems = input.items.map((item) => {
      const product = productCache.get(item.productId)!;
      return {
        productId: product.productId,
        name: product.name,
        quantity: item.quantity,
        basePrice: product.salePrice,
        salePrice: item.salePrice,
        subtotal: item.salePrice * item.quantity,
      };
    });

    const subtotal = saleItems.reduce((sum, i) => sum + i.subtotal, 0);
    const sale: SaleRecord = {
      saleId,
      createdAt,
      paymentMethod: input.paymentMethod,
      customer: input.customer,
      items: saleItems,
      subtotal,
      total: subtotal,
      ...saleGsi(createdAt, saleId),
    };

    const movements: MovementRecord[] = saleItems.map((item) => {
      const product = productCache.get(item.productId)!;
      const movementId = newId();
      return {
        movementId,
        productId: item.productId,
        productName: item.name,
        type: "SALE" as const,
        quantity: -item.quantity,
        unitPrice: item.salePrice,
        unitCostEstimate: product.lastPurchaseCost ?? 0,
        saleId,
        createdAt,
        ...movementGsi(item.productId, createdAt, movementId),
      };
    });

    const stockUpdates = [...qtyByProduct.entries()].map(
      ([productId, quantity]) => ({ productId, quantity }),
    );

    await this.sales.createSaleAtomic({ sale, movements, stockUpdates });
    return toPublicSale(sale);
  }

  async getById(saleId: string): Promise<Sale> {
    const sale = await this.sales.getById(saleId);
    if (!sale) throw notFound("Venta no encontrada");
    return toPublicSale(sale);
  }

  async list(options: { from?: string; to?: string } = {}): Promise<Sale[]> {
    const items = await this.sales.list(options);
    return items.map(toPublicSale);
  }
}
