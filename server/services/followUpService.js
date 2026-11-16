const FollowUp = require("../models/FollowUp");
const Customer = require("../models/Customer");
const Activity = require("../models/Activity");
const { HttpError } = require("../utils/httpError");
const { assertInCompany } = require("../utils/tenant");

const getAllFollowUps = async (companyId) => {
  return FollowUp.find({ company: companyId })
    .populate("customer", "name type location")
    .populate("activity", "type subject activityDate")
    .sort({ dueDate: 1 });
};

const createFollowUp = async (data, companyId) => {
  const {
    customer,
    activity = null,
    title,
    description = "",
    dueDate,
    priority = "Medium",
    source = "Manual",
  } = data;

  if (!customer || !title || !dueDate) {
    throw new HttpError(400, "Customer, title, and due date are required");
  }

  // Both references must belong to the same company
  await assertInCompany(Customer, customer, companyId, "Customer");
  await assertInCompany(Activity, activity, companyId, "Activity");

  const followUp = await FollowUp.create({
    company: companyId,
    customer,
    activity,
    title,
    description,
    dueDate,
    priority,
    source,
  });

  return followUp
    .populate("customer", "name type location")
    .then((populatedFollowUp) =>
      populatedFollowUp.populate("activity", "type subject activityDate")
    );
};

module.exports = {
  getAllFollowUps,
  createFollowUp,
};
