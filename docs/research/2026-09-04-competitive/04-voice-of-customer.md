# RetroBoard Competitive Intelligence — Voice of Customer & Market Dynamics

Research date: 2026-09-04. Web research only (no project code read or modified). Method: ~35 WebSearch queries + 21 WebFetch attempts across direct, adversarial, temporal, and named-entity angles, per the senior-researcher skill methodology.

## Methodology & access limitations (read first — affects confidence throughout)

- **Reddit was fully inaccessible.** `reddit.com` and `old.reddit.com` (including the public JSON search endpoint) refused WebFetch outright on every attempt. All "Reddit" content below is WebSearch's own indexed-snippet synthesis (secondary, low-fidelity), never a direct read of a live thread. This materially weakens sub-question 3.
- **Hacker News (Algolia API) was fetchable** but returned only old (2019–2023) Show HN posts for niche retro tools (GoRetro, TeleRetro, Reetro) with essentially no 2025–2026 discussion of the named vendors — HN is simply not where this category is discussed.
- **G2's "pros and cons" pages and TrustRadius returned HTTP 403** on every direct WebFetch attempt (bot-blocked). Where G2/TrustRadius content appears below it is WebSearch's own synthesis of indexed snippets, marked **[search-synthesized]**; content marked **[fetched]** came from a page I read directly (mainly Capterra, which was not blocked, plus vendor changelogs and blogs).
- Several sources are vendor-authored comparison pages (echometerapp.com/*-alternative, teamretro.com/compare/*, easyretro.io/alternative/*, kollabe.com blog posts). These are marketing copy competing against the tool they're comparing — useful for feature-gap mapping, unreliable for sentiment, and flagged inline as **[vendor marketing]**.
- Capterra review pages were the single richest source: dated, named, attributed verbatim quotes for EasyRetro, TeamRetro, and Parabol. Retrium, Neatro, GoRetro, Metro Retro/Spreo, and Kollabe have thinner direct-quote coverage because their G2/Capterra pages were either blocked or returned little indexed text.

---

## 1. Selection drivers — why buyers chose these tools

**Confidence: Partially answered.** Strong verbatim coverage for EasyRetro, TeamRetro, Parabol (Capterra fetched directly). Weaker for Retrium, Neatro, GoRetro, Kollabe, Metro Retro/Spreo (G2 blocked; relied on search-synthesis).

| Theme | Distinct sources | Representative snippet | URL |
|---|---|---|---|
| Ease of use / fast time-to-first-retro | 8 (EasyRetro, TeamRetro, Retrium, Parabol, Neatro, GoRetro, Kollabe, Spreo — G2 + Capterra) | "EasyRetro is focused on the use case of retros and because of that it's very easy to setup" — Ryan S., Engineering Manager, May 17 2023 | https://www.capterra.com/p/185134/EasyRetro/reviews/ |
| No signup/account needed for participants | 6 (Kollabe, GoRetro, RetroFlow, Retro Harbour, StickyRetro, EasyRetro's own design) | "Quickly and easily invite your entire team to the room with a shareable link with no sign up required" | https://kollabe.com/retrospectives |
| Price/value beats named competitors | 4 (TeamRetro Capterra x2, Parabol Capterra x2) | "There is no other product on the market that delivers this number of features at this level of quality at this price." — Gregory K., May 22 2020 | https://www.capterra.com/p/193264/TeamRetro/reviews/ |
| Anonymous input / psychological safety | 3 (TeamRetro G2 [search-synthesized], Retrium G2 [search-synthesized], Parabol Capterra [fetched]) | "[Allows users to] anonymously post feedback, anonymously vote and still give an option to discuss" — Ivan F., Jan 2021 | https://www.capterra.com/p/182731/Parabol/reviews/ |
| "It's genuinely free" | 2 (Parabol Capterra x2) | "it was also free and offered the best functionality" — Sascha W., June 2020 | https://www.capterra.com/p/182731/Parabol/reviews/ |
| Flat / per-team (not per-seat) pricing | 3 (TeamRetro marketing+review, Retrium pricing page [fetched], Kollabe positioning) | A Retrium "Team Room" lets teams "add unlimited team members at no additional cost" | https://www.retrium.com/pricing |
| Template/format variety | 3 (EasyRetro "200+ templates", Retrium G2, TeamRetro Capterra) | "We really enjoy the highly customizability of the templates." — Wim K., March 6 2024 | https://www.capterra.com/p/193264/TeamRetro/reviews/ |
| Customer support responsiveness | 3 (EasyRetro Capterra, Capterra CS sub-score 4.9/5, Kollabe) | "Their customer service is top notch... had it fixed with lightning speed" — Evan G., July 31 2019 | https://www.capterra.com/p/185134/EasyRetro/reviews/ |

**Representative snippets (8):**
1. "EasyRetro is focused on the use case of retros and because of that it's very easy to setup" — Ryan S., Engineering Manager (May 17 2023). https://www.capterra.com/p/185134/EasyRetro/reviews/
2. "Features and price were superior to all other offerings." — Gregory K. on choosing TeamRetro (May 22 2020). https://www.capterra.com/p/193264/TeamRetro/reviews/
3. "it was also free and offered the best functionality" — Sascha W. on choosing Parabol (June 2020). https://www.capterra.com/p/182731/Parabol/reviews/
4. "I like the ability to hide the contribution of other team members until we have all filled out" — Data Scientist, EasyRetro (Dec 9 2021). https://www.capterra.com/p/185134/EasyRetro/reviews/
5. "It takes me no longer than 2 minutes to login and create a board" — Lead Product Owner, EasyRetro (Nov 17 2021). https://www.capterra.com/p/185134/EasyRetro/reviews/
6. "The UX is just great, and makes it really natural and intuitive." — Engineering Director, TeamRetro (Jan 15 2023). https://www.capterra.com/p/193264/TeamRetro/reviews/
7. "very easy to get started, adding new members works through a direct link invite" — Pablo B., Parabol (May 2021). https://www.capterra.com/p/182731/Parabol/reviews/
8. "It's always been a challenge to include them in our retrospectives... FunRetro [now EasyRetro] is far and away the best" — VP of Product (May 17 2019). https://www.capterra.com/p/185134/EasyRetro/reviews/

---

## 2. Churn drivers — what makes teams leave or complain

**Confidence: Partially answered.** Good direct quotes for EasyRetro, Parabol, TeamRetro dislikes; thin for the rest. The single biggest churn-inducing *event* found (Metro Retro's free-plan removal) is confirmed from the vendor's own primary announcement but I could not retrieve direct customer-reaction quotes to it — Reddit, where that reaction most likely lives, was inaccessible.

| Theme | Distinct sources | Representative snippet | URL |
|---|---|---|---|
| No history — can't save/revisit past boards | 3 (EasyRetro Capterra x2, dev.to Kollabe-vs-EasyRetro comparison) | "You can't save previous boards to historical reference, so we have to wipe the board clean" — Daniel Z., Software Quality Engineer (May 27 2020) | https://www.capterra.com/p/185134/EasyRetro/reviews/ |
| Missing/broken integrations (Jira, Notion, Slack) | 3 (EasyRetro, Parabol, TeamRetro Capterra reviews) | "The inability to export the tasks from retrospectives into our Jira instance" — VR, Parabol (Nov 2021) | https://www.capterra.com/p/182731/Parabol/reviews/ |
| Pricing / cost too high for the use case | 3 (EasyRetro Capterra x2, TeamRetro Capterra, Metro Retro free-plan removal) | "Too expensive to pay for it... must have pro version to export report" — Ashley C. (March 17 2020) | https://www.capterra.com/p/185134/EasyRetro/reviews/ |
| Action items tracked manually outside the tool | 2 (EasyRetro Capterra, general Jira-gap commentary) | "Action points from retro needs to be tracked outside the tool manually" — Abhinav S., Senior Software Engineer (Aug 30 2019) | https://www.capterra.com/p/185134/EasyRetro/reviews/ |
| Buggy/clunky UI, especially grouping | 3 (TeamRetro, Parabol, Neatro — Capterra + search-synthesized) | Grouping "often feels slow and buggy" — Jonna L. (Feb 20 2026) | https://www.capterra.com/p/193264/TeamRetro/reviews/ |
| Team/participant administration friction | 2 (EasyRetro, Parabol Capterra) | "You have to reregister for every single team" — Sascha W. (June 2020) | https://www.capterra.com/p/182731/Parabol/reviews/ |
| Free-plan removal / shrinking free tier | 1 primary event + corroboration (Spreo's own blog; Kollabe and EasyRetro comparison pages citing it) | "This change will allow us to better support our growing customer base by focusing our resources on the experience for our paying customers." — Spreo/Ludi/Metro Retro, Sept 10 2024 | https://spreo.io/blog/metro-retros-new-chapter |
| Customization limits | 2 (EasyRetro Capterra x2) | "The ability to customize certain aspects of the board / columns is the only drawback" — Wesley S., Engineering Manager (June 3 2019) | https://www.capterra.com/p/185134/EasyRetro/reviews/ |

No verbatim mobile-app complaints turned up in accessible sources despite targeted searching — treat "poor mobile experience" as **unconfirmed/not found**, not as absent-in-the-market.

---

## 3. Community recommendations (Reddit / HN / dev blogs)

**Confidence: Weakly answered — flag this clearly.** Reddit was categorically inaccessible to WebFetch (both `reddit.com` and `old.reddit.com`, including JSON search, were refused). WebSearch's own crawl of Reddit returned no on-topic 2025–2026 threads about these named vendors — results were dominated by SEO listicles and vendor alternative-pages instead. HN Algolia search returned only 2019–2023 Show HN posts, not 2025–2026 recommendation threads. What follows is therefore built from dev.to blog posts and vendor/independent comparison sites, not raw forum sentiment — treat as suggestive, not representative.

- **dev.to (Kelly, "Kollabe vs EasyRetro: two free retro tools, very different bets," published Feb 2026, author on dev.to since Sept 2025)** frames the two tools as opposite philosophies: "EasyRetro's free plan is better for occasional, large-group retros. Kollabe's free plan is better for small teams running recurring ceremonies," citing EasyRetro's forced board-deletion-before-reuse vs. Kollabe's 7-day history + free AI grouping. https://dev.to/kelly-app/kollabe-vs-easyretro-two-free-retro-tools-very-different-bets-17i2
- **Kollabe's own blog** (vendor marketing, weight accordingly) claims: "For most teams running a retro every sprint, Kollabe's unlimited free retros make it the default choice, with Parabol as the strongest all-in-one alternative and Reetro the budget pick for multiple squads." https://kollabe.com/posts/best-free-retro-tools
- **retrospectivetools.com** (independent-leaning guide site) names Parabol and TeamRetro as the only tools that "genuinely support async," and explicitly calls out unmet needs: teams want boards that "stay open 48–72 hours," anonymous brainstorming without a live host, and action items with owners surviving board close. https://www.retrospectivetools.com/guides/async-retros-that-work/
- Recurring secondary claim (uncorroborated by a primary source I could reach): teams switching off EasyRetro/FunRetro commonly cite "free plan limitations (only 3 boards on free tier) and signup friction requiring every participant to have an account" — this is a WebSearch synthesis of alternative-site copy, not a verified forum quote.
- **What people say they wish existed** (aggregated across dev.to + comparison sites, not forum-verified): tools that keep meeting history without a paid tier, retro-plus-standup-plus-poker bundles without per-seat pricing, and genuinely async-native (not just "has a comment box") retros for distributed teams.

**Bottom line for sub-question 3:** the tools that surface repeatedly in independent-ish blog content are Parabol (all-in-one, free-tier goodwill), Kollabe (small-team/no-per-seat), and TeamRetro (feature depth, enterprise-readiness) — but this is a thin, blog-mediated signal, not verified community consensus. Do not treat this section as equivalent in rigor to sections 1, 2, or 6.

---

## 4. 2025–2026 vendor launches — narrative summary

**Confidence: Well answered for TeamRetro and EasyRetro (rich primary changelogs); partial for Neatro/Metro Retro-Spreo/Parabol; weak for Retrium and GoRetro.**

- **TeamRetro is the clear category pace-setter.** Its public changelog (https://help.teamretro.com/article/308-whats-new, fetched directly) shows essentially monthly shipping from January 2025 through September 2026: AI-suggested actions, an AI assistant ("trAI"), an MCP server for connecting to Claude/ChatGPT, team-scoped webhooks and API keys, SCIM, audit-style "Allowed IP ranges" for Enterprise, Notion/Slack/Teams publishing, and — in development as of Sept 2026 — an async-by-default "Standups" meeting type. This velocity is far higher than any other vendor found in this research.
- **EasyRetro** shipped steadily but more modestly through 2025–2026 (https://easyretro.io/whats-new/, fetched directly): drawing on cards (Aug 2025), hide-column (Jan 2026), timer pause/resume/extend (June 2026), dashboard bulk actions (June 2026), new survey types (June 2026), expanded exports incl. free-tier PNG/CSV (July 2026), and — notably — enterprise audit logs (July 2026), EasyRetro's first clearly enterprise-gated feature. One source characterized these as "small quality-of-life wins rather than a pivot toward an AI-first or analytics platform," and confirmed EasyRetro still has "no AI grouping."
- **Metro Retro** underwent the most dramatic transformation in the category: ended its long-standing free plan on **Sept 10, 2024** (just outside the requested window but essential context — see §6), rebranded to **Ludi in August 2025**, then rebranded again to **Spreo in July 2026**, repositioning from a retro-specific tool to general "online whiteboard software."
- **Neatro** [search-synthesized] added AI grouping suggestions, template generation, action suggestions, meeting summaries, and team-sentiment analysis, plus SOC 2 Type 2 / EU-US hosting choice — but no reliable dated changelog was found, and one source directly contradicts the SOC 2 claim (see §10, contradiction #1).
- **Parabol** [search-synthesized, thin] appears to be testing custom AI prompts over meeting data inside an upcoming "Pages" feature for team-knowledge documentation, but no dated changelog entries were found.
- **Retrium**: no 2025–2026 product or pricing changes were found anywhere in this research — its pricing page (fetched directly) shows no changelog and no evidence of recent investment.
- **GoRetro**: one 2026 review-aggregator source states its public changelog "has not moved since May 2023" and that its AI story is "thinner than the marketing implies" (Jira-driven "Joker cards" and a meeting-recap export exist; AI clustering/action items/sentiment analysis do not) — a notable claims-vs-reality gap given GoRetro markets itself as a top-rated, AI-capable, "100,000 developers" tool.
- **Kollabe**: positioned as a newer entrant (flat per-space pricing, AI grouping on the free tier, Jira/GitHub/Linear/Azure DevOps sync) but no dated changelog was located — evidence is feature-comparison-page-level, not release-note-level.

---

## 5. Enterprise / security asks

**Confidence: Partially answered.** Good supply-side evidence (what vendors built, implying what large buyers ask for) via vendor security/compliance pages and changelog entries. Weak demand-side evidence — no reviewer text was found explicitly saying "we required SOC 2 / SSO to buy this." No evidence, positive or negative, was found regarding whether small teams care; the absence itself is the finding.

| Requirement | Evidence found | URL |
|---|---|---|
| SOC 2 Type II | TeamRetro: "SOC 2 Type 2 accredited... independent auditor... in accordance with ASAE 3150"; downloadable report | https://www.teamretro.com/request-soc-2-type-2-report |
| GDPR / regional hosting | TeamRetro offers US or EU hosting choice; Neatro claimed the same [search-synthesized, contradicted — see §10] | https://www.teamretro.com/security/ |
| Admin/audit controls | EasyRetro added audit logs July 2026 (Enterprise, 10+ members, 12-month retention) — its first enterprise-gated feature | https://easyretro.io/whats-new/ |
| IP allow-listing | TeamRetro: "Enterprise customers can restrict access to approved IP addresses" (Nov 2025) | https://help.teamretro.com/article/308-whats-new |
| SSO/SCIM | TeamRetro added SCIM and higher MCP/API request budgets for Enterprise (Aug 2026); Parabol's Enterprise tier adds SSO [search-synthesized] | https://help.teamretro.com/article/308-whats-new |
| ISO 27001 / on-prem | Reetro (smaller/budget-positioned tool per Kollabe's own comparison) markets ISO-27001 certification, SOC2-certified datacenters, and on-premises installation — notable that a budget-tier tool leads with the heaviest security marketing found in this research | https://reetro.io/enterprise-retrospective.html |

No small-team reviewer in any accessible source cited security/compliance as a reason for choosing or rejecting a tool. All security language found originates from vendor Enterprise-tier marketing pages, not buyer reviews — consistent with security being a deal-gating requirement for larger procurement processes rather than a demand signal from small teams.

---

## 6. Pricing psychology

**Confidence: Well answered — the best-evidenced sub-question in this report**, anchored by a primary-source vendor announcement.

| Data point | Evidence | URL |
|---|---|---|
| Metro Retro ended its free plan | "This change will allow us to better support our growing customer base by focusing our resources on the experience for our paying customers." Announced **Sept 10, 2024**. New tiers at launch: Starter $39/mo (1 team, ≤20 members), Business from $76/mo (20–200 members), Enterprise per-user for 100+. [fetched, primary] | https://spreo.io/blog/metro-retros-new-chapter |
| ...but pricing model appears to have shifted again by 2026 | A later aggregator [search-synthesized, contradicts the above] reports Spreo's Starter at "$4/member/month billed annually" and Business at "$6/member/month" — i.e., a move from flat-banded-by-team-size back toward per-seat. Flagged as an unresolved contradiction, not a confirmed timeline — see §10. | (search-synthesized, no single URL) |
| EasyRetro's free tier has tightened | Currently "2 public boards per month," unlimited participants, boards "visible to anyone with the link," no history retention | https://kollabe.com/posts/best-free-retro-tools |
| Parabol's free tier is genuinely generous | "2 teams, unlimited meetings" free; paid Team tier $8/active user/month | https://www.parabol.co/pricing/ (via search) |
| TeamRetro and Retrium explicitly market flat/per-team pricing as a differentiator against per-seat rivals | Retrium: a Team Room lets you "add unlimited team members at no additional cost." TeamRetro marketing explicitly tells buyers to "stop doing per-seat math." | https://www.retrium.com/pricing |
| Kollabe positions itself entirely against per-seat pricing | "Best suited for small to mid-size agile teams that want retros, standups and planning poker in one clean tool without per-seat pricing." | https://kollabe.com/posts/best-free-retro-tools |

**Does "no signup for participants" show up as a stated reason to choose a tool?** Yes, but mostly as a **vendor/blog-articulated value proposition rather than a verbatim buyer-review reason**. Kollabe, GoRetro, RetroFlow, Retro Harbour, and StickyRetro all build their entire pitch around it ("no card, no account, no nag screens"; friction "kills momentum before the retro even starts... especially [for] contractors, cross-team guests"). EasyRetro's actual Capterra reviews corroborate the underlying pain even without using the phrase: "It's always been a challenge to include them in our retrospectives... FunRetro is far and away the best" (remote/guest participants). I did not find a Capterra/G2 reviewer explicitly writing "I chose this tool because participants don't need an account" — the evidence is strong that the feature is valued and heavily marketed, weaker that reviewers name it unprompted as their deciding factor.

**Does "flat price" show up as a stated reason?** Yes, more directly than the signup point: TeamRetro's Capterra reviews explicitly cite price ("Features and price were superior to all other offerings"; "no other product... delivers this number of features at this level of quality at this price"), and multiple vendors (TeamRetro, Retrium, Kollabe) build marketing copy specifically contrasting themselves against per-seat competitors — which itself is evidence they believe buyers respond to that framing.

---

## 7. Async and distributed work

**Confidence: Partially-well answered.** One strong analytical source plus vendor roadmap corroboration; no quantitative survey data on how many teams actually need this.

| Requirement for true async support | Source | Tools said to meet it | Tools said to miss it |
|---|---|---|---|
| Board open 48–72 hrs | retrospectivetools.com guide [fetched] | Parabol, TeamRetro | Kollabe (7-day history "undermines fortnightly sprint cycles" — actually cited as a *plus* for retention, but its short board-open assumptions were flagged as a caveat) |
| Anonymous brainstorming without a live host | same | Parabol ("the only retro-native tool that says 'async' on its features page and means it"), TeamRetro | Retrium ("requires facilitator-driven phase progression") |
| Auto-grouping/voting without facilitator presence | same | Parabol (AI grouping), TeamRetro (AI clustering) | Whiteboards generally (Miro/Mural/FigJam — "lack enforced phases") |
| Action items with owner + due date surviving board close | same | Parabol, TeamRetro | Not explicitly named as missing anywhere, but this is exactly the "action items tracked manually outside the tool" churn driver from §2 |

Vendor-side corroboration of async demand: TeamRetro's own Sept 2026 changelog lists an async-by-default "Standups" meeting type as "Coming Soon," i.e., in active development in response to (presumed) demand. https://help.teamretro.com/article/308-whats-new

Slack/Teams-native workflow evidence: TeamRetro added "Team Agreements Publishing: Share to Slack & Microsoft Teams" (March 2025), a Notion integration (Nov 2025), and n8n/Zapier setup guides (Aug 2026) — steady expansion of chat-native distribution. Reetro markets Slack, Teams, Jira, Confluence, ClickUp, Miro, Azure DevOps, and Trello integrations as a core enterprise pitch. https://reetro.io/reetro-integrations.html. Working against this: one search turned up an unattributed complaint that some tools "lack Slack or Teams integration on any plan," described as "a real gap if your team lives in Slack" — source/tool unclear, so treat as a directional signal that coverage is inconsistent across the category, not proof any specific vendor lacks it.

---

## 8. Ranked list — the 12 features/attributes that most influence selection

1. **Ease of use / fast time-to-first-retro** — *High confidence.* Near-universal across every vendor's reviews; the single most repeated theme in this entire research pass.
2. **No signup/login required for participants** — *High confidence* as a market pattern (5+ vendors build their whole pitch on it, matches the pain reviewers describe with guest/contractor participants); *moderate* confidence specifically as a self-reported reviewer "reason I chose this."
3. **Price perceived as fair, and flat/per-team rather than per-seat** — *Moderate-high confidence.* Directly cited in TeamRetro reviews; three vendors (TeamRetro, Retrium, Kollabe) market flat pricing explicitly against per-seat rivals, implying they believe it converts buyers.
4. **Anonymous input / psychological safety in feedback** — *Moderate-high confidence.* Recurring across TeamRetro, Retrium, and Parabol reviews independently.
5. **Board/action-item history and persistence** — *Moderate confidence.* The single sharpest churn driver found (EasyRetro's inability to save boards) and a stated differentiator when present (Kollabe 7-day, Neatro 30-day, TeamRetro historical PDF/Markdown export).
6. **Jira (and increasingly GitHub/Linear/Azure DevOps) integration depth** — *Moderate confidence.* Cited as a love when present and done well (EasyRetro's Jira bulk export, Parabol's story-point sync) and a churn driver when partial/broken (TeamRetro's "resets assignees" complaint).
7. **Template/technique variety and guided facilitation** — *Moderate confidence.* EasyRetro's "200+ templates," Retrium's technique library, TeamRetro's customizable templates all cited positively.
8. **Customer support responsiveness** — *Moderate confidence.* Specific, emotionally strong praise for EasyRetro and Kollabe; likely matters disproportionately for small teams with no IT department.
9. **Remote/distributed-team enablement generally** — *Moderate confidence, but now table stakes.* Universally claimed by every vendor; no longer differentiating on its own.
10. **AI summaries / sentiment / auto-grouping** — *Low-moderate confidence as a current selection driver, high confidence as a vendor investment thesis.* TeamRetro's 2025–2026 changelog is dominated by AI shipping, but almost no reviewer in the accessible corpus cited AI as their reason for choosing a tool — this looks like vendor-side betting ahead of proven buyer demand.
11. **Async-native workflow support** — *Low-moderate confidence, rising.* Clear unmet-need articulation (retrospectivetools.com) and vendor roadmap investment (TeamRetro's in-development Standups), but not yet reflected as a dominant theme in the review corpus itself.
12. **Enterprise security/compliance (SOC 2, SSO, GDPR, data residency)** — *Low confidence as a broad selection driver; moderate confidence as a deal-gating requirement for larger orgs specifically.* No small-team evidence found either way; entirely vendor-Enterprise-tier-marketing-driven in the sources reached.

---

## 9. Dated 2025–2026 launch list

- **2025-01** — TeamRetro: Cross-Team Usage Insights (Enterprise: retrospectives, health checks, AI usage, integrations tracking). https://help.teamretro.com/article/308-whats-new
- **2025-02** — TeamRetro: specialized templates (Development/Leadership/HR/Sales/Marketing/Operations); improved AI generation multi-language support.
- **2025-03** — TeamRetro: Team Agreements publishing to Slack & Microsoft Teams; milestone templates.
- **2025-04** — TeamRetro: modernized login/signup UI with improved accessibility.
- **2025-05** — TeamRetro: Quick Polls, @Mentions, GIFs on ideas, AI-supported insight summaries, multi-week recurrence.
- **2025-08** — TeamRetro: free Planning Poker tool (planning-poker.teamretro.com), AI Answers beta (Help Scout), Kudos feature. — EasyRetro: drawing directly on cards.
- **2025-08 (approx.)** — Metro Retro rebrands to **Ludi**.
- **2025-09** — Spreo/Ludi's original free-plan-removal announcement is one year old (originally announced 2024-09-10; included here as essential pricing-history context, not a 2025-2026 launch itself).
- **2025-10** — TeamRetro: Health Radar on team page, Meeting Kudos pane, Team Observer role (Enterprise).
- **2025-11** — TeamRetro: optional non-anonymous ideas, Enterprise IP allow-listing, Notion integration, ChatGPT-4 model upgrade for AI features.
- **2025-12** — TeamRetro: two-way Jira sync (titles + completion status), comment reactions platform-wide.
- **2026-01** — TeamRetro: Health Dimension categories, 15 new maturity models. — EasyRetro: Hide-Column feature (Changelog #43).
- **2026-02** — TeamRetro: Markdown exports, Estimation Meetings launch (Scrum/Fibonacci/T-shirt decks), Linear refresh-token support.
- **2026-03** — TeamRetro: historical report downloads (PDF/Markdown), GIF provider switch (Tenor→Klipy), TeamRetro AI blog updated with current feature set.
- **2026-04** — TeamRetro: full UI/email translation refresh, unified notification preferences, whiteboard attachments (beta).
- **2026-05** — TeamRetro: custom estimation decks, whiteboard evolution (locking, presentation mode, SVG/PNG export), team webhooks, team-level API keys.
- **2026-06** — TeamRetro: MCP server launch ("connect TeamRetro to your AI assistant"), cross-team search, image attachments, cover-image smart theming, website rebuild. — EasyRetro: Dashboard list view + bulk archive/unarchive/delete/export (Changelog #46), new survey types (Changelog #46/#47 window), timer pause/resume/extend (Changelog #44).
- **2026-07** — TeamRetro: AI image generation opened to all paid plans, JQL/WIQL query filtering for Jira/Azure estimation imports, MCP enhancements. — EasyRetro: expanded/free-tier exports (PNG/CSV now free; PDF/DOCX/XLSX enhanced) (Changelog #47). — Metro Retro/Ludi rebrands again to **Spreo**, repositioning as general whiteboard software.
- **2026-07-21** — EasyRetro: enterprise Audit Logs (10+ members, 12-month retention) — its first clearly enterprise-gated feature (Changelog #48).
- **2026-08** — TeamRetro: "trAI" AI assistant launch (paid/trial plans), nine icebreaker game types, SCIM + higher MCP API budgets, n8n/Zapier guides, Jira/Azure/GitHub comment-synced estimates.
- **2026-09** — TeamRetro: new icebreaker games (Word Association, Punchline, Creative Canvas), image-library refresh, async-by-default "Standups" meeting type announced as coming soon.

Retrium and GoRetro: **no dated 2025–2026 launches were found** — Retrium's pricing page shows no changelog at all, and one 2026 aggregator states GoRetro's public changelog "has not moved since May 2023" despite AI-forward marketing claims.

---

## 10. Surprises and contradictions

1. **Neatro's SOC 2 status is directly contradicted between two sources.** One search result stated Neatro has "SOC 2 Type 2 compliance and choice of hosting in the EU/US, plus GDPR support." A separate search result stated "Neatro's security rests on the underlying cloud [provider] rather than an independent SOC 2 or GDPR attestation, which tends to stall things once IT or procurement gets involved." I could not resolve this from a primary Neatro source (Neatro's own security/trust page was not fetched). Flag as unresolved — verify directly with Neatro before citing either claim.
2. **GoRetro's AI/velocity marketing does not match observed product evidence.** GoRetro markets itself as a top-rated (#1 on G2), AI-capable tool used by "100,000 developers," yet one 2026 aggregator reports its public changelog frozen since May 2023 and its real AI footprint limited to "Joker cards" (Jira-prompted discussion cards) and a meeting-recap export — "thinner than the marketing implies," with no verifiable AI clustering, AI action items, or sentiment analysis.
3. **Metro Retro/Spreo's pricing model looks like it reversed direction.** The Sept 2024 free-plan-removal announcement (primary source, fetched) introduced flat-banded-by-team-size pricing ($39/mo for one team ≤20 members, $76/mo for 20–200). A separate, later aggregator describes 2026 pricing as per-seat ($4–6/member/month). Both cannot be the current model simultaneously — either the aggregator is stale/wrong, or Spreo changed its pricing structure again between 2024 and 2026 without a press announcement I could find. Given the tool also rebranded twice (Ludi, then Spreo) and repositioned from "retro tool" to "online whiteboard software" in the same window, a second quiet pricing-model change is plausible but unconfirmed.
4. **TeamRetro's shipping velocity is the standout finding of the whole research pass.** Given EasyRetro and Metro Retro have higher general name recognition in "best retro tool" listicles, it's notable that TeamRetro is the vendor actually behaving like a well-funded, aggressively-iterating product team (near-monthly releases, an AI assistant, an MCP server for Claude/ChatGPT, SCIM, webhooks) — this is the competitor RetroBoard should watch most closely, not necessarily the most-mentioned name.
5. **Retrium shows no detectable 2025–2026 product investment.** No changelog, no news, no pricing change — just a static $39/$59/Enterprise pricing page. Combined with #4, this suggests real bifurcation opening up in the category between fast-moving (TeamRetro, EasyRetro, Neatro) and stalled (Retrium, arguably GoRetro) vendors.
6. **Security/compliance marketing is inversely surprising at the low end.** Reetro — positioned by a competitor's own comparison as "the budget pick" — leads its marketing with ISO 27001, SOC2-certified datacenters, and on-premises installation, i.e., enterprise-grade security messaging from what's otherwise framed as the cheap option. Either Reetro is targeting security-conscious SMBs specifically, or this is aspirational/overstated marketing not yet backed by reviewer evidence either way.
7. **"No signup for participants" is a louder vendor talking point than a reviewer-stated reason.** Multiple vendors build entire go-to-market pitches on it, but not one Capterra/G2 verbatim quote retrieved in this research used that framing unprompted — reviewers describe the underlying pain (guest/contractor friction) without naming the feature explicitly. This is a genuine gap between marketing narrative and review-text evidence, not a debunking of the value — just a caution against over-claiming direct reviewer corroboration.
8. **Reddit and TrustRadius/G2 being substantially inaccessible is itself a finding worth surfacing to whoever consumes this report:** any "voice of customer" research on this category done via automated tools alone will systematically under-sample forum-native, less-formal community sentiment (Reddit, HN) in favor of vendor-adjacent blogs and formal review-platform text that vendors actively solicit and moderate. Treat sections 1, 2, and 6 (Capterra-anchored) as materially more reliable than section 3 (blog-anchored).

---

## 11. All sources consulted, with dates

**Fetched directly (primary read):**
- EasyRetro Capterra reviews — https://www.capterra.com/p/185134/EasyRetro/reviews/ (reviews dated 2019-05-24 to 2023-05-17; page accessed 2026-09-04)
- TeamRetro Capterra reviews — https://www.capterra.com/p/193264/TeamRetro/reviews/ (reviews dated 2020-05-22 to 2026-02-20; page accessed 2026-09-04)
- Parabol Capterra reviews — https://www.capterra.com/p/182731/Parabol/reviews/ (reviews dated 2020-05 to 2021-11; page accessed 2026-09-04)
- EasyRetro changelog — https://easyretro.io/whats-new/ (entries 2025-08-28 to 2026-07-21; accessed 2026-09-04)
- TeamRetro changelog — https://help.teamretro.com/article/308-whats-new (entries 2025-01 to 2026-09; accessed 2026-09-04)
- TeamRetro AI features blog — https://www.teamretro.com/blog/ai-tools-that-make-agile-retrospectives-easier-and-smarter/ (updated through 2026-01-16; accessed 2026-09-04)
- Retrium pricing page — https://www.retrium.com/pricing (accessed 2026-09-04, no dated changes present)
- Spreo (formerly Metro Retro/Ludi) free-plan-removal announcement — https://spreo.io/blog/metro-retros-new-chapter (announced 2024-09-10; accessed 2026-09-04 via redirect from ludi.co)
- Spreo pricing FAQ — https://docs.spreo.io/help/frequently-asked-questions/pricing (accessed 2026-09-04)
- Kollabe blog, "The 6 Best Free Retro Tools in 2026" — https://kollabe.com/posts/best-free-retro-tools (dated 2026-07; accessed 2026-09-04) [vendor marketing]
- retrospectivetools.com async guide — https://www.retrospectivetools.com/guides/async-retros-that-work/ (updated 2026-07-03; accessed 2026-09-04)
- dev.to, "Kollabe vs EasyRetro" — https://dev.to/kelly-app/kollabe-vs-easyretro-two-free-retro-tools-very-different-bets-17i2 (published 2026-02-17; accessed 2026-09-04)
- Hacker News via Algolia API — https://hn.algolia.com/api/v1/search?query=retrospective%20tool (results dated 2019–2023; accessed 2026-09-04)

**Blocked / inaccessible (attempted, no content retrieved):**
- reddit.com and old.reddit.com (all endpoints, including JSON search) — refused by WebFetch, 2026-09-04
- G2 pros-and-cons pages for Parabol and Retrium — https://www.g2.com/products/parabol/reviews?qs=pros-and-cons, https://www.g2.com/products/retrium/reviews?qs=pros-and-cons — HTTP 403, 2026-09-04
- G2 Neatro reviews — https://www.g2.com/products/neatro/reviews — HTTP 403, 2026-09-04
- TrustRadius Parabol reviews — https://www.trustradius.com/products/parabol/reviews — HTTP 403, 2026-09-04
- storyflow.so best-retrospective-tools-2026 — returned empty SPA shell, no article content, 2026-09-04

**WebSearch-synthesized only (not independently fetched — secondary, lower confidence):**
- G2 EasyRetro reviews (4.3/5, 5 reviews) — https://www.g2.com/products/easyretro/reviews
- G2 TeamRetro reviews (20 reviews) — https://www.g2.com/products/teamretro/reviews
- G2 Parabol reviews (89 reviews, 4.6/5) — https://www.g2.com/products/parabol/reviews
- G2 Metro Retro/Ludi reviews — https://www.g2.com/products/ludi/reviews
- G2 GoRetro reviews (4.7/5) — https://www.g2.com/products/goretro-goretro/reviews
- G2 Neatro rating (4.9/5) — https://www.g2.com/products/neatro/reviews
- Kollabe/GetApp UK listing — https://www.getapp.co.uk/software/2072780/kollabe
- Various echometerapp.com "X alternative" pages [vendor marketing] — echometerapp.com/en/retrium-alternative/, /easyretro-alternative-comparison/, /metro-retro-alternative/
- Various teamretro.com "X alternative" comparison pages [vendor marketing] — teamretro.com/compare/parabol-alternative/, /neatro-alternative/, /reetro-alternative/, /metroretro-alternative
- Reetro enterprise/integrations pages — https://reetro.io/enterprise-retrospective.html, https://reetro.io/reetro-integrations.html
- Parabol pricing page (search-summarized) — https://www.parabol.co/pricing/
- GoRetro pricing page (search-summarized) — https://www.goretro.ai/pricing

