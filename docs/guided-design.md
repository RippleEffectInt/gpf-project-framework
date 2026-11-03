# Guided setup

Open **Configure pathways → Guided setup** after choosing outcomes and Primary
pathways. Existing drafts use the same state and serialization; there is no new
project type or saved schema. The existing detailed route remains available.

## Prepare and review

1. In **Activities & outputs**, choose **Prepare untouched steps**. This explicitly
   includes every active suggested activity for steps with no selected standard or
   custom activities, excluding reviewed steps. It does not overwrite or fill in
   existing selections. It never runs automatically on entry, reopening or switching
   views. Repeating the explicit action can repopulate an unreviewed step whose
   activities the user has removed entirely.
2. When Project details has a positive planned SHG count, new activities receive
   that quantity and the explicit **Self Help Groups** unit, linked to the project
   total. These are editable group-reach assumptions, not numbers of people,
   events or facilities. Review each activity, change inappropriate units and
   quantities, remove unsuitable activities, and supply missing output wording.
   Without a group count the quantity and unit remain blank. Framework text is
   unchanged; no unit classification or new output phrase is invented.
3. Activities and outputs are grouped by Final Outcome, pathway and Intermediate
   Outcome in the established causal display order. Shared pathways have exactly
   one editor, links from other outcomes and a list of all affected outcomes.
   Add project-specific activities and edit output planning using the same controls
   as the detailed route. Outputs remain unrestricted.
4. **Indicators & review** brings Final Outcome Primary indicators and each IO's
   indicators together. Required standard indicators cannot be removed. Optional
   and custom additional indicators attach to IOs, as in the current model; custom
   additions to standard Final Outcomes and general indicator targets/baselines
   are not introduced. Group counts never become indicator targets.
5. Confirm steps after reviewing activities and indicators. At least one activity
   and the required Primary indicator are still required. Defaults alone do not
   mark a step or pathway complete. Save guided draft works before completion.
   Continue through the existing pathway completion/final review/export gates.

The **Detailed setup** button inside guided setup exposes the full existing IO
editors, including inputs, without unmounting them. Switching the three views
preserves unfinished form text as well as project state. Leaving the page still
requires adding a new custom entry before its draft text becomes project data;
this is stated on screen. Save persists added entries and selections, not unfinished
new-entry forms. Existing completed selections remain complete unless the existing
reducer rules invalidate them; the guided preset does not change those rules.

Custom innovation is summarized in both stages and edited through its existing
custom editor. It has no standard suggested-activity catalog, so guided setup does
not fabricate defaults for it. The multi-country flag does not allocate groups or
activities between countries. No duplication, changes to standard chains, output
caps or new framework entities are included.

## Validation

New tests cover group defaults, absence of a group count, preservation of existing
and custom activity work, reviewed-step exclusion, round-trip persistence, mandatory
indicators, incomplete status after preparation, shared-pathway deduplication,
custom additions, completion controls and retaining form text across views.
