import type {
  DashboardSummary,
  Product,
  ReportSummary,
  TopSoldProduct,
} from "@motory/shared";
import {
  endOfDayBogota,
  startOfDayBogota,
} from "../lib/dates";
import type {
  MovementRepository,
  ProductRepository,
  SaleRepository,
} from "../repos/types";
import { toPublicProduct } from "../repos/types";

export class ReportService {
  constructor(
    private readonly products: ProductRepository,
    private readonly movements: MovementRepository,
    private readonly sales: SaleRepository,
  ) {}

  async summary(from: string, to: string): Promise<ReportSummary> {
    const [sales, saleMovements, activeProducts] = await Promise.all([
      this.sales.list({ from, to }),
      this.movements.list({ from, to, type: "SALE" }),
      this.products.list({ activeOnly: true }),
    ]);

    const salesTotal = sales.reduce((sum, s) => sum + s.total, 0);
    const salesCount = sales.length;
    const unitsSold = saleMovements.reduce(
      (sum, m) => sum + Math.abs(m.quantity),
      0,
    );

    let costOfGoodsSold = 0;
    let costEstimateIncomplete = false;
    for (const m of saleMovements) {
      const unitCost = m.unitCostEstimate ?? 0;
      if (m.unitCostEstimate === undefined || m.unitCostEstimate === 0) {
        // 0 may mean unknown; treat as incomplete if never had purchase cost.
        if (m.unitCostEstimate === undefined || m.unitCostEstimate === 0) {
          costEstimateIncomplete = true;
        }
      }
      costOfGoodsSold += unitCost * Math.abs(m.quantity);
    }

    const grossProfit = salesTotal - costOfGoodsSold;

    const topMap = new Map<string, TopSoldProduct>();
    for (const m of saleMovements) {
      const existing = topMap.get(m.productId) ?? {
        productId: m.productId,
        name: m.productName,
        unitsSold: 0,
        revenue: 0,
      };
      existing.unitsSold += Math.abs(m.quantity);
      existing.revenue += (m.unitPrice ?? 0) * Math.abs(m.quantity);
      topMap.set(m.productId, existing);
    }
    const topProducts = [...topMap.values()]
      .sort((a, b) => b.unitsSold - a.unitsSold)
      .slice(0, 10);

    const lowStockProducts = activeProducts
      .filter((p) => p.stock <= p.minimumStock)
      .map(toPublicProduct);

    let inventoryValue = 0;
    for (const p of activeProducts) {
      inventoryValue += p.stock * (p.lastPurchaseCost ?? 0);
    }

    return {
      from,
      to,
      salesTotal,
      salesCount,
      unitsSold,
      costOfGoodsSold,
      grossProfit,
      costEstimateIncomplete,
      topProducts,
      lowStockProducts,
      inventoryValue,
    };
  }

  async dashboard(): Promise<DashboardSummary> {
    const from = startOfDayBogota();
    const to = endOfDayBogota();
    const [activeProducts, todaySales] = await Promise.all([
      this.products.list({ activeOnly: true }),
      this.sales.list({ from, to }),
    ]);

    const lowStockProducts: Product[] = activeProducts
      .filter((p) => p.stock <= p.minimumStock)
      .map(toPublicProduct);

    return {
      activeProductCount: activeProducts.length,
      lowStockCount: lowStockProducts.length,
      todaySalesCount: todaySales.length,
      todaySalesTotal: todaySales.reduce((sum, s) => sum + s.total, 0),
      lowStockProducts: lowStockProducts.slice(0, 10),
    };
  }
}
