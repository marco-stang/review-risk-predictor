import { Link, Route, Routes } from "react-router-dom";
import FeatureImportance from "./pages/FeatureImportance";
import OrderDetail from "./pages/OrderDetail";
import OrderList from "./pages/OrderList";

export default function App() {
  return (
    <div>
      <nav>
        <Link to="/">Bestellungen</Link> | <Link to="/insights">Feature-Wichtigkeit</Link>
      </nav>
      <Routes>
        <Route path="/" element={<OrderList />} />
        <Route path="/orders/:orderId" element={<OrderDetail />} />
        <Route path="/insights" element={<FeatureImportance />} />
      </Routes>
    </div>
  );
}
