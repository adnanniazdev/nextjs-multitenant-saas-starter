# Project Roadmap & Progress Tracker

This document outlines the design phases, architecture implementation, and development progress for the **Premium Multi-Tenant SaaS Starter**. It is updated incrementally with each feature implementation.

---

## 🚀 Milestones & Implementation Progress

### Phase 1: Foundation & Tooling ➔ `Completed`
- [x] Next.js 15 App Router & React 19 bootstrap
- [x] Biome.dev integrated (linting, formatting, imports)
- [x] Strict TypeScript configuration
- [x] Tailwind CSS 4 setup
- [x] Drizzle ORM config initialized
- [x] Repository initialized & linked to GitHub

### Phase 2: Database Schemas & Neon RLS ➔ `In Progress`
- [x] Drizzle schema definition (`users`, `workspaces`, `workspace_members`, `invitations`, `processed_webhook_events`)
- [ ] Database connection setup with Neon Serverless driver
- [ ] Neon/PostgreSQL Row-Level Security (RLS) policies SQL script
- [ ] Dynamic session-variable injector for query-level security boundaries

### Phase 3: Subdomain Rewrite Routing & Auth
- [ ] Clerk Authentication integration
- [ ] Next.js 15 Middleware subdomain parsing (`[workspace].lvh.me` rewrite)
- [ ] Auth guard logic checking Clerk session token + tenant membership

### Phase 4: API Layer (Server Actions & tRPC v11)
- [ ] tRPC context & workspaceProcedure middleware (auto-enforcing RLS session context)
- [ ] Next.js Server Actions for mutations (workspace creation, invitations)
- [ ] React 19 `useActionState` and `useOptimistic` integration
- [ ] tRPC procedures for data loading

### Phase 5: Webhooks & Resilience
- [ ] Clerk sync webhook via `svix` (creation, updates, deletions)
- [ ] Stripe checkout session & billing portal integration
- [ ] Stripe webhook handler with signature validation and processed event idempotency logs

### Phase 6: Core SaaS UI (Dashboard & Settings)
- [ ] Workspace switcher & layout shell
- [ ] Main dashboard (tenant metadata, stats, action items)
- [ ] Members settings (invite form, member list, role updates)
- [ ] Billing page (plan cards, stripe portal redirect button)

### Phase 7: Quality Assurance & Testing
- [ ] Vitest unit testing setup (mocking Clerk and database clients)
- [ ] Playwright E2E testing for the critical sign-up ➔ checkout flow
- [ ] Test suites execution checks

### Phase 8: CI/CD Pipeline
- [ ] GitHub Actions workflow configuration (`ci.yml`)
- [ ] Automated validation on PRs (lint, typecheck, unit tests, E2E run)

---

## 🛠️ Tech Stack Cheat Sheet
- **Framework:** Next.js 15 (App Router) & React 19
- **Auth:** Clerk (Organizations & Invitations)
- **DB:** Neon Postgres & Drizzle ORM
- **API:** tRPC v11 & Next.js Server Actions
- **Billing:** Stripe (Checkout & Customer Portal)
- **Tooling:** Biome.dev & Tailwind CSS 4
- **Testing:** Vitest & Playwright
