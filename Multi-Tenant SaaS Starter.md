# Multi-Tenant SaaS Starter
### Agent-Ready Build Specification

**Next.js 15 · Clerk · Drizzle ORM · tRPC · Stripe · Neon PostgreSQL**
**Tailwind CSS 4 · shadcn/ui · Vitest · Vercel**

*Built by Adnan Niaz · 2025*

---

## 1. Project Overview

This document is the complete, agent-ready specification for building a production-quality multi-tenant SaaS starter. Every section is written to be consumed directly by an AI coding agent (Claude Code, Cursor, Copilot Workspace) or used as a human engineering brief.

### 1.1 What This App Does

The app lets any user sign up, create a workspace (organisation), invite teammates, assign roles, and upgrade to a paid plan — all within a clean, production-grade interface. It is intentionally minimal in domain logic so that any SaaS product can be built on top of it.

### 1.2 Core Concepts

| Concept | Description |
|---|---|
| **Workspace** | An isolated tenant. Has a unique slug, its own members, plan, and data. Maps 1:1 with a Stripe customer. |
| **Member** | A user who belongs to a workspace with a role. A user can belong to multiple workspaces. |
| **Role** | `owner` \| `admin` \| `member`. Controls what a user can see and do within a workspace. |
| **Plan** | `free` \| `pro`. Stored on the workspace. Gated via Stripe subscription status. |
| **Invitation** | A time-limited token sent via email allowing a non-user to join a workspace. |

### 1.3 Target Outcome

A deployed, publicly accessible application on Vercel with:

- Live demo URL (e.g. `saas-starter.vercel.app`)
- Full authentication flow (sign up, sign in, org creation)
- Working Stripe billing (Checkout, webhooks, Customer Portal)
- Role-based UI — members cannot access billing or member management
- At least 80% test coverage on tRPC auth-guarded procedures
- README with architecture diagram and setup instructions
- Public GitHub repository with clean commit history

---

## 2. Architecture

### 2.1 Tech Stack

| Layer | Technology | Reason |
|---|---|---|
| Framework | Next.js 15 App Router | RSC, server actions, file-based routing |
| Language | TypeScript 5 | End-to-end type safety |
| Auth | Clerk | Built-in org/workspace, social login, invites |
| Database | Neon (PostgreSQL) | Serverless, free tier, branching for staging |
| ORM | Drizzle ORM | Type-safe, lightweight, SQL-first |
| API Layer | tRPC v11 | Type-safe client↔server, no REST boilerplate |
| Billing | Stripe | Checkout, webhooks, Customer Portal |
| UI | Tailwind CSS 4 + shadcn/ui | Rapid, accessible, production-grade components |
| Testing | Vitest + React Testing Library | Fast, Jest-compatible unit + integration tests |
| Deploy | Vercel | Zero-config Next.js hosting, edge functions |

### 2.2 Folder Structure

```
/
├── app/
│   ├── (auth)/                  # Clerk sign-in / sign-up pages
│   ├── (marketing)/             # Public landing page
│   ├── [workspace]/             # Tenant-scoped app shell
│   │   ├── dashboard/           # Main workspace view
│   │   ├── settings/
│   │   │   ├── general/         # Workspace name, slug
│   │   │   ├── members/         # Invite, roles, remove
│   │   │   └── billing/         # Plan, Stripe portal
│   │   └── layout.tsx           # Sidebar + workspace guard
├── components/                  # Shared UI components
├── server/
│   ├── db/                      # Drizzle schema + client
│   ├── trpc/                    # Router definitions
│   └── stripe/                  # Stripe helpers
├── lib/                         # Utilities, constants
├── middleware.ts                # Clerk auth middleware
└── drizzle.config.ts
```

### 2.3 Request Lifecycle

Every authenticated request follows this path:

- Browser → Next.js Middleware (Clerk validates session token, attaches `userId` + `orgId`)
- Page/Route Handler → tRPC caller → router procedure
- Router procedure: checks Clerk `orgId` matches workspace slug in DB
- Role check: confirms user's role allows the action
- Drizzle query → Neon PostgreSQL
- Response flows back — RSC renders on server, minimal client JS

> ℹ️ All workspace data queries MUST include a `WHERE workspace_id = :workspaceId` clause. Never query without a workspace scope — this is the multi-tenancy isolation boundary.

---

## 3. Database Schema

### 3.1 Schema File Location

All schema definitions live in `server/db/schema.ts`. Run migrations with:

```
pnpm drizzle-kit push        # development (applies directly)
pnpm drizzle-kit generate    # production (generates SQL migration files)
```

### 3.2 Tables

#### `users`

| Column | Type | Key | Notes |
|---|---|---|---|
| `id` | uuid | PK | `defaultRandom()` |
| `clerk_id` | text | UNIQUE | `user_XXXX` from Clerk |
| `email` | text | NOT NULL | Primary email address |
| `name` | text | | Display name |
| `avatar_url` | text | | From Clerk profile image |
| `created_at` | timestamp | NOT NULL | `defaultNow()` |

#### `workspaces`

| Column | Type | Key | Notes |
|---|---|---|---|
| `id` | uuid | PK | `defaultRandom()` |
| `name` | text | NOT NULL | Display name e.g. Acme Corp |
| `slug` | text | UNIQUE | URL segment, lowercase, no spaces |
| `plan` | enum | NOT NULL | `free` \| `pro`, default `free` |
| `stripe_customer_id` | text | | Set on first Stripe interaction |
| `stripe_subscription_id` | text | | Active subscription ID |
| `subscription_status` | text | | `active` \| `trialing` \| `past_due` \| `cancelled` |
| `current_period_end` | timestamp | | When current billing period ends |
| `created_at` | timestamp | NOT NULL | `defaultNow()` |

#### `workspace_members`

| Column | Type | Key | Notes |
|---|---|---|---|
| `workspace_id` | uuid | FK, PK | → `workspaces.id`, CASCADE DELETE |
| `user_id` | uuid | FK, PK | → `users.id`, CASCADE DELETE |
| `role` | enum | NOT NULL | `owner` \| `admin` \| `member` |
| `joined_at` | timestamp | NOT NULL | `defaultNow()` |

#### `invitations`

| Column | Type | Key | Notes |
|---|---|---|---|
| `id` | uuid | PK | `defaultRandom()` |
| `workspace_id` | uuid | FK | → `workspaces.id` |
| `email` | text | NOT NULL | Invitee email address |
| `role` | enum | NOT NULL | Role to assign on accept |
| `token` | text | UNIQUE | `crypto.randomUUID()`, URL-safe |
| `invited_by` | uuid | FK | → `users.id` |
| `expires_at` | timestamp | NOT NULL | `now() + 7 days` |
| `accepted_at` | timestamp | | NULL until accepted |

---

## 4. Feature Specifications

### 4.1 Authentication (Clerk)

All auth UI is handled by Clerk's hosted components. Custom code is only needed to sync Clerk users into our database.

- Sign up with email/password or Google OAuth
- Email verification required before workspace access
- Clerk webhook: `user.created` → upsert into `users` table
- Clerk webhook: `user.updated` → sync email/name changes
- Session token available in middleware via `auth()` — includes `userId` and `orgId`

> ℹ️ Do NOT store passwords. Do NOT build custom auth flows. Clerk handles all of this.

### 4.2 Workspace Management

- Create workspace: name (free text) + slug (auto-generated, editable, must be unique)
- Slug rules: lowercase, alphanumeric + hyphens only, 3–30 chars, URL-safe
- Workspace switcher in sidebar: shows all workspaces the user belongs to
- Each workspace has its own isolated route: `/[workspace]/...`
- Middleware validates: workspace slug exists AND current user is a member
- If not a member → redirect to `/workspaces` (workspace selector page)
- Settings → General: update workspace name (owners and admins only)

### 4.3 Role-Based Access Control

| Permission | Owner | Admin | Member |
|---|---|---|---|
| View dashboard | ✓ | ✓ | ✓ |
| Invite members | ✓ | ✓ | ✗ |
| Change member roles | ✓ | ✗ | ✗ |
| Remove members | ✓ | ✓ | ✗ |
| View billing | ✓ | ✗ | ✗ |
| Upgrade / cancel plan | ✓ | ✗ | ✗ |
| Update workspace name | ✓ | ✓ | ✗ |
| Delete workspace | ✓ | ✗ | ✗ |

> ℹ️ Role checks must happen in tRPC procedures server-side. Never rely solely on client-side UI hiding to enforce permissions.

### 4.4 Member Invitation Flow

Step-by-step flow an agent must implement:

- Owner/admin opens Settings → Members → Invite Member
- Enters invitee email + selects role (`admin` \| `member`)
- System: check if email already a member → error if so
- System: check for existing pending invitation → error if so
- Insert invitation row with 7-day expiry token
- Send email via Resend: subject "You've been invited to [workspace name]"
- Email contains link: `https://[domain]/invite/[token]`
- Invitee clicks link → if not logged in, Clerk sign-up flow first
- After auth, `/invite/[token]` route: validate token (exists, not expired, not accepted)
- On accept: insert `workspace_members` row, mark invitation `accepted_at`
- Redirect to `/[workspace]/dashboard`

### 4.5 Stripe Billing

**Products to create in Stripe dashboard**

- Free plan: no Stripe product needed (default state)
- Pro plan: Monthly product at $29/month, Annual at $290/year
- Add metadata: `plan=pro` on the Stripe product

**Upgrade flow**

- User clicks "Upgrade to Pro" on billing page
- Server: create or retrieve Stripe customer for workspace
- Server: create Checkout session (mode: subscription, success/cancel URLs)
- Redirect user to Stripe Checkout
- On success: Stripe webhook fires `checkout.session.completed`

**Webhook events to handle**

| Event | Action |
|---|---|
| `checkout.session.completed` | Set `workspace.plan = pro`, save `stripe_subscription_id` |
| `customer.subscription.updated` | Sync status, `current_period_end` |
| `customer.subscription.deleted` | Set `workspace.plan = free`, clear subscription fields |
| `invoice.payment_failed` | Set `subscription_status = past_due` |

> ℹ️ Always verify webhook signatures using `stripe.webhooks.constructEvent()`. Never trust raw webhook body without verification.

- Customer Portal: one button in Settings → Billing → "Manage Subscription" → `stripe.billingPortal.sessions.create()`
- Portal lets users upgrade, downgrade, cancel, update payment method

---

## 5. tRPC Router Specifications

All procedures are in `server/trpc/routers/`. Every procedure that touches workspace data must use the `workspaceProcedure` base which validates membership.

### 5.1 Context Setup

```ts
// server/trpc/context.ts
export async function createTRPCContext() {
  const { userId, orgId } = await auth();
  return { userId, orgId, db };
}
```

### 5.2 Middleware Chain

```ts
const authedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.userId) throw new TRPCError({ code: 'UNAUTHORIZED' });
  return next({ ctx: { ...ctx, userId: ctx.userId } });
});

const workspaceProcedure = authedProcedure
  .input(z.object({ workspaceSlug: z.string() }))
  .use(async ({ ctx, input, next }) => {
    const member = await db.query.workspaceMembers...
    if (!member) throw new TRPCError({ code: 'FORBIDDEN' });
    return next({ ctx: { ...ctx, workspace: member.workspace, role: member.role } });
  });
```

### 5.3 Router: `workspace`

| Procedure | Type | Auth | Description |
|---|---|---|---|
| `create` | mutation | authed | Create workspace + insert creator as owner |
| `getAll` | query | authed | All workspaces current user belongs to |
| `getBySlug` | query | workspace | Single workspace with member count, plan |
| `update` | mutation | owner/admin | Update name (slug is immutable after creation) |
| `delete` | mutation | owner only | Delete workspace + cascade all members/invitations |

### 5.4 Router: `members`

| Procedure | Type | Auth | Description |
|---|---|---|---|
| `list` | query | workspace | All members with role, joined_at, user details |
| `invite` | mutation | owner/admin | Create invitation, send email |
| `acceptInvite` | mutation | authed | Validate token, insert member row |
| `updateRole` | mutation | owner only | Change member role (cannot change own role) |
| `remove` | mutation | owner/admin | Remove member (owner cannot be removed) |

### 5.5 Router: `billing`

| Procedure | Type | Auth | Description |
|---|---|---|---|
| `getStatus` | query | owner only | Current plan, status, period end |
| `createCheckout` | mutation | owner only | Create Stripe Checkout session → return URL |
| `createPortal` | mutation | owner only | Create Stripe Customer Portal session → return URL |

---

## 6. UI Pages & Components

### 6.1 Page Inventory

| Route | Access | Description |
|---|---|---|
| `/` | Public | Landing page with features + CTA |
| `/sign-in` | Public | Clerk SignIn component |
| `/sign-up` | Public | Clerk SignUp component |
| `/workspaces` | Authed | List + create workspace |
| `/[workspace]/dashboard` | Member | Main workspace overview |
| `/[workspace]/settings/general` | Owner/Admin | Workspace name, danger zone |
| `/[workspace]/settings/members` | Member | Member list, invite form |
| `/[workspace]/settings/billing` | Owner | Plan status, upgrade, portal |
| `/invite/[token]` | Authed | Accept workspace invitation |

### 6.2 Shared Layout Components

- Sidebar: workspace logo/name, nav links, workspace switcher at bottom, user avatar
- Workspace switcher: dropdown showing all user workspaces + "Create workspace" option
- Plan badge: shows "Pro" badge next to workspace name if `plan === pro`
- Settings tabs: General / Members / Billing (Billing tab hidden for non-owners)

### 6.3 Dashboard Page

- Workspace name as heading
- Stats row: member count, plan name, days until renewal (or "Free plan")
- Members table preview: first 5 members with avatar, name, role badge
- Quick actions: Invite Member button (only for owner/admin), Upgrade button (only for free plan owner)

### 6.4 Members Page

- Full member table: avatar, name, email, role badge, joined date, actions column
- Actions: change role dropdown (owner only), remove button (owner/admin)
- Cannot remove yourself if you are the only owner
- Invite section: email input + role select + Invite button
- Pending invitations list: email, role, expires, revoke button

### 6.5 Billing Page

- Current plan card: Free or Pro, with subscription status badge
- If free: feature comparison table + prominent Upgrade to Pro button
- If pro: renewal date, Manage Subscription button (opens Stripe portal)
- Invoice history is handled inside Stripe Customer Portal — do not build custom

---

## 7. Testing Requirements

### 7.1 Setup

```
pnpm add -D vitest @testing-library/react @testing-library/jest-dom
# vitest.config.ts: environment = 'jsdom', setupFiles = ['./test/setup.ts']
```

### 7.2 Required Test Coverage

The following tRPC procedures MUST have unit tests. Mock the Drizzle DB client and Clerk auth.

| Test | What to verify |
|---|---|
| `workspace.create` | Inserts workspace + inserts creator as owner |
| `workspace.create` (slug conflict) | Throws `TRPCError CONFLICT` when slug taken |
| `members.invite` (member tries) | Throws `FORBIDDEN` — members cannot invite |
| `members.updateRole` (admin tries) | Throws `FORBIDDEN` — only owners change roles |
| `members.remove` (owner only one) | Throws error — cannot remove last owner |
| `billing.createCheckout` (admin tries) | Throws `FORBIDDEN` — billing is owner-only |
| `members.acceptInvite` (expired) | Throws error when token is past `expires_at` |

---

## 8. Environment Variables

```bash
# .env.local

# Clerk
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
CLERK_WEBHOOK_SECRET=whsec_...

# Neon PostgreSQL
DATABASE_URL=postgresql://...neon.tech/saas-starter?sslmode=require

# Stripe
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRO_MONTHLY_PRICE_ID=price_...
STRIPE_PRO_ANNUAL_PRICE_ID=price_...

# Resend (email)
RESEND_API_KEY=re_...
EMAIL_FROM=noreply@yourdomain.com

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

> ℹ️ For Stripe webhooks in local development, use the Stripe CLI: `stripe listen --forward-to localhost:3000/api/webhooks/stripe`

---

## 9. Agent Build Instructions

Give these instructions to Claude Code, Cursor, or any coding agent at the start of the session:

### 9.1 Prompt to paste into the agent

> You are building a multi-tenant SaaS starter app. The full spec is in this document. Follow these rules strictly:

- Read the full spec before writing any code
- Complete one section at a time: schema → auth → tRPC routers → pages → tests
- Run `pnpm build` and fix all TypeScript errors before moving to the next section
- Every tRPC procedure that touches workspace data must use `workspaceProcedure`
- Never query the database without scoping to a `workspace_id`
- Never trust client-side role checks alone — always check server-side in tRPC
- Commit after each major section with a meaningful message
- Do not install packages not listed in the tech stack without asking

### 9.2 Build Order

| Step | Task | Definition of done |
|---|---|---|
| 1 | Project init | Next.js 16, TypeScript, Tailwind 4, shadcn/ui installed and running |
| 2 | Clerk auth | Sign up, sign in, sign out working. Middleware protecting `/[workspace]/*` |
| 3 | DB schema | All 4 tables created in Neon via `pnpm drizzle-kit push` |
| 4 | tRPC setup | Context, `authedProcedure`, `workspaceProcedure` all working |
| 5 | Workspace CRUD | Create, list, switch workspaces. `/workspaces` page functional |
| 6 | Members + RBAC | Invite flow, role enforcement, remove member all working |
| 7 | Stripe billing | Checkout, webhooks, portal all working in test mode |
| 8 | Tests | All 7 required tests passing, `pnpm test` exits 0 |
| 9 | Deploy | Live on Vercel, env vars set, Stripe webhook configured for prod URL |
| 10 | README | Live demo link, tech stack, features, setup instructions, architecture diagram |

---

## 10. Resume Bullets (After Completion)

Once the project is live, use these exact bullets on your resume — fill in the bracketed metrics from your actual build:

> Built a production-ready multi-tenant SaaS starter with org-based workspace isolation, Clerk authentication, and role-based access control (owner / admin / member) using Next.js 15 App Router, Drizzle ORM, and Neon PostgreSQL — deployed on Vercel with a live demo.

> Implemented end-to-end Stripe subscription billing with Checkout session creation, 4-event webhook lifecycle handling (created / updated / deleted / payment_failed), and Customer Portal integration — supporting free and pro plan tiers with server-side feature gating.

> Architected a type-safe API layer using tRPC v11 with Clerk auth context, role-based middleware chaining, and Drizzle ORM — ensuring every workspace mutation is permission-checked server-side with 80%+ Vitest unit test coverage on all auth-guarded procedures.