import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Info,
  RefreshCw,
  Sparkles,
  UserX,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  apiRequest,
  formatCompactCurrency,
  formatCurrency,
  formatDate,
} from "../api";
import { useCompanyPath } from "../auth/useAuth";

const TONE_ICON = {
  positive: CheckCircle2,
  warning: AlertTriangle,
  info: Info,
};

const axisProps = {
  tick: { fontSize: 12, fill: "#6b7280" },
  tickLine: false,
  axisLine: false,
};

export default function Insights() {
  const to = useCompanyPath();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true; // ignore responses that arrive after a newer request

    apiRequest("/insights")
      .then((result) => {
        if (!active) return;
        setData(result);
        setError("");
      })
      .catch((err) => {
        if (active) setError(err.message || "Could not generate insights.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [reloadKey]);

  const fetchInsights = () => {
    setLoading(true);
    setError("");
    setReloadKey((key) => key + 1);
  };

  return (
    <div className="module-page">
      <div className="module-header">
        <div>
          <h1>Insights</h1>
          <p>Patterns across sales, customers, and feedback — worked out for you.</p>
        </div>

        <div className="module-header-actions">
          <button
            className="fu-button fu-button-secondary"
            onClick={fetchInsights}
            disabled={loading}
          >
            <RefreshCw size={16} />
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="fu-message fu-error">
          <AlertCircle size={18} />
          <span>{error}</span>
          <button onClick={fetchInsights}>Try again</button>
        </div>
      )}

      {loading && !data ? (
        <div className="fu-table-wrapper fu-empty-state">Analysing your data...</div>
      ) : (
        data && (
          <>
            <section className="insight-highlights" aria-label="Key findings">
              {data.highlights.length === 0 ? (
                <div className="insight-card insight-info">
                  <Sparkles size={20} />
                  <div>
                    <strong>Not enough data yet</strong>
                    <p>
                      Record sales, activities, and feedback — insights appear as
                      data builds up.
                    </p>
                  </div>
                </div>
              ) : (
                data.highlights.map((item) => {
                  const Icon = TONE_ICON[item.tone] || Info;
                  return (
                    <div className={`insight-card insight-${item.tone}`} key={item.title}>
                      <Icon size={20} />
                      <div>
                        <strong>{item.title}</strong>
                        <p>{item.detail}</p>
                      </div>
                    </div>
                  );
                })
              )}
            </section>

            <div className="insights-grid">
              <div className="dashboard-card">
                <div className="card-header">
                  <h3>Monthly Revenue</h3>
                  <p>Last 6 months</p>
                </div>
                <div className="chart-container">
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={data.monthlyRevenue}>
                      <CartesianGrid stroke="#eef2f7" vertical={false} />
                      <XAxis dataKey="label" {...axisProps} />
                      <YAxis tickFormatter={formatCompactCurrency} width={64} {...axisProps} />
                      <Tooltip
                        formatter={(value, name) =>
                          name === "revenue" ? [formatCurrency(value), "Revenue"] : [value, name]
                        }
                        cursor={{ fill: "#f1f5f9" }}
                      />
                      <Bar dataKey="revenue" fill="#2563eb" radius={[6, 6, 0, 0]} maxBarSize={44} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="dashboard-card">
                <div className="card-header">
                  <h3>Feedback Sentiment by Category</h3>
                  <p>Last {data.analysisDays} days</p>
                </div>
                {data.feedbackByCategory.length === 0 ? (
                  <p className="card-empty">
                    No feedback yet. <Link to={to("/feedback")}>Log feedback</Link>
                  </p>
                ) : (
                  <div className="chart-container">
                    <ResponsiveContainer width="100%" height={260}>
                      <BarChart data={data.feedbackByCategory} layout="vertical">
                        <CartesianGrid stroke="#eef2f7" horizontal={false} />
                        <XAxis type="number" allowDecimals={false} {...axisProps} />
                        <YAxis type="category" dataKey="category" width={80} {...axisProps} />
                        <Tooltip cursor={{ fill: "#f1f5f9" }} />
                        <Legend wrapperStyle={{ fontSize: 12 }} />
                        <Bar dataKey="positive" name="Positive" stackId="s" fill="#16a34a" />
                        <Bar dataKey="neutral" name="Neutral" stackId="s" fill="#94a3b8" />
                        <Bar
                          dataKey="negative"
                          name="Negative"
                          stackId="s"
                          fill="#dc2626"
                          radius={[0, 6, 6, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>

              <div className="dashboard-card">
                <div className="card-header">
                  <h3>Top Products</h3>
                  <p>By revenue, last {data.analysisDays} days</p>
                </div>
                {data.topProducts.length === 0 ? (
                  <p className="card-empty">No sales yet.</p>
                ) : (
                  <ol className="ranked-list">
                    {data.topProducts.map((product) => (
                      <li key={product._id}>
                        <div>
                          <strong>{product.name}</strong>
                          <span>{product.units} units</span>
                        </div>
                        <strong>{formatCurrency(product.revenue)}</strong>
                      </li>
                    ))}
                  </ol>
                )}
              </div>

              <div className="dashboard-card">
                <div className="card-header">
                  <h3>Top Customers</h3>
                  <p>By revenue, last {data.analysisDays} days</p>
                </div>
                {data.topCustomers.length === 0 ? (
                  <p className="card-empty">No customer orders yet.</p>
                ) : (
                  <ol className="ranked-list">
                    {data.topCustomers.map((customer) => (
                      <li key={customer._id}>
                        <div>
                          <strong>{customer.name}</strong>
                          <span>
                            {customer.type} · {customer.orders} order
                            {customer.orders === 1 ? "" : "s"}
                          </span>
                        </div>
                        <strong>{formatCurrency(customer.revenue)}</strong>
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            </div>

            <div className="dashboard-card">
              <div className="card-header card-header-row">
                <div>
                  <h3>Customers Gone Quiet</h3>
                  <p>
                    Active customers with no order or contact in {data.dormantDays}+ days
                  </p>
                </div>
                {data.dormantCustomers.length > 0 && (
                  <Link to={to("/follow-ups")} className="fu-button fu-button-secondary">
                    Schedule follow-ups
                  </Link>
                )}
              </div>

              {data.dormantCustomers.length === 0 ? (
                <p className="card-empty">
                  Every active customer has been engaged recently. 🎉
                </p>
              ) : (
                <div className="fu-table-scroll">
                  <table className="fu-table">
                    <thead>
                      <tr>
                        <th>Customer</th>
                        <th>Type</th>
                        <th>Location</th>
                        <th>Last order</th>
                        <th>Last touch</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.dormantCustomers.map((customer) => (
                        <tr key={customer._id}>
                          <td>
                            <span className="dormant-name">
                              <UserX size={16} />
                              {customer.name}
                            </span>
                          </td>
                          <td>{customer.type}</td>
                          <td>{customer.location}</td>
                          <td>{customer.lastOrderDate ? formatDate(customer.lastOrderDate) : "Never"}</td>
                          <td>{customer.lastTouch ? formatDate(customer.lastTouch) : "Never"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )
      )}
    </div>
  );
}
