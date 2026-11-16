const feedbackService = require("../services/feedbackService");
const { sendError } = require("../utils/httpError");

const getFeedback = async (req, res) => {
  try {
    const feedback = await feedbackService.getAllFeedback(req.companyId);
    return res
      .status(200)
      .json({ success: true, count: feedback.length, data: feedback });
  } catch (error) {
    return sendError(res, error, "Failed to fetch feedback");
  }
};

const createFeedback = async (req, res) => {
  try {
    const feedback = await feedbackService.createFeedback(req.body || {}, req.companyId);
    return res.status(201).json({ success: true, data: feedback });
  } catch (error) {
    return sendError(res, error, "Failed to create feedback");
  }
};

const updateFeedback = async (req, res) => {
  try {
    const feedback = await feedbackService.updateFeedbackStatus(
      req.params.id,
      req.body?.status,
      req.companyId
    );
    return res.status(200).json({ success: true, data: feedback });
  } catch (error) {
    return sendError(res, error, "Failed to update feedback");
  }
};

module.exports = { getFeedback, createFeedback, updateFeedback };
