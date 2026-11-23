# Dedicated Retro Tools — Competitive Feature & Pricing Research (Tier 1)
Research date: 2026-09-04. Web research only (WebFetch + WebSearch). Legend: Y=confirmed present, N=confirmed absent, P=Partial, ?=not found/could not verify.

---

## SECTION 1 — Tool Profiles

### 1. EasyRetro (easyretro.io)

**Profile:** EasyRetro is a straightforward, template-heavy retro board (200+ templates) with a facilitator-controlled workflow: timer, card hiding, anonymous voting with configurable limits, and manual (non-AI) clustering. It added AI-generated board summaries in January 2024 and expanded Jira bulk-export in September 2024 — no confirmed 2025-2026 feature launches surfaced in this research, notable given competitors' AI push since. Pricing is flat per-team (not per-seat): Free (1 board/month, 200+ templates, unlimited participants), Team $38/month (5 boards/month), Business $60/month, Enterprise $90/month (adds SAML SSO). All plans allow unlimited participants with no accounts required — only the organizer needs one. A 7-day free trial requires no credit card. The official pricing page would not render for automated fetch (JS-only content); dollar figures here come from a dated secondary source corroborated by an independent search.

**Taxonomy:**
- A1 Y (200+ templates) | A2 P (customizable boards; explicit "save as template" not confirmed) | A3 ? | A4 ? | A5 P ("survey" feature exists, mood-specific use unconfirmed) | A6 Y (facilitator timer) | A7 Y (column hiding) | A8 Y (anonymous feedback/voting) | A9 ?
- B1 ? | B2 Y (card commenting) | B3 Y (manual clustering, explicitly NOT AI) | B4 Y (drag-and-drop interface) | B5 ? | B6 ? | B7 ?
- C1 Y (configurable vote limits) | C2 Y (anonymous voting) | C3 ?
- D1 ? | D2 ? | D3 ? | D4 Y (Jira issue creation + bulk export, Sept 2024) | D5 P (Trello confirmed; Asana/Linear/GitHub/ClickUp/Azure DevOps not found)
- E1 Y (AI board summaries, Jan 2024) | E2 N (explicitly "lacks AI-powered card grouping") | E3 ? | E4 ? | E5 ? | E6 N (only summary AI found)
- F1 Y (1/3/6 teams by plan) | F2 Y (dashboard of past retros) | F3 ? | F4 Y (analytics feature) | F5 N (implied absent — TeamRetro markets itself as "EasyRetro Alternative with Health Checks") | F6 Y
- G1 Y (Slack notifications) | G2 ? | G3 ? | G4 Y (Confluence export) | G5 ? | G6 ? | G7 ? | G8 ? | G9 ?
- H1 Y | H2 Y (CSV, Excel) | H3 ? | H4 Y (Confluence only; Notion not found) | H5 ? | H6 Y (free-tier public boards, link-visible) | H7 Y (PNG)
- I1 ? | I2 Y (SAML SSO: Okta/Azure/Google/PingOne, Enterprise) | I3 ? | I4 ? | I5 ? | I6 ? | I7 ? | I8 ?
- J1 ? | J2 ? | J3 ? | J4 ? | J5 ? | J6 ? | J7 ?
- K1 Free: 1 board/mo, 1 survey/mo, all 200+ templates, unlimited participants, no CC | K2 Team $38/month flat | K3 $38/month (flat, unlimited participants) | K4 No accounts for participants; unlimited on all plans | K5 ? (no annual option found) | K6 7-day trial, no CC

---

### 2. Parabol (parabol.co)

**Profile:** Parabol is an open-source, phase-guided meeting platform (retro, standup, sprint poker) with real-time multiplayer grouping, AI-automated card grouping, automated meeting summaries, and AI-assisted icebreakers/discussion prompts. Free tier: 2 teams/company, unlimited users, 10 meetings/month, 30-day history, 2 custom templates — functions as an ongoing trial rather than a time-boxed one. The Team plan is priced per active user ($8/active user/month, billed monthly by card), meaning cost scales directly with headcount rather than staying flat, unlike most others in this set. Enterprise (custom, annual contract) adds SAML SSO, SCIM, and optional on-premises hosting. Integrations include Jira (with story-point sync), Slack, MS Teams, GitHub, Azure DevOps, and Google Calendar. No dated 2025-2026 feature launch was confirmed despite a dedicated "New Features" blog tag existing (not fetched, budget).

**Taxonomy:**
- A1 Y (50+ templates, all meeting types) | A2 Y (2 custom on Free, unlimited on paid) | A3 Y (built-in structured phases) | A4 Y (icebreaker prompts) | A5 ? | A6 Y (built-in timer) | A7 ? | A8 Y (anonymous suggestions/replies) | A9 ?
- B1 ? | B2 Y (real-time threaded discussions) | B3 Y (AI-automated + manual multiplayer grouping) | B4 Y (cards moved between columns; not explicitly worded "drag and drop") | B5 ? | B6 ? | B7 ?
- C1 Y (structured/limited voting) | C2 ? | C3 ?
- D1 Y (task creation + Kanban taskboard; due-date field unconfirmed) | D2 ? | D3 ? | D4 Y (Jira, with story-point sync) | D5 P (GitHub, Azure DevOps confirmed; Trello/Asana/Linear/ClickUp not found)
- E1 Y (automated meeting summary, emailed) | E2 Y (AI-automated grouping) | E3 ? | E4 ? | E5 Y (AI-assisted icebreakers/discussion prompts) | E6 AI-generated discussion prompts
- F1 Y (2 teams free / unlimited paid) | F2 Y (30-day free / unlimited paid retention) | F3 ? | F4 ? | F5 ? | F6 ?
- G1 Y | G2 Y | G3 ? | G4 ? | G5 Y (Google Calendar) | G6 ? | G7 ? (open-source; explicit public API not confirmed) | G8 ? | G9 ?
- H1 ? | H2 Y (CSV) | H3 ? | H4 ? | H5 Y (auto email summary to every member) | H6 ? | H7 ?
- I1 ? | I2 Y (SAML SSO, Enterprise) | I3 Y (SCIM, Enterprise) | I4 ? | I5 ? | I6 P (optional on-prem hosting, Enterprise) | I7 Y (retention limits imply controls) | I8 ?
- J1 Y (real-time multiplayer UI) | J2 ? | J3 ? | J4 ? | J5 ? | J6 ? | J7 ?
- K1 Free: 2 teams/company, unlimited users, 10 meetings/mo, 30-day history, 2 custom templates | K2 Team $8/active user/month | K3 $64/month (8 x $8) | K4 No paid seats required, but billed by "active user" (logged in <30 days) — cost scales with real headcount | K5 ? (Team tier; Enterprise is annual contract) | K6 No time-boxed trial found — free tier serves as ongoing trial

---

### 3. Retrium (retrium.com)

**Profile:** Retrium positions itself as the enterprise-grade option: five-phase guided facilitation, saveable custom templates, team health checks, maturity-model assessments, and cross-team trend analysis, plus AI-branded features (smart summaries, AI action suggestions, sentiment insights, automated grouping) found via secondary sources rather than the primary features page — treat with somewhat lower confidence. No free tier — only a 30-day trial. Pricing is flat per "Team Room" with unlimited users: Team $39/month (month-to-month or annual), Business $59/month ($715/year annual — a negligible ~1% discount despite requiring annual invoicing) adding SAML SSO and SOC audit access, Enterprise custom (25+ team minimum). No refunds; no on-premises version. This is the most expensive flat-rate entry paid tier of the non-per-seat tools in this set, and the only one requiring annual billing to unlock SSO.

**Taxonomy:**
- A1 ? (named techniques only — Start/Stop/Continue, What Went Well, Mad Sad Glad, Lean Coffee — no total count found) | A2 Y (custom templates, editable columns/radar spokes, saveable) | A3 Y (5-phase guided facilitation) | A4 Y (icebreakers, check-in/checkout questions, Kudos) | A5 Y (AI team sentiment + health checks) | A6 ? | A7 ? | A8 ? | A9 ?
- B1 Y (emoji reaction keyboard) | B2 ? | B3 Y (automated grouping, per search) | B4 ? | B5 P (whiteboards mentioned; explicit rich text/image upload not confirmed) | B6 ? | B7 ?
- C1 ? | C2 ? | C3 Y (column-based + team radar techniques; planning poker via Estimation Meetings)
- D1 Y (action plan tracking, mark complete, monitor progress) | D2 P (history/timeline views imply carryover, not explicit) | D3 ? | D4 Y (Jira Cloud integration) | D5 ? ("14+ workflow tools" claimed in search, specifics not found)
- E1 Y (Smart instant summaries) | E2 Y (Automated grouping) | E3 Y (AI Insights + team sentiment) | E4 Y (AI Action suggestions) | E5 P (guided facilitation + AI features, no named "coach" product) | E6 Cross-team analysis
- F1 Y (Team Room is the core unit) | F2 Y (retrospective history) | F3 Y (long-term trend + cross-team analysis) | F4 ? | F5 Y (Team Health Checks + Maturity Model Assessments, flagship features) | F6 P (implied via trend/cross-team analysis, no explicit "dashboard" wording)
- G1 ? | G2 ? | G3 ? | G4 ? | G5 ? | G6 ? | G7 ? | G8 ? | G9 ?
- H1 ? | H2 ? | H3 ? | H4 ? | H5 ? | H6 ? | H7 ?
- I1 ? | I2 Y (SAML SSO, Business) | I3 ? | I4 ? | I5 Y (SOC audit access + SIG Lite access, Business) | I6 ? | I7 ? | I8 ?
- J1 P (whiteboards / collaborative tool, not explicit on cursors) | J2 ? | J3 ? | J4 ? | J5 ? | J6 P (column descriptions support multiple languages; UI language list not found) | J7 ?
- K1 N (no free tier found — 30-day trial only) | K2 Team $39/month per Team Room | K3 $39/month (flat, unlimited users) | K4 Unlimited users free within a Team Room; account requirement for participants unclear | K5 Y but negligible (~1%: $59/mo vs $715/yr = $59.58/mo equivalent) | K6 30 days, limited to column-based + team radar techniques

---

### 4. TeamRetro (teamretro.com)

**Profile:** TeamRetro is the most feature-dense of the six on integrations, compliance, and AI: comprehensive push integrations (Jira, GitHub, GitLab, Azure DevOps, Linear, Trello, Asana, ClickUp, monday.com, Shortcut, Basecamp), REST API, webhooks, an MCP server for AI agents (Claude, ChatGPT, Copilot, Gemini), a named in-meeting AI assistant ("trAI"), AI meeting summaries, AI auto-grouping, AI-suggested actions, SOC 2 Type 2, GDPR with US/EU regional hosting, SAML/SSO, SCIM, audit logs, and 8 UI languages. Health checks are a flagship first-class module (custom models, longitudinal tracking, cross-team rollups) — a category most competitors treat as secondary. No free tier; 30-day trial, no credit card. Pricing is flat per team-count tier, not per-seat: Single Team $20.83/month (billed annually at $250/year, 25 members), Small Org $50/month (3 teams), Large Org from $75/month (6+ teams), Enterprise custom. Non-annual monthly rate not confirmed.

**Taxonomy:**
- A1 ? (no total count found on fetched pages) | A2 Y (AI template + health model generation from prompts) | A3 Y (timeboxed brainstorm/vote/action workflow) | A4 Y (icebreaker library + AI-generated options) | A5 Y (team sentiment tracking) | A6 Y (timeboxed workflows) | A7 ? | A8 Y (anonymous voting, private rating collection) | A9 ?
- B1 Y (explicit emoji set: thumbs up, heart, party, clap, laugh, wow, thinking, more) | B2 ? | B3 Y (automatic idea grouping/theme organization) | B4 ? | B5 ? | B6 ? | B7 ?
- C1 Y (dot voting) | C2 Y (anonymous voting) | C3 Y (planning poker / Estimations module)
- D1 Y (action item capture + monitoring) | D2 ? | D3 ? | D4 Y | D5 Y — most comprehensive: Jira, GitHub, GitLab, Azure DevOps, Linear, Trello, Asana, ClickUp, monday.com, Shortcut, Basecamp
- E1 Y (AI meeting summaries, refreshable) | E2 Y (automatic idea grouping/theming) | E3 Y (sentiment tracking, AI-associated) | E4 Y (AI-suggested actions from discussion) | E5 Y (named "trAI" in-meeting assistant) | E6 AI template/health-model generation from prompts; MCP server for external AI agents
- F1 Y (Single/Small Org/Large Org/Enterprise all team-based) | F2 Y (implied via org-wide reporting) | F3 Y (trend analysis, compare past health-check trends) | F4 Y (org-wide metrics reporting) | F5 Y (flagship module: custom models, longitudinal tracking, cross-team rollups, industry templates) | F6 Y (metrics reporting, word-cloud theme visualization)
- G1 Y | G2 Y | G3 ? (push/export confirmed, import not found) | G4 Y | G5 ? | G6 ? | G7 Y (REST API) | G8 Y | G9 ?
- H1 Y | H2 Y (Excel, CSV) | H3 Y (explicit Markdown export) | H4 Y (Confluence + Notion) | H5 Y (Email export format) | H6 ? | H7 ?
- I1 ? | I2 Y (SAML/SSO) | I3 Y (SCIM) | I4 Y (audit logs) | I5 Y (SOC 2 Type 2 certified) | I6 Y (GDPR compliant, US & EU regional hosting) | I7 P (implied via GDPR compliance, not itemized) | I8 ?
- J1 Y (real-time team interaction) | J2 ? | J3 ? | J4 ? | J5 ? | J6 Y (English, German, French, Spanish, Portuguese, Italian, Dutch, Polish — 8 languages) | J7 ?
- K1 N (no free tier — 30-day trial only, no CC) | K2 Single Team $20.83/month (billed annually, $250/year) | K3 $20.83/month (fits 25-member cap, annual billing) | K4 No accounts required for team members to participate | K5 Annual is the base rate shown; explicit non-annual monthly figure not found | K6 30 days, no CC required

---

### 5. Neatro (neatro.io)

**Profile:** Neatro is a mid-market tool built around a "4-step framework," Team Radars (health-check-style pulse scoring), ROTI surveys, and a 200+-question icebreaker library, with explicit psychological-safety framing (guest participation, no account needed). It exports action items to Jira, Azure DevOps, GitHub, Asana, and monday.com, but — per a competitor comparison page and our own features fetch — has no Slack or MS Teams integration and no AI features at all (no summary, grouping, sentiment, or suggested actions), making it the only tool in this set with a confirmed AI gap versus the market. Free plan: $0, up to 10 members, 30-day retention. Premium $23.20/month per team (or $278.40/year, "20% savings" claimed) adds unlimited members/retention/templates; Pro $31.20/month adds SAML SSO. 14-day Premium trial, no card required. Template count is inconsistent across Neatro's own pages (70+, 30+, and 25+ all appear).

**Taxonomy:**
- A1 Y but inconsistent (70+ per pricing page; 30+ per features page; 25+ per search — see contradictions) | A2 Y (unlimited custom templates, Premium/Pro) | A3 Y (4-step Neatro framework) | A4 Y ("Question Game," 200+ questions) | A5 Y (Team Radars + ROTI surveys) | A6 ? | A7 ? | A8 Y (anonymity options to prevent groupthink) | A9 ?
- B1 ? | B2 P (scoring + comments in Team Radar context; general card comments not explicit) | B3 ? | B4 ? | B5 ? | B6 ? | B7 ?
- C1 ? | C2 P (anonymity options imply blind input, not explicit "voting") | C3 Y (ROTI surveys, Team Radar scoring)
- D1 Y (assignment + Kanban tracking; due-date field not itemized) | D2 P (progress tracking + recurring trends imply carryover) | D3 Y (explicit reminder system) | D4 Y (Jira Cloud) | D5 Y — Azure DevOps, GitHub, Asana, monday.com, iceScrum (Trello/Linear/ClickUp not found)
- E1 N (search source states no AI features found) | E2 N | E3 N | E4 N | E5 N | E6 N — TeamRetro's own comparison page is titled "Neatro Alternative: Scheduled Retros & AI," implying AI is a TeamRetro-only differentiator vs. Neatro
- F1 Y (per-team pricing model) | F2 Y (retention limits by plan) | F3 Y (recurring trends identification) | F4 Y (Analytics section) | F5 Y (Team Radars function as a health-check equivalent) | F6 Y (Analytics section, data-driven insights)
- G1 N (explicitly no native Slack integration) | G2 N (explicitly no native MS Teams integration) | G3 ? | G4 ? | G5 ? | G6 ? | G7 ? | G8 ? | G9 ?
- H1 ? | H2 ? | H3 ? | H4 ? | H5 ? | H6 ? | H7 ?
- I1 ? | I2 Y (SAML SSO, Pro plan) | I3 ? | I4 ? | I5 ? | I6 ? | I7 Y (explicit retention limits per plan) | I8 ?
- J1 Y (real-time interaction for distributed teams) | J2 ? | J3 ? | J4 ? | J5 ? | J6 ? | J7 ?
- K1 Free: $0 forever, up to 10 members, 30-day retention, 70+ templates, no CC | K2 Premium $23.20/month per team | K3 $23.20/month (flat per team, unlimited members) — note: $23.20 x 12 = $278.40 exactly, so this may already be an annual-discounted rate rather than a true month-to-month price (see contradictions) | K4 Participants join as guests, no account; members need free accounts for history access | K5 Y — 20% stated savings ($69.60/yr on Premium, $93.60/yr on Pro) | K6 14-day Premium trial, no CC

---

### 6. Metro Retro / Ludi / Spreo (metroretro.io → spreo.io)

**Profile:** Formerly Metro Retro, renamed Ludi in August 2025, then renamed again to Spreo in July 2026 after a US trademark holder issued a cease-and-desist over "Ludi" (May 2026; same company, Deqo Software Ltd, same product/accounts — metroretro.io now 301-redirects to spreo.io). It's a general whiteboard tool (retro is one canvas use case alongside sprint planning, story mapping, and brainstorming) with a distinctive private-writing anti-bias mode, gesture/confetti engagement features, planning poker, and action tracking with owners/due dates. Its first AI feature — sticky-note clustering — shipped February 2026, alongside AI-written wrap-up summaries. Pricing is per-seat like Parabol, not flat: Starter/Business/Enterprise tiers, with only an indirect secondary-source figure found (~$4/seat/month billed annually); the official pricing page would not render dollar amounts for automated fetch. Participants who aren't paid "members" join as limited guests (2/board Starter, 20/board Business) rather than unlimited free participants.

**Taxonomy:**
- A1 Y (100+ templates, all whiteboard use cases, not retro-specific count) | A2 P (highly customizable frames/zones; explicit save-as-template not confirmed) | A3 P (Frames + Zones suggest structure; explicit brainstorm/group/vote/discuss/actions phase language not found) | A4 ? | A5 ? | A6 Y (timers, spinners, buzzers) | A7 Y (private writing mode to reduce bias) | A8 Y (anonymous polls) | A9 ?
- B1 Y (explicit emoji reactions) | B2 Y (in-context comments) | B3 Y (topic grouping/clustering) | B4 Y (whiteboard UI: sticky notes, connectors, shapes — "drag and drop" not explicitly worded) | B5 P (shape tools, freehand markers; explicit image upload/attachment not confirmed) | B6 ? | B7 ?
- C1 Y (voting and polling) | C2 Y (anonymous polls) | C3 Y (planning poker)
- D1 Y (action tracking with owners and due dates) | D2 Y ("Time Machine" action-tracking feature, paid-only) | D3 ? | D4 Y (Jira integration) | D5 ? (only Jira confirmed)
- E1 Y (AI-written wrap-up summaries) | E2 Y (AI sticky-note clustering, added Feb 2026 — first AI feature) | E3 ? | E4 ? | E5 ? | E6 —
- F1 Y (single team space Starter; unlimited teams Business/Enterprise) | F2 P ("Time Machine" implies history/undo, paid-only) | F3 ? | F4 ? | F5 ? | F6 ?
- G1 ? | G2 ? | G3 ? | G4 ? | G5 ? | G6 ? | G7 ? | G8 ? | G9 ?
- H1 ? | H2 ? | H3 ? | H4 ? | H5 ? | H6 ? | H7 ?
- I1 ? | I2 Y (SSO, Business/Enterprise) | I3 ? | I4 ? | I5 ? | I6 ? | I7 ? | I8 ?
- J1 Y (gesture support — pointing/waving/celebrating — implies live presence awareness) | J2 ? | J3 ? | J4 ? | J5 ? | J6 ? | J7 ?
- K1 Y (free tier exists per homepage; specific limits not found) | K2 Starter ~$4/seat/month (billed annually — secondary source, not confirmed on official page) | K3 ~$32/month estimate (8 seats x $4, annual billing) — LOW CONFIDENCE, see contradictions | K4 Paid "members" need seats; unpaid "guest" participants capped per board (2 on Starter, 20 on Business) — the most restrictive participant model of the six | K5 Y (annual billing is the standard framing; monthly card billing also offered) | K6 30 days, no card required

---

## SECTION 2 — Cross-Tool Matrix

| Item | EasyRetro | Parabol | Retrium | TeamRetro | Neatro | Spreo (MetroRetro/Ludi) |
|---|---|---|---|---|---|---|
| A1 template count | Y (200+) | Y (50+) | ? | ? | Y (70+/30+/25+, inconsistent) | Y (100+) |
| A2 custom template builder | P | Y | Y | Y | Y | P |
| A3 guided phases | ? | Y | Y | Y | Y | P |
| A4 icebreakers/check-ins | ? | Y | Y | Y | Y | ? |
| A5 mood/pulse/sentiment | P | ? | Y | Y | Y | ? |
| A6 timer | Y | Y | ? | Y | ? | Y |
| A7 hide cards until reveal | Y | ? | ? | ? | ? | Y |
| A8 anonymous cards | Y | Y | ? | Y | Y | Y |
| A9 async pre-meeting input | ? | ? | ? | ? | ? | ? |
| B1 emoji reactions | ? | ? | Y | Y | ? | Y |
| B2 comments/threads on cards | Y | Y | ? | ? | P | Y |
| B3 grouping/merge cards | Y (manual) | Y (AI) | Y (AI) | Y (AI) | ? | Y |
| B4 drag and drop | Y | Y (inferred) | ? | ? | ? | Y (inferred) |
| B5 rich text/images/attachments | ? | ? | P | ? | ? | P |
| B6 @mentions | ? | ? | ? | ? | ? | ? |
| B7 card colors/tags | ? | ? | ? | ? | ? | ? |
| C1 dot voting with limits | Y | Y | ? | Y | ? | Y |
| C2 blind/secret voting | Y | ? | ? | Y | P | Y |
| C3 other voting modes | ? | ? | Y (radar/Lean Coffee) | Y (poker) | Y (ROTI/radar) | Y (poker) |
| D1 action items assignee/due/status | ? | Y | Y | Y | Y | Y |
| D2 carry-over to next retro | ? | ? | P | ? | P | Y |
| D3 reminders/notifications | ? | ? | ? | ? | Y | ? |
| D4 push to Jira | Y | Y | Y | Y | Y | Y |
| D5 push to Trello/Asana/Linear/GitHub/ClickUp/Azure DevOps | P (Trello) | P (GitHub, Azure DevOps) | ? (14+ claimed) | Y (all 6 + more) | Y (Azure DevOps, GitHub, Asana; not Trello/Linear/ClickUp) | ? (Jira only) |
| E1 AI summary | Y | Y | Y | Y | N | Y |
| E2 AI auto-grouping/theme detection | N | Y | Y | Y | N | Y |
| E3 AI sentiment | ? | ? | Y | Y | N | ? |
| E4 AI suggested action items | ? | ? | Y | Y | N | ? |
| E5 AI facilitator/coach/prompts | ? | Y | P | Y ("trAI") | N | ? |
| E6 other AI | N | discussion prompts | cross-team analysis | MCP server, AI template gen | N | — |
| F1 team/workspace concept | Y | Y | Y | Y | Y | Y |
| F2 retro history per team | Y | Y | Y | Y | Y | P |
| F3 trends over time | ? | ? | Y | Y | Y | ? |
| F4 participation analytics | Y | ? | ? | Y | Y | ? |
| F5 team health check (Spotify-style) | N | ? | Y | Y | Y (Team Radars) | ? |
| F6 dashboards/reports | Y | ? | P | Y | Y | ? |
| G1 Slack | Y | Y | ? | Y | N | ? |
| G2 Microsoft Teams | ? | Y | ? | Y | N | ? |
| G3 Jira import (beyond push) | ? | ? | ? | ? | ? | ? |
| G4 Confluence | Y | ? | ? | Y | ? | ? |
| G5 Google Workspace/calendar | ? | Y | ? | ? | ? | ? |
| G6 Zoom/embedded video | ? | ? | ? | ? | ? | ? |
| G7 public API | ? | ? | ? | Y | ? | ? |
| G8 webhooks | ? | ? | ? | Y | ? | ? |
| G9 Zapier/Make | ? | ? | ? | ? | ? | ? |
| H1 PDF export | Y | ? | ? | Y | ? | ? |
| H2 CSV/XLS | Y | Y | ? | Y | ? | ? |
| H3 Markdown | ? | ? | ? | Y | ? | ? |
| H4 export to Confluence/Notion | Y (Confl.) | ? | ? | Y (both) | ? | ? |
| H5 email summary to participants | ? | Y | ? | Y | ? | ? |
| H6 public read-only share link | Y | ? | ? | ? | ? | ? |
| H7 image export | Y (PNG) | ? | ? | ? | ? | ? |
| I1 social login | ? | ? | ? | ? | ? | ? |
| I2 SSO/SAML | Y | Y | Y | Y | Y | Y |
| I3 SCIM | ? | Y | ? | Y | ? | ? |
| I4 audit logs | ? | ? | ? | Y | ? | ? |
| I5 SOC 2/ISO 27001 | ? | ? | Y | Y | ? | ? |
| I6 GDPR/data residency | ? | P (on-prem opt.) | ? | Y (US/EU) | ? | ? |
| I7 data retention/deletion controls | ? | Y | ? | P | Y | ? |
| I8 custom branding/white label | ? | ? | ? | ? | ? | ? |
| J1 real-time presence/cursors | ? | Y | P | Y | Y | Y |
| J2 native mobile apps | ? | ? | ? | ? | ? | ? |
| J3 mobile web quality (reviews) | ? | ? | ? | ? | ? | ? |
| J4 dark mode | ? | ? | ? | ? | ? | ? |
| J5 accessibility statement/WCAG | ? | ? | ? | ? | ? | ? |
| J6 UI languages | ? | ? | P | Y (8 langs) | ? | ? |
| J7 keyboard shortcuts | ? | ? | ? | ? | ? | ? |
| K1 free tier | Y (1 board/mo) | Y (2 teams, 10 mtgs/mo) | N | N | Y (10 members) | Y (limits unknown) |
| K2 cheapest paid plan | $38/mo flat | $8/user/mo | $39/mo flat | $20.83/mo flat (annual) | $23.20/mo flat | ~$4/seat/mo (annual, low confidence) |
| K3 8-person team monthly cost | $38 | $64 | $39 | $20.83 | $23.20 | ~$32 (est.) |
| K4 participant model | No accounts, unlimited | No paid seats, billed by active user | Unlimited users free | No accounts needed | Guests no account; members need free account | Members need paid seats; guests capped 2-20/board |
| K5 annual discount | ? | ? | Y (~1%, negligible) | annual is base rate | Y (20%) | Y |
| K6 trial | 7 days, no CC | free tier = ongoing trial | 30 days | 30 days, no CC | 14 days (Premium), no CC | 30 days, no CC |

---

## SECTION 3 — Present in 4+ of 6 Tools

Counting strict "Y" only (Partial excluded) across the six tools:

- **D4 push to Jira — 6/6 (universal)**
- **F1 team/workspace concept — 6/6 (universal)**
- **I2 SSO/SAML (at some paid tier) — 6/6 (universal)**
- A8 anonymous cards — 5/6 (all but Retrium confirmed)
- B3 grouping/merge cards — 5/6 (all but Neatro confirmed)
- D1 action items with assignee/due/status — 5/6 (all but EasyRetro confirmed)
- E1 AI summary — 5/6 (all but Neatro; Neatro confirmed N)
- F2 retro history per team — 5/6 (Spreo only Partial)
- A1 template count (some library exists) — 4/6
- A2 custom template builder — 4/6
- A3 guided phases — 4/6
- A4 icebreakers/check-ins — 4/6
- A6 timer — 4/6
- B4 drag and drop — 4/6 (2 of the 4 are inferred from UI description, not explicit wording — lower confidence)
- C1 dot voting with limits — 4/6
- C3 other voting modes (radar/poker/ROTI/Lean Coffee variants) — 4/6
- E2 AI auto-grouping/theme detection — 4/6
- J1 real-time presence/cursors — 4/6

**Read for RetroBoard:** the three universal items (Jira push, a team/workspace concept, and SSO at some tier) plus the 5/6 items (anonymous cards, card grouping, structured action items, AI summaries, per-team history) are the closest thing to "table stakes" this research can support with sourced evidence. AI summary specifically (5/6) is worth flagging — it's now mainstream, not a differentiator, among dedicated retro tools.

---

## SECTION 4 — Notable 2025-2026 Launches

- **EasyRetro:** No 2025-2026 launch found. Most recent dated items are AI board summaries (Jan 2024) and Jira bulk-export (Sept 2024) — both just outside the window. The absence of any confirmed 2025-2026 launch, while five competitors show 2025-2026 AI/rebrand activity, is itself a notable data point (possible product stagnation, or simply undocumented on marketing pages).
- **Parabol:** No dated 2025-2026 launch confirmed. A "New Features" blog tag exists at parabol.co/blog/tag/new-features/ but was not fetched (budget) — flagged as a follow-up source.
- **Retrium:** AI features (smart summaries, AI action suggestions, sentiment insights, automated grouping, cross-team analysis) are confirmed present but undated — likely recent given the AI framing, not verifiable to a specific 2025 or 2026 date with available sources.
- **TeamRetro:** MCP (Model Context Protocol) server integration for AI agents (Claude, ChatGPT, Copilot, Gemini) — MCP as a standard only gained adoption industry-wide in 2025, so this is very likely a 2025-2026 shipment, though the exact date is not stated on the page. Named in-meeting AI assistant "trAI" also appears recent but undated.
- **Neatro:** No 2025-2026 launch found. Notably, this is the one tool in the set with a sourced claim of zero AI features as of research date (per a TeamRetro competitor-comparison page title and Neatro's own features page).
- **Metro Retro / Ludi / Spreo:** The most eventful timeline of the six — **renamed Metro Retro → Ludi in August 2025**; **served a trademark cease-and-desist in May 2026** by a US company holding "Ludi" in trademark classes 9 and 42; **renamed Ludi → Spreo in July 2026** (same company/product/accounts, metroretro.io now redirects). **First AI feature (sticky-note clustering) shipped February 2026**, alongside AI-written wrap-up summaries. Product framing also shifted from "retro tool" to general agile whiteboard (retro is now one of several canvas use cases).

---

## SECTION 5 — Contradictions & Unverifiable Items

1. **EasyRetro pricing conflict:** An initial WebSearch snippet (via SoftwareSuggest) stated "starting price of EasyRetro is $0/Per Month... starting price $5," which conflicts with the $38/month Team-plan figure from retrotools.io (dated Feb 11, 2026) and corroborated by a second independent search. The $5 figure could not be traced to an official source and is likely a different metric (e.g., a per-user estimate from a third-party aggregator) or an error. **Trusted the $38/month figure** as the better-sourced number, but flag low confidence on the $5 figure specifically.
2. **EasyRetro free-tier board limit:** search results were internally inconsistent — one phrase said "1 public board per month, 1 board total on dashboard," another (same search) said "allows two public boards per month." Not resolved.
3. **Neatro template count:** three different numbers surfaced from Neatro's own properties and a search: 70+ (official pricing page), 30+ (official features page), 25+ (independent WebSearch). Unresolved — Neatro's own pages disagree with each other.
4. **Neatro Premium price:** $23.20/month and $278.40/year are numerically identical (23.20 × 12 = 278.40) despite the page's claim of "20% annual savings." This suggests $23.20/month may already be the annual-discounted, paid-upfront rate, with a separate (higher, unconfirmed) true month-to-month rate not shown to us. Flagged, not resolved.
5. **Retrium annual discount:** Business plan is $59/month or $715/year; $715 ÷ 12 = $59.58 — essentially no discount for committing to annual billing, which is unusual since Business/SSO access requires annual invoicing. Confirmed math, but worth flagging as an odd pricing design.
6. **Spreo (Metro Retro/Ludi) exact pricing:** the official pricing page (spreo.io/pricing) rendered with "simple per-seat pricing... per member" language but **no dollar amounts** in our fetch — possibly a JS-rendering limitation of the fetch tool rather than a true absence of numbers on the live page. The ~$4/seat/month figure used in this report comes from a secondary WebSearch-derived source only, not a directly fetched primary page. **Lowest-confidence pricing figure in this report.**
7. **metroretro.io/pricing anomalous fetch:** before the redirect to spreo.io was identified, an initial fetch of metroretro.io/pricing returned placeholder-like content referencing "Spreo — Non-prod environment," which appears to be a caching/staging artifact rather than real content. Resolved by fetching spreo.io/pricing directly, though that fetch also lacked dollar figures (see #6).
8. **TeamRetro non-annual monthly billing rate:** the page confirms both monthly and annual billing exist, but only the annual-equivalent rate ($20.83/month, billed $250/year) was retrievable from fetched content. The true pay-month-to-month rate (typically higher in SaaS) was not found.
9. **Retrium AI features sourcing:** all Retrium AI claims (E1-E4) came from WebSearch snippets referencing thin secondary listings (Capterra/SoftwareSuggest-style aggregators), not Retrium's own primary features page, which did not mention AI at all when fetched directly. Treat Retrium's AI row with more caution than TeamRetro's or Parabol's (which had at least partial primary-source confirmation).
10. **Parabol template count context:** the "50+ templates" figure is Parabol's all-purpose meeting-template count (retro + standup + sprint poker + others combined), not a retro-specific count — may overstate retro template depth relative to EasyRetro/Neatro's retro-specific counts.
11. **Not verified for any tool:** native mobile apps (J2), mobile web quality via reviews (J3), dark mode (J4), accessibility/WCAG statements (J5), keyboard shortcuts (J7), Zoom/video embedding (G6), Zapier/Make (G9), white-label/custom branding (I8), social login (I1). These require either app-store lookups, accessibility-statement pages, or review-site aggregation not reached within budget.

---

## SECTION 6 — Sources

**EasyRetro**
- https://easyretro.io/pricing — fetched, page returned only a placeholder header, no pricing content rendered (JS-only page)
- https://easyretro.io/ — fetched, no date shown on page
- https://www.retrotools.io/tools/easyretro — fetched, dated February 11, 2026
- WebSearch "EasyRetro pricing 2026 plans free team" — surfaced trustradius.com/products/easyretro/pricing, capterra.com/p/185134/EasyRetro, softwaresuggest.com/easyretro/pricing, teamretro.com/compare/easyretro-alternative, saasworthy.com/product/easyretro-io, kollabe.com/posts/best-free-retro-tools, softwareworld.co/software/easyretro-reviews
- WebSearch "EasyRetro Team plan price per month official pricing page" — corroborated $38/month via same aggregator set plus teamretro.com/plans

**Parabol**
- https://www.parabol.co/pricing — fetched, dated "© Parabol, 2026"
- https://www.parabol.co/retrospectives — fetched, HTTP 404
- https://www.parabol.co/ — fetched, no date shown
- WebSearch "Parabol AI retrospective features 2026 summary grouping" — surfaced capterra.com/p/182731/Parabol/reviews, g2.com/products/parabol/reviews, github.com/marketplace/parabol-retrospectives, teleretro.com/resources/best-retrospective-tools, parabol.co/blog/tag/new-features (not fetched), retrospectivetools.com/tool/parabol

**Retrium**
- https://www.retrium.com/pricing — fetched, no date shown
- https://www.retrium.com/features — fetched, no date shown
- WebSearch "Retrium AI features 2025 2026" — surfaced sourceforge.net/software/product/Retrium, capterra.com/p/149376/Retrium, softwaresuggest.com/retrium, slashdot.org/software/p/Retrium, retroflow.org/blog/post/retrium-vs-retroflow

**TeamRetro**
- https://www.teamretro.com/pricing — fetched, no date shown
- https://www.teamretro.com/features — fetched, HTTP 404
- https://www.teamretro.com/ — fetched, no date shown
- WebSearch "TeamRetro AI features 2026 health check facilitator" — surfaced help.teamretro.com (health check articles + "what's new"), teamretro.com/health-checks, teamretro.com/health-check-features, retrotools.io/tools/teamretro, retrospectivetools.com/tool/teamretro

**Neatro**
- https://www.neatro.io/pricing — fetched, no date shown
- https://www.neatro.io/features — fetched, no date shown
- WebSearch "Neatro AI features integrations Slack Microsoft Teams" — surfaced sourceforge.net/software/product/Neatro/integrations, teamretro.com/compare/neatro-alternative, axolo.co/integrations/Neatro-Retrospectives

**Metro Retro / Ludi / Spreo**
- https://metroretro.io/pricing — fetched, returned anomalous "Spreo — Non-prod environment" placeholder content
- https://metroretro.io/ — fetched, detected 301 redirect to https://spreo.io/
- https://spreo.io/pricing — fetched, no date shown, no dollar amounts rendered
- https://spreo.io/ — fetched, dated "© 2026"
- WebSearch "Metro Retro Ludi rebrand retrospective tool 2026" — surfaced teamretro.com/compare/spreo-alternative, capterra.com/p/208712/Metro-Retro, ludi.co/blog, producthunt.com/products/metroretro(/reviews), retrotools.io/tools/metro-retro, spreo.io/blog/metro-retro-is-now-ludi, retrospectivetools.com/rankings, conversiongems.com/tools/metroretro
- WebSearch "Spreo pricing per seat month 2026 Starter Business plan dollar" — derived $4/seat/month (annual) figure; source page spreo.io/pricing referenced but underlying $ not independently confirmed by direct fetch
- WebSearch "Spreo Ludi Metro Retro AI features 2026" — surfaced spreo.io/blog/our-new-name-spreo (trademark cease-and-desist detail, May 2026), spreo.io/blog/metro-retro-is-now-ludi, retrospectivetools.com/de/werkzeug/metroretro, retrotools.io/tools/metro-retro
