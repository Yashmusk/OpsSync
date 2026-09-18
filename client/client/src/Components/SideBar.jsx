import {
  LayoutDashboard,
  Users,
  Phone,
  RefreshCw,
  ShoppingCart,
  Package,
  MessageSquare,
  Sparkles,
  Settings,
} from "lucide-react";

import { NavLink } from "react-router-dom";

const menuItems = [
  { name: "Overview", path: "/", icon: LayoutDashboard },
  { name: "Customers", path: "/customers", icon: Users },
  { name: "Activities", path: "/activities", icon: Phone },
  { name: "Follow-ups", path: "/follow-ups", icon: RefreshCw },
  { name: "Sales", path: "/sales", icon: ShoppingCart },
  { name: "Products", path: "/products", icon: Package },
  { name: "Feedback", path: "/feedback", icon: MessageSquare },
  { name: "Insights", path: "/insights", icon: Sparkles },
];

function Sidebar() {
  return (
    <aside className="sidebar">
      <div className="logo">
        <div className="logo-icon">O</div>
        <span>OpsSync</span>
      </div>

      <nav className="nav-menu">
        {menuItems.map((item) => {
          const Icon = item.icon;

          return (
            <NavLink
              key={item.name}
              to={item.path}
              className={({ isActive }) =>
                `nav-item ${isActive ? "active" : ""}`
              }
            >
              <Icon size={20} />
              <span>{item.name}</span>
            </NavLink>
          );
        })}
      </nav>

      <div className="sidebar-bottom">
        <button className="nav-item">
          <Settings size={20} />
          <span>Settings</span>
        </button>
      </div>
    </aside>
  );
}

export default Sidebar;