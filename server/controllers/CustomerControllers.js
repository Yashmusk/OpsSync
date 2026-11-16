const Customer = require("../models/Customer");

const EDITABLE_FIELDS = ["name", "type", "location", "contactPerson", "phone", "email", "status"];

const pickEditable = (data = {}) =>
  Object.fromEntries(
    EDITABLE_FIELDS.filter((field) => data[field] !== undefined).map((field) => [field, data[field]])
  );

// GET /api/customers
const getCustomers = async (req, res) => {
  try {
    const customers = await Customer.find({ company: req.companyId }).sort({ createdAt: -1 });

    res.status(200).json(customers);
  } catch (error) {
    console.error("Failed to fetch customers:", error);
    res.status(500).json({
      message: "Failed to fetch customers",
    });
  }
};

// POST /api/customers
const createCustomer = async (req, res) => {
  try {
    // The company always comes from the logged-in user, never the request body
    const customer = await Customer.create({
      ...pickEditable(req.body),
      company: req.companyId,
    });
    res.status(201).json(customer);
  } catch (error) {
    res.status(400).json({
      message: "Failed to create customer",
      error: error.message,
    });
  }
};

module.exports = {
  getCustomers,
  createCustomer,
};
