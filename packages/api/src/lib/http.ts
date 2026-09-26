import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyResultV2,
} from "aws-lambda";
import { AppError } from "./errors";

const DEFAULT_ORIGINS = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
];

function allowedOrigins(): string[] {
  const fromEnv = process.env.CORS_ORIGINS?.split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return fromEnv?.length ? fromEnv : DEFAULT_ORIGINS;
}

export function corsHeaders(origin?: string): Record<string, string> {
  const allowed = allowedOrigins();
  const match =
    origin && allowed.includes(origin) ? origin : allowed[0] ?? "*";
  return {
    "Access-Control-Allow-Origin": match,
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

export function jsonResponse(
  statusCode: number,
  body: unknown,
  origin?: string,
): APIGatewayProxyResultV2 {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders(origin),
    },
    body: JSON.stringify(body),
  };
}

export function ok(body: unknown, origin?: string): APIGatewayProxyResultV2 {
  return jsonResponse(200, body, origin);
}

export function created(
  body: unknown,
  origin?: string,
): APIGatewayProxyResultV2 {
  return jsonResponse(201, body, origin);
}

export function noContent(origin?: string): APIGatewayProxyResultV2 {
  return {
    statusCode: 204,
    headers: corsHeaders(origin),
    body: "",
  };
}

export function optionsResponse(
  event: APIGatewayProxyEventV2,
): APIGatewayProxyResultV2 {
  return {
    statusCode: 204,
    headers: corsHeaders(event.headers?.origin ?? event.headers?.Origin),
    body: "",
  };
}

export function handleError(
  err: unknown,
  origin?: string,
): APIGatewayProxyResultV2 {
  if (err instanceof AppError) {
    return jsonResponse(
      err.statusCode,
      {
        error: {
          code: err.code,
          message: err.message,
          details: err.details,
        },
      },
      origin,
    );
  }

  console.error("Unhandled error", err);
  return jsonResponse(
    500,
    {
      error: {
        code: "INTERNAL_ERROR",
        message: "Error interno del servidor",
      },
    },
    origin,
  );
}

export function parseBody<T>(event: APIGatewayProxyEventV2): unknown {
  if (!event.body) return {};
  const raw = event.isBase64Encoded
    ? Buffer.from(event.body, "base64").toString("utf8")
    : event.body;
  try {
    return JSON.parse(raw) as T;
  } catch {
    throw new AppError(400, "INVALID_JSON", "El cuerpo de la solicitud no es JSON válido");
  }
}

export function getOrigin(event: APIGatewayProxyEventV2): string | undefined {
  return event.headers?.origin ?? event.headers?.Origin;
}
