const Sale = require("../models/Sale");
const Product = require("../models/Product");
const Customer = require("../models/Customer");
const { HttpError } = require("../utils/httpError");
const { assertInCompany, isValidId } = require("../utils/tenant");

const { PAYMENT_STATUSES } = Sale;

const populateSale = (query) =>
  query.populate("customer", "name type location");

// Newest first; createdAt breaks ties between orders on the same date
const getAllSales = (companyId) =>
  populateSale(Sale.find({ company: companyId }).sort({ orderDate: -1, createdAt: -1 }));

const generateOrderNumber = () => {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `SO-${date}-${suffix}`;
};

// Merge duplicate product lines and validate quantities
const normalizeItems = (items) => {
  if (!Array.isArray(items) || items.length === 0) {
    throw new HttpError(400, "Add at least one product to the sale");
  }

  const merged = new Map();

  for (const item of items) {
    const quantity = Number(item.quantity);

    if (!item.product || !isValidId(item.product)) {
      throw new HttpError(400, "Each line item needs a product");
    }
    if (!Number.isInteger(quantity) || quantity < 1) {
      throw new HttpError(400, "Quantity must be a whole number of at least 1");
    }

    const key = String(item.product);
    const existing = merged.get(key);

    merged.set(key, {
      product: key,
      quantity: (existing?.quantity || 0) + quantity,
      unitPrice:
        item.unitPrice !== undefined && item.unitPrice !== ""
          ? Number(item.unitPrice)
          : existing?.unitPrice,
    });
  }

  return [...merged.values()];
};

// Restore stock for items that were already deducted
const restoreStock = (deducted, companyId) =>
  Promise.all(
    deducted.map(({ product, quantity }) =>
      Product.updateOne({ _id: product, company: companyId }, { $inc: { stock: quantity } })
    )
  ).catch((error) => {
    console.error("Stock rollback failed:", error.message);
  });

const createSale = async (data, companyId) => {
  const { customer, channel, discount = 0, paymentStatus, orderDate, notes } =
    data;

  if (!channel) {
    throw new HttpError(400, "Sales channel is required");
  }

  await assertInCompany(Customer, customer, companyId, "Customer");

  const requested = normalizeItems(data.items);

  // Only this company's products can be sold
  const products = await Product.find({
    _id: { $in: requested.map((item) => item.product) },
    company: companyId,
  });
  const productById = new Map(products.map((p) => [String(p._id), p]));

  const items = requested.map((item) => {
    const product = productById.get(item.product);

    if (!product) throw new HttpError(400, "One of the products was not found");
    if (product.status !== "Active") {
      throw new HttpError(400, `${product.name} is discontinued`);
    }

    const unitPrice = item.unitPrice ?? product.price;
    if (Number.isNaN(unitPrice) || unitPrice < 0) {
      throw new HttpError(400, `Invalid price for ${product.name}`);
    }

    return {
      product: product._id,
      name: product.name,
      sku: product.sku,
      quantity: item.quantity,
      unitPrice,
      lineTotal: Math.round(unitPrice * item.quantity * 100) / 100,
    };
  });

  const subtotal = items.reduce((sum, item) => sum + item.lineTotal, 0);
  const discountAmount = Number(discount) || 0;

  if (discountAmount < 0 || discountAmount > subtotal) {
    throw new HttpError(400, "Discount must be between 0 and the subtotal");
  }

  // Deduct stock atomically per product; roll back if any line is short
  const deducted = [];

  for (const item of items) {
    const updated = await Product.findOneAndUpdate(
      { _id: item.product, company: companyId, stock: { $gte: item.quantity } },
      { $inc: { stock: -item.quantity } }
    );

    if (!updated) {
      await restoreStock(deducted, companyId);
      const current = productById.get(String(item.product));
      const latest = await Product.findOne({ _id: item.product, company: companyId }).select("stock");
      throw new HttpError(
        400,
        `Not enough stock for ${current.name} (available: ${
          latest?.stock ?? 0
        })`
      );
    }

    deducted.push({ product: item.product, quantity: item.quantity });
  }

  try {
    const sale = await Sale.create({
      company: companyId,
      orderNumber: generateOrderNumber(),
      customer: customer || null,
      channel,
      items,
      subtotal,
      discount: discountAmount,
      totalAmount: subtotal - discountAmount,
      paymentStatus,
      orderDate: orderDate || undefined,
      notes,
    });

    return sale.populate("customer", "name type location");
  } catch (error) {
    await restoreStock(deducted, companyId);
    throw error;
  }
};

const updatePaymentStatus = async (id, paymentStatus, companyId) => {
  if (!PAYMENT_STATUSES.includes(paymentStatus)) {
    throw new HttpError(400, "Invalid payment status");
  }

  const sale = await populateSale(
    Sale.findOneAndUpdate({ _id: id, company: companyId }, { paymentStatus }, { new: true })
  );

  if (!sale) throw new HttpError(404, "Sale not found");
  return sale;
};

module.exports = { getAllSales, createSale, updatePaymentStatus };
