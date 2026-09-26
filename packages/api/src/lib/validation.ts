import { z } from "zod";
import { PRODUCT_CATEGORIES, PAYMENT_METHODS } from "@motory/shared";
import { AppError } from "./errors";

const compatibilitySchema = z.object({
  brand: z.string().trim().min(1).max(100),
  model: z.string().trim().min(1).max(100),
  yearFrom: z.number().int().min(1900).max(2100).optional(),
  yearTo: z.number().int().min(1900).max(2100).optional(),
});

export const createProductSchema = z.object({
  name: z.string().trim().min(1).max(200),
  sku: z.string().trim().min(1).max(100).optional(),
  category: z.enum(PRODUCT_CATEGORIES),
  description: z.string().trim().max(2000).optional(),
  salePrice: z.number().int().min(0),
  stock: z.number().int().min(0).optional(),
  minimumStock: z.number().int().min(0),
  compatibilities: z.array(compatibilitySchema).optional(),
});

export const updateProductSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  sku: z.string().trim().min(1).max(100).nullable().optional(),
  category: z.enum(PRODUCT_CATEGORIES).optional(),
  description: z.string().trim().max(2000).nullable().optional(),
  salePrice: z.number().int().min(0).optional(),
  minimumStock: z.number().int().min(0).optional(),
  compatibilities: z.array(compatibilitySchema).optional(),
});

export const inventoryEntrySchema = z.object({
  productId: z.string().min(1),
  quantity: z.number().int().positive(),
  unitCost: z.number().int().min(0),
  supplier: z.string().trim().max(200).optional(),
  createdAt: z.string().datetime().optional(),
});

export const inventoryAdjustmentSchema = z.object({
  productId: z.string().min(1),
  quantity: z.number().int().refine((n) => n !== 0, {
    message: "La cantidad de ajuste no puede ser 0",
  }),
  notes: z.string().trim().max(500).optional(),
  createdAt: z.string().datetime().optional(),
});

export const createSaleSchema = z.object({
  items: z
    .array(
      z.object({
        productId: z.string().min(1),
        quantity: z.number().int().positive(),
        salePrice: z.number().int().min(0),
      }),
    )
    .min(1, "La venta debe tener al menos un producto"),
  paymentMethod: z.enum(PAYMENT_METHODS),
  customer: z
    .object({
      name: z.string().trim().min(1).max(200),
      phone: z.string().trim().max(50).optional(),
      plate: z.string().trim().max(20).optional(),
      bikeBrand: z.string().trim().max(100).optional(),
      bikeModel: z.string().trim().max(100).optional(),
      bikeYear: z.number().int().min(1900).max(2100).optional(),
    })
    .optional(),
});

export function parseOrThrow<T>(schema: z.ZodType<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new AppError(
      400,
      "VALIDATION_ERROR",
      "Datos inválidos",
      result.error.flatten(),
    );
  }
  return result.data;
}
