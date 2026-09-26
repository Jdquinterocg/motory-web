import type { ProductCategory } from "./categories";
import type { MovementType, PaymentMethod } from "./enums";

export interface BikeCompatibility {
  brand: string;
  model: string;
  yearFrom?: number;
  yearTo?: number;
}

export interface Product {
  productId: string;
  name: string;
  sku?: string;
  category: ProductCategory;
  description?: string;
  salePrice: number;
  stock: number;
  minimumStock: number;
  lastPurchaseCost?: number;
  compatibilities: BikeCompatibility[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface InventoryMovement {
  movementId: string;
  productId: string;
  productName: string;
  type: MovementType;
  quantity: number;
  unitCost?: number;
  unitPrice?: number;
  unitCostEstimate?: number;
  supplier?: string;
  saleId?: string;
  notes?: string;
  createdAt: string;
}

export interface SaleCustomer {
  name: string;
  phone?: string;
  plate?: string;
  bikeBrand?: string;
  bikeModel?: string;
  bikeYear?: number;
}

export interface SaleItem {
  productId: string;
  name: string;
  quantity: number;
  basePrice: number;
  salePrice: number;
  subtotal: number;
}

export interface Sale {
  saleId: string;
  createdAt: string;
  paymentMethod: PaymentMethod;
  customer?: SaleCustomer;
  items: SaleItem[];
  subtotal: number;
  total: number;
}

export interface CreateProductInput {
  name: string;
  sku?: string;
  category: ProductCategory;
  description?: string;
  salePrice: number;
  stock?: number;
  minimumStock: number;
  compatibilities?: BikeCompatibility[];
}

export interface UpdateProductInput {
  name?: string;
  sku?: string | null;
  category?: ProductCategory;
  description?: string | null;
  salePrice?: number;
  minimumStock?: number;
  compatibilities?: BikeCompatibility[];
}

export interface InventoryEntryInput {
  productId: string;
  quantity: number;
  unitCost: number;
  supplier?: string;
  createdAt?: string;
}

export interface InventoryAdjustmentInput {
  productId: string;
  quantity: number;
  notes?: string;
  createdAt?: string;
}

export interface CreateSaleItemInput {
  productId: string;
  quantity: number;
  salePrice: number;
}

export interface CreateSaleInput {
  items: CreateSaleItemInput[];
  paymentMethod: PaymentMethod;
  customer?: SaleCustomer;
}

export interface TopSoldProduct {
  productId: string;
  name: string;
  unitsSold: number;
  revenue: number;
}

export interface ReportSummary {
  from: string;
  to: string;
  salesTotal: number;
  salesCount: number;
  unitsSold: number;
  costOfGoodsSold: number;
  grossProfit: number;
  costEstimateIncomplete: boolean;
  topProducts: TopSoldProduct[];
  lowStockProducts: Product[];
  inventoryValue: number;
}

export interface DashboardSummary {
  activeProductCount: number;
  lowStockCount: number;
  todaySalesCount: number;
  todaySalesTotal: number;
  lowStockProducts: Product[];
}

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}
