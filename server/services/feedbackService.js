const Feedback = require("../models/Feedback");
const Customer = require("../models/Customer");
const Product = require("../models/Product");
const { HttpError } = require("../utils/httpError");
const { assertInCompany } = require("../utils/tenant");

const { FEEDBACK_STATUSES } = Feedback;

const getSentiment = (rating) => {
  if (rating >= 4) return "Positive";
  if (rating === 3) return "Neutral";
  return "Negative";
};

const populateFeedback = (query) =>
  query
    .populate("customer", "name type location")
    .populate("product", "name sku");

const getAllFeedback = (companyId) =>
  populateFeedback(Feedback.find({ company: companyId }).sort({ createdAt: -1 }));

const createFeedback = async (data, companyId) => {
  const { customer, product, source, category, comment } = data;
  const rating = Number(data.rating);

  if (!category || !comment?.trim()) {
    throw new HttpError(400, "Category and comment are required");
  }
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    throw new HttpError(400, "Rating must be a whole number from 1 to 5");
  }

  // Linked customer / product must belong to the same company
  await assertInCompany(Customer, customer, companyId, "Customer");
  await assertInCompany(Product, product, companyId, "Product");

  const feedback = await Feedback.create({
    company: companyId,
    customer: customer || null,
    product: product || null,
    source,
    category,
    rating,
    sentiment: getSentiment(rating),
    comment: comment.trim(),
  });

  return feedback.populate([
    { path: "customer", select: "name type location" },
    { path: "product", select: "name sku" },
  ]);
};

const updateFeedbackStatus = async (id, status, companyId) => {
  if (!FEEDBACK_STATUSES.includes(status)) {
    throw new HttpError(400, "Invalid feedback status");
  }

  const feedback = await populateFeedback(
    Feedback.findOneAndUpdate(
      { _id: id, company: companyId },
      { status, resolvedAt: status === "Resolved" ? new Date() : null },
      { new: true }
    )
  );

  if (!feedback) throw new HttpError(404, "Feedback not found");
  return feedback;
};

module.exports = { getAllFeedback, createFeedback, updateFeedbackStatus };
