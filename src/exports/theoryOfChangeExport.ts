import {
  getTheoryOfChangeDisplayEdges,
  layoutTheoryOfChangeGraph,
  TOC_LANE_COLUMNS,
} from '../theoryOfChange/layoutTheoryOfChangeGraph'
import type {
  PositionedTocNode,
  TocGraphModel,
  TocNode,
  TocRelationshipType,
} from '../theoryOfChange/types'

const GRAPH_TOP = 132
const GRAPH_BOTTOM = 30
const MAX_CANVAS_DIMENSION = 16384

const EDGE_COLORS: Record<TocRelationshipType, string> = {
  impactContribution: '#3c6250',
  primaryPathway: '#24543d',
  relatedPathway: '#74827a',
  intermediateOutcomeChain: '#66736c',
}

export interface TheoryOfChangeSvgDocument {
  svg: string
  width: number
  height: number
  nodeIds: string[]
}

export interface TheoryOfChangePdfPage {
  sourceY: number
  sourceHeight: number
  renderHeight: number
}

export interface TheoryOfChangePdfPlan {
  pageWidth: number
  pageHeight: number
  margin: number
  renderWidth: number
  pages: TheoryOfChangePdfPage[]
}

function escapeXml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;')
}

function wrapText(
  value: string,
  maximumCharacters: number,
  maximumLines: number,
): string[] {
  const words = value.trim().split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let line = ''
  words.forEach((word) => {
    const candidate = line ? `${line} ${word}` : word
    if (candidate.length <= maximumCharacters || !line) {
      line = candidate
      return
    }
    lines.push(line)
    line = word
  })
  if (line) lines.push(line)
  if (lines.length <= maximumLines) return lines
  const visible = lines.slice(0, maximumLines)
  const finalIndex = visible.length - 1
  visible[finalIndex] = `${visible[finalIndex]?.replace(/[.…]+$/, '')}…`
  return visible
}

function nodeContent(node: TocNode): {
  kicker: string
  text: string
  fill: string
  stroke: string
  textColor: string
} {
  switch (node.type) {
    case 'impact':
      return {
        kicker: 'IMPACT',
        text: node.data.statement,
        fill: '#e7f2ed',
        stroke: '#176548',
        textColor: '#17251f',
      }
    case 'finalOutcome':
      return {
        kicker: 'FINAL OUTCOME',
        text: node.data.statement,
        fill: '#fff7df',
        stroke: '#a97912',
        textColor: '#17251f',
      }
    case 'pathway':
      return {
        kicker: 'PATHWAY',
        text: node.title,
        fill: '#24543d',
        stroke: '#173b2b',
        textColor: '#ffffff',
      }
    case 'intermediateOutcome':
      return {
        kicker: `INTERMEDIATE OUTCOME · STEP ${node.data.stepNumber}`,
        text: node.data.statement,
        fill: '#ffffff',
        stroke: '#7d8d84',
        textColor: '#17251f',
      }
  }
}

function renderNode(item: PositionedTocNode, offsetY: number): string {
  const { node, position, width, height } = item
  const content = nodeContent(node)
  const x = position.x
  const y = position.y + offsetY
  const lines = wrapText(
    content.text,
    node.type === 'pathway' ? 22 : 42,
    Math.max(2, Math.floor((height - 38) / 14)),
  )
  const lineMarkup = lines
    .map(
      (line, index) =>
        `<tspan x="${x + 12}" dy="${index === 0 ? 0 : 15}">${escapeXml(
          line,
        )}</tspan>`,
    )
    .join('')
  const customBadge = node.custom
    ? `<text x="${x + width - 10}" y="${y + 17}" text-anchor="end" font-size="9" font-weight="700" fill="${content.textColor}">CUSTOM</text>`
    : ''
  return `<g data-toc-export-node="${escapeXml(node.id)}">
    <rect x="${x}" y="${y}" width="${width}" height="${height}" rx="7" fill="${content.fill}" stroke="${content.stroke}" stroke-width="${node.custom ? 2.5 : 1.5}" ${node.custom ? 'stroke-dasharray="6 4"' : ''}/>
    <text x="${x + 12}" y="${y + 18}" font-size="9" font-weight="700" letter-spacing=".5" fill="${content.textColor}">${escapeXml(content.kicker)}</text>
    ${customBadge}
    <text x="${x + 12}" y="${y + 39}" font-size="12" font-weight="600" fill="${content.textColor}">${lineMarkup}</text>
  </g>`
}

function renderEdge(
  edge: ReturnType<typeof getTheoryOfChangeDisplayEdges>[number],
  nodes: Map<string, PositionedTocNode>,
  offsetY: number,
): string {
  const source = nodes.get(edge.source)
  const target = nodes.get(edge.target)
  if (!source || !target) return ''
  const vertical = edge.relationshipType === 'intermediateOutcomeChain'
  const sourceX = vertical
    ? source.position.x + source.width / 2
    : source.position.x + source.width
  const sourceY =
    source.position.y + offsetY + (vertical ? source.height : source.height / 2)
  const targetX = vertical
    ? target.position.x + target.width / 2
    : target.position.x
  const targetY =
    target.position.y + offsetY + (vertical ? 0 : target.height / 2)
  const control = vertical
    ? (sourceY + targetY) / 2
    : (sourceX + targetX) / 2
  const path = vertical
    ? `M ${sourceX} ${sourceY} C ${sourceX} ${control}, ${targetX} ${control}, ${targetX} ${targetY}`
    : `M ${sourceX} ${sourceY} C ${control} ${sourceY}, ${control} ${targetY}, ${targetX} ${targetY}`
  const color = EDGE_COLORS[edge.relationshipType]
  const dashed =
    edge.relationshipType === 'relatedPathway'
      ? 'stroke-dasharray="8 6"'
      : ''
  const relationshipLabel =
    edge.relationshipType === 'primaryPathway'
      ? 'Primary'
      : edge.relationshipType === 'relatedPathway'
        ? 'Related'
        : ''
  const label = relationshipLabel
    ? `<g><rect x="${control - 24}" y="${(sourceY + targetY) / 2 - 11}" width="48" height="17" rx="3" fill="#ffffff" opacity=".94"/><text x="${control}" y="${(sourceY + targetY) / 2 + 1}" text-anchor="middle" font-size="9" font-weight="700" fill="#4a554f">${relationshipLabel}</text></g>`
    : ''
  return `<g data-toc-export-edge="${escapeXml(edge.id)}">
    <path d="${path}" fill="none" stroke="${color}" stroke-width="${edge.relationshipType === 'primaryPathway' ? 2.8 : 2}" ${dashed} marker-end="url(#arrow-${edge.relationshipType})"/>
    ${label}
  </g>`
}

export function buildTheoryOfChangeSvg(
  graph: TocGraphModel,
  projectTitle: string,
): TheoryOfChangeSvgDocument {
  const positioned = layoutTheoryOfChangeGraph(graph)
  const width = positioned.canvas.width
  const height = positioned.canvas.height + GRAPH_TOP + GRAPH_BOTTOM
  const positionedById = new Map(
    positioned.nodes.map((item) => [item.node.id, item]),
  )
  const displayEdges = getTheoryOfChangeDisplayEdges(graph, positioned)
  const markers = Object.entries(EDGE_COLORS)
    .map(
      ([relationshipType, color]) =>
        `<marker id="arrow-${relationshipType}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="${color}"/></marker>`,
    )
    .join('')
  const lanes = positioned.lanes
    .map(
      (lane) =>
        `<rect x="12" y="${lane.y + GRAPH_TOP}" width="${width - 24}" height="${lane.height}" rx="8" fill="${lane.alternate ? '#f4f7f5' : '#fafcfb'}" stroke="${lane.custom ? '#c58b24' : '#d8dfda'}" ${lane.custom ? 'stroke-dasharray="7 5"' : ''}/>`,
    )
    .join('')
  const edges = displayEdges
    .map((edge) => renderEdge(edge, positionedById, GRAPH_TOP))
    .join('')
  const nodes = positioned.nodes
    .map((node) => renderNode(node, GRAPH_TOP))
    .join('')
  const title = escapeXml(projectTitle.trim() || 'Untitled project')

  return {
    width,
    height,
    nodeIds: positioned.nodes.map((item) => item.node.id),
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="Theory of Change for ${title}">
      <defs>${markers}</defs>
      <rect width="${width}" height="${height}" fill="#ffffff"/>
      <text x="24" y="34" font-family="Inter, Arial, sans-serif" font-size="12" font-weight="700" fill="#176548">RIPPLE EFFECT · PROJECT FRAMEWORK</text>
      <text x="24" y="63" font-family="Inter, Arial, sans-serif" font-size="23" font-weight="700" fill="#17251f">${title}</text>
      <text x="24" y="84" font-family="Inter, Arial, sans-serif" font-size="13" fill="#5a6861">Theory of Change</text>
      <g font-family="Inter, Arial, sans-serif" font-size="11" font-weight="700" fill="#46554c">
        <text x="${TOC_LANE_COLUMNS.pathway.x}" y="116">PATHWAY</text>
        <text x="${TOC_LANE_COLUMNS.intermediateOutcome.x}" y="116">INTERMEDIATE OUTCOMES</text>
        <text x="${TOC_LANE_COLUMNS.finalOutcome.x}" y="116">FINAL OUTCOMES</text>
        <text x="${TOC_LANE_COLUMNS.impact.x}" y="116">IMPACTS</text>
      </g>
      <g font-family="Inter, Arial, sans-serif">${lanes}${edges}${nodes}</g>
    </svg>`,
  }
}

function loadSvgImage(svg: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const image = new Image()
    image.onload = () => {
      URL.revokeObjectURL(url)
      resolve(image)
    }
    image.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Unable to render the Theory of Change image.'))
    }
    image.src = url
  })
}

async function renderSvgCanvas(
  document: TheoryOfChangeSvgDocument,
  requestedScale = 2,
): Promise<{ canvas: HTMLCanvasElement; scale: number }> {
  const maximumScale = Math.min(
    MAX_CANVAS_DIMENSION / document.width,
    MAX_CANVAS_DIMENSION / document.height,
  )
  const scale = Math.min(requestedScale, maximumScale)
  const canvas = window.document.createElement('canvas')
  canvas.width = Math.ceil(document.width * scale)
  canvas.height = Math.ceil(document.height * scale)
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Canvas export is unavailable.')
  context.fillStyle = '#ffffff'
  context.fillRect(0, 0, canvas.width, canvas.height)
  const image = await loadSvgImage(document.svg)
  context.drawImage(image, 0, 0, canvas.width, canvas.height)
  return { canvas, scale }
}

function canvasBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob)
      else reject(new Error('Unable to create the Theory of Change image.'))
    }, 'image/png')
  })
}

export async function renderTheoryOfChangePng(
  graph: TocGraphModel,
  projectTitle: string,
): Promise<Blob> {
  const svg = buildTheoryOfChangeSvg(graph, projectTitle)
  const { canvas } = await renderSvgCanvas(svg, 2)
  return canvasBlob(canvas)
}

export function planTheoryOfChangePdf(
  svgWidth: number,
  svgHeight: number,
): TheoryOfChangePdfPlan {
  const pageWidth = 420
  const pageHeight = 297
  const margin = 10
  const renderWidth = pageWidth - margin * 2
  const availableHeight = pageHeight - margin * 2
  const millimetresPerSvgUnit = renderWidth / svgWidth
  const sourceHeightPerPage = availableHeight / millimetresPerSvgUnit
  const pages: TheoryOfChangePdfPage[] = []
  let sourceY = 0
  while (sourceY < svgHeight) {
    const sourceHeight = Math.min(
      sourceHeightPerPage,
      svgHeight - sourceY,
    )
    pages.push({
      sourceY,
      sourceHeight,
      renderHeight: sourceHeight * millimetresPerSvgUnit,
    })
    sourceY += sourceHeight
  }
  return {
    pageWidth,
    pageHeight,
    margin,
    renderWidth,
    pages,
  }
}

export async function renderTheoryOfChangePdf(
  graph: TocGraphModel,
  projectTitle: string,
): Promise<Blob> {
  const { jsPDF } = await import('jspdf')
  const svg = buildTheoryOfChangeSvg(graph, projectTitle)
  const rendered = await renderSvgCanvas(svg, 2)
  const plan = planTheoryOfChangePdf(svg.width, svg.height)
  const pdf = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a3',
    compress: true,
  })

  plan.pages.forEach((page, index) => {
    if (index > 0) pdf.addPage('a3', 'landscape')
    const sourceY = Math.floor(page.sourceY * rendered.scale)
    const sourceHeight = Math.min(
      rendered.canvas.height - sourceY,
      Math.ceil(page.sourceHeight * rendered.scale),
    )
    const segment = window.document.createElement('canvas')
    segment.width = rendered.canvas.width
    segment.height = sourceHeight
    const context = segment.getContext('2d')
    if (!context) throw new Error('Canvas export is unavailable.')
    context.fillStyle = '#ffffff'
    context.fillRect(0, 0, segment.width, segment.height)
    context.drawImage(
      rendered.canvas,
      0,
      sourceY,
      rendered.canvas.width,
      sourceHeight,
      0,
      0,
      segment.width,
      segment.height,
    )
    pdf.addImage(
      segment.toDataURL('image/png'),
      'PNG',
      plan.margin,
      plan.margin,
      plan.renderWidth,
      page.renderHeight,
      undefined,
      'FAST',
    )
  })

  return pdf.output('blob')
}
