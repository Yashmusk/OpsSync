const mongoose = require("mongoose");
const { companyField } = require("../utils/tenant");

const FEEDBACK_SOURCES = [
  "Sales Visit",
  "Phone",
  "WhatsApp",
  "Email",
  "Marketplace Review",
  "Website",
  "Social Media",
  "Other",
];

const FEEDBACK_CATEGORIES = [
  "Taste",
  "Quality",
  "Packaging",
  "Delivery",
  "Pricing",
  "Service",
  "Other",
];

const FEEDBACK_STATUSES = ["Open", "In Progress", "Resolved"];

const feedbackSchema = new mongoose.Schema(
  {
    company: companyField,

    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
      default: null,
    },

    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      default: null,
    },

    source: {
      type: String,
      enum: FEEDBACK_SOURCES,
      default: "Sales Visit",
    },

    category: {
      type: String,
      enum: FEEDBACK_CATEGORIES,
      required: true,
    },

    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
    },

    // Derived from rating by the service: 4-5 positive, 3 neutral, 1-2 negative
    sentiment: {
      type: String,
      enum: ["Positive", "Neutral", "Negative"],
      required: true,
    },

    comment: {
      type: String,
      required: true,
      trim: true,
    },

    status: {
      type: String,
      enum: FEEDBACK_STATUSES,
      default: "Open",
    },

    resolvedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Feedback", feedbackSchema);
module.exports.FEEDBACK_STATUSES = FEEDBACK_STATUSES;
