import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { App } from '../App'
import { CURRENT_FRAMEWORK } from '../data/frameworkRegistry'
import { LocalProjectRepository } from '../persistence/localProjectRepository'
import { loadPersistedProject, serializeProject } from '../persistence/projectSerialization'
import { buildProjectExportModel } from '../exports/buildProjectExportModel'
import { buildProjectDesignWorkbook } from '../exports/excelExport'
import { FrameworkProvider, ProjectDesignProvider } from '../state/AppState'
import { initialProjectDesignState } from '../state/projectDesign'

function design(isMultiCountry = true) {
  return { ...initialProjectDesignState, metadata: {
    ...initialProjectDesignState.metadata, title: 'Synthetic multi-country draft',
    country: 'Kenya, Ethiopia', isMultiCountry,
  } }
}
function document(isMultiCountry = true) {
  return serializeProject({ id: 'multi-country-test', status: 'Draft', design: design(isMultiCountry), framework: CURRENT_FRAMEWORK })
}

describe('multi-country identification', () => {
  it('round-trips the flag and free-text countries without creating separate records', async () => {
    const repository = new LocalProjectRepository({ keyPrefix: 'multi-country-test:' })
    localStorage.removeItem('multi-country-test:multi-country-test')
    const created = await repository.createProject(document())
    const loaded = loadPersistedProject((await repository.getProject(created.project.project.id))!.project, CURRENT_FRAMEWORK)
    expect(loaded.design.metadata.isMultiCountry).toBe(true)
    expect(loaded.design.metadata.country).toBe('Kenya, Ethiopia')
    await repository.updateProject(document(false), created.etag)
    const reopened = loadPersistedProject((await repository.getProject(created.project.project.id))!.project, CURRENT_FRAMEWORK)
    expect(reopened.design.metadata.isMultiCountry).toBe(false)
    expect(reopened.design.metadata.country).toBe('Kenya, Ethiopia')
    expect(await repository.listProjects()).toHaveLength(1)
    localStorage.removeItem('multi-country-test:multi-country-test')
  })
  it('loads older drafts as single-country and rejects malformed flags', () => {
    const old = document()
    delete old.design.metadata.isMultiCountry
    expect(loadPersistedProject(old, CURRENT_FRAMEWORK).design.metadata.isMultiCountry).toBe(false)
    expect(() => loadPersistedProject({ ...old, design: { ...old.design, metadata: { ...old.design.metadata, isMultiCountry: 'yes' } } }, CURRENT_FRAMEWORK)).toThrow()
  })
  it('lets users toggle and save the flag without clearing country names', async () => {
    const repository = new LocalProjectRepository({ keyPrefix: 'multi-country-ui:' })
    render(<MemoryRouter initialEntries={['/design/details']}>
      <FrameworkProvider initialData={CURRENT_FRAMEWORK}>
        <ProjectDesignProvider initialState={design(false)} repository={repository}><App /></ProjectDesignProvider>
      </FrameworkProvider>
    </MemoryRouter>)
    const checkbox = screen.getByRole('checkbox', { name: 'Multi-country project' })
    expect(checkbox).not.toBeChecked()
    fireEvent.click(checkbox)
    expect(screen.getByLabelText('Countries *')).toHaveValue('Kenya, Ethiopia')
    fireEvent.click(screen.getByRole('button', { name: 'Save project' }))
    await waitFor(async () => {
      const summaries = await repository.listProjects()
      expect(summaries).toHaveLength(1)
      const record = await repository.getProject(summaries[0]!.id)
      expect(record?.project.design.metadata.isMultiCountry).toBe(true)
    }, { timeout: 5000 })
    fireEvent.click(checkbox)
    expect(screen.getByLabelText('Country *')).toHaveValue('Kenya, Ethiopia')
    for (const item of await repository.listProjects()) localStorage.removeItem(`multi-country-ui:${item.id}`)
  })
  it('includes the flag and country names in the Excel project summary', () => {
    const model = buildProjectExportModel({ project: document(), etag: 'test', createdAt: '2026-11-03', modifiedAt: '2026-11-03' }, CURRENT_FRAMEWORK)
    expect(model.metadata).toMatchObject({ country: 'Kenya, Ethiopia', isMultiCountry: true })
    const sheet = buildProjectDesignWorkbook(model).getWorksheet('Project Summary')!
    const values = new Map<string, unknown>()
    sheet.eachRow((row) => values.set(String(row.getCell(1).value), row.getCell(2).value))
    expect(values.get('Multi-country project')).toBe('Yes')
    expect(values.get('Countries')).toBe('Kenya, Ethiopia')
  })
})
