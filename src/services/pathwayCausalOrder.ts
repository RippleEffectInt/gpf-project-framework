// Phil confirmed PW_026 runs 5 → 1. Other framework chains are mixed, so
// retain their existing order until each has been reviewed. Never renumber IDs
// or stepNumber, and never apply this standard-pathway correction to custom IOs.
export function compareStandardOutcomeSteps(
  pathwayId: string,
  leftStep: number,
  rightStep: number,
): number {
  return pathwayId === 'PW_026' ? rightStep - leftStep : leftStep - rightStep
}
