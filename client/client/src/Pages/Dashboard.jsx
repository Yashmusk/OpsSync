import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertCircle,
  AlertTriangle,
  Clock3,
  IndianRupee,
  MessageSquare,
  Package,
  Phone,
  ShoppingCart,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  apiRequest,
  formatCompactCurrency,
  formatCurrency,
  timeAgo,
} from "../api";
import AskOpsSync from "../Components/AskOpsSync";
import { useAuth, useCompanyPath } from "../auth/useAuth";

const RANGES = [7, 30, 90];

const ATTENTION_ICON = {
  followup: Clock3,
  feedback: MessageSquare,
  stock: Package,
  payment: Wallet,
};

const FEED_ICON = {
  activity: Phone,
  sale: ShoppingCart,
  feedback: MessageSquare,
};

function formatChange(change, suffix = "vs previous period") {
  if (change === null) return `New ${suffix.replace("vs ", "in ")}`;
  const sign = change > 0 ? "+" : "";
  return `${sign}${change}% ${suffix}`;
}

function formatDayLabel(dayKey) {
  return new Date(`${dayKey}T00:00:00`).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
  });
}

function Dashboard() {
  const { user, company } = useAuth();
  const to = useCompanyPath();
  const [days, setDays] = useState(30);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true; // ignore responses for a range the user already left

    apiRequest(`/dashboard?days=${days}`)
      .then((result) => {
        if (!active) return;
        setSummary(result);
        setError("");
      })
      .catch((err) => {
        if (active) setError(err.message || "Could not load the dashboard.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [days, reloadKey]);

  const fetchSummary = () => {
    setLoading(true);
    setError("");
    setReloadKey((key) => key + 1);
  };

  const changeRange = (value) => {
    setLoading(true);
    setDays(value);
  };

  const kpis = summary?.kpis;

  const stats = kpis
    ? [
        {
          title: "Revenue",
          value: formatCompactCurrency(kpis.revenue),
          change: formatChange(kpis.revenueChange),
          down: kpis.revenueChange < 0,
          icon: IndianRupee,
        },
        {
          title: "Orders",
          value: kpis.orders.toLocaleString("en-IN"),
          change: formatChange(kpis.ordersChange),
          down: kpis.ordersChange < 0,
          icon: TrendingUp,
        },
        {
          title: "Active Customers",
          value: kpis.activeCustomers.toLocaleString("en-IN"),
          change: `${kpis.newCustomers} new in last ${days} days`,
          icon: Users,
        },
        {
          title: "Pending Follow-ups",
          value: kpis.pendingFollowUps.toLocaleString("en-IN"),
          change: kpis.overdueFollowUps
            ? `${kpis.overdueFollowUps} overdue`
            : "None overdue",
          down: kpis.overdueFollowUps > 0,
          icon: Clock3,
        },
      ]
    : [];

  return (
    <div className="dashboard">
      <div className="page-header">
        <div>
          <h1>Business Overview</h1>
          <p>
            Hi {user.name.split(" ")[0]}, here's what's happening at {company.name}.
          </p>
        </div>

        <select
          className="date-button"
          value={days}
          onChange={(event) => changeRange(Number(event.target.value))}
          aria-label="Date range"
        >
          {RANGES.map((range) => (
            <option key={range} value={range}>
              Last {range} days
            </option>
          ))}
        </select>
      </div>

      <AskOpsSync />

      {error && (
        <div className="fu-message fu-error">
          <AlertCircle size={18} />
          <span>{error}</span>
          <button onClick={fetchSummary}>Try again</button>
        </div>
      )}

      {loading && !summary ? (
        <div className="dashboard-card fu-empty-state">Loading overview...</div>
      ) : (
        summary && (
          <>
            <div className={`stats-grid ${loading ? "is-refreshing" : ""}`}>
              {stats.map((stat) => {
                const Icon = stat.icon;

                return (
                  <div className="stat-card" key={stat.title}>
                    <div className="stat-icon">
                      <Icon size={22} />
                    </div>
                    <div>
                      <p>{stat.title}</p>
                      <h2>{stat.value}</h2>
                      <span className={stat.down ? "stat-change-down" : ""}>
                        {stat.change}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="dashboard-card">
              <div className="card-header">
                <div>
                  <h3>Revenue Trend</h3>
                  <p>Daily revenue over the last {days} days</p>
                </div>
              </div>

              <div className="chart-container">
                <ResponsiveContainer width="100%" height={240}>
                  <AreaChart data={summary.dailyRevenue}>
                    <defs>
                      <linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#2563eb" stopOpacity={0.25} />
                        <stop offset="100%" stopColor="#2563eb" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="#eef2f7" vertical={false} />
                    <XAxis
                      dataKey="date"
                      tickFormatter={formatDayLabel}
                      tick={{ fontSize: 12, fill: "#6b7280" }}
                      tickLine={false}
                      axisLine={false}
                      minTickGap={24}
                    />
                    <YAxis
                      tickFormatter={formatCompactCurrency}
                      tick={{ fontSize: 12, fill: "#6b7280" }}
                      tickLine={false}
                      axisLine={false}
                      width={64}
                    />
                    <Tooltip
                      formatter={(value) => [formatCurrency(value), "Revenue"]}
                      labelFormatter={formatDayLabel}
                    />
                    <Area
                      type="monotone"
                      dataKey="revenue"
                      stroke="#2563eb"
                      strokeWidth={2}
                      fill="url(#revenueFill)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="dashboard-grid">
              <div className="dashboard-card large-card">
                <div className="card-header">
                  <div>
                    <h3>Revenue by Channel</h3>
                    <p>Sales contribution across channels</p>
                  </div>
                </div>

                {summary.revenueByChannel.length === 0 ? (
                  <p className="card-empty">
                    No sales in this period. <Link to={to("/sales")}>Record a sale</Link>
                  </p>
                ) : (
                  <div className="channel-list">
                    {summary.revenueByChannel.map((channel) => (
                      <div className="channel-item" key={channel.channel}>
                        <div className="channel-info">
                          <span>
                            {channel.channel} · {channel.share}%
                          </span>
                          <strong>{formatCompactCurrency(channel.revenue)}</strong>
                        </div>
                        <div className="progress-bar">
                          <div
                            className="progress-fill"
                            style={{ width: `${channel.share}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="dashboard-card">
                <div className="card-header">
                  <div>
                    <h3>Needs Attention</h3>
                    <p>Important business signals</p>
                  </div>
                </div>

                {summary.attention.length === 0 ? (
                  <p className="card-empty">All clear — nothing needs attention.</p>
                ) : (
                  <div className="attention-list">
                    {summary.attention.map((item) => {
                      const Icon = ATTENTION_ICON[item.kind] || AlertTriangle;

                      return (
                        <Link
                          to={to(item.link)}
                          className="attention-item attention-link"
                          key={item.kind}
                        >
                          <Icon size={20} />
                          <div>
                            <strong>{item.title}</strong>
                            <p>{item.detail}</p>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            <div className="dashboard-card">
              <div className="card-header">
                <div>
                  <h3>Recent Business Activity</h3>
                  <p>Latest updates from your team</p>
                </div>
              </div>

              {summary.recentActivity.length === 0 ? (
                <p className="card-empty">
                  Nothing logged yet. Activities, sales, and feedback will show up
                  here.
                </p>
              ) : (
                summary.recentActivity.map((item) => {
                  const Icon = FEED_ICON[item.kind] || Phone;

                  return (
                    <div className="feed-row" key={`${item.kind}-${item.id}`}>
                      <div className="feed-avatar">
                        <Icon size={18} />
                      </div>
                      <div>
                        <strong>{item.title}</strong>
                        <p>{item.subtitle}</p>
                      </div>
                      <span>{timeAgo(item.date)}</span>
                    </div>
                  );
                })
              )}
            </div>
          </>
        )
      )}
    </div>
  );
}

export default Dashboard;
