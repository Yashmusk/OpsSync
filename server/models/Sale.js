const mongoose = require("mongoose");
const { companyField } = require("../utils/tenant");

const SALE_CHANNELS = [
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

const saleItemSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    // Snapshot of product details at the time of sale
    name: { type: String, required: true },
    sku: { type: String, required: true },
    quantity: { type: Number, required: true, min: 1 },
    unitPrice: { type: Number, required: true, min: 0 },
    lineTotal: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const saleSchema = new mongoose.Schema(
  {
    company: companyField,

    orderNumber: {
      type: String,
      required: true,
    },

    // Optional: marketplace / D2C orders may not map to a B2B customer
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
      default: null,
    },

    channel: {
      type: String,
      enum: SALE_CHANNELS,
      required: true,
    },

    items: {
      type: [saleItemSchema],
      validate: [(items) => items.length > 0, "At least one item is required"],
    },

    subtotal: { type: Number, required: true, min: 0 },
    discount: { type: Number, default: 0, min: 0 },
    totalAmount: { type: Number, required: true, min: 0 },

    paymentStatus: {
      type: String,
      enum: PAYMENT_STATUSES,
      default: "Pending",
    },

    orderDate: {
      type: Date,
      default: Date.now,
    },

    notes: {
      type: String,
      trim: true,
      default: "",
    },
  },
  { timestamps: true }
);

// Order numbers are unique within a company; reports filter by company + date
saleSchema.index({ company: 1, orderNumber: 1 }, { unique: true });
saleSchema.index({ company: 1, orderDate: -1 });

module.exports = mongoose.model("Sale", saleSchema);
module.exports.SALE_CHANNELS = SALE_CHANNELS;
module.exports.PAYMENT_STATUSES = PAYMENT_STATUSES;
