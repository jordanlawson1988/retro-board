# WS7: AI Assistant Support — Design Placeholder

> **Status:** Placeholder — requires brainstorming session before implementation planning.

**Goal:** Add an AI-powered assistant to enhance the retrospective experience. Exact capabilities TBD.

---

## Candidate Features (To Be Evaluated)

These are potential AI assistant features to explore during a dedicated brainstorming session:

### During Retro
- **Card Summarization** — AI groups and summarizes cards across columns, surfacing themes and patterns that participants might not notice
- **Sentiment Analysis** — Analyze card text for sentiment distribution across the board (how positive vs negative is the retro?)
- **Smart Suggestions** — Based on card content, suggest action items with draft descriptions and potential assignees
- **Discussion Prompts** — AI generates follow-up questions for the facilitator based on card themes
- **Duplicate Detection** — Flag similar cards that could be merged

### Post-Retro
- **Retro Summary** — AI-generated summary of the retro (key themes, decisions, action items) suitable for sharing in Slack/email
- **Trend Analysis** — Across multiple retros, identify recurring themes (e.g., "deployment issues have appeared in 4 of the last 5 retros")
- **Action Item Follow-Up** — AI drafts check-in messages for overdue action items
- **Board Comparison** — Compare this retro to previous ones: what improved, what regressed?

### Facilitation
- **AI Facilitator Mode** — For teams without a dedicated facilitator, AI can guide the retro flow: prompting for cards, managing timer, suggesting when to vote, prompting discussion
- **Icebreaker Generation** — Generate contextual icebreaker questions based on team history

---

## Technical Considerations

| Concern | Notes |
|---------|-------|
| **LLM Provider** | Claude API (Anthropic) — aligns with Jordan's stack and expertise |
| **Cost Model** | AI features would likely need to be Pro-only or metered to control API costs |
| **Latency** | Summarization and analysis should be async (background tasks) or streaming |
| **Privacy** | Card content is sent to LLM — users need clear consent. Consider anonymization option |
| **Rate Limiting** | Per-user rate limits on AI calls to prevent abuse |
| **Caching** | Cache AI results per board version to avoid redundant API calls |

## Pricing Impact

AI features have per-call costs that differ from the fixed-infrastructure pricing of the rest of the product. Options:

1. **Include in Pro** — Simple but unpredictable cost per user
2. **Separate AI tier** — $9.99/mo "Pro + AI" with usage limits
3. **Pay-per-use** — Credits-based system (e.g., 50 AI actions/month included in Pro)

---

## Next Steps

1. Run `/brainstorm` session to evaluate which AI features deliver the most value with the least complexity
2. Select 2-3 features for initial release
3. Create implementation plan (separate workstream)
4. Consider this as the "sticky" feature that differentiates from competitors (most retro tools don't have AI)
