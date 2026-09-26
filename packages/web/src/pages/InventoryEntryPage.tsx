import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api, ApiClientError } from "../api/client";
import { formatMoney } from "../lib/format";
import type { Product } from "@motory/shared";

export function InventoryEntryPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [product, setProduct] = useState<Product | null>(null);
  const [quantity, setQuantity] = useState("1");
  const [unitCost, setUnitCost] = useState("");
  const [supplier, setSupplier] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!id) return;
    api
      .getProduct(id)
      .then((res) => {
        setProduct(res.product);
        if (res.product.lastPurchaseCost != null) {
          setUnitCost(String(res.product.lastPurchaseCost));
        }
      })
      .catch((err) =>
        setError(
          err instanceof ApiClientError
            ? err.message
            : "No se pudo cargar el producto",
        ),
      );
  }, [id]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!id) return;
    setSaving(true);
    setError(null);
    try {
      const createdAt = new Date(`${date}T12:00:00-05:00`).toISOString();
      await api.createEntry({
        productId: id,
        quantity: Number(quantity),
        unitCost: Number(unitCost),
        supplier: supplier || undefined,
        createdAt,
      });
      navigate(`/inventory/${id}`);
    } catch (err) {
      setError(
        err instanceof ApiClientError
          ? err.message
          : "No se pudo registrar el ingreso",
      );
    } finally {
      setSaving(false);
    }
  }

  if (!product && !error) return <div className="loading">Cargando…</div>;

  return (
    <div>
      <div className="page-header">
        <h1>Ingresar inventario</h1>
        <p>
          {product
            ? `${product.name} · Stock actual: ${product.stock}`
            : "Carga de stock"}
        </p>
      </div>

      {error ? <div className="alert alert-error">{error}</div> : null}

      <form
        className="card form-grid"
        style={{ padding: "1.25rem", maxWidth: 520 }}
        onSubmit={onSubmit}
      >
        <div className="field">
          <label>Cantidad</label>
          <input
            className="input"
            type="number"
            min={1}
            required
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
          />
        </div>
        <div className="field">
          <label>Costo unitario (COP)</label>
          <input
            className="input"
            type="number"
            min={0}
            required
            value={unitCost}
            onChange={(e) => setUnitCost(e.target.value)}
          />
          {unitCost && quantity ? (
            <div className="hint">
              Total: {formatMoney(Number(unitCost) * Number(quantity))}
            </div>
          ) : null}
        </div>
        <div className="field">
          <label>Proveedor (opcional)</label>
          <input
            className="input"
            value={supplier}
            onChange={(e) => setSupplier(e.target.value)}
          />
        </div>
        <div className="field">
          <label>Fecha</label>
          <input
            className="input"
            type="date"
            required
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>
        <div className="actions">
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? "Confirmando…" : "Confirmar ingreso"}
          </button>
          <Link to={`/inventory/${id}`} className="btn btn-ghost">
            Cancelar
          </Link>
        </div>
      </form>
    </div>
  );
}
