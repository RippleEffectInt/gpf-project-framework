import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ProjectExportPanelView } from './ProjectExportPanel'

describe('project export panel', () => {
  it('blocks export from unsaved state and provides Save project', () => {
    const onSave = vi.fn()
    const onExport = vi.fn()
    render(
      <ProjectExportPanelView
        blocked
        saving={false}
        busyKind={null}
        error={null}
        onSave={onSave}
        onExport={onExport}
        onClose={() => undefined}
      />,
    )

    expect(
      screen.getByText(
        'You have unsaved changes. Save the project before exporting.',
      ),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Download Excel' }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Download PNG' }),
    ).not.toBeInTheDocument()
    fireEvent.click(
      screen.getByRole('button', { name: 'Save project' }),
    )
    expect(onSave).toHaveBeenCalledOnce()
    expect(onExport).not.toHaveBeenCalled()
  })

  it('offers the three simple formats for a saved project', () => {
    const onExport = vi.fn()
    render(
      <ProjectExportPanelView
        blocked={false}
        saving={false}
        busyKind={null}
        error={null}
        onSave={() => undefined}
        onExport={onExport}
        onClose={() => undefined}
      />,
    )

    fireEvent.click(
      screen.getByRole('button', { name: 'Download Excel' }),
    )
    fireEvent.click(
      screen.getByRole('button', { name: 'Download PNG' }),
    )
    fireEvent.click(
      screen.getByRole('button', { name: 'Download PDF' }),
    )
    expect(onExport.mock.calls.map(([kind]) => kind)).toEqual([
      'workbook',
      'png',
      'pdf',
    ])
  })
})
