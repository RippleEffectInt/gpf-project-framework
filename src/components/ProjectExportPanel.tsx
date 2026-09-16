import { useState } from 'react'
import {
  buildProjectExportModelFromRecord,
  ProjectExportError,
} from '../exports/buildProjectExportModel'
import {
  downloadBlob,
  projectExportBaseName,
} from '../exports/download'
import type { ProjectExportModel } from '../exports/types'
import { useProjectDesign } from '../state/AppState'

type ExportKind = 'workbook' | 'png' | 'pdf'

interface ProjectExportPanelViewProps {
  blocked: boolean
  saving: boolean
  busyKind: ExportKind | null
  error: string | null
  onSave: () => void
  onExport: (kind: ExportKind) => void
  onClose: () => void
}

export function ProjectExportPanelView({
  blocked,
  saving,
  busyKind,
  error,
  onSave,
  onExport,
  onClose,
}: ProjectExportPanelViewProps) {
  return (
    <div
      className="project-export-panel"
      role="dialog"
      aria-modal="false"
      aria-labelledby="project-export-heading"
    >
      <div className="project-export-heading">
        <div>
          <span className="eyebrow">Saved project exports</span>
          <h2 id="project-export-heading">Export project design</h2>
        </div>
        <button
          className="icon-button"
          type="button"
          onClick={onClose}
          aria-label="Close export panel"
        >
          ×
        </button>
      </div>

      {blocked ? (
        <div className="project-export-warning" role="alert">
          <p>
            You have unsaved changes. Save the project before exporting.
          </p>
          <button
            className="button primary"
            type="button"
            onClick={onSave}
            disabled={saving}
          >
            {saving ? 'Saving…' : 'Save project'}
          </button>
        </div>
      ) : (
        <div className="project-export-options">
          <section>
            <div>
              <h3>Project Design Workbook</h3>
              <p>
                Project summary, results framework, activities and outputs,
                indicators, inputs and donor logframe.
              </p>
            </div>
            <button
              className="button primary"
              type="button"
              onClick={() => onExport('workbook')}
              disabled={busyKind !== null}
            >
              {busyKind === 'workbook' ? 'Preparing Excel…' : 'Download Excel'}
            </button>
          </section>
          <section>
            <div>
              <h3>Theory of Change</h3>
              <p>
                Complete pathway-oriented Theory of Change for sharing and
                printing.
              </p>
            </div>
            <div className="inline-actions">
              <button
                className="button primary"
                type="button"
                onClick={() => onExport('png')}
                disabled={busyKind !== null}
              >
                {busyKind === 'png' ? 'Preparing PNG…' : 'Download PNG'}
              </button>
              <button
                className="button secondary"
                type="button"
                onClick={() => onExport('pdf')}
                disabled={busyKind !== null}
              >
                {busyKind === 'pdf' ? 'Preparing PDF…' : 'Download PDF'}
              </button>
            </div>
          </section>
        </div>
      )}
      {error && (
        <p className="field-error project-export-error" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}

async function createExportBlob(
  kind: ExportKind,
  model: ProjectExportModel,
): Promise<{ blob: Blob; filename: string }> {
  const baseName = projectExportBaseName(model)
  switch (kind) {
    case 'workbook': {
      const { renderProjectDesignWorkbook } = await import(
        '../exports/excelExport'
      )
      return {
        blob: await renderProjectDesignWorkbook(model),
        filename: `${baseName}_Project_Design.xlsx`,
      }
    }
    case 'png': {
      const { renderTheoryOfChangePng } = await import(
        '../exports/theoryOfChangeExport'
      )
      return {
        blob: await renderTheoryOfChangePng(
          model.theoryOfChange,
          model.metadata.projectTitle,
        ),
        filename: `${baseName}_Theory_of_Change.png`,
      }
    }
    case 'pdf': {
      const { renderTheoryOfChangePdf } = await import(
        '../exports/theoryOfChangeExport'
      )
      return {
        blob: await renderTheoryOfChangePdf(
          model.theoryOfChange,
          model.metadata.projectTitle,
        ),
        filename: `${baseName}_Theory_of_Change.pdf`,
      }
    }
  }
}

export function ProjectExportPanel() {
  const {
    activeProject,
    hasUnsavedChanges,
    saveStatus,
    saveProject,
    getSavedProjectRecord,
  } = useProjectDesign()
  const [open, setOpen] = useState(false)
  const [busyKind, setBusyKind] = useState<ExportKind | null>(null)
  const [error, setError] = useState<string | null>(null)
  const blocked = hasUnsavedChanges || activeProject === null

  const exportProject = async (kind: ExportKind) => {
    if (blocked) return
    setBusyKind(kind)
    setError(null)
    try {
      const record = await getSavedProjectRecord()
      if (!record) {
        throw new ProjectExportError(
          'The saved project could not be loaded for export.',
        )
      }
      const model = buildProjectExportModelFromRecord(record)
      const result = await createExportBlob(kind, model)
      downloadBlob(result.blob, result.filename)
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : 'The project export could not be created.',
      )
    } finally {
      setBusyKind(null)
    }
  }

  return (
    <section
      className="review-export-action"
      aria-labelledby="review-export-heading"
    >
      <div>
        <span className="eyebrow">Project documents</span>
        <h2 id="review-export-heading">Export</h2>
        <p>
          Download documents generated from the last saved project design.
        </p>
      </div>
      {!open && (
        <button
          className="button primary large"
          type="button"
          onClick={() => {
            setError(null)
            setOpen(true)
          }}
        >
          Export project
        </button>
      )}
      {open && (
        <ProjectExportPanelView
          blocked={blocked}
          saving={saveStatus === 'saving'}
          busyKind={busyKind}
          error={error}
          onSave={() => void saveProject()}
          onExport={(kind) => void exportProject(kind)}
          onClose={() => setOpen(false)}
        />
      )}
    </section>
  )
}
