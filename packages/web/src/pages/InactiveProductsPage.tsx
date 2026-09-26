import type { Product } from "@motory/shared";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, ApiClientError } from "../api/client";
import { EmptyState } from "../components/EmptyState";

export function InactiveProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const res = await api.listProducts({ inactiveOnly: "true" });
      setProducts(res.products);
      setError(null);
    } catch (err) {
      setError(
        err instanceof ApiClientError
          ? err.message
          : "No se pudo cargar",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function restore(id: string) {
    try {
      await api.restoreProduct(id);
      setMessage("Producto restaurado");
      await load();
    } catch (err) {
      setError(
        err instanceof ApiClientError
          ? err.message
          : "No se pudo restaurar",
      );
    }
  }

  return (
    <div>
      <div className="page-header">
        <h1>Productos inactivos</h1>
        <p>Productos desactivados que conservan su historial.</p>
      </div>

      <div className="actions" style={{ marginBottom: "1rem" }}>
        <Link to="/inventory" className="btn btn-ghost">
          Volver al inventario
        </Link>
      </div>

      {message ? <div className="alert alert-success">{message}</div> : null}
      {error ? <div className="alert alert-error">{error}</div> : null}
      {loading ? <div className="loading">Cargando…</div> : null}

      {!loading && products.length === 0 ? (
        <EmptyState
          title="No hay productos inactivos"
          description="Los productos que desactives aparecerán aquí."
        />
      ) : null}

      {!loading && products.length > 0 ? (
        <div className="card table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Producto</th>
                <th>Categoría</th>
                <th>Stock</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr key={p.productId}>
                  <td>{p.name}</td>
                  <td>{p.category}</td>
                  <td>{p.stock}</td>
                  <td>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => restore(p.productId)}
                    >
                      Restaurar
                    </button>
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
