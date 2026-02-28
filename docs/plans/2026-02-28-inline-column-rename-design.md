# Inline Column Rename

**Date:** 2026-02-28
**Status:** Approved

## Summary

Replace the current "click Rename button in action bar" flow with inline click-to-edit on the column title. Admins click the column title text directly, it becomes an input, and Enter/Escape saves/cancels. Cleaner UX with fewer clicks.

## Current Behavior

- Column title renders as `<h3>` (always plain text)
- Admin action bar below header has a "Rename" button that sets `isEditingTitle = true`
- Edit mode shows input + Save (check) + Cancel (X) buttons
- Non-admins and completed boards: no rename capability

## New Behavior

### Click-to-edit (admin only, non-completed board)

- Column title `<h3>` gets `cursor-text` and subtle underline on hover
- Clicking the title sets `isEditingTitle = true`
- Edit mode: input replaces the `<h3>`, auto-focused with text selected
- No Save/Cancel buttons — Enter or blur saves, Escape cancels
- Empty input on save reverts to original title

### Non-admin / completed board

- Title renders as plain text, no hover effect, not interactive

### Rename button removal

- Remove the "Rename" button from the admin action bar
- Color and Delete buttons remain

## Scope

**Single file change:** `src/components/Board/BoardColumn.tsx`

- No store, type, database, or migration changes needed
- Existing `handleSaveTitle`, `handleTitleKeyDown`, `onBlur` handlers reused
- Existing `isEditingTitle` / `editTitle` state reused

## Changes Detail

1. **Title `<h3>` (lines 327-330):** Make conditionally clickable for admins. Add hover styles (`cursor-text`, subtle underline or background tint). onClick sets `editTitle` and `isEditingTitle`.

2. **Edit mode input (lines 296-326):** Remove Save/Cancel buttons. Keep input with `onKeyDown` (Enter/Escape) and `onBlur` (save). Style the input to match the `<h3>` size/weight so the transition feels seamless.

3. **Admin action bar (lines 346-357):** Remove the Rename button. Keep Color and Delete.
