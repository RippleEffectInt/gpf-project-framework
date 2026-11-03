import { describe, expect, it } from 'vitest'
import frameworkJson from '../data/framework-v1.0-normalized.json'
import { loadPersistedProject, serializeProject } from '../persistence/projectSerialization'
import type { FrameworkData } from '../types/framework'
import { createBlankCustomInnovation } from './customInnovation'
import { initialProjectDesignState, projectDesignReducer, type ProjectDesignAction } from './projectDesign'
import { outcomeLimitMessage } from './outcomeLimit'

const stateWith = (count: number) => ({
  ...initialProjectDesignState,
  selectedFinalOutcomeIds: Array.from({ length: count }, (_, i) => `FO_${i}`),
})
const related: ProjectDesignAction = {
  type: 'addPathway', finalOutcomeId: 'FO_NEW', pathwayId: 'PW_NEW',
  relationshipType: 'related', frameworkPrimaryFinalOutcomeId: 'FO_PRIMARY',
  intermediateOutcomes: [{ frameworkIntermediateOutcomeId: 'IO', primaryIndicatorId: 'IND' }],
}

describe('five Final Outcome limit', () => {
  it('permits five and rejects a sixth without mutation', () => {
    const five = projectDesignReducer(stateWith(4), { type: 'selectFinalOutcome', finalOutcomeId: 'FO_4' })
    expect(five.selectedFinalOutcomeIds).toHaveLength(5)
    expect(projectDesignReducer(five, { type: 'selectFinalOutcome', finalOutcomeId: 'FO_5' })).toBe(five)
  })
  it('counts custom innovation and permits editing it at the limit', () => {
    const custom = createBlankCustomInnovation()
    const action = { type: 'addCustomInnovation' as const, customInnovation: custom }
    const five = projectDesignReducer(stateWith(4), action)
    expect(five.customInnovation).toBe(custom)
    expect(projectDesignReducer(stateWith(5), action).customInnovation).toBeNull()
    expect(projectDesignReducer(five, { type: 'updateCustomInnovationFields', payload: { statement: 'Edited' } }).customInnovation?.statement).toBe('Edited')
    expect(projectDesignReducer(five, { type: 'selectFinalOutcome', finalOutcomeId: 'FO_NEW' })).toBe(five)
  })
  it('adds a Related pathway and its two outcomes atomically when there is room', () => {
    const next = projectDesignReducer(stateWith(3), related)
    expect(next.selectedFinalOutcomeIds).toHaveLength(5)
    expect(next.outcomePathwayLinks).toHaveLength(2)
    expect(next.projectPathways).toHaveLength(1)
  })
  it('rejects the entire Related addition when its Primary outcome exceeds the limit', () => {
    const before = stateWith(4)
    expect(outcomeLimitMessage(before, related)).toContain('total to 6')
    expect(projectDesignReducer(before, related)).toBe(before)
    expect(before.outcomePathwayLinks).toEqual([])
    expect(before.projectPathways).toEqual([])
  })
  it('does not double count existing outcomes and allows links at the limit', () => {
    const next = projectDesignReducer(stateWith(5), { ...related, finalOutcomeId: 'FO_0', frameworkPrimaryFinalOutcomeId: 'FO_1' })
    expect(next.selectedFinalOutcomeIds).toHaveLength(5)
    expect(next.outcomePathwayLinks).toHaveLength(2)
  })
  it('retains over-limit state on load and permits edits, links and removals but no increase', () => {
    const legacy = stateWith(6)
    expect(projectDesignReducer(initialProjectDesignState, { type: 'replaceState', state: legacy })).toEqual(legacy)
    expect(projectDesignReducer(legacy, { type: 'updateMetadata', payload: { title: 'Edited legacy' } }).metadata.title).toBe('Edited legacy')
    expect(projectDesignReducer(legacy, { ...related, finalOutcomeId: 'FO_0', frameworkPrimaryFinalOutcomeId: 'FO_1' }).projectPathways).toHaveLength(1)
    expect(projectDesignReducer(legacy, related)).toBe(legacy)
    const reduced = projectDesignReducer(legacy, { type: 'removeFinalOutcome', finalOutcomeId: 'FO_5' })
    expect(reduced.selectedFinalOutcomeIds).toHaveLength(5)
  })
  it('round-trips an existing six-outcome document without truncation', () => {
    const framework = frameworkJson as FrameworkData
    const ids = framework.finalOutcomes.filter((item) => item.active).slice(0, 6).map((item) => item.id)
    expect(ids).toHaveLength(6)
    const legacy = { ...initialProjectDesignState, selectedFinalOutcomeIds: ids }
    const document = serializeProject({ id: 'legacy', status: 'Draft', design: legacy, framework })
    const loaded = loadPersistedProject(document, framework)
    expect(loaded.design.selectedFinalOutcomeIds).toEqual(ids)
    expect(serializeProject({ id: 'legacy', status: 'Draft', design: loaded.design, framework }).design.selectedFinalOutcomeIds).toEqual(ids)
  })
})
