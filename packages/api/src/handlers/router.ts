import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyHandlerV2,
} from "aws-lambda";
import {
  endOfDayBogota,
  startOfDayBogota,
  startOfMonthBogota,
  startOfWeekBogota,
} from "../lib/dates";
import { AppError, badRequest } from "../lib/errors";
import {
  created,
  getOrigin,
  handleError,
  ok,
  optionsResponse,
  parseBody,
} from "../lib/http";
import {
  createProductSchema,
  createSaleSchema,
  inventoryAdjustmentSchema,
  inventoryEntrySchema,
  parseOrThrow,
  updateProductSchema,
} from "../lib/validation";
import { getServices } from "../services/container";

function pathParams(event: APIGatewayProxyEventV2): Record<string, string> {
  const raw = event.pathParameters ?? {};
  const result: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (v !== undefined) result[k] = v;
  }
  return result;
}

function query(event: APIGatewayProxyEventV2): Record<string, string> {
  const q = event.queryStringParameters ?? {};
  const result: Record<string, string> = {};
  for (const [k, v] of Object.entries(q)) {
    if (v !== undefined) result[k] = v;
  }
  return result;
}

/** Normalize path: strip stage prefix if present. */
function normalizePath(raw: string): string {
  let path = raw.split("?")[0] || "/";
  // HTTP API may include stage like /Prod/api/v1/...
  path = path.replace(/^\/(Prod|Stage|dev)/i, "");
  if (!path.startsWith("/api/v1")) {
    // allow both /api/v1/... and bare /products if mapped that way
    if (path.startsWith("/products") || path.startsWith("/inventory") || path.startsWith("/sales") || path.startsWith("/reports") || path.startsWith("/dashboard")) {
      path = `/api/v1${path}`;
    }
  }
  return path;
}

function resolveDateRange(q: Record<string, string>): { from: string; to: string } {
  const preset = q.preset;
  const now = new Date();
  if (preset === "today") {
    return { from: startOfDayBogota(now), to: endOfDayBogota(now) };
  }
  if (preset === "week") {
    return { from: startOfWeekBogota(now), to: endOfDayBogota(now) };
  }
  if (preset === "month") {
    return { from: startOfMonthBogota(now), to: endOfDayBogota(now) };
  }
  if (q.from && q.to) {
    return { from: q.from, to: q.to };
  }
  // Default: current month
  return { from: startOfMonthBogota(now), to: endOfDayBogota(now) };
}

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  const origin = getOrigin(event);
  if (event.requestContext.http.method === "OPTIONS") {
    return optionsResponse(event);
  }

  try {
    const method = event.requestContext.http.method;
    const path = normalizePath(event.rawPath);
    const services = getServices();
    const params = pathParams(event);
    const q = query(event);

    // Products
    if (method === "GET" && path === "/api/v1/products") {
      const products = await services.products.list({
        q: q.q,
        category: q.category,
        lowStock: q.lowStock === "true",
        includeInactive: q.includeInactive === "true",
        inactiveOnly: q.inactiveOnly === "true",
      });
      return ok({ products }, origin);
    }

    if (method === "POST" && path === "/api/v1/products") {
      const body = parseOrThrow(createProductSchema, parseBody(event));
      const product = await services.products.create(body);
      return created({ product }, origin);
    }

    if (method === "GET" && path.match(/^\/api\/v1\/products\/[^/]+$/)) {
      const id = params.id ?? path.split("/").pop()!;
      const product = await services.products.getById(id);
      return ok({ product }, origin);
    }

    if (method === "PUT" && path.match(/^\/api\/v1\/products\/[^/]+$/)) {
      const id = params.id ?? path.split("/").pop()!;
      const body = parseOrThrow(updateProductSchema, parseBody(event));
      const product = await services.products.update(id, body);
      return ok({ product }, origin);
    }

    if (method === "DELETE" && path.match(/^\/api\/v1\/products\/[^/]+$/)) {
      const id = params.id ?? path.split("/").pop()!;
      const product = await services.products.softDelete(id);
      return ok({ product }, origin);
    }

    if (method === "POST" && path.match(/^\/api\/v1\/products\/[^/]+\/restore$/)) {
      const parts = path.split("/");
      const id = params.id ?? parts[parts.length - 2]!;
      const product = await services.products.restore(id);
      return ok({ product }, origin);
    }

    // Inventory
    if (method === "POST" && path === "/api/v1/inventory/entries") {
      const body = parseOrThrow(inventoryEntrySchema, parseBody(event));
      const result = await services.inventory.createEntry(body);
      return created(result, origin);
    }

    if (method === "POST" && path === "/api/v1/inventory/adjustments") {
      const body = parseOrThrow(inventoryAdjustmentSchema, parseBody(event));
      const result = await services.inventory.createAdjustment(body);
      return created(result, origin);
    }

    if (method === "GET" && path === "/api/v1/inventory/movements") {
      const range: { from?: string; to?: string } =
        q.from || q.to || q.preset ? resolveDateRange(q) : {};
      const movements = await services.inventory.listMovements({
        from: range.from ?? q.from,
        to: range.to ?? q.to,
        type: q.type,
        productId: q.productId,
      });
      return ok({ movements }, origin);
    }

    // Sales
    if (method === "POST" && path === "/api/v1/sales") {
      const body = parseOrThrow(createSaleSchema, parseBody(event));
      const sale = await services.sales.create(body);
      return created({ sale }, origin);
    }

    if (method === "GET" && path === "/api/v1/sales") {
      const range = resolveDateRange(q);
      const sales = await services.sales.list(range);
      return ok({ sales }, origin);
    }

    if (method === "GET" && path.match(/^\/api\/v1\/sales\/[^/]+$/)) {
      const id = params.id ?? path.split("/").pop()!;
      const sale = await services.sales.getById(id);
      return ok({ sale }, origin);
    }

    // Reports
    if (method === "GET" && path === "/api/v1/reports/summary") {
      const range = resolveDateRange(q);
      if (!range.from || !range.to) {
        throw badRequest("Se requiere rango de fechas");
      }
      const summary = await services.reports.summary(range.from, range.to);
      return ok({ summary }, origin);
    }

    if (method === "GET" && path === "/api/v1/dashboard") {
      const dashboard = await services.reports.dashboard();
      return ok({ dashboard }, origin);
    }

    return handleError(
      new AppError(404, "NOT_FOUND", `Ruta no encontrada: ${method} ${path}`),
      origin,
    );
  } catch (err) {
    return handleError(err, origin);
  }
};
