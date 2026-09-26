import {
  DynamoMovementRepository,
  DynamoProductRepository,
  DynamoSaleRepository,
} from "../repos/dynamo";
import {
  InMemoryMovementRepository,
  InMemoryProductRepository,
  InMemorySaleRepository,
  InMemoryStore,
} from "../repos/memory";
import { InventoryService } from "./inventoryService";
import { ProductService } from "./productService";
import { ReportService } from "./reportService";
import { SaleService } from "./saleService";

export interface AppServices {
  products: ProductService;
  inventory: InventoryService;
  sales: SaleService;
  reports: ReportService;
}

export function createDynamoServices(): AppServices {
  const products = new DynamoProductRepository();
  const movements = new DynamoMovementRepository();
  const sales = new DynamoSaleRepository();
  return {
    products: new ProductService(products),
    inventory: new InventoryService(products, movements),
    sales: new SaleService(products, sales),
    reports: new ReportService(products, movements, sales),
  };
}

export function createMemoryServices(store = new InMemoryStore()): {
  services: AppServices;
  store: InMemoryStore;
} {
  const products = new InMemoryProductRepository(store);
  const movements = new InMemoryMovementRepository(store);
  const sales = new InMemorySaleRepository(store, products);
  return {
    store,
    services: {
      products: new ProductService(products),
      inventory: new InventoryService(products, movements),
      sales: new SaleService(products, sales),
      reports: new ReportService(products, movements, sales),
    },
  };
}

let cached: AppServices | null = null;

export function getServices(): AppServices {
  if (!cached) {
    cached = createDynamoServices();
  }
  return cached;
}
