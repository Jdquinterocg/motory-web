import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, ApiClientError } from "../api/client";
import { formatMoney } from "../lib/format";
import { EmptyState } from "../components/EmptyState";
import { StatusBadge } from "../components/StatusBadge";
import type { DashboardSummary } from "@motory/shared";
import { ArrowDownToLine, Package, ShoppingCart } from "lucide-react";

export function DashboardPage() {
  const [data, setData] = useState<DashboardSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await api.dashboard();
        if (!cancelled) setData(res.dashboard);
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof ApiClientError
              ? err.message
              : "No se pudo cargar el dashboard",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) return <div className="loading">Cargando…</div>;
  if (error) return <div className="alert alert-error">{error}</div>;
  if (!data) return null;

  return (
    <div>
      <div className="page-header">
        <h1>Buenos días</h1>
        <p>Resumen del taller · Tu taller, bajo control.</p>
      </div>

      <div className="stats">
        <div className="card stat">
          <div className="label">Ventas hoy</div>
          <div className="value">{formatMoney(data.todaySalesTotal)}</div>
        </div>
        <div className="card stat">
          <div className="label">Cantidad de ventas</div>
          <div className="value">{data.todaySalesCount}</div>
        </div>
        <div className="card stat">
          <div className="label">Stock bajo</div>
          <div className="value">{data.lowStockCount}</div>
        </div>
      </div>

      <div className="actions" style={{ marginBottom: "1.25rem" }}>
        <Link to="/sales/new" className="btn btn-primary">
          <ShoppingCart size={16} /> Nueva venta
        </Link>
        <Link to="/inventory" className="btn btn-secondary">
          <Package size={16} /> Ver inventario
        </Link>
        <Link to="/inventory" className="btn btn-ghost">
          <ArrowDownToLine size={16} /> Ingresar inventario
        </Link>
      </div>

      <h2 className="section-title">
        Inventario · {data.activeProductCount} productos activos
      </h2>

      {data.lowStockProducts.length === 0 ? (
        <EmptyState
          title="Sin productos con stock bajo"
          description="El inventario está por encima del mínimo."
        />
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
              {data.lowStockProducts.map((p) => (
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
    </div>
  );
}
