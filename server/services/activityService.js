const Activity = require("../models/Activity");
const Customer = require("../models/Customer");
const followUpService = require("./followUpService");
const { HttpError } = require("../utils/httpError");
const { assertInCompany } = require("../utils/tenant");

const ACTIVITY_FIELDS = ["customer", "type", "subject", "notes", "status", "activityDate"];

const createActivity = async (data, companyId) => {
  const { createFollowUp = false, followUpDetails } = data;

  const activityData = Object.fromEntries(
    ACTIVITY_FIELDS.filter((field) => data[field] !== undefined).map((field) => [field, data[field]])
  );

  // The customer must belong to the same company
  await assertInCompany(Customer, activityData.customer, companyId, "Customer");

  if (createFollowUp && (!followUpDetails?.title?.trim() || !followUpDetails?.dueDate)) {
    throw new HttpError(400, "Follow-up title and due date are required");
  }

  let activity;

  try {
    // Save the activity
    activity = await Activity.create({ ...activityData, company: companyId });

    // Create a linked follow-up only when requested
    if (createFollowUp) {
      await followUpService.createFollowUp(
        {
          customer: activity.customer,
          activity: activity._id,
          title: followUpDetails.title.trim(),
          description: followUpDetails.description || "",
          dueDate: followUpDetails.dueDate,
          priority: followUpDetails.priority || "Medium",
          source: "Activity",
        },
        companyId
      );
    }

    return await activity.populate("customer", "name type location");
  } catch (error) {
    // Roll back the activity if the workflow fails
    if (activity?._id) {
      await Activity.deleteOne({ _id: activity._id, company: companyId }).catch((rollbackError) => {
        console.error("Activity rollback failed:", rollbackError.message);
      });
    }

    throw error;
  }
};

module.exports = { createActivity };
