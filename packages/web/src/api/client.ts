import type {
  CreateProductInput,
  CreateSaleInput,
  DashboardSummary,
  InventoryAdjustmentInput,
  InventoryEntryInput,
  InventoryMovement,
  Product,
  ReportSummary,
  Sale,
  UpdateProductInput,
} from "@motory/shared";

const BASE = import.meta.env.VITE_API_URL?.replace(/\/$/, "") ?? "";

export class ApiClientError extends Error {
  status: number;
  code: string;
  details?: unknown;

  constructor(
    status: number,
    code: string,
    message: string,
    details?: unknown,
  ) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  if (!BASE) {
    throw new ApiClientError(
      0,
      "NO_API_URL",
      "Falta VITE_API_URL. Configura la URL de la API en .env",
    );
  }

  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  if (res.status === 204) return undefined as T;

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiClientError(
      res.status,
      data?.error?.code ?? "ERROR",
      data?.error?.message ?? "Error de red",
      data?.error?.details,
    );
  }
  return data as T;
}

function qs(params: Record<string, string | undefined>): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v) q.set(k, v);
  }
  const s = q.toString();
  return s ? `?${s}` : "";
}

export const api = {
  dashboard: () =>
    request<{ dashboard: DashboardSummary }>("/api/v1/dashboard"),

  listProducts: (params: Record<string, string | undefined> = {}) =>
    request<{ products: Product[] }>(`/api/v1/products${qs(params)}`),

  getProduct: (id: string) =>
    request<{ product: Product }>(`/api/v1/products/${id}`),

  createProduct: (body: CreateProductInput) =>
    request<{ product: Product }>("/api/v1/products", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  updateProduct: (id: string, body: UpdateProductInput) =>
    request<{ product: Product }>(`/api/v1/products/${id}`, {
      method: "PUT",
      body: JSON.stringify(body),
    }),

  deleteProduct: (id: string) =>
    request<{ product: Product }>(`/api/v1/products/${id}`, {
      method: "DELETE",
    }),

  restoreProduct: (id: string) =>
    request<{ product: Product }>(`/api/v1/products/${id}/restore`, {
      method: "POST",
    }),

  createEntry: (body: InventoryEntryInput) =>
    request<{ movement: InventoryMovement; product: Product }>(
      "/api/v1/inventory/entries",
      { method: "POST", body: JSON.stringify(body) },
    ),

  createAdjustment: (body: InventoryAdjustmentInput) =>
    request<{ movement: InventoryMovement; product: Product }>(
      "/api/v1/inventory/adjustments",
      { method: "POST", body: JSON.stringify(body) },
    ),

  listMovements: (params: Record<string, string | undefined> = {}) =>
    request<{ movements: InventoryMovement[] }>(
      `/api/v1/inventory/movements${qs(params)}`,
    ),

  createSale: (body: CreateSaleInput) =>
    request<{ sale: Sale }>("/api/v1/sales", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  getSale: (id: string) => request<{ sale: Sale }>(`/api/v1/sales/${id}`),

  listSales: (params: Record<string, string | undefined> = {}) =>
    request<{ sales: Sale[] }>(`/api/v1/sales${qs(params)}`),

  reportSummary: (params: Record<string, string | undefined> = {}) =>
    request<{ summary: ReportSummary }>(
      `/api/v1/reports/summary${qs(params)}`,
    ),
};
