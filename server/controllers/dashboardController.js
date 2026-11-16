const dashboardService = require("../services/dashboardService");
const { sendError } = require("../utils/httpError");

const getSummary = async (req, res) => {
  try {
    const summary = await dashboardService.getSummary(Number(req.query.days), req.companyId);
    return res.status(200).json({ success: true, data: summary });
  } catch (error) {
    return sendError(res, error, "Failed to load dashboard");
  }
};

module.exports = { getSummary };
