import type {
  BikeCompatibility,
  CreateProductInput,
  Product,
  UpdateProductInput,
} from "@motory/shared";
import { badRequest, notFound } from "../lib/errors";
import { newId, nowIso } from "../lib/ids";
import type { ProductRecord, ProductRepository } from "../repos/types";
import { statusGsi, toPublicProduct } from "../repos/types";

export function matchesProductSearch(
  product: Product,
  query: string,
  yearHint?: number,
): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;

  const tokens = q.split(/\s+/).filter(Boolean);
  const haystack = [
    product.name,
    product.sku ?? "",
    product.category,
    product.description ?? "",
    ...product.compatibilities.flatMap((c) => [c.brand, c.model]),
  ]
    .join(" ")
    .toLowerCase();

  const textMatch = tokens.every((token) => haystack.includes(token));
  if (!textMatch) return false;

  if (yearHint !== undefined) {
    const hasCompat = product.compatibilities.some((c) =>
      yearMatches(c, yearHint),
    );
    // If product has no compatibilities, don't exclude on year.
    if (product.compatibilities.length > 0 && !hasCompat) return false;
  }

  return true;
}

function yearMatches(c: BikeCompatibility, year: number): boolean {
  const from = c.yearFrom ?? Number.NEGATIVE_INFINITY;
  const to = c.yearTo ?? Number.POSITIVE_INFINITY;
  return year >= from && year <= to;
}

export function extractYearHint(query: string): number | undefined {
  const match = query.match(/\b(19|20)\d{2}\b/);
  return match ? Number(match[0]) : undefined;
}

export class ProductService {
  constructor(private readonly products: ProductRepository) {}

  async create(input: CreateProductInput): Promise<Product> {
    if (input.salePrice < 0) throw badRequest("El precio no puede ser negativo");
    if ((input.stock ?? 0) < 0) throw badRequest("El stock no puede ser negativo");
    if (input.minimumStock < 0) {
      throw badRequest("El stock mínimo no puede ser negativo");
    }

    const now = nowIso();
    const name = input.name.trim();
    const product: ProductRecord = {
      productId: newId(),
      name,
      sku: input.sku?.trim() || undefined,
      category: input.category,
      description: input.description?.trim() || undefined,
      salePrice: input.salePrice,
      stock: input.stock ?? 0,
      minimumStock: input.minimumStock,
      compatibilities: input.compatibilities ?? [],
      isActive: true,
      createdAt: now,
      updatedAt: now,
      ...statusGsi(true, name),
    };

    await this.products.put(product);
    return toPublicProduct(product);
  }

  async getById(productId: string): Promise<Product> {
    const product = await this.products.getById(productId);
    if (!product) throw notFound("Producto no encontrado");
    return toPublicProduct(product);
  }

  async list(options: {
    q?: string;
    category?: string;
    lowStock?: boolean;
    includeInactive?: boolean;
    inactiveOnly?: boolean;
  } = {}): Promise<Product[]> {
    const records = await this.products.list({
      activeOnly: options.inactiveOnly
        ? false
        : options.includeInactive
          ? false
          : true,
      inactiveOnly: options.inactiveOnly ?? false,
    });

    // When includeInactive without inactiveOnly, list both.
    let items =
      options.includeInactive && !options.inactiveOnly
        ? await this.products.list({})
        : records;

    if (options.category) {
      items = items.filter((p) => p.category === options.category);
    }

    if (options.lowStock) {
      items = items.filter(
        (p) => p.isActive && p.stock <= p.minimumStock,
      );
    }

    if (options.q) {
      const yearHint = extractYearHint(options.q);
      items = items.filter((p) =>
        matchesProductSearch(toPublicProduct(p), options.q!, yearHint),
      );
    }

    return items.map(toPublicProduct);
  }

  async update(productId: string, input: UpdateProductInput): Promise<Product> {
    const existing = await this.products.getById(productId);
    if (!existing) throw notFound("Producto no encontrado");

    if (input.salePrice !== undefined && input.salePrice < 0) {
      throw badRequest("El precio no puede ser negativo");
    }
    if (input.minimumStock !== undefined && input.minimumStock < 0) {
      throw badRequest("El stock mínimo no puede ser negativo");
    }

    const name = input.name?.trim() ?? existing.name;
    const updated: ProductRecord = {
      ...existing,
      name,
      sku:
        input.sku === null
          ? undefined
          : input.sku !== undefined
            ? input.sku.trim() || undefined
            : existing.sku,
      category: input.category ?? existing.category,
      description:
        input.description === null
          ? undefined
          : input.description !== undefined
            ? input.description.trim() || undefined
            : existing.description,
      salePrice: input.salePrice ?? existing.salePrice,
      minimumStock: input.minimumStock ?? existing.minimumStock,
      compatibilities: input.compatibilities ?? existing.compatibilities,
      updatedAt: nowIso(),
      ...statusGsi(existing.isActive, name),
    };

    await this.products.update(updated);
    return toPublicProduct(updated);
  }

  async softDelete(productId: string): Promise<Product> {
    const existing = await this.products.getById(productId);
    if (!existing) throw notFound("Producto no encontrado");
    if (!existing.isActive) return toPublicProduct(existing);

    const updated: ProductRecord = {
      ...existing,
      isActive: false,
      updatedAt: nowIso(),
      ...statusGsi(false, existing.name),
    };
    await this.products.update(updated);
    return toPublicProduct(updated);
  }

  async restore(productId: string): Promise<Product> {
    const existing = await this.products.getById(productId);
    if (!existing) throw notFound("Producto no encontrado");
    if (existing.isActive) return toPublicProduct(existing);

    const updated: ProductRecord = {
      ...existing,
      isActive: true,
      updatedAt: nowIso(),
      ...statusGsi(true, existing.name),
    };
    await this.products.update(updated);
    return toPublicProduct(updated);
  }
}
