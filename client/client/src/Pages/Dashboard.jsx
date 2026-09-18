import {
  TrendingUp,
  Users,
  IndianRupee,
  Clock3,
  AlertTriangle,
} from "lucide-react";

function Dashboard() {
  const stats = [
    {
      title: "Total Revenue",
      value: "₹82.4L",
      change: "+18.2%",
      icon: IndianRupee,
    },
    {
      title: "Active Customers",
      value: "1,240",
      change: "+12.5%",
      icon: Users,
    },
    {
      title: "Pending Follow-ups",
      value: "84",
      change: "Needs attention",
      icon: Clock3,
    },
    {
      title: "Sales Growth",
      value: "18.2%",
      change: "vs last month",
      icon: TrendingUp,
    },
  ];

  const channels = [
    { name: "Amazon", revenue: "₹30.2L", percentage: 37 },
    { name: "Website", revenue: "₹22.4L", percentage: 27 },
    { name: "Flipkart", revenue: "₹15.8L", percentage: 19 },
    { name: "Quick Commerce", revenue: "₹14L", percentage: 17 },
  ];

  return (
    <div className="dashboard">
      {/* HEADER */}
      <div className="page-header">
        <div>
          <h1>Business Overview</h1>
          <p>Here's what's happening across your business.</p>
        </div>

        <button className="date-button">Last 30 days</button>
      </div>

      {/* KPI CARDS */}
      <div className="stats-grid">
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
                <span>{stat.change}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* MAIN GRID */}
      <div className="dashboard-grid">
        {/* REVENUE */}
        <div className="dashboard-card large-card">
          <div className="card-header">
            <div>
              <h3>Revenue by Channel</h3>
              <p>Sales contribution across channels</p>
            </div>
          </div>

          <div className="channel-list">
            {channels.map((channel) => (
              <div className="channel-item" key={channel.name}>
                <div className="channel-info">
                  <span>{channel.name}</span>
                  <strong>{channel.revenue}</strong>
                </div>

                <div className="progress-bar">
                  <div
                    className="progress-fill"
                    style={{ width: `${channel.percentage}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ATTENTION */}
        <div className="dashboard-card">
          <div className="card-header">
            <div>
              <h3>Needs Attention</h3>
              <p>Important business signals</p>
            </div>
          </div>

          <div className="attention-list">
            <div className="attention-item">
              <AlertTriangle size={20} />
              <div>
                <strong>Feedback spike detected</strong>
                <p>Taste complaints increased by 32%</p>
              </div>
            </div>

            <div className="attention-item">
              <Clock3 size={20} />
              <div>
                <strong>84 follow-ups pending</strong>
                <p>23 follow-ups are overdue</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* BOTTOM */}
      <div className="dashboard-card">
        <div className="card-header">
          <div>
            <h3>Recent Business Activity</h3>
            <p>Latest updates from your team</p>
          </div>
        </div>

        <div className="activity-row">
          <div className="activity-avatar">R</div>
          <div>
            <strong>Rahul updated customer feedback</strong>
            <p>ABC Fitness • Whey Protein</p>
          </div>
          <span>10 min ago</span>
        </div>

        <div className="activity-row">
          <div className="activity-avatar">P</div>
          <div>
            <strong>Priya completed a follow-up</strong>
            <p>Muscle Store • Order discussion</p>
          </div>
          <span>35 min ago</span>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;