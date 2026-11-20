# Parabol retro parity: evaluation and build plan

Written 2026-11-12. Status: draft for Jordan's review, after one builder-check pass. Nothing here is approved yet, and every scoping choice below is Claude's call unless it says otherwise.

Evidence sits in `docs/research/2026-11-12-parabol-parity/`: `01-parabol-source-inventory.md` (Parabol v15.27.2, read from its public repo) and `02-parabol-product-and-pricing.md` (public site, help center, pricing). RetroBoard's side comes from a code-verified inventory of branch `fix/dashboard-create-modal-inline` taken the same day, with the security findings re-read by hand.

Scope is Parabol's retrospective only. Sprint Poker, Standups, Check-ins and the standalone Team Health meeting are out, as September's gap analysis already decided. Parabol's code is AGPL, so this plan copies behaviour and nothing else: no code, no copy text, no illustrations, no music.

## Where this lands

Parabol's retro is a facilitated meeting with a fixed spine: Reflect, Group, Vote, Discuss, then a summary. RetroBoard is an open board with switches. About two thirds of what Parabol does maps onto September's ten capabilities, so this plan is mostly that roadmap with sharper detail.

Two things are new. First, the server enforces almost nothing today, which means anonymous reflection cannot be added until that is fixed (details under "What stands in the way"). September estimated guided facilitation at 3 days without knowing this. Second, Parabol's Discuss phase has comment threads per topic, and RetroBoard has no comments at all.

The recommendation is to add a guided mode beside the open board, keep account-free participation, and build in the order given under "Build sequence". Steps 0 through 5 give a retro that feels like the one in the screenshot in about 25 dev days. Steps 6 through 10 add another 23 or so.

## How a Parabol retro runs today

A team member starts a retro from a lobby: pick a template (the default asks "What's working?" and "Where did you get stuck?"), toggle the optional phases, choose whether reflections are anonymous. Everyone in the meeting has an account and belongs to the team. Someone outside the team can ask to join, and existing members see an Accept or Deny banner.

The optional openers come first: an Icebreaker question, a Team Health pulse (paid plans only), and Review Tasks, which walks the team's open tasks from earlier meetings. Review Tasks shipped in May 2026 and became default-on in August.

In Reflect, each person writes cards per prompt. Nobody else can read a card until the phase ends, and authors are never shown unless anonymity was switched off. People tap "ready" and the facilitator sees a count, then a Next button once everyone is ready. An Inspiration drawer lists recent work from connected trackers and can draft reflections with an LLM. Background music can play for everyone.

In Group, anyone drags cards onto each other. Suggested groups appear automatically on entry, from embeddings or an LLM, with AI-written titles. In Vote, each person gets 5 votes with at most 3 on one group; both numbers can be changed. Discuss turns each group into an agenda item ordered by votes, with a comment thread, an AI-written discussion question, and tasks that can be pushed to Jira, GitHub, GitLab, Linear, Azure DevOps or ClickUp.

Ending the meeting produces a summary page with an AI summary, topics, tasks and participants, emails it to the team, and posts to Slack, Teams or Mattermost.

## Capability comparison

"Call" is what this plan does with the capability: Have (RetroBoard already does it), Build, Adapt (build it differently on purpose), Later, or Skip. "Step" points at the build sequence.

### Setup and joining

| Capability | Parabol | RetroBoard today | Call | Step |
|---|---|---|---|---|
| Template library | About 100 retro-type templates including pre- and post-mortems, categories, favourites, search | 5 templates in code, locked by a DB CHECK | Build 30 curated, grow later | 7 |
| Custom templates | Prompts with description and colour, shared at team, org or public scope; 2 on the free plan | Columns editable per board, nothing saved | Build save-as-template at personal scope; team scope arrives with Step 6 | 7 |
| Change template mid-meeting | Allowed until the first card exists | Columns can be edited at any time | Adapt: add a "change template" action while the board is empty | 7 |
| Anonymous reflections switch | On by default, set in the lobby | `anonymous_cards` setting exists but nothing reads it | Build, enforced on the server | 0, 1 |
| Optional phases | Icebreaker, Team Health, Review Tasks toggles | None | Build | 1, 6, 9 |
| Joining | Account plus team membership required; invite by email or link | Link or 5-digit code, no account | Have, and ahead | |
| Request to join | Members get Accept or Deny | No approval of any kind | Adapt: optional approval per board | 10 |
| Invite-only boards | Private teams on paid plans | `visibility` column and `board_invites` table exist, neither is enforced | Build | 10 |
| Sign-in methods | Password, Google, Microsoft, SAML, SCIM | Password only | Build Google and Microsoft; skip SAML and SCIM | 10 |
| Recurring meetings, calendar | Series with auto-created next meeting, Google Calendar | None | Later, after teams exist | |

### Reflect

| Capability | Parabol | RetroBoard today | Call | Step |
|---|---|---|---|---|
| Hidden while writing | Others' text is not sent until the phase ends | Blur in the browser only; the API returns every card's text | Build | 0 |
| Author anonymity | Server withholds the author | Author name stored, returned and shown | Build | 0 |
| Edit and delete | Author only, locked after Group | Any caller can edit or delete any card | Build | 0 |
| Ready signal | "Tap when ready", count for the facilitator, Next when all are ready | None | Build | 1 |
| Phase timer | Countdown per stage, or a deadline for async work, with a Slack ping | Presets, broadcast only, not stored | Adapt: store it, add a deadline | 1 |
| Tips | Help menu per phase | None | Build | 1 |
| Emoji reactions | Up to 12 distinct emoji per card | Yes | Have | |
| Rich text | Bold, lists, quotes, code, links, images, mentions, slash menu | Plain text, 2,000 characters | Build light formatting; skip images, mentions and the slash menu | 11 |
| Column focus | Facilitator highlights one column for everyone | Card highlight only | Build | 11 |
| Inspiration drawer | Recent work from trackers as cards, AI drafts | None | Later, needs a tracker integration first | |
| Music | Synced background tracks | Timer chime only | Build small, with tracks we have rights to | 11 |

### Group and vote

| Capability | Parabol | RetroBoard today | Call | Step |
|---|---|---|---|---|
| Drag to group, ungroup | Yes | Yes, through `merged_with` | Have | |
| Group titles | Editable, AI-suggested | None | Build | 2 |
| Suggested groups | Automatic on entering Group; embeddings or LLM. LLM mode is paid, 3 AI meetings free | None | Build with an LLM, facilitator accepts or rejects | 5 |
| Reset grouping | Facilitator can reopen Group | Not applicable without phases | Build | 2 |
| Live drag ghosts | Others' drags render in real time | None | Later, message volume needs checking first | 11 |
| Similar-card search | "Spotlight" modal, embedding based | None | Adapt: plain text search | 11 |
| Votes per person | Default 5, max 12 | Default 5, enforced on the server | Have | |
| Votes per topic | Default 3, several votes on one group | One vote per card, by a UNIQUE constraint | Build | 2 |
| Change limits mid-vote | Allowed, cannot go below what is already spent | Limit editable, no guard | Build | 2 |
| Secret voting | Votes hidden until the phase ends (voter identity display not confirmed) | Toggle exists but every vote is returned to every client | Build | 0 |
| Votes remaining | Per person and team-wide | Per person | Build the team-wide count | 2 |

### Discuss and actions

| Capability | Parabol | RetroBoard today | Call | Step |
|---|---|---|---|---|
| Ranked agenda | One stage per group by votes, facilitator can reorder | Per-column sort by votes | Build | 3 |
| Current-topic sync | Everyone follows the facilitator | `highlighted_card_id` exists | Adapt | 3 |
| Comment threads | Replies, anonymous option, reactions, mentions | None | Build without mentions | 3 |
| AI discussion question | One per multi-card topic | None | Build | 5 |
| Action items | Created inside a topic, with owner, due date and status | Board-level list, free-text assignee, due date, status | Adapt: link to topic, real assignee | 3 |
| Push to trackers | Jira, GitHub, GitLab, Linear, Azure DevOps, ClickUp | None | Build Jira first, others on demand | 8 |
| Related past discussions | Embedding match against history | None | Skip for now | |
| Polls, transcripts | Polls in threads; Zoom and Meet transcripts | None | Skip | |

### After the retro and across retros

| Capability | Parabol | RetroBoard today | Call | Step |
|---|---|---|---|---|
| Summary page | A document page with AI insights, topics, tasks, participants | None | Adapt: a summary view per board, not a document product | 4 |
| Summary email | To every team member, opt-out | Resend is wired for password reset only | Build | 4 |
| Export | PDF from pages, CSV | Markdown and CSV | Build PDF by print stylesheet | 4 |
| AI summary | Summary plus sentiment; 3 free on Starter | None | Build | 5 |
| Chat notifications | Slack, Teams, Mattermost | None | Build Slack and Teams by webhook | 8 |
| Task board | Kanban across meetings | Count per board on the dashboard | Build an action tracker | 6 |
| Review Tasks | Open tasks reviewed at the next retro | None | Build | 6 |
| Teams | Org, team, lead, roles | Per-board members only | Adapt: lightweight team spaces, no org layer | 6 |
| Facilitator rotation | Rotation panel, random pick, auto-assign | Facilitators can be added per board | Later, small once teams exist | 6 |
| Team Health | Five categories, question packs, trends; paid | None | Adapt: 1-to-5 mood pulse with a trend | 9 |
| Icebreaker | Question round, custom or AI-written | None | Build with our own question bank | 9 |
| Reports, public API, Confluence | AI Q&A over history, GraphQL API, export | None | Skip | |

### Where RetroBoard is ahead and should stay different

Participants never create an account, and September's research ranked that among the top reasons buyers pick a tool. Parabol appears to require an account and team membership for every participant (strong evidence in both passes, not absolutely confirmed). RetroBoard should keep the link-and-code join and make approval optional.

RetroBoard also has four board views, card colours, per-column sorting, a mobile layout built for phones, and a flat $4.99 price against Parabol's $8 per active user. Parabol gates Team Health, AI grouping and AI icebreakers behind its paid plan.

## What stands in the way

These were read directly from the routes on 2026-11-12.

- `app/api/boards/[boardId]/route.ts` returns `SELECT *` for cards and votes to every caller. Hidden cards and secret votes are hidden by CSS.
- `app/api/boards/[boardId]/cards/route.ts` takes `authorId` and `authorName` from the request body and has no check on PATCH or DELETE. Anyone who can reach the board can rewrite or delete any card.
- `app/api/boards/[boardId]/participants/route.ts` lets any caller set `is_admin` on any participant or remove them.
- `app/api/boards/[boardId]/join/route.ts` accepts an admin hint from the client, so a visitor can join as a facilitator by asking to.
- The vote route trusts `voterId` from the body.
- Every card event on Ably carries the full card, text and author included. The realtime token is already scoped to one board, but its client id comes from the query string.
- `board_locked`, `voting_enabled` and `card_creation_disabled` are not consulted by any write route.

None of this is new, since participants were designed to have no authentication. It becomes a blocker the moment the product promises anonymity or phases that lock.

## Design decisions (all Claude's calls)

**Guided mode sits beside the open board.** A board has `mode` of `open` or `guided`, chosen at creation. Existing boards stay open and look the same. In guided mode the phase decides what is allowed, and the manual switches disappear from the toolbar.

**One definition of phases.** `lib/constants/phases.ts` holds the phase ids, their order, which are optional, and a permission profile for each (can write cards, can see others' text, can group, can vote, can see totals, can comment). API guards and UI both import it. A contract test asserts that every phase value round-trips through the API guard, the store and the phase rail.

**Participants get a signed session.** Joining a board returns an HMAC-signed token for (board, participant), kept in an httpOnly cookie scoped to that board. Write routes take the actor from the token and never from the body. No signup is added.

**One authority for facilitation.** A signed-in user facilitates if `resolveBoardAuthority` says so (owner, member with the owner or facilitator role, system admin), on any device. A participant without an account facilitates only if the server set `is_admin` on their row, which happens for the creator when the board is made or when a facilitator promotes them. The client-supplied admin hint on the join route goes away.

**State guards apply to every board, identity guards to new ones.** Lock, voting on or off, card creation off and completed are checked on every board from the day Step 0 ships, since they need no identity. Rules that depend on who is asking (author-only edits, facilitator-only actions, hidden text, anonymity, secret votes) apply to boards created after the cutover. Older boards keep today's trust model and cannot switch on guided mode or anonymity. There is no claim flow for old participant ids, because every client already knows every id.

**Enforcement covers open boards too.** On a new open board, "hide cards" and "secret voting" become real, and only the author or a facilitator can change a card's text or colour or delete it. That matches what the UI already offers, since edit controls show for the author only. Moving, grouping and reacting stay open to every participant, subject to lock and phase.

**People without accounts stay inside the board.** Participants never sign up, which Jordan confirmed alongside the price on 2026-09-04. Everything within one board works for them, including comments and being assigned an action by display name. Anything that spans boards or needs an address is for signed-in people: the summary email goes to signed-in members plus any addresses the facilitator adds, the action tracker and team pages are for team members, and reminders go to members and to the team's chat channel. Mood results are stored per board as aggregates, so trends need no identity.

**One function shapes what each viewer may see.** `lib/board-view.ts` takes the board state and the viewer and returns the payload: card text withheld from non-authors while hidden, author fields replaced by `is_mine` when anonymous, only the viewer's own votes while voting is secret. The same function shapes Ably payloads. When a phase reveals content, the server publishes `phase-changed` and clients refetch.

**Groups keep the existing shape.** A group stays a lead card with children pointing at it through `merged_with`. The lead card gains `group_title`, and comments attach to the lead card. A group's score is the sum of votes on the lead card and its children, so no existing vote is re-homed and regrouping after a vote stays correct. In guided mode grouping is locked before voting starts, so new votes land on lead cards. No new groups table.

**Votes keep the UNIQUE constraint and gain a count.** `votes.count` (1 to 12) replaces toggling, with a new `max_votes_per_card` setting. It defaults to 1 on open boards so nothing changes there, and 3 in guided mode.

**Readiness lives in Ably presence data.** No table, reset on each phase change.

**The summary is a board view.** Parabol built a document editor to hold its summaries. RetroBoard needs one read-only page per completed board, a print stylesheet for PDF, and an email.

**AI runs on Claude Haiku through one module.** `lib/ai.ts` with lazy init like `lib/db.ts`, structured outputs, an `ai_runs` table for caching by input hash and for per-board caps, names stripped from prompts when the board is anonymous.

**Carry-over needs a team.** A team space is a name, members, and a set of boards. Review Tasks lists open actions from the team's earlier boards. No organisation layer above it.

**Done means completed.** The existing complete action sets `archived_at` and, on a guided board, sets the phase to done. Reopening returns to Discuss. On guided boards the phase is the authority, and the old lock, voting and visibility switches are derived from it.

**Entitlements go through one helper.** Anything that may end up Pro-only calls a single `canUse(feature, user)` function. Until the billing branch merges it answers from feature flags, so steps can ship dark and be gated later without touching call sites.

## Build sequence

Days are dev days in the same unit September used.

| Step | Delivers | Days | Needs |
|---|---|---|---|
| 0 | Trust foundation | 5 | A test environment (below) |
| 1 | Guided mode core | 6 | 0 |
| 2 | Group and vote parity | 3 | 1 |
| 3 | Discuss | 4 | 1, 2 |
| 4 | Wrap-up | 3 | 1, 3 |
| 5 | AI | 4 | 2, 3, 4 |
| 6 | Continuity | 7 | 0, 1, 3 |
| 7 | Templates | 3 | Nothing; team scope waits for 6 |
| 8 | Integrations | 4, plus about 1 per extra tracker | 3, 4, 6 |
| 9 | Warm-ups | 3 | 0, 1; trends need 6 |
| 10 | Access | 3.5 | 0 |
| 11 | Polish, picked on demand | up to 8.5 | 1 |

### Step 0: trust foundation

A test environment comes first. Local development and the test suite currently point at the production database. Step 0 needs a Neon branch and a separate Ably app key so the new migrations and the two-browser test never touch live boards.

Participant session tokens. The creator's admin right is granted by the server at board creation, and the join route stops accepting an admin hint. Actor derived from the token on cards, votes, columns, action items and participants. Rules: a card is edited or deleted by its author or a facilitator; columns, participant removal and the admin flag are facilitator-only. Write routes honour `board_locked`, `voting_enabled`, `card_creation_disabled` and `archived_at`. `lib/board-view.ts` applied to the board GET and to every Ably publish. The Ably token's client id is bound to the participant.

This step also adds Playwright with a two-browser test: browser B must not find browser A's hidden card text or author in any network response or realtime message. The repo has no end-to-end tests today, and guided mode is multi-user by nature.

Migrations start at 011. Number 010 belongs to the billing branch and is already applied to the shared production database.

### Step 1: guided mode core

Migration adds `boards.mode`, `boards.phase` and `boards.phase_config` (enabled optional phases, timer, deadline, current topic). `POST /api/boards/[boardId]/phase` moves forward, back or to a named phase, facilitator only, publishing `phase-changed`. Reflect, Group, Vote, Discuss and Done are wired to their permission profiles.

UI: a phase rail on desktop and a stepper in the existing mobile bottom nav, a ready button with the facilitator's count, a per-phase tips popover, and a Guided or Open choice in the create-board modal. The timer moves from broadcast-only to stored state, and gains a deadline form ("Reflect closes Thursday 5pm") with a soft ending that the facilitator resolves.

`stores/boardStore.ts` is 898 lines and `BoardPage.tsx` is 674. Phase state goes into its own store slice and its own components instead of growing those two files.

### Step 2: group and vote parity

`cards.group_title` with inline editing on the lead card. A facilitator action to reset grouping. `votes.count`, `max_votes_per_card`, an add and remove vote API, a guard that refuses limits below what anyone has spent, and a team-wide remaining count.

### Step 3: discuss

A ranked agenda across all columns built from lead cards by vote total, with the current topic stored in `phase_config` and followed by everyone. New `comments` table (board, card, parent, author participant, anonymous flag, body, timestamps) with create, edit and delete routes and matching events. Action items gain `card_id` and `assignee_participant_id`, and can be created from inside a topic.

### Step 4: wrap-up

`/board/[boardId]/summary`: headline numbers, topics in vote order with their cards and comments, action items, participant count. A print stylesheet gives PDF without a server dependency. Completing a board emails the summary through Resend to signed-in members, with an opt-out.

### Step 5: AI

In order: the meeting summary on completion, suggested groups with titles on entering Group, one discussion question per multi-card topic, suggested action items in Discuss. Each suggestion is something the facilitator accepts or dismisses. A feature flag, a per-board cap, and an update to `/privacy` naming the AI provider.

### Step 6: continuity

`teams`, `team_members`, `boards.team_id`. A team page with its boards, members and open actions. An action tracker on the dashboard across all of a user's boards. The Review Tasks phase: open actions from the team's earlier boards, status editable in place, actions created since the last retro marked as new.

### Step 7: templates

Drop the CHECK on `boards.template`. Thirty curated templates with categories in `lib/constants/templates.ts`, written in our own words. A `custom_templates` table, save-as-template from any board, a search box in the create modal, and "change template" while a board has no cards. This step depends on nothing and can run alongside Step 1.

### Step 8: integrations

Slack and Teams incoming webhooks per team for "retro started" and "summary posted" (1 day). The deadline-reached ping needs a scheduler and moves to Step 11. Then an `integrations` table, an `action_exports` table and one exporter interface, with Jira Cloud as the first implementation (3 days). Linear, GitHub and Azure DevOps follow through the same interface when someone asks.

### Step 9: warm-ups

An Icebreaker phase with about 60 original questions, shuffle and edit for the facilitator, and a speaking order. A mood pulse: one 1-to-5 answer per person, anonymous, shown only once three people have answered, with a trend line on the team page.

### Step 10: access

Google and Microsoft sign-in through Better Auth. A per-board "approve joiners" setting: pending participants get no board data and no realtime token until a facilitator accepts. Enforcement of `invite_only` and email invites through the existing `board_invites` table.

### Step 11: polish

Light formatting in cards (2 days), synced music (1), column focus (0.5), text search for similar cards (1), deadline reminders and the deadline-reached chat ping by Vercel Cron and Resend (2), live drag ghosts (2).

## Not building

Parabol's Pages document editor, Reports Q&A, related-discussion matching, polls, Zoom and Meet transcripts, Confluence export, the public API, SAML and SCIM, the org layer, Mattermost, ClickUp and GitLab. Each is either an enterprise gate that September deferred or a separate product. The Inspiration drawer waits until at least one tracker is connected, at which point "pull my open Jira issues in as cards" is a small addition.

## Risks

- Step 0 changes every write route. The billing branch is 32 commits behind `develop` and touches board creation and joining. Rebase billing first, or the two will collide.
- All migrations run against the shared production database. Each step's migration must be additive and safe for the code already deployed.
- Ably bills on message volume. Presence updates, comments and typing indicators add traffic, and live drag ghosts would add far more. Check the current plan's limits before Step 11.
- AI cost at Haiku rates should be cents per retro, but the cap in `ai_runs` has to exist before the feature flag goes on.
- Anonymity is a promise. Author ids stay in the database so authors can edit their own cards, and the privacy page should say so plainly.
- Music needs tracks with clear rights, and browsers block autoplay until the user clicks.
- If any step needs three fix commits in a day, stop and revisit its design.

## Decisions (Jordan, 2026-11-16)

1. Audience: the general market. The build order above stands.
2. Free tier: one free retro with unlimited participants, then $4.99 per month. Claude reads this as one retro per account for life, not one active board at a time; the billing branch's `FREE_ACTIVE_BOARD_LIMIT` changes to a lifetime counter.
3. AI: Claude Haiku, with a spend ceiling of $5.00 per month across the whole app. `lib/ai.ts` must refuse new runs once the month's recorded cost in `ai_runs` reaches the ceiling.
4. Environments: a second Ably app and a Neon `dev` branch (`br-odd-block-amphtgnp`, created 2026-11-16) for development, tests and Vercel previews.
5. Integrations (changes Step 8): no bespoke Jira exporter. A board owner connects their own tracker (Jira, Azure DevOps and so on) through that provider's MCP server, and only providers that offer one are supported. Step 8 becomes "connect an MCP server and push action items through it"; its design is redone when Step 8 is planned. Slack and Teams webhooks are unaffected.
6. Not answered, so the recommendations stand: guided mode beside the open board, Step 0 before the paywall flips, optional join approval with no required accounts.

Step 0 plan: `docs/superpowers/plans/2026-11-16-trust-foundation.md`.

## Original questions (answered above)

1. Who this is for first. If the Enablement team is the first customer, Teams and Azure DevOps or Jira move up and the SSO question comes back. If it is the general market, the order above stands.
2. Guided mode beside the open board (recommended), or guided replaces open.
3. Step 0 before the paywall flips (recommended, since it does not depend on Paddle and the current gaps are harder to defend once people pay), or after.
4. A Neon branch and a second Ably app for development and tests. Step 0 cannot start safely without them.
5. What a free board gets. Suggested: guided mode and everything manual is free on the one free board; AI, team spaces, integrations and the summary email are Pro.
6. Optional join approval on top of account-free participation (recommended), or accounts required on team boards as Parabol does.
7. Claude Haiku as the AI provider, and a monthly spend ceiling.

## Next step

Once the decisions above are settled, Step 0 gets its own detailed task plan under `docs/superpowers/plans/`, followed by Step 1. Step 7 can be planned at the same time because it shares no files with either.
