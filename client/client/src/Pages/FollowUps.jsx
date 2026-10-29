
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Plus,
  RefreshCw,
  Search,
  Clock,
  CheckCircle2,
  AlertCircle,
  CalendarDays,
  X,
} from "lucide-react";

const API_URL = "http://localhost:5000/api";

const initialForm = {
  customer: "",
  title: "",
  description: "",
  dueDate: "",
  priority: "Medium",
};

function formatDate(date) {
  if (!date) return "—";

  return new Date(date).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getDueLabel(followUp) {
  if (followUp.status === "Completed") return "Completed";
  if (followUp.status === "Cancelled") return "Cancelled";

  const due = new Date(followUp.dueDate);
  if (Number.isNaN(due.getTime())) return "No valid date";

  return due < new Date() ? "Overdue" : "Upcoming";
}

export default function FollowUps() {
  const [followUps, setFollowUps] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [priorityFilter, setPriorityFilter] = useState("All");
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [form, setForm] = useState(initialForm);

  const fetchPageData = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const [followUpsResponse, customersResponse] = await Promise.all([
        fetch(`${API_URL}/follow-ups`),
        fetch(`${API_URL}/customers`),
      ]);

      if (!followUpsResponse.ok || !customersResponse.ok) {
        throw new Error("Could not load follow-ups or customers.");
      }

      const followUpsResult = await followUpsResponse.json();
      const customersResult = await customersResponse.json();

      setFollowUps(
        Array.isArray(followUpsResult)
          ? followUpsResult
          : followUpsResult.data || []
      );

      setCustomers(
        Array.isArray(customersResult)
          ? customersResult
          : customersResult.data || []
      );
    } catch (err) {
      setError(err.message || "Something went wrong while loading data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPageData();
  }, [fetchPageData]);

  const stats = useMemo(() => {
    const pending = followUps.filter((item) => item.status === "Pending");
    const overdue = pending.filter(
      (item) => getDueLabel(item) === "Overdue"
    );
    const completed = followUps.filter(
      (item) => item.status === "Completed"
    );

    return {
      total: followUps.length,
      pending: pending.length,
      overdue: overdue.length,
      completed: completed.length,
    };
  }, [followUps]);

  const filteredFollowUps = useMemo(() => {
    const term = search.trim().toLowerCase();

    return followUps.filter((item) => {
      const customerName =
        typeof item.customer === "object"
          ? item.customer?.name || ""
          : "";

      const matchesSearch = [
        item.title,
        item.description,
        customerName,
      ].some((value) => String(value || "").toLowerCase().includes(term));

      const matchesStatus =
        statusFilter === "All" || item.status === statusFilter;

      const matchesPriority =
        priorityFilter === "All" || item.priority === priorityFilter;

      return matchesSearch && matchesStatus && matchesPriority;
    });
  }, [followUps, search, statusFilter, priorityFilter]);

  const updateForm = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  };

  const handleCreate = async (event) => {
    event.preventDefault();
    setFormError("");

    if (!form.customer || !form.title.trim() || !form.dueDate) {
      setFormError("Customer, task title, and due date are required.");
      return;
    }

    setSaving(true);

    try {
      const response = await fetch(`${API_URL}/follow-ups`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          title: form.title.trim(),
          description: form.description.trim(),
          dueDate: new Date(form.dueDate).toISOString(),
          source: "Manual",
        }),
      });

      const result = await response.json();

      if (!response.ok || result.success === false) {
        throw new Error(result.message || "Failed to create follow-up.");
      }

      setShowModal(false);
      setForm(initialForm);
      await fetchPageData();
    } catch (err) {
      setFormError(err.message || "Failed to create follow-up.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="followups-page">
      <div className="followups-header">
        <div>
          <h1>Follow-ups</h1>
          <p>Keep customer commitments and next actions on track.</p>
        </div>

        <div className="followups-header-actions">
          <button
            className="fu-button fu-button-secondary"
            onClick={fetchPageData}
            disabled={loading}
          >
            <RefreshCw size={16} />
            Refresh
          </button>

          <button
            className="fu-button fu-button-primary"
            onClick={() => {
              setFormError("");
              setShowModal(true);
            }}
          >
            <Plus size={17} />
            Add Follow-up
          </button>
        </div>
      </div>

      {error && (
        <div className="fu-message fu-error">
          <AlertCircle size={18} />
          <span>{error}</span>
          <button onClick={fetchPageData}>Try again</button>
        </div>
      )}

      <div className="fu-stats-grid">
        <div className="fu-stat-card">
          <span className="fu-stat-icon"><CalendarDays size={19} /></span>
          <p>Total Follow-ups</p>
          <h2>{stats.total}</h2>
        </div>

        <div className="fu-stat-card">
          <span className="fu-stat-icon"><Clock size={19} /></span>
          <p>Pending</p>
          <h2>{stats.pending}</h2>
        </div>

        <div className="fu-stat-card">
          <span className="fu-stat-icon"><AlertCircle size={19} /></span>
          <p>Overdue</p>
          <h2>{stats.overdue}</h2>
        </div>

        <div className="fu-stat-card">
          <span className="fu-stat-icon"><CheckCircle2 size={19} /></span>
          <p>Completed</p>
          <h2>{stats.completed}</h2>
        </div>
      </div>

      <div className="fu-toolbar">
        <div className="fu-search">
          <Search size={18} />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search tasks or customers..."
          />
        </div>

        <select
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value)}
          aria-label="Filter by status"
        >
          <option value="All">All statuses</option>
          <option value="Pending">Pending</option>
          <option value="Completed">Completed</option>
          <option value="Cancelled">Cancelled</option>
        </select>

        <select
          value={priorityFilter}
          onChange={(event) => setPriorityFilter(event.target.value)}
          aria-label="Filter by priority"
        >
          <option value="All">All priorities</option>
          <option value="High">High priority</option>
          <option value="Medium">Medium priority</option>
          <option value="Low">Low priority</option>
        </select>
      </div>

      <div className="fu-table-wrapper">
        {loading ? (
          <div className="fu-empty-state">Loading follow-ups...</div>
        ) : filteredFollowUps.length === 0 ? (
          <div className="fu-empty-state">
            <CalendarDays size={32} />
            <h3>No follow-ups found</h3>
            <p>
              Add a task manually or adjust your search and filters.
            </p>
            {!error && (
              <button
                className="fu-button fu-button-primary"
                onClick={() => setShowModal(true)}
              >
                <Plus size={16} />
                Add your first follow-up
              </button>
            )}
          </div>
        ) : (
          <div className="fu-table-scroll">
            <table className="fu-table">
              <thead>
                <tr>
                  <th>Task</th>
                  <th>Customer</th>
                  <th>Due date</th>
                  <th>Priority</th>
                  <th>Status</th>
                  <th>Source</th>
                </tr>
              </thead>
              <tbody>
                {filteredFollowUps.map((item) => {
                  const customerName =
                    typeof item.customer === "object"
                      ? item.customer?.name || "Unknown customer"
                      : "Customer";

                  const dueLabel = getDueLabel(item);

                  return (
                    <tr key={item._id}>
                      <td>
                        <div className="fu-task-title">{item.title}</div>
                        {item.description && (
                          <div className="fu-task-description">
                            {item.description}
                          </div>
                        )}
                      </td>
                      <td>{customerName}</td>
                      <td>{formatDate(item.dueDate)}</td>
                      <td>
                        <span
                          className={`fu-badge fu-priority-${(
                            item.priority || "Medium"
                          ).toLowerCase()}`}
                        >
                          {item.priority || "Medium"}
                        </span>
                      </td>
                      <td>
                        <span
                          className={`fu-badge fu-status-${(
                            dueLabel === "Overdue"
                              ? "overdue"
                              : item.status || "Pending"
                          ).toLowerCase()}`}
                        >
                          {dueLabel}
                        </span>
                      </td>
                      <td>{item.source || "Manual"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showModal && (
        <div
          className="fu-modal-overlay"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !saving) {
              setShowModal(false);
            }
          }}
        >
          <div
            className="fu-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="fu-modal-title"
          >
            <div className="fu-modal-header">
              <div>
                <h2 id="fu-modal-title">Add Follow-up</h2>
                <p>Create a task for a customer.</p>
              </div>
              <button
                type="button"
                className="fu-icon-button"
                onClick={() => setShowModal(false)}
                disabled={saving}
                aria-label="Close dialog"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreate} className="fu-form">
              <label>
                Customer *
                <select
                  name="customer"
                  value={form.customer}
                  onChange={updateForm}
                  required
                >
                  <option value="">Select a customer</option>
                  {customers.map((customer) => (
                    <option key={customer._id} value={customer._id}>
                      {customer.name}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Task title *
                <input
                  name="title"
                  value={form.title}
                  onChange={updateForm}
                  placeholder="e.g. Call customer about pricing"
                  required
                  maxLength={200}
                />
              </label>

              <label>
                Description
                <textarea
                  name="description"
                  value={form.description}
                  onChange={updateForm}
                  placeholder="Add context or next steps..."
                  rows={3}
                />
              </label>

              <div className="fu-form-row">
                <label>
                  Due date and time *
                  <input
                    type="datetime-local"
                    name="dueDate"
                    value={form.dueDate}
                    onChange={updateForm}
                    required
                  />
                </label>

                <label>
                  Priority
                  <select
                    name="priority"
                    value={form.priority}
                    onChange={updateForm}
                  >
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                  </select>
                </label>
              </div>

              {customers.length === 0 && (
                <p className="fu-form-hint">
                  Add a customer in the Customers page before creating a
                  follow-up.
                </p>
              )}

              {formError && (
                <div className="fu-message fu-error">{formError}</div>
              )}

              <div className="fu-modal-actions">
                <button
                  type="button"
                  className="fu-button fu-button-secondary"
                  onClick={() => setShowModal(false)}
                  disabled={saving}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="fu-button fu-button-primary"
                  disabled={saving || customers.length === 0}
                >
                  {saving ? "Saving..." : "Save Follow-up"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
