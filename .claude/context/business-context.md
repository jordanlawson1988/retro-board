# Business Context — Retro Board

> Domain knowledge, stakeholder context, and project goals. Last updated: 2026-03-22

## What It Is

**Retro Board** is a real-time retrospective collaboration tool. Teams use it to run retrospective meetings where participants add cards to themed columns, vote on items, discuss action items, and track outcomes — all in real-time.

This is a personal project built by Jordan Lawson. It is not a commercial product.

## How It Works

1. **Facilitator creates a board** — Chooses a template (Mad/Sad/Glad, Start/Stop/Continue, etc.) and gets a shareable link
2. **Participants join** — Enter their name, no account needed. The link is the authentication.
3. **Everyone adds cards** — Cards can be hidden from others until the facilitator reveals them
4. **Voting** — Facilitator enables voting, participants vote on cards (with configurable limits)
5. **Discussion** — Facilitator can highlight cards, use the timer for timeboxed discussions
6. **Action items** — Team creates action items with assignees and due dates
7. **Complete the retro** — Facilitator archives the board, locking it as read-only

## Stakeholders

| Person | Role | Authority |
|--------|------|-----------|
| **Jordan Lawson** | Creator, developer, user | All decisions |

There is no external client or business owner. Jordan builds it, Jordan uses it, Jordan decides.

## Target Users

- Small teams (2-10 people) running retrospectives
- Agile/Scrum teams at work
- F3 groups for workout retrospectives
- Any group wanting structured feedback

## Business Model

- **Revenue:** None — this is a free, personal tool
- **Infrastructure cost:** $0 (Neon free tier, Ably free tier, Vercel Hobby plan)
- **Monetization potential:** None planned. This is a portfolio project and personal utility.

## Why It Exists

1. **Personal need** — Jordan runs retrospectives and wanted a tool he controlled
2. **Portfolio evidence** — Demonstrates real-time collaboration, serverless architecture, and full-stack development with AI-assisted coding
3. **Learning vehicle** — Playground for Next.js App Router, Ably realtime, Neon serverless Postgres, and Better Auth
4. **Migration case study** — The Supabase-to-Neon migration (March 2026) provides reusable patterns for other projects

## What Makes It Different

Most retro tools (RetroTool, EasyRetro, Reetro) require accounts and have paid tiers. Retro Board is:
- **Zero-friction joining** — No account needed, just a link
- **Self-hosted** — Jordan controls the data and infrastructure
- **Feature-flagged** — Admin console with feature flags allows runtime behavior changes
- **Real-time** — Not polling-based; Ably provides true real-time pub/sub

## Key Metrics (If Tracked)

Jordan does not currently track usage metrics. If metrics were added, the important ones would be:
- Boards created per week
- Average participants per board
- Card count per retro
- Action item completion rate

## Relationship to Other Projects

Retro Board served as a **migration proving ground** for the Neon + Better Auth + Ably stack. Lessons from this migration (documented in `docs/plans/migration-learnings.md`, since deleted from working tree) may apply to:
- **Harman's Desserts** — Evaluated Neon migration (paused due to bcrypt hash extraction blocker)
- **Other projects** — The lazy-init pattern for Neon/Better Auth and the Ably deduplication pattern are reusable
