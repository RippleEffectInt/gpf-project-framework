import type { ProjectExportModel } from './types'

export function sanitizeExportFilename(value: string): string {
  const withoutControlCharacters = [...value]
    .filter((character) => {
      const code = character.charCodeAt(0)
      return code >= 32 && code !== 127
    })
    .join('')
  const sanitized = withoutControlCharacters
    .normalize('NFKC')
    .replace(/[<>:"/\\|?*]/g, ' ')
    .replace(/\s+/g, '_')
    .replace(/[. ]+$/g, '')
    .replace(/^[_ .]+/g, '')
  return (sanitized || 'Project').slice(0, 120)
}

export function projectExportBaseName(model: ProjectExportModel): string {
  return sanitizeExportFilename(
    model.metadata.projectCode || model.metadata.projectTitle || 'Project',
  )
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.style.display = 'none'
  document.body.append(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 0)
}
