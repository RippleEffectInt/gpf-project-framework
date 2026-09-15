export interface ThematicArea {
  readonly id: string
  readonly label: string
  readonly sortOrder: number
  readonly active: boolean
}

export interface Impact {
  readonly id: string
  readonly statement: string
  readonly theme: string
  readonly active: boolean
}

export type ImpactArea = Impact

export interface FinalOutcomeImpactLink {
  readonly id: string
  readonly finalOutcomeId: string
  readonly impactId: string
  readonly relationshipRole: 'Primary' | 'Secondary' | 'Other'
}

export interface FinalOutcome {
  readonly id: string
  readonly thematicAreaId: string
  readonly shortLabel: string | null
  readonly statement: string
  readonly primaryIndicatorIds: readonly string[]
  readonly additionalIndicatorIds: readonly string[]
  readonly active: boolean
}

export interface Pathway {
  readonly id: string
  readonly thematicAreaId: string
  readonly name: string
  readonly description: string | null
  readonly primaryFinalOutcomeId: string
  readonly intermediateOutcomeIds: readonly string[]
  readonly active: boolean
}

export interface FinalOutcomePathwayLink {
  readonly id: string
  readonly finalOutcomeId: string
  readonly pathwayId: string
  readonly pathwayRelationshipType: 'primary' | 'related'
  readonly relationshipType: 'Core' | 'Complementary' | 'Enabling'
  readonly outcomeRole:
    | 'Primary final outcome for this pathway'
    | 'Additional final outcome'
    | 'Enabling final outcome'
  readonly rationale: string | null
  readonly designCaution: string | null
  readonly appSelectable: boolean
}

export interface IntermediateOutcome {
  readonly id: string
  readonly pathwayId: string
  readonly stepNumber: number
  readonly statement: string
  readonly primaryIndicatorIds: readonly string[]
  readonly additionalIndicatorIds: readonly string[]
  readonly suggestedActivityIds: readonly string[]
  readonly active: boolean
}

export interface Indicator {
  readonly id: string
  readonly parentType: 'FinalOutcome' | 'IntermediateOutcome'
  readonly parentId: string
  readonly text: string
  readonly role: 'Primary' | 'Additional'
  readonly mandatory: boolean
  readonly active: boolean
}

export interface SuggestedActivity {
  readonly id: string
  readonly intermediateOutcomeId: string
  readonly text: string
  readonly sortOrder: number
  readonly active: boolean
}

export interface FrameworkInputCategory {
  readonly id: string
  readonly label: string
}

export interface FrameworkData {
  readonly schemaVersion: string
  readonly frameworkVersion: string
  readonly status: string
  readonly publishedAt: string
  readonly thematicAreas: readonly ThematicArea[]
  readonly impacts: readonly Impact[]
  readonly finalOutcomes: readonly FinalOutcome[]
  readonly finalOutcomeImpactLinks: readonly FinalOutcomeImpactLink[]
  readonly pathways: readonly Pathway[]
  readonly finalOutcomePathwayLinks: readonly FinalOutcomePathwayLink[]
  readonly intermediateOutcomes: readonly IntermediateOutcome[]
  readonly indicators: readonly Indicator[]
  readonly suggestedActivities: readonly SuggestedActivity[]
  readonly inputCategories: readonly FrameworkInputCategory[]
}

export interface FinalOutcomeSummary {
  readonly outcome: FinalOutcome
  readonly thematicArea: ThematicArea
  readonly impactAreas: readonly ImpactArea[]
  readonly primaryIndicator: Indicator | undefined
  readonly pathwayCount: number
  readonly primaryPathwayCount: number
  readonly relatedPathwayCount: number
}

export interface PathwaySummary {
  readonly pathway: Pathway
  readonly finalOutcomeId: string
  readonly link: FinalOutcomePathwayLink | null
  readonly relationshipType: import('./project').PathwayRelationshipType
  readonly rationale: string | null
  readonly intermediateOutcomes: readonly IntermediateOutcome[]
}
