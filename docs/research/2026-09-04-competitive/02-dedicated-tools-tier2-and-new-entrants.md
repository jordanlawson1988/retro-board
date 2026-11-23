# Competitive Intelligence: Tier-2 Dedicated Retro Tools, Chat-Native Apps, New Entrants

Research date: 2026-09-04. Method: primary WebFetch of pricing/features pages where possible; WebSearch with dated secondary sources where fetch failed (noted per tool). Budget used: ~25 WebFetch calls (6 failed: reetro.io x3, retros.work x3, both blocked/timing out), 14 WebSearch calls.

Legend: Y = yes, N = no, P = partial, ? = not found in sources checked (never guessed).

---

## SECTION 1 — TOOL PROFILES

### 1. GoRetro (goretro.ai)
**Status: Active.** Sprint-management suite built around retros (retro + planning poker + capacity + sprint review). Pricing is per-team, not per-seat, with unlimited members per team and guest access with no login. Premium ($29/team/mo annual) adds Slack + advanced action items; Sprint Pro ($49/team/mo annual, "Most Popular") adds capacity calculator and poker planning; Organization is custom (SSO/SAML, SLA). 30-day full-featured trial, no card. SOC 2 Type II + ISO 27001 + GDPR — the strongest compliance posture of the six dedicated tools checked. 20 templates + unlimited custom templates, built-in timer, card hiding/vote concealment, "Joker cards" (AI-flavored personalized suggestions from sprint history), PDF/CSV export. Jira integration is data-linked (capacity calculator), not just a one-way action push.

Taxonomy: A1 Y(20+custom) A2 Y A3 Y A4 Y(ice breakers) A5 Y(1-click "Happiness") A6 Y A7 Y A8 P(guest/no-login, card-level anon unconfirmed) A9 ? | B1 ? B2 ? B3 Y B4 Y B5 ? B6 ? B7 Y | C1 Y(vote limits) C2 Y(count concealment) C3 ? | D1 Y D2 P(historical comparison, not explicit carry-over) D3 ? D4 Y(Jira) D5 ?(only Jira confirmed) | E1 Y(meeting recap) E2 ? E3 P(Joker cards/happiness, not confirmed AI-labeled) E4 ? E5 ? E6 Y("Joker cards" — personalized suggestions from sprint data) | F1 Y F2 Y F3 Y F4 Y F5 ? F6 Y | G1 Y G2 ? G3 Y(deep, capacity data) G4 ? G5 ? G6 ? G7 ? G8 ? G9 ? | H1 Y H2 Y H3 ? H4 ? H5 ? H6 P(public boards exist) H7 ? | I1 ? I2 Y(Org plan) I3 ? I4 ? I5 Y(SOC2+ISO27001) I6 Y I7 ? I8 ? | J1 Y J2 ? J3 ? J4 ? J5 ? J6 ? J7 ? | K1 no perpetual free tier, 30-day trial only K2 $29/team/mo (annual) K3 ≈$29/mo (unlimited members/team) K4 guests, no participant accounts K5 17% K6 30 days, no CC

### 2. Kollabe (kollabe.com)
**Status: Active**, appears to be a newer/2025-2026-era product itself (its own blog covers "2026" retro-tool roundups). Bundles retro, planning poker, and async standups into one "Team Spaces" product, priced per space (not per seat). Free: 10 members/room, limited meetings/mo, 7-day history. Planning Poker Only $12/mo/space — poker-focused paid tier with Jira/GitHub/Azure DevOps/Linear sync; unclear if retro is unlimited at this tier. Premium $29/mo/space (28-day trial, no CC) unlocks unlimited meetings across all tools, full history, MCP server + public API, and AI features. Notably ships an MCP server — unusual for this category and worth watching. Icebreakers are a real feature (600+ questions + AI generator), not just marketing copy. Homepage copy is thin on classic retro-board mechanics (timer, mood, emoji, colors, drag-drop not mentioned) — likely present but undocumented publicly, not confirmed absent.

Taxonomy: A1 ? A2 ? A3 Y(retro board present) A4 Y(600+ Qs, AI generator) A5 ? A6 ? A7 ? A8 Y(anonymous voting confirmed for poker; retro cards ?) A9 Y(async standups) | B1 ? B2 ? B3 ? B4 ? B5 ? B6 ? B7 ? | C1 ? C2 Y(anonymous voting) C3 ? | D1 ? D2 ? D3 ? D4 Y D5 Y(GitHub, Azure DevOps, Linear) | E1 Y(AI-powered standup summaries) E2 ? E3 ? E4 ? E5 ? E6 Y(AI icebreaker-question generator; "AI-powered tools & automations") | F1 Y(Team Spaces) F2 Y(meeting history) F3 ? F4 ? F5 ? F6 ? | G1 ? G2 ? G3 Y G4 ? G5 ? G6 ? G7 Y(Premium) G8 ? G9 ? | H1 ? H2 Y(data export) H3 ? H4 ? H5 ? H6 ? H7 ? | I1 ? I2 ? I3 ? I4 ? I5 ? I6 ? I7 ? I8 ? | J1 Y(real-time) J2 ? J3 ? J4 ? J5 ? J6 ? J7 ? | K1 free: 10 members/room, limited mtgs/mo, 7-day history K2 $12/mo/space (poker-focused) or $29/mo/space (Premium, all tools+AI) K3 $29/mo (unlimited members/space; 8-person fits free tier's 10-cap too, but "limited meetings/mo") K4 no paid participant accounts, per-space billing K5 17% K6 28 days no CC (Premium)

### 3. Reetro (reetro.io)
**Status: Active.** Direct fetch of reetro.io blocked (403 both /pricing and homepage) — pricing below sourced from **retrospectivetools.com/tool/reetro/, dated 2026-09-01** (secondary, dated). Free tier is unusually generous: 3 teams, 9 members, 6 columns, 50 guests, plus a **metered free AI quota** (1 AI summary, 3 auto-groupings, 3 AI action items/month) — AI-as-free-tier-feature is notable. Pro $10/team/month adds SSO, data retention controls, scheduler, anonymous retros, audit logs, 250 guests. Pro Unlimited is a flat $49/month per **organization** (not per team) — an unusual jump from per-team to flat-org pricing. Three board types including a "RoundUp" async video/voice/text interview format with AI-generated questions — the most distinctive async-input feature found in the dedicated-tool set. Explicitly no public API/webhooks/MCP; Confluence/Trello are export-only. **Caution:** an un-dated aggregator search turned up conflicting figures ($39/mo Pro, $67/mo Business) — see Section 6.

Taxonomy: A1 P(3 board types, not a template count) A2 ? A3 Y(Reflect→Group→Vote→Discuss board type) A4 N("icebreakers unshipped" per source) A5 Y(happiness calendars) A6 ? A7 ? A8 Y(anonymous retros, Pro+) A9 Y(RoundUp async interviews) | B1 ? B2 ? B3 Y(grouping, incl. AI auto-grouping) B4 ? B5 ? B6 ? B7 ? | C1 ? C2 ? C3 Y(polls) | D1 Y(action tracking) D2 ? D3 ? D4 ? D5 N(Confluence/Trello export-only, not push) | E1 Y(quota-limited free, unlimited implied paid) E2 Y(AI auto-grouping, quota on free) E3 Y(sentiment + emotion trends: joy/trust/fear/sadness) E4 Y(AI action items, quota on free) E5 P(AI-generated interview questions for RoundUp) E6 Y(participation metrics via AI summary) | F1 Y(teams) F2 ? F3 ? F4 Y(participation metrics) F5 Y(health checks) F6 ? | G1 ? G2 ? G3 ? G4 N(export-only) G5 ? G6 ? G7 N(explicitly no public API) G8 N(explicitly none) G9 ? | H1 ? H2 ? H3 ? H4 N(export-only to Confluence/Trello) H5 ? H6 ? H7 ? | I1 ? I2 Y(SSO, Pro+) I3 ? I4 Y(audit logs, Pro+) I5 ? I6 ? I7 Y(data retention controls, Pro+) I8 ? | J1 ? J2 ? J3 ? J4 ? J5 ? J6 ? J7 ? | K1 3 teams/9 members/6 cols/50 guests + metered free AI K2 $10/team/month (Pro) K3 $10/mo (8-person fits 9-member cap) K4 guests, no participant accounts; Pro Unlimited is flat per-org K5 ? K6 no CC on free; trial length for paid not stated

### 4. RetroTool (retrotool.io)
**Status: Active.** Has by far the most generous free tier of the dedicated tools checked: unlimited cards/columns/action points, unlimited participants, dot voting with a secret-voting option, vote limits, emoji, card colors, built-in timer, action items with assignee+due date, and Markdown export — all on the **free** "Anonymous" plan, no login required for participants, 12-month data storage. Individual ($10/mo/team, 90-day trial) adds facilitator moderation, readiness checks, locked/read-only mode, image/GIF uploads, non-anonymous mode, up to 3 teams, infinite archive. Company ($20/mo/team) adds unlimited team management and "zero-knowledge encryption with custom passwords" — a distinctive security angle not seen elsewhere in this set. No integrations, AI, or mobile apps found on either fetched page — this looks like the most bare-bones-but-solid classic sticky-note tool of the group, deliberately un-AI'd.

Taxonomy: A1 P(3 named examples: Mad/Sad/Glad, Liked/Learned/Lacked, Start/Stop/Continue; exact count ?) A2 P(custom blank board, not a formal builder) A3 Y A4 ? A5 ? A6 Y A7 ? A8 P(anonymous by default; paid tier can require real names) A9 ? | B1 Y B2 ? B3 ? B4 ? B5 Y(image/GIF upload, paid) B6 ? B7 Y | C1 Y(dot voting, limits per retro/column/card) C2 Y(secret voting option) C3 ? | D1 Y(assignee+due date) D2 Y(team action-point tracking across retros, paid) D3 ? D4 N D5 N(none found) | E1 N E2 N E3 N E4 N E5 N E6 N(no AI features found at all) | F1 Y(paid: team creation/mgmt) F2 Y(historical access, paid) F3 ? F4 ? F5 ? F6 ? | G1 N G2 N G3 N G4 N G5 N G6 N G7 N G8 N G9 N(no integrations found on either page) | H1 ? H2 ? H3 Y(Markdown export, free tier) H4 ? H5 ? H6 Y(unique secure shareable URL) H7 ? | I1 ? I2 ? I3 ? I4 ? I5 ? I6 ? I7 Y(configurable retention, paid) I8 ? | J1 ? J2 ? J3 ? J4 ? J5 ? J6 ? J7 ? | K1 free forever: unlimited cards/columns/participants/action points, 12mo storage K2 $10/month/team (Individual) K3 $10/mo (or $0 — free tier already supports unlimited participants) K4 no login/account required for participants K5 not specified K6 90 days

### 5. Retros.work
**Status: Likely active but UNVERIFIED by primary source** — retros.work timed out on 3 separate WebFetch attempts (homepage and /pricing); this profile relies entirely on WebSearch snippets, lower confidence than the rest. Positions itself with an HR/people-analytics lean: energy scores, team-mood measurement, emotion/energy trend tracking sprint-over-sprint. Claims 40+ retro formats and 200+ built-in icebreaker questions — if accurate, the largest icebreaker library found in this research. Pricing is unusually granular: free tier is unlimited retros/users with limited features; Premium is **€2.69/month per user** (a true per-seat model, unlike the flat-per-team pricing common elsewhere in this set), with per-user price dropping at scale.

Taxonomy: A1 Y(40+ formats, per search snippet) A2 ? A3 Y A4 Y(200+ icebreaker questions) A5 Y(energy/mood scores — core differentiator) A6 Y A7 ? A8 ? A9 ? | B1 Y(emoji reactions) B2 Y(discussion threads) B3 ? B4 Y(multiplayer drag-and-drop) B5 ? B6 ? B7 ? | C1 ? C2 ? C3 ? | D1 ? D2 ? D3 ? D4 ? D5 ? | E1 ? E2 ? E3 ? E4 ? E5 ? E6 ? | F1 ? F2 Y(archives, paid) F3 Y(emotion/energy trends across sprints — explicit) F4 ? F5 Y(energy-score/mood tracking resembles a lightweight health check) F6 Y(specific reports mentioned) | G1 ? G2 ? G3 ? G4 ? G5 ? G6 ? G7 ? G8 ? G9 ? | H1 ? H2 ? H3 ? H4 ? H5 ? H6 ? H7 ? | I1 ? I2 ? I3 ? I4 ? I5 ? I6 ? I7 ? I8 ? | J1 Y(live drag-and-drop implies real-time) J2 ? J3 ? J4 ? J5 ? J6 ? J7 ? | K1 free: unlimited retros & users, limited features K2 €2.69/user/month (Premium) K3 ≈€21.52/mo (~$23/mo) for 8 users — true per-seat model K4 per-user seats (only tool in this set billing every participant, not just facilitators) K5 ? K6 ? — **all cells sourced from search snippets only, not primary-fetched**

### 6. ScatterSpoke (scatterspoke.com)
**Status: Active, but PIVOTED** away from a pure retro tool. Copyright 2026, site fully functional. Now markets itself as "the AI copilot for team feedback," covering retros, standups, blameless postmortems, and dev-experience surveys — pricing language has shifted to "Agent Surveys" and "Ask credits" rather than boards/retros. Free: 1 seat, unlimited static surveys, 10 one-time Agent Surveys, 50 one-time Ask credits. Pro $29/seat/month (up to 5 seats): 20 Agent Surveys/mo, 250 Ask credits/mo. Business $149/month includes 5 seats, +$35/seat beyond that: 150 Agent Surveys/mo, 2,000 Ask credits/mo. Enterprise adds SSO/SAML + SCIM. AI does automated theme extraction plus **cost/impact quantification of team problems** and executive dashboards — the most business-analytics-oriented AI framing of any tool in this research. **It is unclear whether "seat" = every participant or only admins/creators** (survey tools typically only charge creators); see Section 6.

Taxonomy: A1 Y(20+ formats) A2 ? A3 Y A4 ? A5 Y(sentiment/engagement metrics) A6 ? A7 ? A8 Y(anonymous feedback) A9 Y(survey-style async collection is now the core model) | B1 ? B2 ? B3 Y(AI theme extraction) B4 ? B5 ? B6 ? B7 ? | C1 ? C2 ? C3 ? | D1 Y D2 ? D3 ? D4 Y D5 ?(exports to "task management tools," specifics not found) | E1 Y(AI-generated summaries/analysis) E2 Y(automated theme extraction) E3 Y(sentiment metrics) E4 ? E5 P("AI copilot" framing) E6 Y(cost/impact quantification of team issues; cross-team goal tracking) | F1 Y F2 ? F3 ? F4 Y(engagement/participation metrics) F5 ? F6 Y(executive dashboards) | G1 Y G2 Y G3 Y G4 ? G5 ? G6 ? G7 ? G8 ? G9 ? | H1 ? H2 ? H3 ? H4 ? H5 ? H6 ? H7 ? | I1 ? I2 Y(Enterprise) I3 Y(Enterprise) I4 ? I5 ? I6 ? I7 ? I8 ? | J1 Y J2 ? J3 ? J4 ? J5 ? J6 ? J7 ? | K1 free: 1 seat, unlimited static surveys, 10 one-time Agent Surveys, 50 one-time Ask credits K2 $29/seat/month (Pro) K3 uncertain — $29/mo if 1 seat covers a facilitator-only model, up to ~$254/mo if Business tier (5 seats+3 extra@$35) is needed for 8 individual seats; seat definition unconfirmed K4 unclear if participants need seats or only admins/creators do K5 ? K6 no trial countdown found; free tier is perpetual

---

### 7. Chat-platform-native tools (top 3 by adoption signal found)

**TeamRetro's Slack/Teams app (teamretro.com)** — **Status: Active, largest adoption footprint found in this category** ("used by 1000's of teams worldwide," per vendor copy — self-reported, not independently verified). TeamRetro is really a full dedicated web tool that also plugs deeply into Slack (start sessions, publish summaries/action items/team agreements to channels, invite via Slack) and Microsoft Teams. Pricing (primary-fetched, teamretro.com/pricing/): Single Team $20.83/mo billed annually ($250/yr), 1 team/25 members; Small Org $50/mo annual (3 teams, unlimited members, +$20/mo/extra team); Large Org from $75/mo annual (6+ teams, +$15/mo/extra team); Enterprise custom. 30-day no-CC trial, participants never need paid accounts, 16.7% annual discount. Feature claims from secondary search snippets (not primary-fetched for features): 275+ templates, AI-generated action suggestions from recurring themes, AI auto-suggest or manual grouping, built-in team health checks and "maturity models" (a Spotify-style health-check analog).

Taxonomy: A1 Y(275+, secondary source) A3 Y A5 Y(health checks) A6 ? A9 ? | E1 ? E2 Y(AI auto-grouping) E4 Y(AI action suggestions) E5 ? | F5 Y(health checks + maturity models — closest true Spotify-style health check found in this whole research set) | G1 Y(deep: publish summaries/actions/agreements to channels) G2 Y | K2 $20.83/month (Single Team, annual) K3 $20.83/mo (25-member cap, 8-person fits) K4 no paid participant accounts K5 16.7% K6 30 days no CC

**Team O'clock (teamoclock.com)** — **Status: Active.** Meeting-facilitator for retro + standup + planning poker, native inside Slack and MS Teams (also Jira, Asana, Linear, Basecamp). Pricing (primary-fetched): Free $0, 5 monthly active members, 14-day history; Growth $3/mo per active member with a **10-member minimum** (so effectively $30/mo minimum), unlimited history, AI Assist (meeting summarization + suggestions); Enterprise custom (200+ members, SAML SSO). Annual = 2 months free. 15-day full-feature trial. Important nuance: "active member" billing counts **anyone who participates**, including via the Slack/Teams integration — this is a usage-based-per-participant model in practice, not a flat team fee, unlike most of the dedicated tools above.

Taxonomy: A6 Y(implied, structured sessions) A9 ? | D4 Y(Jira) D5 Y(Asana, Linear, Basecamp) | E1 Y(AI Assist summarization) E5 Y(AI Assist "suggestions") | G1 Y G2 Y G3 Y G9 ? | K1 free: 5 active members, 14-day history K2 $3/active member/month (10-member min = $30/mo floor) K3 $30/mo (10-member minimum applies even to an 8-person team) K4 usage-based per active participant, not per named account K5 2 months free annual K6 15 days

**Geekbot (geekbot.com/retrospectives/)** — **Status: Active**, one of the best-known async Slack/Teams bots generally (standups, retros, polls, surveys in one product). Product page (primary-fetched) is thin on retro-specific mechanics (no voting or AI details found there) — positions retros as one of several async ritual types, sprint-focused, with an "archive" for historical insights. Pricing (primary-fetched, geekbot.com/pricing/) is usage-metered rather than plan-tiered in the traditional sense: Starter free up to 10 users; Basic tier charges **$2.5/participant/month** for standups-type sessions (shown at "17% off" a higher list rate) and $0.75/respondent for polls/surveys, only for people who actually respond; 30-day trial, no CC; unused balance carries over. Retro-specific pricing isn't isolated from the general per-participant standup rate in what was fetched.

Taxonomy: A9 Y(async is the core model) | G1 Y G2 Y | K1 free: up to 10 users K2 $2.5/participant/month (Basic, inferred to apply to retros as a structured async session type) K3 ≈$20/month for 8 people (if retro billed same as standups — not confirmed) K4 charged per active participant K5 annual option exists, % not stated K6 30 days no CC

*Other chat-native tools found but not among the top 3 by adoption:* Microsoft's own first-party "Retro" Teams app (marketplace.microsoft.com, WA200001892) — free, simple project/sprint/competency-rating format, no pricing tier at all, appears to be a lightweight utility rather than a serious contender. RetroBox (profiled in Section 8 as a new entrant instead, since its 2025 launch date is more relevant there). Several tiny Slack-only bots exist (Retro Rabbit's Slack integration, "Retrospective Dashboard," "Retrospectives by Harmony") with no adoption signal found beyond a Slack Marketplace listing.

---

### 8. New entrants (2025–2026)

**RetroBox (retroboxapp.com)** — Launched/featured on **Product Hunt August 14, 2025** (WebSearch-sourced, not primary-dated on the vendor site itself). Slack-native, zero-context-switch AI retro tool — runs entirely inside Slack, no signup, no separate web app. Differentiator: privacy-forward AI — deletes user data immediately after each retro ends, GDPR-by-design, explicitly targets anchoring/recency bias via anonymous+private submission. Optional ChatGPT-powered cross-team theme summaries (vendor itself flags these may be inaccurate — unusually candid AI-limitations disclosure). "Trusted by 150+ companies" per vendor. **Pricing could not be found** on the marketing site or via search — likely surfaced only inside the Slack install/billing flow, so K1–K3 are unverified.

Taxonomy: A8 Y(anonymous/private by design) A9 ? | E1 Y(optional ChatGPT summary) E2 Y(cross-team theme detection) E6 Y(bias-mitigation framing: anchoring/recency) | G1 Y(Slack-native, only surface) G8 Y(webhooks for custom apps) | I6 Y(GDPR-by-design, immediate data deletion) I7 Y(immediate post-retro deletion) | K1 ? K2 ? K3 ? K4 no signup; runs on Slack accounts K6 ?

**Retro Rabbit (retrorabbit.io)** — Copyright 2025 Retro Rabbit LLC; a genuinely new dedicated (non-chat-native) entrant. Positioning is explicitly anti-"retros that lead nowhere": async-first note collection through the whole sprint (claims ~70% meeting-time reduction, unverified methodology) plus explicit cross-sprint action-item accountability tracking. AI is branded "CarrotIQ" (grouping, summaries, action-item suggestions), gated to the $40/mo Pro AI tier — Starter at $30/team/month (flat, unlimited users) gets Slack integration and export but no AI. 14-day trial, no CC.

Taxonomy: A9 Y(sprint-long async collection, core model) A8 Y(anonymous submission option) | E1 Y(CarrotIQ) E2 Y(CarrotIQ grouping) E4 Y(CarrotIQ action-item suggestions) | D2 Y(explicit cross-sprint action tracking — core value prop) | G1 Y | K1 no free tier found (14-day trial only) K2 $30/team/month (Starter, no AI) / $40/team/month for AI tier K3 $30–40/mo flat (team pricing, unlimited users) K4 no participant accounts, flat team billing K6 14 days no CC

**Async Retro (asyncretro.com)** — **Pre-launch / waitlist only** as of 2026-09-04 (copyright 2026, no pricing, signup is a waitlist) — the most genuinely "AI-native from the ground up" positioning found in this entire research set, but unproven: no visible customers, no pricing, no primary evidence of a shipped product beyond the marketing site. Claims "AI-Led Facilitation," "Automated Reflection" (synthesizes async individual input into retro items automatically), and "Smart Theme Clustering," plus AI-generated action items/discussion points and sentiment/health reporting. Integrations listed (Slack, Teams, Linear, Jira) are aspirational/unconfirmed pending launch. Marketing claims "4h+ saved/month" and "3x action-item follow-through" with no stated methodology — treat as unverified.

Taxonomy: A9 Y(async is the entire model, not a feature) | E1 Y E2 Y("Smart Theme Clustering") E3 Y(sentiment/health reporting) E4 Y E5 Y("AI-Led Facilitation" — most explicit AI-facilitator claim found in this research) | G1 Y(claimed) G2 Y(claimed) G3 Y(claimed) | K1 ? K2 ? K3 ? K4 ? K6 ? — **entire pricing/adoption block is unknown; product may not be publicly live yet**

*Also found, mentioned briefly rather than fully profiled:* **Spinach AI** (spinach.ai) — not retro-specific but a general AI meeting copilot (joins the call, captures decisions/action items, routes to Slack/Jira/Confluence) that explicitly markets itself for sprint retros; real pricing found (Starter free, Pro $2.90/meeting-hour, Business $29/user/mo monthly or $19/user/mo annual). Represents a different threat pattern: AI meeting-copilot platforms absorbing the retro use case rather than dedicated retro tools adding AI. **Power Retro** (Atlassian Marketplace, "AI-powered Retrospective for Jira") — AI grouping/action-items/summary living natively inside Jira, but only 42 installs and last updated **September 19, 2024** — flagged in Section 5 as evidence that AI-retro apps are proliferating unevenly, with several stalling quickly.

---

## SECTION 2 — MATRIX (rows = taxonomy, columns = tools)

Columns: GoR=GoRetro, Kol=Kollabe, Ree=Reetro, RT=RetroTool, RW=Retros.work, SS=ScatterSpoke, TR=TeamRetro(Slack/Teams), TO=Team O'clock, GB=Geekbot, RB=RetroBox, RR=Retro Rabbit, AR=Async Retro

| Row | GoR | Kol | Ree | RT | RW | SS | TR | TO | GB | RB | RR | AR |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| A1 templates | Y20+ | ? | P | P3 | Y40+ | Y20+ | Y275+ | ? | P1 | N | ? | N |
| A2 custom builder | Y | ? | ? | P | ? | ? | ? | Y | ? | N | ? | ? |
| A3 guided phases | Y | Y | Y | Y | Y | Y | Y | Y | P | P | Y | P |
| A4 icebreakers | Y | Y | N | ? | Y200+ | ? | ? | ? | ? | ? | ? | ? |
| A5 mood/pulse | Y | ? | Y | ? | Y | Y | Y | ? | ? | ? | ? | Y |
| A6 timer | Y | ? | ? | Y | Y | ? | ? | Y | ? | ? | ? | ? |
| A7 hide/reveal | Y | ? | ? | ? | ? | ? | ? | ? | ? | ? | ? | ? |
| A8 anonymous cards | P | Y | Y | P | ? | Y | ? | ? | ? | Y | Y | ? |
| A9 async pre-input | ? | Y | Y | ? | ? | Y | ? | ? | Y | ? | Y | Y |
| B1 emoji reactions | ? | ? | ? | Y | Y | ? | ? | ? | ? | ? | ? | ? |
| B2 comments/threads | ? | ? | ? | ? | Y | ? | ? | ? | ? | ? | ? | ? |
| B3 grouping/merge | Y | ? | Y | ? | ? | Y | ? | ? | ? | ? | ? | ? |
| B4 drag and drop | Y | ? | ? | ? | Y | ? | ? | ? | ? | ? | ? | ? |
| B5 rich text/images | ? | ? | ? | Y | ? | ? | ? | ? | ? | ? | ? | ? |
| B6 @mentions | ? | ? | ? | ? | ? | ? | ? | ? | ? | ? | ? | ? |
| B7 card colors/tags | Y | ? | ? | Y | ? | ? | ? | ? | ? | ? | ? | ? |
| C1 dot voting w/ limits | Y | ? | ? | Y | ? | ? | ? | ? | ? | ? | ? | ? |
| C2 blind/secret voting | Y | Y | ? | Y | ? | ? | ? | ? | ? | ? | ? | ? |
| C3 other voting modes | ? | ? | Y(polls) | ? | ? | ? | ? | ? | ? | ? | ? | ? |
| D1 action items full | Y | ? | Y | Y | ? | Y | Y | ? | ? | ? | Y | Y |
| D2 carry-over | P | ? | ? | Y | ? | ? | ? | ? | ? | ? | Y | ? |
| D3 reminders | ? | ? | ? | ? | ? | ? | ? | ? | ? | ? | ? | ? |
| D4 push to Jira | Y | Y | ? | N | ? | Y | ? | Y | ? | ? | ? | Y(claimed) |
| D5 push other (list) | ? | Y:GitHub,AzureDevOps,Linear | N | N | ? | ?(unspec.) | ? | Y:Asana,Linear,Basecamp | ? | ? | ? | Y(claimed):Linear |
| E1 AI summary | Y | Y | Y(quota-free) | N | ? | Y | ? | Y | ? | Y | Y | Y |
| E2 AI auto-grouping | ? | ? | Y(quota-free) | N | ? | Y | Y | ? | ? | Y | Y | Y |
| E3 AI sentiment | P | ? | Y | N | ? | Y | ? | ? | ? | ? | ? | Y |
| E4 AI action items | ? | ? | Y(quota-free) | N | ? | ? | Y | ? | ? | ? | Y | Y |
| E5 AI facilitator/coach | ? | ? | P | N | ? | P | ? | Y | ? | ? | ? | Y |
| E6 other AI | Y Joker cards | Y icebreaker gen | Y emotion trends | N | ? | Y cost/impact | ? | ? | ? | Y bias-mitig. | ? | ? |
| F1 team/workspace | Y | Y | Y | Y(paid) | ? | Y | Y | Y | ? | ? | ? | ? |
| F2 retro history | Y | Y(7d free/full paid) | ? | Y(paid) | Y(paid) | ? | ? | Y(14d free/unl. paid) | ? | ? | ? | ? |
| F3 trends over time | Y | ? | ? | ? | Y | ? | ? | ? | ? | ? | ? | ? |
| F4 participation analytics | Y | ? | Y | ? | ? | Y | ? | ? | ? | ? | ? | ? |
| F5 health check (Spotify-style) | ? | ? | Y(happiness cal.) | ? | Y(energy score) | ? | Y(maturity models) | ? | ? | ? | ? | ? |
| F6 dashboards/reports | Y | ? | ? | ? | Y | Y(exec.) | ? | ? | ? | ? | ? | ? |
| G1 Slack | Y | ? | ? | N | ? | Y | Y | Y | Y | Y | Y | Y(claimed) |
| G2 MS Teams | ? | ? | ? | N | ? | Y | Y | Y | Y | ? | ? | Y(claimed) |
| G3 Jira (beyond push) | Y | Y | ? | N | ? | Y | ? | Y | ? | ? | ? | Y(claimed) |
| G4 Confluence | ? | ? | N(export-only) | N | ? | ? | ? | ? | ? | ? | ? | ? |
| G5 Google Workspace/cal | ? | ? | ? | N | ? | ? | ? | ? | ? | ? | ? | ? |
| G6 Zoom/video | ? | ? | ? | N | ? | ? | ? | ? | ? | ? | ? | ? |
| G7 public API | ? | Y(Premium) | N | N | ? | ? | ? | ? | ? | ? | ? | ? |
| G8 webhooks | ? | ? | N | N | ? | ? | ? | ? | ? | Y | ? | ? |
| G9 Zapier/Make | ? | ? | ? | N | ? | ? | ? | ? | ? | ? | ? | ? |
| H1 PDF export | Y | ? | ? | ? | ? | ? | ? | ? | ? | ? | ? | ? |
| H2 CSV/XLS | Y | Y | ? | ? | ? | ? | ? | ? | ? | ? | ? | ? |
| H3 Markdown | ? | ? | ? | Y | ? | ? | ? | ? | ? | ? | ? | ? |
| H4 export to Confl./Notion | ? | ? | N(export-only) | ? | ? | ? | ? | ? | ? | ? | ? | ? |
| H5 email summary | ? | ? | ? | ? | ? | ? | ? | ? | ? | ? | ? | ? |
| H6 public read-only link | P | ? | ? | Y | ? | ? | ? | ? | ? | ? | ? | ? |
| H7 image export | ? | ? | ? | ? | ? | ? | ? | ? | ? | ? | ? | ? |
| I1 social login | ? | ? | ? | ? | ? | ? | ? | ? | ? | ? | ? | ? |
| I2 SSO/SAML | Y(Org) | ? | Y(Pro+) | ? | ? | Y(Ent.) | Y(Ent.) | Y(Ent.) | ? | ? | Y(Ent.) | ? |
| I3 SCIM | ? | ? | ? | ? | ? | Y(Ent.) | ? | ? | ? | ? | ? | ? |
| I4 audit logs | ? | ? | Y(Pro+) | ? | ? | ? | ? | ? | ? | ? | ? | ? |
| I5 SOC2/ISO27001 | Y(both) | ? | ? | ? | ? | ? | ? | ? | ? | ? | ? | ? |
| I6 GDPR/residency | Y | ? | ? | ? | ? | ? | ? | ? | ? | Y | ? | ? |
| I7 retention/deletion | ? | ? | Y(Pro+) | Y(paid) | ? | ? | ? | ? | ? | Y(immediate) | ? | ? |
| I8 custom branding | ? | ? | ? | ? | ? | ? | ? | ? | ? | ? | ? | ? |
| J1 real-time presence | Y | Y | ? | ? | Y | Y | ? | ? | ? | ? | Y | ? |
| J2 native mobile apps | ? | ? | ? | ? | ? | ? | ? | ? | ? | ? | ? | ? |
| J3 mobile web quality | ? | Y(responsive, claimed) | ? | ? | ? | ? | ? | ? | ? | ? | ? | ? |
| J4 dark mode | ? | ? | ? | ? | ? | ? | ? | ? | ? | ? | ? | ? |
| J5 accessibility statement | ? | ? | ? | ? | ? | ? | ? | ? | ? | ? | ? | ? |
| J6 UI languages | ? | ? | ? | ? | ? | ? | ? | ? | ? | ? | ? | ? |
| J7 keyboard shortcuts | ? | ? | ? | ? | ? | ? | ? | ? | ? | ? | ? | ? |
| K1 free tier | trial only, no perm. free | 10/room, ltd mtgs, 7d hist | 3 tm/9 mem/6 col/50 guest+AI quota | unlimited, free forever | unlim retro/users, ltd features | 1 seat, 10 Agent Surv., 50 Ask cr. | (none fetched; see vendor) | 5 members, 14d hist | 10 users | ? | none found | ? |
| K2 cheapest paid | $29/team/mo | $12 or $29/mo/space | $10/team/mo | $10/mo/team | €2.69/user/mo | $29/seat/mo | $20.83/mo | $3/member/mo (10 min) | $2.5/participant/mo | ? | $30/team/mo | ? |
| K3 8-person cost | ≈$29/mo | ≈$29/mo | $10/mo | $10/mo (or $0) | ≈$23/mo | $29–254/mo (seat def. unclear) | $20.83/mo | $30/mo (10-min applies) | ≈$20/mo | ? | $30–40/mo | ? |
| K4 participant model | guest, no acct | no paid acct, per-space | guest, no acct | no login | per-user seats | unclear | no paid acct | usage-based per active member | per active participant | no signup (Slack) | no acct, flat team | ? |
| K5 annual discount | 17% | 17% | ? | ? | ? | ? | 16.7% | 2 mo free | ? (option exists) | ? | ? | ? |
| K6 trial | 30d no CC | 28d no CC (Premium) | ? | 90d | ? | none (perm. free) | 30d no CC | 15d | 30d no CC | ? | 14d no CC | ? |

---

## SECTION 3 — FEATURES PRESENT IN MOST OF THESE TOOLS

Confirmed in a majority (7+) of the 12 tools researched:
- **Guided retro phases** (brainstorm → group → vote → discuss → actions) — present in essentially every tool profiled, dedicated or chat-native (A3).
- **No-account participant access** — every tool with a confirmed participant model lets respondents join without creating an account; only Retros.work (per-seat) and Team O'clock/Geekbot (usage-billed-per-participant) charge based on participant count, and even those don't require participant *accounts*.
- **Some form of action item tracking with assignee** (D1) — present in 8 of 12 tools checked.
- **Slack integration** (G1) — present or claimed in 9 of 12 tools; it is closer to table stakes than a differentiator at this point.
- **Some AI summary/grouping/action-item feature** (E1/E2/E4) — present in 8 of 12 tools, including tools with sub-$15/month entry tiers (Reetro, Retro Rabbit) and even generous free tiers (Reetro's metered free AI). AI is no longer an enterprise-only feature in this category — it's showing up at the cheapest paid tier or even free, across nearly every tool launched or refreshed since 2025.
- **Flat team/workspace pricing rather than per-seat** — 8 of 12 tools price per team/space/org with unlimited members, not per user; Retros.work, ScatterSpoke, and the participant-usage-billed Team O'clock/Geekbot are the exceptions.
- **SSO on an upper tier** (I2) — present in 6 of 12, always gated to the top/enterprise plan.

Notably rare even among these tools: native mobile apps (J2 — not confirmed for any tool), accessibility statements (J5 — none found), audit logs (I4 — only Reetro and ScatterSpoke), and public APIs (G7 — only Kollabe confirmed with certainty).

---

## SECTION 4 — NEW ENTRANTS FOUND

1. **RetroBox** — Product Hunt launch **2025-08-14**. Novel because it's Slack-native with zero separate app/login, and leads with a privacy pitch (immediate post-retro data deletion, GDPR-by-design) rather than an AI-capability pitch, even though it does use generative AI for cross-team theme summaries.
2. **Retro Rabbit** — copyright **2025**, dedicated (non-chat-native) web tool. Novel because its entire value proposition is anti-"retros that go nowhere": async collection spans the whole sprint (not just meeting time) and it explicitly tracks/report action-item follow-through across sprints as the headline feature, with AI ("CarrotIQ") gated behind a $10/mo upcharge rather than bundled.
3. **Async Retro** — copyright **2026**, **pre-launch/waitlist only**, no pricing or confirmed customers found. Novel because it is the most fully "AI-native by design" pitch found in this whole research pass — the entire product is framed as AI synthesizing async individual input into retro items and running the facilitation itself, rather than a card board with AI bolted on. Flagged as unproven/early — include with a confidence caveat.
4. **Also found, minor:** Spinach AI (established AI meeting-copilot company, not retro-specific, now marketing into the sprint-retro use case — real pricing, $19–29/user/month) and Power Retro (small Jira-native AI retro app on Atlassian Marketplace — see Section 5, stagnant).

---

## SECTION 5 — TOOLS THAT APPEAR DEAD OR STAGNANT

- **None of the 6 named dedicated tools, nor the 3 chat-native tools, showed evidence of being dead or abandoned.** All had 2026-dated pricing pages, working links, or 2025/2026 copyright notices.
- **Power Retro (Atlassian Marketplace)** — found during new-entrant search, not one of the assigned 12, but worth flagging: markets AI grouping/AI action items/AI summary for Jira, yet shows only **42 installs**, 5 reviews, and was **last updated 2024-09-19** — over two years stale as of this research date. Evidence that AI-retro tooling is proliferating unevenly and several small entrants stall quickly after launch.
- **Retros.work** is not "stagnant" by any evidence found, but its status is **unverified**: 3 separate WebFetch attempts (homepage and /pricing) timed out rather than returning a 403 or 404, which is at least consistent with either a slow/under-provisioned server or aggressive bot-blocking — not proof of anything, but a reason for lower confidence, flagged again in Section 6.

---

## SECTION 6 — CONTRADICTIONS OR UNVERIFIABLE ITEMS

- **Reetro pricing conflict.** An un-dated WebSearch aggregation (pulling from Capterra/Cledara/other listicles) reported Pro at **$39/team/month** (60 members, 3 admins, 60 boards/team) and Business at **$67/team/month**. The dated primary-adjacent source (retrospectivetools.com, dated 2026-09-01) reports Pro at **$10/team/month** and Pro Unlimited at **$49/month per organization**. Both sources agree on the $49 org-wide figure, which suggests the $10 vs. $39 discrepancy is the real conflict — likely explained by the aggregator listing stale/outdated pricing (third-party marketplace and review-site listings for SaaS pricing lag frequently) or by conflating an older plan structure. This report uses the $10/$49 figures as primary but the discrepancy is unresolved — reetro.io itself could not be fetched directly (403 on 3 attempts) to adjudicate.
- **ScatterSpoke "seat" definition is unconfirmed.** The pricing page distinguishes seats (1 free / up to 5 on Pro) from usage credits (Agent Surveys, Ask credits), which strongly resembles a survey-tool pattern where only creators/admins need seats and respondents are free — but this was not explicitly confirmed anywhere in the fetched content. The 8-person-team cost estimate for ScatterSpoke (Section 2, K3) is presented as a wide, low-confidence range for this reason.
- **Retros.work could not be primary-sourced at all** (3 timeouts across homepage and /pricing). Every data point for this tool traces to WebSearch snippets referencing a kollabe.com blog post and the retros.work page title/meta as indexed by the search engine, not to content this research actually read. Treat the entire Retros.work profile as lower-confidence than the others.
- **RetroBox and Async Retro pricing are both genuinely unknown**, not just hard to find — RetroBox likely reveals pricing only inside the Slack install flow (couldn't be reached from outside Slack), and Async Retro appears to be pre-revenue/pre-launch (waitlist signup only), so no pricing may yet exist to find.
- **TeamRetro's "1000's of teams" adoption claim and its 275+ template count are vendor/secondary-search claims**, not independently verified or primary-fetched from a dedicated features page (only the pricing page was primary-fetched for TeamRetro in this pass).
- **Geekbot's per-participant retro price is inferred, not confirmed.** The $2.5/participant/month figure is stated for "Standups" specifically on the pricing page; whether Retrospectives are billed identically, differently, or bundled was not confirmed in what was fetched.

---

## SECTION 7 — SOURCES

- GoRetro pricing: https://www.goretro.ai/pricing (fetched 2026-09-04, no page date shown)
- GoRetro features: https://www.goretro.ai/features (fetched 2026-09-04, no page date shown)
- Kollabe pricing: https://www.kollabe.com/pricing (fetched 2026-09-04, no page date shown)
- Kollabe homepage: https://www.kollabe.com/ (fetched 2026-09-04, no page date shown)
- Reetro pricing (direct): https://reetro.io/pricing — **HTTP 403, could not fetch**
- Reetro homepage (direct): https://reetro.io/ — **HTTP 403, could not fetch**
- Reetro pricing (direct, alt path): https://reetro.io/reetro-pricing.html — **HTTP 403, could not fetch**
- Reetro pricing (secondary, used): https://www.retrospectivetools.com/tool/reetro/ (page marked "Review Date: September 1, 2026")
- Reetro pricing (secondary, conflicting, not used as primary): aggregated via WebSearch from capterra.com/p/199484/Reetro, cledara.com/marketplace/reetro, krowdbase.com/software/reetro (no page dates surfaced)
- RetroTool pricing: https://retrotool.io/pricing (fetched 2026-09-04, no page date shown)
- RetroTool homepage: https://retrotool.io/ (fetched 2026-09-04, no page date shown)
- RetroTool features: https://retrotool.io/features (fetched 2026-09-04, no page date shown)
- Retros.work homepage: https://retros.work/ — **timeout, could not fetch**
- Retros.work pricing: https://retros.work/pricing — **timeout, could not fetch (2 attempts)**
- Retros.work (secondary, used): WebSearch snippet citing https://kollabe.com/posts/best-free-retro-tools and https://retros.work/pricing (indexed page, not fetched; no date surfaced)
- ScatterSpoke pricing: https://scatterspoke.com/pricing/ (fetched 2026-09-04; page shows copyright 2026)
- ScatterSpoke homepage: https://scatterspoke.com/ (fetched 2026-09-04; page shows copyright 2026)
- Team O'clock pricing: https://www.teamoclock.com/pricing (fetched 2026-09-04, no page date shown)
- Geekbot retrospectives product page: https://geekbot.com/retrospectives/ (fetched 2026-09-04, no page date shown)
- Geekbot pricing: https://geekbot.com/pricing/ (fetched 2026-09-04, no page date shown)
- TeamRetro pricing: https://www.teamretro.com/pricing/ (fetched 2026-09-04, no page date shown)
- RetroBox homepage: https://retroboxapp.com/ (fetched 2026-09-04, no page date shown)
- RetroBox Product Hunt listing (secondary, launch date): https://www.producthunt.com/products/retrobox (via WebSearch; launch date 2025-08-14 per search summary)
- RetroBox founder/company (secondary): https://medium.com/@retrobox/how-we-do-retrospectives-with-retrobox-31cae8301bb (via WebSearch)
- Retro Rabbit homepage: https://retrorabbit.io/ (fetched 2026-09-04; page shows copyright 2025)
- Async Retro homepage: https://www.asyncretro.com/ (fetched 2026-09-04; page shows copyright 2026)
- Spinach AI blog (secondary, for Spinach + comparison table): https://www.spinach.ai/blog/sprint-retro-tools (fetched 2026-09-04; article dated "July 2026" per fetch summary)
- Power Retro (Atlassian Marketplace): https://marketplace.atlassian.com/apps/1225649/power-retro-ai-powered-retrospective-for-jira (fetched 2026-09-04; page shows "Last Updated: September 19, 2024")
- WebSearch: "Reetro reetro.io retrospective tool pricing 2026" (2026-09-04)
- WebSearch: "retros.work retrospective tool features pricing" (2026-09-04)
- WebSearch: "Team O'clock retrospective Slack Microsoft Teams pricing 2026" (2026-09-04)
- WebSearch: "Retrobot Slack retrospective app pricing features" (2026-09-04)
- WebSearch: "Microsoft Teams "Retrospectives" app agile retro Teams store" (2026-09-04) — surfaced https://marketplace.microsoft.com/en-us/product/office/wa200001892
- WebSearch: "TeamRetro Slack app integration most popular retrospective Slack bot 2026" (2026-09-04)
- WebSearch: "AI retrospective tool 2026 launch "AI facilitator"" (2026-09-04)
- WebSearch: "G2 new retrospective software category 2026 AI" (2026-09-04)
- WebSearch: "retro tool with AI facilitator sprint retrospective generate action items" (2026-09-04) — surfaced Retrium, Spinach AI, Async Retro, Power Retro
- WebSearch: "retrospective tool sprint retro AI" restricted to producthunt.com (2026-09-04)
- WebSearch: "RetroBox Slack app company launched founder AI retrospective" (2026-09-04)
- WebSearch: "RetroBox app Slack pricing plan cost per month" (2026-09-04) — no results found for RetroBox pricing specifically
