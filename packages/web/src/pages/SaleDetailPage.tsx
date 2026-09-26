import { PAYMENT_METHOD_LABELS, type Sale } from "@motory/shared";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, ApiClientError } from "../api/client";
import { formatDate, formatMoney } from "../lib/format";

export function SaleDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [sale, setSale] = useState<Sale | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    api
      .getSale(id)
      .then((res) => setSale(res.sale))
      .catch((err) =>
        setError(
          err instanceof ApiClientError
            ? err.message
            : "No se pudo cargar la venta",
        ),
      );
  }, [id]);

  if (error) return <div className="alert alert-error">{error}</div>;
  if (!sale) return <div className="loading">Cargando…</div>;

  return (
    <div>
      <div className="alert alert-success">
        Venta registrada. Se descontaron {sale.items.reduce((s, i) => s + i.quantity, 0)}{" "}
        productos del inventario.
      </div>

      <div className="page-header">
        <h1>Venta {sale.saleId.slice(0, 8)}…</h1>
        <p>
          {formatDate(sale.createdAt)} ·{" "}
          {PAYMENT_METHOD_LABELS[sale.paymentMethod]}
          {sale.customer ? ` · ${sale.customer.name}` : " · Anónima"}
        </p>
      </div>

      <div className="card table-wrap">
        <table className="data">
          <thead>
            <tr>
              <th>Producto</th>
              <th>Cant.</th>
              <th>Precio base</th>
              <th>Precio venta</th>
              <th>Subtotal</th>
            </tr>
          </thead>
          <tbody>
            {sale.items.map((item, idx) => (
              <tr key={idx}>
                <td>{item.name}</td>
                <td>{item.quantity}</td>
                <td>{formatMoney(item.basePrice)}</td>
                <td>{formatMoney(item.salePrice)}</td>
                <td>{formatMoney(item.subtotal)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="cart-total" style={{ maxWidth: 320, marginTop: "1rem" }}>
        <span>Total</span>
        <span>{formatMoney(sale.total)}</span>
      </div>

      <div className="actions" style={{ marginTop: "1rem" }}>
        <Link to="/sales/new" className="btn btn-primary">
          Nueva venta
        </Link>
        <Link to="/" className="btn btn-ghost">
          Inicio
        </Link>
      </div>
    </div>
  );
}
