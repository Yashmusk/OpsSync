const productService = require("../services/productService");
const { sendError } = require("../utils/httpError");

const getProducts = async (req, res) => {
  try {
    const products = await productService.getAllProducts(req.companyId);
    return res
      .status(200)
      .json({ success: true, count: products.length, data: products });
  } catch (error) {
    return sendError(res, error, "Failed to fetch products");
  }
};

const createProduct = async (req, res) => {
  try {
    const product = await productService.createProduct(req.body || {}, req.companyId);
    return res.status(201).json({ success: true, data: product });
  } catch (error) {
    return sendError(res, error, "Failed to create product");
  }
};

const updateProduct = async (req, res) => {
  try {
    const product = await productService.updateProduct(
      req.params.id,
      req.body || {},
      req.companyId
    );
    return res.status(200).json({ success: true, data: product });
  } catch (error) {
    return sendError(res, error, "Failed to update product");
  }
};

module.exports = { getProducts, createProduct, updateProduct };
