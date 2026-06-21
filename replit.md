# CommerceIQ — E-Commerce Analytics & Recommendation System

An AI-powered e-commerce analytics platform that helps businesses analyze customer behavior, track sales performance, predict future trends, and recommend products to customers.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080, served at /api)
- `pnpm --filter @workspace/analytics-dashboard run dev` — run the frontend dashboard
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Login Credentials (seeded)

- **Admin:** admin@ecommerce.com / admin123
- **Customer:** sarah.johnson@email.com / pass123

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5 (Node.js)
- Frontend: React + Vite + Tailwind CSS + Recharts
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `lib/api-spec/openapi.yaml` — API contract (source of truth)
- `lib/db/src/schema/` — Drizzle ORM tables (users, products, orders, order_items, reviews)
- `artifacts/api-server/src/routes/` — Express route handlers by domain
- `artifacts/analytics-dashboard/src/pages/` — React frontend pages

## Architecture decisions

- Contract-first: OpenAPI spec gates codegen, which gates the frontend hooks
- All analytics (revenue, profit, segments, CLV) computed from raw order data server-side
- RFM segmentation: Champions/Loyal/Potential/At Risk/Lost computed per customer from recency, frequency, monetary scores
- Forecasting uses linear regression on historical order data (no Python ML dependencies)
- Recommendations use collaborative filtering signals (co-purchased products) + content-based (category affinity) + popularity-based fallbacks

## Product

- **Dashboard:** KPI summary, revenue chart, recent activity feed, top products
- **Products:** Catalog with search/filter, CRUD, demand forecast per product
- **Customers:** RFM segments, CLV, purchase history, personalized recommendations
- **Orders:** Full order history with date range filter
- **Analytics → Sales:** Revenue over time, sales reports, profit analysis by category
- **Analytics → Customers:** Segment distribution, retention metrics, purchase frequency
- **Recommendations:** Trending, personalized, frequently bought together
- **Forecasting:** Sales forecast with confidence intervals, inventory stockout alerts

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- After any OpenAPI spec change, always run `pnpm --filter @workspace/api-spec run codegen` before running typecheck
- Avoid operation-shaped body schema names in OpenAPI (use NoteInput not CreateNoteBody) — see openapi.md for details
- The `ne` import from drizzle-orm may be unused in recommendations.ts — remove if typecheck complains

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
- OpenAPI spec: `lib/api-spec/openapi.yaml`
- DB schema: `lib/db/src/schema/`
