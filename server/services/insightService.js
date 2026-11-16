const Activity = require("../models/Activity");
const Customer = require("../models/Customer");
const Feedback = require("../models/Feedback");
const FollowUp = require("../models/FollowUp");
const Product = require("../models/Product");
const Sale = require("../models/Sale");
const {
  TIMEZONE,
  daysAgo,
  toMonthKey,
  percentChange,
} = require("../utils/dates");
const { toObjectId } = require("../utils/tenant");

const ANALYSIS_DAYS = 90;
const DORMANT_DAYS = 30;
const MONTHS = 6;

const rupees = (value) => `₹${Math.round(value).toLocaleString("en-IN")}`;

const getMonthlyRevenue = async (company, now) => {
  const firstMonth = new Date(now.getFullYear(), now.getMonth() - (MONTHS - 1), 1);

  const rows = await Sale.aggregate([
    { $match: { company, orderDate: { $gte: firstMonth } } },
    {
      $group: {
        _id: { $dateToString: { format: "%Y-%m", date: "$orderDate", timezone: TIMEZONE } },
        revenue: { $sum: "$totalAmount" },
        orders: { $sum: 1 },
      },
    },
  ]);

  const byMonth = new Map(rows.map((row) => [row._id, row]));

  return Array.from({ length: MONTHS }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - (MONTHS - 1) + index, 15);
    const month = toMonthKey(date);
    return {
      month,
      label: date.toLocaleDateString("en-IN", { month: "short", year: "2-digit" }),
      revenue: byMonth.get(month)?.revenue || 0,
      orders: byMonth.get(month)?.orders || 0,
    };
  });
};

const getTopProducts = (company, since) =>
  Sale.aggregate([
    { $match: { company, orderDate: { $gte: since } } },
    { $unwind: "$items" },
    {
      $group: {
        _id: "$items.product",
        name: { $last: "$items.name" },
        units: { $sum: "$items.quantity" },
        revenue: { $sum: "$items.lineTotal" },
      },
    },
    { $sort: { revenue: -1 } },
    { $limit: 5 },
  ]);

const getTopCustomers = (company, since) =>
  Sale.aggregate([
    { $match: { company, orderDate: { $gte: since }, customer: { $ne: null } } },
    {
      $group: {
        _id: "$customer",
        revenue: { $sum: "$totalAmount" },
        orders: { $sum: 1 },
      },
    },
    { $sort: { revenue: -1 } },
    { $limit: 5 },
    {
      // Only join customers from the same company
      $lookup: {
        from: "customers",
        let: { customerId: "$_id" },
        pipeline: [
          {
            $match: {
              $expr: { $and: [{ $eq: ["$_id", "$$customerId"] }, { $eq: ["$company", company] }] },
            },
          },
        ],
        as: "customer",
      },
    },
    { $unwind: "$customer" },
    {
      $project: {
        name: "$customer.name",
        type: "$customer.type",
        revenue: 1,
        orders: 1,
      },
    },
  ]);

const getFeedbackBreakdown = (company, since) =>
  Feedback.aggregate([
    { $match: { company, createdAt: { $gte: since } } },
    {
      $group: {
        _id: "$category",
        positive: { $sum: { $cond: [{ $eq: ["$sentiment", "Positive"] }, 1, 0] } },
        neutral: { $sum: { $cond: [{ $eq: ["$sentiment", "Neutral"] }, 1, 0] } },
        negative: { $sum: { $cond: [{ $eq: ["$sentiment", "Negative"] }, 1, 0] } },
        averageRating: { $avg: "$rating" },
        total: { $sum: 1 },
      },
    },
    { $sort: { total: -1 } },
  ]);

// Active customers with no sale and no activity in the last DORMANT_DAYS
const getDormantCustomers = async (company, now) => {
  const since = daysAgo(DORMANT_DAYS, now);

  const [recentBuyers, recentlyContacted, customers] = await Promise.all([
    Sale.distinct("customer", { company, orderDate: { $gte: since }, customer: { $ne: null } }),
    Activity.distinct("customer", { company, activityDate: { $gte: since } }),
    Customer.find({ company, status: "Active", createdAt: { $lt: since } })
      .select("name type location")
      .sort({ name: 1 }),
  ]);

  const engaged = new Set([...recentBuyers, ...recentlyContacted].map(String));
  const dormant = customers.filter((c) => !engaged.has(String(c._id)));

  if (dormant.length === 0) return [];

  // Attach last-touch dates so the team knows how long it's been
  const [lastSales, lastActivities] = await Promise.all([
    Sale.aggregate([
      { $match: { company, customer: { $in: dormant.map((c) => c._id) } } },
      { $group: { _id: "$customer", last: { $max: "$orderDate" } } },
    ]),
    Activity.aggregate([
      { $match: { company, customer: { $in: dormant.map((c) => c._id) } } },
      { $group: { _id: "$customer", last: { $max: "$activityDate" } } },
    ]),
  ]);

  const lastSale = new Map(lastSales.map((row) => [String(row._id), row.last]));
  const lastActivity = new Map(lastActivities.map((row) => [String(row._id), row.last]));

  return dormant.map((customer) => {
    const id = String(customer._id);
    const dates = [lastSale.get(id), lastActivity.get(id)].filter(Boolean);
    return {
      _id: customer._id,
      name: customer.name,
      type: customer.type,
      location: customer.location,
      lastOrderDate: lastSale.get(id) || null,
      lastTouch: dates.length ? new Date(Math.max(...dates.map(Number))) : null,
    };
  });
};

const countNegativeByCategory = async (company, start, end) => {
  const rows = await Feedback.aggregate([
    { $match: { company, sentiment: "Negative", createdAt: { $gte: start, $lt: end } } },
    { $group: { _id: "$category", count: { $sum: 1 } } },
  ]);
  return new Map(rows.map((row) => [row._id, row.count]));
};

const getInsights = async (companyId) => {
  const company = toObjectId(companyId);
  const now = new Date();
  const since = daysAgo(ANALYSIS_DAYS, now);
  const last30 = daysAgo(30, now);
  const prev30 = daysAgo(60, now);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);

  const [
    monthlyRevenue,
    topProducts,
    topCustomers,
    feedbackByCategory,
    dormantCustomers,
    channelRevenue,
    negativeNow,
    negativeBefore,
    followUpStats,
    lowStockCount,
  ] = await Promise.all([
    getMonthlyRevenue(company, now),
    getTopProducts(company, since),
    getTopCustomers(company, since),
    getFeedbackBreakdown(company, since),
    getDormantCustomers(company, now),
    Sale.aggregate([
      { $match: { company, orderDate: { $gte: last30 } } },
      { $group: { _id: "$channel", revenue: { $sum: "$totalAmount" } } },
      { $sort: { revenue: -1 } },
    ]),
    countNegativeByCategory(company, last30, now),
    countNegativeByCategory(company, prev30, last30),
    FollowUp.aggregate([
      { $match: { company, dueDate: { $gte: since, $lte: now } } },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]),
    Product.countDocuments({
      company,
      status: "Active",
      $expr: { $lte: ["$stock", "$lowStockThreshold"] },
    }),
  ]);

  // Plain-language findings, each tagged positive / warning / info
  const highlights = [];

  // Month-to-date vs the same days of last month (a fair comparison)
  const thisMonth = monthlyRevenue[MONTHS - 1];
  const lastMonth = monthlyRevenue[MONTHS - 2];
  const dayOfMonth = Math.min(
    now.getDate(),
    new Date(now.getFullYear(), now.getMonth(), 0).getDate()
  );
  const comparableEnd = new Date(lastMonthStart);
  comparableEnd.setDate(dayOfMonth);
  comparableEnd.setHours(now.getHours(), now.getMinutes(), now.getSeconds());

  const lastMonthToDate = await Sale.aggregate([
    { $match: { company, orderDate: { $gte: lastMonthStart, $lte: comparableEnd } } },
    { $group: { _id: null, revenue: { $sum: "$totalAmount" } } },
  ]).then(([row]) => row?.revenue || 0);

  const monthChange = percentChange(thisMonth.revenue, lastMonthToDate);

  if (thisMonth.revenue || lastMonthToDate) {
    if (monthChange === null) {
      highlights.push({
        tone: "positive",
        title: "Sales picked up this month",
        detail: `${rupees(thisMonth.revenue)} so far in ${thisMonth.label}, with none in the same days of ${lastMonth.label}.`,
      });
    } else {
      highlights.push({
        tone: monthChange >= 0 ? "positive" : "warning",
        title: `Revenue ${monthChange >= 0 ? "up" : "down"} ${Math.abs(monthChange)}% month-to-date`,
        detail: `${rupees(thisMonth.revenue)} in ${thisMonth.label} so far vs ${rupees(lastMonthToDate)} in the first ${dayOfMonth} days of ${lastMonth.label}.`,
      });
    }
  }

  const totalChannel = channelRevenue.reduce((sum, row) => sum + row.revenue, 0);
  if (totalChannel > 0) {
    const top = channelRevenue[0];
    const share = Math.round((top.revenue / totalChannel) * 100);
    highlights.push({
      tone: share >= 60 ? "warning" : "info",
      title: `${top._id} drives ${share}% of revenue`,
      detail:
        share >= 60
          ? "Heavy reliance on one channel — consider growing others to reduce risk."
          : `${rupees(top.revenue)} in the last 30 days across ${channelRevenue.length} channel${channelRevenue.length === 1 ? "" : "s"}.`,
    });
  }

  if (topProducts.length > 0) {
    highlights.push({
      tone: "positive",
      title: `${topProducts[0].name} is your best seller`,
      detail: `${topProducts[0].units} units, ${rupees(topProducts[0].revenue)} in the last ${ANALYSIS_DAYS} days.`,
    });
  }

  // Biggest rise in complaints by category
  let spike = null;
  for (const [category, count] of negativeNow) {
    const before = negativeBefore.get(category) || 0;
    const rise = count - before;
    if (rise > 0 && (!spike || rise > spike.rise)) {
      spike = { category, count, before, rise };
    }
  }
  if (spike) {
    const change = percentChange(spike.count, spike.before);
    highlights.push({
      tone: "warning",
      title: `${spike.category} complaints ${change === null ? "appeared" : `up ${change}%`}`,
      detail: `${spike.count} negative ${spike.category.toLowerCase()} feedback in the last 30 days vs ${spike.before} the 30 days before.`,
    });
  }

  if (dormantCustomers.length > 0) {
    highlights.push({
      tone: "warning",
      title: `${dormantCustomers.length} customer${dormantCustomers.length === 1 ? "" : "s"} gone quiet`,
      detail: `No order or contact in ${DORMANT_DAYS}+ days. Schedule follow-ups before they churn.`,
    });
  }

  const followUpCounts = Object.fromEntries(followUpStats.map((row) => [row._id, row.count]));
  const dueTotal =
    (followUpCounts.Completed || 0) + (followUpCounts.Pending || 0);
  if (dueTotal > 0) {
    const rate = Math.round(((followUpCounts.Completed || 0) / dueTotal) * 100);
    highlights.push({
      tone: rate >= 80 ? "positive" : "warning",
      title: `${rate}% of due follow-ups completed`,
      detail: `${followUpCounts.Completed || 0} of ${dueTotal} follow-ups due in the last ${ANALYSIS_DAYS} days.`,
    });
  }

  if (lowStockCount > 0) {
    highlights.push({
      tone: "warning",
      title: `${lowStockCount} product${lowStockCount === 1 ? " needs" : "s need"} restocking`,
      detail: "Stock is at or below the low-stock alert level.",
    });
  }

  return {
    analysisDays: ANALYSIS_DAYS,
    dormantDays: DORMANT_DAYS,
    highlights,
    monthlyRevenue,
    topProducts: topProducts.map((row) => ({
      _id: row._id,
      name: row.name,
      units: row.units,
      revenue: row.revenue,
    })),
    topCustomers,
    feedbackByCategory: feedbackByCategory.map((row) => ({
      category: row._id,
      positive: row.positive,
      neutral: row.neutral,
      negative: row.negative,
      total: row.total,
      averageRating: Math.round(row.averageRating * 10) / 10,
    })),
    dormantCustomers,
  };
};

module.exports = { getInsights };
