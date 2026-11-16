import { useEffect, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { CheckCircle2, XCircle } from "lucide-react";
import AuthShell, { AuthError } from "../../Components/AuthShell";
import { apiRequest } from "../../api";
import { useAuth } from "../../auth/useAuth";

const slugify = (text) =>
  text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/g, "");

export default function Signup() {
  const { isLoggedIn, company, signIn } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({ companyName: "", slug: "", name: "", email: "", password: "" });
  const [slugEdited, setSlugEdited] = useState(false);
  const [slugStatus, setSlugStatus] = useState(null); // { available, reason }
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const slug = slugEdited ? form.slug : slugify(form.companyName);

  // Check the company link is free (debounced)
  useEffect(() => {
    if (!slug) return undefined;
    let active = true;
    const timer = setTimeout(() => {
      apiRequest(`/auth/check-slug?slug=${encodeURIComponent(slug)}`)
        .then((result) => active && setSlugStatus({ slug, ...result }))
        .catch(() => active && setSlugStatus(null));
    }, 350);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [slug]);

  if (isLoggedIn) return <Navigate to={`/${company.slug}`} replace />;

  const update = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  };

  const currentStatus = slugStatus?.slug === slug ? slugStatus : null;

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");

    if (form.password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    setSaving(true);
    try {
      const session = await apiRequest("/auth/register-company", {
        method: "POST",
        body: { ...form, slug },
      });
      signIn(session);
      navigate(`/${session.company.slug}`, { replace: true });
    } catch (err) {
      setError(err.message || "Could not create your company.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <AuthShell
      title="Create your company workspace"
      subtitle="Your team's CRM, private to your company. Takes a minute."
      footer={
        <>
          Already have an account? <Link to="/login">Log in</Link>
        </>
      }
    >
      <form className="fu-form auth-form" onSubmit={handleSubmit}>
        <label>
          Company name
          <input
            name="companyName"
            value={form.companyName}
            onChange={update}
            placeholder="e.g. FitFuel Nutrition"
            required
            maxLength={100}
            autoFocus
          />
        </label>

        <label>
          Company link
          <div className="slug-input">
            <span>{window.location.host}/</span>
            <input
              name="slug"
              value={slug}
              onChange={(event) => {
                setSlugEdited(true);
                setForm((current) => ({ ...current, slug: event.target.value.toLowerCase() }));
              }}
              placeholder="your-company"
              required
              maxLength={40}
            />
          </div>
          {slug && currentStatus && (
            <span className={`slug-status ${currentStatus.available ? "ok" : "bad"}`}>
              {currentStatus.available ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
              {currentStatus.available ? "Available" : currentStatus.reason}
            </span>
          )}
        </label>

        <label>
          Your name
          <input name="name" value={form.name} onChange={update} required maxLength={100} autoComplete="name" />
        </label>

        <label>
          Work email
          <input type="email" name="email" value={form.email} onChange={update} required autoComplete="email" />
        </label>

        <label>
          Password
          <input
            type="password"
            name="password"
            value={form.password}
            onChange={update}
            required
            minLength={8}
            autoComplete="new-password"
            placeholder="At least 8 characters"
          />
        </label>

        <AuthError message={error} />

        <button
          type="submit"
          className="fu-button fu-button-primary auth-submit"
          disabled={saving || (currentStatus && !currentStatus.available)}
        >
          {saving ? "Creating workspace..." : "Create workspace"}
        </button>
        <p className="auth-hint">You'll be the Owner. Invite your team once you're in.</p>
      </form>
    </AuthShell>
  );
}
