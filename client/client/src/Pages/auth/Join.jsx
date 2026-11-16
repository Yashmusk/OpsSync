import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import AuthShell, { AuthError } from "../../Components/AuthShell";
import { apiRequest } from "../../api";
import { useAuth } from "../../auth/useAuth";

// Invite link: /join/:token — create an account inside the inviting company
export default function Join() {
  const { token } = useParams();
  const { isLoggedIn, company, signIn, signOut } = useAuth();
  const navigate = useNavigate();

  const [invite, setInvite] = useState(null);
  const [inviteError, setInviteError] = useState("");
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    apiRequest(`/auth/invites/${encodeURIComponent(token)}`)
      .then((data) => active && setInvite(data))
      .catch((err) => active && setInviteError(err.message || "This invite link is invalid."));
    return () => {
      active = false;
    };
  }, [token]);

  if (inviteError) {
    return (
      <AuthShell
        title="Invite link not valid"
        subtitle={inviteError}
        footer={<Link to="/login">Go to login</Link>}
      />
    );
  }

  if (!invite) {
    return <AuthShell title="Checking your invite..." />;
  }

  if (isLoggedIn) {
    return (
      <AuthShell
        title={`You're invited to ${invite.company.name}`}
        subtitle={`You're currently logged in to ${company.name}. Log out to create a new account for ${invite.company.name}.`}
      >
        <div className="auth-actions">
          <button className="fu-button fu-button-secondary" onClick={() => navigate(`/${company.slug}`)}>
            Back to {company.name}
          </button>
          <button className="fu-button fu-button-primary" onClick={signOut}>
            Log out and join
          </button>
        </div>
      </AuthShell>
    );
  }

  const update = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");

    if (form.password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    setSaving(true);
    try {
      const session = await apiRequest(`/auth/invites/${encodeURIComponent(token)}/accept`, {
        method: "POST",
        body: form,
      });
      signIn(session);
      navigate(`/${session.company.slug}`, { replace: true });
    } catch (err) {
      setError(err.message || "Could not join the company.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <AuthShell
      title={`Join ${invite.company.name}`}
      subtitle={`You've been invited as ${invite.role === "Admin" ? "an Admin" : "a Member"}. Create your account to get started.`}
      footer={
        <>
          Already have an account? <Link to={`/${invite.company.slug}`}>Log in</Link>
        </>
      }
    >
      <form className="fu-form auth-form" onSubmit={handleSubmit}>
        <label>
          Your name
          <input name="name" value={form.name} onChange={update} required maxLength={100} autoComplete="name" autoFocus />
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

        <button type="submit" className="fu-button fu-button-primary auth-submit" disabled={saving}>
          {saving ? "Joining..." : `Join ${invite.company.name}`}
        </button>
      </form>
    </AuthShell>
  );
}
