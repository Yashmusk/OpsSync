const Activity = require("../models/Activity");
const activityService = require("../services/activityService");
// GET all activities
const getActivities = async (req, res) => {
  try {
    const activities = await Activity.find()
      .populate("customer", "name type location")
      .sort({ activityDate: -1 });

    res.status(200).json(activities);
  } catch (error) {
    res.status(500).json({
      message: "Failed to fetch activities",
      error: error.message,
    });
  }
};

// CREATE activity

const createActivity = async (req, res) => {
  try {
    const activity = await activityService.createActivity(req.body);

    return res.status(201).json(activity);
  } catch (error) {
    console.error("Create activity error:", error.message);

    const clientErrors = [
      "Follow-up title and due date are required",
      "Customer, title, and due date are required",
      "Customer not found",
    ];

    const statusCode = clientErrors.includes(error.message)
      ? 400
      : 500;

    return res.status(statusCode).json({
      message: error.message,
    });
  }
};


module.exports = {
  getActivities,
  createActivity,
};