import {
  MOVEMENT_TYPES,
  MOVEMENT_TYPE_LABELS,
  type InventoryMovement,
  type MovementType,
} from "@motory/shared";
import { useEffect, useState } from "react";
import { api, ApiClientError } from "../api/client";
import { EmptyState } from "../components/EmptyState";
import { formatDate, formatMoney, formatSignedQty } from "../lib/format";

export function MovementsPage() {
  const [preset, setPreset] = useState("today");
  const [type, setType] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [movements, setMovements] = useState<InventoryMovement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const params: Record<string, string | undefined> = {
          type: type || undefined,
        };
        if (preset === "custom") {
          params.from = from ? new Date(`${from}T00:00:00-05:00`).toISOString() : undefined;
          params.to = to ? new Date(`${to}T23:59:59-05:00`).toISOString() : undefined;
        } else {
          params.preset = preset;
        }
        const res = await api.listMovements(params);
        if (!cancelled) {
          setMovements(res.movements);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof ApiClientError
              ? err.message
              : "No se pudieron cargar los movimientos",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [preset, type, from, to]);

  function movementValue(m: InventoryMovement): string {
    if (m.type === "PURCHASE" && m.unitCost != null) {
      return formatMoney(m.unitCost * Math.abs(m.quantity));
    }
    if (m.type === "SALE" && m.unitPrice != null) {
      return formatMoney(m.unitPrice * Math.abs(m.quantity));
    }
    return "—";
  }

  return (
    <div>
      <div className="page-header">
        <h1>Movimientos</h1>
        <p>Historial de compras, ventas y ajustes de inventario.</p>
      </div>

      <div className="toolbar">
        <select
          className="select"
          style={{ maxWidth: 180 }}
          value={preset}
          onChange={(e) => setPreset(e.target.value)}
        >
          <option value="today">Hoy</option>
          <option value="week">Esta semana</option>
          <option value="month">Este mes</option>
          <option value="custom">Rango personalizado</option>
        </select>
        <select
          className="select"
          style={{ maxWidth: 180 }}
          value={type}
          onChange={(e) => setType(e.target.value)}
        >
          <option value="">Todos los tipos</option>
          {MOVEMENT_TYPES.map((t) => (
            <option key={t} value={t}>
              {MOVEMENT_TYPE_LABELS[t as MovementType]}
            </option>
          ))}
        </select>
        {preset === "custom" ? (
          <>
            <input
              className="input"
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              style={{ maxWidth: 160 }}
            />
            <input
              className="input"
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              style={{ maxWidth: 160 }}
            />
          </>
        ) : null}
      </div>

      {error ? <div className="alert alert-error">{error}</div> : null}
      {loading ? <div className="loading">Cargando…</div> : null}

      {!loading && movements.length === 0 ? (
        <EmptyState
          title="Sin movimientos"
          description="Aún no hay movimientos en el rango seleccionado."
        />
      ) : null}

      {!loading && movements.length > 0 ? (
        <div className="card table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Producto</th>
                <th>Movimiento</th>
                <th>Cantidad</th>
                <th>Valor</th>
              </tr>
            </thead>
            <tbody>
              {movements.map((m) => (
                <tr key={m.movementId}>
                  <td>{formatDate(m.createdAt)}</td>
                  <td>{m.productName}</td>
                  <td>{MOVEMENT_TYPE_LABELS[m.type]}</td>
                  <td>{formatSignedQty(m.quantity)}</td>
                  <td>{movementValue(m)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
