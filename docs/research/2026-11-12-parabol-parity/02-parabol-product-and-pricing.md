# Parabol: product and pricing (public sources), 2026-11-12

Extends the Sept 2026 profile (`docs/research/2026-09-04-competitive/01-dedicated-tools-tier1.md`, section 2). Public pages only. Roughly 40 fetch/search calls. Where a source did not say, the item is "not confirmed". Many Parabol help pages are old (2019-2023) and may lag the product; flagged where it matters.

## 1. Pricing and gating (confidence: high for the pricing page, med for dates)

Source for all rows: https://www.parabol.co/pricing/ (fetched today; page carries no date).

| Plan | Price | Billing basis |
|---|---|---|
| Starter | Free, up to 2 teams | n/a |
| Team | $8 per active user per month, USD | Monthly, card. "Active" = logged in within 30 days; inactive users not billed |
| Enterprise | Custom, flat annual | Annual contract, flexible user tiers, card or bank transfer |

Starter limits: 2 teams per company, 10 meetings/month, 30-day history, 2 custom templates, unlimited users, "90+" templates, 7 integrations, 3 AI retro summaries.

Retro-relevant gating (same page):

| Feature | Starter | Team | Enterprise |
|---|---|---|---|
| Retro, Standup, Sprint Poker, Check-in | Yes | Yes | Yes |
| AI discussion prompts, AI related discussions | Yes | Yes | Yes |
| AI retro summaries | 3 total | Unlimited | Unlimited |
| AI suggest groups | No | Yes | Yes |
| AI icebreakers | No | Yes | Yes |
| Team Health (recurring check, and inside retros), question packs, trends | No | Yes | Yes |
| Anonymous comment rewording (Team Health) | No | Yes | Yes |
| Custom templates | 2 | Unlimited | Unlimited |
| Teams / meetings per month / history | 2 / 10 / 30 days | Unlimited | Unlimited |
| Private teams | No | Yes | Yes |
| CSV export | Yes | Yes | Yes |
| Integrations | 7 | 7 | 7+ (adds Jira Data Center, self-managed GitLab) |
| SAML SSO, SCIM, Org Admin role, domain restrictions, on-prem | No | No | Yes |
| Org-wide Team Health reporting | No | No | "Coming soon" |
| Priority support, uptime SLA | No | Yes | Yes |

Changes versus September profile:
- Unchanged: $8/active user, 2 teams, 10 meetings, 30 days, 2 custom templates, SAML/SCIM/on-prem Enterprise-only.
- New or sharpened: AI suggest groups and AI icebreakers are Team-only (Sept profile showed AI grouping/icebreakers as plain "Y"); AI retro summaries capped at 3 on Starter; Team Health is a paid feature; template count now "90+" (Sept: 50+); free tier now named "Starter"; Linear appears in the integrations list.
- Conflict: the AI summaries FAQ lists only Team and Enterprise (https://www.parabol.co/support/ai-summaries-faq/); the pricing page gives Starter 3. The pricing page is more likely current.

## 2. Facilitator walkthrough (confidence: med; no single current doc lists the full order)

Order as documented: [Review Tasks, optional] > Icebreaker (optional) > Team Health (optional) > Reflect > Group > Vote > Discuss > Summary.
- Review Tasks is not in any docs page; it comes from Friday Ship posts (Q3). Its position "first item" matches the post saying it precedes Reflect (https://www.parabol.co/friday-ship/491-shaping-features-in-2026/).
- Icebreaker: lobby checkbox "Include Icebreaker"; facilitator can write their own with the pencil button (https://www.parabol.co/support/how-to-write-your-own-icebreaker/). Random icebreaker otherwise (https://www.parabol.co/resources/comprehensive-retrospective-guide).
- Team Health: optional, after icebreaker, "enabled by default" but can be turned off at meeting creation (https://www.parabol.co/support/how-to-use-team-health/). That page is from the 2023 emoji-mood version; the Sept 2026 release is a five-category, question-pack version (Q4).
- Reflect: facilitator sets timer (5-10 min typical), can open board early, uses the ready button to see who finished; participants add anonymous cards (comprehensive guide above).
- Group: facilitator picks how cards are read (facilitator reads, members read own, silent); participants drag cards into themes. Phase can be reopened after advancing via "Edit Groups" (https://www.parabol.co/support/reset-group-phase/). Votes behavior on reset not confirmed.
- Vote: thumbs-up per topic; see Q6.
- Discuss: topics ordered by votes; threaded discussion; tasks created (Q7).
- Summary: auto-generated, emailed (Q9).
- Other facilitator controls: random facilitator (https://www.parabol.co/support/how-to-assign-a-random-facilitator/), highlight a column (https://www.parabol.co/support/how-to-highlight-a-column/), timer (https://www.parabol.co/support/how-to-set-a-meeting-timer/). Contents not fetched.

## 3. The screenshot UI labels (confidence: med for Review Tasks/Inspirations, low for the rest)

| Label | What the public record says |
|---|---|
| Review Tasks | Shipped as the "retrospective review tasks phase" in the July 2026 What's New (https://www.parabol.co/friday-ship/502-cycle-15-kickoff/). Built after a customer asked for a quick view of what the team accomplished between sprints before Reflect (https://www.parabol.co/friday-ship/491-shaping-features-in-2026/, 2026-05-15). Enabled by default for new teams (https://www.parabol.co/friday-ship/503-refactoring/, 2026-08-07). Parabol's data: of 525,728 retros with 3+ participants, 63.4% of groups got a completed discussion but only 13.7% of those produced a task. No step-by-step doc found. |
| Inspiration | "Inspirations panel": sidebar that surfaces data from integrations to suggest content. Started in Standups; AI summary of recent work added 2026-07-03 (https://www.parabol.co/friday-ship/498-ai-powered-inspirations/). July What's New says it is in retros, letting you draft reflections from integration data (502 above). Azure DevOps is now an Inspirations source in Stand-Ups and retros (https://www.parabol.co/friday-ship/513-azure-devops-rebuilt/, 2026-10-16). Plan requirement not stated. |
| Options | Not confirmed. |
| Music | Not confirmed. No Parabol doc, post or help page found. Only a user feature request on GitHub suggesting background music during writing (https://www.github.com/ParabolInc/parabol/discussions/5726). Treat as undocumented. |
| Tips | Not confirmed. |
| Tap when ready | Not found by that name. The guide mentions a "ready button" to see who has finished reflecting (comprehensive guide above); an earlier Friday Ship ("ready to move on", https://www.parabol.co/friday-ship/ready-to-move-on/) was surfaced but not read. |
| "Hit / for commands" | Not confirmed. No slash-command doc or post found. |
| "X is requesting to join <team>" Accept/Deny | Not confirmed. Closest: April 2025 post on domain verification, discovering public teams, and auto-joining default teams set by admins; no mention of approve/deny (https://www.parabol.co/friday-ship/437-better-onboarding-ux/). Roles page does not say who approves (https://www.parabol.co/support/roles-on-parabol/). |

## 4. Anonymity (confidence: med)

- Marketing claim: anonymity "at every stage: reflections, voting, reactions and comments"; voting anonymous (https://www.parabol.co/agile/retrospectives).
- Reflections hidden from others during Reflect, author never revealed (https://www.parabol.co/resources/comprehensive-retrospective-guide); "some teams choose not to be anonymous" (same page). The switch-off mechanism was not documented in anything fetched.
- Team Health: individual answers never shown, results hidden below a minimum respondent count, AI rewords comments (https://www.parabol.co/friday-ship/510-team-health-activity-released/).
- No-account join: not confirmed. Help page describes joining only from inside Parabol for a team you belong to, signed in (https://www.parabol.co/support/how-to-join-a-parabol-meeting/). Invite links expire after 24h, email invites after one week (https://www.parabol.co/support/how-to-invite-someone-to-a-parabol-team/). Parabol has a no-account demo with simulated teammates (https://www.parabol.co/?p=1989), which is not a live session. Pricing lists Google/Microsoft sign-on, implying accounts are required. Best reading: an account is required.

## 5. Grouping and AI (confidence: med)

| Capability | Status | Plan | Source |
|---|---|---|---|
| Manual drag grouping | GA | All | guide above |
| AI suggest groups / group names | GA | Team+ ("AI suggest groups"); homepage says AI names groups | pricing |
| Grouping hints (hover shows similar cards in purple outline) | Shipped 2026-06-19 | not stated | https://www.parabol.co/friday-ship/496-hints-while-grouping-in-a-retrospective/ |
| Improved AI-assisted grouping | announced for week after 2026-07-31 | not stated | 502 above |
| AI discussion prompts / related discussions | GA | All | pricing |
| AI retro summaries (per topic and whole meeting) | GA | 3 free, unlimited paid | pricing; FAQ |
| AI icebreakers | GA | Team+ | pricing |
| AI Inspirations summary | Standups live, retros per July post | not stated | 498, 502 |
| AI insights across meetings | "Pages & Insights" launched 2025 (Friday Ship #461) for leaders; plan unknown | not confirmed | https://www.parabol.co/friday-ship/472-closing-out-2025/ |
| AI-generated templates | not confirmed | n/a | n/a |

Beta labels were not found on any of these. AI provider is OpenAI; Parabol says it does not train on customer data; Enterprise Org Admins can turn AI off (https://www.parabol.co/security-faq/, https://www.parabol.co/support/roles-on-parabol/).

## 6. Voting (confidence: med)

- Facilitator sets votes per person (pricing/marketing: "customizable number of votes per person"; https://www.parabol.co/agile/retrospectives). Guide default: 5 total, up to 3 per topic (found via search of Parabol guides; one guide gives only "usually five").
- Thumbs-up per item; tallies create a prioritized agenda. Optional timebox.
- Change/retract vote and anonymity toggle: not confirmed.

## 7. Discussion and tasks (confidence: med)

- Real-time discussion threads per topic (https://www.parabol.co/agile/retrospectives). Tasks created in-meeting, tracked on team dashboard or handled in next Check-In (https://www.parabol.co/resources/retrospective-meetings/).
- Export: Jira, GitHub, GitLab, Linear, Azure DevOps (integrations page). In Jira, you choose the target project per task; later retro/check-in meetings show which tasks are Jira-managed with progress (https://www.parabol.co/integrations/jira/). Two-way sync (story points) is for Sprint Poker only.
- Reappearance of open tasks: now via Review Tasks (Q3). Mechanics (which tasks, filters, who sees) not confirmed. Task board: Kanban; reviewers call it thin (Q15).
- Assigning owners and due dates: not confirmed on public pages read.

## 8. Async (confidence: med)

- Facilitator sets a phase end date/time (Reflect, Group, Vote, Discuss), optionally notifies Slack; link can be pinned. Expiry is a "soft ending": facilitator is notified and decides to extend or advance (https://www.parabol.co/blog/async-retrospective-meetings-ready-set-timer/).
- Timer panel is described as a "deadline"; members are notified in-app, plus Slack or Mattermost (https://www.parabol.co/support/how-to-start-an-asynchronous-retrospective/).
- Per-participant reminders and time-zone handling: not confirmed. Facilitator must still advance phases manually.

## 9. After the meeting (confidence: med)

- Summary: Timeline > "review & summary"; emailed to all team members ("Parabol Summary") (https://www.parabol.co/support/how-to-find-your-meeting-summary/). AI summaries appear per topic, in the summary, and in chat integrations (FAQ).
- Export: CSV (pricing, all plans). PDF not confirmed.
- Sharing: Slack, Microsoft Teams, Mattermost post reminders and summaries (integrations page).
- History: 30 days free, unlimited paid. Team analytics beyond Team Health trends: not confirmed. Parabol API (GraphQL, GA 2026-05-08, free and paid, higher limits paid): https://www.parabol.co/friday-ship/introducing-the-parabol-api/.

## 10. Templates (confidence: med)

- Counts disagree by page: "90+" (pricing), "100+" (retro page), "40+ retrospective" (template page copy). Templates index showed 22 retro + 6 estimation before "Load More" (https://www.parabol.co/templates/). Use "90+ across meeting types."
- Examples: Start Stop Continue, Glad Sad Mad, 4Ls, Sailboat, Starfish, DAKI, Lean Coffee, Three Little Pigs, Mountain Climber (comprehensive guide).
- Custom: edit, add prompts, save, share (https://www.parabol.co/agile/retrospectives); limit 2 on Starter. Scopes (team/org/public) not confirmed. Org Admins can delete custom templates. "Activity library": not confirmed as a distinct feature.

## 11. Integrations (https://www.parabol.co/integrations/, confidence: high on list, low on plan)

| Integration | Role in a retro | Plan |
|---|---|---|
| Jira | Send tasks to a project; see status in later meetings | Not stated |
| GitHub, GitLab, Linear | Same | Not stated |
| Azure DevOps | Same; rebuilt Oct 2026 with per-project access; feeds Inspirations | Not stated |
| Jira Data Center / Jira Server, self-managed GitLab | Self-hosted variants | Enterprise |
| Slack, MS Teams, Mattermost | Reminders, phase/timebox notices, summaries | Not stated |
| Google Calendar | Schedules meetings, invites participants | Not stated |
| Zoom | Listed; function not described | Not stated |

Pricing page says Starter and Team get 7 integrations.

## 12. Team and admin (confidence: med)

- Roles: Member, Team Lead (one per team), Billing Leader, Org Admin (Enterprise only) (roles page).
- Invites: link (24h) or email (1 week). Domain verification, public team discovery, admin default teams announced April 2025 (437). Request-to-join approval not confirmed.
- Recurring meetings: redesigned 2026-05-29; editable from meetings dashboard; calendar links with descriptive slugs (https://www.parabol.co/friday-ship/493-rethinking-recurrence/).
- Video/transcription: July What's New lists "meeting transcription" (502); the Feb 2026 post says Parabol will integrate with Zoom/Google Meet rather than build its own (https://www.parabol.co/friday-ship/480-turning-transcripts-into-action/); May 2026 shows a Google Meet proof of concept. No embedded video found. Status of transcription is unclear.

## 13. Non-functional (confidence: med)

- Dark mode: shipped by 2026-07 (https://www.parabol.co/friday-ship/500-500-weeks-of-friday-ship/, 503, 502).
- Security: SOC 2 Type II claimed on every plan (pricing) and in FAQ; blog says audit kicked off in 2025 (https://www.parabol.co/friday-ship/464-soc-2-audit/). Report availability on request. GDPR claimed; SaaS data in Google Cloud Iowa, "option for EU or client-side hosting" (security FAQ). Open source; on-prem or single-tenant regional is Enterprise. SCIM first implementation in 2026 cycle; Enterprise.
- Languages, mobile apps, accessibility statement: not confirmed.

## 14. 2025-2026 changes affecting retros

| Date | Item | URL |
|---|---|---|
| 2025-04-04 | Domain verification, public teams, default teams | https://www.parabol.co/friday-ship/437-better-onboarding-ux/ |
| 2025-12-19 | Pages and Insights, SOC 2 audit, self-hosting depth | https://www.parabol.co/friday-ship/472-closing-out-2025/ |
| 2026-02-27 | Transcript direction; API-first for agents | https://www.parabol.co/friday-ship/480-turning-transcripts-into-action/ |
| 2026-05-08 | Public GraphQL API GA | https://www.parabol.co/friday-ship/introducing-the-parabol-api/ |
| 2026-05-15 | Task Review in progress | https://www.parabol.co/friday-ship/491-shaping-features-in-2026/ |
| 2026-05-29 | Recurring meetings rework | https://www.parabol.co/friday-ship/493-rethinking-recurrence/ |
| 2026-06-19 | Grouping hints | https://www.parabol.co/friday-ship/496-hints-while-grouping-in-a-retrospective/ |
| 2026-07-03 | AI Inspirations (retros later) | https://www.parabol.co/friday-ship/498-ai-powered-inspirations/ |
| 2026-07-31 | July What's New: dark mode, Inspirations in retros, review tasks phase, transcription | https://www.parabol.co/friday-ship/502-cycle-15-kickoff/ |
| 2026-08-07 | Task Review default on for new teams | https://www.parabol.co/friday-ship/503-refactoring/ |
| 2026-09-25 | Team Health released (5 categories, packs) | https://www.parabol.co/friday-ship/510-team-health-activity-released/ |
| 2026-10-16 | Azure DevOps rebuild | https://www.parabol.co/friday-ship/513-azure-devops-rebuilt/ |

## 15. Known complaints (confidence: low; small, partly old samples)

Via search snippets of Capterra/G2/SaaSworthy (https://www.capterra.com/p/182731/Parabol/reviews/, https://www.g2.com/products/Parabol/reviews, https://www.saasworthy.com/product/parabol-co/reviews); G2 4.6/5 on 89 reviews.
1. Task board and task management thin.
2. Action items hard to move to or back from Jira (older review; integrations have since expanded).
3. Email recap hard to follow; comments not tied to cards (2023).
4. Template bugs, code-snippet editor not developer-friendly.
5. Wants more templates for other ceremonies.
Review pages themselves were not readable.

## Not confirmed
- What "Music", "Tips", "Options", "Tap when ready" and "Hit / for commands" are in Parabol docs.
- Request-to-join approve/deny flow and who approves.
- Whether a participant can join a live retro with no account (evidence points to no).
- How to turn off anonymity; whether retro votes are anonymous by default and retractable.
- Review Tasks mechanics (which tasks, filters, carry-over rules).
- Task owner assignment and due dates.
- Per-participant async reminders; time-zone handling.
- PDF export; team analytics beyond Team Health; AI-generated templates; beta labels.
- Languages, mobile app, accessibility statement; transcription ship status.
- Plan gating for Inspirations, Pages/Insights, API beyond rate limits.
