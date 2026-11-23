# Competitive Gap Analysis (2026-09-04)

Walkthrough page: https://claude.ai/code/artifact/06463def-08f6-4efd-981a-f8169be0f924 (same content as `docs/research/2026-09-04-competitive/retroboard-against-the-field.html`).
Evidence: four research reports in `docs/research/2026-09-04-competitive/` (30 tools, ~140 page reads, fixed 60-row taxonomy). Price confirmed 2026-09-04: $4.99/mo flat, unlimited boards and members.

## Bottom line

RetroBoard is the cheapest dedicated retro tool for a small team by 2x to 13x and already has the in-meeting mechanics reviewers praise (no-account join, anonymous cards, hide-until-reveal, secret voting, synced timer, four views, dark mode, boards that never expire). It is missing the second half of the category checklist: everything after the meeting (action carry-over, history, Jira, Slack), AI synthesis, and template/facilitation depth. Those are the stated reasons people leave tools, and they now appear in $10 tools and some free tiers.

"Everything" is the wrong target. About ten capabilities decide selection for small teams. Enterprise rows (SSO, SCIM, audit logs, SOC 2) and the long tail (API, whiteboard canvas, planning poker, native apps) wait until a buyer asks.

Sequence: paywall first (nothing in the gap list is needed to charge), then Wave 1 in the same month.

## Eight-person team, cheapest paid plan, per month

RetroBoard $4.99 | RetroTool $10 (free covers 8) | Reetro $10 (contested, $39 elsewhere) | TeamRetro $20.83 (annual) | Neatro $23.20 | GoRetro $29 | Kollabe $29 | Team O'clock $30 | Retro Rabbit $30 ($40 with AI) | EasyRetro $38 | Retrium $39 | Parabol $64.
Whiteboards: Mural $0 (voting/timer/private free, AI from $9.99/seat), FigJam $0 (no anonymous cards at any price), Miro $8 to $64, Lucidspark ~$72, Jira/Confluence $0 + marketplace app, Azure DevOps ext ~$18.

Reading: below $10 the competition is free tiers (RetroTool, Mural, Parabol, Reetro), which withhold history, facilitation depth, and integrations. Above $10 the benchmark is TeamRetro (AI, Jira two-way, Slack/Teams, health checks, 8 languages, SOC 2, monthly releases). Retrium and GoRetro have not shipped since 2023.

## What buyers choose on (evidence-ranked)

Ease/first retro in minutes (high) | participants never sign up (high as market pattern) | fair flat per-team price (moderate-high) | anonymous input (moderate-high) | history and action persistence (moderate; sharpest churn complaint) | Jira/Linear/GitHub depth (moderate) | templates and guided facilitation (moderate) | responsive support (moderate) | AI (low-moderate as buyer reason, high as vendor bet) | async (rising) | enterprise security (low; deal gate for large orgs only).
Churn: no history, missing/broken integrations, price, actions tracked by hand outside the tool, clunky grouping, free plan removed, customization limits.

## The ten capabilities that make it a no-brainer

1. AI summary, suggested groupings, suggested action items
2. Open-action carry-over into the next retro + dashboard action tracker
3. Push actions to Jira, then Linear and GitHub via the same abstraction
4. Share summary and actions to Slack and Teams
5. 25 to 30 curated templates + save-as-template
6. PDF export
7. Guided facilitation (one-click Write, Group, Vote, Discuss, Actions)
8. Icebreaker bank + 1-to-5 mood pulse, trended
9. Team spaces with history and recurring themes
10. Async mode (open window, reminders, auto-reveal)

Cheap conversion items in the same window: Google/Microsoft sign-in, comparison pages + trust page + support promise. Differentiated bet backed by our own users (AR/DE/ES/RU): localization, Spanish and Portuguese first.

Do not build yet: SSO/SAML/SCIM/audit/SOC 2/residency; public API/webhooks/Zapier; whiteboard canvas, planning poker, standups; native apps; an AI that runs the meeting.

## Build plan

Wave 1, ~13 dev days, ships the month the paywall flips: AI summary/groups/actions (3d), action carry-over + tracker (2d), Jira Cloud push (3d), Slack/Teams webhook share (1d), template library + save-as-template (2d), PDF export (1d), Google/Microsoft sign-in (0.5d).
Wave 2, ~20 dev days over six weeks: guided facilitation (3d), icebreakers + pulse (2d), team spaces/history/themes (5d), async mode (3d), comments/mentions/images (3d), email summary (1d), localization ES/PT then DE/RU (4d).
Later, on demand: enterprise security as its own plan; API/webhooks/Zapier; Confluence/Notion export; annual plan; planning poker.

## Next steps

1. Confirm the two open paywall decisions (free tier rule; comp existing owners).
2. Start Paddle today (sandbox + live verification).
3. Resume the billing branch (rebase, Tasks 5 to 13, update $3.99 copy in terms/refunds).
4. Brainstorm + plan Wave 1 item 1 (AI summary) in parallel; it does not depend on billing.
5. Write pricing and comparison copy from the eight-person math; add a support promise and trust page.
6. Flip when Paddle approves; ship Wave 1 the same month.

## Confidence

High: TeamRetro, Neatro, Parabol, GoRetro, Kollabe, RetroTool, Mural, Miro, FigJam pricing/features (primary pages); Capterra-anchored sentiment; 2025 to 2026 launch list. Medium: EasyRetro, Retrium (JS-blocked pages), Reetro ($10 vs $39), Retrium AI claims (third-party only). Low: Spreo pricing, Retros.work, RetroBox pricing, Async Retro. Neatro SOC 2 contradicted. Community sentiment under-sampled (Reddit, G2 pros/cons, TrustRadius blocked). Not verified for most tools: mobile apps, dark mode, accessibility, shortcuts, social login.
