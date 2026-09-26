import type { ReportSummary } from "@motory/shared";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, ApiClientError } from "../api/client";
import { EmptyState } from "../components/EmptyState";
import { StatusBadge } from "../components/StatusBadge";
import { formatMoney } from "../lib/format";

export function ReportsPage() {
  const [preset, setPreset] = useState("month");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [summary, setSummary] = useState<ReportSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const params: Record<string, string | undefined> = {};
        if (preset === "custom") {
          params.from = from
            ? new Date(`${from}T00:00:00-05:00`).toISOString()
            : undefined;
          params.to = to
            ? new Date(`${to}T23:59:59-05:00`).toISOString()
            : undefined;
        } else {
          params.preset = preset;
        }
        const res = await api.reportSummary(params);
        if (!cancelled) {
          setSummary(res.summary);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof ApiClientError
              ? err.message
              : "No se pudo cargar el reporte",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [preset, from, to]);

  return (
    <div>
      <div className="page-header">
        <h1>Reportes</h1>
        <p>Resumen sencillo de ventas, costos y stock.</p>
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

      {summary && !loading ? (
        <>
          {summary.costEstimateIncomplete ? (
            <div className="alert alert-info">
              Algunos productos vendidos no tienen costo de compra registrado.
              La utilidad bruta es aproximada.
            </div>
          ) : null}

          <div className="stats">
            <div className="card stat">
              <div className="label">Ventas totales</div>
              <div className="value">{formatMoney(summary.salesTotal)}</div>
            </div>
            <div className="card stat">
              <div className="label">Cantidad de ventas</div>
              <div className="value">{summary.salesCount}</div>
            </div>
            <div className="card stat">
              <div className="label">Unidades vendidas</div>
              <div className="value">{summary.unitsSold}</div>
            </div>
          </div>

          <div className="stats">
            <div className="card stat">
              <div className="label">Costo aprox. vendido</div>
              <div className="value">{formatMoney(summary.costOfGoodsSold)}</div>
            </div>
            <div className="card stat">
              <div className="label">Utilidad bruta aprox.</div>
              <div className="value">{formatMoney(summary.grossProfit)}</div>
            </div>
            <div className="card stat">
              <div className="label">Valor inventario</div>
              <div className="value">{formatMoney(summary.inventoryValue)}</div>
            </div>
          </div>

          <h2 className="section-title">Productos más vendidos</h2>
          {summary.topProducts.length === 0 ? (
            <EmptyState title="Sin ventas en el período" />
          ) : (
            <div className="card table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>Producto</th>
                    <th>Unidades</th>
                    <th>Ingresos</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.topProducts.map((p) => (
                    <tr key={p.productId}>
                      <td>{p.name}</td>
                      <td>{p.unitsSold}</td>
                      <td>{formatMoney(p.revenue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <h2 className="section-title">Productos con stock bajo</h2>
          {summary.lowStockProducts.length === 0 ? (
            <EmptyState title="Ningún producto con stock bajo" />
          ) : (
            <div className="card table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>Producto</th>
                    <th>Stock</th>
                    <th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.lowStockProducts.map((p) => (
                    <tr key={p.productId}>
                      <td>
                        <Link to={`/inventory/${p.productId}`}>{p.name}</Link>
                      </td>
                      <td>
                        {p.stock} / mín. {p.minimumStock}
                      </td>
                      <td>
                        <StatusBadge
                          stock={p.stock}
                          minimumStock={p.minimumStock}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      ) : null}
    </div>
  );
}
