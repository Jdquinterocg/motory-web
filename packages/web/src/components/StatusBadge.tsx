import { TriangleAlert } from "lucide-react";

export function StatusBadge({
  stock,
  minimumStock,
}: {
  stock: number;
  minimumStock: number;
}) {
  if (stock <= 0) {
    return <span className="badge badge-danger">Sin stock</span>;
  }
  if (stock <= minimumStock) {
    return (
      <span className="badge badge-warning">
        <TriangleAlert size={12} /> Stock bajo
      </span>
    );
  }
  return <span className="badge badge-success">OK</span>;
}
