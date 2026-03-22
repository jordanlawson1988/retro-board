# /session-end — Capture Context Before Ending Session

Wrap up the current session by capturing what was done, the state of things, and what's next. This ensures the next session picks up seamlessly.

## Step 1: Summarize Session Work

### Git Changes
- `git log --oneline --since="4 hours ago"` (adjust timeframe if session was longer)
- `git diff --stat main` (what changed relative to main)
- `git status --short` (any uncommitted work)
- `git stash list` (any stashed work)

Compile a brief summary of what was accomplished this session.

### Unfinished Work
Identify anything that was started but not completed:
- Open TODOs or FIXMEs added this session
- Partially implemented features
- Known issues introduced or discovered
- Test failures introduced (if test framework exists)

## Step 2: Update Context Files (if stale)

Check each living context file and update if the session's work changed their accuracy:

- **test-health.md** — If test framework was added or tests were written, run tests and update
- **feature-status.md** — If features were added/modified, update the tracker
- **architecture-notes.md** — If tech debt was added/resolved or dependencies changed, update
- **business-context.md** — Rarely changes; update only if project scope changed

## Step 3: Suggest Memory Updates

Review the session for anything worth persisting to memory (in `~/.claude/projects/` memory):
- New project context learned (deadlines, scope changes)
- Workflow preferences confirmed or corrected by Jordan
- Decisions made that aren't captured in `docs/decisions.md`

Suggest specific memory updates but do NOT write them without Jordan's approval.

## Step 4: Output Session Summary

```
======================================================
                  SESSION WRAP-UP
======================================================

  Session Date:   [DATE]
  Branch:         [branch]
  Commits:        [N] new commits this session

  What was done:
    - [bullet summary of accomplishments]

  What's unfinished:
    - [bullet summary of open items, or "Nothing — clean exit"]

  Test State:
    [N passed, N failed] OR [not configured]
    Gate: [CLEAR / BLOCKED / no gate]

  Context Files Updated:
    [list of files updated, or "All current"]

  Suggested Next Session:
    - [what to pick up next]

======================================================
```

## Important
- This is a diagnostic + capture command — do not fix bugs or implement features
- Do not push code — that's Jordan's decision
- If there are uncommitted changes, flag them prominently
- Keep the summary concise — this should complete in under 2 minutes
