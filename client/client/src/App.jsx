import { BrowserRouter, Routes, Route } from "react-router-dom";
import Sidebar from "./components/Sidebar";

import Dashboard from "./Pages/Dashboard";
import Customers from "./Pages/Customers";
import Activities from "./Pages/Activities";
import FollowUps from "./Pages/FollowUps";
import Sales from "./Pages/Sales";
import Products from "./Pages/Products";
import Feedback from "./Pages/Feedback";
import Insights from "./Pages/Insights";

function App() {
  return (
    <BrowserRouter>
      <div className="app-layout">
        <Sidebar />

        <main className="main-content">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/customers" element={<Customers />} />
            <Route path="/activities" element={<Activities />} />
            <Route path="/follow-ups" element={<FollowUps />} />
            <Route path="/sales" element={<Sales />} />
            <Route path="/products" element={<Products />} />
            <Route path="/feedback" element={<Feedback />} />
            <Route path="/insights" element={<Insights />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}

export default App;