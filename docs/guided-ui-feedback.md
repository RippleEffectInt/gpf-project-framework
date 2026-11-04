# Guided setup clarity review

This preview aligns the setup choice buttons, adds “Activities and Outputs for each Outcome”, numbers Final Outcome baskets, explains activity/output editing, and enlarges planned output wording. No framework records, saved values, selection defaults or validation rules change.

## Required indicator finding

`src/data/frameworkRegistry.ts` loads `framework-v1.1-output-phrase-reviewed-ambiguous.json`. Its provenance names `Project Framework - pathway outcome links and indicator review.xlsx` and states that standard Primary indicators remain mandatory and Additional indicators optional. The workbook itself was not available for independent verification.

An audit of active canonical records found:

- 30 Final Outcomes, each with exactly one linked active mandatory Primary indicator.
- 130 Intermediate Outcomes, each with exactly one linked active mandatory Primary indicator.
- 95 Final Outcome Additional indicators and 253 Intermediate Outcome Additional indicators, all non-mandatory.

`getPrimaryIndicatorForFinalOutcome` and `getPrimaryIndicatorForIntermediateOutcome` in `src/services/frameworkService.ts` check the parent ID/type, primaryIndicatorIds, Primary role, mandatory flag and active status. They require exactly one match. Guided setup does not promote Additional indicators to Primary.

Dietary diversity (`PW_026`, Final Outcome `FO_023`) has five Intermediate Outcomes (`PW_026_IO_01`–`05`). A basket containing only this pathway therefore shows six required indicators: one Final Outcome indicator plus five Intermediate Outcome indicators. Previously these appeared as a flat list without their measurement context. The preview now labels what each measures and explains the two levels.

Phil confirmed on 4 November 2026 that one mandatory Primary indicator is required for each Final Outcome and each Intermediate Outcome. The current canonical rules are retained; no indicator data or requirement changes are needed.

The current preview now offers the canonical Final Outcome Additional indicators as optional suggestions, alongside custom Final Outcome measures.

## Verification limits

All three supplied Library screenshot references resolved, but each prescribed transfer failed with `library file transfer failed: download failed`. Their pixels and annotations could not be inspected. UI changes follow Phil's written instructions and inspected source. Browser QA remains unavailable because sandbox-enabled Chromium cannot start in this environment; sandbox restrictions were not bypassed. Automated component tests verify headings, indicator context/count and preserved optional selections, alongside existing editing/persistence tests.

## Screenshot follow-up

The parent inspected all three images and confirmed unequal button heights, the missing activities/outputs section heading, unlabeled pathway/Intermediate Outcome context, truncated “Self Help Gr” unit selection and tiny grey output wording. Version 6 addressed alignment, headings, context and output prominence. This follow-up gives the guided output-unit selector its own full-width row, including when a manual quantity is visible. Direct pixel/browser verification remains unavailable here; this comparison uses the parent’s image inspection and CSS/component inspection. Phil subsequently confirmed that the existing indicator requirements should remain unchanged.

## Further guided editor simplification

- Activity titles now begin with “Activity:” and their context reads “Supports Outcome/s:”.
- Guided editors always show the saved planned quantity. They omit the group-total checkbox and its explanatory sentence. Opening or switching views does not change saved quantities or group-link flags. Deliberately editing quantity uses the existing manual-quantity behavior, clearing the group-total link; advanced controls remain available.
- Suggested indicators are grouped by Intermediate Outcome, with separate rows and explicit Add buttons. Selected suggestions disappear from the available list; empty groups explain that none remain.
- Phil clarified that this means custom indicators for Final Outcomes; the implementation is described below.

## Custom Final Outcome indicators

Each standard or custom Final Outcome now offers an optional custom indicator editor in the guided indicator stage and embedded advanced view. Add, edit, remove and undo are separate from mandatory Primary measures. Unsubmitted form text survives switching guided stages or the embedded advanced mode; save the indicator before navigating away and save the project draft to persist it.

The optional `design.finalOutcomeIndicators` dictionary is keyed by Final Outcome ID, storing ID, wording and measurement notes. Older drafts without it load unchanged. Shared pathways do not duplicate these records. Deselecting a standard outcome retains its records without showing/exporting them; reselecting that same outcome restores access. Custom innovation records use their own unique outcome ID.

Saved indicators appear in draft overview, final review and Theory of Change details. Indicator exports mark them Project-specific/Optional at Final Outcome level; donor-logframe exports include wording and notes. No SharePoint field changes or migration are required. The subsequent two-level indicator controls add standard Final Outcome suggested-indicator selection without changing required Primary measures.

## Required indicator table and editor placement

The guided activity editor now ends with Done editing, below notes and output fields. Required Primary Indicators are presented in a semantic, read-only table with outcome level, full outcome statement and indicator (including saved measurement notes). Custom innovation Primary measures are also read-only in this table; their existing advanced authoring controls remain intact. Tables have scoped headers and a keyboard-focusable horizontal scroll region for narrow screens. Shared pathway configuration remains displayed once with the existing link from other baskets.

Optional suggested/selected Intermediate Outcome indicators identify their outcome level and statement. Custom Final Outcome indicator groups show the Final Outcome label and full statement. No required flags, saved data, defaults, persistence or export behavior change.

Validation: 19 guided-design and draft-overview tests passed, including read-only required tables and editor control order; lint, TypeScript and production build passed. Browser visual verification remains unavailable in this environment.

## Two-level optional indicator controls and activity grouping

Beneath the unchanged read-only required table, Final Outcome Indicators and Intermediate Outcome Indicators each have Add more indicators. This reveals Add from list of suggested indicators and Add custom indicator. Existing selected measures retain edit/remove/undo controls. Forms remain mounted when switching guided stages or the embedded advanced route.

Standard Final Outcome suggestions come only from active, non-mandatory Additional indicators linked to that Final Outcome in the canonical framework. Their optional IDs are stored in `design.finalOutcomeSuggestedIndicatorIds`; old drafts without the field are unchanged. Selections appear in draft/final review, Theory of Change details and indicator/donor-logframe exports. The source catalogue is not modified. Custom innovation has no canonical suggestions, so this flow explains that and offers custom creation.

Final Outcome indicator lists identify all selected supporting pathways, their Primary/Related relationships and shared status. Intermediate Outcome indicators name their own pathway. Activity sections use each actual Intermediate Outcome statement and pathway, including empty states. Shared pathway activities remain editable once with existing cross-basket links; no duplicate activity records or inferred relationships are introduced.
