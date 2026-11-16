import { BrowserRouter, Navigate, Outlet, Route, Routes, useParams } from "react-router-dom";
import Sidebar from "./Components/SideBar";
import { AuthProvider } from "./auth/AuthContext";
import { useAuth } from "./auth/useAuth";

import Dashboard from "./Pages/Dashboard";
import Customers from "./Pages/Customers";
import Activities from "./Pages/Activities";
import FollowUps from "./Pages/FollowUps";
import Sales from "./Pages/Sales";
import Products from "./Pages/Products";
import Feedback from "./Pages/Feedback";
import Insights from "./Pages/Insights";
import Team from "./Pages/Team";
import Login from "./Pages/auth/Login";
import Signup from "./Pages/auth/Signup";
import Join from "./Pages/auth/Join";

function FullPageMessage({ text }) {
  return <div className="auth-page auth-loading">{text}</div>;
}

// "/" -> your workspace if logged in, otherwise the login page
function Home() {
  const { isLoggedIn, company, checking } = useAuth();
  if (checking) return <FullPageMessage text="Loading..." />;
  return <Navigate to={isLoggedIn ? `/${company.slug}` : "/login"} replace />;
}

// "/:slug/*" -> a company's workspace. Logged out: that company's login page.
// Logged into a different company: sent back to your own workspace.
function Workspace() {
  const { slug } = useParams();
  const { isLoggedIn, company, checking } = useAuth();

  if (checking) return <FullPageMessage text="Loading your workspace..." />;
  if (!isLoggedIn) return <Login slug={slug.toLowerCase()} />;
  if (company.slug !== slug.toLowerCase()) return <Navigate to={`/${company.slug}`} replace />;

  return (
    <div className="app-layout">
      <Sidebar />
      {/* key: remount pages if the logged-in company ever changes */}
      <main className="main-content" key={company.id}>
        <Outlet />
      </main>
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/join/:token" element={<Join />} />

          <Route path="/:slug" element={<Workspace />}>
            <Route index element={<Dashboard />} />
            <Route path="customers" element={<Customers />} />
            <Route path="activities" element={<Activities />} />
            <Route path="follow-ups" element={<FollowUps />} />
            <Route path="sales" element={<Sales />} />
            <Route path="products" element={<Products />} />
            <Route path="feedback" element={<Feedback />} />
            <Route path="insights" element={<Insights />} />
            <Route path="team" element={<Team />} />
            <Route path="*" element={<Navigate to=".." relative="path" replace />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
