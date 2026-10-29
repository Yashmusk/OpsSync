
const FollowUp = require("../models/FollowUp");
const Customer = require("../models/Customer");

const getAllFollowUps = async () => {
  return FollowUp.find()
    .populate("customer", "name type location")
    .populate("activity", "type subject activityDate")
    .sort({ dueDate: 1 });
};

const createFollowUp = async (data) => {
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
    throw new Error("Customer, title, and due date are required");
  }

  const validCustomer = await Customer.findById(customer);

  if (!validCustomer) {
    throw new Error("Customer not found");
  }

  const followUp = await FollowUp.create({
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
