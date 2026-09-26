export const PRODUCT_CATEGORIES = [
  "Aceites",
  "Filtros",
  "Frenos",
  "Transmisión",
  "Llantas",
  "Eléctrico",
  "Otros",
] as const;

export type ProductCategory = (typeof PRODUCT_CATEGORIES)[number];

export function isProductCategory(value: string): value is ProductCategory {
  return (PRODUCT_CATEGORIES as readonly string[]).includes(value);
}
