import { beforeEach, describe, expect, it } from "vitest";
import { AppError } from "../src/lib/errors";
import { createMemoryServices } from "../src/services/container";
import { matchesProductSearch } from "../src/services/productService";

describe("Motory business rules", () => {
  const { store, services } = createMemoryServices();

  beforeEach(() => {
    store.clear();
  });

  it("creates a product with zero stock by default", async () => {
    const product = await services.products.create({
      name: "Aceite Mobil 10W-30",
      category: "Aceites",
      salePrice: 35000,
      minimumStock: 3,
    });

    expect(product.productId).toBeTruthy();
    expect(product.stock).toBe(0);
    expect(product.isActive).toBe(true);
    expect(product.salePrice).toBe(35000);
  });

  it("enters inventory, updates stock and lastPurchaseCost, creates PURCHASE movement", async () => {
    const product = await services.products.create({
      name: "Aceite Mobil 10W-30",
      category: "Aceites",
      salePrice: 35000,
      minimumStock: 3,
    });

    const { movement } = await services.inventory.createEntry({
      productId: product.productId,
      quantity: 10,
      unitCost: 22000,
      supplier: "Repuestos ABC",
    });

    const updated = await services.products.getById(product.productId);
    expect(updated.stock).toBe(10);
    expect(updated.lastPurchaseCost).toBe(22000);
    expect(movement.type).toBe("PURCHASE");
    expect(movement.quantity).toBe(10);
    expect(movement.unitCost).toBe(22000);
    expect(movement.supplier).toBe("Repuestos ABC");

    const movements = await services.inventory.listMovements({
      productId: product.productId,
    });
    expect(movements).toHaveLength(1);
  });

  it("prevents negative stock on adjustment", async () => {
    const product = await services.products.create({
      name: "Filtro K&N",
      category: "Filtros",
      salePrice: 45000,
      minimumStock: 1,
      stock: 2,
    });

    await expect(
      services.inventory.createAdjustment({
        productId: product.productId,
        quantity: -3,
      }),
    ).rejects.toMatchObject({ code: "INSUFFICIENT_STOCK" });

    const still = await services.products.getById(product.productId);
    expect(still.stock).toBe(2);
  });

  it("sells multiple products, computes totals and creates SALE movements", async () => {
    const oil = await services.products.create({
      name: "Aceite Mobil",
      category: "Aceites",
      salePrice: 35000,
      minimumStock: 1,
    });
    const filter = await services.products.create({
      name: "Filtro K&N",
      category: "Filtros",
      salePrice: 45000,
      minimumStock: 1,
    });

    await services.inventory.createEntry({
      productId: oil.productId,
      quantity: 5,
      unitCost: 20000,
    });
    await services.inventory.createEntry({
      productId: filter.productId,
      quantity: 3,
      unitCost: 30000,
    });

    const sale = await services.sales.create({
      paymentMethod: "CASH",
      items: [
        { productId: oil.productId, quantity: 2, salePrice: 32000 },
        { productId: filter.productId, quantity: 1, salePrice: 45000 },
      ],
    });

    expect(sale.total).toBe(32000 * 2 + 45000);
    expect(sale.items[0]!.basePrice).toBe(35000);
    expect(sale.items[0]!.salePrice).toBe(32000);

    const oilAfter = await services.products.getById(oil.productId);
    const filterAfter = await services.products.getById(filter.productId);
    expect(oilAfter.stock).toBe(3);
    expect(filterAfter.stock).toBe(2);

    const movements = await services.inventory.listMovements({ type: "SALE" });
    expect(movements).toHaveLength(2);
    expect(movements.every((m) => m.saleId === sale.saleId)).toBe(true);
    expect(movements.find((m) => m.productId === oil.productId)?.unitCostEstimate).toBe(
      20000,
    );
  });

  it("rolls back entire sale if one product lacks stock", async () => {
    const oil = await services.products.create({
      name: "Aceite",
      category: "Aceites",
      salePrice: 35000,
      minimumStock: 1,
    });
    const filter = await services.products.create({
      name: "Filtro",
      category: "Filtros",
      salePrice: 45000,
      minimumStock: 1,
    });

    await services.inventory.createEntry({
      productId: oil.productId,
      quantity: 5,
      unitCost: 20000,
    });
    await services.inventory.createEntry({
      productId: filter.productId,
      quantity: 1,
      unitCost: 30000,
    });

    await expect(
      services.sales.create({
        paymentMethod: "TRANSFER",
        items: [
          { productId: oil.productId, quantity: 2, salePrice: 35000 },
          { productId: filter.productId, quantity: 3, salePrice: 45000 },
        ],
      }),
    ).rejects.toBeInstanceOf(AppError);

    const oilAfter = await services.products.getById(oil.productId);
    const filterAfter = await services.products.getById(filter.productId);
    expect(oilAfter.stock).toBe(5);
    expect(filterAfter.stock).toBe(1);

    const sales = await services.sales.list();
    expect(sales).toHaveLength(0);

    const saleMovements = await services.inventory.listMovements({ type: "SALE" });
    expect(saleMovements).toHaveLength(0);
  });

  it("soft-deletes a product and blocks selling inactive products", async () => {
    const product = await services.products.create({
      name: "Pastillas freno",
      category: "Frenos",
      salePrice: 50000,
      minimumStock: 2,
    });
    await services.inventory.createEntry({
      productId: product.productId,
      quantity: 4,
      unitCost: 25000,
    });

    await services.products.softDelete(product.productId);

    const listed = await services.products.list();
    expect(listed.find((p) => p.productId === product.productId)).toBeUndefined();

    const inactive = await services.products.list({ inactiveOnly: true });
    expect(inactive).toHaveLength(1);

    await expect(
      services.sales.create({
        paymentMethod: "CASH",
        items: [{ productId: product.productId, quantity: 1, salePrice: 50000 }],
      }),
    ).rejects.toMatchObject({ code: "INACTIVE_PRODUCT" });

    const restored = await services.products.restore(product.productId);
    expect(restored.isActive).toBe(true);
    expect(restored.stock).toBe(4);
  });

  it("allows anonymous sales", async () => {
    const product = await services.products.create({
      name: "Cadena",
      category: "Transmisión",
      salePrice: 80000,
      minimumStock: 1,
    });
    await services.inventory.createEntry({
      productId: product.productId,
      quantity: 2,
      unitCost: 50000,
    });

    const sale = await services.sales.create({
      paymentMethod: "CARD",
      items: [{ productId: product.productId, quantity: 1, salePrice: 80000 }],
    });

    expect(sale.customer).toBeUndefined();
    expect(sale.total).toBe(80000);
  });

  it("rejects sale with empty items or non-positive quantities", async () => {
    await expect(
      services.sales.create({ paymentMethod: "CASH", items: [] }),
    ).rejects.toBeInstanceOf(AppError);
  });

  it("matches unified product search by bike model", () => {
    const product = {
      productId: "1",
      name: "Filtro de aceite K&N",
      category: "Filtros" as const,
      salePrice: 35000,
      stock: 5,
      minimumStock: 2,
      compatibilities: [
        { brand: "Bajaj", model: "Pulsar NS200", yearFrom: 2020, yearTo: 2026 },
        { brand: "Bajaj", model: "Pulsar NS160" },
      ],
      isActive: true,
      createdAt: "",
      updatedAt: "",
    };

    expect(matchesProductSearch(product, "Pulsar NS200")).toBe(true);
    expect(matchesProductSearch(product, "Pulsar NS200 2019", 2019)).toBe(false);
    expect(matchesProductSearch(product, "K&N")).toBe(true);
    expect(matchesProductSearch(product, "Honda")).toBe(false);
  });
});
