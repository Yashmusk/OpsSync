import { useEffect, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { CheckCircle2, Clock } from "lucide-react";
import AuthShell, { AuthError } from "../../Components/AuthShell";
import { apiRequest } from "../../api";
import { useAuth } from "../../auth/useAuth";

const emailDomain = (email) => {
  const at = email.lastIndexOf("@");
  return at === -1 ? "" : email.slice(at + 1).trim().toLowerCase();
};

// Generic login (/login) or a company's own page (/:slug when logged out).
// On a company page, people with the company's work email can also create an account.
export default function Login({ slug }) {
  const { isLoggedIn, company, signIn } = useAuth();
  const navigate = useNavigate();

  const [mode, setMode] = useState("login"); // "login" | "signup"
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [pendingMessage, setPendingMessage] = useState("");
  const [companyInfo, setCompanyInfo] = useState(null);
  const [companyMissing, setCompanyMissing] = useState(false);

  // On a company link, show which company you're logging into
  useEffect(() => {
    if (!slug) return undefined;
    let active = true;
    apiRequest(`/auth/company/${encodeURIComponent(slug)}`)
      .then((data) => active && setCompanyInfo(data))
      .catch(() => active && setCompanyMissing(true));
    return () => {
      active = false;
    };
  }, [slug]);

  if (isLoggedIn) return <Navigate to={`/${company.slug}`} replace />;

  if (slug && companyMissing) {
    return (
      <AuthShell
        title="Company not found"
        subtitle={`There's no OpsSync workspace at /${slug}. Check the link with your team.`}
        footer={
          <>
            <Link to="/login">Log in</Link> · <Link to="/signup">Create a company</Link>
          </>
        }
      />
    );
  }

  if (pendingMessage) {
    return (
      <AuthShell title="Request sent" subtitle={pendingMessage}>
        <div className="auth-pending">
          <Clock size={18} />
          <span>You'll be able to log in here once an admin approves you.</span>
        </div>
        <button
          className="fu-button fu-button-secondary auth-submit"
          onClick={() => {
            setPendingMessage("");
            setMode("login");
          }}
        >
          Back to log in
        </button>
      </AuthShell>
    );
  }

  const canSelfSignup = Boolean(companyInfo?.selfSignup);
  const domains = companyInfo?.allowedDomains || [];
  const domainList = domains.map((d) => `@${d}`).join(" or ");
  const typedDomain = emailDomain(form.email);
  const domainOk = !typedDomain || !form.email.includes("@") || domains.includes(typedDomain);
  const isSignup = mode === "signup" && canSelfSignup;

  const update = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  };

  const switchMode = (next) => {
    setMode(next);
    setError("");
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");

    if (isSignup) {
      if (!domains.includes(typedDomain)) {
        setError(`Use your ${domainList} work email to join ${companyInfo.name}.`);
        return;
      }
      if (form.password.length < 8) {
        setError("Password must be at least 8 characters.");
        return;
      }
    }

    setSaving(true);

    try {
      if (isSignup) {
        const result = await apiRequest(`/auth/company/${encodeURIComponent(slug)}/signup`, {
          method: "POST",
          body: form,
        });
        if (result.pending) {
          setPendingMessage(result.message);
          return;
        }
        signIn(result);
        navigate(`/${result.company.slug}`, { replace: true });
      } else {
        const session = await apiRequest("/auth/login", {
          method: "POST",
          body: { email: form.email, password: form.password, ...(slug ? { slug } : {}) },
        });
        signIn(session);
        navigate(`/${session.company.slug}`, { replace: true });
      }
    } catch (err) {
      setError(err.message || (isSignup ? "Could not create your account." : "Could not log in."));
    } finally {
      setSaving(false);
    }
  };

  const title = companyInfo
    ? isSignup
      ? `Join ${companyInfo.name}`
      : `Log in to ${companyInfo.name}`
    : "Log in to OpsSync";

  const subtitle = companyInfo
    ? isSignup
      ? `Create your account with your ${domainList} work email.${
          companyInfo.requireApproval ? " An admin will approve it before you can log in." : ""
        }`
      : `${window.location.host}/${companyInfo.slug}`
    : "Welcome back.";

  return (
    <AuthShell
      title={title}
      subtitle={subtitle}
      footer={
        slug ? (
          <>
            Starting a new company? <Link to="/signup">Create a workspace</Link>
          </>
        ) : (
          <>
            New company? <Link to="/signup">Create a workspace</Link>
          </>
        )
      }
    >
      {canSelfSignup && (
        <div className="auth-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={!isSignup}
            className={!isSignup ? "active" : ""}
            onClick={() => switchMode("login")}
          >
            Log in
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={isSignup}
            className={isSignup ? "active" : ""}
            onClick={() => switchMode("signup")}
          >
            Create account
          </button>
        </div>
      )}

      <form className="fu-form auth-form" onSubmit={handleSubmit}>
        {isSignup && (
          <label>
            Your name
            <input
              name="name"
              value={form.name}
              onChange={update}
              required
              maxLength={100}
              autoComplete="name"
            />
          </label>
        )}

        <label>
          {isSignup ? "Work email" : "Email"}
          <input
            type="email"
            name="email"
            value={form.email}
            onChange={update}
            required
            autoComplete="email"
            autoFocus
            placeholder={isSignup && domains[0] ? `you@${domains[0]}` : undefined}
          />
          {isSignup && form.email.includes("@") && typedDomain && (
            <span className={`slug-status ${domainOk ? "ok" : "bad"}`}>
              {domainOk ? (
                <>
                  <CheckCircle2 size={14} /> {companyInfo.name} email
                </>
              ) : (
                `Only ${domainList} emails can join ${companyInfo.name}`
              )}
            </span>
          )}
        </label>

        <label>
          Password
          <input
            type="password"
            name="password"
            value={form.password}
            onChange={update}
            required
            minLength={isSignup ? 8 : undefined}
            autoComplete={isSignup ? "new-password" : "current-password"}
            placeholder={isSignup ? "At least 8 characters" : undefined}
          />
        </label>

        <AuthError message={error} />

        <button
          type="submit"
          className="fu-button fu-button-primary auth-submit"
          disabled={saving || (isSignup && !domainOk)}
        >
          {saving
            ? isSignup
              ? "Creating account..."
              : "Logging in..."
            : isSignup
              ? `Join ${companyInfo.name}`
              : "Log in"}
        </button>

        {!isSignup && (
          <p className="auth-hint">
            {canSelfSignup
              ? `New here? Use "Create account" with your ${domainList} email.`
              : "Joining a team? Use the invite link your admin sent you."}
          </p>
        )}
      </form>
    </AuthShell>
  );
}
