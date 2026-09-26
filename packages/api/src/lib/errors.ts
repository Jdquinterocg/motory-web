export class AppError extends Error {
  readonly statusCode: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(
    statusCode: number,
    code: string,
    message: string,
    details?: unknown,
  ) {
    super(message);
    this.name = "AppError";
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

export function badRequest(
  message: string,
  code = "BAD_REQUEST",
  details?: unknown,
): AppError {
  return new AppError(400, code, message, details);
}

export function notFound(message: string, code = "NOT_FOUND"): AppError {
  return new AppError(404, code, message);
}

export function conflict(message: string, code = "CONFLICT"): AppError {
  return new AppError(409, code, message);
}

export function insufficientStock(
  available: number,
  requested: number,
  productName: string,
): AppError {
  return new AppError(
    409,
    "INSUFFICIENT_STOCK",
    `Stock insuficiente. Hay ${available} unidades disponibles y está intentando vender ${requested} de ${productName}.`,
    { available, requested, productName },
  );
}
