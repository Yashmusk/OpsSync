const followUpService = require("../services/followUpService");
const { sendError } = require("../utils/httpError");

const getAllFollowUps = async (req, res) => {
  try {
    const followUps = await followUpService.getAllFollowUps(req.companyId);

    return res.status(200).json({
      success: true,
      count: followUps.length,
      data: followUps,
    });
  } catch (error) {
    return sendError(res, error, "Failed to fetch follow-ups");
  }
};

const createFollowUp = async (req, res) => {
  try {
    const followUp = await followUpService.createFollowUp(req.body || {}, req.companyId);

    return res.status(201).json({
      success: true,
      message: "Follow-up created successfully",
      data: followUp,
    });
  } catch (error) {
    return sendError(res, error, "Failed to create follow-up");
  }
};

module.exports = {
  getAllFollowUps,
  createFollowUp,
};
