import { Search, Plus, MoreHorizontal } from "lucide-react";
import { useState, useEffect } from "react";

function Customers() {
  const [customers, setCustomers] = useState([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("All Customers");
  const [showModal, setShowModal] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    type: "Retailer",
    location: "",
    contactPerson: "",
    phone: "",
    email: "",
    status: "Active",
  });

  // FETCH CUSTOMERS
  const fetchCustomers = async () => {
    try {
      const response = await fetch(
        "http://localhost:5000/api/customers"
      );

      const data = await response.json();

      setCustomers(data);
    } catch (error) {
      console.error("Failed to fetch customers:", error);
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, []);

  // HANDLE FORM INPUT
  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  // ADD CUSTOMER
  const handleAddCustomer = async (e) => {
    e.preventDefault();

    try {
      const response = await fetch(
        "http://localhost:5000/api/customers",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(formData),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "Failed to add customer"
        );
      }

      // Add new customer to the top of the table
      setCustomers((prev) => [data, ...prev]);

      // Reset form
      setFormData({
        name: "",
        type: "Retailer",
        location: "",
        contactPerson: "",
        phone: "",
        email: "",
        status: "Active",
      });

      // Close modal
      setShowModal(false);
    } catch (error) {
      console.error("Failed to add customer:", error);
      alert(error.message);
    }
  };

  // SEARCH + FILTER
  const filteredCustomers = customers.filter((customer) => {
    const matchesSearch =
      customer.name
        .toLowerCase()
        .includes(search.toLowerCase()) ||
      customer.location
        .toLowerCase()
        .includes(search.toLowerCase());

    let matchesFilter = true;

    if (filter === "Retailers") {
      matchesFilter = customer.type === "Retailer";
    }

    if (filter === "Distributors") {
      matchesFilter = customer.type === "Distributor";
    }

    if (filter === "Wholesalers") {
      matchesFilter = customer.type === "Wholesaler";
    }

    return matchesSearch && matchesFilter;
  });

  // CUSTOMER STATS
  const totalCustomers = customers.length;

  const activeCustomers = customers.filter(
    (customer) => customer.status === "Active"
  ).length;

  const atRiskCustomers = customers.filter(
    (customer) =>
      customer.status === "Follow-up" ||
      customer.status === "Inactive"
  ).length;

  return (
    <div className="customers-page">

      {/* HEADER */}
      <div className="page-header">
        <div>
          <h1>Customers</h1>
          <p>Manage and track your business relationships.</p>
        </div>

        <button
          className="primary-button"
          onClick={() => setShowModal(true)}
        >
          <Plus size={18} />
          Add Customer
        </button>
      </div>

      {/* CUSTOMER STATS */}
      <div className="customer-summary">
        <div>
          <span>Total Customers</span>
          <strong>{totalCustomers}</strong>
        </div>

        <div>
          <span>Active Customers</span>
          <strong>{activeCustomers}</strong>
        </div>

        <div>
          <span>At Risk</span>
          <strong>{atRiskCustomers}</strong>
        </div>
      </div>

      {/* TABLE CARD */}
      <div className="customers-card">

        {/* TOOLBAR */}
        <div className="customer-toolbar">

          <div className="search-box">
            <Search size={18} />

            <input
              placeholder="Search customers..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            <option>All Customers</option>
            <option>Retailers</option>
            <option>Distributors</option>
            <option>Wholesalers</option>
          </select>

        </div>

        {/* TABLE */}
        <div className="customer-table">

          <div className="table-header">
            <span>Customer</span>
            <span>Type</span>
            <span>Location</span>
            <span>Total Revenue</span>
            <span>Last Order</span>
            <span>Status</span>
            <span></span>
          </div>

          {filteredCustomers.length === 0 ? (
            <div className="empty-state">
              No customers found.
            </div>
          ) : (
            filteredCustomers.map((customer) => (
              <div
                className="table-row"
                key={customer._id}
              >

                <div className="customer-name">

                  <div className="customer-avatar">
                    {customer.name.charAt(0).toUpperCase()}
                  </div>

                  <strong>{customer.name}</strong>

                </div>

                <span>{customer.type}</span>

                <span>{customer.location}</span>

                <strong>
                  {customer.revenue || "—"}
                </strong>

                <span>
                  {customer.lastOrder || "—"}
                </span>

                <span
                  className={`status ${customer.status
                    .toLowerCase()
                    .replace("-", "")}`}
                >
                  {customer.status}
                </span>

                <button className="more-button">
                  <MoreHorizontal size={18} />
                </button>

              </div>
            ))
          )}

        </div>
      </div>

      {/* ADD CUSTOMER MODAL */}
      {showModal && (
        <div className="modal-overlay">

          <div className="modal">

            <div className="modal-header">
              <div>
                <h2>Add Customer</h2>
                <p>Add a new business relationship.</p>
              </div>

              <button
                className="modal-close"
                onClick={() => setShowModal(false)}
              >
                ×
              </button>
            </div>

            <form onSubmit={handleAddCustomer}>

              <div className="form-group">
                <label>Customer Name</label>

                <input
                  name="name"
                  placeholder="e.g. HealthKart Retail"
                  value={formData.name}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="form-row">

                <div className="form-group">
                  <label>Customer Type</label>

                  <select
                    name="type"
                    value={formData.type}
                    onChange={handleChange}
                  >
                    <option value="Retailer">
                      Retailer
                    </option>

                    <option value="Distributor">
                      Distributor
                    </option>

                    <option value="Wholesaler">
                      Wholesaler
                    </option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Location</label>

                  <input
                    name="location"
                    placeholder="e.g. Kolkata"
                    value={formData.location}
                    onChange={handleChange}
                    required
                  />
                </div>

              </div>

              <div className="form-group">
                <label>Contact Person</label>

                <input
                  name="contactPerson"
                  placeholder="e.g. Rahul Sharma"
                  value={formData.contactPerson}
                  onChange={handleChange}
                />
              </div>

              <div className="form-row">

                <div className="form-group">
                  <label>Phone</label>

                  <input
                    name="phone"
                    placeholder="Phone number"
                    value={formData.phone}
                    onChange={handleChange}
                  />
                </div>

                <div className="form-group">
                  <label>Email</label>

                  <input
                    name="email"
                    type="email"
                    placeholder="Email address"
                    value={formData.email}
                    onChange={handleChange}
                  />
                </div>

              </div>

              <div className="form-group">
                <label>Status</label>

                <select
                  name="status"
                  value={formData.status}
                  onChange={handleChange}
                >
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                  <option value="Follow-up">Follow-up</option>
                </select>
              </div>

              <div className="modal-actions">

                <button
                  type="button"
                  className="cancel-button"
                  onClick={() => setShowModal(false)}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="primary-button"
                >
                  Add Customer
                </button>

              </div>

            </form>

          </div>
        </div>
      )}

    </div>
  );
}

export default Customers;