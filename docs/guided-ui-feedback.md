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

Decision needed before changing requirements: does “one mandatory indicator per outcome” mean one per Final Outcome AND per Intermediate Outcome (current framework), or one for the entire Final Outcome basket? The latter changes the agreed framework and completion rules and is not implemented.

Separate existing limitation: suggested/custom additions in the guided list currently target Intermediate Outcomes. Although the framework contains 95 Final Outcome Additional indicators, these are not offered in this list. This is not evidence that they are required; supporting Final Outcome additions needs a separate model/UI decision.

## Verification limits

All three supplied Library screenshot references resolved, but each prescribed transfer failed with `library file transfer failed: download failed`. Their pixels and annotations could not be inspected. UI changes follow Phil's written instructions and inspected source. Browser QA remains unavailable because sandbox-enabled Chromium cannot start in this environment; sandbox restrictions were not bypassed. Automated component tests verify headings, indicator context/count and preserved optional selections, alongside existing editing/persistence tests.
