# OpsSync

**One CRM for D2C and B2B brands — so the business owner can see everything in one place instead of chasing spreadsheets.**

Most growing D2C / B2B companies still run sales on Excel and Google Sheets: every sales rep has their own sheet for customers, calls, follow-ups, orders and feedback. When the owner wants the full picture, someone has to dig through all of them.

OpsSync replaces those sheets. Each team works in its own module (customers, activities, follow-ups, sales, products, feedback), and the **Overview** pulls everything together for stakeholders — with an AI assistant that answers questions like *"Summarise my sales this month"* using the company's real numbers.

It's **multi-company**: every company gets its own private workspace and link (e.g. `opssync.app/nutrabay`), and one company's data is never visible to another.

---

## Features

| Module | What it does |
|---|---|
| **Overview** | Live revenue and orders vs the previous period, revenue trend chart, revenue by channel, "Needs attention" alerts (overdue follow-ups, complaints, low stock, unpaid orders), recent team activity |
| **Ask OpsSync (AI)** | Ask questions in plain English. Answers come from the company's own data via read-only database queries — the AI never makes up numbers |
| **Customers** | Retailers, distributors and wholesalers with location, contact and status |
| **Activities** | Log calls, meetings, emails, WhatsApp and notes — optionally create a follow-up task in the same step |
| **Follow-ups** | Tasks with due dates and priority; overdue ones are flagged |
| **Sales** | Multi-product orders across channels (Direct, Distributor, Website, Amazon, Flipkart, Quick Commerce…), discounts, payment status. Stock is deducted automatically |
| **Products** | Catalogue with SKU, price, stock and low-stock alerts |
| **Feedback** | Star ratings, categories (taste, packaging, delivery…), automatic sentiment, open/resolved tracking |
| **Insights** | Plain-language findings (revenue trend, channel dependence, complaint spikes, customers gone quiet), monthly revenue, top products and customers |
| **Team** | Invite links, company-email sign-up, roles, approvals |

### Multi-company access

- **Sign up** a company at `/signup` → it gets its own link, e.g. `/nutrabay`. The person who signs up is the **Owner**.
- **Teammates join** either from the **company link** with their work email (e.g. any `@nutrabay.com` address — public providers like Gmail are never allowed), or through an **invite link** created on the Team page.
- Owners can require **approval** before new sign-ups get access.

| Role | Can do |
|---|---|
| **Owner** | Everything, including changing roles, removing members and "who can join" settings |
| **Admin** | All data, manage products and pricing, invite Members, approve sign-ups |
| **Member** | Customers, activities, follow-ups, sales and feedback; view products |

**How data stays separate:** every record carries a company ID that can't be changed, every database query filters by the logged-in user's company (taken from their login token — never from the URL or request body), and linked records (e.g. a sale's customer) must belong to the same company. The AI assistant's data tools are scoped the same way.

---

## Tech stack

- **Frontend:** React 19, Vite, React Router, Recharts, lucide-react
- **Backend:** Node.js, Express 5, Mongoose 9
- **Database:** MongoDB
- **Auth:** email + password (bcrypt), JWT
- **AI:** Google Gemini (`@google/genai`) with function calling

---

## Project structure

```
OpsSync/
├── client/client/            # React app (Vite)
│   └── src/
│       ├── Pages/            # Dashboard, Customers, Sales, Products, Team, ...
│       │   └── auth/         # Signup, Login (incl. company link page), Join
│       ├── Components/       # Sidebar, AskOpsSync (AI chat), AuthShell
│       ├── auth/             # Login state and role helpers
│       └── api.js            # API URL, authenticated fetch, formatters
└── server/                   # Express API
    ├── models/               # Company, User, Invite, Customer, Product, Sale, ...
    ├── routes/ controllers/ services/
    ├── services/ai/          # Gemini chat loop + read-only data tools
    ├── middleware/auth.js    # Login check + company scoping + roles
    ├── utils/                # Errors, dates, rate limits, tenant helpers
    └── scripts/              # One-time migration for older data
```

---

## Getting started

### Prerequisites

- **Node.js** 20.19+ or 22.12+
- **MongoDB** — local (Community Server) or a free [MongoDB Atlas](https://www.mongodb.com/atlas) cluster
- A **Gemini API key** from [Google AI Studio](https://aistudio.google.com/apikey) *(optional — only for the AI assistant)*

### 1. Clone and install

```bash
git clone https://github.com/Yashmusk/OpsSync.git
cd OpsSync
```

```bash
cd server && npm install
```

```bash
cd client/client && npm install
```

### 2. Configure the server

Copy `server/.env.example` to `server/.env` and fill it in:

| Variable | Required | Description |
|---|---|---|
| `MONGO_URI` | Yes | e.g. `mongodb://localhost:27017/OpsSync` or your Atlas connection string |
| `PORT` | No | API port (default `5000`) |
| `JWT_SECRET` | Yes | Long random string used to sign login tokens. Generate one with `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"` |
| `GEMINI_API_KEY` | For AI | Gemini API key; without it the assistant shows a "not set up" message |
| `GEMINI_MODEL` | No | Defaults to `gemini-3.5-flash-lite` |

The server refuses to start without `JWT_SECRET` and exits with a clear message if MongoDB isn't reachable.

### 3. Configure the client *(optional)*

The client calls `http://localhost:5000/api` by default. To point it elsewhere, create `client/client/.env`:

```
VITE_API_URL=https://your-api.example.com/api
```

### 4. Run

```bash
cd server && npm run dev
```

```bash
cd client/client && npm run dev
```

Open the URL Vite prints (usually http://localhost:5173), click **Create a workspace**, and you're in as the Owner.

---

## Upgrading data from before multi-company support

If you have customers, sales etc. created before workspaces existed, move them into a company (and create its Owner account) once:

```bash
cd server
npm run migrate:tenant -- --company "Your Company" --slug yourco --name "Your Name" --email you@yourco.com --password "a-strong-password"
```

It's safe to re-run, and it also replaces old global unique indexes (SKU, order number) with per-company ones. MongoDB needs at least ~500 MB of free disk space to rebuild indexes.

---

## API overview

All routes are under `/api`. Everything except `/auth` requires `Authorization: Bearer <token>` and only ever returns the logged-in company's data.

| Area | Endpoints |
|---|---|
| Auth (public) | `POST /auth/register-company` · `POST /auth/login` · `GET /auth/me` · `GET /auth/check-slug` · `GET /auth/company/:slug` · `POST /auth/company/:slug/signup` · `GET /auth/invites/:token` · `POST /auth/invites/:token/accept` |
| Team | `GET /team/members` · `PATCH /team/members/:id` *(Owner)* · `DELETE /team/members/:id` · `POST /team/members/:id/approve` · `GET/PATCH /team/settings` · `GET/POST/DELETE /team/invites` |
| Customers | `GET /customers` · `POST /customers` |
| Activities | `GET /activities` · `POST /activities` (optionally creates a follow-up) |
| Follow-ups | `GET /follow-ups` · `POST /follow-ups` |
| Products | `GET /products` · `POST /products` · `PATCH /products/:id` *(Owner/Admin)* |
| Sales | `GET /sales` · `POST /sales` · `PATCH /sales/:id` (payment status) |
| Feedback | `GET /feedback` · `POST /feedback` · `PATCH /feedback/:id` (status) |
| Reports | `GET /dashboard?days=7\|30\|90` · `GET /insights` |
| AI | `POST /ai/chat` with `{ messages: [{ role, content }] }` |

---

## Known limitations / roadmap

- **Email verification & password reset** — need an email service. Until then, Owners can turn on approval for company-email sign-ups.
- **Profit reporting** — products have no cost price yet, so the AI and reports cover revenue only.
- **Editing / deleting** customers, activities and sales isn't available yet.
- **Mobile layout** — the sidebar isn't responsive yet.
- **Deployment prep** — before hosting: restrict CORS to the frontend domain, enable `trust proxy` behind a host's proxy (needed for correct rate limiting), and add an SPA rewrite so links like `/nutrabay/sales` work on refresh.
- Rate limits are in-memory, so they assume a single server instance.
