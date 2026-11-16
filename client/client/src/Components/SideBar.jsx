import {
  LayoutDashboard,
  Users,
  Phone,
  RefreshCw,
  ShoppingCart,
  Package,
  MessageSquare,
  Sparkles,
  UserCog,
  LogOut,
} from "lucide-react";

import { NavLink } from "react-router-dom";
import { useAuth, useCompanyPath } from "../auth/useAuth";

const menuItems = [
  { name: "Overview", path: "/", icon: LayoutDashboard, end: true },
  { name: "Customers", path: "/customers", icon: Users },
  { name: "Activities", path: "/activities", icon: Phone },
  { name: "Follow-ups", path: "/follow-ups", icon: RefreshCw },
  { name: "Sales", path: "/sales", icon: ShoppingCart },
  { name: "Products", path: "/products", icon: Package },
  { name: "Feedback", path: "/feedback", icon: MessageSquare },
  { name: "Insights", path: "/insights", icon: Sparkles },
];

function Sidebar() {
  const { user, company, signOut } = useAuth();
  const to = useCompanyPath();

  return (
    <aside className="sidebar">
      <div className="logo">
        <div className="logo-icon">O</div>
        <span>OpsSync</span>
      </div>

      <div className="company-chip" title={`${window.location.host}/${company.slug}`}>
        <span className="company-avatar">{company.name.charAt(0).toUpperCase()}</span>
        <div>
          <strong>{company.name}</strong>
          <span>/{company.slug}</span>
        </div>
      </div>

      <nav className="nav-menu">
        {menuItems.map((item) => {
          const Icon = item.icon;

          return (
            <NavLink
              key={item.name}
              to={to(item.path)}
              end={item.end}
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
        <NavLink
          to={to("/team")}
          className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}
        >
          <UserCog size={20} />
          <span>Team</span>
        </NavLink>

        <div className="user-chip">
          <div>
            <strong>{user.name}</strong>
            <span>{user.role}</span>
          </div>
          <button
            type="button"
            className="fu-icon-button"
            onClick={signOut}
            aria-label="Log out"
            title="Log out"
          >
            <LogOut size={18} />
          </button>
        </div>
      </div>
    </aside>
  );
}

export default Sidebar;
