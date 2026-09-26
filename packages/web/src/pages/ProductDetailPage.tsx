import {
  PRODUCT_CATEGORIES,
  type BikeCompatibility,
  type Product,
  type ProductCategory,
} from "@motory/shared";
import { ArrowDownToLine, Bike, Plus, Trash2 } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api, ApiClientError } from "../api/client";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { StatusBadge } from "../components/StatusBadge";
import { formatMoney } from "../lib/format";

export function ProductDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [product, setProduct] = useState<Product | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const [name, setName] = useState("");
  const [sku, setSku] = useState("");
  const [category, setCategory] = useState<ProductCategory>("Otros");
  const [description, setDescription] = useState("");
  const [salePrice, setSalePrice] = useState("");
  const [minimumStock, setMinimumStock] = useState("0");
  const [compatibilities, setCompatibilities] = useState<BikeCompatibility[]>([]);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await api.getProduct(id);
        if (cancelled) return;
        const p = res.product;
        setProduct(p);
        setName(p.name);
        setSku(p.sku ?? "");
        setCategory(p.category);
        setDescription(p.description ?? "");
        setSalePrice(String(p.salePrice));
        setMinimumStock(String(p.minimumStock));
        setCompatibilities(p.compatibilities);
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof ApiClientError
              ? err.message
              : "No se pudo cargar el producto",
          );
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  async function onSave(e: FormEvent) {
    e.preventDefault();
    if (!id) return;
    setSaving(true);
    setError(null);
    try {
      const res = await api.updateProduct(id, {
        name,
        sku: sku || null,
        category,
        description: description || null,
        salePrice: Number(salePrice),
        minimumStock: Number(minimumStock),
        compatibilities: compatibilities.filter(
          (c) => c.brand.trim() && c.model.trim(),
        ),
      });
      setProduct(res.product);
    } catch (err) {
      setError(
        err instanceof ApiClientError
          ? err.message
          : "No se pudo guardar",
      );
    } finally {
      setSaving(false);
    }
  }

  async function onDelete() {
    if (!id) return;
    try {
      await api.deleteProduct(id);
      navigate("/inventory");
    } catch (err) {
      setError(
        err instanceof ApiClientError
          ? err.message
          : "No se pudo desactivar",
      );
      setConfirmDelete(false);
    }
  }

  if (error && !product) return <div className="alert alert-error">{error}</div>;
  if (!product) return <div className="loading">Cargando…</div>;

  return (
    <div>
      <div className="page-header">
        <h1>{product.name}</h1>
        <p>
          Stock: {product.stock} ·{" "}
          <StatusBadge stock={product.stock} minimumStock={product.minimumStock} />
          {product.lastPurchaseCost != null
            ? ` · Último costo: ${formatMoney(product.lastPurchaseCost)}`
            : ""}
        </p>
      </div>

      {error ? <div className="alert alert-error">{error}</div> : null}

      <div className="actions" style={{ marginBottom: "1rem" }}>
        <Link to={`/inventory/${product.productId}/entry`} className="btn btn-primary">
          <ArrowDownToLine size={16} /> Ingresar inventario
        </Link>
        <button
          type="button"
          className="btn btn-danger"
          onClick={() => setConfirmDelete(true)}
        >
          Eliminar producto
        </button>
        <Link to="/inventory" className="btn btn-ghost">
          Volver
        </Link>
      </div>

      <form className="card form-grid" style={{ padding: "1.25rem" }} onSubmit={onSave}>
        <div className="form-row">
          <div className="field">
            <label>Nombre</label>
            <input className="input" required value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="field">
            <label>SKU</label>
            <input className="input" value={sku} onChange={(e) => setSku(e.target.value)} />
          </div>
        </div>
        <div className="form-row">
          <div className="field">
            <label>Categoría</label>
            <select
              className="select"
              value={category}
              onChange={(e) => setCategory(e.target.value as ProductCategory)}
            >
              {PRODUCT_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Precio de venta</label>
            <input
              className="input"
              type="number"
              min={0}
              required
              value={salePrice}
              onChange={(e) => setSalePrice(e.target.value)}
            />
          </div>
        </div>
        <div className="form-row">
          <div className="field">
            <label>Stock mínimo</label>
            <input
              className="input"
              type="number"
              min={0}
              required
              value={minimumStock}
              onChange={(e) => setMinimumStock(e.target.value)}
            />
          </div>
          <div className="field">
            <label>Descripción</label>
            <input
              className="input"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
        </div>

        <div>
          <div className="section-title" style={{ marginTop: 0 }}>
            <Bike size={16} style={{ verticalAlign: "middle", marginRight: 6 }} />
            Compatibilidad
          </div>
          {compatibilities.map((c, idx) => (
            <div className="form-row" key={idx} style={{ marginBottom: 8 }}>
              <input
                className="input"
                placeholder="Marca"
                value={c.brand}
                onChange={(e) => {
                  const next = [...compatibilities];
                  next[idx] = { ...c, brand: e.target.value };
                  setCompatibilities(next);
                }}
              />
              <input
                className="input"
                placeholder="Modelo"
                value={c.model}
                onChange={(e) => {
                  const next = [...compatibilities];
                  next[idx] = { ...c, model: e.target.value };
                  setCompatibilities(next);
                }}
              />
              <input
                className="input"
                type="number"
                placeholder="Desde"
                value={c.yearFrom ?? ""}
                onChange={(e) => {
                  const next = [...compatibilities];
                  next[idx] = {
                    ...c,
                    yearFrom: e.target.value ? Number(e.target.value) : undefined,
                  };
                  setCompatibilities(next);
                }}
              />
              <input
                className="input"
                type="number"
                placeholder="Hasta"
                value={c.yearTo ?? ""}
                onChange={(e) => {
                  const next = [...compatibilities];
                  next[idx] = {
                    ...c,
                    yearTo: e.target.value ? Number(e.target.value) : undefined,
                  };
                  setCompatibilities(next);
                }}
              />
              <button
                type="button"
                className="btn btn-danger"
                onClick={() =>
                  setCompatibilities(compatibilities.filter((_, i) => i !== idx))
                }
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() =>
              setCompatibilities([...compatibilities, { brand: "", model: "" }])
            }
          >
            <Plus size={16} /> Agregar moto
          </button>
        </div>

        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? "Guardando…" : "Guardar cambios"}
        </button>
      </form>

      <ConfirmDialog
        open={confirmDelete}
        title="Desactivar producto"
        message="El producto se ocultará del inventario y no podrá venderse. Su historial se conserva y podrás restaurarlo después."
        confirmLabel="Desactivar"
        danger
        onCancel={() => setConfirmDelete(false)}
        onConfirm={onDelete}
      />
    </div>
  );
}
