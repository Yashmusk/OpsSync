// Read-only data tools the AI assistant can call.
// Every number the assistant reports comes from these MongoDB queries,
// never from the model's own arithmetic. None of these tools write data.

const mongoose = require("mongoose");
const Activity = require("../../models/Activity");
const Customer = require("../../models/Customer");
const Feedback = require("../../models/Feedback");
const FollowUp = require("../../models/FollowUp");
const Product = require("../../models/Product");
const Sale = require("../../models/Sale");
const {
  TIMEZONE,
  toDayKey,
  isDayKey,
  startOfDay,
  endOfDay,
} = require("../../utils/dates");
const { toObjectId } = require("../../utils/tenant");

const MAX_ROWS = 25;

const round = (value) => Math.round((value || 0) * 100) / 100;

const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const clampLimit = (value, fallback = 10) => {
  const limit = Number.parseInt(value, 10);
  if (Number.isNaN(limit) || limit < 1) return fallback;
  return Math.min(limit, MAX_ROWS);
};

// Resolve a date range; defaults to the current month to date
const resolveRange = (args = {}) => {
  const today = toDayKey(new Date());
  const startKey = isDayKey(args.start_date) ? args.start_date : `${today.slice(0, 8)}01`;
  const endKey = isDayKey(args.end_date) ? args.end_date : today;

  if (startKey > endKey) {
    throw new Error("start_date must be on or before end_date");
  }

  return {
    startKey,
    endKey,
    start: startOfDay(startKey),
    end: endOfDay(endKey),
  };
};

const pick = (value, allowed) => (allowed.includes(value) ? value : undefined);

/* ---------------------------------------------------------------- */
/* Tool implementations                                              */
/* ---------------------------------------------------------------- */

const SALES_GROUPS = ["none", "channel", "product", "customer", "day", "month", "payment_status"];

async function getSalesSummary(args, company) {
  const range = resolveRange(args);
  const groupBy = pick(args.group_by, SALES_GROUPS) || "none";
  const match = { company, orderDate: { $gte: range.start, $lte: range.end } };

  const [totalsRow] = await Sale.aggregate([
    { $match: match },
    {
      $group: {
        _id: null,
        revenue: { $sum: "$totalAmount" },
        grossBeforeDiscount: { $sum: "$subtotal" },
        discounts: { $sum: "$discount" },
        orders: { $sum: 1 },
        paidAmount: {
          $sum: { $cond: [{ $eq: ["$paymentStatus", "Paid"] }, "$totalAmount", 0] },
        },
        unpaidAmount: {
          $sum: { $cond: [{ $ne: ["$paymentStatus", "Paid"] }, "$totalAmount", 0] },
        },
      },
    },
  ]);

  const [unitsRow] = await Sale.aggregate([
    { $match: match },
    { $unwind: "$items" },
    { $group: { _id: null, units: { $sum: "$items.quantity" } } },
  ]);

  const totals = {
    revenue: round(totalsRow?.revenue),
    orders: totalsRow?.orders || 0,
    units_sold: unitsRow?.units || 0,
    average_order_value: totalsRow?.orders ? round(totalsRow.revenue / totalsRow.orders) : 0,
    discounts_given: round(totalsRow?.discounts),
    paid_amount: round(totalsRow?.paidAmount),
    unpaid_amount: round(totalsRow?.unpaidAmount),
  };

  let groups;

  if (groupBy === "product") {
    groups = await Sale.aggregate([
      { $match: match },
      { $unwind: "$items" },
      {
        $group: {
          _id: "$items.product",
          name: { $last: "$items.name" },
          units: { $sum: "$items.quantity" },
          revenue_before_discounts: { $sum: "$items.lineTotal" },
        },
      },
      { $sort: { revenue_before_discounts: -1 } },
      { $limit: MAX_ROWS },
      { $project: { _id: 0, name: 1, units: 1, revenue_before_discounts: 1 } },
    ]);
  } else if (groupBy !== "none") {
    const keyExpr = {
      channel: "$channel",
      customer: "$customer",
      payment_status: "$paymentStatus",
      day: { $dateToString: { format: "%Y-%m-%d", date: "$orderDate", timezone: TIMEZONE } },
      month: { $dateToString: { format: "%Y-%m", date: "$orderDate", timezone: TIMEZONE } },
    }[groupBy];

    const isTimeGroup = groupBy === "day" || groupBy === "month";

    groups = await Sale.aggregate([
      { $match: match },
      { $group: { _id: keyExpr, revenue: { $sum: "$totalAmount" }, orders: { $sum: 1 } } },
      { $sort: isTimeGroup ? { _id: 1 } : { revenue: -1 } },
      { $limit: isTimeGroup ? 400 : MAX_ROWS },
    ]);

    if (groupBy === "customer") {
      const ids = groups.map((g) => g._id).filter(Boolean);
      const customers = await Customer.find({ _id: { $in: ids }, company }).select("name type");
      const names = new Map(customers.map((c) => [String(c._id), c]));
      groups = groups.map((g) => ({
        customer: g._id ? names.get(String(g._id))?.name || "Unknown" : "No customer (D2C / marketplace)",
        customer_type: g._id ? names.get(String(g._id))?.type : null,
        revenue: round(g.revenue),
        orders: g.orders,
      }));
    } else {
      groups = groups.map((g) => ({ [groupBy]: g._id, revenue: round(g.revenue), orders: g.orders }));
    }
  }

  return {
    period: { start_date: range.startKey, end_date: range.endKey },
    totals,
    ...(groups ? { group_by: groupBy, groups } : {}),
    note:
      groupBy === "product"
        ? "Product revenue is before order-level discounts, so it can add up to more than total revenue."
        : undefined,
  };
}

async function getFollowUps(args, company) {
  const status = pick(args.status, ["Pending", "Completed", "Cancelled", "Overdue", "All"]) || "Pending";
  const limit = clampLimit(args.limit, 15);
  const now = new Date();

  const filter = { company };
  if (status === "Overdue") Object.assign(filter, { status: "Pending", dueDate: { $lt: now } });
  else if (status !== "All") filter.status = status;

  const [counts, overdue, items] = await Promise.all([
    FollowUp.aggregate([{ $match: { company } }, { $group: { _id: "$status", count: { $sum: 1 } } }]),
    FollowUp.countDocuments({ company, status: "Pending", dueDate: { $lt: now } }),
    FollowUp.find(filter)
      .sort({ dueDate: 1 })
      .limit(limit)
      .populate("customer", "name"),
  ]);

  return {
    counts: { ...Object.fromEntries(counts.map((c) => [c._id, c.count])), overdue },
    showing: status,
    follow_ups: items.map((f) => ({
      title: f.title,
      customer: f.customer?.name || "Unknown",
      due: toDayKey(f.dueDate),
      priority: f.priority,
      status: f.status === "Pending" && f.dueDate < now ? "Overdue" : f.status,
      source: f.source,
    })),
  };
}

const FEEDBACK_CATEGORIES = ["Taste", "Quality", "Packaging", "Delivery", "Pricing", "Service", "Other"];

async function getFeedback(args, company) {
  const range = resolveRange(args);
  const limit = clampLimit(args.limit, 20);

  const match = { company, createdAt: { $gte: range.start, $lte: range.end } };
  const category = pick(args.category, FEEDBACK_CATEGORIES);
  const sentiment = pick(args.sentiment, ["Positive", "Neutral", "Negative"]);
  if (category) match.category = category;
  if (sentiment) match.sentiment = sentiment;

  const [summary, byCategory, items] = await Promise.all([
    Feedback.aggregate([
      { $match: match },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          average_rating: { $avg: "$rating" },
          positive: { $sum: { $cond: [{ $eq: ["$sentiment", "Positive"] }, 1, 0] } },
          neutral: { $sum: { $cond: [{ $eq: ["$sentiment", "Neutral"] }, 1, 0] } },
          negative: { $sum: { $cond: [{ $eq: ["$sentiment", "Negative"] }, 1, 0] } },
          unresolved: { $sum: { $cond: [{ $ne: ["$status", "Resolved"] }, 1, 0] } },
        },
      },
    ]),
    Feedback.aggregate([
      { $match: match },
      {
        $group: {
          _id: "$category",
          total: { $sum: 1 },
          negative: { $sum: { $cond: [{ $eq: ["$sentiment", "Negative"] }, 1, 0] } },
          average_rating: { $avg: "$rating" },
        },
      },
      { $sort: { total: -1 } },
    ]),
    Feedback.find(match)
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate("customer", "name")
      .populate("product", "name"),
  ]);

  const s = summary[0];

  return {
    period: { start_date: range.startKey, end_date: range.endKey },
    filters: { category: category || "any", sentiment: sentiment || "any" },
    summary: s
      ? {
          total: s.total,
          average_rating: round(s.average_rating),
          positive: s.positive,
          neutral: s.neutral,
          negative: s.negative,
          unresolved: s.unresolved,
        }
      : { total: 0 },
    by_category: byCategory.map((c) => ({
      category: c._id,
      total: c.total,
      negative: c.negative,
      average_rating: round(c.average_rating),
    })),
    recent_comments: items.map((f) => ({
      date: toDayKey(f.createdAt),
      rating: f.rating,
      sentiment: f.sentiment,
      category: f.category,
      comment: f.comment,
      customer: f.customer?.name || "Anonymous",
      product: f.product?.name || null,
      status: f.status,
    })),
  };
}

async function getInventory(args, company) {
  const lowStockOnly = args.low_stock_only === true;
  const filter = lowStockOnly
    ? { company, status: "Active", $expr: { $lte: ["$stock", "$lowStockThreshold"] } }
    : { company };

  const products = await Product.find(filter).sort({ stock: 1 }).limit(100);

  return {
    showing: lowStockOnly ? "low or out of stock (active products)" : "all products",
    total_inventory_value_at_selling_price: round(
      products.reduce((sum, p) => sum + p.price * p.stock, 0)
    ),
    products: products.map((p) => ({
      name: p.name,
      sku: p.sku,
      category: p.category,
      price: p.price,
      stock: p.stock,
      low_stock_alert_at: p.lowStockThreshold,
      stock_level: p.stock <= 0 ? "Out of stock" : p.stock <= p.lowStockThreshold ? "Low" : "OK",
      status: p.status,
    })),
  };
}

async function getCustomers(args, company) {
  const filter = { company };
  const status = pick(args.status, ["Active", "Inactive", "Follow-up"]);
  const type = pick(args.type, ["Retailer", "Distributor", "Wholesaler"]);
  if (status) filter.status = status;
  if (type) filter.type = type;

  const [counts, customers] = await Promise.all([
    Customer.aggregate([{ $match: { company } }, { $group: { _id: "$status", count: { $sum: 1 } } }]),
    Customer.find(filter).sort({ name: 1 }).limit(100).select("name type location status"),
  ]);

  return {
    counts_by_status: Object.fromEntries(counts.map((c) => [c._id, c.count])),
    customers: customers.map((c) => ({
      name: c.name,
      type: c.type,
      location: c.location,
      status: c.status,
    })),
  };
}

async function getCustomerDetails(args, company) {
  const name = String(args.name || "").trim();
  if (!name) throw new Error("name is required");

  const matches = await Customer.find({
    company,
    name: { $regex: escapeRegex(name), $options: "i" },
  }).limit(5);

  if (matches.length === 0) return { found: false, message: `No customer matching "${name}"` };
  if (matches.length > 1 && !matches.some((c) => c.name.toLowerCase() === name.toLowerCase())) {
    return { found: false, message: "Several customers match; ask which one", matches: matches.map((c) => c.name) };
  }

  const customer = matches.find((c) => c.name.toLowerCase() === name.toLowerCase()) || matches[0];
  const id = new mongoose.Types.ObjectId(customer._id);

  const [salesTotals, recentSales, activities, followUps, feedback] = await Promise.all([
    Sale.aggregate([
      { $match: { company, customer: id } },
      {
        $group: {
          _id: null,
          revenue: { $sum: "$totalAmount" },
          orders: { $sum: 1 },
          last_order: { $max: "$orderDate" },
          unpaid: { $sum: { $cond: [{ $ne: ["$paymentStatus", "Paid"] }, "$totalAmount", 0] } },
        },
      },
    ]),
    Sale.find({ company, customer: id }).sort({ orderDate: -1 }).limit(5),
    Activity.find({ company, customer: id }).sort({ activityDate: -1 }).limit(5),
    FollowUp.find({ company, customer: id, status: "Pending" }).sort({ dueDate: 1 }).limit(5),
    Feedback.find({ company, customer: id }).sort({ createdAt: -1 }).limit(5),
  ]);

  const t = salesTotals[0];

  return {
    found: true,
    customer: {
      name: customer.name,
      type: customer.type,
      location: customer.location,
      status: customer.status,
      contact_person: customer.contactPerson || null,
      customer_since: toDayKey(customer.createdAt),
    },
    sales_all_time: {
      revenue: round(t?.revenue),
      orders: t?.orders || 0,
      last_order_date: t?.last_order ? toDayKey(t.last_order) : null,
      unpaid_amount: round(t?.unpaid),
    },
    recent_orders: recentSales.map((s) => ({
      date: toDayKey(s.orderDate),
      order_number: s.orderNumber,
      total: s.totalAmount,
      payment: s.paymentStatus,
      items: s.items.map((i) => `${i.quantity} x ${i.name}`).join(", "),
    })),
    recent_activities: activities.map((a) => ({
      date: toDayKey(a.activityDate),
      type: a.type,
      subject: a.subject,
      notes: a.notes || "",
    })),
    pending_follow_ups: followUps.map((f) => ({
      title: f.title,
      due: toDayKey(f.dueDate),
      priority: f.priority,
    })),
    recent_feedback: feedback.map((f) => ({
      date: toDayKey(f.createdAt),
      rating: f.rating,
      category: f.category,
      comment: f.comment,
    })),
  };
}

async function getActivities(args, company) {
  const range = resolveRange(args);
  const limit = clampLimit(args.limit, 15);
  const match = { company, activityDate: { $gte: range.start, $lte: range.end } };
  const type = pick(args.type, ["Call", "Meeting", "Email", "WhatsApp", "Note", "Follow-up"]);
  if (type) match.type = type;

  const [byType, items] = await Promise.all([
    Activity.aggregate([{ $match: match }, { $group: { _id: "$type", count: { $sum: 1 } } }]),
    Activity.find(match).sort({ activityDate: -1 }).limit(limit).populate("customer", "name"),
  ]);

  return {
    period: { start_date: range.startKey, end_date: range.endKey },
    total: byType.reduce((sum, t) => sum + t.count, 0),
    by_type: Object.fromEntries(byType.map((t) => [t._id, t.count])),
    activities: items.map((a) => ({
      date: toDayKey(a.activityDate),
      type: a.type,
      customer: a.customer?.name || "Unknown",
      subject: a.subject,
      notes: a.notes || "",
      status: a.status,
    })),
  };
}

/* ---------------------------------------------------------------- */
/* Declarations sent to the model (JSON Schema)                      */
/* ---------------------------------------------------------------- */

const dateProps = {
  start_date: { type: "string", description: "Start date, YYYY-MM-DD (inclusive). Defaults to the 1st of the current month." },
  end_date: { type: "string", description: "End date, YYYY-MM-DD (inclusive). Defaults to today." },
};

const TOOLS = [
  {
    name: "get_sales_summary",
    description:
      "Sales totals for a date range: revenue (after discounts), orders, units sold, average order value, discounts, paid vs unpaid amounts. Optionally broken down by channel, product, customer, day, month, or payment status. Use for any question about sales, revenue, orders, or comparisons between periods (call once per period).",
    handler: getSalesSummary,
    parameters: {
      type: "object",
      properties: {
        ...dateProps,
        group_by: { type: "string", enum: SALES_GROUPS, description: "Optional breakdown. Default none." },
      },
    },
  },
  {
    name: "get_follow_ups",
    description: "Follow-up tasks for the sales team, with counts by status and a list. Use for questions about pending, overdue, or completed follow-ups.",
    handler: getFollowUps,
    parameters: {
      type: "object",
      properties: {
        status: { type: "string", enum: ["Pending", "Overdue", "Completed", "Cancelled", "All"], description: "Which follow-ups to list. Default Pending." },
        limit: { type: "integer", description: "Max items to list (1-25). Default 15." },
      },
    },
  },
  {
    name: "get_feedback",
    description: "Customer feedback in a date range: totals, average rating, sentiment counts, breakdown by category (Taste, Quality, Packaging, Delivery, Pricing, Service, Other), and the latest comments. Use for complaints, ratings, and what customers are saying.",
    handler: getFeedback,
    parameters: {
      type: "object",
      properties: {
        ...dateProps,
        category: { type: "string", enum: FEEDBACK_CATEGORIES },
        sentiment: { type: "string", enum: ["Positive", "Neutral", "Negative"] },
        limit: { type: "integer", description: "Max comments to return (1-25). Default 20." },
      },
    },
  },
  {
    name: "get_inventory",
    description: "Product catalogue with selling price, current stock, and stock level. Use for stock, restocking, and product list questions.",
    handler: getInventory,
    parameters: {
      type: "object",
      properties: {
        low_stock_only: { type: "boolean", description: "Only active products at or below their low-stock alert level." },
      },
    },
  },
  {
    name: "get_customers",
    description: "List of customers (B2B accounts) with type, location, and status, plus counts by status.",
    handler: getCustomers,
    parameters: {
      type: "object",
      properties: {
        status: { type: "string", enum: ["Active", "Inactive", "Follow-up"] },
        type: { type: "string", enum: ["Retailer", "Distributor", "Wholesaler"] },
      },
    },
  },
  {
    name: "get_customer_details",
    description: "Everything about one customer: profile, all-time sales, recent orders, recent activities, pending follow-ups, and recent feedback. Use when the user names a customer.",
    handler: getCustomerDetails,
    parameters: {
      type: "object",
      properties: { name: { type: "string", description: "Customer name or part of it." } },
      required: ["name"],
    },
  },
  {
    name: "get_activities",
    description: "Sales team activities (calls, meetings, emails, WhatsApp, notes) in a date range, with counts by type and the latest entries.",
    handler: getActivities,
    parameters: {
      type: "object",
      properties: {
        ...dateProps,
        type: { type: "string", enum: ["Call", "Meeting", "Email", "WhatsApp", "Note", "Follow-up"] },
        limit: { type: "integer", description: "Max items to list (1-25). Default 15." },
      },
    },
  },
];

const functionDeclarations = TOOLS.map(({ name, description, parameters }) => ({
  name,
  description,
  parametersJsonSchema: parameters,
}));

const handlers = Object.fromEntries(TOOLS.map((tool) => [tool.name, tool.handler]));

// Run one tool call for a company; errors are returned to the model instead of thrown.
// companyId always comes from the logged-in user on the server, never from the model.
async function runTool(name, args, companyId) {
  const handler = handlers[name];
  if (!handler) return { error: `Unknown tool: ${name}` };
  if (!companyId) return { error: "No company context" };

  try {
    return await handler(args || {}, toObjectId(companyId));
  } catch (error) {
    return { error: error.message };
  }
}

module.exports = { functionDeclarations, runTool, TOOLS };
