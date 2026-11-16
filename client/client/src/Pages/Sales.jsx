import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  Clock,
  IndianRupee,
  Plus,
  Receipt,
  RefreshCw,
  Search,
  ShoppingCart,
  Trash2,
  X,
} from "lucide-react";
import { apiRequest, formatCurrency, formatDate } from "../api";

const CHANNELS = [
  "Direct",
  "Distributor",
  "Website",
  "Amazon",
  "Flipkart",
  "Quick Commerce",
  "Retail Store",
  "Other",
];

const PAYMENT_STATUSES = ["Paid", "Pending", "Partial"];

const PAYMENT_BADGE = {
  Paid: "fu-status-completed",
  Pending: "fu-priority-medium",
  Partial: "fu-status-pending",
};

const emptyItem = () => ({ product: "", quantity: "1", unitPrice: "" });

// Today's date as YYYY-MM-DD in the user's local timezone
const todayKey = () => new Date().toLocaleDateString("en-CA");

// Today -> let the server stamp the current time; past dates -> local midday
// (midday keeps the calendar date stable across timezones)
const toOrderDate = (dateKey) =>
  dateKey && dateKey !== todayKey()
    ? new Date(`${dateKey}T12:00:00`).toISOString()
    : undefined;

const initialForm = () => ({
  customer: "",
  channel: "Direct",
  orderDate: todayKey(),
  paymentStatus: "Pending",
  discount: "",
  notes: "",
  items: [emptyItem()],
});

function isThisMonth(date) {
  const value = new Date(date);
  const now = new Date();
  return (
    value.getMonth() === now.getMonth() &&
    value.getFullYear() === now.getFullYear()
  );
}

export default function Sales() {
  const [sales, setSales] = useState([]);
  const [products, setProducts] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [channelFilter, setChannelFilter] = useState("All");
  const [paymentFilter, setPaymentFilter] = useState("All");
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(initialForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [updatingId, setUpdatingId] = useState(null);

  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true; // ignore responses that arrive after a newer request

    Promise.all([
      apiRequest("/sales"),
      apiRequest("/products"),
      apiRequest("/customers"),
    ])
      .then(([salesData, productsData, customersData]) => {
        if (!active) return;
        setSales(salesData);
        setProducts(productsData);
        setCustomers(customersData);
        setError("");
      })
      .catch((err) => {
        if (active) setError(err.message || "Could not load sales.");
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

  const activeProducts = useMemo(
    () => products.filter((product) => product.status === "Active"),
    [products]
  );

  const productById = useMemo(
    () => new Map(products.map((product) => [product._id, product])),
    [products]
  );

  const stats = useMemo(() => {
    const monthSales = sales.filter((sale) => isThisMonth(sale.orderDate));
    const monthRevenue = monthSales.reduce((sum, s) => sum + s.totalAmount, 0);
    const outstanding = sales
      .filter((sale) => sale.paymentStatus !== "Paid")
      .reduce((sum, s) => sum + s.totalAmount, 0);

    return {
      monthRevenue,
      monthOrders: monthSales.length,
      averageOrder: monthSales.length ? monthRevenue / monthSales.length : 0,
      outstanding,
    };
  }, [sales]);

  const filteredSales = useMemo(() => {
    const term = search.trim().toLowerCase();

    return sales.filter((sale) => {
      const matchesSearch = [
        sale.orderNumber,
        sale.customer?.name,
        ...sale.items.map((item) => item.name),
      ].some((value) => String(value || "").toLowerCase().includes(term));

      const matchesChannel =
        channelFilter === "All" || sale.channel === channelFilter;
      const matchesPayment =
        paymentFilter === "All" || sale.paymentStatus === paymentFilter;

      return matchesSearch && matchesChannel && matchesPayment;
    });
  }, [sales, search, channelFilter, paymentFilter]);

  // Live order total for the form
  const formTotals = useMemo(() => {
    const subtotal = form.items.reduce((sum, item) => {
      const price = Number(item.unitPrice || 0);
      const quantity = Number(item.quantity || 0);
      return sum + price * quantity;
    }, 0);
    const discount = Number(form.discount || 0);
    return { subtotal, discount, total: Math.max(subtotal - discount, 0) };
  }, [form.items, form.discount]);

  const updateForm = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  };

  const updateItem = (index, field, value) => {
    setForm((current) => {
      const items = current.items.map((item, i) => {
        if (i !== index) return item;

        const next = { ...item, [field]: value };
        // Pre-fill the list price when a product is chosen
        if (field === "product") {
          const product = productById.get(value);
          next.unitPrice = product ? String(product.price) : "";
        }
        return next;
      });
      return { ...current, items };
    });
  };

  const addItem = () =>
    setForm((current) => ({ ...current, items: [...current.items, emptyItem()] }));

  const removeItem = (index) =>
    setForm((current) => ({
      ...current,
      items: current.items.filter((_, i) => i !== index),
    }));

  const openModal = () => {
    setForm(initialForm());
    setFormError("");
    setShowModal(true);
  };

  const handleCreate = async (event) => {
    event.preventDefault();
    setFormError("");

    const items = form.items.filter((item) => item.product);

    if (items.length === 0) {
      setFormError("Add at least one product to the sale.");
      return;
    }

    if (formTotals.discount > formTotals.subtotal) {
      setFormError("Discount can't be more than the subtotal.");
      return;
    }

    setSaving(true);

    try {
      await apiRequest("/sales", {
        method: "POST",
        body: {
          customer: form.customer || null,
          channel: form.channel,
          orderDate: toOrderDate(form.orderDate),
          paymentStatus: form.paymentStatus,
          discount: Number(form.discount || 0),
          notes: form.notes.trim(),
          items: items.map((item) => ({
            product: item.product,
            quantity: Number(item.quantity),
            unitPrice: Number(item.unitPrice),
          })),
        },
      });

      setShowModal(false);
      fetchPageData();
    } catch (err) {
      setFormError(err.message || "Failed to record sale.");
    } finally {
      setSaving(false);
    }
  };

  const changePaymentStatus = async (sale, paymentStatus) => {
    setUpdatingId(sale._id);
    setError("");

    try {
      const updated = await apiRequest(`/sales/${sale._id}`, {
        method: "PATCH",
        body: { paymentStatus },
      });
      setSales((current) =>
        current.map((item) => (item._id === updated._id ? updated : item))
      );
    } catch (err) {
      setError(err.message || "Failed to update payment status.");
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div className="module-page">
      <div className="module-header">
        <div>
          <h1>Sales</h1>
          <p>Every order across channels, with payments tracked.</p>
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
            Record Sale
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
          <span className="fu-stat-icon"><IndianRupee size={19} /></span>
          <p>Revenue this month</p>
          <h2>{formatCurrency(stats.monthRevenue)}</h2>
        </div>
        <div className="fu-stat-card">
          <span className="fu-stat-icon"><ShoppingCart size={19} /></span>
          <p>Orders this month</p>
          <h2>{stats.monthOrders}</h2>
        </div>
        <div className="fu-stat-card">
          <span className="fu-stat-icon"><Receipt size={19} /></span>
          <p>Avg. order value</p>
          <h2>{formatCurrency(stats.averageOrder)}</h2>
        </div>
        <div className="fu-stat-card">
          <span className="fu-stat-icon"><Clock size={19} /></span>
          <p>Payments outstanding</p>
          <h2>{formatCurrency(stats.outstanding)}</h2>
        </div>
      </div>

      <div className="fu-toolbar">
        <div className="fu-search">
          <Search size={18} />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search order #, customer, or product..."
          />
        </div>

        <select
          value={channelFilter}
          onChange={(event) => setChannelFilter(event.target.value)}
          aria-label="Filter by channel"
        >
          <option value="All">All channels</option>
          {CHANNELS.map((channel) => (
            <option key={channel} value={channel}>
              {channel}
            </option>
          ))}
        </select>

        <select
          value={paymentFilter}
          onChange={(event) => setPaymentFilter(event.target.value)}
          aria-label="Filter by payment status"
        >
          <option value="All">All payments</option>
          {PAYMENT_STATUSES.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>
      </div>

      <div className="fu-table-wrapper">
        {loading ? (
          <div className="fu-empty-state">Loading sales...</div>
        ) : filteredSales.length === 0 ? (
          <div className="fu-empty-state">
            <ShoppingCart size={32} />
            <h3>No sales found</h3>
            <p>Record a sale or adjust your search and filters.</p>
            {!error && sales.length === 0 && (
              <button className="fu-button fu-button-primary" onClick={openModal}>
                <Plus size={16} />
                Record your first sale
              </button>
            )}
          </div>
        ) : (
          <div className="fu-table-scroll">
            <table className="fu-table">
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Customer</th>
                  <th>Channel</th>
                  <th>Items</th>
                  <th>Total</th>
                  <th>Payment</th>
                </tr>
              </thead>
              <tbody>
                {filteredSales.map((sale) => (
                  <tr key={sale._id}>
                    <td>
                      <div className="fu-task-title order-number">
                        {sale.orderNumber}
                      </div>
                      <div className="fu-task-description">
                        {formatDate(sale.orderDate)}
                      </div>
                    </td>
                    <td>{sale.customer?.name || "Direct / marketplace"}</td>
                    <td>{sale.channel}</td>
                    <td>
                      <div className="sale-items">
                        {sale.items.map((item) => (
                          <span key={item.sku}>
                            {item.quantity} × {item.name}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td>
                      <div className="fu-task-title">
                        {formatCurrency(sale.totalAmount)}
                      </div>
                      {sale.discount > 0 && (
                        <div className="fu-task-description">
                          {formatCurrency(sale.discount)} discount
                        </div>
                      )}
                    </td>
                    <td>
                      <select
                        className={`badge-select fu-badge ${
                          PAYMENT_BADGE[sale.paymentStatus]
                        }`}
                        value={sale.paymentStatus}
                        disabled={updatingId === sale._id}
                        onChange={(event) =>
                          changePaymentStatus(sale, event.target.value)
                        }
                        aria-label={`Payment status for ${sale.orderNumber}`}
                      >
                        {PAYMENT_STATUSES.map((status) => (
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
            className="fu-modal fu-modal-wide"
            role="dialog"
            aria-modal="true"
            aria-labelledby="sale-modal-title"
          >
            <div className="fu-modal-header">
              <div>
                <h2 id="sale-modal-title">Record Sale</h2>
                <p>Stock is deducted automatically when you save.</p>
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
                    <option value="">No customer (D2C / marketplace)</option>
                    {customers.map((customer) => (
                      <option key={customer._id} value={customer._id}>
                        {customer.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Channel *
                  <select
                    name="channel"
                    value={form.channel}
                    onChange={updateForm}
                    required
                  >
                    {CHANNELS.map((channel) => (
                      <option key={channel} value={channel}>
                        {channel}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="line-items">
                <div className="line-items-header">
                  <span>Product</span>
                  <span>Qty</span>
                  <span>Unit price (₹)</span>
                  <span>Line total</span>
                  <span />
                </div>

                {form.items.map((item, index) => {
                  const product = productById.get(item.product);
                  const lineTotal =
                    Number(item.unitPrice || 0) * Number(item.quantity || 0);

                  return (
                    <div className="line-item" key={index}>
                      <select
                        value={item.product}
                        onChange={(event) =>
                          updateItem(index, "product", event.target.value)
                        }
                        aria-label="Product"
                      >
                        <option value="">Select product</option>
                        {activeProducts.map((option) => (
                          <option
                            key={option._id}
                            value={option._id}
                            disabled={option.stock <= 0}
                          >
                            {option.name} ({option.stock} in stock)
                          </option>
                        ))}
                      </select>
                      <input
                        type="number"
                        min="1"
                        step="1"
                        max={product?.stock || undefined}
                        value={item.quantity}
                        onChange={(event) =>
                          updateItem(index, "quantity", event.target.value)
                        }
                        aria-label="Quantity"
                      />
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.unitPrice}
                        onChange={(event) =>
                          updateItem(index, "unitPrice", event.target.value)
                        }
                        aria-label="Unit price"
                      />
                      <span className="line-total">{formatCurrency(lineTotal)}</span>
                      <button
                        type="button"
                        className="fu-icon-button"
                        onClick={() => removeItem(index)}
                        disabled={form.items.length === 1}
                        aria-label="Remove line"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  );
                })}

                <button
                  type="button"
                  className="fu-button fu-button-secondary line-add"
                  onClick={addItem}
                >
                  <Plus size={15} />
                  Add another product
                </button>
              </div>

              <div className="fu-form-row">
                <label>
                  Order date
                  <input
                    type="date"
                    name="orderDate"
                    value={form.orderDate}
                    onChange={updateForm}
                    max={todayKey()}
                  />
                </label>
                <label>
                  Payment status
                  <select
                    name="paymentStatus"
                    value={form.paymentStatus}
                    onChange={updateForm}
                  >
                    {PAYMENT_STATUSES.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="fu-form-row">
                <label>
                  Discount (₹)
                  <input
                    type="number"
                    name="discount"
                    min="0"
                    step="0.01"
                    value={form.discount}
                    onChange={updateForm}
                    placeholder="0"
                  />
                </label>
                <div className="order-total">
                  <span>Subtotal {formatCurrency(formTotals.subtotal)}</span>
                  <strong>Total {formatCurrency(formTotals.total)}</strong>
                </div>
              </div>

              <label>
                Notes
                <textarea
                  name="notes"
                  value={form.notes}
                  onChange={updateForm}
                  rows={2}
                  placeholder="Invoice number, delivery notes..."
                />
              </label>

              {activeProducts.length === 0 && (
                <p className="fu-form-hint">
                  Add products in the Products page before recording a sale.
                </p>
              )}

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
                  disabled={saving || activeProducts.length === 0}
                >
                  {saving ? "Saving..." : "Save Sale"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
