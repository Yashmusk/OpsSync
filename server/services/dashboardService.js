const Activity = require("../models/Activity");
const Customer = require("../models/Customer");
const Feedback = require("../models/Feedback");
const FollowUp = require("../models/FollowUp");
const Product = require("../models/Product");
const Sale = require("../models/Sale");
const {
  TIMEZONE,
  daysAgo,
  toDayKey,
  percentChange,
} = require("../utils/dates");
const { toObjectId } = require("../utils/tenant");

const ALLOWED_RANGES = [7, 30, 90];

const sumRevenue = async (match) => {
  const [result] = await Sale.aggregate([
    { $match: match },
    {
      $group: {
        _id: null,
        revenue: { $sum: "$totalAmount" },
        orders: { $sum: 1 },
      },
    },
  ]);
  return { revenue: result?.revenue || 0, orders: result?.orders || 0 };
};

const getDailyRevenue = async (company, start, end, days) => {
  const rows = await Sale.aggregate([
    { $match: { company, orderDate: { $gte: start, $lte: end } } },
    {
      $group: {
        _id: {
          $dateToString: { format: "%Y-%m-%d", date: "$orderDate", timezone: TIMEZONE },
        },
        revenue: { $sum: "$totalAmount" },
      },
    },
  ]);

  const byDay = new Map(rows.map((row) => [row._id, row.revenue]));

  // Fill days with no sales so the chart has a continuous axis
  return Array.from({ length: days }, (_, index) => {
    const date = toDayKey(daysAgo(days - 1 - index, end));
    return { date, revenue: byDay.get(date) || 0 };
  });
};

const getRecentFeed = async (company, limit = 8) => {
  const [activities, sales, feedback] = await Promise.all([
    Activity.find({ company })
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate("customer", "name"),
    Sale.find({ company }).sort({ createdAt: -1 }).limit(limit).populate("customer", "name"),
    Feedback.find({ company })
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate("customer", "name")
      .populate("product", "name"),
  ]);

  const feed = [
    ...activities.map((activity) => ({
      id: String(activity._id),
      kind: "activity",
      title: `${activity.type}: ${activity.subject}`,
      subtitle: activity.customer?.name || "Unknown customer",
      date: activity.createdAt,
    })),
    ...sales.map((sale) => ({
      id: String(sale._id),
      kind: "sale",
      title: `Sale ${sale.orderNumber} · ₹${Math.round(
        sale.totalAmount
      ).toLocaleString("en-IN")}`,
      subtitle: `${sale.customer?.name || "Direct / marketplace"} · ${sale.channel}`,
      date: sale.createdAt,
    })),
    ...feedback.map((item) => ({
      id: String(item._id),
      kind: "feedback",
      title: `${item.sentiment} feedback on ${item.category.toLowerCase()} (${item.rating}★)`,
      subtitle: [item.customer?.name, item.product?.name]
        .filter(Boolean)
        .join(" · ") || "Anonymous",
      date: item.createdAt,
    })),
  ];

  return feed
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, limit);
};

const getSummary = async (rangeDays, companyId) => {
  const company = toObjectId(companyId);
  const days = ALLOWED_RANGES.includes(rangeDays) ? rangeDays : 30;
  const now = new Date();
  const start = daysAgo(days, now);
  const previousStart = daysAgo(days * 2, now);

  const [
    current,
    previous,
    revenueByChannel,
    dailyRevenue,
    activeCustomers,
    newCustomers,
    pendingFollowUps,
    overdueFollowUps,
    lowStockProducts,
    outstanding,
    negativeFeedback,
    recentActivity,
  ] = await Promise.all([
    sumRevenue({ company, orderDate: { $gte: start, $lte: now } }),
    sumRevenue({ company, orderDate: { $gte: previousStart, $lt: start } }),
    Sale.aggregate([
      { $match: { company, orderDate: { $gte: start, $lte: now } } },
      {
        $group: {
          _id: "$channel",
          revenue: { $sum: "$totalAmount" },
          orders: { $sum: 1 },
        },
      },
      { $sort: { revenue: -1 } },
    ]),
    getDailyRevenue(company, start, now, days),
    Customer.countDocuments({ company, status: "Active" }),
    Customer.countDocuments({ company, createdAt: { $gte: start } }),
    FollowUp.countDocuments({ company, status: "Pending" }),
    FollowUp.countDocuments({ company, status: "Pending", dueDate: { $lt: now } }),
    Product.find({
      company,
      status: "Active",
      $expr: { $lte: ["$stock", "$lowStockThreshold"] },
    })
      .sort({ stock: 1 })
      .limit(5)
      .select("name sku stock lowStockThreshold"),
    sumRevenue({ company, paymentStatus: { $ne: "Paid" } }),
    Feedback.aggregate([
      {
        $match: {
          company,
          sentiment: "Negative",
          status: { $ne: "Resolved" },
        },
      },
      { $group: { _id: "$category", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]),
    getRecentFeed(company),
  ]);

  const totalChannelRevenue = revenueByChannel.reduce(
    (sum, row) => sum + row.revenue,
    0
  );

  const unresolvedNegative = negativeFeedback.reduce(
    (sum, row) => sum + row.count,
    0
  );

  // Signals that need the owner's attention, most urgent first
  const attention = [];

  if (overdueFollowUps > 0) {
    attention.push({
      kind: "followup",
      title: `${overdueFollowUps} follow-up${overdueFollowUps === 1 ? " is" : "s are"} overdue`,
      detail: `${pendingFollowUps} pending in total`,
      link: "/follow-ups",
    });
  }

  if (unresolvedNegative > 0) {
    attention.push({
      kind: "feedback",
      title: `${unresolvedNegative} unresolved negative feedback`,
      detail: `Most about ${negativeFeedback[0]._id.toLowerCase()} (${negativeFeedback[0].count})`,
      link: "/feedback",
    });
  }

  if (lowStockProducts.length > 0) {
    attention.push({
      kind: "stock",
      title: `${lowStockProducts.length} product${lowStockProducts.length === 1 ? "" : "s"} low on stock`,
      detail: lowStockProducts
        .slice(0, 3)
        .map((p) => `${p.name} (${p.stock})`)
        .join(", "),
      link: "/products",
    });
  }

  if (outstanding.revenue > 0) {
    attention.push({
      kind: "payment",
      title: `₹${Math.round(outstanding.revenue).toLocaleString("en-IN")} in unpaid orders`,
      detail: `${outstanding.orders} order${outstanding.orders === 1 ? "" : "s"} pending or partial`,
      link: "/sales",
    });
  }

  return {
    rangeDays: days,
    kpis: {
      revenue: current.revenue,
      revenueChange: percentChange(current.revenue, previous.revenue),
      orders: current.orders,
      ordersChange: percentChange(current.orders, previous.orders),
      activeCustomers,
      newCustomers,
      pendingFollowUps,
      overdueFollowUps,
    },
    revenueByChannel: revenueByChannel.map((row) => ({
      channel: row._id,
      revenue: row.revenue,
      orders: row.orders,
      share: totalChannelRevenue
        ? Math.round((row.revenue / totalChannelRevenue) * 100)
        : 0,
    })),
    dailyRevenue,
    attention,
    recentActivity,
  };
};

module.exports = { getSummary };
