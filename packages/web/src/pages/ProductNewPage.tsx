import {
  PRODUCT_CATEGORIES,
  type BikeCompatibility,
  type ProductCategory,
} from "@motory/shared";
import { Bike, Plus, Trash2 } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, ApiClientError } from "../api/client";

const emptyCompat = (): BikeCompatibility => ({
  brand: "",
  model: "",
});

export function ProductNewPage() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [sku, setSku] = useState("");
  const [category, setCategory] = useState<ProductCategory>("Otros");
  const [description, setDescription] = useState("");
  const [salePrice, setSalePrice] = useState("");
  const [minimumStock, setMinimumStock] = useState("0");
  const [compatibilities, setCompatibilities] = useState<BikeCompatibility[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const product = await api.createProduct({
        name,
        sku: sku || undefined,
        category,
        description: description || undefined,
        salePrice: Number(salePrice),
        minimumStock: Number(minimumStock),
        compatibilities: compatibilities.filter(
          (c) => c.brand.trim() && c.model.trim(),
        ),
      });
      navigate(`/inventory/${product.product.productId}`);
    } catch (err) {
      setError(
        err instanceof ApiClientError
          ? err.message
          : "No se pudo crear el producto",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="page-header">
        <h1>Nuevo producto</h1>
        <p>Registra un repuesto en el inventario.</p>
      </div>

      {error ? <div className="alert alert-error">{error}</div> : null}

      <form className="card form-grid" style={{ padding: "1.25rem" }} onSubmit={onSubmit}>
        <div className="form-row">
          <div className="field">
            <label>Nombre</label>
            <input className="input" required value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="field">
            <label>SKU / referencia (opcional)</label>
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
            <label>Precio de venta (COP)</label>
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
            <label>Descripción (opcional)</label>
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
            Compatibilidad con motos
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
                placeholder="Año desde"
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
                placeholder="Año hasta"
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
            onClick={() => setCompatibilities([...compatibilities, emptyCompat()])}
          >
            <Plus size={16} /> Agregar moto
          </button>
        </div>

        <div className="actions">
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? "Guardando…" : "Crear producto"}
          </button>
          <Link to="/inventory" className="btn btn-ghost">
            Cancelar
          </Link>
        </div>
      </form>
    </div>
  );
}
