# StudySimplify

**Learn difficult topics the easy way.** A full-stack educational notes platform and digital ebook store for medical students. It includes structured study notes, a distraction-free reader, PDF ebooks, one-time purchases, optional subscriptions and an admin workspace.

- **Stack:** Next.js 16 (App Router), TypeScript (strict), Tailwind CSS 4, shadcn-style components on Radix, Supabase (Postgres, Auth, RLS, private Storage), Zod, React Hook Form, `@react-pdf/renderer` and `pdf-lib`, Recharts, Stripe or Razorpay, and Resend.
- **Modes:**
  - **Demo mode.** No Supabase is configured. Public pages show the bundled sample catalogue read-only. Accounts, purchases and admin are disabled, and a banner says so.
  - **Development payments.** `PAYMENT_PROVIDER=dev` adds a clearly labelled simulator. It sends signed webhooks through the real fulfilment path. No money moves, and it refuses to run when `APP_ENV=production`.
  - **Production.** Real Supabase, a real payment provider and a real email provider.

---

## Contents
1. [What is implemented](#what-is-implemented)
2. [Architecture and security model](#architecture-and-security-model)
3. [Local development](#local-development)
4. [Supabase setup](#supabase-setup)
5. [Payments](#payments)
6. [Email](#email)
7. [Environment variables](#environment-variables)
8. [Tests](#tests)
9. [Deploying to Vercel](#deploying-to-vercel)
10. [Production security checklist](#production-security-checklist)
11. [Backup and recovery](#backup-and-recovery)
12. [Troubleshooting](#troubleshooting)
13. [Sample content and content policy](#sample-content-and-content-policy)

---

## What is implemented

| Area | Where |
|---|---|
| Homepage, explore, subjects, product, preview, pricing, search, legal pages | `src/app/(site)` |
| Auth: register, verify email, login/logout, password reset, callback | `src/app/auth`, `src/server/actions/auth.ts` |
| Student area: dashboard, library, reader, bookmarks, highlights, progress, orders, account, subscription | `src/app/(site)/(student)`, `src/app/reader` |
| Reader: table of contents, chapters, prev/next, keyboard (←/→, `/`, Esc), font size, light/sepia/dark, in-document search, bookmarks, highlights with private notes, mark complete, resume position | `src/components/reader` |
| Structured note format (24 section kinds, depth labels, 13 block types) with Zod validation and a sanitising renderer | `src/lib/content`, `src/components/content` |
| Admin: overview, content list, create/edit, block editor, preview, versions/restore, publishing checklist, review sign-off, covers, PDF generate/upload, bulk PDF upload, categories, corrections, review moderation, orders and refunds, customers (roles, access grants), coupons, analytics, settings, account deletion processing | `src/app/admin`, `src/server/actions/admin` |
| PDF ebooks: cover, contents page with real page numbers, headers/footers, page numbers, Unicode scientific symbols (embedded DejaVu), answer key, references, version and copyright pages | `src/lib/pdf/document.tsx` |
| PDF delivery: private bucket, verification gate, 60-second signed URLs or buyer watermark | `src/app/api/downloads/[slug]`, `src/lib/pdf` |
| Commerce: server-priced orders, coupons, Stripe Checkout, Razorpay Checkout, signed and idempotent webhooks, entitlements, receipts, refunds | `src/lib/payments`, `src/app/api/webhooks/*` |
| Subscriptions (Stripe): plans, checkout, billing portal, cancellation, status sync, server-side entitlement | `src/server/actions/account.ts` |
| Database: schema, functions, RLS, storage policies, seed | `supabase/` |
| SEO: metadata, canonical URLs, Open Graph, JSON-LD, sitemap, robots (indexing only in production) | `src/app/sitemap.ts`, `src/app/robots.ts` |

---

## Architecture and security model

- **Rendering.** Server Components fetch data. Client Components are used only for interaction (reader, editor, forms). The app opts out of Cache Components because almost every page is personalised by session cookies.
- **Authentication.** `@supabase/ssr` keeps the session in cookies. `src/proxy.ts` (Next 16's replacement for middleware) refreshes it with `getClaims()` and redirects anonymous visitors away from private routes. Every page, server action and route handler checks authorisation again on the server (`requireUser`, `requirePermission`, `assertPermission`).
- **Roles.** These are `super_admin`, `content_editor`, `reviewer` and (implicitly) student. Roles live in `user_roles`, and only a super admin can insert rows there. The UI permission matrix (`src/lib/auth/roles.ts`) mirrors the database rules.
- **RLS everywhere.** Every table in `public` has RLS enabled. Highlights:
  - Note bodies live in `content_versions`. Anonymous visitors can read only free published versions. Signed-in users can read paid ones only when `private.content_access()` says they are entitled (free, purchase, bundle purchase, active subscription, admin grant, or staff).
  - Clients cannot insert or update orders, purchases, subscriptions, refunds or payment events. Those writes happen only in `SECURITY DEFINER` functions that are granted to `service_role`.
  - Students cannot change publication status, version pointers or reviewer fields (column-level grants). Publishing goes through `set_publication_status()`, which enforces the checklist (content exists; verified PDF if downloadable; bundles have items).
  - Content versions are immutable apart from PDF metadata. Restoring an old version creates a new one.
- **Previews.** The server decides access with `can_access_content()`. Visitors without access get only the sections marked "preview", read with the service role on the server. Locked sections are never sent to the browser.
- **Storage.** `covers` and `content-images` are public, and only editors can write to them. `ebooks` is private. There is no select policy for students, so they cannot list or read PDFs directly. Downloads use 60-second signed URLs created after an access check.
- **Service-role key.** It is only imported by `src/lib/supabase/admin.ts`, which carries `import "server-only"`. It is used for webhooks, previews, signed URLs, PDF metadata, and account deletion after permission checks.
- **Money.** Amounts are integers in minor units, and every amount carries an ISO currency. Reports are grouped by currency and never summed across currencies. See `src/lib/money.ts`.
- **Author content.** Notes are JSON blocks rendered as React elements. Inline formatting is a small markdown subset parsed into tokens, and HTML is always shown as text. LaTeX goes through KaTeX with `trust: false`. Images must come from our storage.

---

## Local development

Requirements: Node 20.9+ (22 recommended), npm, and optionally PostgreSQL 15+ for database tests.

```bash
npm install
cp .env.example .env.local
npm run dev            # http://localhost:3000
```

With an empty `.env.local` the app runs in **demo mode** using `src/lib/data/fixtures`.

To develop against Supabase, use either a hosted project or `supabase start` (Supabase CLI with Docker). Fill in the Supabase variables, then:

```bash
# Local CLI stack
supabase start
supabase db reset            # applies supabase/migrations/* and supabase/seed.sql
# or a hosted project
supabase link --project-ref <ref>
supabase db push             # migrations only; do NOT load seed.sql in production
```

**First admin.** Register an account in the app, then in the Supabase SQL editor run:

```sql
insert into public.user_roles (user_id, role)
select id, 'super_admin' from auth.users where email = 'you@example.com';
```

After that, manage other roles at **Admin → Customers**.

**Development payments.** Set `PAYMENT_PROVIDER=dev` and `DEV_PAYMENTS_SECRET=<random>`. Buying a title opens `/dev/checkout/<order>`, where you can simulate success or failure.

---

## Supabase setup

1. **Create a project** at supabase.com. Choose a region near your students (for India, `ap-south-1`).
2. **Run the migrations** in `supabase/migrations` in order, using `supabase db push` or the SQL editor. They create:
   - `..._core_schema.sql`: tables, enums, constraints, indexes and triggers (profile creation, search vectors, immutable versions).
   - `..._access_and_commerce_functions.sql`: role helpers, the access resolver, versioning and publishing, checkout, fulfilment, refunds, subscriptions, search and analytics.
   - `..._row_level_security.sql`: all policies and column grants.
   - `..._storage.sql`: buckets and storage policies.
   - `..._catalog_helpers.sql`: the aggregate popularity ranking.
3. **Storage.** The migration creates the buckets. Confirm `ebooks` is **private** in the dashboard.
4. **Auth.** Under Authentication → URL configuration:
   - Set the Site URL to your production URL.
   - Add redirect URLs: `https://your-domain/auth/callback`, your preview domain pattern, and `http://localhost:3000/auth/callback`.
   - Keep "Confirm email" enabled. Set the minimum password length to 10.
5. **Auth emails.** In Authentication → SMTP, use your email provider (e.g. Resend SMTP) so verification and reset emails come from your domain. Update the templates to link to `{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=<type>` (or keep the default PKCE links, which `/auth/callback` also supports).
6. **Seed data (development and preview only).** Run `npm run db:seed:generate` to regenerate `supabase/seed.sql` from the fixtures, then load it into non-production databases.
7. **Exposed schemas.** Expose only `public` (the default). The `private` schema must not be exposed.

---

## Payments

StudySimplify supports **Razorpay** (recommended for Indian merchants and INR) and **Stripe**. Check that your chosen provider supports your country, business type and the cards and UPI methods your students use before going live. Subscriptions are implemented for Stripe only.

The flow is the same for every provider:

1. Student clicks *Buy*. `create_pending_order()` prices the order **in the database** and applies any coupon.
2. The server creates the provider checkout and records the provider reference.
3. The student pays. The success redirect only shows a "waiting for confirmation" page.
4. The provider calls `/api/webhooks/<provider>` with a signed payload. The signature is verified with the exact raw body.
5. The event is recorded in `payment_events` (unique per provider and event id). `service_fulfill_order()` then locks the order, checks amount, currency and provider, marks it paid, and creates `purchases`, all in one transaction. Duplicate deliveries return `already_paid`.
6. A receipt email is sent. The title appears in the library.

**Stripe**
- Use `STRIPE_SECRET_KEY` (test mode first).
- Add a webhook endpoint `https://your-domain/api/webhooks/stripe` with these events: `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, `checkout.session.expired`, `refund.created`, `refund.updated`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`. Copy the signing secret to `STRIPE_WEBHOOK_SECRET`.
- For local testing: `stripe listen --forward-to localhost:3000/api/webhooks/stripe`.
- Subscriptions:
  1. Create a recurring Price in Stripe.
  2. Paste its ID in **Admin → Settings → plan**, then activate the plan.
  3. Set `SUBSCRIPTIONS_ENABLED=true`.
  4. Enable the Customer Portal in Stripe.

**Razorpay**
- Set `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` (test mode first).
- Add a webhook at `https://your-domain/api/webhooks/razorpay` with the events `order.paid`, `payment.failed` and `refund.processed`. Set a secret and copy it to `RAZORPAY_WEBHOOK_SECRET`.
- Checkout opens Razorpay's modal. Its browser callback is not trusted; `order.paid` grants access.

**Refunds.** Use **Admin → Orders → Refund**. For Stripe and Razorpay the refund is requested from the provider and recorded only when the provider's refund webhook confirms it. A full refund revokes access to that order's titles; a partial refund keeps access. This matches `/refund-policy`; edit both together.

**Prices.** The suggested prices (₹129–₹199 per title, ₹399 for the bundle, ₹249/month for Plus) are experiments, not validated market rates.

---

## Email

- Set `EMAIL_PROVIDER=resend`, `RESEND_API_KEY`, and an `EMAIL_FROM` on a verified domain.
- Transactional emails cover:
  - purchase receipts
  - payment failures
  - refunds
  - subscription status changes
  - optional "content updated" notices (sent from the admin Versions tab, respecting each user's preference)
  - account deletion confirmation
- Every attempt is written to `email_log` with `sent`, `skipped` or `failed`. With no provider configured, nothing is sent, and the UI and admin messages say so.
- Product announcements are opt-in (Account → Email preferences).

---

## Environment variables

See `.env.example`. Summary:

| Variable | Scope | Purpose |
|---|---|---|
| `NEXT_PUBLIC_SITE_URL` | public | Canonical URL, email links, payment return URLs |
| `NEXT_PUBLIC_APP_ENV` / `APP_ENV` | public / server | `development`, `preview` or `production` |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | public | Supabase client (RLS-limited) |
| `SUPABASE_SECRET_KEY` | **server** | Service role (webhooks, previews, signed URLs) |
| `PAYMENT_PROVIDER` + provider keys | **server** | `none`, `dev`, `stripe` or `razorpay` |
| `SUBSCRIPTIONS_ENABLED` | server | Enables Stripe subscriptions |
| `EMAIL_PROVIDER`, `RESEND_API_KEY`, `EMAIL_FROM` | server | Transactional email |
| `PDF_WATERMARK` | server | Buyer licence line on paid downloads |
| `CONTACT_EMAIL` | server | Shown on the contact page and footer |

Use separate Supabase projects and provider test keys for **Development** and **Preview**, and live keys only in **Production**.

---

## Tests

```bash
npm run typecheck
npm run lint
npm run test:unit      # Vitest: content safety, schema, money, validation, roles, webhooks, idempotent processing, PDF generation/verification/watermark
npm run test:db        # Vitest + PostgreSQL: migrations, RLS cross-user isolation, drafts, storage, publishing rules, checkout pricing, coupons, idempotent fulfilment, refunds, subscription expiry, admin grants
npm run build && npm run test:e2e   # Playwright (desktop + mobile) against the production build in demo mode
```

- **Database tests** create a throwaway database at `TEST_DATABASE_URL`. They load `supabase/tests/supabase-stub.sql` (a minimal stand-in for Supabase's `auth`/`storage` schemas and API roles), every migration and the seed. Queries then run as `anon`, specific users or `service_role`, the way PostgREST does.
- **E2E tests** need a Chromium. Use `npx playwright install chromium`, or point `CHROMIUM_PATH` at an existing binary.

---

## Deploying to Vercel

1. Push the repository to GitHub and import it in Vercel (framework: Next.js).
2. Add the environment variables for Production, Preview and Development separately. Preview should use a separate Supabase project and provider **test** keys.
3. Set `NEXT_PUBLIC_SITE_URL` to the deployment's public URL, and `APP_ENV`/`NEXT_PUBLIC_APP_ENV=production` for Production only.
4. Deploy. The PDF fonts in `assets/fonts` are included through `outputFileTracingIncludes`.
5. Update the payment webhook URLs and Supabase redirect URLs to the production domain.
6. **Custom domain.** Add it in Vercel → Domains and set the DNS records Vercel shows. Then update `NEXT_PUBLIC_SITE_URL`, the Supabase Site URL and redirects, webhook endpoints, and the email sender domain.

PDF generation runs in a serverless function. Very long ebooks may need a longer function timeout (Vercel → Settings → Functions).

---

## Production security checklist

- [ ] `APP_ENV=production` and `PAYMENT_PROVIDER` is `stripe` or `razorpay` (never `dev`; the app refuses to start with it).
- [ ] `SUPABASE_SECRET_KEY` is set only as a server variable and is never prefixed `NEXT_PUBLIC_`.
- [ ] The `ebooks` bucket is private. Only `public` is exposed in the Data API.
- [ ] Email confirmation is on, and the minimum password length is 10 or more. Leaked-password protection is enabled if your plan has it.
- [ ] Webhook secrets are configured and a test event shows `processed` in **Admin → Settings**.
- [ ] A real test purchase and refund have been completed end to end in the provider's test mode.
- [ ] The seed sample content has **not** been loaded, or it has been reviewed by a qualified expert before being published.
- [ ] The legal pages (`/terms`, `/privacy`, `/refund-policy`) have been reviewed by a lawyer and every `[placeholder]` filled in.
- [ ] At least two super admins exist, and each has enabled multi-factor authentication on their Supabase Auth account (enforcing an MFA level for admin routes is a recommended follow-up).
- [ ] Supabase backups (and Point-in-Time Recovery if your plan has it) are enabled.
- [ ] Database advisors (Supabase → Advisors) show no security warnings.

---

## Backup and recovery

- **Database.** Supabase takes daily backups (and PITR on paid plans). For an independent copy, run `supabase db dump -f backup.sql` (schema) and `supabase db dump --data-only -f data.sql` on a schedule, and store them encrypted off-site.
- **Storage.** Back up the `ebooks` and `covers` buckets periodically, for example with the Storage API or `rclone` using an S3-compatible access key.
- **Restore.** Create a new project, apply the migrations, restore the data dump, upload the storage objects, and point the environment variables at the new project.
- **Content.** Every saved content version is kept, so an editor can restore any earlier version from **Admin → Content → Versions**.

---

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| "Demo mode" banner in a deployed app | `NEXT_PUBLIC_SUPABASE_URL` or the publishable key is missing in that Vercel environment (rebuild after setting it). |
| Purchases show "unavailable" | `SUPABASE_SECRET_KEY` or the provider keys or webhook secret are missing. **Admin → Settings** shows which. |
| Order stays "Waiting for payment confirmation" | The webhook is not reaching the app. Check the provider dashboard's delivery log and the endpoint URL and secret. `payment_events` shows received events. |
| Webhook returns 400 "Invalid signature" | Wrong signing secret, or a proxy is modifying the body. |
| Email verification links go to localhost | Supabase Site URL and redirect URLs need updating. |
| `permission denied for schema private` | Migrations were not all applied (the grants are at the end of the functions migration). |
| PDF generation times out | Increase the function max duration, or upload a pre-built PDF instead. |
| Images from storage do not load | `NEXT_PUBLIC_SUPABASE_URL` must be set at build time (it configures `next/image`). |

---

## Sample content and content policy

The five sample notes and one bundle in `src/lib/data/fixtures` were written for development. They cite only well-known textbooks, by title and author with no invented page numbers, but **they have not been independently reviewed**. Their byline says "sample content", and every product page states the review status.

Before publishing any material:
- have it reviewed by a qualified subject expert
- record the review with **Admin → Publishing → Mark as reviewed**
- publish only material you have the rights to distribute

Students can report errors from any title or section, and editors process the reports at **Admin → Corrections**.
