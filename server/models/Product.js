const mongoose = require("mongoose");
const { companyField } = require("../utils/tenant");

const productSchema = new mongoose.Schema(
  {
    company: companyField,

    name: {
      type: String,
      required: true,
      trim: true,
    },

    sku: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },

    category: {
      type: String,
      trim: true,
      default: "General",
    },

    price: {
      type: Number,
      required: true,
      min: 0,
    },

    stock: {
      type: Number,
      default: 0,
      min: 0,
    },

    lowStockThreshold: {
      type: Number,
      default: 10,
      min: 0,
    },

    status: {
      type: String,
      enum: ["Active", "Discontinued"],
      default: "Active",
    },
  },
  { timestamps: true }
);

// SKUs only need to be unique within a company
productSchema.index({ company: 1, sku: 1 }, { unique: true });

module.exports = mongoose.model("Product", productSchema);
