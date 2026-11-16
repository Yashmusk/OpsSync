const mongoose = require("mongoose");
const { HttpError } = require("./httpError");

// Schema field every tenant-owned model includes
const companyField = {
  type: mongoose.Schema.Types.ObjectId,
  ref: "Company",
  required: true,
  index: true,
  immutable: true, // a record can never be moved to another company
};

const isValidId = (id) => mongoose.isValidObjectId(id);

const toObjectId = (id) => new mongoose.Types.ObjectId(String(id));

// Ensure a referenced record exists *in the same company*; throws 400 otherwise.
// Using this on every reference stops IDs from another company being linked in.
const assertInCompany = async (Model, id, companyId, label) => {
  if (!id) return;
  if (!isValidId(id) || !(await Model.exists({ _id: id, company: companyId }))) {
    throw new HttpError(400, `${label} not found`);
  }
};

module.exports = { companyField, isValidId, toObjectId, assertInCompany };
