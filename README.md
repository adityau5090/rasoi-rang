# रसोई रंग · Rasoi Rang

A live restaurant ordering system with a Rajasthani *haveli* look. Customers order from a phone, the kitchen sees tickets arrive instantly, and customers watch four diyas light up as their food goes **Received → Preparing → Ready → Served**.

**Stack:** Next.js 14 (App Router, TypeScript) · TanStack Query · PostgreSQL (Neon or Supabase, via `pg`) · Server-Sent Events · Zod · JWT cookie auth (jose + bcryptjs) · Vitest.
**Hosting:** built for **Vercel** (serverless) and also runs on any Node host.

> **Live demo:** _add your Vercel URL here after deploying_

---

## 1. Run it locally (step by step)

You need **Node.js 20 or newer**. No database setup is needed for local development: when `DATABASE_URL` is empty the app uses a built-in Postgres (PGlite) stored in `./data/pglite`.

```bash
# 1. install
npm install

# 2. create your env file (never commit .env.local)
cp .env.example .env.local
#    leave DATABASE_URL and AUTH_SECRET empty for local development

# 3. start (AUTO_SEED=true creates the demo menu, users and orders on first run)
npm run dev
```

Open <http://localhost:3000>. Tip: open the customer page on your phone (same Wi-Fi, `http://<your-laptop-ip>:3000`) and the kitchen page on your laptop to watch live updates.

Other commands: `npm test` · `npm run typecheck` · `npm run build && npm start` · `npm run seed` (wipes and re-seeds the database in `DATABASE_URL`, or the local one; stop `npm run dev` first when using the local database).

To develop against your real Neon/Supabase database, put its URL in `DATABASE_URL` in `.env.local`.

### Demo logins

| Role | Email | Password | Can open |
|---|---|---|---|
| Admin | `admin@rasoi.test` | `admin123` | `/admin` (revenue, menu) and `/kitchen` |
| Kitchen | `kitchen@rasoi.test` | `kitchen123` | `/kitchen` |

Customers need no login: they order at `/` and get a private link like `/order/<random token>`.

### Try the whole flow in 2 minutes
1. Open `/` in a phone-sized window, add *Dal Baati Churma* (choose **Half** or **Full**), enter a table number, place the order.
2. In another window sign in as kitchen at `/login`, open `/kitchen`, press **Turn sound on**. The new ticket appears by itself.
3. Press **Start preparing**. The customer page updates with no refresh.
4. Sign in as admin, open `/admin`, switch **Sold out** on a dish. It disappears from any open cart right away.
5. The seeded order from 21 minutes ago glows red on the kitchen board (late-order highlight and beep).

---

## 2. Deploy on Vercel with Neon (or Supabase)

### A. Create the database (2 minutes)
**Neon (recommended):** sign up at neon.tech → *New project* → on the dashboard open *Connection details*, switch on **Pooled connection**, and copy the string. It looks like `postgresql://…-pooler.<region>.aws.neon.tech/neondb?sslmode=require`.
*Shortcut:* in Vercel, *Storage → Create → Neon* adds `DATABASE_URL` to your project automatically.

**Supabase instead:** *Project → Connect →* copy the **Transaction pooler** string (port 6543). You use Supabase only as a Postgres database; all logic stays in this backend. If the first request fails with `self-signed certificate in certificate chain`, add `PG_SSL_NO_VERIFY=true`.

No tables to create by hand: the app creates them on first start.

**Check the connection before running the app:** put the string in `.env.local` as `DATABASE_URL=...` and run `npm run db:check`. It prints the host it connected to and the row counts; then `npm run seed` loads the demo menu and logins.

### B. Deploy
1. Push this repo to GitHub (`.env.local` and `data/` are git-ignored).
2. vercel.com → **Add New → Project** → import the repo. Vercel detects Next.js; keep the defaults.
3. Add **Environment Variables** (same names as `.env.example`):

   | Name | Value |
   |---|---|
   | `DATABASE_URL` | the pooled Neon/Supabase string |
   | `AUTH_SECRET` | output of `openssl rand -base64 48` |
   | `AUTO_SEED` | `true` (first deploy only) |
   | `SEED_ADMIN_PASSWORD`, `SEED_KITCHEN_PASSWORD` | strong passwords if the URL is public |
   | `APP_TIMEZONE` | `Asia/Kolkata` (or yours) |

4. **Deploy.** Open the URL. The first request creates the tables and the demo data. Sign in at `/login`.
5. After the first successful run set `AUTO_SEED=false` and redeploy (optional; it only seeds an empty database anyway).
6. Speed tip: *Project → Settings → Functions → Region* → pick the region nearest your database.
7. Put the URL at the top of this README.

*Seeding from your laptop instead:* put the Neon string in `.env.local` and run `npm run seed`.

### Things to know about live updates on Vercel
- Streams close themselves every ~50 seconds (before the function time limit) and the browser reconnects instantly. The server replays anything missed using `Last-Event-ID`, so users never notice.
- Each open stream checks the database once per `SSE_POLL_MS` (default 1 second). For one restaurant this is tiny, but it keeps a Neon free-tier database awake while a kitchen screen is open. Set `SSE_POLL_MS=2000` to halve it.
- If you move to a plan with a longer function limit you can raise `maxDuration`/`LIFETIME_MS` in `lib/server/sse.ts`.

---

## 3. Requirements checklist

| Requirement | Where |
|---|---|
| Admin manages categories, items, price, availability, variants (Half/Full) | `/admin` → Menu tab · `lib/server/menu.ts` |
| Customer cart, order for a table number or takeaway | `/` · `components/CartPanel.tsx` |
| Cart stays in view while scrolling the menu | sticky side cart on laptops, fixed cart bar + bottom sheet on phones (`app/globals.css`) |
| "My orders": a customer sees all their orders and live status | `/orders` · `lib/client/myOrders.tsx` · `/api/my-orders` |
| Kitchen screen, live, Received → Preparing → Ready → Served | `/kitchen` · `app/api/kitchen/*` |
| Customer order page updates live | `/order/[token]` · SSE stream |
| Admin: today's orders and revenue | `/admin` → Today tab · `todayStats()` |
| Live updates via SSE, no manual refresh | `lib/server/sse.ts`, `lib/client/useLive.ts` |
| Prices calculated on server | `priceLines()` in `lib/server/orders.ts` |
| **Stretch:** out-of-stock item vanishes from open carts | menu SSE stream + prune effect in `app/page.tsx` |
| **Stretch:** highlight + sound for orders waiting > 15 min | `/kitchen` (`NEXT_PUBLIC_LATE_MINUTES`) |
| Server-side validation + clear UI errors | `lib/server/validation.ts`, field errors under every input |
| Works on phone and laptop | Bottom-sheet cart and tabbed kitchen board on phones; side cart and 4 columns on laptops |
| ≥ 5 automated tests | `tests/backend.test.ts` (21 tests, run on in-memory Postgres) |
| Seed script / demo data, demo logins | `AUTO_SEED` / `npm run seed`, table above |
| `.env.example`, no secrets committed | `.env.example`, `.gitignore` |

---

## 4. Data model (PostgreSQL)

```
users        id, email (unique), password_hash (bcrypt), role: admin | kitchen
categories   id, name, sort
items        id, category_id → categories, name, description, veg, available, sort
variants     id, item_id → items, label ("Half", "Full", "Regular"), price_paise, sort
orders       id, token (unguessable, public link), number, day (YYYY-MM-DD), UNIQUE(day, number),
             type: dine_in | takeaway, table_number, customer_name, note,
             status: received | preparing | ready | served,
             total_paise, created_at, updated_at   (epoch ms)
order_items  id, order_id → orders, item_id, variant_id,
             name, variant_label, unit_price_paise, qty      ← snapshot of what was sold
events       id, channel, payload (jsonb), created_at         ← live-update log read by the SSE streams
rate_hits    rkey, hit_at                                     ← rate limiting that works across serverless instances
```

Every dish has at least one **variant**. A "half or full plate" dish has two; a chai has one called "Cup". The cart always points to a `variantId`, and the price lives only on the variant.

## 5. Main design decisions

**Prices never come from the browser.** The order API accepts only `{ itemId, variantId, qty }` per line. `priceLines()` loads each variant joined to its item, checks the variant belongs to that item, rejects sold-out or deleted dishes, merges duplicate lines and computes the total in integer **paise** (no floating point). Extra fields such as `price` or `totalPaise` are dropped by the Zod schema; a test proves a tampered request still gets the menu price. The cart shows an *estimate* from the live menu and says so; the real total comes back from the server.

**Order lines are snapshots.** `order_items` copies the dish name, size and unit price, so editing or deleting a menu item later never changes past orders or revenue (tested).

**Live updates use SSE that works on serverless.** On Vercel every request may run in a different instance, so an in-memory event emitter cannot work. Instead:
1. Whenever an order or the menu changes, the service layer inserts a row into the `events` table.
2. Each open SSE connection polls that table for rows newer than its cursor and pushes them to the browser.
3. Every frame carries its event `id`. When a stream ends or the network drops, `EventSource` reconnects and automatically sends `Last-Event-ID`; the server resumes from there, so no update is lost.

There are three streams: `/api/orders/[token]/stream` (one customer, sends the current state first), `/api/kitchen/stream` (kitchen and admin) and `/api/menu/stream`. On the client, TanStack Query holds the data: SSE messages either write straight into the cache (`setQueryData`, customer page) or invalidate a query (kitchen, admin, menu). A slow 30-second refetch remains only as a safety net.

**The status machine is enforced on the server.** An order moves exactly one step forward. Skipping or going back is rejected with 409, and the update is a compare-and-set (`WHERE status = <what I read>`), so two kitchen tablets cannot both win.

**Order numbers are safe under concurrency.** Placing an order takes a per-day Postgres advisory lock before reading the next number, and `UNIQUE(day, number)` is the safety net (tested with simultaneous orders).

**Auth is small on purpose.** Staff only; customers don't log in. bcrypt password check, then a signed JWT in an `httpOnly`, `SameSite=Lax`, `Secure`-in-production cookie. Every admin/kitchen API calls `requireRole()`, so page-level hiding is only cosmetic. Login and order placement are rate-limited per IP in the database. Customers see only their own order through a 128-bit random token.

**Out-of-stock removal from carts.** The cart stores only ids and quantities. When an admin flips a dish to *Sold out*, the menu stream fires, the menu refetches and an effect removes the affected lines with a notice. The server also rejects a sold-out dish at checkout (`SOLD_OUT`), covering the race where someone taps "Place order" a moment too late.

**Late orders.** Orders in *Received* or *Preparing* longer than `NEXT_PUBLIC_LATE_MINUTES` (default 15) get a pulsing red ticket and a "Waiting too long" tag; with sound on, a beep plays once as each order crosses the line. Age uses the server's clock (offset sent with the board), so a wrong tablet clock does not matter. Browsers block audio until a tap, hence the **Turn sound on** button.

**My orders (no customer accounts).** When someone places an order, the browser stores that order's private token in `localStorage`. `/orders` sends the tokens to `POST /api/my-orders`, which returns only those orders, and one live stream (`/api/my-orders/stream`) updates all of them at once. A badge in the top bar shows how many orders are still in the kitchen, and the menu page shows a live strip of them. Opening an order link on another device adds it to that device's list. History lives on the device (with a "Clear history" button); the restaurant keeps its records.

**Design.** Built from Rajasthani craft: Jaipur sandstone with *bandhani* dots, a *sindoor*-red header with turmeric zig-zag trim and *toran* scallops, dish tiles shaped like *jharokha* windows, an SVG mandala logo, and the order tracker as four *diyas* that light up one by one. The kitchen uses a night-indigo theme that reads well in a bright, steamy kitchen. Motion and interaction: a sticky top bar that shrinks on scroll with a reading-progress line; a hero with a parallax mandala and floating diyas; a scrolling dish ticker; dish cards that fade and rise as you scroll; a scroll-spy category bar that follows the section you are reading; search and a Veg-only filter; a marigold bead that flies from *Add* to the cart; animated totals; a thread that "burns" along the order tracker as diyas light up; and a petal shower when the food is ready. All animation is CSS or small hooks and switches off for people who prefer reduced motion. Fonts: Yatra One and Mukta (both support Devanagari).

**"Today" and timezone.** Each order stores a `day` computed in `APP_TIMEZONE`. Order numbers restart at 1 each day and revenue is the sum of that day's orders.

## 6. What is finished, what isn't

**Finished:** the whole core list and both stretch goals; field-level validation messages; seed data; 21 backend tests; production build; verified end to end against a real PostgreSQL 16 server (auth, roles, tampered price, status rules, live streams, Last-Event-ID resume, sold-out handling).

**Not done / known limits**
- Live updates are **polling-backed SSE** (about 1 database query per second per open stream). Fine for one restaurant; at larger scale use Postgres `LISTEN/NOTIFY` or Redis pub/sub and a host that keeps long connections open.
- No online payments, no order cancellation or refunds, no ticket printing.
- Admin can't reorder categories or dishes (creation order) and can't manage staff accounts from the UI.
- No browser/end-to-end tests; the 21 tests cover backend logic and the event log.
- Customers identify an order by its link; there is no order history beyond the last one on this device.

**With more time**
1. Playwright end-to-end tests for order → kitchen → customer, including a dropped-connection test.
2. `LISTEN/NOTIFY` (or Redis) so streams wake instantly instead of polling.
3. Menu photos (Supabase Storage), drag-to-reorder, add-ons (extra butter, spice level).
4. Cancel/void with an audit log, revenue charts, CSV export.
5. Web push when an order is Ready; a QR code per table that pre-fills the table number.
6. Hindi/English toggle.

## 7. Project layout

```
app/                 pages (/, /order/[token], /kitchen, /admin, /login) and app/api/* route handlers
components/          CartPanel, Chrome (top bar), Hero, ActiveOrders, OrderProgress, Reveal, Money, Petals, Ornaments, Toast
lib/shared.ts        types and helpers used by both server and browser
lib/server/          db (pg / PGlite), orders (pricing + status machine), menu, validation,
                     session/auth, sse, events, ratelimit, seed
lib/client/          fetch wrapper, cart store, useLive (SSE hook), sound
scripts/seed.ts      npm run seed
tests/               Vitest backend tests (in-memory Postgres via PGlite)
```

## 8. API summary

| Method & path | Who | Purpose |
|---|---|---|
| `GET /api/menu` | public | categories, dishes, variants, availability |
| `GET /api/menu/stream` | public | SSE: menu changed |
| `POST /api/orders` | public (rate limited) | place order `{type, tableNumber?, customerName, note, lines[{itemId,variantId,qty}]}` |
| `GET /api/orders/:token` · `/stream` | holder of the token | order + live status |
| `POST /api/my-orders` · `GET /api/my-orders/stream?tokens=` | holder of the tokens | a customer's order history, live |
| `GET /api/kitchen/orders` · `/stream` | kitchen, admin | board and live events |
| `PATCH /api/kitchen/orders/:id` | kitchen, admin | `{status}`, one step forward only |
| `GET /api/admin/stats` | admin | today's orders and revenue |
| `POST/PATCH/DELETE /api/admin/categories[/:id]` | admin | manage categories |
| `POST/PATCH/DELETE /api/admin/items[/:id]` | admin | manage dishes, variants, availability |
| `POST /api/auth/login` · `logout` · `GET me` | | staff session |

Errors always look like `{ "error": "human message", "code"?: "...", "fields"?: { "tableNumber": "..." } }`, and the UI shows `fields` under the matching input.

## 9. AI tools used

- **Claude (Anthropic)** wrote the first full draft of this project from my brief: the Next.js code, the Postgres schema, the API routes, the Rajasthani CSS, the tests and this README. It also ran the type checker, the test suite, a production build and an end-to-end API smoke test against a real PostgreSQL server during development, and reworked the first SQLite version into the serverless-ready Postgres design.
- I (the author) reviewed the code, chose the stack and design direction, and verified the behaviour. _Edit this section to describe exactly what you did yourself, so it is accurate._
