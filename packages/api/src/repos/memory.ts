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

export class InMemoryStore {
  products = new Map<string, ProductRecord>();
  movements = new Map<string, MovementRecord>();
  sales = new Map<string, SaleRecord>();

  clear(): void {
    this.products.clear();
    this.movements.clear();
    this.sales.clear();
  }
}

export class InMemoryProductRepository implements ProductRepository {
  constructor(private readonly store: InMemoryStore) {}

  async getById(productId: string): Promise<ProductRecord | null> {
    return this.store.products.get(productId) ?? null;
  }

  async list(options: ListProductsOptions = {}): Promise<ProductRecord[]> {
    let items = [...this.store.products.values()];
    if (options.activeOnly) items = items.filter((p) => p.isActive);
    if (options.inactiveOnly) items = items.filter((p) => !p.isActive);
    return items.sort((a, b) => a.name.localeCompare(b.name, "es"));
  }

  async put(product: ProductRecord): Promise<void> {
    this.store.products.set(product.productId, { ...product });
  }

  async update(product: ProductRecord): Promise<void> {
    if (!this.store.products.has(product.productId)) {
      throw notFound("Producto no encontrado");
    }
    this.store.products.set(product.productId, { ...product });
  }

  async adjustStock(
    productId: string,
    delta: number,
    extras?: { lastPurchaseCost?: number; updatedAt: string },
  ): Promise<ProductRecord> {
    const product = this.store.products.get(productId);
    if (!product) throw notFound("Producto no encontrado");
    const next = product.stock + delta;
    if (next < 0) {
      throw insufficientStock(product.stock, Math.abs(delta), product.name);
    }
    const updated: ProductRecord = {
      ...product,
      stock: next,
      updatedAt: extras?.updatedAt ?? product.updatedAt,
      ...(extras?.lastPurchaseCost !== undefined
        ? { lastPurchaseCost: extras.lastPurchaseCost }
        : {}),
    };
    this.store.products.set(productId, updated);
    return updated;
  }
}

export class InMemoryMovementRepository implements MovementRepository {
  constructor(private readonly store: InMemoryStore) {}

  async put(movement: MovementRecord): Promise<void> {
    this.store.movements.set(movement.movementId, { ...movement });
  }

  async list(options: ListMovementsOptions = {}): Promise<MovementRecord[]> {
    let items = [...this.store.movements.values()];
    if (options.productId) {
      items = items.filter((m) => m.productId === options.productId);
    }
    if (options.type) {
      items = items.filter((m) => m.type === options.type);
    }
    if (options.from) {
      items = items.filter((m) => m.createdAt >= options.from!);
    }
    if (options.to) {
      items = items.filter((m) => m.createdAt <= options.to!);
    }
    return items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
}

export class InMemorySaleRepository implements SaleRepository {
  constructor(
    private readonly store: InMemoryStore,
    private readonly products: ProductRepository,
  ) {}

  async getById(saleId: string): Promise<SaleRecord | null> {
    return this.store.sales.get(saleId) ?? null;
  }

  async list(options: ListSalesOptions = {}): Promise<SaleRecord[]> {
    let items = [...this.store.sales.values()];
    if (options.from) items = items.filter((s) => s.createdAt >= options.from!);
    if (options.to) items = items.filter((s) => s.createdAt <= options.to!);
    return items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async createSaleAtomic(input: CreateSaleTransactionInput): Promise<void> {
    // Simulate transaction: validate all first, then apply, or rollback.
    const snapshots = new Map<string, ProductRecord>();
    for (const update of input.stockUpdates) {
      const product = this.store.products.get(update.productId);
      if (!product) throw notFound("Producto no encontrado");
      if (!product.isActive) {
        throw conflict(
          `El producto ${product.name} está inactivo y no puede venderse`,
          "INACTIVE_PRODUCT",
        );
      }
      if (product.stock < update.quantity) {
        throw insufficientStock(product.stock, update.quantity, product.name);
      }
      snapshots.set(update.productId, { ...product });
    }

    try {
      for (const update of input.stockUpdates) {
        await this.products.adjustStock(
          update.productId,
          -update.quantity,
          { updatedAt: input.sale.createdAt },
        );
      }
      for (const movement of input.movements) {
        this.store.movements.set(movement.movementId, { ...movement });
      }
      this.store.sales.set(input.sale.saleId, { ...input.sale });
    } catch (err) {
      for (const [id, snap] of snapshots) {
        this.store.products.set(id, snap);
      }
      for (const movement of input.movements) {
        this.store.movements.delete(movement.movementId);
      }
      this.store.sales.delete(input.sale.saleId);
      throw err;
    }
  }
}
