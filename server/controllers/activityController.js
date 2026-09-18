const Activity = require("../models/Activity");

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
    const activity = await Activity.create(req.body);

    const populatedActivity = await activity.populate(
      "customer",
      "name type location"
    );

    res.status(201).json(populatedActivity);
  } catch (error) {
    res.status(400).json({
      message: "Failed to create activity",
      error: error.message,
    });
  }
};

module.exports = {
  getActivities,
  createActivity,
};