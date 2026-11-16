import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  AlertTriangle,
  IndianRupee,
  Package,
  PackageCheck,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  X,
} from "lucide-react";
import { apiRequest, formatCurrency } from "../api";
import { usePermissions } from "../auth/useAuth";

const initialForm = {
  name: "",
  sku: "",
  category: "",
  price: "",
  stock: "",
  lowStockThreshold: "10",
  status: "Active",
};

function getStockLevel(product) {
  if (product.stock <= 0) return "Out of stock";
  if (product.stock <= product.lowStockThreshold) return "Low stock";
  return "In stock";
}

const STOCK_BADGE = {
  "Out of stock": "fu-status-overdue",
  "Low stock": "fu-priority-medium",
  "In stock": "fu-status-completed",
};

export default function Products() {
  // Members can view the catalogue; Owners and Admins manage it
  const { canManageProducts } = usePermissions();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [stockFilter, setStockFilter] = useState("All");
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(initialForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true; // ignore responses that arrive after a newer request

    apiRequest("/products")
      .then((data) => {
        if (!active) return;
        setProducts(data);
        setError("");
      })
      .catch((err) => {
        if (active) setError(err.message || "Could not load products.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [reloadKey]);

  const fetchProducts = () => {
    setLoading(true);
    setError("");
    setReloadKey((key) => key + 1);
  };

  const categories = useMemo(
    () => [...new Set(products.map((p) => p.category).filter(Boolean))].sort(),
    [products]
  );

  const stats = useMemo(() => {
    const active = products.filter((p) => p.status === "Active");

    return {
      total: products.length,
      active: active.length,
      lowStock: active.filter((p) => getStockLevel(p) !== "In stock").length,
      inventoryValue: products.reduce(
        (sum, p) => sum + (p.price || 0) * (p.stock || 0),
        0
      ),
    };
  }, [products]);

  const filteredProducts = useMemo(() => {
    const term = search.trim().toLowerCase();

    return products.filter((product) => {
      const matchesSearch = [product.name, product.sku, product.category].some(
        (value) => String(value || "").toLowerCase().includes(term)
      );
      const matchesCategory =
        categoryFilter === "All" || product.category === categoryFilter;
      const matchesStock =
        stockFilter === "All" || getStockLevel(product) === stockFilter;

      return matchesSearch && matchesCategory && matchesStock;
    });
  }, [products, search, categoryFilter, stockFilter]);

  const openCreate = () => {
    setEditingId(null);
    setForm(initialForm);
    setFormError("");
    setShowModal(true);
  };

  const openEdit = (product) => {
    setEditingId(product._id);
    setForm({
      name: product.name,
      sku: product.sku,
      category: product.category || "",
      price: String(product.price ?? ""),
      stock: String(product.stock ?? ""),
      lowStockThreshold: String(product.lowStockThreshold ?? "10"),
      status: product.status || "Active",
    });
    setFormError("");
    setShowModal(true);
  };

  const updateForm = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  };

  const handleSave = async (event) => {
    event.preventDefault();
    setFormError("");

    if (!form.name.trim() || !form.sku.trim() || form.price === "") {
      setFormError("Product name, SKU, and price are required.");
      return;
    }

    setSaving(true);

    try {
      const body = {
        name: form.name.trim(),
        sku: form.sku.trim(),
        category: form.category.trim() || "General",
        price: Number(form.price),
        stock: Number(form.stock || 0),
        lowStockThreshold: Number(form.lowStockThreshold || 0),
        status: form.status,
      };

      await apiRequest(editingId ? `/products/${editingId}` : "/products", {
        method: editingId ? "PATCH" : "POST",
        body,
      });

      setShowModal(false);
      fetchProducts();
    } catch (err) {
      setFormError(err.message || "Failed to save product.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="module-page">
      <div className="module-header">
        <div>
          <h1>Products</h1>
          <p>Your catalogue, pricing, and stock levels in one place.</p>
        </div>

        <div className="module-header-actions">
          <button
            className="fu-button fu-button-secondary"
            onClick={fetchProducts}
            disabled={loading}
          >
            <RefreshCw size={16} />
            Refresh
          </button>
          {canManageProducts && (
            <button className="fu-button fu-button-primary" onClick={openCreate}>
              <Plus size={17} />
              Add Product
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="fu-message fu-error">
          <AlertCircle size={18} />
          <span>{error}</span>
          <button onClick={fetchProducts}>Try again</button>
        </div>
      )}

      <div className="fu-stats-grid">
        <div className="fu-stat-card">
          <span className="fu-stat-icon"><Package size={19} /></span>
          <p>Total Products</p>
          <h2>{stats.total}</h2>
        </div>
        <div className="fu-stat-card">
          <span className="fu-stat-icon"><PackageCheck size={19} /></span>
          <p>Active</p>
          <h2>{stats.active}</h2>
        </div>
        <div className="fu-stat-card">
          <span className="fu-stat-icon"><AlertTriangle size={19} /></span>
          <p>Low / Out of Stock</p>
          <h2>{stats.lowStock}</h2>
        </div>
        <div className="fu-stat-card">
          <span className="fu-stat-icon"><IndianRupee size={19} /></span>
          <p>Inventory Value</p>
          <h2>{formatCurrency(stats.inventoryValue)}</h2>
        </div>
      </div>

      <div className="fu-toolbar">
        <div className="fu-search">
          <Search size={18} />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by name, SKU, or category..."
          />
        </div>

        <select
          value={categoryFilter}
          onChange={(event) => setCategoryFilter(event.target.value)}
          aria-label="Filter by category"
        >
          <option value="All">All categories</option>
          {categories.map((category) => (
            <option key={category} value={category}>
              {category}
            </option>
          ))}
        </select>

        <select
          value={stockFilter}
          onChange={(event) => setStockFilter(event.target.value)}
          aria-label="Filter by stock level"
        >
          <option value="All">All stock levels</option>
          <option value="In stock">In stock</option>
          <option value="Low stock">Low stock</option>
          <option value="Out of stock">Out of stock</option>
        </select>
      </div>

      <div className="fu-table-wrapper">
        {loading ? (
          <div className="fu-empty-state">Loading products...</div>
        ) : filteredProducts.length === 0 ? (
          <div className="fu-empty-state">
            <Package size={32} />
            <h3>No products found</h3>
            <p>
              {canManageProducts
                ? "Add your first product or adjust your search and filters."
                : "Your admin hasn't added products yet, or no product matches your filters."}
            </p>
            {canManageProducts && !error && products.length === 0 && (
              <button className="fu-button fu-button-primary" onClick={openCreate}>
                <Plus size={16} />
                Add your first product
              </button>
            )}
          </div>
        ) : (
          <div className="fu-table-scroll">
            <table className="fu-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Category</th>
                  <th>Price</th>
                  <th>Stock</th>
                  <th>Status</th>
                  <th aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {filteredProducts.map((product) => {
                  const stockLevel = getStockLevel(product);

                  return (
                    <tr key={product._id}>
                      <td>
                        <div className="fu-task-title">{product.name}</div>
                        <div className="fu-task-description">{product.sku}</div>
                      </td>
                      <td>{product.category || "General"}</td>
                      <td>{formatCurrency(product.price)}</td>
                      <td>
                        <div className="stock-cell">
                          <strong>{product.stock}</strong>
                          <span className={`fu-badge ${STOCK_BADGE[stockLevel]}`}>
                            {stockLevel}
                          </span>
                        </div>
                      </td>
                      <td>
                        <span
                          className={`fu-badge ${
                            product.status === "Active"
                              ? "fu-status-completed"
                              : "fu-status-cancelled"
                          }`}
                        >
                          {product.status}
                        </span>
                      </td>
                      <td className="table-actions">
                        {canManageProducts && (
                          <button
                            className="fu-icon-button"
                            onClick={() => openEdit(product)}
                            aria-label={`Edit ${product.name}`}
                          >
                            <Pencil size={16} />
                          </button>
                        )}
                      </td>
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
            aria-labelledby="product-modal-title"
          >
            <div className="fu-modal-header">
              <div>
                <h2 id="product-modal-title">
                  {editingId ? "Edit Product" : "Add Product"}
                </h2>
                <p>
                  {editingId
                    ? "Update pricing, stock, or status."
                    : "Add an item to your catalogue."}
                </p>
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

            <form onSubmit={handleSave} className="fu-form">
              <label>
                Product name *
                <input
                  name="name"
                  value={form.name}
                  onChange={updateForm}
                  placeholder="e.g. Whey Protein 1kg Chocolate"
                  required
                  maxLength={200}
                />
              </label>

              <div className="fu-form-row">
                <label>
                  SKU *
                  <input
                    name="sku"
                    value={form.sku}
                    onChange={updateForm}
                    placeholder="e.g. WP-1KG-CHOC"
                    required
                  />
                </label>
                <label>
                  Category
                  <input
                    name="category"
                    value={form.category}
                    onChange={updateForm}
                    placeholder="e.g. Protein"
                    list="product-categories"
                  />
                  <datalist id="product-categories">
                    {categories.map((category) => (
                      <option key={category} value={category} />
                    ))}
                  </datalist>
                </label>
              </div>

              <div className="fu-form-row">
                <label>
                  Price (₹) *
                  <input
                    type="number"
                    name="price"
                    value={form.price}
                    onChange={updateForm}
                    min="0"
                    step="0.01"
                    required
                  />
                </label>
                <label>
                  Stock on hand
                  <input
                    type="number"
                    name="stock"
                    value={form.stock}
                    onChange={updateForm}
                    min="0"
                    step="1"
                  />
                </label>
              </div>

              <div className="fu-form-row">
                <label>
                  Low-stock alert at
                  <input
                    type="number"
                    name="lowStockThreshold"
                    value={form.lowStockThreshold}
                    onChange={updateForm}
                    min="0"
                    step="1"
                  />
                </label>
                <label>
                  Status
                  <select name="status" value={form.status} onChange={updateForm}>
                    <option value="Active">Active</option>
                    <option value="Discontinued">Discontinued</option>
                  </select>
                </label>
              </div>

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
                  {saving ? "Saving..." : editingId ? "Save Changes" : "Save Product"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
