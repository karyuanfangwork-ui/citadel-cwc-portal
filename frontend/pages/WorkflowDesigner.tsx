import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import workflowVersionService, { type GraphEdge, type GraphNode, type WorkflowSummary, type WorkflowVersionDetail, type WorkflowVersionSummary } from '../src/services/workflow-version.service';
import { useWorkflowGraph } from '../src/hooks/useWorkflowGraph';
import WorkflowCanvas from '../src/components/workflow/WorkflowCanvas';
import StatusPalette from '../src/components/workflow/StatusPalette';
import NodeInspector from '../src/components/workflow/NodeInspector';
import EdgeInspector from '../src/components/workflow/EdgeInspector';
import ValidationPanel from '../src/components/workflow/ValidationPanel';
import PublishDialog from '../src/components/workflow/PublishDialog';
import VersionHistoryPanel from '../src/components/workflow/VersionHistoryPanel';

export default function WorkflowDesigner() {
  const navigate = useNavigate();
  const { workflowTypeId, versionId } = useParams();
  const [detail, setDetail] = useState<WorkflowVersionDetail | null>(null);
  const [workflow, setWorkflow] = useState<WorkflowSummary | null>(null);
  const [versions, setVersions] = useState<WorkflowVersionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [publishOpen, setPublishOpen] = useState(false);
  const [lifecycleBusy, setLifecycleBusy] = useState(false);

  const load = async () => {
    if (!versionId || !workflowTypeId) { setError('Invalid workflow route'); setLoading(false); return; }
    setLoading(true); setError(null);
    try {
      const [nextDetail, workflowResult, versionResult] = await Promise.all([
        workflowVersionService.getVersion(versionId),
        workflowVersionService.listWorkflows(),
        workflowVersionService.listVersions(workflowTypeId),
      ]);
      setDetail(nextDetail);
      setWorkflow(workflowResult.workflows.find((item) => item.id === workflowTypeId) ?? null);
      setVersions(versionResult.versions);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to load workflow version');
    } finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, [versionId, workflowTypeId]);

  const readOnly = detail?.version.status !== 'DRAFT';
  const graph = useWorkflowGraph(versionId ?? '', detail?.graph ?? { nodes: [], edges: [] }, readOnly);
  const selectedNode = graph.nodes.find((node) => node.id === graph.selectedNodeId)?.data as GraphNode | undefined;
  const selectedEdge = graph.edges.find((edge) => edge.id === graph.selectedEdgeId)?.data as unknown as GraphEdge | undefined;
  const existingCodes = useMemo(() => new Set(graph.nodes.map((node) => node.data.statusCode).filter((code): code is string => Boolean(code))), [graph.nodes]);

  const publish = async () => { if (!versionId) return; setLifecycleBusy(true); try { await workflowVersionService.publishVersion(versionId); setPublishOpen(false); await load(); } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to publish workflow'); } finally { setLifecycleBusy(false); } };
  const rollback = async (version: WorkflowVersionSummary) => { if (!window.confirm(`Rollback to workflow version ${version.version}?`)) return; setLifecycleBusy(true); try { await workflowVersionService.rollbackVersion(version.id); await load(); } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to roll back workflow'); } finally { setLifecycleBusy(false); } };
  const discard = async (version: WorkflowVersionSummary) => { if (!window.confirm(`Discard workflow draft v${version.version}?`)) return; setLifecycleBusy(true); try { await workflowVersionService.discardDraft(version.id); navigate('/admin/workflows'); } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to discard draft'); } finally { setLifecycleBusy(false); } };
  const focusFinding = (finding: { nodeId?: string; edgeId?: string }) => { if (finding.nodeId) graph.selectNode(finding.nodeId); if (finding.edgeId) graph.selectEdge(finding.edgeId); };

  if (loading) return <div className="flex min-h-[calc(100vh-8rem)] items-center justify-center text-sm text-[#44546f]" role="status">Loading workflow version…</div>;
  if (error || !detail || !workflow) return <div className="mx-auto max-w-2xl p-10 text-center"><p className="font-semibold text-[#b42318]" role="alert">{error || 'Workflow version not found'}</p><button className="mt-4 rounded-lg bg-[#0052cc] px-4 py-2 text-sm font-semibold text-white" onClick={() => void load()}>Retry</button></div>;

  return <section className="flex min-h-[calc(100vh-8rem)] flex-col bg-[#f7f9fc]" data-testid="workflow-designer-page">
    <header className="border-b border-[#dbe3ef] bg-white px-6 py-4"><div className="mx-auto flex max-w-[1800px] items-center justify-between gap-4"><div><Link className="text-xs font-semibold text-[#0052cc] hover:underline" to="/admin/workflows">← Workflow Designer</Link><div className="mt-2 flex items-center gap-3"><h1 className="text-2xl font-black tracking-tight text-[#101418]">{workflow.name}</h1><span className="rounded-full bg-[#f0f3f8] px-2.5 py-1 text-xs font-bold text-[#44546f]">v{detail.version.version} · {detail.version.status}</span></div><p className="mt-1 text-xs text-[#44546f]">{workflow.code} · affects {workflow.requestTypes.length} request type{workflow.requestTypes.length === 1 ? '' : 's'}</p></div><div className="flex flex-wrap items-center justify-end gap-2"><span className={`text-xs font-semibold ${graph.saving ? 'text-[#8a5a00]' : graph.dirty ? 'text-[#8a5a00]' : 'text-[#18794e]'}`}>{graph.saving ? 'Saving…' : graph.dirty ? 'Unsaved changes' : graph.lastSavedAt ? 'Saved' : 'Loaded'}</span><button className="rounded-lg border border-[#b9c8de] px-3 py-2 text-sm font-semibold text-[#334a70]" onClick={() => void graph.validate()}>Validate</button>{detail.version.status === 'DRAFT' && <><button className="rounded-lg bg-[#0052cc] px-3 py-2 text-sm font-semibold text-white disabled:opacity-50" disabled={graph.blockingFindings.length > 0 || graph.dirty || lifecycleBusy} onClick={() => setPublishOpen(true)}>Publish</button><button className="rounded-lg border border-[#f2b8b5] px-3 py-2 text-sm font-semibold text-[#b42318]" disabled={lifecycleBusy} onClick={() => void discard(detail.version)}>Discard draft</button></>}{detail.version.status === 'ARCHIVED' && <button className="rounded-lg bg-[#8a5a00] px-3 py-2 text-sm font-semibold text-white" disabled={lifecycleBusy} onClick={() => void rollback(detail.version)}>Rollback</button>}</div></div></header>
    {graph.saveError && <div className="border-b border-[#f2b8b5] bg-[#fff0f0] px-6 py-2 text-sm font-semibold text-[#b42318]" role="alert">{graph.saveError} <button className="ml-3 underline" onClick={graph.retrySave}>Retry</button></div>}
    <div className="grid min-h-0 flex-1 grid-cols-[250px_minmax(0,1fr)_310px] gap-px bg-[#dbe3ef]"><aside className="overflow-auto bg-white p-5"><h2 className="mb-4 text-xs font-bold uppercase tracking-[0.16em] text-[#8993a4]">Status palette</h2><StatusPalette existingCodes={existingCodes} readOnly={readOnly} onAdd={graph.addNode} /><div className="mt-8 border-t border-[#dbe3ef] pt-5"><h2 className="mb-3 text-xs font-bold uppercase tracking-[0.16em] text-[#8993a4]">Version history</h2><VersionHistoryPanel versions={versions} currentId={detail.version.id} onOpen={(id) => navigate(`/admin/workflows/${workflowTypeId}/versions/${id}`)} onRollback={(version) => void rollback(version)} onDiscard={(version) => void discard(version)} /></div></aside><main className="min-h-0"><WorkflowCanvas nodes={graph.nodes} edges={graph.edges} readOnly={readOnly} onNodesChange={graph.onNodesChange} onEdgesChange={graph.onEdgesChange} onConnect={graph.onConnect} onNodeClick={(_event, node) => { graph.selectNode(node.id); graph.selectEdge(null); }} onEdgeClick={(_event, edge) => { graph.selectEdge(edge.id); graph.selectNode(null); }} /></main><aside className="overflow-auto bg-white p-5"><h2 className="mb-4 text-xs font-bold uppercase tracking-[0.16em] text-[#8993a4]">{graph.selectedNodeId ? 'Node inspector' : graph.selectedEdgeId ? 'Edge inspector' : 'Inspector'}</h2>{graph.selectedNodeId ? <NodeInspector node={selectedNode ?? null} readOnly={readOnly} onChange={(patch) => graph.updateNode(graph.selectedNodeId!, patch)} onDelete={() => graph.removeNode(graph.selectedNodeId!)} /> : <EdgeInspector edge={selectedEdge ?? null} readOnly={readOnly} onChange={(patch) => graph.updateEdge(graph.selectedEdgeId!, patch)} onDelete={() => graph.removeEdge(graph.selectedEdgeId!)} />}</aside></div>
    <ValidationPanel blocking={graph.blockingFindings} warnings={graph.warnings} onFocus={focusFinding} />
    {publishOpen && <PublishDialog workflow={workflow} version={detail.version} blocking={graph.blockingFindings} warnings={graph.warnings} busy={lifecycleBusy} onClose={() => setPublishOpen(false)} onConfirm={() => void publish()} />}
  </section>;
}
