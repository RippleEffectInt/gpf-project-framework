> Historical proposal. Guided setup is now implemented; see [guided-design.md](guided-design.md) for the delivered behaviour and conservative limitations.

# Proposed guided configuration route — not implemented

Phil's proposed basic route is feasible as a second interface over the same
project design. Keep the current detailed route available; switching views must
never regenerate, duplicate or discard selections, notes, output overrides or
custom records. This document records recommendations and unresolved decisions,
not approved behaviour.

## What is already implemented

- Each Intermediate Outcome offers **Include all activities** and, if a positive
  project SHG total exists, **Include all activities and set outputs to N Self Help
  Groups** (`PathwayConfigurationPage.tsx`, `SuggestedActivityBulkControls`).
- `setSuggestedActivitiesSelfHelpGroupOutputs` selects the supplied suggested
  activities, assigns the project SHG total and unit, preserves existing notes and
  output wording, and sets `useProjectSelfHelpGroupTotal`. The UI warns before
  replacing manually configured quantities/units (`state/projectDesign.ts`).
- Changing the project SHG total updates linked activity quantities; manual
  quantity changes unlink that activity (`state/activityOutputs.ts`). Manually
  overridden output wording is preserved, so any numbers embedded in that wording
  may need review when the total changes.
- Outputs are activity-level quantity/unit/wording, not separate independently
  selected output entities. Shared pathways have one configuration used by every
  linked Final Outcome (`types/project.ts`).
- Standard Primary indicators are mandatory. Optional standard and custom
  additional indicators belong to Intermediate Outcome configurations. Custom
  innovation has its own required Primary indicators. Standard Final Outcome
  indicators come from framework data; there is no equivalent custom-additional
  indicator collection on a standard Final Outcome.
- The workbook already consolidates Activities & Outputs and Indicators, but
  these exports are not editable planning screens.

## Recommended guided route

1. Choose outcomes/pathways using the existing rules. Ask for the planned group
   count and confirm what those groups represent before offering group defaults.
2. Explicitly offer to prefill **suggested standard activities** for selected
   pathways. Apply defaults once to each unique pathway. Do not silently overwrite
   existing edits; preview changes and preserve custom records. Do not mark the
   pathway complete merely because defaults were inserted.
3. Show an editable Activities & Outputs review grouped by Final Outcome, pathway
   and Intermediate Outcome. Users can deselect unsuitable activities, change
   units/quantities/wording, and add project-specific activities to a chosen IO.
   Standard activity wording remains read-only reference data; edits should use
   project notes/output wording or an explicit project-specific replacement, not
   rewrite the framework. For a shared pathway, edit one configuration, list all affected Final Outcomes,
   and avoid counting its activities or outputs twice.
4. Show a consolidated Indicators review with result level, linked outcome/IO,
   source and Mandatory/Optional status. Keep mandatory Primary indicators locked;
   offer existing optional indicators and custom additional indicators at the
   supported IO level. Repeated wording is not sufficient evidence to deduplicate
   indicators; preserve their IDs and all relationships.
5. Confirm the design after review. Preserve at least one activity per IO for
   completion, unrestricted outputs, the five-Final-Outcome limit and draft saving
   without completeness. The detailed route edits the exact same state.

## Defaults require judgment

The current dataset has 601 active suggested activities. Applying the application's
existing output-phrase rule finds 590 with usable phrases and 11 without a usable
phrase. A usable phrase only means the text can be generated; it does not establish
that SHGs are the appropriate unit or that every group receives every activity.
The data deliberately does not supply an authoritative output unit per activity.

People trained, events delivered, facilities established and groups supported are
different measures. Setting each quantity to 50 SHGs does not mean 50 events or
50 people, and adding those quantities does not give unique project reach. Missing
or blocked phrases should remain visibly in need of review rather than receive
invented wording. Empty suggested-activity lists or incomplete custom innovation
still need the user's input.

The SHG count must not become a target for every indicator: many are percentages,
behaviours or other measures. Current indicator records do not provide a general
baseline/target framework. Multi-country identification also does not divide group
totals or activities between countries.

## Decisions to clarify with Phil before implementation

1. Does **group number** specifically mean the existing project SHG total, and
   should it apply to every suggested activity, or only activities the user
   confirms are delivered to all those groups? Recommendation: explicit opt-in
   group defaults, visibly marked for review.
2. Should the basic route preselect all suggested standard activities for removal
   during review, or start from a smaller curated selection? No authoritative
   curated subset or per-activity unit mapping currently exists.
3. Does **per outcome** mean Final Outcomes with IO detail underneath? Should new
   custom indicators attach to IOs as today, or also to standard Final Outcomes?
   The latter requires an explicit model/persistence change.

Recommend calling these **Guided setup** and **Detailed setup**, with free movement
between them, rather than creating two different project types. A reviewed preset
is useful; a claim that the design is automatically complete would be misleading.
