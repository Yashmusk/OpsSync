
import {
  Search,
  Plus,
  Phone,
  Mail,
  Users,
  MessageCircle,
  ClipboardList,
  CalendarDays,
  Clock3,
  ArrowUpRight,
  Sparkles,
  RefreshCw,
} from "lucide-react";
import { useState, useEffect, useCallback } from "react";

const API_URL = "http://localhost:5000/api";

const typeIcons = {
  Call: Phone,
  Email: Mail,
  Meeting: Users,
  WhatsApp: MessageCircle,
  Note: ClipboardList,
};

const initialForm = {
  customer: "",
  type: "Call",
  subject: "",
  notes: "",
  status: "Completed",
  activityDate: "",
};

function formatDate(date) {
  if (!date) return "—";

  const parsedDate = new Date(date);

  if (Number.isNaN(parsedDate.getTime())) return "—";

  return parsedDate.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function Activities() {
  const [activities, setActivities] = useState([]);
  const [customers, setCustomers] = useState([]);

  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("All Types");
  const [statusFilter, setStatusFilter] = useState("All Statuses");

  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState(initialForm);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Fetch real activities and customers from the backend.
  const fetchPageData = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const [activityResponse, customerResponse] = await Promise.all([
        fetch(`${API_URL}/activities`),
        fetch(`${API_URL}/customers`),
      ]);

      if (!activityResponse.ok || !customerResponse.ok) {
        throw new Error("Unable to load activities or customers.");
      }

      const activityData = await activityResponse.json();
      const customerData = await customerResponse.json();

      if (!Array.isArray(activityData) || !Array.isArray(customerData)) {
        throw new Error("The API returned an unexpected response.");
      }

      setActivities(activityData);
      setCustomers(customerData);
    } catch (err) {
      console.error("Failed to load Activities:", err);
      setError(
        "Could not load data. Check that your backend and MongoDB are running."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPageData();
  }, [fetchPageData]);

  // Handle form inputs.
  const handleChange = (event) => {
    const { name, value } = event.target;

    setFormData((previous) => ({
      ...previous,
      [name]: value,
    }));
  };

  // Save an activity to MongoDB through the Activity API.
  const handleAddActivity = async (event) => {
    event.preventDefault();

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const payload = {
        customer: formData.customer,
        type: formData.type,
        subject: formData.subject.trim(),
        notes: formData.notes.trim(),
        status: formData.status,
      };

      if (formData.activityDate) {
        payload.activityDate = new Date(
          formData.activityDate
        ).toISOString();
      }

      const response = await fetch(`${API_URL}/activities`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error || result.message || "Failed to create activity."
        );
      }

      // Fetch the latest records from the database.
      await fetchPageData();

      setFormData(initialForm);
      setShowModal(false);
      setSuccess("Activity logged successfully.");
    } catch (err) {
      console.error("Failed to add activity:", err);
      setError(err.message || "Failed to save activity.");
    } finally {
      setSaving(false);
    }
  };

  // Derive all KPI values from actual Activity records.
  const totalActivities = activities.length;

  const totalCalls = activities.filter(
    (activity) => activity.type === "Call"
  ).length;

  const totalMeetings = activities.filter(
    (activity) => activity.type === "Meeting"
  ).length;

  // Until the Follow-up model exists, this counts activities
  // whose status is Pending, not separate follow-up tasks.
  const pendingActivities = activities.filter(
    (activity) => activity.status === "Pending"
  ).length;

  // Search and filters.
  const filteredActivities = activities.filter((activity) => {
    const query = search.toLowerCase();

    const customerName =
      typeof activity.customer === "object"
        ? activity.customer?.name || ""
        : "";

    const matchesSearch =
      (activity.subject || "").toLowerCase().includes(query) ||
      customerName.toLowerCase().includes(query) ||
      (activity.notes || "").toLowerCase().includes(query);

    const matchesType =
      typeFilter === "All Types" || activity.type === typeFilter;

    const matchesStatus =
      statusFilter === "All Statuses" ||
      activity.status === statusFilter;

    return matchesSearch && matchesType && matchesStatus;
  });

  return (
    <div className="activities-page">
      {/* HEADER */}
      <div className="page-header">
        <div>
          <h1>Activities</h1>
          <p>Track customer interactions and sales conversations.</p>
        </div>

        <button
          className="primary-button"
          onClick={() => {
            setError("");
            setSuccess("");
            setShowModal(true);
          }}
        >
          <Plus size={18} />
          Log Activity
        </button>
      </div>

      {error && (
        <div className="activity-message activity-error" role="alert">
          {error}
          <button onClick={fetchPageData} type="button">
            Retry
          </button>
        </div>
      )}

      {success && (
        <div className="activity-message activity-success" role="status">
          {success}
        </div>
      )}

      {/* KPI CARDS */}
      <div className="activity-summary">
        <div className="activity-stat">
          <div className="activity-stat-top">
            <span>Total Activities</span>
            <ClipboardList size={19} />
          </div>
          <strong>{loading ? "—" : totalActivities}</strong>
          <small>Recorded interactions</small>
        </div>

        <div className="activity-stat">
          <div className="activity-stat-top">
            <span>Calls</span>
            <Phone size={19} />
          </div>
          <strong>{loading ? "—" : totalCalls}</strong>
          <small>Logged customer calls</small>
        </div>

        <div className="activity-stat">
          <div className="activity-stat-top">
            <span>Pending Follow-ups*</span>
            <Clock3 size={19} />
          </div>
          <strong>{loading ? "—" : pendingActivities}</strong>
          <small>*Activities marked pending</small>
        </div>

        <div className="activity-stat">
          <div className="activity-stat-top">
            <span>Meetings</span>
            <CalendarDays size={19} />
          </div>
          <strong>{loading ? "—" : totalMeetings}</strong>
          <small>Logged customer meetings</small>
        </div>
      </div>

      {/* ACTIVITY LOG */}
      <div className="activities-card">
        <div className="activities-toolbar">
          <div>
            <h2>Activity log</h2>
            <p>Review recent customer interactions.</p>
          </div>

          <div className="activity-filters">
            <div className="search-box">
              <Search size={17} />
              <input
                placeholder="Search activities..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>

            <select
              value={typeFilter}
              onChange={(event) => setTypeFilter(event.target.value)}
            >
              <option>All Types</option>
              <option>Call</option>
              <option>Meeting</option>
              <option>Email</option>
              <option>WhatsApp</option>
              <option>Note</option>
            </select>

            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
            >
              <option>All Statuses</option>
              <option>Completed</option>
              <option>Pending</option>
            </select>

            <button
              type="button"
              className="more-button"
              onClick={fetchPageData}
              title="Refresh activities"
              aria-label="Refresh activities"
              disabled={loading}
            >
              <RefreshCw size={17} />
            </button>
          </div>
        </div>

        <div className="activity-list">
          {loading ? (
            <div className="activity-empty">Loading activities...</div>
          ) : filteredActivities.length === 0 ? (
            <div className="activity-empty">
              {activities.length === 0
                ? "No activities yet. Click Log Activity to add your first interaction."
                : "No activities match your search or filters."}
            </div>
          ) : (
            filteredActivities.map((activity) => {
              const Icon = typeIcons[activity.type] || ClipboardList;
              const customerName =
                typeof activity.customer === "object"
                  ? activity.customer?.name || "Unknown customer"
                  : "Unknown customer";

              return (
                <div className="activity-row" key={activity._id}>
                  <div
                    className={`activity-icon activity-${(
                      activity.type || "note"
                    ).toLowerCase()}`}
                  >
                    <Icon size={19} />
                  </div>

                  <div className="activity-main">
                    <strong>{activity.subject}</strong>
                    <span>
                      {customerName} · {activity.type}
                    </span>
                    {activity.notes && <p>{activity.notes}</p>}
                  </div>

                  <div className="activity-meta">
                    <span
                      className={`status ${(activity.status || "").toLowerCase()}`}
                    >
                      {activity.status}
                    </span>
                    <small>
                      {formatDate(activity.activityDate || activity.createdAt)}
                    </small>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* FUTURE INTELLIGENCE FEATURE */}
      <div className="activity-insight">
        <div className="insight-icon">
          <Sparkles size={20} />
        </div>
        <div>
          <strong>Customer intelligence</strong>
          <p>
            OpsSync can later analyze conversation notes to identify
            customer concerns, suggest next actions, and highlight risks.
          </p>
        </div>
        <ArrowUpRight size={19} />
      </div>

      {/* LOG ACTIVITY MODAL */}
      {showModal && (
        <div
          className="modal-overlay"
          onClick={() => !saving && setShowModal(false)}
        >
          <div className="modal" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h2>Log Activity</h2>
                <p>Record a customer interaction.</p>
              </div>

              <button
                type="button"
                className="modal-close"
                onClick={() => setShowModal(false)}
                disabled={saving}
              >
                ×
              </button>
            </div>

            {customers.length === 0 ? (
              <div className="activity-empty">
                Add a customer in the Customers page before logging an
                activity.
              </div>
            ) : (
              <form onSubmit={handleAddActivity}>
                <div className="form-group">
                  <label htmlFor="activity-customer">Customer</label>
                  <select
                    id="activity-customer"
                    name="customer"
                    value={formData.customer}
                    onChange={handleChange}
                    required
                  >
                    <option value="">Select a customer</option>
                    {customers.map((customer) => (
                      <option key={customer._id} value={customer._id}>
                        {customer.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="activity-type">Activity type</label>
                    <select
                      id="activity-type"
                      name="type"
                      value={formData.type}
                      onChange={handleChange}
                      required
                    >
                      <option value="Call">Call</option>
                      <option value="Meeting">Meeting</option>
                      <option value="Email">Email</option>
                      <option value="WhatsApp">WhatsApp</option>
                      <option value="Note">Note</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label htmlFor="activity-status">Status</label>
                    <select
                      id="activity-status"
                      name="status"
                      value={formData.status}
                      onChange={handleChange}
                      required
                    >
                      <option value="Completed">Completed</option>
                      <option value="Pending">Pending</option>
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label htmlFor="activity-subject">Subject</label>
                  <input
                    id="activity-subject"
                    name="subject"
                    placeholder="e.g. Discussed monthly reorder"
                    value={formData.subject}
                    onChange={handleChange}
                    maxLength={150}
                    required
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="activity-notes">Notes</label>
                  <textarea
                    id="activity-notes"
                    name="notes"
                    placeholder="What happened during the interaction?"
                    value={formData.notes}
                    onChange={handleChange}
                    rows={4}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="activity-date">Activity date (optional)</label>
                  <input
                    id="activity-date"
                    name="activityDate"
                    type="datetime-local"
                    value={formData.activityDate}
                    onChange={handleChange}
                  />
                </div>

                <div className="modal-actions">
                  <button
                    type="button"
                    className="cancel-button"
                    onClick={() => setShowModal(false)}
                    disabled={saving}
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    className="primary-button"
                    disabled={saving}
                  >
                    {saving ? "Saving..." : "Save Activity"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default Activities;
