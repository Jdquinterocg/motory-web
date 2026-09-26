import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "./components/AppShell";
import { DashboardPage } from "./pages/DashboardPage";
import { InactiveProductsPage } from "./pages/InactiveProductsPage";
import { InventoryEntryPage } from "./pages/InventoryEntryPage";
import { InventoryPage } from "./pages/InventoryPage";
import { MovementsPage } from "./pages/MovementsPage";
import { NewSalePage } from "./pages/NewSalePage";
import { ProductDetailPage } from "./pages/ProductDetailPage";
import { ProductNewPage } from "./pages/ProductNewPage";
import { ReportsPage } from "./pages/ReportsPage";
import { SaleDetailPage } from "./pages/SaleDetailPage";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<DashboardPage />} />
          <Route path="inventory" element={<InventoryPage />} />
          <Route path="inventory/new" element={<ProductNewPage />} />
          <Route path="inventory/inactive" element={<InactiveProductsPage />} />
          <Route path="inventory/:id" element={<ProductDetailPage />} />
          <Route path="inventory/:id/entry" element={<InventoryEntryPage />} />
          <Route path="sales/new" element={<NewSalePage />} />
          <Route path="sales/:id" element={<SaleDetailPage />} />
          <Route path="movements" element={<MovementsPage />} />
          <Route path="reports" element={<ReportsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
