# Competitive Intelligence: Whiteboard & Suite Incumbents vs. Dedicated Retro Tools

Research date: 2026-09-04. Context: RetroBoard (retroboard.live) launching at $4.99/month flat, unlimited boards/participants, no-account link join. This report establishes what Miro, FigJam, Mural, Lucidspark, Atlassian (Jira/Confluence), Microsoft (Azure DevOps/Loop/Teams), Notion, and Google natively provide for retrospectives in 2026, at what cost, and where they structurally fall short.

**Method note:** Many vendor pricing/feature pages are JS-rendered and returned partial or failed content via automated fetch; where that happened, figures are corroborated via WebSearch of third-party pricing-tracker sites (dated 2026) and flagged. Section 5 lists everything that could not be independently confirmed from a primary source in this pass.

---

## 1. Profiles

### 1.1 Miro

Miro's Free plan ($0) gives 3 editable boards but does **not** clearly include timer/voting/private mode (those are listed under paid tiers on the pricing page). **Starter** ($8/user/mo billed annually) is the entry point that explicitly bundles "Timer and voting" + "Private mode, Voting, & Timer," unlimited private boards, and lets the paying member share a board publicly for free visitor editing (no seat needed for guests). **Business** ($20/user/mo annual) adds "Engage activities" (polls, 2x2 matrix), more AI credits, and unlimited signed-in guests. Miro AI ("Create with AI," clustering by color/tag/author/keyword/sentiment, board summarization) runs on a credit system available in limited form on every plan, scaling from free/limited trial credits to 2,500+/mo on Enterprise. Miro markets a dedicated "AI Retrospective" tool and a general retrospective template hub (Start/Stop/Continue, Sailboat, etc.) but no verified exact retro-template count was found. Jira/Azure DevOps integration lets cards become tracked issues with assignee/due date.

- A1 dozens (unverified exact count) | A2 Y | A3 Partial (templates imply phases, not enforced) | A4 Y (icebreaker templates) | A5 Partial | A6 Y (Starter+) | A7 Y (Starter+, "Private mode") | A8 Partial ("anonymous features" mentioned, not detailed) | A9 Y (async contribution supported)
- B1 Y | B2 Y | B3 Y (AI clustering) | B4 Y | B5 Y | B6 ? | B7 Y
- C1 Y (voting, limits not detailed) | C2 ? (not explicitly confirmed as "blind") | C3 ? (polls/2x2 matrix, Business tier)
- D1 Y (cards → assignee/due date) | D2 ? | D3 ? | D4 Y | D5 Y (Azure DevOps confirmed)
- E1 Y (Miro Assist summaries) | E2 Y (auto-clustering by keyword/sentiment/tag) | E3 Y (sentiment clustering) | E4 Partial ("suggest improvement strategies" claimed) | E5 Partial (prompt/framework generation) | E6 diagram/mind-map generation, sketch-to-shape
- F1 Y | F2 ? | F3 ? | F4 ? | F5 ? | F6 ?
- G1 Y (integrations, 250+) | G2 ? | G3 Y | G4 ? | G5 ? | G6 ? | G7 Y (Enterprise APIs, general knowledge, not directly confirmed this pass) | G8 ? | G9 ?
- H1 ? | H2 ? | H3 ? | H4 ? | H5 ? | H6 Y (public share links) | H7 ?
- I1 ? | I2 Y (Enterprise-tier, general knowledge) | I3 ? | I4 ? | I5 ? | I6 ? | I7 ? | I8 ?
- J1 Y (canvas presence is core Miro UX) | J2 Y (general knowledge) | J3 ? | J4 ? | J5 ? | J6 ? | J7 ?
- K1 $0, 3 editable boards, no confirmed timer/voting/private mode | K2 Starter, $8/user/mo (annual) | K3 **$8–$64/mo** (1 paid host + free visitor-editors, vs. 8 named seats) | K4 free visitor editing via public link on Starter+ | K5 Y (~20% vs monthly) | K6 ? (not confirmed this pass)

### 1.2 FigJam (Figma)

Since March 11, 2025, Figma collapsed per-product seats into unified seat types (**Full** $16/mo annual [$20 monthly], **Dev** $12/mo, **Collab** $3/mo, all annual on Professional) and now bundles full FigJam + FigJam AI into every paid seat — there's no more separate cheap "FigJam-only" seat. **Starter** (free) still includes a native **Timer** ("available on any team or plan") and native **Voting sessions** that hide each participant's vote until the facilitator ends the round — a real blind-voting mechanic, free. However FigJam has **no native anonymous/private mode for card content**: sticky notes always display their creator, so authorship is never hidden, only vote tallies are. AI "Sort and Summarize" (group stickies by topic/color/author/stamp; generate a text summary object) is restricted to paid seats with edit access; a prompt-driven "build me a retrospective board" AI generator also exists. A distinctive extra: a shared **background-music player** in the toolbar during timed sessions. Unlimited viewers can join via link with no seat.

- A1 several (Rose Thorn Bud, Start/Stop/Continue-style; exact count unverified) | A2 Y (FigJam AI can generate custom boards from a prompt) | A3 Partial | A4 Y (dedicated icebreaker templates, incl. games/playlists) | A5 Partial (emoji check-ins used ad hoc) | A6 Y (free, any plan) | A7 Partial (votes hidden until reveal; card authorship never hidden — no true anonymous mode) | A8 N (creator always shown on stickies) | A9 Y
- B1 Y (stamps/reactions) | B2 Y | B3 Y (AI sort by topic) | B4 Y | B5 Y | B6 Y (general Figma capability) | B7 Y
- C1 Y (voting sessions) | C2 Y (votes hidden until round ends) | C3 ? 
- D1 ? (no confirmed native assignee/due/status object) | D2 N (not found) | D3 N (not found) | D4 ? (Jira plugin/integration exists at Figma ecosystem level, not confirmed retro-specific) | D5 ?
- E1 Y (AI summary of stickies) | E2 Y (AI sort/group by topic) | E3 ? (not confirmed) | E4 N (not found) | E5 Partial (prompt-to-board generation) | E6 diagram generation
- F1 Y | F2 N | F3 N | F4 N | F5 N | F6 N
- G1 ? | G2 ? | G3 ? | G4 ? | G5 Y (Google-recommended Jamboard-replacement partner, embeds in Meet/Drive/Calendar) | G6 ? | G7 Y (Figma REST API, general knowledge) | G8 ? | G9 ?
- H1 ? | H2 ? | H3 ? | H4 ? | H5 ? | H6 Y (view links) | H7 Y (general Figma export)
- I1 ? | I2 Y (Enterprise/Organization, general knowledge) | I3 ? | I4 ? | I5 ? | I6 ? | I7 ? | I8 ?
- J1 Y (core FigJam UX — cursor chat) | J2 ? | J3 ? | J4 ? | J5 ? | J6 ? | J7 ?
- K1 Free Starter: unlimited viewers, limited files, native timer + voting, AI capped at ~150 credits/day (500/mo) | K2 Professional, cheapest AI-unlocking seat = Collab $3/mo (if editing only) or Full $16/mo annual for full rights | K3 **$0** for voting+timer (free plan already has both); **Partial** on "private mode" at any price (no true anonymous cards exist); AI sort/summarize needs paid seats, ≈$24–$160/mo for 8 depending on seat mix | K4 unlimited free viewers/commenters via link; editing without a seat depends on org link-sharing settings | K5 Y (annual saves ~20-25% vs. monthly) | K6 ?

### 1.3 Mural

Mural is the most retro-permissive on price: the **Free** plan ($0) already includes Voting, Timer, **and** Private Mode, with unlimited members and visitors (capped at 3 editable murals in flight at once). **Team+** ($9.99/mo/member annual, $12 monthly) adds unlimited editable murals, private rooms, unlimited editing visitors, and unlocks **Mural AI** (Cluster by topic, Summarize, Classify by sentiment/emotional tone, generative mind maps, AI chat for idea generation). **Business** ($17.99/mo annual) adds SSO/SAML and unlimited external users; **Enterprise** (custom) adds SCIM and multi-workspace. Mural AI is gated to Team+, Business, and Full Members on Enterprise. The retrospective use-case page names 8 dedicated templates (Retrospective, Sailboat, Retrospective Radar, Weekly Team Retro, Async Retro, Weekly Kanban+Retro, Personal/Professional Retro, Sprint Retro) and confirms native Jira issue import. Mural intro'd Microsoft 365 Copilot integration per a TechTarget headline (exact date unconfirmed this pass).

- A1 8+ named on retro use-case page (category total unverified) | A2 Y | A3 Partial | A4 Y | A5 Partial | A6 Y (Free+) | A7 Y (Free+, explicit "Private Mode") | A8 Partial | A9 Y (explicit "invite your team to share feedback asynchronously")
- B1 ? | B2 Y | B3 Y (AI cluster by topic) | B4 Y | B5 Y | B6 ? | B7 Y
- C1 Y | C2 ? (private mode covers cards; dedicated "blind voting" not separately confirmed) | C3 ?
- D1 Y ("assign ownership"; due date/status not confirmed) | D2 ? | D3 ? | D4 Y (Jira import confirmed) | D5 ?
- E1 Y (Summarize) | E2 Y (Cluster) | E3 Y (Classify/sentiment) | E4 ? | E5 Partial (AI chat for idea generation) | E6 generative mind maps, MS 365 Copilot integration
- F1 Y | F2 ? | F3 ? | F4 ? | F5 ? | F6 ?
- G1 ? | G2 ? | G3 Y (issue import confirmed) | G4 ? | G5 ? | G6 ? | G7 ? | G8 ? | G9 ?
- H1 ? | H2 ? | H3 ? | H4 ? | H5 ? | H6 ? | H7 ?
- I1 ? | I2 Y (Business+, SAML 2.0 confirmed) | I3 Y (Enterprise, confirmed) | I4 ? | I5 ? | I6 ? | I7 ? | I8 ?
- J1 Y (core canvas UX) | J2 ? | J3 ? | J4 ? | J5 ? | J6 ? | J7 ?
- K1 $0: unlimited members/visitors, voting+timer+private mode included, 3 concurrent editable murals, no AI | K2 Team+, $9.99/user/mo annual (only needed for AI) | K3 **$0** for voting+timer+private mode (Free plan suffices); **$9.99–$79.92/mo** if AI clustering/summary desired (1 paid host + free editing visitors, vs. 8 named seats) | K4 unlimited free visitors with editing rights on paid plans, and even on Free | K5 Y | K6 ?

### 1.4 Lucidspark

Lucidspark (Lucid Software) prices **Individual** at $7.95/mo and **Team** at $9/user/mo, with a free tier (3 boards, general Lucid pattern) and custom Enterprise pricing. **Team** unlocks Voting sessions with a "Private Voting" toggle (anonymous vote choices) and a Timer that counts down for all collaborators during a voting round. A general "Private mode" hides sticky-note authors/content until a session ends, but true **"private writing"** (persistent author anonymity) is reported to require the **Enterprise** plan specifically — a materially higher bar than Miro/Mural, where private/anonymous behavior is available on entry paid tiers or even free. 14 retrospective templates are cited (Start/Stop/Continue, Sprint Retro, 4Ls, etc.). No confirmed retro-specific AI clustering/summarization/sentiment feature was found for Lucidspark in this research — only vague references to "assisted grouping" and user requests for better AI diagram generation, suggesting Lucidspark trails Miro/Mural/FigJam on AI-for-retros specifically. Integrates with Slack, Google Drive, Zoom.

- A1 14 (confirmed via search) | A2 ? | A3 Partial | A4 ? | A5 ? | A6 Y (Team+) | A7 Partial (session-end hide Y; persistent authorship anonymity = Enterprise only) | A8 Partial (Enterprise for full "private writing") | A9 ?
- B1 ? | B2 ? | B3 Y ("assisted grouping" mentioned generically) | B4 Y | B5 ? | B6 ? | B7 Y (tagging mentioned)
- C1 ? | C2 Y ("Private Voting" toggle) | C3 ?
- D1 ? | D2 ? | D3 ? | D4 ? | D5 ?
- E1 ? (not confirmed) | E2 Partial ("assisted grouping," not confirmed as AI-driven clustering) | E3 ? | E4 ? | E5 ? | E6 ?
- F1 Y | F2 ? | F3 ? | F4 ? | F5 ? | F6 ?
- G1 Y (confirmed integration) | G2 ? | G3 ? | G4 ? | G5 Y (Google Drive confirmed) | G6 Y (Zoom confirmed) | G7 ? | G8 ? | G9 ?
- H1 ? | H2 ? | H3 ? | H4 ? | H5 ? | H6 ? | H7 ?
- I1 ? | I2 Y (SSO confirmed as a general feature) | I3 ? | I4 ? | I5 ? | I6 ? | I7 ? | I8 ?
- J1 Y (canvas presence, general) | J2 ? | J3 ? | J4 ? | J5 ? | J6 ? | J7 ?
- K1 Free tier exists (3 boards, general Lucid pattern; retro-specific limits not confirmed) | K2 Team, $9/user/mo | K3 **≈$72/mo** for 8 named Team seats (voting+timer); guest/free-editor model **not confirmed** — may require paid seats for all editors, unlike Miro/Mural/FigJam | K4 ? unconfirmed whether non-seat guests can edit for free | K5 ? (not confirmed this pass) | K6 ?

### 1.5 Atlassian (Jira + Confluence)

Atlassian ships **no dedicated first-party retro board product**. Confluence's free "Retrospective" template is a static document (Background / Start Doing / Stop Doing / Keep Doing / What's Next) with time allocations written as instructional text, not an enforced running timer — no native voting, no private/hidden-card mode, no drag-and-drop canvas. Jira itself has no native interactive retrospective feature (sprint reports/velocity only); retro *interactivity* is delegated either to Confluence's static template or to Marketplace apps. Atlassian's Rovo AI can reportedly auto-trigger an agent at sprint close to help prepare a retrospective (summarizing sprint activity), part of the 2025-2026 "Teamwork Collection" push tying Jira, Confluence, Loom, and Rovo together — but this is AI-assisted prep, not a live voting/clustering board. Both Jira and Confluence are free for teams ≤10 users. The top 2 Marketplace retro apps by installs are **Easy Agile TeamRhythm** (3.4k installs, 4.4/5, 161 reviews — story-map + retro + insights suite) and **Agile Retrospectives for Jira** by Catapult Labs (873 installs, 4.2/5, 23 reviews); both are confirmed **free for teams under 10 users**, then scale by a per-user calculator whose exact dollar figures were not retrievable this pass.

- A1 n/a (1 static Confluence template; interactive templates come from Marketplace apps, count unconfirmed) | A2 n/a | A3 N (native) | A4 N | A5 N | A6 N (native; static time allocations only) | A7 N (native) | A8 N (native) | A9 Partial (Confluence doc can be pre-filled async, but not a purpose-built async input flow)
- B1 N (native) | B2 Y (Confluence comments) | B3 N (native) | B4 N (native; Confluence is a document, not a canvas) | B5 Y (Confluence rich text/attachments) | B6 Y (Confluence @mentions) | B7 Partial (Confluence labels)
- C1 N (native) | C2 N (native) | C3 N (native)
- D1 Partial (Jira issues have assignee/due/status but must be manually created, not natively generated from a retro board) | D2 N (native) | D3 Y (Jira notifications, generic not retro-specific) | D4 Y (native — it *is* Jira) | D5 ?
- E1 Y (Rovo can summarize a Confluence page / sprint) | E2 ? | E3 ? | E4 ? | E5 Y (Rovo agent reportedly auto-activates at sprint close to prep retro) | E6 Loom video summarization via Rovo
- F1 Y | F2 Y (Confluence page history) | F3 ? | F4 ? | F5 ? | F6 Y (Jira dashboards, generic)
- G1 Y | G2 Y | G3 Y (native) | G4 Y (native) | G5 ? | G6 ? | G7 Y | G8 Y | G9 Y
- H1 Y (Confluence PDF export, general) | H2 ? | H3 ? | H4 n/a (is Confluence) | H5 ? | H6 Y (public Confluence links, plan-dependent) | H7 ?
- I1 ? | I2 Y (Premium/Enterprise) | I3 Y (Enterprise) | I4 Y (Premium+) | I5 Y (general Atlassian compliance program) | I6 Y (data residency, Premium+) | I7 Y | I8 ?
- J1 N (document, not live-cursor canvas) | J2 Y (Jira/Confluence mobile apps) | J3 ? | J4 Y (general) | J5 ? | J6 Y (general) | J7 ?
- K1 Free: Jira + Confluence both free ≤10 users, static template only, no AI | K2 Premium (for Rovo AI) — combined Jira+Confluence Premium ≈$26.07/user/mo (search-derived, not primary-confirmed) | K3 **$0/mo** for base product + a free-under-10-user Marketplace retro app (voting/timer via 3rd party, no native private mode); **≈$205–208/mo** for 8 seats if adding Premium-tier Rovo AI | K4 n/a (internal tool, not link-join) | K5 Y (~25% general Atlassian discount) | K6 ? (Marketplace apps commonly offer 30-day trials, not directly confirmed per-app this pass)

### 1.6 Microsoft — Azure DevOps "Retrospectives" extension

Microsoft's own free, first-party **Retrospectives** extension (published by Microsoft DevLabs / Microsoft Garage) has 95,198 installs and a 3.5/5 rating (330 reviews) on the Visual Studio Marketplace. It supports positive/negative feedback collection, categorization into groups for discussion, voting to prioritize items, a "focus mode" reviewing one item at a time, and pushing follow-up items directly into Azure Boards as tracked work items with historical roll-up status across past retros. The marketplace listing does **not** mention a timer or a defined template library — a real functional gap versus the whiteboard tools. It sits on top of Azure DevOps Basic, which is free for the first 5 users then $6/user/month — the extension itself carries no additional license cost regardless of team size.

- A1 N (not confirmed — no template library mentioned) | A2 N | A3 Partial (categories imply structure) | A4 N | A5 N | A6 N (not mentioned) | A7 Partial ("focus mode" = one item at a time, not full hide-until-reveal) | A8 ? | A9 ?
- B1 ? | B2 Y (discussion features implied) | B3 Y (categorize similar items) | B4 ? | B5 ? | B6 ? | B7 ?
- C1 Y (voting to prioritize) | C2 ? | C3 ?
- D1 Partial (work items created, assignee/due/status inherited from Azure Boards) | D2 Y ("view roll-up status" of previous work items — closest to a "carry-over" feature found in this whole research pass) | D3 ? | D4 n/a (is Azure Boards) | D5 N (Azure DevOps only)
- E1 N | E2 N | E3 N | E4 N | E5 N | E6 none found
- F1 Y (Azure DevOps project) | F2 Y (roll-up/history) | F3 ? | F4 ? | F5 ? | F6 ?
- G1 ? | G2 Y (Azure DevOps/Teams ecosystem, general) | G3 ? | G4 ? | G5 ? | G6 ? | G7 Y (Azure DevOps REST API, general) | G8 Y (general) | G9 ?
- H1 ? | H2 ? | H3 ? | H4 ? | H5 ? | H6 ? | H7 ?
- I1 ? | I2 Y (Azure AD/Entra, general) | I3 ? | I4 Y (Azure DevOps audit, general) | I5 Y (Microsoft compliance program, general) | I6 Y (Azure regions, general) | I7 ? | I8 ?
- J1 ? | J2 ? | J3 ? | J4 ? | J5 ? | J6 ? | J7 ?
- K1 n/a (extension itself always free) | K2 Azure DevOps Basic, $6/user/mo (only for users beyond first 5) | K3 **≈$18/mo** for 8 users (5 free + 3×$6); extension adds $0 | K4 n/a (internal Azure DevOps users, not link-join) | K5 ? | K6 n/a (free extension)

### 1.7 Microsoft — Loop & Teams/Whiteboard

Two distinct native surfaces exist. **Microsoft Loop**: typing "/retrospective" on a Loop page inserts a "Team Retrospective" component (what-went-well / what-didn't / what-to-improve categories); it's bundled inside Microsoft 365, with no confirmed dedicated voting, timer, or AI-clustering behavior found. **Microsoft Whiteboard** (used directly inside Teams meetings — "Whiteboard" in the meeting toolbar) has a genuinely built-in **Retrospective template** with Reactions (informal voting), color-coded sticky notes for categorizing feedback, "smart inking," and PNG export; no timer or private/anonymous mode was found in Microsoft's own support documentation. Neither surface was confirmed to have AI clustering/summarization comparable to Miro/Mural/FigJam, nor a specific required M365/Teams plan tier — both appear bundled into standard Microsoft 365/Teams access rather than sold as a discrete retro product.

- A1 Y (1 confirmed native template each in Loop and Whiteboard) | A2 Y (Loop custom page templates, general) | A3 Partial | A4 N | A5 N | A6 N (not found) | A7 N (not found) | A8 N (not found) | A9 Y (Loop async pages; Whiteboard shareable link)
- B1 Y (Whiteboard Reactions) | B2 Y (Loop comments, general) | B3 Partial (color-coded categories, not AI-driven) | B4 Y (Whiteboard sticky notes) | B5 Y (Whiteboard "smart inking") | B6 Y (Loop @mentions, general) | B7 Y (Whiteboard sticky colors)
- C1 N | C2 N | C3 Partial (Reactions as informal voting)
- D1 ? | D2 ? | D3 ? | D4 ? | D5 ?
- E1 N | E2 N | E3 N | E4 N | E5 N | E6 none found
- F1 Y (Microsoft 365 workspace, general) | F2 ? | F3 ? | F4 ? | F5 ? | F6 ?
- G1 ? | G2 Y (native — is Teams) | G3 ? | G4 ? | G5 ? | G6 Y (native Teams meeting integration confirmed) | G7 ? | G8 ? | G9 ?
- H1 ? | H2 ? | H3 ? | H4 ? | H5 ? | H6 ? | H7 Y (Whiteboard PNG export confirmed)
- I1 ? | I2 Y (Entra ID, general) | I3 ? | I4 ? | I5 Y (Microsoft compliance program, general) | I6 ? | I7 ? | I8 ?
- J1 ? | J2 Y (general) | J3 ? | J4 ? | J5 ? | J6 ? | J7 ?
- K1 n/a (bundled feature, not separately tiered) | K2 unclear which M365/Teams SKU is the floor — not specified in Microsoft's own doc | K3 **not independently verified** — presumed $0 incremental once a team already has Microsoft 365/Teams, but no confirmed timer/private-mode means the capability bar (voting+timer+private mode) is **not fully met at any price** | K4 n/a (internal org tool) | K5 ? | K6 ?

### 1.8 Notion

Notion has no native retro-specific interactivity — retrospectives run as a database/document using the free "Retrospective Template by Notion" (Review section with date/team/participants, a Start/Stop/Continue-style table, and a Follow-up Tasks section). There is no dot-voting, no timer, no private/hidden-card mode, and no AI clustering purpose-built for retros — any "voting" or "anonymity" must be manually simulated (e.g., emoji reactions, or a separate anonymous form). Action items *can* carry assignee/due-date/status because Notion databases natively support Person/Date/Status properties, but the team must configure that themselves — it isn't retro-specific tooling. Notion AI, as of a **May 2025** change, is no longer sold as a standalone add-on to Free/Plus — full AI (unlimited writing, Ask-Notion chat, meeting notes, workspace search) is now bundled only into **Business** ($20/user/mo annual, $24 monthly) or Enterprise; it is general workspace AI, not a dedicated retro summarizer/clusterer.

- A1 several free templates in the Notion template marketplace (exact count of "official" vs. community not fully disambiguated) | A2 Y (Notion is a general-purpose page/database builder) | A3 N | A4 N | A5 N | A6 N | A7 N | A8 N | A9 Y (async by nature — it's a shared doc)
- B1 Y (Notion reactions, general) | B2 Y (Notion comments) | B3 N (no native clustering) | B4 Partial (database views, not sticky-note canvas) | B5 Y (rich text/attachments native) | B6 Y (native) | B7 Y (Select/Multi-select properties)
- C1 N | C2 N | C3 N
- D1 Partial (Person/Date/Status DB properties — must be configured, not automatic) | D2 Partial (a linked/rollup DB view could show carry-over if built) | D3 ? (Notion reminders exist generically) | D4 ? (via Zapier/Make or manual, not native) | D5 ?
- E1 Y (Notion AI can summarize any page on request — generic, not retro-specific) | E2 N | E3 N | E4 N | E5 N | E6 Ask-Notion chat, meeting notes, workspace search (Business+)
- F1 Y | F2 Y (page history, general) | F3 N | F4 N | F5 N | F6 Partial (can be hand-built as a DB view)
- G1 Y (general Notion integration) | G2 Y (general) | G3 Y (general) | G4 ? | G5 Y (general) | G6 ? | G7 Y (general) | G8 Y (general) | G9 Y (general)
- H1 Y (general Notion export) | H2 Y (general) | H3 Y (native Markdown export) | H4 n/a | H5 ? | H6 Y (public page links) | H7 ?
- I1 Y (general) | I2 Y (Enterprise, general) | I3 Y (Enterprise, general) | I4 Y (Enterprise, general) | I5 Y (general compliance program) | I6 Y (general) | I7 Y (general) | I8 Y (general)
- J1 Partial (no live cursors/canvas presence the way whiteboards have it) | J2 Y (general) | J3 Y (general) | J4 Y (general) | J5 ? | J6 Y (general) | J7 Y (general)
- K1 Free: unlimited pages, AI = "limited trial" only | K2 Business, $20/user/mo annual (for full AI; not retro-specific) | K3 **$0** for a static template (no voting/timer/private mode exist at any price); **$160–$192/mo** for 8 seats of Business if generic AI desired | K4 n/a (link-join without seats not really the model — viewers can be free, editors typically need a Notion account) | K5 Y (annual discount, general) | K6 Y (general free trial pattern)

### 1.9 Google Workspace

Jamboard was fully discontinued: no new/edit after **October 1, 2024**; view-only until final shutdown on **December 31, 2024**. Google built **no native replacement** inside Workspace. Instead, per Google's own Workspace Updates blog (September 2023), Google named **FigJam, Lucidspark, and Miro** as official recommended whiteboarding partners, integrated into Google Meet (in-meeting panel), Drive (native file-creation entry), and Calendar scheduling — plus hardware partner Avocor for Series One Board displays. Practically, "Google" has no retro capability of its own to evaluate in 2026; it is a distribution/integration layer routing teams to the three whiteboard incumbents already profiled above. Nearly every taxonomy row is n/a for Google itself.

- A1–A9: n/a (no native product)
- B1–B7: n/a
- C1–C3: n/a
- D1–D5: n/a
- E1–E6: n/a
- F1–F6: n/a
- G1 ? | G2 ? | G3 ? | G4 ? | G5 Y (is Google Workspace — Meet/Drive/Calendar embed the 3 partners) | G6 Y (Google Meet, native) | G7 ? | G8 ? | G9 ?
- H1–H7: n/a
- I1–I8: general Google Workspace compliance posture, not retro-specific, not independently re-verified this pass
- J1–J7: n/a (no native canvas)
- K1 n/a | K2 n/a | K3 **n/a — re-routes to Miro/FigJam/Lucidspark pricing above**, no direct Google cost for retro capability itself | K4 n/a | K5 n/a | K6 n/a

---

## 2. Comparison Matrix

Legend: Y = yes/native, N = confirmed absent, Partial = exists but limited/conditional, ? = not verified this pass, n/a = not applicable to this product type.

| Row | Miro | FigJam | Mural | Lucidspark | Atlassian (Jira/Conf) | Azure DevOps ext | MS Loop/Whiteboard | Notion | Google Workspace |
|---|---|---|---|---|---|---|---|---|---|
| A1 templates (retro) | dozens (unverified #) | several (unverified #) | 8+ named | 14 | 1 static (native) | N | 1 each | several | n/a |
| A2 custom builder | Y | Y (AI prompt) | Y | ? | n/a | N | Y (Loop) | Y | n/a |
| A3 guided phases | Partial | Partial | Partial | Partial | N | Partial | Partial | N | n/a |
| A4 icebreakers | Y | Y | Y | ? | N | N | N | N | n/a |
| A5 mood/pulse | Partial | Partial | Partial | ? | N | N | N | N | n/a |
| A6 timer | Y (Starter+) | Y (free) | Y (free) | Y (Team+) | N | N | N | N | n/a |
| A7 hide-until-reveal | Y (Starter+) | Partial (votes only) | Y (free) | Partial (Enterprise for full) | N | Partial | N | N | n/a |
| A8 anonymous cards | Partial | N | Partial | Partial (Enterprise) | N | ? | N | N | n/a |
| A9 async pre-meeting | Y | Y | Y | ? | Partial | ? | Y | Y | n/a |
| B1 emoji reactions | Y | Y | ? | ? | N | ? | Y | Y | n/a |
| B2 comments/threads | Y | Y | Y | ? | Y | Y | Y | Y | n/a |
| B3 grouping/merge | Y (AI) | Y (AI) | Y (AI) | Y (generic) | N | Y | Partial | N | n/a |
| B4 drag and drop | Y | Y | Y | Y | N | ? | Y | Partial | n/a |
| B5 rich text/attach | Y | Y | Y | ? | Y | ? | Y | Y | n/a |
| B6 @mentions | ? | Y | ? | ? | Y | ? | Y | Y | n/a |
| B7 colors/tags | Y | Y | Y | Y | Partial | ? | Y | Y | n/a |
| C1 dot voting w/ limits | Y | Y | Y | ? | N | Y | N | N | n/a |
| C2 blind/secret voting | ? | Y | ? | Y | N | ? | N | N | n/a |
| C3 other voting modes | ? (polls/2x2) | ? | ? | ? | N | N | Partial | N | n/a |
| D1 action items (a/d/s) | Y | ? | Y (partial) | ? | Partial | Partial | ? | Partial | n/a |
| D2 carry-over of actions | ? | N | ? | ? | N | Y (best found) | ? | Partial | n/a |
| D3 reminders | ? | N | ? | ? | Y (generic) | ? | ? | ? | n/a |
| D4 push to Jira | Y | ? | Y | ? | Y (native) | n/a | ? | ? (Zapier) | n/a |
| D5 push to other trackers | Y (Azure DevOps) | ? | ? | ? | ? | N | ? | ? | n/a |
| E1 AI summary | Y | Y | Y | ? | Y (Rovo) | N | N | Y (generic) | n/a |
| E2 AI auto-grouping | Y | Y | Y | Partial | ? | N | N | N | n/a |
| E3 AI sentiment | Y | ? | Y | ? | ? | N | N | N | n/a |
| E4 AI suggested actions | Partial | N | ? | ? | ? | N | N | N | n/a |
| E5 AI facilitator/prompts | Partial | Partial | Partial | ? | Y (Rovo) | N | N | N | n/a |
| E6 other AI | diagrams, sketch-to-shape | board generation | MS 365 Copilot integration | ? | Loom summarization | none | none | Ask-Notion chat | n/a |
| F1 team/workspace | Y | Y | Y | Y | Y | Y | Y | Y | n/a |
| F2 retro history | ? | N | ? | ? | Y (Confluence) | Y | ? | Y | n/a |
| F3 trends over time | ? | N | ? | ? | ? | ? | ? | N | n/a |
| F4 participation analytics | ? | N | ? | ? | ? | ? | ? | N | n/a |
| F5 team health check | ? | N | ? | ? | ? | ? | ? | N | n/a |
| F6 dashboards/reports | ? | N | ? | ? | Y (Jira, generic) | ? | ? | Partial | n/a |
| G1 Slack | Y | ? | ? | Y | Y | ? | ? | Y | n/a |
| G2 MS Teams | ? | ? | ? | ? | Y | Y | Y (native) | Y | n/a |
| G3 Jira | Y | ? | Y | ? | Y (native) | ? | ? | Y (generic) | n/a |
| G4 Confluence | ? | ? | ? | ? | Y (native) | ? | ? | ? | n/a |
| G5 Google Workspace | ? | Y (Meet/Drive/Cal) | ? | Y (Drive) | ? | ? | ? | Y | Y (is the row) |
| G6 Zoom/video | ? | ? | ? | Y | ? | ? | Y (Teams native) | ? | Y (Meet) |
| G7 public API | Y | Y | ? | ? | Y | Y | ? | Y | ? |
| G8 webhooks | ? | ? | ? | ? | Y | Y | ? | Y | ? |
| G9 Zapier/Make | ? | ? | ? | ? | Y | ? | ? | Y | ? |
| H1 PDF export | ? | ? | ? | ? | Y | ? | ? | Y | n/a |
| H2 CSV/XLS | ? | ? | ? | ? | ? | ? | ? | Y | n/a |
| H3 Markdown | ? | ? | ? | ? | ? | ? | ? | Y (native) | n/a |
| H4 export to Confluence/Notion | ? | ? | ? | ? | n/a | ? | ? | n/a | n/a |
| H5 email summary | ? | ? | ? | ? | ? | ? | ? | ? | n/a |
| H6 public read-only link | Y | Y | ? | ? | Y | ? | ? | Y | n/a |
| H7 image export | ? | Y (general) | ? | ? | ? | ? | Y (PNG) | ? | n/a |
| I1 social login | ? | ? | ? | ? | ? | ? | ? | Y | n/a |
| I2 SSO/SAML | Y (Ent.) | Y (Ent./Org) | Y (Business+) | Y | Y (Premium+) | Y | Y | Y (Ent.) | n/a |
| I3 SCIM | ? | ? | Y (Ent.) | ? | Y (Ent.) | ? | ? | Y (Ent.) | n/a |
| I4 audit logs | ? | ? | ? | ? | Y (Premium+) | Y | ? | Y (Ent.) | n/a |
| I5 SOC2/ISO27001 | ? | ? | ? | ? | Y | Y | Y | Y | n/a |
| I6 GDPR/residency | ? | ? | ? | ? | Y (Premium+) | Y | ? | Y | n/a |
| I7 retention/deletion | ? | ? | ? | ? | Y | ? | ? | Y | n/a |
| I8 custom branding | ? | ? | ? | ? | ? | ? | ? | Y (Ent.) | n/a |
| J1 presence/cursors | Y | Y | Y | Y | N | ? | ? | Partial | n/a |
| J2 native mobile apps | Y | ? | ? | ? | Y | ? | Y | Y | n/a |
| J3 mobile web quality | ? | ? | ? | ? | ? | ? | ? | Y | n/a |
| J4 dark mode | ? | ? | ? | ? | Y | ? | ? | Y | n/a |
| J5 accessibility/WCAG | ? | ? | ? | ? | ? | ? | ? | ? | n/a |
| J6 UI languages | ? | ? | ? | ? | Y | ? | ? | Y | n/a |
| J7 keyboard shortcuts | ? | ? | ? | ? | ? | ? | ? | Y | n/a |
| K1 free tier | 3 boards, no timer/vote/private confirmed | unlimited viewers, timer+voting free | voting+timer+private mode all free | 3 boards (pattern) | Jira+Confl free ≤10 users | n/a (ext. always free) | bundled, no separate tier | unlimited pages, AI trial only | n/a |
| K2 cheapest retro-unlocking plan | Starter $8/user/mo | Professional (Collab $3 / Full $16 annual) | Free already qualifies; Team+ $9.99/mo for AI | Team $9/user/mo | Free (native) / Premium ~$26/user/mo combined (AI) | Basic $6/user/mo (past 5 free) | unclear SKU | Business $20/user/mo (generic AI only) | n/a |
| K3 8-person monthly cost | **$8–$64** | **$0** (voting+timer); AI $24–$160 | **$0** (voting+timer+private); AI $9.99–$79.92 | **≈$72** | **$0** (native+free app) / **≈$205–208** (AI) | **≈$18** | not verified; presumed ~$0 incremental | **$0** (static) / $160–192 (generic AI) | n/a, re-routes |
| K4 guest/participant model | free visitor editing (Starter+) | free viewers via link; editor rights org-dependent | free visitor editing (all plans) | not confirmed | n/a (internal) | n/a (internal) | n/a (internal) | editors typically need account | n/a |
| K5 annual discount | Y | Y | Y | ? | Y | ? | ? | Y | n/a |
| K6 trial | ? | ? | ? | ? | ? (30-day common on Marketplace) | n/a | ? | Y | n/a |

---

## 3. What a whiteboard cannot do for a retro (evidence-based gaps)

1. **No cross-session action-item tracking as a built-in feature.** Across Miro, FigJam, Mural, and Lucidspark, every confirmed action-item capability was "create a card, optionally push it to Jira/Azure DevOps" — none of the fetched product pages described a native dashboard showing whether *last retro's* action items got done, or a reminder system tied to a retro board. The one genuine "carry-over" feature found in this entire research pass belongs to Microsoft's free Azure DevOps Retrospectives extension ("view roll-up status" of prior work items) — a dedicated retro tool feature, not something the general-purpose whiteboards do.
2. **Anonymous/blind input is inconsistent and often paid-gated.** FigJam has explicitly **no** anonymous-card mode (creator always shown); Lucidspark's persistent authorship-anonymity ("private writing") requires the **Enterprise** plan; only Mural includes real Private Mode on its free tier. A team assuming "the whiteboard we already pay for has blind retro input" may be wrong depending on which one they have and which plan.
3. **Guests/participants may need seats, or the model is genuinely unclear.** Miro and Mural confirmed free visitor/guest editing without a paid seat; FigJam's guest-edit rights depend on org link-sharing settings; Lucidspark's guest-editing model could not be confirmed at all in this research and may require paid seats for every editor — the opposite of RetroBoard's no-account, unlimited-participant model.
4. **No team-health/mood trend tracking over time.** None of the four whiteboards showed a pulse/mood-over-time dashboard (row F5) or participation analytics (F4) in any fetched source — "mood" is captured ad hoc per-board via colored stickies or emoji, not aggregated across retros.
5. **AI synthesis — the single most-cited reason teams think "our whiteboard already does this" — is paid-gated in 3 of 4 tools.** FigJam's AI sort/summarize is explicitly "available on paid plans" only; Miro's is free-trial-credit-limited; Mural's requires Team+ ($9.99/user/mo) or higher. Only Mural's core mechanics (voting/timer/private mode, not AI) are genuinely free for an 8-person team.
6. **No enforced facilitation guardrails.** Dot-vote limits, phase-locking, and structured "polls/2x2" facilitation appear as paid upsells even within Miro (Business-tier "Engage activities") rather than being core, enforced whiteboard behavior — teams currently rely on manual trust/etiquette on lower tiers.
7. **Atlassian and Notion have no interactive retro board at all natively** — Confluence's retrospective "template" is a static document with instructional (not running) time boxes, no voting, no drag-and-drop; Notion's is a database template with the same limitations. Both require either a Marketplace app (Atlassian) or manual workarounds (Notion) to get anything resembling live voting or a timer.

---

## 4. 2025–2026 AI launches relevant to retros (dated where confirmed)

- **March 11, 2025** — Figma restructures pricing/seats (Full/Dev/Collab/View), bundling full FigJam **and** FigJam AI into every paid seat for the first time (previously separate FigJam-only seats existed at lower cost). Source: Figma Blog, "Updates to our pricing, seats, and billing experience."
- **November 2023** (foundational, still the operative feature set into 2026 per Figma's own Help Center) — "Introducing AI to FigJam" ships Sort/Summarize/Generate. No dedicated 2025-2026 refresh announcement was found in this pass; current documentation describes the same mechanics.
- **May 2025** — Notion retires the standalone Notion AI add-on for new Free/Plus customers; full AI becomes Business-plan-exclusive ($20/user/mo). Not retro-specific, but changes the cost of "AI-assisted retro notes in Notion."
- **September 2023** (context, pre-window but still governing 2026 state) — Google Workspace Updates blog names FigJam, Lucidspark, and Miro as official Jamboard-replacement whiteboarding partners inside Meet/Drive/Calendar — the arrangement search results confirm is still in force in 2026.
- **October 1 – December 31, 2024** — Google Jamboard edit-lock then full shutdown, the event that made "which whiteboard do we already have" a live question for teams evaluating dedicated retro tools.
- **Undated, described only as "2025-2026 era"** — Atlassian's "Teamwork Collection" (Jira + Confluence + Loom + Rovo) messaging, including a Rovo agent reportedly able to auto-activate at sprint close to help prepare a retrospective. Atlassian blog URL slug references "team-26," suggesting a 2026-branded release wave, but no specific calendar date was confirmed.
- **Undated (title only, not fetched)** — Mural introduces Mural AI with Microsoft 365 Copilot integration (TechTarget headline surfaced; exact publish date not independently confirmed this pass).
- **Not dated at all** — Miro's AI Assist / "Create with AI" retrospective clustering and summarization: description confirmed via multiple sources, but no specific launch date was found in any fetched primary source this pass.

---

## 5. Unverifiable / low-confidence items (flagged, not guessed)

- Exact retro-specific template *counts* for Miro (beyond sitewide "300+ templates") and FigJam — no authoritative number found.
- Exact Marketplace-calculator dollar pricing for Easy Agile TeamRhythm and Agile Retrospectives for Jira above the confirmed "free ≤10 users" threshold — both apps gate exact tiers behind an interactive calculator that wasn't fetchable as static content.
- Whether Lucidspark allows any form of free guest/visitor editing (unlike Miro, Mural, and FigJam, which all confirmed some free-guest-edit mechanism) — not found either way.
- Whether Lucidspark has any retro-specific AI clustering/summarization/sentiment feature at all — sources only mention generic "assisted grouping" and user requests for better AI; may simply not exist yet, or may exist and be undocumented in the sources surfaced.
- Exact Atlassian Rovo pricing/plan-gating mechanism (bundled into Premium vs. separate consumption-credit purchase) and a primary-sourced per-user dollar figure — the $26.07/user/mo "Premium combined" figure is a search-engine-derived secondary-source composite (Jira Premium $15.25 + Confluence Premium $10.44), not confirmed on an Atlassian pricing page directly in this pass.
- Which Microsoft 365/Teams SKU (Business Basic/Standard/Premium, E3/E5, etc.) is the actual floor required for Loop's retrospective component or Teams-embedded Whiteboard — Microsoft's own support article did not specify a plan requirement.
- Exact publish date for Mural's Microsoft 365 Copilot integration announcement (TechTarget headline only, article not fetched).
- Exact launch date for Miro's AI-driven retrospective clustering/summarization feature set.
- Whether Confluence's retrospective template's stated "10 minutes / 5 minutes" sections are backed by any running-timer macro/add-on versus being purely instructional text (evidence leans toward "text only," not fully ruled out).
- Miro's free-plan AI credit allotment — one secondary source said 10 credits/month, the primary pricing-page fetch did not surface a specific free-tier number, only "limited AI trial."
- FigJam's exact plan-gating for whether non-seat-holder guests can *edit* (not just view/comment) via a shared link at the Organization/Enterprise tier — behavior may depend on admin-configured link-sharing policy, not confirmed as a fixed rule.

---

## 6. Sources

- Miro pricing — https://miro.com/pricing/ (fetched 2026-09-04)
- Miro AI Retrospective — https://miro.com/ai/ai-retrospective/ (fetched 2026-09-04)
- Miro Retrospective tool — https://miro.com/agile/retrospective/ (fetched 2026-09-04)
- Figma pricing — https://www.figma.com/pricing/ (fetched 2026-09-04)
- FigJam AI sort/summarize — https://help.figma.com/hc/en-us/articles/18711926790423-Sort-and-summarize-stickies-with-FigJam-AI (fetched 2026-09-04)
- Figma blog, pricing/billing update — https://www.figma.com/blog/billing-experience-update-2025/ (referenced via search, dated 2025)
- Figma blog, "Introducing AI to FigJam" — https://www.figma.com/blog/introducing-ai-to-figjam/ (referenced via search, dated Nov 2023 per search summary)
- FigJam timer help doc — https://help.figma.com/hc/en-us/articles/4402269549591-Stay-on-track-with-the-timer-in-FigJam (referenced via search)
- FigJam voting sessions — https://help.figma.com/hc/en-us/articles/9359912208663-Run-voting-sessions-in-FigJam (referenced via search)
- FigJam virtual icebreakers template — https://www.figma.com/templates/virtual-icebreakers/ (referenced via search)
- Mural pricing — https://www.mural.co/pricing (fetched 2026-09-04)
- Mural retrospective use case — https://www.mural.co/use-case/retrospective (fetched 2026-09-04)
- Mural AI (product page) — https://www.mural.co/mural-ai (referenced via search; direct fetch 404'd)
- Mural AI clustering blog — https://www.mural.co/blog/ai-sticky-note-clustering (referenced via search)
- Mural + Microsoft 365 Copilot (TechTarget) — https://www.techtarget.com/searchunifiedcommunications/news/366558012/Mural-intros-Mural-AI-integrates-with-Microsoft-365-Copilot (referenced via search, not fetched)
- Lucid/Lucidspark pricing — https://lucid.app/pricing/lucidspark (fetch returned incomplete content; figures corroborated via search of Capterra/xpay/saasworthy, 2026)
- Lucidspark online retrospective tool — https://lucid.co/lucidspark/create/online-retrospective-tool (referenced via search)
- Lucidspark voting sessions help — https://help.lucid.co/hc/en-us/articles/14995416237460-Use-Voting-sessions-to-collaborate-in-Lucidspark (referenced via search)
- Lucidspark private mode community thread — https://community.lucid.co/ideas/is-there-a-private-collaboration-mode-in-lucidspark-995 (referenced via search)
- Atlassian Confluence retrospective template — https://www.atlassian.com/software/confluence/templates/retrospective (fetched 2026-09-04)
- Atlassian Teamwork Collection blog — https://www.atlassian.com/blog/company-news/teamwork-collection-team-26 (referenced via search)
- Atlassian Marketplace search (Jira retrospective apps) — https://marketplace.atlassian.com/search?hosting=cloud&product=jira&query=retrospective (fetched 2026-09-04)
- Easy Agile pricing — https://www.easyagile.com/pricing (fetched 2026-09-04)
- Catapult Labs / Agile Retrospectives for Jira — https://www.catapultlabs.com/retrospectives (referenced via search)
- Azure DevOps Retrospectives extension (Microsoft DevLabs) — https://marketplace.visualstudio.com/items?itemName=ms-devlabs.team-retrospectives (fetched 2026-09-04)
- Microsoft Whiteboard retrospectives support doc — https://support.microsoft.com/en-us/office/retrospectives-in-microsoft-whiteboard-c7dfe73e-61e1-4366-be76-a424741ee226 (fetched 2026-09-04)
- Microsoft Loop retrospective usage (Lyndsay Ansell blog) — https://lyndsay.blog/2024/07/07/how-to-use-microsoft-loop-for-a-retrospective/ (referenced via search)
- Notion retrospective template — https://www.notion.com/templates/retrospective (fetched 2026-09-04)
- Notion pricing / AI add-on retirement — referenced via search aggregation (userjot.com, costbench.com, felloai.com, layer3labs.io — all dated 2026, citing May 2025 retirement date)
- Google Workspace whiteboarding partner announcement — https://workspaceupdates.googleblog.com/2023/09/the-next-phase-of-digital-whiteboarding-for-google-workspace.html (referenced via search, dated Sept 2023)
- Jira/Confluence pricing aggregation — referenced via search (ones.com, saascrmreview.com, usecarly.com — all dated 2026)
- Azure DevOps pricing aggregation — referenced via search (aiproductivity.ai, toolradar.com — dated 2026)
