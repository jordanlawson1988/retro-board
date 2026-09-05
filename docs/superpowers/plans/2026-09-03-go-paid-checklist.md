# Go-Paid Checklist

Verified against prod (`main`), the Vercel account, the Neon database, and the `feature/phase0-billing` branch on 2026-09-03. Where this disagrees with the prerequisite block in `2026-06-10-phase0-billing-paddle.md`, this file wins.

## Where things stand

Already true, live in prod unless noted:

- The Vercel team is on Pro. The June review listed this as blocker C6. It is done.
- `/api/admin/*` requires a system-admin session on all five routes. Ably tokens are scoped per board. Upstash rate limits sit on join, create, cards, votes, and action items.
- `/terms`, `/privacy`, and `/refunds` are live and already name Paddle. The footer links to support@retroboard.live and an abuse-report address.
- Password reset works through Resend from noreply@retroboard.live. Turnstile guards signup. A GitHub Actions CI workflow exists on `develop` and has not reached `main` yet.
- Migration 010 is applied to the prod database. `subscriptions` and `free_access` exist with zero rows.
- On `feature/phase0-billing` (4 commits, unmerged, last touched 2026-06-10, 32 commits behind `develop`): `lib/entitlements.ts` with unit tests, and the create/reopen/restore gate that requires an account plus an entitlement.

Not true yet:

- Anonymous board creation still works in prod. Until the billing branch ships, an incognito tab bypasses any paywall.
- Nothing Paddle-related exists in code. No SDK, no checkout, no webhook, no pricing section, no upgrade modal, no plan badge on the dashboard.
- No allowlist admin page. `free_access` has no UI.
- Email verification is off. All 8 accounts have `emailVerified = false`. The allowlist matches on raw email, so a comp can be claimed by whoever registers that address first.
- No Paddle account, no Paddle env vars in Vercel, and nobody has confirmed that support@retroboard.live is delivered anywhere.

Live usage on 2026-09-03:

| Measure | Count |
|---|---|
| Accounts | 8 (4 created in the last 30 days) |
| Boards created, last 30 days | 15 |
| Boards by month | Jul 18, Aug 15 |
| Distinct participants, last 30 days | 73 |
| Cards written, last 30 days | 206 |
| Boards owned by an account | 14, across 4 owners |
| Paying subscribers | 0 |

## 1. Decide (blocks everything, ten minutes)

1. Price. $3.99 was locked on 2026-06-10. The 2026-08-21 paywall request said $4.99. Recommendation: $4.99. Net after Paddle is about $4.24 instead of $3.29, break-even drops from 8 subscribers to 6, and it still sits under the $5 line where nobody deliberates. No built code references the price, so either answer costs nothing. If you pick $4.99, update `app/terms/page.tsx` and `app/refunds/page.tsx`, which both say $3.99 today.
2. Free tier rule. What is built: 1 active board, so completing a retro frees the slot. What you asked for in August: 1 free board ever, then a consent modal and a charge. Recommendation: the lifetime cap. Under "1 active", a team that finishes each retro never pays, and finishing the retro is the normal path. The cost is a `boards_created` counter (a plain board count decays when Trash purges) and roughly half a day. Keep the number a constant so it can move to 2 or 3 if the wall feels harsh.
3. Existing owners. The June plan comps every current registered owner into `free_access` forever. That is 4 people, and they are the only 4 who have shown creator intent. If the goal is to learn whether anyone pays, do not comp them. Their existing boards stay untouched either way, because the gate only runs on the next create, reopen, or restore.

## 2. Only you can do these (start today)

- Create the Paddle account. Sandbox is instant. Submit the live account for verification the same day. It takes days, sometimes longer, and needs business details, the retroboard.live domain, and the terms, privacy, and refund URLs, which are already live. This is the long pole for the whole effort.
- In the Paddle sandbox: product "RetroBoard Pro", one monthly recurring price at the amount from decision 1, a client-side token, a webhook secret. Repeat in the live dashboard once approved.
- Make sure support@retroboard.live reaches your inbox. The footer already links to it and Paddle will ask for it.
- Put the Paddle values into `.env.local` and into Vercel: sandbox values on Preview, live values on Production. The variable list is in the prerequisites block at the top of `2026-06-10-phase0-billing-paddle.md`.
- Turn on Paddle's built-in receipt and failed-payment emails in the dashboard. Zero code.

## 3. Code left (2 to 3 focused dev days, subagent-driven)

Rebase `feature/phase0-billing` onto `develop` first and rerun `npm test`. The branch predates the mobile overhaul and two hotfixes.

Then, in plan order:

- Counter migration and entitlement tweak, only if decision 2 is the lifetime cap. Half a day.
- Paddle server client and the webhook that upserts one `subscriptions` row per user (plan Task 5).
- `/api/user/entitlement` plus a billing-portal link so people can cancel or change cards without emailing you (Task 6).
- Upgrade modal with Paddle overlay checkout, wired to the 402 the create gate already returns (Task 7).
- Pricing section on the homepage and a plan badge on the dashboard (Task 8). Task 9, legal pages and footer, is already live. Skip it.
- `/admin/free-access` allowlist page for comping people (Task 10).
- Email verification through Resend, and only honor the allowlist for verified accounts. Not in the original plan. It closes the comp-theft hole and makes throwaway accounts cost a real inbox, which matters more under a lifetime cap. About half a day.
- Sandbox end-to-end on a preview deployment: hit the limit, see the modal, pay with a Paddle test card, webhook lands, board creates, cancel through the portal (Task 11).
- Dashboard banner announcing the date, then ship the branch to `develop` (Tasks 12 and 13).

## 4. Flip day (manual, about an hour)

1. Paddle live approved, live product and price created, live env on Vercel Production, webhook destination set to `https://retroboard.live/api/webhooks/paddle`.
2. Seed `free_access` per decision 3. At minimum, your own account.
3. `/deploy-check`, then merge to `main`.
4. Smoke on prod: anonymous join on an existing board still needs no account, logged-out create sends you to signup, buy Pro with a real card, refund yourself from the Paddle dashboard.
5. Remove the banner.

## 5. Not needed to charge money

Do these in the first weeks after the flip, roughly in this order: error monitoring and an uptime ping (there is none today), five funnel events so you can see conversion (there are no analytics today), the better-auth bump and the open dependabot PRs, an annual price, then the "outshine" features from the review (AI summary, PDF export, Jira push) and retroactive claiming of anonymous boards.

## What to expect

At $4.99 the net is about $4.24 per subscriber per month. Fixed cost is about $25 per month and you are already paying it, so every subscriber is upside against a bill you already have. With 4 creator accounts and about 15 boards a month, a realistic first quarter is somewhere between 0 and 5 subscribers. The point of the flip is to find out whether anyone pays, and to have the machinery ready when traffic grows.

Timeline if Paddle verification starts today: code done in a week of evenings, banner up for one to two weeks, flip in three to four weeks, gated by Paddle approval.
