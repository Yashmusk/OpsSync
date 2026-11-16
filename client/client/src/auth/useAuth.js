import { useContext } from "react";
import { useParams } from "react-router-dom";
import { AuthContext } from "./authContextObject";

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside <AuthProvider>");
  return context;
}

// Builds links inside the current company's workspace: to("/sales") -> "/fitfuel/sales"
export function useCompanyPath() {
  const { slug } = useParams();
  const { company } = useAuth();
  const base = `/${company?.slug || slug || ""}`;
  return (path = "") => (path && path !== "/" ? `${base}${path.startsWith("/") ? path : `/${path}`}` : base);
}

// Role helpers used to show/hide actions (the server enforces the same rules)
export function usePermissions() {
  const { user } = useAuth();
  const role = user?.role;
  return {
    role,
    canManageProducts: role === "Owner" || role === "Admin",
    canInvite: role === "Owner" || role === "Admin",
    canInviteAdmins: role === "Owner",
    canChangeRoles: role === "Owner",
    canRemove: (member) =>
      member.id !== user?.id &&
      (role === "Owner" || (role === "Admin" && member.role === "Member")),
  };
}
