import {
  Controls,
  Handle,
  MarkerType,
  Position,
  ReactFlow,
  type Edge,
  type Node,
  type NodeProps,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  getTheoryOfChangeDisplayEdges,
  layoutTheoryOfChangeGraph,
  type TocLaneLayout,
} from '../theoryOfChange/layoutTheoryOfChangeGraph'
import type {
  TocGraphModel,
  TocNode,
  TocRelationshipType,
} from '../theoryOfChange/types'
import { TheoryOfChangeDetails } from './TheoryOfChangeDetails'

interface TocFlowNodeData extends Record<string, unknown> {
  tocNode: TocNode
  onSelect: (nodeId: string) => void
}

type TocFlowNode = Node<TocFlowNodeData, 'tocNode'>
type TocLaneBandNode = Node<{ label: string }, 'group'>
type TocCanvasNode = TocFlowNode | TocLaneBandNode
type TocFlowEdge = Edge<{ relationshipType: TocRelationshipType }, 'smoothstep'>

const nodeTypeLabels: Record<TocNode['type'], string> = {
  impact: 'Impact',
  finalOutcome: 'Final Outcome',
  pathway: 'Pathway',
  intermediateOutcome: 'Intermediate Outcome',
}

function TocNodeCard({ data }: NodeProps<TocFlowNode>) {
  const node = data.tocNode
  const body =
    node.type === 'impact'
      ? node.data.statement
      : node.type === 'finalOutcome'
        ? node.data.statement
        : ''
  const visibleTitle =
    node.type === 'intermediateOutcome' ? node.data.statement : node.title
  return (
    <>
      <Handle
        className="toc-node-handle"
        type="source"
        id="right"
        position={Position.Right}
        isConnectable={false}
      />
      <Handle
        className="toc-node-handle"
        type="source"
        id="bottom"
        position={Position.Bottom}
        isConnectable={false}
      />
      <button
        className={`toc-node-card toc-node-${node.type} ${
          node.type === 'pathway' ? 'toc-pathway-lane-label' : ''
        } nodrag nopan`}
        type="button"
        data-toc-node-id={node.id}
        onClick={() => data.onSelect(node.id)}
        aria-label={`View details for ${nodeTypeLabels[node.type]}: ${node.title}`}
      >
        <span className="toc-node-kicker">
          {node.type === 'intermediateOutcome'
            ? node.title
            : nodeTypeLabels[node.type]}
        </span>
        {node.custom && (
          <span className="toc-custom-badge">Custom innovation</span>
        )}
        <strong>{visibleTitle}</strong>
        {body && body !== visibleTitle && <span>{body}</span>}
      </button>
      <Handle
        className="toc-node-handle"
        type="target"
        id="left"
        position={Position.Left}
        isConnectable={false}
      />
      <Handle
        className="toc-node-handle"
        type="target"
        id="top"
        position={Position.Top}
        isConnectable={false}
      />
    </>
  )
}

const nodeTypes = {
  tocNode: TocNodeCard,
}

const edgeStyles: Record<
  TocRelationshipType,
  { stroke: string; strokeWidth: number; strokeDasharray?: string }
> = {
  impactContribution: {
    stroke: '#3c6250',
    strokeWidth: 2.2,
  },
  primaryPathway: {
    stroke: '#24543d',
    strokeWidth: 2.8,
  },
  relatedPathway: {
    stroke: '#74827a',
    strokeWidth: 2,
    strokeDasharray: '8 6',
  },
  intermediateOutcomeChain: {
    stroke: '#66736c',
    strokeWidth: 1.8,
  },
}

function toFlowEdges(
  graph: TocGraphModel,
  positioned: TocLaneLayout,
): TocFlowEdge[] {
  return getTheoryOfChangeDisplayEdges(graph, positioned).map((edge) => {
    const style = edgeStyles[edge.relationshipType]
    const isIntermediateChain =
      edge.relationshipType === 'intermediateOutcomeChain'
    const isPathwayRelationship =
      edge.relationshipType === 'primaryPathway' ||
      edge.relationshipType === 'relatedPathway'
    return {
      id: edge.id,
      source: edge.source,
      target: edge.target,
      type: 'smoothstep',
      sourceHandle: isIntermediateChain ? 'bottom' : 'right',
      targetHandle: isIntermediateChain ? 'top' : 'left',
      focusable: false,
      selectable: false,
      className: `toc-edge toc-edge-${edge.relationshipType}`,
      data: { relationshipType: edge.relationshipType },
      style,
      label: isPathwayRelationship
        ? edge.relationshipType === 'primaryPathway'
          ? 'Primary'
          : 'Related'
        : undefined,
      labelStyle: {
        fill: '#4a554f',
        fontSize: 10,
        fontWeight: 700,
      },
      labelBgStyle: {
        fill: '#ffffff',
        fillOpacity: 0.94,
      },
      labelBgPadding: [4, 2] as [number, number],
      labelBgBorderRadius: 3,
      markerEnd: {
        type: MarkerType.ArrowClosed,
        width: 16,
        height: 16,
        color: style.stroke,
      },
      ariaLabel:
        edge.relationshipType === 'relatedPathway'
          ? 'Related pathway relationship'
          : edge.relationshipType === 'primaryPathway'
            ? 'Primary pathway relationship'
            : 'Causal relationship',
    }
  })
}

export function TheoryOfChangeGraph({ graph }: { graph: TocGraphModel }) {
  const graphContainerRef = useRef<HTMLDivElement>(null)
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [fullScreen, setFullScreen] = useState(false)
  const positioned = useMemo(() => layoutTheoryOfChangeGraph(graph), [graph])
  const selectNode = useCallback((nodeId: string) => {
    setSelectedNodeId(nodeId)
  }, [])
  const nodes = useMemo<TocCanvasNode[]>(() => {
    const laneBands: TocLaneBandNode[] = positioned.lanes.map((lane) => ({
      id: lane.id,
      type: 'group',
      className: `toc-lane-band ${lane.alternate ? 'is-alternate' : ''} ${
        lane.custom ? 'is-custom' : ''
      }`,
      position: { x: 12, y: lane.y },
      width: positioned.canvas.width - 24,
      height: lane.height,
      draggable: false,
      selectable: false,
      focusable: false,
      zIndex: -10,
      data: { label: '' },
    }))
    const graphNodes: TocFlowNode[] = positioned.nodes.map((item) => ({
      id: item.node.id,
      type: 'tocNode',
      position: item.position,
      width: item.width,
      height: item.height,
      draggable: false,
      selectable: false,
      focusable: false,
      data: {
        tocNode: item.node,
        onSelect: selectNode,
      },
    }))
    return [...laneBands, ...graphNodes]
  }, [positioned, selectNode])
  const edges = useMemo(
    () => toFlowEdges(graph, positioned),
    [graph, positioned],
  )
  const selectedNode =
    graph.nodes.find((node) => node.id === selectedNodeId) ?? null

  useEffect(() => {
    const handleFullScreenChange = () => {
      setFullScreen(document.fullscreenElement === graphContainerRef.current)
    }
    document.addEventListener('fullscreenchange', handleFullScreenChange)
    return () =>
      document.removeEventListener('fullscreenchange', handleFullScreenChange)
  }, [])

  const closeDetails = useCallback(() => {
    const previousNodeId = selectedNodeId
    setSelectedNodeId(null)
    if (previousNodeId) {
      window.requestAnimationFrame(() => {
        graphContainerRef.current
          ?.querySelector<HTMLElement>(`[data-toc-node-id="${previousNodeId}"]`)
          ?.focus()
      })
    }
  }, [selectedNodeId])

  const toggleFullScreen = async () => {
    if (document.fullscreenElement) {
      await document.exitFullscreen()
    } else {
      await graphContainerRef.current?.requestFullscreen()
    }
  }

  return (
    <div
      className={`toc-workspace ${selectedNode ? 'has-detail' : ''}`}
      ref={graphContainerRef}
    >
      <div className="toc-graph-column">
        <div className="toc-graph-toolbar">
          <p>
            Read each pathway from left to right. Intermediate Outcome steps
            progress downward within each pathway lane.
          </p>
          {typeof document.documentElement.requestFullscreen === 'function' && (
            <button
              className="button secondary"
              type="button"
              onClick={() => void toggleFullScreen()}
              aria-label={
                fullScreen
                  ? 'Exit Theory of Change full screen'
                  : 'View Theory of Change full screen'
              }
            >
              {fullScreen ? 'Exit full screen' : 'Full screen'}
            </button>
          )}
        </div>
        <div
          className="toc-column-headings"
          role="group"
          aria-label="Theory of Change columns"
        >
          <span>Pathway</span>
          <span>Intermediate Outcomes</span>
          <span>Final Outcomes</span>
          <span>Impacts</span>
        </div>
        <div
          className="toc-graph-canvas"
          aria-label="Generated Theory of Change graph"
        >
          <ReactFlow<TocCanvasNode, TocFlowEdge>
            key={`toc-lane-layout:v3:${graph.frameworkVersion}:${graph.nodes.length}`}
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            nodesDraggable={false}
            nodesConnectable={false}
            nodesFocusable={false}
            edgesFocusable={false}
            edgesReconnectable={false}
            elementsSelectable={false}
            onInit={(instance) => {
              void instance.setViewport({ x: 8, y: 8, zoom: 0.72 })
            }}
            deleteKeyCode={null}
            selectionKeyCode={null}
            multiSelectionKeyCode={null}
            panOnDrag
            panOnScroll
            zoomOnScroll
            zoomOnPinch
            zoomOnDoubleClick={false}
            minZoom={0.12}
            maxZoom={1.6}
            defaultViewport={{ x: 8, y: 8, zoom: 0.72 }}
            aria-label="Read-only Theory of Change causal graph"
          >
            <Controls
              showInteractive={false}
              position="bottom-left"
              fitViewOptions={{ padding: 0.08, minZoom: 0.12, maxZoom: 1 }}
            />
          </ReactFlow>
        </div>
      </div>
      <TheoryOfChangeDetails node={selectedNode} onClose={closeDetails} />
    </div>
  )
}
