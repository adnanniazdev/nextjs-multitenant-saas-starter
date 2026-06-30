# TenantFlow: Multi-Tenant SaaS Starter

TenantFlow is a production-grade, highly-optimized Next.js multi-tenant SaaS starter boilerplate built with **Neon PostgreSQL**, **Drizzle ORM**, **Clerk Authentication**, and **Stripe Elements**.

It is designed to give you a fully type-safe, performant, and secure foundation to launch your subscription-based SaaS product in hours, with strict tenant-level database isolation.

---

## ⚡ Key Features

*   **🌐 Subdomain & Path-Based Routing**: Native support for subdomain routing (`tenant.yourdomain.com`) in production and clean path-based routing (`localhost:3000/tenant`) for local testing.
*   **🔒 Row-Level Security (RLS)**: Enforces physical database partition isolation at the PostgreSQL SQL engine level using `set_config` transaction parameters, preventing cross-tenant data leaks.
*   **🔑 Clerk Authentication & JIT Sync**: Completely handles user sessions and provides a Just-in-Time fallback profile synchronizer to write user records directly into your Postgres instance on first login.
*   **💳 Embedded Stripe Elements Billing**: Embedded, customizable payment card interface to purchase subscriptions directly on your page without annoying external page redirects.
*   **📦 Stripe SDK JIT Sync**: Proactively polls Stripe's API via the SDK on dashboard loads to update plans and subscription statuses, completely bypassing local webhook/Stripe CLI configurations in development.
*   **🧪 Test-Driven Boilerplate**: Integrated mock transaction RLS test suites in Vitest and landing page end-to-end setups in Playwright.

---

## 🛠️ Technology Stack

*   **Framework**: Next.js 15 (App Router with Turbopack)
*   **Database**: Neon Serverless PostgreSQL (WebSocket driver connection pools)
*   **ORM**: Drizzle ORM
*   **Auth**: Clerk Middleware & JWT Tokens
*   **Payments**: Stripe SDK & Stripe React Elements
*   **Formatting**: Biome (Linting and Formatting)
*   **Testing**: Vitest & Playwright

---

## 📂 Project Structure

```
src/
├── app/
│   ├── layout.tsx         # Clerk, tRPC, and Styling root providers
│   ├── page.tsx           # Landing Console page (Workspace management)
│   └── [workspace]/       # Isolated tenant directory routing
│       ├── page.tsx       # RLS-isolated Dashboard page
│       ├── members/       # Roster settings (Invite, edit roles, delete member)
│       └── billing/       # Billing management (Stripe Elements portal)
├── components/
│   ├── Sidebar.tsx        # Dynamic navigation bar (Resolves pathPrefix paths)
│   └── features/
│       └── ConsoleClient.tsx # Interactive workspace creator form
├── server/
│   ├── db/
│   │   ├── index.ts       # Neon Serverless Pool connection setup
│   │   ├── schema.ts      # Drizzle relational schemas
│   │   ├── rls.ts         # withTenant & withAdmin RLS wrappers
│   │   └── users.ts       # JIT Clerk profile provisioning
│   └── trpc/
│       ├── routers/       # Billing and Workspace query routers
│       └── trpc.ts        # Context & Procedure middlewares
└── middleware.ts          # Subdomain extracts & URL pathname rewrites
```

---

## 🏃 Local Setup & Development

### 1. Clone & Install Dependencies
```bash
git clone https://github.com/adnanniazdev/nextjs-multitenant-saas-starter.git
cd nextjs-multitenant-saas-starter
pnpm install
```

### 2. Environment Variables Configuration
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

Open `.env` and configure your credentials:
1.  **Neon Database**: Paste your Postgres connection string into `DATABASE_URL`. Make sure it uses the direct hostname (without `-pooler`) in development, or set up connection pooling for production.
2.  **Clerk Auth**: Copy your Publishable and Secret Keys from your [Clerk Dashboard](https://dashboard.clerk.com/).
3.  **Stripe Billing**:
    *   `STRIPE_SECRET_KEY`: Copy your test secret key (`sk_test_...`) from [Stripe API Keys](https://dashboard.stripe.com/test/apikeys).
    *   `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`: Copy your test publishable key (`pk_test_...`).
    *   `NEXT_PUBLIC_STRIPE_PRO_PRICE_ID`: Create a recurring monthly price ($29/month) under Stripe Products and paste the price ID (`price_...`).

### 3. Run Development Server
```bash
pnpm run dev
```
Open **`http://localhost:3000`** in your browser.

---

## 🧪 Testing

### Run Unit Tests (Vitest)
Unit tests validate that database queries execute strictly inside tenant transaction boundaries and fail when unauthorized:
```bash
pnpm run test
```

### Run End-to-End Tests (Playwright)
```bash
pnpm exec playwright test
```

---

## 🚀 Deploying to Vercel

TenantFlow is optimized to deploy directly to Vercel:

1.  Connect your GitHub repository to your **Vercel Dashboard**.
2.  Add your production environment variables (Ensure `NEXT_PUBLIC_APP_URL` is set to `https://your-domain.vercel.app` or your custom domain).
3.  **Note on Subdomains**: Since wildcard subdomains (like `*.app.vercel.app`) are restricted on default Vercel domains, the app automatically falls back to **path-based routing** (e.g. `your-app.vercel.app/revnix`) on Vercel subdomains!
