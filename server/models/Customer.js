const mongoose = require("mongoose");
const { companyField } = require("../utils/tenant");

const customerSchema = new mongoose.Schema(
  {
    company: companyField,

    name: {
      type: String,
      required: true,
      trim: true,
    },

    type: {
      type: String,
      enum: ["Retailer", "Distributor", "Wholesaler"],
      required: true,
    },

    location: {
      type: String,
      required: true,
    },

    contactPerson: {
      type: String,
    },

    phone: {
      type: String,
    },

    email: {
      type: String,
    },

    status: {
      type: String,
      enum: ["Active", "Inactive", "Follow-up"],
      default: "Active",
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Customer", customerSchema);