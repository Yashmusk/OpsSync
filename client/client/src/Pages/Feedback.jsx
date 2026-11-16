import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  CircleAlert,
  MessageSquare,
  Plus,
  RefreshCw,
  Search,
  Star,
  ThumbsDown,
  X,
} from "lucide-react";
import { apiRequest, formatDate } from "../api";

const SOURCES = [
  "Sales Visit",
  "Phone",
  "WhatsApp",
  "Email",
  "Marketplace Review",
  "Website",
  "Social Media",
  "Other",
];

const CATEGORIES = [
  "Taste",
  "Quality",
  "Packaging",
  "Delivery",
  "Pricing",
  "Service",
  "Other",
];

const STATUSES = ["Open", "In Progress", "Resolved"];

const SENTIMENT_BADGE = {
  Positive: "fu-status-completed",
  Neutral: "fu-status-cancelled",
  Negative: "fu-status-overdue",
};

const STATUS_BADGE = {
  Open: "fu-priority-medium",
  "In Progress": "fu-status-pending",
  Resolved: "fu-status-completed",
};

const initialForm = {
  customer: "",
  product: "",
  source: "Sales Visit",
  category: "Quality",
  rating: 0,
  comment: "",
};

function Stars({ rating }) {
  return (
    <span className="stars" aria-label={`${rating} out of 5`}>
      {[1, 2, 3, 4, 5].map((value) => (
        <Star
          key={value}
          size={14}
          className={value <= rating ? "star-filled" : "star-empty"}
        />
      ))}
    </span>
  );
}

export default function Feedback() {
  const [feedback, setFeedback] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [sentimentFilter, setSentimentFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(initialForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [updatingId, setUpdatingId] = useState(null);

  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true; // ignore responses that arrive after a newer request

    Promise.all([
      apiRequest("/feedback"),
      apiRequest("/customers"),
      apiRequest("/products"),
    ])
      .then(([feedbackData, customersData, productsData]) => {
        if (!active) return;
        setFeedback(feedbackData);
        setCustomers(customersData);
        setProducts(productsData);
        setError("");
      })
      .catch((err) => {
        if (active) setError(err.message || "Could not load feedback.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [reloadKey]);

  const fetchPageData = () => {
    setLoading(true);
    setError("");
    setReloadKey((key) => key + 1);
  };

  const stats = useMemo(() => {
    const total = feedback.length;
    const negative = feedback.filter((f) => f.sentiment === "Negative").length;
    const ratingSum = feedback.reduce((sum, f) => sum + f.rating, 0);

    return {
      total,
      averageRating: total ? (ratingSum / total).toFixed(1) : "—",
      negativeShare: total ? Math.round((negative / total) * 100) : 0,
      open: feedback.filter((f) => f.status !== "Resolved").length,
    };
  }, [feedback]);

  const filteredFeedback = useMemo(() => {
    const term = search.trim().toLowerCase();

    return feedback.filter((item) => {
      const matchesSearch = [
        item.comment,
        item.customer?.name,
        item.product?.name,
      ].some((value) => String(value || "").toLowerCase().includes(term));

      return (
        matchesSearch &&
        (categoryFilter === "All" || item.category === categoryFilter) &&
        (sentimentFilter === "All" || item.sentiment === sentimentFilter) &&
        (statusFilter === "All" || item.status === statusFilter)
      );
    });
  }, [feedback, search, categoryFilter, sentimentFilter, statusFilter]);

  const updateForm = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  };

  const openModal = () => {
    setForm(initialForm);
    setFormError("");
    setShowModal(true);
  };

  const handleCreate = async (event) => {
    event.preventDefault();
    setFormError("");

    if (!form.rating) {
      setFormError("Please choose a rating.");
      return;
    }
    if (!form.comment.trim()) {
      setFormError("Please add the customer's comment.");
      return;
    }

    setSaving(true);

    try {
      await apiRequest("/feedback", {
        method: "POST",
        body: {
          ...form,
          customer: form.customer || null,
          product: form.product || null,
          comment: form.comment.trim(),
        },
      });
      setShowModal(false);
      fetchPageData();
    } catch (err) {
      setFormError(err.message || "Failed to save feedback.");
    } finally {
      setSaving(false);
    }
  };

  const changeStatus = async (item, status) => {
    setUpdatingId(item._id);
    setError("");

    try {
      const updated = await apiRequest(`/feedback/${item._id}`, {
        method: "PATCH",
        body: { status },
      });
      setFeedback((current) =>
        current.map((entry) => (entry._id === updated._id ? updated : entry))
      );
    } catch (err) {
      setError(err.message || "Failed to update status.");
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div className="module-page">
      <div className="module-header">
        <div>
          <h1>Feedback</h1>
          <p>What customers say about your products and service.</p>
        </div>

        <div className="module-header-actions">
          <button
            className="fu-button fu-button-secondary"
            onClick={fetchPageData}
            disabled={loading}
          >
            <RefreshCw size={16} />
            Refresh
          </button>
          <button className="fu-button fu-button-primary" onClick={openModal}>
            <Plus size={17} />
            Log Feedback
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
          <span className="fu-stat-icon"><MessageSquare size={19} /></span>
          <p>Total Feedback</p>
          <h2>{stats.total}</h2>
        </div>
        <div className="fu-stat-card">
          <span className="fu-stat-icon"><Star size={19} /></span>
          <p>Average Rating</p>
          <h2>{stats.averageRating}</h2>
        </div>
        <div className="fu-stat-card">
          <span className="fu-stat-icon"><ThumbsDown size={19} /></span>
          <p>Negative</p>
          <h2>{stats.negativeShare}%</h2>
        </div>
        <div className="fu-stat-card">
          <span className="fu-stat-icon"><CircleAlert size={19} /></span>
          <p>Unresolved</p>
          <h2>{stats.open}</h2>
        </div>
      </div>

      <div className="fu-toolbar">
        <div className="fu-search">
          <Search size={18} />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search comments, customers, or products..."
          />
        </div>

        <select
          value={categoryFilter}
          onChange={(event) => setCategoryFilter(event.target.value)}
          aria-label="Filter by category"
        >
          <option value="All">All categories</option>
          {CATEGORIES.map((category) => (
            <option key={category} value={category}>
              {category}
            </option>
          ))}
        </select>

        <select
          value={sentimentFilter}
          onChange={(event) => setSentimentFilter(event.target.value)}
          aria-label="Filter by sentiment"
        >
          <option value="All">All sentiment</option>
          <option value="Positive">Positive</option>
          <option value="Neutral">Neutral</option>
          <option value="Negative">Negative</option>
        </select>

        <select
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value)}
          aria-label="Filter by status"
        >
          <option value="All">All statuses</option>
          {STATUSES.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>
      </div>

      <div className="fu-table-wrapper">
        {loading ? (
          <div className="fu-empty-state">Loading feedback...</div>
        ) : filteredFeedback.length === 0 ? (
          <div className="fu-empty-state">
            <MessageSquare size={32} />
            <h3>No feedback found</h3>
            <p>Log what customers tell your team, or adjust your filters.</p>
            {!error && feedback.length === 0 && (
              <button className="fu-button fu-button-primary" onClick={openModal}>
                <Plus size={16} />
                Log your first feedback
              </button>
            )}
          </div>
        ) : (
          <div className="fu-table-scroll">
            <table className="fu-table">
              <thead>
                <tr>
                  <th>Feedback</th>
                  <th>Customer / Product</th>
                  <th>Category</th>
                  <th>Sentiment</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredFeedback.map((item) => (
                  <tr key={item._id}>
                    <td>
                      <Stars rating={item.rating} />
                      <div className="feedback-comment">{item.comment}</div>
                      <div className="fu-task-description">
                        {item.source} · {formatDate(item.createdAt)}
                      </div>
                    </td>
                    <td>
                      <div className="fu-task-title">
                        {item.customer?.name || "Anonymous / D2C"}
                      </div>
                      {item.product && (
                        <div className="fu-task-description">
                          {item.product.name}
                        </div>
                      )}
                    </td>
                    <td>{item.category}</td>
                    <td>
                      <span className={`fu-badge ${SENTIMENT_BADGE[item.sentiment]}`}>
                        {item.sentiment}
                      </span>
                    </td>
                    <td>
                      <select
                        className={`badge-select fu-badge ${STATUS_BADGE[item.status]}`}
                        value={item.status}
                        disabled={updatingId === item._id}
                        onChange={(event) => changeStatus(item, event.target.value)}
                        aria-label="Feedback status"
                      >
                        {STATUSES.map((status) => (
                          <option key={status} value={status}>
                            {status}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
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
            aria-labelledby="feedback-modal-title"
          >
            <div className="fu-modal-header">
              <div>
                <h2 id="feedback-modal-title">Log Feedback</h2>
                <p>Capture what the customer said, in their words.</p>
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
              <div className="fu-form-row">
                <label>
                  Customer
                  <select name="customer" value={form.customer} onChange={updateForm}>
                    <option value="">Anonymous / D2C</option>
                    {customers.map((customer) => (
                      <option key={customer._id} value={customer._id}>
                        {customer.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Product
                  <select name="product" value={form.product} onChange={updateForm}>
                    <option value="">General / not product-specific</option>
                    {products.map((product) => (
                      <option key={product._id} value={product._id}>
                        {product.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="fu-form-row">
                <label>
                  Category *
                  <select name="category" value={form.category} onChange={updateForm}>
                    {CATEGORIES.map((category) => (
                      <option key={category} value={category}>
                        {category}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Source
                  <select name="source" value={form.source} onChange={updateForm}>
                    {SOURCES.map((source) => (
                      <option key={source} value={source}>
                        {source}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="rating-field">
                <span>Rating *</span>
                <div className="rating-picker" role="radiogroup" aria-label="Rating">
                  {[1, 2, 3, 4, 5].map((value) => (
                    <button
                      type="button"
                      key={value}
                      role="radio"
                      aria-checked={form.rating === value}
                      aria-label={`${value} star${value === 1 ? "" : "s"}`}
                      onClick={() => setForm((current) => ({ ...current, rating: value }))}
                    >
                      <Star
                        size={26}
                        className={value <= form.rating ? "star-filled" : "star-empty"}
                      />
                    </button>
                  ))}
                </div>
              </div>

              <label>
                Comment *
                <textarea
                  name="comment"
                  value={form.comment}
                  onChange={updateForm}
                  rows={3}
                  placeholder="e.g. Chocolate flavour is too sweet, customers asking for less sugar"
                  required
                />
              </label>

              {formError && <div className="fu-message fu-error">{formError}</div>}

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
                  disabled={saving}
                >
                  {saving ? "Saving..." : "Save Feedback"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
