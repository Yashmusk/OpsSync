import { AlertCircle } from "lucide-react";

// Centered card layout shared by sign-up, login, and invite pages
export default function AuthShell({ title, subtitle, children, footer }) {
  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-brand">
          <div className="logo-icon">O</div>
          <span>OpsSync</span>
        </div>
        <h1>{title}</h1>
        {subtitle && <p className="auth-subtitle">{subtitle}</p>}
        {children}
      </div>
      {footer && <div className="auth-footer">{footer}</div>}
    </div>
  );
}

export function AuthError({ message }) {
  if (!message) return null;
  return (
    <div className="fu-message fu-error" role="alert">
      <AlertCircle size={16} />
      <span>{message}</span>
    </div>
  );
}
