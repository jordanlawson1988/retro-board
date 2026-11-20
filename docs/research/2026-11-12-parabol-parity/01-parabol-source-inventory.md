# Parabol retrospective: source inventory (2026-11-12)

Source: shallow clone of ParabolInc/parabol, HEAD dated 2026-11-12, version 15.27.2. Read-only grep. Paths are relative to `packages/` unless noted. Described in own words (AGPL). "H/M/L" = confidence. Plan column: S = starter (free), T = team/paid, E = enterprise; "-" = no gating found.

## 1. Phases and order

Phase enum values relevant to retro: `checkin` (Icebreaker), `TEAM_HEALTH` (pulse), `updates` (shown as "Review Tasks" in retro), `reflect`, `group`, `vote`, `discuss`, `SUMMARY`. Other values belong to Action/Poker/Standup/Team Health meetings.

| Capability | What the user sees/does | Who | Options & defaults | Plan | Evidence | Conf |
|---|---|---|---|---|---|---|
| Phase order | Icebreaker (optional), Team Health (optional), Review Tasks (optional), Reflect, Group, Vote, Discuss, then summary page | Facilitator advances | Retro settings store phaseTypes; team-creation seed lists all seven in that order. The three optional ones are toggled in the lobby. Current default toggles not confirmed (changelog 13.34.0 says Review Tasks enabled by default, 2026-08-05) | Team Health: T/E only | server/graphql/mutations/helpers/createTeamAndLeader.ts; server/graphql/public/mutations/setMeetingSettings.ts; server/utils/isPhaseAvailable.ts | H |
| Icebreaker (`checkin`) | Round where each person answers a question; toggle label "Include Icebreaker" | All; facilitator moves through | Question set from check-in questions; 15.1.0 added new icebreakers | - | client/components/NewMeetingSettingsToggleCheckIn.tsx; CHANGELOG 15.1.0 | M |
| Team Health (`TEAM_HEALTH`) | Optional pulse-check stage, label "Include Team Health check"; non-starter sees an upgrade prompt instead | All vote, facilitator reveals | Also exists as a standalone async meeting type (14.0.0, 2026-09-22) | T/E | client/components/NewMeetingSettingsToggleTeamHealth.tsx; client/utils/features/isTeamHealthAvailable.ts | H |
| Review Tasks (`updates`) | See section 2 | See 2 | Toggle arg `reviewPastTasksEnabled`; retro-only | - | client/components/RetroMeetingSidebar.tsx; setMeetingSettings.ts | H |
| Reflect | Write cards per template column | All | Timer optional; facilitator can focus a column for everyone (`setPhaseFocus`, only before Group completes) | - | createNewMeetingPhases.ts; setPhaseFocus.ts | H |
| Group | Drag cards into groups, name groups | All (anyone can drag) | Phase auto-seeds AI/similarity suggestions on entry | AI mode gated, see 12 | handleCompletedStage.ts | H |
| Vote | Spend votes on groups | All | Defaults 5 total, 3 per group, max 12 total | - | client/types/constEnums.ts (MeetingSettingsThreshold) | H |
| Discuss | One stage per group, ordered by votes | All | Thread per topic, tasks, polls | - | addDiscussionTopics (helpers) | H |
| Facilitator controls | "Next" appears when all connected members are ready; facilitator can also jump via sidebar | Facilitator | Group phase can be reset (`resetRetroMeetingToGroupStage`) | - | BottomControlBarReady.tsx | M |

## 2. The screenshot UI elements

| Capability | What the user sees/does | Who | Options & defaults | Plan | Evidence | Conf |
|---|---|---|---|---|---|---|
| Sidebar "Review Tasks" | It is the existing `updates` phase relabelled for retros. Walks the team's open tasks before reflecting; "done" tasks are auto-archived when the meeting ends (only if the meeting reached Discuss, i.e. not killed early). Recent changelog: marks tasks created since last retro (15.22.0), explains empty stage, single stage when no open tasks (15.22.0), shows what is worth raising (15.21.0) | Facilitator drives; all see | Toggle label "Review Tasks". Appears first because it precedes reflect in phaseTypes. Stage seems per team member in the generic phase, collapsed to one when no tasks (inferred) | - | RetroMeetingSidebar.tsx (label override map); safeEndRetrospective.ts (`archiveDoneTasksForMeeting`); EndRetrospectiveMutation.ts; CHANGELOG 13.16.0, 13.34.0, 15.21-15.22 | H (what), M (per-member stages) |
| No Icebreaker in sidebar | Icebreaker is an opt-in toggle, so absent unless enabled | - | - | - | NewMeetingSettingsToggleCheckIn.tsx | H |
| "Inspiration" button | Opens a right-hand drawer in Reflect and Group. Tabs: Parabol tasks plus each integration the viewer has connected (GitHub, Jira, Jira Server, Linear, GitLab, Azure DevOps, ClickUp, Google Calendar, Parabol standups). Shows recent work items/events; user can add them as reflection cards, and an AI "draft my response" turns items into draft reflections per prompt. Settings dialog and source connect tiles exist | Any participant | One source per AI draft in retros; AI draft needs OpenAI key and AI access; per-user monthly AI token cap | AI draft: org AI flag; starter limit ignored for this feature | client/components/RetroInspirationDrawer.tsx; TeamPrompt/WorkDrawer/*; server/graphql/public/mutations/generateInspirationItems.ts; CHANGELOG 13.27-13.29 | H |
| "Options" button | Only visible in Reflect phase. Single item: "Change template". Disabled once any reflection exists or the phase is complete (tooltip explains) | Facilitator (visibility not confirmed) | - | - | client/components/MeetingOptions.tsx | H |
| Bottom bar "Music" | Headphones popover with background track list, play/stop, volume; synced across the meeting via `setMeetingMusic` | Facilitator controls (sync); inferred | Track list from `useMeetingMusicSync` | - | client/components/BottomControlBarMusic.tsx; setMeetingMusic.ts | M |
| Bottom bar "Tips" | Question-mark menu with per-phase help (Reflect, Group, Vote, Discuss, Updates, etc.); demo variants exist | All | - | - | client/components/BottomControlBarTips.tsx | H |
| "Tap when ready" | Readiness toggle (`flagReadyToAdvance`); label becomes "Undo ready status", then "N / M Ready" for facilitator, then "Next" once everyone is ready | Participants toggle; facilitator advances | Progress ring | - | BottomControlBarReady.tsx; flagReadyToAdvance.ts | H |
| "Hit / for commands" | One of three rotating placeholders in the reflection editor (others: share your thoughts; press Mod+Enter to submit). Opens a slash menu | Participant | See 3 | - | RetroReflectPhase/PhaseItemEditor.tsx | H |
| "Your anonymous reflections end up here" | One of six rotating empty-state tips in the reflection stack placeholder | Participant | - | - | RetroReflectPhase/ReflectionStackPlaceholder.tsx | H |
| Join-request banner "X is requesting to join Team. Accept / Deny" | Toast with autoDismiss 0 and two buttons. Accept runs the invite mutation; Deny runs `denyPushInvitation`. Comes from `pushInvitation`, which an org member triggers by asking to join a team | Existing team members | Denial caps: 3 global per 30 days, 2 per team (recipient set not confirmed) | - | client/mutations/PushInvitationMutation.ts; server/graphql/public/mutations/pushInvitation.ts | H (UI), M (recipients) |
| Avatar row + add-person button | Meeting avatars with an "add team member" button opening the invite dialog | Any member | Invite by email or link (see 10) | - | client/components/AddTeamMemberAvatarButton.tsx; InviteDialog.tsx | M |
| "Facilitator" block + three-dot menu | Menu is a facilitator-rotation panel: drag to reorder, pick next, randomise, auto-assign toggle. Rotation added in 13.39.0 | Facilitator/team | `autoAssignFacilitator`; `updateFacilitatorRotation` | - | client/components/FacilitatorRotationPanel.tsx; CHANGELOG 13.39.0 | H |
| Template prompts "What's working?" / "Where did you get stuck?" | Default template id `workingStuckTemplate` (columns). Each prompt has a colour and optional description | All | Default for new teams | - | createTeamAndLeader.ts | H |

## 3. Reflect

| Capability | What the user sees/does | Who | Options & defaults | Plan | Evidence | Conf |
|---|---|---|---|---|---|---|
| Anonymity | Cards show no author unless `disableAnonymity`; server only resolves `creator` when that flag is on | Setting: facilitator in lobby | Toggle "Anonymous reflections", default on. Stored on team settings and copied to meeting | - | NewMeetingSettingsToggleAnonymity.tsx; public/types/RetroReflection.ts | H |
| Visibility while writing | Own draft in column editor; teammates see a mini card grid of activity (tip text) and `isEditing` flag; others' text not shown until submitted/grouped (inferred from tips) | All | Draft persisted locally per meeting+prompt | - | ReflectionStackPlaceholder.tsx; PhaseItemEditor.tsx | M |
| Edit/delete | Only the creator edits or deletes; locked once Group phase completes | Creator | - | - | updateReflectionContent.ts; removeReflection.ts | H |
| Rich text | TipTap editor: bold/italic etc, bullet and numbered lists, quote, code, H3, divider, image, task list, highlight, links, Loom embed, @mentions, `:` emoji | Participant | 1,900-char limit; Mod+Enter submits. Disabled in reflections: H1/H2, tables, to-do list, embed, page links, database, insights, file | File upload tier-aware | client/hooks/useTipTapReflectionEditor.ts | H |
| Emoji reactions | Reaction chips on reflections, "add reaction" button; cap 12 distinct emoji | All | MAX_REACTJIS 12 | - | ReflectionCard/ReactjiSection.tsx; constEnums.ts | H |
| Progress / readiness | Ready ring in bottom bar; team activity grid | All | - | - | BottomControlBarReady.tsx | M |
| Hover outline | Reflections outline on hover (13.25.0) | All | - | - | CHANGELOG 13.25.0 | M |

## 4. Group

| Capability | What the user sees/does | Who | Options & defaults | Plan | Evidence | Conf |
|---|---|---|---|---|---|---|
| Drag to group | Drag a card onto another; mutations `startDraggingReflection`, `endDraggingReflection`, `updateDragLocation` | Any participant | - | - | public/mutations/*Dragging*.ts | H |
| Live remote drags | Others' in-flight drags render as remote ghost cards | All | - | - | ReflectionGroup/RemoteReflection.tsx | H |
| Group titles | Editable manually; marquee for long titles (13.6.0). AI-suggested titles come via suggested groups | All | - | AI gated | ReflectionGroupTitleEditor.tsx | M |
| Suggested groups | On entering Group, suggestions are generated automatically for the facilitator ("AI by default", 15.1.0). Two modes: `similarity` (embedding cosine, no LLM, works with AI off) and `ai` (LLM, optional custom instruction, optional same-column-only). Badge on suggested cards; per-meeting Redis lock; cached by input hash | Facilitator requests; all see | Reasoning effort low on starter, medium on paid | AI mode: org `useAI` and starter limit of 3 AI meetings | generateSuggestedGroups.ts; SuggestedGroupsMode.graphql; getGroupingReasoningEffort.ts; canAccessAI.ts | H |
| Old autogroup | Deprecated, superseded | - | - | - | public/mutations/autogroup.ts | H |
| Spotlight | Modal to find similar reflection groups to a card and pull them in (search bar, results, source group) | Any | Embedding-based `similarReflectionGroups` | - | SpotlightModal.tsx; SpotlightResults.tsx | H |
| Ungroup / reset | Ungroup button on cards; `resetReflectionGroups`; undoable group phase dialog | Facilitator for reset | - | - | UngroupButton.tsx; UndoableGroupPhaseDialog.tsx | M |
| Colour dots in sidebar | Group colour dots in retro sidebar (12.5.0) | All | - | - | CHANGELOG 12.5.0 | M |

## 5. Vote

| Capability | What the user sees/does | Who | Options & defaults | Plan | Evidence | Conf |
|---|---|---|---|---|---|---|
| Votes per person | Each member gets N votes; spend on groups | All | Default 5, max 12 | - | constEnums.ts | H |
| Max per group | Cap votes on one group | All | Default 3, min 1, cannot exceed total | - | updateRetroMaxVotes.ts | H |
| Mid-meeting change | Stepper menu changes both numbers until Vote phase completes. Server refuses lowering total below what any member already spent, or max-per-group below what a topic already has. Change is also saved to team settings | Resolver shows no facilitator check; UI placement not read | - | - | VoteSettingsMenu.tsx; updateRetroMaxVotes.ts | H (rules), L (who) |
| Unvote | Withdraw a vote until phase completes | All | - | - | voteForReflectionGroup.ts | H |
| Vote anonymity / remaining | Per-member `votesRemaining` tracked; team-wide remaining shown in `RetroVoteMetaHeader`. Whether voter identities are shown on cards not confirmed | All | - | - | RetroVoteMetaHeader.tsx | M |
| Topic order | Discuss order derived from votes at Vote completion | - | - | - | handleCompletedStage.ts | H |

## 6. Discuss

| Capability | What the user sees/does | Who | Options & defaults | Plan | Evidence | Conf |
|---|---|---|---|---|---|---|
| Topic ordering | One stage per group, sorted by votes; facilitator can drag-reorder (`dragDiscussionTopic`) | Facilitator | - | - | public/mutations/dragDiscussionTopic.ts | H |
| Thread | Comments with replies (`threadParentId`), anonymous flag (`isAnonymous`), edit, delete, emoji reactions, @mentions, "commenting" indicator | All | - | - | addComment.ts; DiscussionThread*.tsx | H |
| AI discussion question | After Group completes, an LLM writes one discussion question per group with 2+ cards; inserted as a comment titled "Discussion Question" by the Parabol AI user at Vote completion | Automatic | Skipped when AI unavailable | AI gated | generateDiscussionPrompt.ts; addAIGeneratedContentToThreads.ts | H |
| Related discussions | Embedder job finds past discussions related to the topic | Automatic | - | - | handleCompletedStage.ts (`relatedDiscussions:start`) | M |
| Tasks | Create tasks in a topic; statuses include active, stuck, done (and others, list truncated); owner, due date, tags, team move | All | - | - | createTask.ts; TaskStatusEnum.graphql | M |
| Push to external tracker | `createTaskIntegration` to Jira, GitHub, GitLab, Linear, Azure DevOps, ClickUp, Jira Server; "where a task can be sent" shown on cards (15.23.0) | Task owner/any | Jira export limit on starter (12.9.0, 13.3.0) | Starter limited | createTaskIntegration.ts; CHANGELOG | H |
| Polls | `createPoll` with title and options inside a discussion thread | All | - | - | createPoll.ts | M (UI not read) |
| Share topic | `shareTopic` posts a topic to Slack channel | Facilitator | - | - | shareTopic.ts | H |
| Transcripts | Meeting transcripts (Zoom, Google Meet) shown in discussion drawer | All | - | - | DiscussionDrawerTranscripts.tsx | H |

## 7. Facilitation

| Capability | What the user sees/does | Who | Options & defaults | Plan | Evidence | Conf |
|---|---|---|---|---|---|---|
| Advance | `navigateMeeting`; "Next" after all ready | Facilitator | - | - | BottomControlBarReady.tsx | H |
| Timer | Per-stage time limit (live countdown) or an end date/time that makes the stage async; optional Slack ping at end | Facilitator | `scheduledEndTime`, `isAsync`; Slack events for limit start/end | - | setStageTimer.ts; StageTimerModal*.tsx; SlackNotificationEventEnum.graphql | H |
| Facilitator change | Rotation panel; `updateFacilitatorRotation`; auto-assign for next meeting | Facilitator/lead | - | - | FacilitatorRotationPanel.tsx | M |
| End early | `endRetrospective`; if not on Discuss it counts as "killed" and Review Tasks archiving is skipped | Facilitator | - | - | safeEndRetrospective.ts | H |
| Late join / rejoin | `joinMeeting` requires team membership; "Rejoin" control exists | Team member | - | - | joinMeeting.ts; BottomControlBarRejoin.tsx | M |
| Locked meetings | Ended meetings lock for unpaid orgs, and on starter 30 days after end | - | 30 days | S limited | types/helpers/isMeetingLocked.ts | H |
| Recurrence | Meeting series with RRULE; next meeting auto-created; start next now (13.45.0); recurrence need not start immediately (13.22.0); multi-team series card | Lead | - | - | updateRecurrenceSettings.ts; startMeetingSeriesNow | H |
| Calendar | Google Calendar integration appears as Inspiration source and tab | Any | - | - | integrations/gcal | M |

## 8. After the meeting

| Capability | What the user sees/does | Who | Options & defaults | Plan | Evidence | Conf |
|---|---|---|---|---|---|---|
| Summary page | Ending creates a Page (Notion-like doc) streamed in blocks: subtitle, meta, AI insights, tasks, topics, participants, summary table; user is navigated to it | All members | Toggle summary email (`toggleSummaryEmail`) | - | safeEndRetrospective.ts; summaryPage/generateRetroMeetingSummaryPage.ts; CHANGELOG 10.16.0 | H |
| Summary email | New retro email linking to page (10.17.0); not awaited | Members | Opt-out toggle | - | sendSummaryEmail; CHANGELOG 10.17.0 | H |
| AI summary + sentiment | LLM summary of the retro stored on meeting; whole-meeting sentiment score | Automatic | Falls back to null if AI unavailable | AI gated | generateRetroSummary.ts | H |
| Exports | Pages: PDF export (11.2.0), Confluence export (behind org flag `ConfluenceExport`). CSV found only for org member list, not retro data | Page editors | - | Flag-gated | exportPagesToConfluence.ts; ExportToCSVButton.tsx | H |
| Task home | Tasks stay on team/personal task boards (status active/stuck/done); done ones auto-archived after Review Tasks retro | Owners | - | - | batchArchiveTasks; safeEndRetrospective.ts | M |
| Carry-over | Prior open tasks reviewed in Review Tasks at next retro | Facilitator | - | - | CHANGELOG 13.16.0, 15.22.0 | H |
| History | Timeline event `TimelineEventRetroComplete` per member; Pages and search; Reports (AI Q&A, 15.17.0) | Members | - | - | safeEndRetrospective.ts; askReportQuestion.ts | H |
| Slack / Teams / Mattermost | `IntegrationNotifier.endMeeting` posts to configured channels (Slack, MS Teams, Mattermost) | Automatic | Slack events: meetingStart, meetingEnd, stage timer start/end, TOPIC_SHARED | - | MSTeamsNotifier.ts; SlackNotificationEventEnum.graphql | H |
| Page-level extras | Transcript attached to page (10.13.0), public pages, page access requests | - | - | - | CHANGELOG 10.x | M |

## 9. Templates

| Capability | What the user sees/does | Who | Options & defaults | Plan | Evidence | Conf |
|---|---|---|---|---|---|---|
| Seed count | Original init seed has 95 retro-type rows (45 marked starter, all marked free; breakdown: 33 retrospective, 23 postmortem, 23 premortem, 5 feedback, 3 strategy, remaining 8 uncategorised by my pattern). Plus I Like/I Wish/I Wonder (2025-01) and six added 2026-10-06 (Learning Matrix; Went Well/Not Well/Improve; Start-Stop-Continue-Kudos; Good-Bad-Ugly; KALM; FLAP). About 102 total | - | Seeded rows may include inactive ones; I did not filter by isActive | - | server/postgres/migrations/2025-01-08...init.ts; 2026-10-06...addSixRetroTemplates.ts | M |
| Custom templates | Add template, add/rename/move/remove prompts, prompt description and group colour, rename template, change category | Team members | Scope TEAM, ORGANIZATION, PUBLIC (`updateTemplateScope`) | Starter: 2 free custom retro templates per user (column default 2) | addPromptTemplate.ts; SharingScopeEnum.graphql; migration 2026-10-05 | H |
| Activity library | Templates have `mainCategory` and illustrations; favourites; search with embeddings; "Change template" in Options | All | - | - | MeetingTemplate table; toggleFavoriteTemplate; CHANGELOG 14.1.0, 15.17.0 | M |
| AI template generation | Not found | - | - | - | - | - |

## 10. Teams and access

| Capability | What the user sees/does | Who | Options & defaults | Plan | Evidence | Conf |
|---|---|---|---|---|---|---|
| Structure | Org > Team > Team members; team lead (`isLead`, `promoteToTeamLead`); org roles via `setOrgUserRole` | Admin/lead | - | Starter: max 100 teams (free cap), 2 starter-tier teams constant also exists | addTeam.ts; constEnums.ts | M |
| Invites | `inviteToTeam` by email; invite link; accept invitation | Members | - | - | inviteToTeam.ts; InviteDialog.tsx | H |
| Request to join | `pushInvitation` notifies; `requestToJoinDomain` / `acceptRequestToJoinDomain` for domain | Org members | Approved domains list (`addApprovedOrganizationDomains`) | - | isRequestToJoinDomainAllowed.ts | H |
| Auto-join | `updateAutoJoin` per team | Admin | - | - | updateAutoJoin.ts | M |
| Private teams | `toggleTeamPrivacy`; starter cannot make public team private | Lead | - | S blocked | toggleTeamPrivacy.ts | H |
| Guests/anonymous participants | No account-less participation found: `joinMeeting` needs team membership. A no-login demo route exists (`isDemoRoute`) | - | - | - | joinMeeting.ts | M |
| Auth | Email+password, Google, Microsoft, SAML, SCIM | - | - | SAML/SCIM likely E | mutation list | M |
| Notifications | In-app, email, Slack/Teams/Mattermost | - | `setNotificationStatus`, `setTeamNotificationSetting` | - | mutation list | M |

## 11. Integrations (retro-relevant)

| Provider | Role in a retro | Evidence |
|---|---|---|
| Jira Cloud, Jira Server/Data Center | Push tasks; Inspiration source; AI estimates (poker) | integrations/jira, jiraServer |
| GitHub, GitLab, Linear, Azure DevOps, ClickUp | Push tasks; Inspiration source (ClickUp new in 15.21.0; Azure rebuilt 15.4.0) | integrations/* |
| Slack | Meeting start/end, timer pings, shared topics | SlackNotificationEventEnum.graphql |
| MS Teams, Mattermost | Notifications; Mattermost channel link plus plugin package | MSTeamsNotifier.ts; packages/mattermost-plugin |
| Google Calendar | Inspiration source | integrations/gcal |
| Zoom (GA 13.37.0), Google Meet | Transcripts into discussion drawer and summary page | integrations/zoom, gmeet |
| Confluence | Page export (flagged) | exportPagesToConfluence.ts |

## 12. AI features

| Capability | Where | Gate | Evidence | Conf |
|---|---|---|---|---|
| Suggested grouping (LLM or embeddings) | Group phase | `ai` mode needs `useAI` and starter cap | generateSuggestedGroups.ts | H |
| Discussion question per topic | After Group | canAccessAI | generateDiscussionPrompt.ts | H |
| Inspiration draft reflections | Reflect/Group drawer | OPEN_AI_API_KEY, useAI, per-user monthly token cap | generateInspirationItems.ts | H |
| Retro summary + sentiment | Meeting end | canAccessAI | generateRetroSummary.ts | H |
| Page insights block, Reports Q&A | After | useAI | getInsightsBlocks.ts; askReportQuestion.ts | M |
| Team Health category summaries and paraphrase | Team Health | - | CHANGELOG 15.7.0 | M |
| Embeddings (reflections, templates, pages) | Spotlight, search, related discussions | embedder package, model "Harrier" added 15.17.0 | CHANGELOG | M |

Provider/model: OpenAI via `OpenAIServerManager`; changelog 13.38.0 "update AI model to luna" (name only; underlying model not determined). `canAccessAI` = org `useAI` and (non-starter or fewer than 3 qualifying AI meetings); toggle `toggleAIFeatures` per org.

## 13. Tier gating and flags

| Gate | Behaviour | Evidence | Conf |
|---|---|---|---|
| Tiers | starter, team, enterprise; starter with trial date counts as team (`getFeatureTier`) | getFeatureTier.ts | H |
| Team Health | non-starter only | isPhaseAvailable.ts | H |
| AI | 3 qualifying AI meetings on starter | canAccessAI.ts | H |
| Meeting lock | starter: ended > 30 days; unpaid orgs always | isMeetingLocked.ts | H |
| Custom retro templates | starter: 2 free per user | migration; addPromptTemplate.ts | H |
| Jira export | starter limits (12.9.0, 13.3.0) | CHANGELOG | M |
| Uploads | smaller size caps on starter | uploadUserAsset.ts | H |
| Private teams | starter cannot go private from public | toggleTeamPrivacy.ts | H |
| Feature flags (DB-driven) | `ConfluenceExport`, `Databases`, `SCIM`, `oauthProvider` seen in client; Pages flag removed 10.30.0 | grep | M |

## 14. Changelog highlights (May 2025 to 2026-11-12)

Main CHANGELOG.md starts at 15.27.x down to 12.0.0 (Feb 2026); earlier entries in docs/changelog/CHANGELOG-v10.md and v11.md.

| Version (date) | Change |
|---|---|
| 10.14.0 (2025-07-21) | Submit reflections/tasks with Mod+Enter |
| 10.16.0 (2025-07-30) | Retro summary becomes a Page |
| 10.17.0 (2025-08-04) | New retro summary email |
| 10.25.0 (2025-09-23) | Pages GA; flag removed 10.30.0 |
| 12.5.0 (2026-02-18) | Group colour dots in sidebar |
| 13.6.0 (2026-03-13) | Improved AI grouping, ungrouping, title marquee |
| 13.16.0 (2026-05-18) | Task review added to retro |
| 13.17.0 / 13.19.0 / 13.37.0 | Google Meet transcripts (May 2026); Zoom (May 2026); Zoom GA (2026-08-21) |
| 13.25.0 (2026-06-10) | Outline reflections on hover |
| 13.27.0-13.29.0 (Jun-Jul 2026) | Inspiration items (GitHub, Linear, GCal, Jira) |
| 13.29.1 (2026-07-10) | Removed generateInsights and team-level insights |
| 13.32.0 (2026-08-03) | Suggested Grouping |
| 13.34.0 (2026-08-05) | Task Review phase enabled by default |
| 13.39.0 (2026-08-28) | Facilitator rotation |
| 14.0.0 (2026-09-22) | Team Health meeting type |
| 14.4.0 (2026-10-07) | Six new retro templates |
| 15.1.0 (2026-10-07) | AI suggested groups by default; new icebreakers |
| 15.17.0 (2026-11-05) | Related-discussion matching and page search on Harrier embeddings; Reports questions expanded; Amplitude removed |
| 15.21.0-15.23.0 (Nov 2026) | ClickUp; Review Tasks improvements; task destination hints |
| 15.27.0 (2026-11-12) | Group suggestions "like teams do" plus grouping metrics |

## Could not determine

- Which optional phases (Icebreaker, Team Health, Review Tasks) are on by default for a brand-new team today (seed lists all, changelog says Review Tasks default on).
- Who sees the vote-settings stepper and the Options menu (facilitator-only is inferred, not verified in UI code).
- Whether voter identities are visible; exact vote-count UI.
- Poll UI in retro Discuss (mutation exists, component not read).
- Full task status list, and the Music track list contents.
- Exact retro template count after removing inactive seeds; 8 init rows lacked a category I could parse.
- Which model "luna" maps to; provider beyond OpenAI.
- Which users receive the join-request banner.
- Anything about anonymous guest join beyond the demo route.
- Pricing/limit values for plans (billing out of scope).
