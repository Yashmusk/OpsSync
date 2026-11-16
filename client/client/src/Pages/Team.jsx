import { useEffect, useState } from "react";
import {
  AlertCircle,
  Check,
  Copy,
  Globe,
  Link2,
  Trash2,
  UserCheck,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { apiRequest, formatDate } from "../api";
import { useAuth, usePermissions } from "../auth/useAuth";

const ROLE_BADGE = {
  Owner: "fu-priority-high",
  Admin: "fu-status-pending",
  Member: "fu-status-cancelled",
};

const ROLE_HELP = {
  Owner: "Everything, including roles and removing anyone",
  Admin: "All data, products & pricing, invite Members",
  Member: "Customers, activities, follow-ups, sales, feedback",
};

export default function Team() {
  const { user, company } = useAuth();
  const perms = usePermissions();

  const [members, setMembers] = useState([]);
  const [invites, setInvites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  const [inviteRole, setInviteRole] = useState("Member");
  const [creating, setCreating] = useState(false);
  const [newLink, setNewLink] = useState(null); // { url, role }
  const [copied, setCopied] = useState(false);
  const [busyId, setBusyId] = useState(null);

  // Who can join: allowed email domains + approval switch
  const [settings, setSettings] = useState(null);
  const [domainsInput, setDomainsInput] = useState("");
  const [requireApproval, setRequireApproval] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsSaved, setSettingsSaved] = useState(false);
  const [companyLinkCopied, setCompanyLinkCopied] = useState(false);

  const companyLink = `${window.location.origin}/${company.slug}`;

  useEffect(() => {
    let active = true;

    Promise.all([
      apiRequest("/team/members"),
      perms.canInvite ? apiRequest("/team/invites") : Promise.resolve([]),
      perms.canInvite ? apiRequest("/team/settings") : Promise.resolve(null),
    ])
      .then(([memberData, inviteData, settingsData]) => {
        if (!active) return;
        setMembers(memberData);
        setInvites(inviteData);
        if (settingsData) {
          setSettings(settingsData);
          setDomainsInput(settingsData.allowedDomains.join(", "));
          setRequireApproval(settingsData.requireApproval);
        }
        setError("");
      })
      .catch((err) => {
        if (active) setError(err.message || "Could not load your team.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [reloadKey, perms.canInvite]);

  const reload = () => setReloadKey((key) => key + 1);

  const createInvite = async () => {
    setCreating(true);
    setError("");
    setCopied(false);
    try {
      const invite = await apiRequest("/team/invites", { method: "POST", body: { role: inviteRole } });
      setNewLink({ url: `${window.location.origin}/join/${invite.token}`, role: invite.role });
      reload();
    } catch (err) {
      setError(err.message || "Could not create an invite link.");
    } finally {
      setCreating(false);
    }
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(newLink.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Couldn't copy automatically — select the link and copy it.");
    }
  };

  const changeRole = async (member, role) => {
    setBusyId(member.id);
    setError("");
    try {
      const updated = await apiRequest(`/team/members/${member.id}`, { method: "PATCH", body: { role } });
      setMembers((current) => current.map((m) => (m.id === updated.id ? updated : m)));
    } catch (err) {
      setError(err.message || "Could not change the role.");
    } finally {
      setBusyId(null);
    }
  };

  const removeMember = async (member) => {
    if (!window.confirm(`Remove ${member.name} from ${company.name}? They will lose access immediately.`)) return;
    setBusyId(member.id);
    setError("");
    try {
      await apiRequest(`/team/members/${member.id}`, { method: "DELETE" });
      setMembers((current) => current.filter((m) => m.id !== member.id));
    } catch (err) {
      setError(err.message || "Could not remove this member.");
    } finally {
      setBusyId(null);
    }
  };

  const saveSettings = async (event) => {
    event.preventDefault();
    setSavingSettings(true);
    setSettingsSaved(false);
    setError("");
    try {
      const saved = await apiRequest("/team/settings", {
        method: "PATCH",
        body: {
          allowedDomains: domainsInput.split(/[\s,]+/).filter(Boolean),
          requireApproval,
        },
      });
      setSettings(saved);
      setDomainsInput(saved.allowedDomains.join(", "));
      setRequireApproval(saved.requireApproval);
      setSettingsSaved(true);
      setTimeout(() => setSettingsSaved(false), 2500);
    } catch (err) {
      setError(err.message || "Could not save the settings.");
    } finally {
      setSavingSettings(false);
    }
  };

  const copyCompanyLink = async () => {
    try {
      await navigator.clipboard.writeText(companyLink);
      setCompanyLinkCopied(true);
      setTimeout(() => setCompanyLinkCopied(false), 2000);
    } catch {
      setError("Couldn't copy automatically — select the link and copy it.");
    }
  };

  const approveMember = async (member) => {
    setBusyId(member.id);
    setError("");
    try {
      const updated = await apiRequest(`/team/members/${member.id}/approve`, { method: "POST" });
      setMembers((current) => current.map((m) => (m.id === updated.id ? updated : m)));
    } catch (err) {
      setError(err.message || "Could not approve this person.");
    } finally {
      setBusyId(null);
    }
  };

  const rejectMember = async (member) => {
    if (!window.confirm(`Decline ${member.name}'s request to join ${company.name}?`)) return;
    setBusyId(member.id);
    setError("");
    try {
      await apiRequest(`/team/members/${member.id}`, { method: "DELETE" });
      setMembers((current) => current.filter((m) => m.id !== member.id));
    } catch (err) {
      setError(err.message || "Could not decline this request.");
    } finally {
      setBusyId(null);
    }
  };

  const pendingMembers = members.filter((m) => m.status === "Pending");
  const activeMembers = members.filter((m) => m.status !== "Pending");

  const revokeInvite = async (invite) => {
    setBusyId(invite.id);
    setError("");
    try {
      await apiRequest(`/team/invites/${invite.id}`, { method: "DELETE" });
      setInvites((current) => current.filter((i) => i.id !== invite.id));
      setNewLink(null);
    } catch (err) {
      setError(err.message || "Could not revoke the invite.");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="module-page">
      <div className="module-header">
        <div>
          <h1>Team</h1>
          <p>Everyone with access to {company.name}'s workspace.</p>
        </div>
      </div>

      {error && (
        <div className="fu-message fu-error">
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      {perms.canInvite && pendingMembers.length > 0 && (
        <section className="dashboard-card team-pending">
          <div className="card-header">
            <h3 className="ai-title">
              <UserCheck size={18} />
              Waiting for approval ({pendingMembers.length})
            </h3>
            <p>These people signed up with your company email. Approve the ones you recognise.</p>
          </div>
          {pendingMembers.map((member) => (
            <div className="invite-item" key={member.id}>
              <div className="pending-person">
                <strong>{member.name}</strong>
                <span>{member.email} · requested {formatDate(member.joinedAt)}</span>
              </div>
              <div className="pending-actions">
                <button
                  className="fu-button fu-button-primary invite-revoke"
                  onClick={() => approveMember(member)}
                  disabled={busyId === member.id}
                >
                  <Check size={14} /> Approve
                </button>
                <button
                  className="fu-button fu-button-secondary invite-revoke"
                  onClick={() => rejectMember(member)}
                  disabled={busyId === member.id}
                >
                  <X size={14} /> Decline
                </button>
              </div>
            </div>
          ))}
        </section>
      )}

      {settings && (
        <section className="dashboard-card team-invite">
          <div className="card-header">
            <h3 className="ai-title">
              <Globe size={18} />
              Who can join
            </h3>
            <p>
              Share your company link. Anyone with an allowed work email can create their own
              account there — no invite needed.
            </p>
          </div>

          <div className="invite-link">
            <input value={companyLink} readOnly onFocus={(event) => event.target.select()} aria-label="Company link" />
            <button className="fu-button fu-button-secondary" onClick={copyCompanyLink}>
              {companyLinkCopied ? <Check size={16} /> : <Copy size={16} />}
              {companyLinkCopied ? "Copied" : "Copy company link"}
            </button>
          </div>

          <form className="fu-form join-settings" onSubmit={saveSettings}>
            <label>
              Allowed email domains
              <input
                value={domainsInput}
                onChange={(event) => setDomainsInput(event.target.value)}
                placeholder="e.g. nutrabay.com"
                disabled={!perms.canChangeRoles}
              />
              <span className="auth-hint join-hint">
                {settings.allowedDomains.length
                  ? `People with ${settings.allowedDomains.map((d) => `@${d}`).join(" or ")} emails can sign up at your company link as Members.`
                  : "No domain set — people can only join through invite links."}{" "}
                Gmail, Yahoo and other public providers can't be used.
              </span>
            </label>

            <label className="followup-checkbox-label">
              <input
                type="checkbox"
                checked={requireApproval}
                onChange={(event) => setRequireApproval(event.target.checked)}
                disabled={!perms.canChangeRoles}
              />
              Approve new sign-ups before they get access (recommended)
            </label>

            {perms.canChangeRoles ? (
              <div className="join-actions">
                <button type="submit" className="fu-button fu-button-primary" disabled={savingSettings}>
                  {savingSettings ? "Saving..." : "Save"}
                </button>
                {settingsSaved && (
                  <span className="slug-status ok">
                    <Check size={14} /> Saved
                  </span>
                )}
              </div>
            ) : (
              <p className="auth-hint join-hint">Only the Owner can change these settings.</p>
            )}
          </form>
        </section>
      )}

      {perms.canInvite && (
        <section className="dashboard-card team-invite">
          <div className="card-header">
            <h3 className="ai-title">
              <UserPlus size={18} />
              Invite links
            </h3>
            <p>
              For people without a company email (e.g. agencies, distributors' staff), or to add an Admin.
              Anyone with the link can join for 7 days.
            </p>
          </div>

          <div className="invite-row">
            <select
              value={inviteRole}
              onChange={(event) => setInviteRole(event.target.value)}
              aria-label="Role for new teammates"
            >
              <option value="Member">Join as Member</option>
              {perms.canInviteAdmins && <option value="Admin">Join as Admin</option>}
            </select>
            <button className="fu-button fu-button-primary" onClick={createInvite} disabled={creating}>
              <Link2 size={16} />
              {creating ? "Creating..." : "Create invite link"}
            </button>
          </div>

          {newLink && (
            <div className="invite-link">
              <input value={newLink.url} readOnly onFocus={(event) => event.target.select()} aria-label="Invite link" />
              <button className="fu-button fu-button-secondary" onClick={copyLink}>
                {copied ? <Check size={16} /> : <Copy size={16} />}
                {copied ? "Copied" : "Copy"}
              </button>
              <p className="auth-hint">
                New {newLink.role}s who open this link join {company.name}. This is the only time the link is shown.
              </p>
            </div>
          )}

          {invites.length > 0 && (
            <div className="invite-list">
              <h4>Active invite links</h4>
              {invites.map((invite) => (
                <div className="invite-item" key={invite.id}>
                  <span className={`fu-badge ${ROLE_BADGE[invite.role]}`}>{invite.role}</span>
                  <span>
                    Used {invite.usedCount}/{invite.maxUses} · expires {formatDate(invite.expiresAt)}
                    {invite.createdBy ? ` · by ${invite.createdBy}` : ""}
                  </span>
                  <button
                    className="fu-button fu-button-secondary invite-revoke"
                    onClick={() => revokeInvite(invite)}
                    disabled={busyId === invite.id}
                  >
                    Revoke
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      <div className="fu-table-wrapper">
        {loading ? (
          <div className="fu-empty-state">Loading team...</div>
        ) : (
          <div className="fu-table-scroll">
            <table className="fu-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Role</th>
                  <th>Joined</th>
                  <th>Last login</th>
                  <th aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {activeMembers.map((member) => (
                  <tr key={member.id}>
                    <td>
                      <div className="fu-task-title">
                        {member.name}
                        {member.id === user.id && <span className="you-tag">You</span>}
                      </div>
                      <div className="fu-task-description">{member.email}</div>
                    </td>
                    <td>
                      {perms.canChangeRoles && member.id !== user.id ? (
                        <select
                          className={`badge-select fu-badge ${ROLE_BADGE[member.role]}`}
                          value={member.role}
                          disabled={busyId === member.id}
                          onChange={(event) => changeRole(member, event.target.value)}
                          aria-label={`Role for ${member.name}`}
                          title={ROLE_HELP[member.role]}
                        >
                          <option value="Owner">Owner</option>
                          <option value="Admin">Admin</option>
                          <option value="Member">Member</option>
                        </select>
                      ) : (
                        <span className={`fu-badge ${ROLE_BADGE[member.role]}`} title={ROLE_HELP[member.role]}>
                          {member.role}
                        </span>
                      )}
                    </td>
                    <td>{formatDate(member.joinedAt)}</td>
                    <td>{member.lastLoginAt ? formatDate(member.lastLoginAt) : "—"}</td>
                    <td className="table-actions">
                      {perms.canRemove(member) && (
                        <button
                          className="fu-icon-button"
                          onClick={() => removeMember(member)}
                          disabled={busyId === member.id}
                          aria-label={`Remove ${member.name}`}
                          title="Remove from company"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="role-legend">
        <Users size={16} />
        {Object.entries(ROLE_HELP).map(([role, help]) => (
          <span key={role}>
            <strong>{role}:</strong> {help}
          </span>
        ))}
      </div>
    </div>
  );
}
