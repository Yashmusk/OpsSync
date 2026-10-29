
const followUpService = require("../services/followUpService");

const getAllFollowUps = async (req, res) => {
  try {
    const followUps = await followUpService.getAllFollowUps();

    return res.status(200).json({
      success: true,
      count: followUps.length,
      data: followUps,
    });
  } catch (error) {
    console.error("Get follow-ups error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch follow-ups",
    });
  }
};

const createFollowUp = async (req, res) => {
  try {
    const followUp = await followUpService.createFollowUp(req.body);

    return res.status(201).json({
      success: true,
      message: "Follow-up created successfully",
      data: followUp,
    });
  } catch (error) {
    console.error("Create follow-up error:", error.message);

    const isClientError = [
      "Customer, title, and due date are required",
      "Customer not found",
    ].includes(error.message);

    return res.status(isClientError ? 400 : 500).json({
      success: false,
      message: isClientError
        ? error.message
        : "Failed to create follow-up",
    });
  }
};

module.exports = {
  getAllFollowUps,
  createFollowUp,
};
