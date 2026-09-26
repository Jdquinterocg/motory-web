import {
  ChartNoAxesColumn,
  Home,
  Package,
  ShoppingCart,
} from "lucide-react";
import { NavLink, Outlet } from "react-router-dom";

const links = [
  { to: "/", label: "Inicio", icon: Home, end: true },
  { to: "/inventory", label: "Inventario", icon: Package },
  { to: "/sales/new", label: "Nueva venta", icon: ShoppingCart },
  { to: "/movements", label: "Movimientos", icon: ChartNoAxesColumn },
  { to: "/reports", label: "Reportes", icon: ChartNoAxesColumn },
];

const logoUrl = import.meta.env.VITE_LOGO_URL || "/logo.jpg";

export function AppShell() {
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <img
            src={logoUrl}
            alt="Motory"
            className="sidebar-logo-img"
          />
        </div>
        <nav>
          {links.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `nav-link${isActive ? " active" : ""}`
              }
            >
              <Icon size={18} />
              {label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <main className="main">
        <Outlet />
      </main>
    </div>
  );
}