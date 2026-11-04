# Guided setup

Open **Configure pathways → Guided setup** after choosing outcomes and Primary
pathways. Existing drafts use the same state and serialization; there is no new
project type or saved schema. The existing detailed route remains available.

## Prepare and review

1. Choose **Guided setup** or **Advanced setup** from the prominent choice cards.
   New guided designs automatically include all active suggested activities for
   untouched standard steps, without a Prepare action. Advanced entry does not apply
   defaults. A saved per-step marker makes this idempotent, including shared pathways:
   removing activities, switching views and reopening cannot silently re-add them.
   Steps already edited in advanced setup or containing existing work are preserved.
   Older drafts without the marker retain their selections, even deliberately empty
   steps; use **Add a suggested activity** to add individual activities explicitly.
2. When Project details has a positive planned SHG count, new activities receive
   that quantity and the explicit **Self Help Groups** unit, linked to the project
   total. These are editable group-reach assumptions, not numbers of people,
   events or facilities. Review each activity, change inappropriate units and
   quantities, remove unsuitable activities, and supply missing output wording.
   Without a group count the quantity and unit remain blank. Framework text is
   unchanged; no unit classification or new output phrase is invented.
3. Each Final Outcome has a plain list of selected activities, with the output
   directly beneath each activity. **Edit** opens its notes and output controls;
   custom activity wording is editable, while standard framework wording remains
   fixed. **Remove activity** removes that selection, with **Undo removal** for
   the latest removal in that outcome. **Add custom activity** appears at the end.
   The add form asks explicitly which IO it supports; no relationship is guessed.
   Outputs already belong to activities in the existing model, so no migration or
   new relationship is introduced. Missing output wording is shown honestly.
   Shared pathways have one editable list under their first linked outcome,
   warnings about the shared effect, and links from other outcomes to that heading.
   Activity order follows the existing causal display order. Outputs remain unrestricted.
4. **Indicators & review** brings Final Outcome Primary indicators and each IO's
   indicators together. Required standard indicators cannot be removed. Optional
   and custom additional indicators attach to IOs, as in the current model; custom
   additions to standard Final Outcomes and general indicator targets/baselines
   are not introduced. Group counts never become indicator targets.
5. **Confirm reviewed pathways** after reviewing activities and indicators; this
   uses the existing pathway-completion reducer and saves the reviewed state. At least one activity
   and the required Primary indicator are still required. Defaults alone do not
   mark a step or pathway complete. Save guided draft works before completion.
   Continue through the existing pathway completion/final review/export gates.

The **Advanced setup** button inside guided setup exposes the full existing IO
editors, including inputs, without unmounting them. Switching the three views
preserves unfinished form text as well as project state. Leaving the page still
requires adding a new custom entry before its draft text becomes project data;
this is stated on screen. Save persists added entries and selections, not unfinished
new-entry forms. Existing completed selections remain complete unless the existing
reducer rules invalidate them; the guided preset does not change those rules.

Custom innovation uses the same simple activity/indicator lists, with editable
custom wording and required indicators protected against removal. Its full editor
remains mounted in Advanced setup. It has no standard suggested-activity catalog, so guided setup does
not fabricate defaults for it. The multi-country flag does not allocate groups or
activities between countries. No duplication, changes to standard chains, output
caps or new framework entities are included.

## Validation

New tests cover group defaults, absence of a group count, preservation of existing
and custom activity work, reviewed-step exclusion, round-trip persistence, mandatory
indicators, incomplete status after automatic defaulting, shared-pathway deduplication,
custom additions, completion controls and retaining form text across views.

The indicators screen shows selected indicators only. Required Primary indicators
are labelled and cannot be removed. Standard indicator wording is fixed; custom
indicators can be edited. Optional indicators can be removed and the latest removal
undone. Add custom indicators at the end, explicitly choosing an IO. Suggested
activities and optional framework indicators remain available through secondary
add controls, rather than displaying every checkbox on the main page.

Both simple and advanced editors remain mounted while switching views. Existing
record editors read current shared values so an open advanced editor cannot overwrite
newer wording or notes changed in the simple view. Incomplete new-entry form text
survives view switches and closing/reopening its form; it is not persisted until
the user adds the record. Removal is explicit; undo restores its saved output/notes
but completion may still need reconfirmation under existing rules.

New designs initially include only required Primary indicators. Optional suggested
and custom indicators remain available through **Add suggested indicators** and
**Add custom indicator**. Automatic activity defaults never reset any indicator
selection. The optional version-1 JSON field `design.guidedInitializedStepKeys` is
validated as a string array; new projects start with an empty array, while missing
on older documents means automatic defaulting is disabled for that document.
The marker records activity/indicator/input edits as well as initialization, so a
step deliberately emptied in advanced setup is protected before first guided entry.
It does not change framework chains, completion rules or the five-outcome limit.
Missing group counts or unusable framework output wording still require user review;
no quantity, unit classification or output phrase is invented.
