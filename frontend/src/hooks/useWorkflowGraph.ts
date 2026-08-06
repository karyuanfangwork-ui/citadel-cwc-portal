import { useCallback, useEffect, useRef, useState } from 'react';
import {
  applyEdgeChanges,
  applyNodeChanges,
  type Connection,
  type Edge,
  type EdgeChange,
  type Node,
  type NodeChange,
} from '@xyflow/react';
import workflowVersionService, {
  type GraphEdge,
  type GraphNode,
  type RemapPlan,
  type ValidationResult,
  type WorkflowGraph,
} from '../services/workflow-version.service';
import { fromReactFlowGraph, toReactFlowGraph, type WorkflowNodeData } from '../utils/workflowLayout';

export interface WorkflowGraphState {
  nodes: Node<WorkflowNodeData>[];
  edges: Edge[];
  dirty: boolean;
  saving: boolean;
  lastSavedAt: Date | null;
  saveError: string | null;
  selectedNodeId: string | null;
  selectedEdgeId: string | null;
  blockingFindings: ValidationResult['blocking'];
  warnings: ValidationResult['warnings'];
  remapPlan: RemapPlan | null;
  readOnly: boolean;
  onNodesChange: (changes: NodeChange<Node<WorkflowNodeData>>[]) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;
  onConnect: (connection: Connection) => void;
  addNode: (node: GraphNode) => void;
  updateNode: (id: string, patch: Partial<GraphNode>) => void;
  updateEdge: (id: string, patch: Partial<GraphEdge>) => void;
  removeNode: (id: string) => void;
  removeEdge: (id: string) => void;
  selectNode: (id: string | null) => void;
  selectEdge: (id: string | null) => void;
  validate: () => Promise<ValidationResult | null>;
  retrySave: () => void;
}

const defaultEdge = (connection: Connection): Edge => ({
  id: globalThis.crypto.randomUUID(),
  source: connection.source!,
  target: connection.target!,
  type: 'workflow',
  data: {
    id: '',
    fromNodeId: connection.source!,
    toNodeId: connection.target!,
    transitionLabel: null,
    requiresComment: false,
    autoAssignRole: null,
    autoAssignUserId: null,
    allowedRoles: [],
    allowedExecutiveRoles: [],
  },
});

export function useWorkflowGraph(versionId: string, graph: WorkflowGraph, readOnly: boolean, initialRemapPlan: RemapPlan | null = null): WorkflowGraphState {
  const initial = toReactFlowGraph(graph);
  const [nodes, setNodes] = useState<Node<WorkflowNodeData>[]>(initial.nodes);
  const [edges, setEdges] = useState<Edge[]>(initial.edges);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [selectedNodeId, selectNode] = useState<string | null>(null);
  const [selectedEdgeId, selectEdge] = useState<string | null>(null);
  const [validation, setValidation] = useState<ValidationResult>({ blocking: [], warnings: [] });
  const [remapPlan, setRemapPlan] = useState<RemapPlan | null>(initialRemapPlan);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mutationRef = useRef(0);
  const dirtyRef = useRef(false);
  const removedNodesRef = useRef<string[]>([]);
  const removedEdgesRef = useRef<string[]>([]);
  const latestGraph = useRef({ nodes, edges });

  useEffect(() => {
    const next = toReactFlowGraph(graph);
    setNodes(next.nodes);
    setEdges(next.edges);
    latestGraph.current = next;
    setDirty(false);
    dirtyRef.current = false;
    removedNodesRef.current = [];
    removedEdgesRef.current = [];
    setSaveError(null);
    setValidation({ blocking: [], warnings: [] });
    setRemapPlan(initialRemapPlan);
  }, [versionId, graph, initialRemapPlan]);

  useEffect(() => {
    latestGraph.current = { nodes, edges };
  }, [nodes, edges]);

  const save = useCallback(async () => {
    if (readOnly || !dirtyRef.current) return;
    const mutation = ++mutationRef.current;
    const snapshot = fromReactFlowGraph(latestGraph.current.nodes, latestGraph.current.edges);
    setSaving(true);
    setSaveError(null);
    try {
      await workflowVersionService.updateNodes(versionId, { upsert: snapshot.nodes, remove: removedNodesRef.current });
      await workflowVersionService.updateEdges(versionId, { upsert: snapshot.edges, remove: removedEdgesRef.current });
      if (mutation !== mutationRef.current) return;
      setDirty(false);
      dirtyRef.current = false;
      removedNodesRef.current = [];
      removedEdgesRef.current = [];
      setSaving(false);
      setLastSavedAt(new Date());
      const result = await workflowVersionService.validateVersion(versionId);
      if (mutation === mutationRef.current) {
        setValidation(result.validation);
        setRemapPlan(result.remapPlan);
      }
    } catch (error) {
      if (mutation !== mutationRef.current) return;
      setSaving(false);
      setSaveError(error instanceof Error ? error.message : 'Unable to save workflow changes');
    }
  }, [readOnly, versionId]);

  const scheduleSave = useCallback(() => {
    if (readOnly) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => { void save(); }, 500);
  }, [readOnly, save]);

  const markChanged = useCallback(() => {
    if (!readOnly) {
      setDirty(true);
      dirtyRef.current = true;
      scheduleSave();
    }
  }, [readOnly, scheduleSave]);

  const onNodesChange = useCallback((changes: NodeChange<Node<WorkflowNodeData>>[]) => {
    if (readOnly) return;
    setNodes((current) => applyNodeChanges(changes, current));
    markChanged();
  }, [markChanged, readOnly]);

  const onEdgesChange = useCallback((changes: EdgeChange[]) => {
    if (readOnly) return;
    setEdges((current) => applyEdgeChanges(changes, current));
    markChanged();
  }, [markChanged, readOnly]);

  const onConnect = useCallback((connection: Connection) => {
    if (readOnly || !connection.source || !connection.target || connection.source === connection.target) return;
    const edge = defaultEdge(connection);
    setEdges((current) => [...current, edge]);
    markChanged();
  }, [markChanged, readOnly]);

  const addNode = useCallback((node: GraphNode) => {
    if (readOnly) return;
    setNodes((current) => {
      const nextDisplayOrder = Math.max(-1, ...current.map((item) => item.data.displayOrder ?? -1)) + 1;
      const data = { ...node, displayOrder: node.displayOrder ?? nextDisplayOrder };
      return [...current, { id: node.id, type: 'status', position: { x: node.positionX ?? 0, y: node.positionY ?? 0 }, data }];
    });
    markChanged();
  }, [markChanged, readOnly]);

  const updateNode = useCallback((id: string, patch: Partial<GraphNode>) => {
    if (readOnly) return;
    setNodes((current) => current.map((node) => node.id === id ? { ...node, data: { ...node.data, ...patch } } : node));
    markChanged();
  }, [markChanged, readOnly]);

  const updateEdge = useCallback((id: string, patch: Partial<GraphEdge>) => {
    if (readOnly) return;
    setEdges((current) => current.map((edge) => {
      if (edge.id !== id) return edge;
      const nextData = { ...(edge.data as object), ...patch };
      return Object.prototype.hasOwnProperty.call(patch, 'transitionLabel')
        ? { ...edge, data: nextData, label: patch.transitionLabel ?? undefined }
        : { ...edge, data: nextData };
    }));
    markChanged();
  }, [markChanged, readOnly]);

  const removeNode = useCallback((id: string) => {
    if (readOnly) return;
    setNodes((current) => current.filter((node) => node.id !== id));
    setEdges((current) => current.filter((edge) => edge.source !== id && edge.target !== id));
    removedNodesRef.current = [...new Set([...removedNodesRef.current, id])];
    markChanged();
  }, [markChanged, readOnly]);

  const removeEdge = useCallback((id: string) => {
    if (readOnly) return;
    setEdges((current) => current.filter((edge) => edge.id !== id));
    removedEdgesRef.current = [...new Set([...removedEdgesRef.current, id])];
    markChanged();
  }, [markChanged, readOnly]);

  const validate = useCallback(async () => {
    try {
      const result = await workflowVersionService.validateVersion(versionId);
      setValidation(result.validation);
      setRemapPlan(result.remapPlan);
      return result.validation;
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Unable to validate workflow');
      return null;
    }
  }, [versionId]);

  return {
    nodes,
    edges,
    dirty,
    saving,
    lastSavedAt,
    saveError,
    selectedNodeId,
    selectedEdgeId,
    blockingFindings: validation.blocking,
    warnings: validation.warnings,
    remapPlan,
    readOnly,
    onNodesChange,
    onEdgesChange,
    onConnect,
    addNode,
    updateNode,
    updateEdge,
    removeNode,
    removeEdge,
    selectNode,
    selectEdge,
    validate,
    retrySave: () => { void save(); },
  };
}
