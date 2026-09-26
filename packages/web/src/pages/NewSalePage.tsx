import {
  PAYMENT_METHODS,
  PAYMENT_METHOD_LABELS,
  type PaymentMethod,
  type Product,
} from "@motory/shared";
import { Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, ApiClientError } from "../api/client";
import { EmptyState } from "../components/EmptyState";
import { StatusBadge } from "../components/StatusBadge";
import { formatMoney } from "../lib/format";

interface CartLine {
  product: Product;
  quantity: number;
  salePrice: number;
}

export function NewSalePage() {
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [anonymous, setAnonymous] = useState(true);
  const [customerName, setCustomerName] = useState("");
  const [phone, setPhone] = useState("");
  const [plate, setPlate] = useState("");
  const [bikeBrand, setBikeBrand] = useState("");
  const [bikeModel, setBikeModel] = useState("");
  const [bikeYear, setBikeYear] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("CASH");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await api.listProducts({ q: q || undefined });
        if (!cancelled) setProducts(res.products.filter((p) => p.isActive));
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof ApiClientError
              ? err.message
              : "No se pudo buscar",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [q]);

  const total = useMemo(
    () => cart.reduce((sum, line) => sum + line.salePrice * line.quantity, 0),
    [cart],
  );

  function addToCart(product: Product) {
    setError(null);
    setCart((prev) => {
      const existing = prev.find((l) => l.product.productId === product.productId);
      if (existing) {
        if (existing.quantity + 1 > product.stock) {
          setError(
            `Stock insuficiente. Hay ${product.stock} unidades disponibles de ${product.name}.`,
          );
          return prev;
        }
        return prev.map((l) =>
          l.product.productId === product.productId
            ? { ...l, quantity: l.quantity + 1 }
            : l,
        );
      }
      if (product.stock < 1) {
        setError(`Sin stock disponible de ${product.name}.`);
        return prev;
      }
      return [
        ...prev,
        { product, quantity: 1, salePrice: product.salePrice },
      ];
    });
  }

  function updateQty(productId: string, quantity: number) {
    setCart((prev) =>
      prev.map((l) => {
        if (l.product.productId !== productId) return l;
        if (quantity > l.product.stock) {
          setError(
            `Stock insuficiente. Hay ${l.product.stock} unidades disponibles de ${l.product.name}.`,
          );
          return l;
        }
        return { ...l, quantity: Math.max(1, quantity) };
      }),
    );
  }

  async function finalize() {
    if (cart.length === 0) {
      setError("Agrega al menos un producto a la venta");
      return;
    }
    if (!anonymous && !customerName.trim()) {
      setError("Indica el nombre del cliente o marca la venta como anónima");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const res = await api.createSale({
        paymentMethod,
        customer: anonymous
          ? undefined
          : {
              name: customerName.trim(),
              phone: phone || undefined,
              plate: plate || undefined,
              bikeBrand: bikeBrand || undefined,
              bikeModel: bikeModel || undefined,
              bikeYear: bikeYear ? Number(bikeYear) : undefined,
            },
        items: cart.map((l) => ({
          productId: l.product.productId,
          quantity: l.quantity,
          salePrice: l.salePrice,
        })),
      });
      setCart([]);
      navigate(`/sales/${res.sale.saleId}`);
    } catch (err) {
      setError(
        err instanceof ApiClientError
          ? err.message
          : "No se pudo registrar la venta",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="page-header">
        <h1>Nueva venta</h1>
        <p>POS sencillo para el mostrador del taller.</p>
      </div>

      {error ? <div className="alert alert-error">{error}</div> : null}

      <div className="pos-layout">
        <div>
          <input
            className="search-input"
            style={{ width: "100%", marginBottom: "0.75rem" }}
            placeholder="Buscar producto o moto…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            autoFocus
          />

          {loading ? <div className="loading">Buscando…</div> : null}

          {!loading && products.length === 0 ? (
            <EmptyState
              title="Sin resultados"
              description="Prueba con otro nombre, SKU o modelo de moto."
            />
          ) : (
            <div className="card table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>Producto</th>
                    <th>Precio</th>
                    <th>Stock</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {products.slice(0, 30).map((p) => (
                    <tr key={p.productId}>
                      <td>
                        <strong>{p.name}</strong>
                        <div className="meta" style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>
                          {p.category}
                          {p.sku ? ` · ${p.sku}` : ""}
                        </div>
                      </td>
                      <td>{formatMoney(p.salePrice)}</td>
                      <td>
                        <StatusBadge
                          stock={p.stock}
                          minimumStock={p.minimumStock}
                        />
                      </td>
                      <td>
                        <button
                          type="button"
                          className="btn btn-secondary"
                          disabled={p.stock <= 0}
                          onClick={() => addToCart(p)}
                        >
                          <Plus size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="card cart-panel">
          <h2 style={{ fontSize: "1.1rem", marginBottom: "0.75rem" }}>Carrito</h2>

          <label style={{ display: "flex", gap: 8, alignItems: "center", fontWeight: 600, marginBottom: 12 }}>
            <input
              type="checkbox"
              checked={anonymous}
              onChange={(e) => setAnonymous(e.target.checked)}
            />
            Venta anónima
          </label>

          {!anonymous ? (
            <div className="form-grid" style={{ marginBottom: 12 }}>
              <input
                className="input"
                placeholder="Nombre del cliente"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
              />
              <div className="form-row">
                <input
                  className="input"
                  placeholder="Teléfono"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
                <input
                  className="input"
                  placeholder="Placa"
                  value={plate}
                  onChange={(e) => setPlate(e.target.value)}
                />
              </div>
              <div className="form-row">
                <input
                  className="input"
                  placeholder="Marca moto"
                  value={bikeBrand}
                  onChange={(e) => setBikeBrand(e.target.value)}
                />
                <input
                  className="input"
                  placeholder="Modelo"
                  value={bikeModel}
                  onChange={(e) => setBikeModel(e.target.value)}
                />
              </div>
              <input
                className="input"
                type="number"
                placeholder="Año"
                value={bikeYear}
                onChange={(e) => setBikeYear(e.target.value)}
              />
            </div>
          ) : null}

          {cart.length === 0 ? (
            <p style={{ color: "var(--text-muted)" }}>
              Agrega productos desde la búsqueda.
            </p>
          ) : (
            cart.map((line) => (
              <div className="cart-item" key={line.product.productId}>
                <div>
                  <strong>{line.product.name}</strong>
                  <div className="meta">
                    Base: {formatMoney(line.product.salePrice)}
                  </div>
                  <div className="form-row" style={{ marginTop: 6 }}>
                    <input
                      className="input"
                      type="number"
                      min={1}
                      max={line.product.stock}
                      value={line.quantity}
                      onChange={(e) =>
                        updateQty(line.product.productId, Number(e.target.value))
                      }
                    />
                    <input
                      className="input"
                      type="number"
                      min={0}
                      value={line.salePrice}
                      onChange={(e) =>
                        setCart((prev) =>
                          prev.map((l) =>
                            l.product.productId === line.product.productId
                              ? { ...l, salePrice: Number(e.target.value) }
                              : l,
                          ),
                        )
                      }
                    />
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontWeight: 700 }}>
                    {formatMoney(line.salePrice * line.quantity)}
                  </div>
                  <button
                    type="button"
                    className="btn btn-danger"
                    style={{ marginTop: 6, padding: "0.35rem 0.5rem" }}
                    onClick={() =>
                      setCart((prev) =>
                        prev.filter(
                          (l) => l.product.productId !== line.product.productId,
                        ),
                      )
                    }
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))
          )}

          <div className="field" style={{ marginTop: 12 }}>
            <label>Método de pago</label>
            <select
              className="select"
              value={paymentMethod}
              onChange={(e) =>
                setPaymentMethod(e.target.value as PaymentMethod)
              }
            >
              {PAYMENT_METHODS.map((m) => (
                <option key={m} value={m}>
                  {PAYMENT_METHOD_LABELS[m]}
                </option>
              ))}
            </select>
          </div>

          <div className="cart-total">
            <span>Total</span>
            <span>{formatMoney(total)}</span>
          </div>

          <button
            type="button"
            className="btn btn-primary btn-lg btn-block"
            disabled={saving || cart.length === 0}
            onClick={finalize}
          >
            {saving ? "Registrando…" : "Finalizar venta"}
          </button>
        </div>
      </div>
    </div>
  );
}
