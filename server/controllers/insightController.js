const insightService = require("../services/insightService");
const { sendError } = require("../utils/httpError");

const getInsights = async (req, res) => {
  try {
    const insights = await insightService.getInsights(req.companyId);
    return res.status(200).json({ success: true, data: insights });
  } catch (error) {
    return sendError(res, error, "Failed to generate insights");
  }
};

module.exports = { getInsights };
