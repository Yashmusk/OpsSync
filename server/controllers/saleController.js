const saleService = require("../services/saleService");
const { sendError } = require("../utils/httpError");

const getSales = async (req, res) => {
  try {
    const sales = await saleService.getAllSales(req.companyId);
    return res.status(200).json({ success: true, count: sales.length, data: sales });
  } catch (error) {
    return sendError(res, error, "Failed to fetch sales");
  }
};

const createSale = async (req, res) => {
  try {
    const sale = await saleService.createSale(req.body || {}, req.companyId);
    return res.status(201).json({ success: true, data: sale });
  } catch (error) {
    return sendError(res, error, "Failed to create sale");
  }
};

const updateSale = async (req, res) => {
  try {
    const sale = await saleService.updatePaymentStatus(
      req.params.id,
      req.body?.paymentStatus,
      req.companyId
    );
    return res.status(200).json({ success: true, data: sale });
  } catch (error) {
    return sendError(res, error, "Failed to update sale");
  }
};

module.exports = { getSales, createSale, updateSale };
