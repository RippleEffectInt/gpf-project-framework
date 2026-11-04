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

Separate existing limitation: suggested/custom additions in the guided list currently target Intermediate Outcomes. Although the framework contains 95 Final Outcome Additional indicators, these are not offered in this list. This is not evidence that they are required; supporting Final Outcome additions needs a separate model/UI decision.

## Verification limits

All three supplied Library screenshot references resolved, but each prescribed transfer failed with `library file transfer failed: download failed`. Their pixels and annotations could not be inspected. UI changes follow Phil's written instructions and inspected source. Browser QA remains unavailable because sandbox-enabled Chromium cannot start in this environment; sandbox restrictions were not bypassed. Automated component tests verify headings, indicator context/count and preserved optional selections, alongside existing editing/persistence tests.

## Screenshot follow-up

The parent inspected all three images and confirmed unequal button heights, the missing activities/outputs section heading, unlabeled pathway/Intermediate Outcome context, truncated “Self Help Gr” unit selection and tiny grey output wording. Version 6 addressed alignment, headings, context and output prominence. This follow-up gives the guided output-unit selector its own full-width row, including when a manual quantity is visible. Direct pixel/browser verification remains unavailable here; this comparison uses the parent’s image inspection and CSS/component inspection. Phil subsequently confirmed that the existing indicator requirements should remain unchanged.
