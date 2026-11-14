
const Activity = require("../models/Activity");
const followUpService = require("./followUpService");

const createActivity = async (data) => {
  const {
    createFollowUp = false,
    followUpDetails,
    ...activityData
  } = data;

  let activity;

  try {
    // Save the activity
    activity = await Activity.create(activityData);

    // Create a linked follow-up only when requested
    if (createFollowUp) {
      if (
        !followUpDetails?.title?.trim() ||
        !followUpDetails?.dueDate
      ) {
        throw new Error(
          "Follow-up title and due date are required"
        );
      }

      await followUpService.createFollowUp({
        customer: activity.customer,
        activity: activity._id,
        title: followUpDetails.title.trim(),
        description: followUpDetails.description || "",
        dueDate: followUpDetails.dueDate,
        priority: followUpDetails.priority || "Medium",
        source: "Activity",
      });
    }

    return await activity.populate(
      "customer",
      "name type location"
    );
  } catch (error) {
    // Roll back the activity if the workflow fails
    if (activity?._id) {
      await Activity.deleteOne({ _id: activity._id }).catch(
        (rollbackError) => {
          console.error(
            "Activity rollback failed:",
            rollbackError.message
          );
        }
      );
    }

    throw error;
  }
};

module.exports = { createActivity };
