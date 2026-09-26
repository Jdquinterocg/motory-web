import { PRODUCT_CATEGORIES, type Product } from "@motory/shared";
import { Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, ApiClientError } from "../api/client";
import { EmptyState } from "../components/EmptyState";
import { StatusBadge } from "../components/StatusBadge";
import { formatMoney } from "../lib/format";

export function InventoryPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("");
  const [lowStock, setLowStock] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await api.listProducts({
          q: q || undefined,
          category: category || undefined,
          lowStock: lowStock ? "true" : undefined,
        });
        if (!cancelled) {
          setProducts(res.products);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof ApiClientError
              ? err.message
              : "No se pudo cargar el inventario",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [q, category, lowStock]);

  return (
    <div>
      <div className="page-header">
        <h1>Inventario</h1>
        <p>Consulta y administra los repuestos de tu taller.</p>
      </div>

      <div className="toolbar">
        <input
          className="search-input"
          placeholder="Buscar por nombre, SKU, categoría o moto (ej. Pulsar NS200)"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <select
          className="select"
          style={{ maxWidth: 180 }}
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        >
          <option value="">Todas las categorías</option>
          {PRODUCT_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 600 }}>
          <input
            type="checkbox"
            checked={lowStock}
            onChange={(e) => setLowStock(e.target.checked)}
          />
          Stock bajo
        </label>
        <Link to="/inventory/new" className="btn btn-primary">
          <Plus size={16} /> Nuevo producto
        </Link>
        <Link to="/inventory/inactive" className="btn btn-ghost">
          Inactivos
        </Link>
      </div>

      {error ? <div className="alert alert-error">{error}</div> : null}
      {loading ? <div className="loading">Cargando…</div> : null}

      {!loading && products.length === 0 ? (
        <EmptyState
          title="No hay productos"
          description="Crea el primer repuesto o ajusta la búsqueda."
          action={
            <Link to="/inventory/new" className="btn btn-primary">
              Nuevo producto
            </Link>
          }
        />
      ) : null}

      {!loading && products.length > 0 ? (
        <div className="card table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Producto</th>
                <th>Categoría</th>
                <th>SKU</th>
                <th>Precio</th>
                <th>Stock</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr key={p.productId}>
                  <td>
                    <Link to={`/inventory/${p.productId}`}>{p.name}</Link>
                    {p.compatibilities.length > 0 ? (
                      <div className="compat-chips" style={{ marginTop: 4 }}>
                        {p.compatibilities.slice(0, 2).map((c, i) => (
                          <span key={i} className="chip">
                            {c.brand} {c.model}
                            {c.yearFrom || c.yearTo
                              ? ` ${c.yearFrom ?? "…"}-${c.yearTo ?? "…"}`
                              : ""}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </td>
                  <td>{p.category}</td>
                  <td>{p.sku ?? "—"}</td>
                  <td>{formatMoney(p.salePrice)}</td>
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
      ) : null}
    </div>
  );
}
