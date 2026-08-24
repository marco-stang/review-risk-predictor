import { NavLink, Route, Routes } from "react-router-dom";
import { PortfolioFooter, PortfolioHeader } from "./components/PortfolioChrome";
import FeatureImportance from "./pages/FeatureImportance";
import OrderDetail from "./pages/OrderDetail";
import OrderList from "./pages/OrderList";

export default function App() {
  return (
    <div>
      <PortfolioHeader />
      <nav>
        <NavLink to="/" end className={({ isActive }) => (isActive ? "active" : undefined)}>
          Bestellungen
        </NavLink>
        <NavLink to="/insights" className={({ isActive }) => (isActive ? "active" : undefined)}>
          Feature-Wichtigkeit
        </NavLink>
      </nav>
      <Routes>
        <Route path="/" element={<OrderList />} />
        <Route path="/orders/:orderId" element={<OrderDetail />} />
        <Route path="/insights" element={<FeatureImportance />} />
      </Routes>
      <PortfolioFooter />
    </div>
  );
}
