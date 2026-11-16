const Activity = require("../models/Activity");
const activityService = require("../services/activityService");

// GET all activities for the logged-in company
const getActivities = async (req, res) => {
  try {
    const activities = await Activity.find({ company: req.companyId })
      .populate("customer", "name type location")
      .sort({ activityDate: -1 });

    res.status(200).json(activities);
  } catch (error) {
    console.error("Failed to fetch activities:", error);
    res.status(500).json({
      message: "Failed to fetch activities",
    });
  }
};

// CREATE activity
const createActivity = async (req, res) => {
  try {
    const activity = await activityService.createActivity(req.body || {}, req.companyId);

    return res.status(201).json(activity);
  } catch (error) {
    console.error("Create activity error:", error.message);

    const isClientError =
      error.statusCode === 400 || error.name === "ValidationError" || error.name === "CastError";

    return res.status(isClientError ? 400 : 500).json({
      message: isClientError ? error.message : "Failed to create activity",
    });
  }
};

module.exports = {
  getActivities,
  createActivity,
};
