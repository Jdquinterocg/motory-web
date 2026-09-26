const BOGOTA = "America/Bogota";

export function startOfDayBogota(date = new Date()): string {
  const parts = getBogotaParts(date);
  return bogotaLocalToUtcIso(parts.year, parts.month, parts.day, 0, 0, 0);
}

export function endOfDayBogota(date = new Date()): string {
  const parts = getBogotaParts(date);
  return bogotaLocalToUtcIso(parts.year, parts.month, parts.day, 23, 59, 59, 999);
}

export function startOfWeekBogota(date = new Date()): string {
  const parts = getBogotaParts(date);
  const asUtcNoon = Date.UTC(parts.year, parts.month - 1, parts.day, 17, 0, 0);
  const dow = new Date(asUtcNoon).getUTCDay();
  const mondayOffset = dow === 0 ? -6 : 1 - dow;
  const monday = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + mondayOffset));
  return bogotaLocalToUtcIso(
    monday.getUTCFullYear(),
    monday.getUTCMonth() + 1,
    monday.getUTCDate(),
    0,
    0,
    0,
  );
}

export function startOfMonthBogota(date = new Date()): string {
  const parts = getBogotaParts(date);
  return bogotaLocalToUtcIso(parts.year, parts.month, 1, 0, 0, 0);
}

function getBogotaParts(date: Date): {
  year: number;
  month: number;
  day: number;
} {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: BOGOTA,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const [year, month, day] = fmt.format(date).split("-").map(Number);
  return { year, month, day };
}

/** Convert Bogota local wall time to UTC ISO (Bogota is UTC-5, no DST). */
function bogotaLocalToUtcIso(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number,
  ms = 0,
): string {
  const utcMs = Date.UTC(year, month - 1, day, hour + 5, minute, second, ms);
  return new Date(utcMs).toISOString();
}
