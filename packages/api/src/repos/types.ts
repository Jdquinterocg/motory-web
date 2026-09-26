import type {
  InventoryMovement,
  Product,
  Sale,
} from "@motory/shared";

export interface ProductRecord extends Product {
  gsi1pk: string;
  gsi1sk: string;
}

export interface MovementRecord extends InventoryMovement {
  gsi1pk: string;
  gsi1sk: string;
  gsi2pk: string;
  gsi2sk: string;
}

export interface SaleRecord extends Sale {
  gsi1pk: string;
  gsi1sk: string;
}

export interface ListProductsOptions {
  activeOnly?: boolean;
  inactiveOnly?: boolean;
}

export interface ListMovementsOptions {
  from?: string;
  to?: string;
  type?: string;
  productId?: string;
}

export interface ListSalesOptions {
  from?: string;
  to?: string;
}

export interface SaleTransactionItem {
  product: Product;
  quantity: number;
  salePrice: number;
  unitCostEstimate: number;
}

export interface CreateSaleTransactionInput {
  sale: SaleRecord;
  movements: MovementRecord[];
  stockUpdates: Array<{ productId: string; quantity: number }>;
}

export interface ProductRepository {
  getById(productId: string): Promise<ProductRecord | null>;
  list(options?: ListProductsOptions): Promise<ProductRecord[]>;
  put(product: ProductRecord): Promise<void>;
  update(product: ProductRecord): Promise<void>;
  /** Atomic stock increment (can be negative). Fails if resulting stock would be negative. */
  adjustStock(
    productId: string,
    delta: number,
    extras?: { lastPurchaseCost?: number; updatedAt: string },
  ): Promise<ProductRecord>;
}

export interface MovementRepository {
  put(movement: MovementRecord): Promise<void>;
  list(options?: ListMovementsOptions): Promise<MovementRecord[]>;
}

export interface SaleRepository {
  getById(saleId: string): Promise<SaleRecord | null>;
  list(options?: ListSalesOptions): Promise<SaleRecord[]>;
  createSaleAtomic(input: CreateSaleTransactionInput): Promise<void>;
}

export function statusGsi(isActive: boolean, name: string): {
  gsi1pk: string;
  gsi1sk: string;
} {
  return {
    gsi1pk: isActive ? "STATUS#ACTIVE" : "STATUS#INACTIVE",
    gsi1sk: `NAME#${name.trim().toLowerCase()}`,
  };
}

export function movementGsi(
  productId: string,
  createdAt: string,
  movementId: string,
): Pick<MovementRecord, "gsi1pk" | "gsi1sk" | "gsi2pk" | "gsi2sk"> {
  return {
    gsi1pk: "MOVEMENT",
    gsi1sk: `${createdAt}#${movementId}`,
    gsi2pk: `PRODUCT#${productId}`,
    gsi2sk: `${createdAt}#${movementId}`,
  };
}

export function saleGsi(
  createdAt: string,
  saleId: string,
): Pick<SaleRecord, "gsi1pk" | "gsi1sk"> {
  return {
    gsi1pk: "SALE",
    gsi1sk: `${createdAt}#${saleId}`,
  };
}

export function toPublicProduct(record: ProductRecord): Product {
  const {
    gsi1pk: _a,
    gsi1sk: _b,
    ...product
  } = record;
  return product;
}

export function toPublicMovement(record: MovementRecord): InventoryMovement {
  const {
    gsi1pk: _a,
    gsi1sk: _b,
    gsi2pk: _c,
    gsi2sk: _d,
    ...movement
  } = record;
  return movement;
}

export function toPublicSale(record: SaleRecord): Sale {
  const { gsi1pk: _a, gsi1sk: _b, ...sale } = record;
  return sale;
}
