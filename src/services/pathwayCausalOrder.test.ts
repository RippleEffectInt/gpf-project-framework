import { describe, expect, it } from 'vitest'
import { CURRENT_FRAMEWORK, HISTORIC_FRAMEWORK } from '../data/frameworkRegistry'
import { getIntermediateOutcomesForPathway, getIntermediateOutcomesInCausalOrder, getPathwayIntermediateOutcomeSeeds } from './frameworkService'
import { initialProjectDesignState, projectDesignReducer } from '../state/projectDesign'
import { generateTheoryOfChangeGraph, tocNodeId } from '../theoryOfChange/generateTheoryOfChangeGraph'
import { getTheoryOfChangeDisplayEdges, layoutTheoryOfChangeGraph } from '../theoryOfChange/layoutTheoryOfChangeGraph'
import { serializeProject } from '../persistence/projectSerialization'
import { buildProjectExportModel } from '../exports/buildProjectExportModel'

describe('confirmed dietary diversity causal order', () => {
  for (const framework of [HISTORIC_FRAMEWORK, CURRENT_FRAMEWORK]) {
    it(`keeps canonical data while displaying 5 to 1 in ${framework.frameworkVersion}`, () => {
      const before = JSON.stringify(framework)
      for (const pathway of framework.pathways) {
        const canonical = getIntermediateOutcomesForPathway(framework, pathway.id)
        const causal = getIntermediateOutcomesInCausalOrder(framework, pathway.id)
        expect(causal.map((io) => io.id)).toEqual((pathway.id === 'PW_026' ? [...canonical].reverse() : canonical).map((io) => io.id))
      }
      const pathway = framework.pathways.find((item) => item.id === 'PW_026')!
      const state = projectDesignReducer(initialProjectDesignState, {
        type: 'addPathway', pathwayId: pathway.id, finalOutcomeId: pathway.primaryFinalOutcomeId,
        relationshipType: 'primary', frameworkPrimaryFinalOutcomeId: pathway.primaryFinalOutcomeId,
        intermediateOutcomes: getPathwayIntermediateOutcomeSeeds(framework, pathway.id),
      })
      expect(state.projectPathways[0]?.intermediateOutcomeConfigurations[0]?.frameworkIntermediateOutcomeId).toBe('PW_026_IO_01')
      const graph = generateTheoryOfChangeGraph({ project: state, framework })
      const layout = layoutTheoryOfChangeGraph(graph)
      expect(layout.nodes.filter((item) => item.node.type === 'intermediateOutcome').map((item) => item.node.type === 'intermediateOutcome' && item.node.data.stepNumber)).toEqual([5, 4, 3, 2, 1])
      const edges = getTheoryOfChangeDisplayEdges(graph, layout)
      const node = (step: number) => tocNodeId('intermediateOutcome', `PW_026_IO_0${step}`, pathway.id)
      for (let step = 5; step > 1; step--) {
        expect(edges.some((edge) => edge.source === node(step) && edge.target === node(step - 1))).toBe(true)
      }
      const outcomeNode = tocNodeId('finalOutcome', pathway.primaryFinalOutcomeId)
      expect(edges.some((edge) => edge.source === node(1) && edge.target === outcomeNode)).toBe(true)
      expect(edges.some((edge) => edge.source === node(5) && edge.target === outcomeNode)).toBe(false)
      const project = serializeProject({ id: 'diet-test', design: state, framework, status: 'Draft' })
      const model = buildProjectExportModel({ project, etag: 'test', createdAt: '2026-11-03', modifiedAt: '2026-11-03' }, framework)
      expect(model.resultsFramework.map((row) => row.intermediateOutcomeStep)).toEqual([5, 4, 3, 2, 1])
      expect(JSON.stringify(framework)).toBe(before)
    })
  }
})
