const Product = require("../models/Product");
const { HttpError } = require("../utils/httpError");

const EDITABLE_FIELDS = [
  "name",
  "sku",
  "category",
  "price",
  "stock",
  "lowStockThreshold",
  "status",
];

const pickEditable = (data) =>
  Object.fromEntries(
    EDITABLE_FIELDS.filter((field) => data[field] !== undefined).map(
      (field) => [field, data[field]]
    )
  );

const getAllProducts = (companyId) => Product.find({ company: companyId }).sort({ name: 1 });

const createProduct = (data, companyId) => {
  if (!data.name?.trim() || !data.sku?.trim() || data.price === undefined) {
    throw new HttpError(400, "Name, SKU, and price are required");
  }

  return Product.create({ ...pickEditable(data), company: companyId });
};

const updateProduct = async (id, data, companyId) => {
  // Matching on company too means another company's product id is simply "not found"
  const product = await Product.findOneAndUpdate(
    { _id: id, company: companyId },
    pickEditable(data),
    { new: true, runValidators: true }
  );

  if (!product) {
    throw new HttpError(404, "Product not found");
  }

  return product;
};

module.exports = { getAllProducts, createProduct, updateProduct };
