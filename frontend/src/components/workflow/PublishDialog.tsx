import { useEffect, useMemo, useState } from 'react';
import type {
  GraphNode,
  RemapPlan,
  ValidationFinding,
  WorkflowSummary,
  WorkflowVersionSummary,
} from '../../services/workflow-version.service';

interface PublishDialogProps {
  workflow: WorkflowSummary;
  version: WorkflowVersionSummary;
  blocking: ValidationFinding[];
  warnings: ValidationFinding[];
  /** Stranded statuses needing a target, or null when nothing is stranded. */
  remapPlan: RemapPlan | null;
  /** Draft nodes — used to read the target's SLA pause flag. */
  nodes: GraphNode[];
  busy: boolean;
  publishError?: string | null;
  onConfirm: (statusRemap: Record<string, string>) => void;
  onClose: () => void;
}

export default function PublishDialog({
  workflow, version, blocking, warnings, remapPlan, nodes, busy, publishError, onConfirm, onClose,
}: PublishDialogProps) {
  const entries = remapPlan?.entries ?? [];
  const needsRemap = entries.length > 0;

  const [step, setStep] = useState<1 | 2>(needsRemap ? 1 : 2);
  const [selections, setSelections] = useState<Record<string, string>>(() =>
    Object.fromEntries(entries.filter((e) => e.suggestedTarget).map((e) => [e.statusCode, e.suggestedTarget as string])),
  );
  const [accepted, setAccepted] = useState(warnings.length === 0);
  const [remapAccepted, setRemapAccepted] = useState(!needsRemap);

  useEffect(() => {
    if (publishError && needsRemap) setStep(1);
  }, [publishError, needsRemap]);

  const pausesSla = useMemo(
    () => new Map(nodes.filter((n) => n.statusCode).map((n) => [n.statusCode as string, n.slaPause])),
    [nodes],
  );

  // A stranded-status blocker is resolved by the mapping on step 1, so it must
  // not also disable the Publish button on step 2.
  const unresolvedBlocking = blocking.filter((f) => f.code !== 'STATUS_IN_USE_REMOVED');
  const allTargetsChosen = entries.every((entry) => Boolean(selections[entry.statusCode]));
  const movedCount = remapPlan?.totalRequests ?? 0;

  const shell = (children: React.ReactNode) => (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#101418]/40 p-4" role="presentation" onMouseDown={onClose}>
      <div className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-2xl" role="dialog" aria-modal="true" aria-labelledby="publish-title" onMouseDown={(event) => event.stopPropagation()}>
        {children}
      </div>
    </div>
  );

  if (step === 1) {
    return shell(
      <>
        <div className="flex items-baseline justify-between">
          <h2 id="publish-title" className="text-xl font-black text-[#101418]">Publish workflow v{version.version}</h2>
          <span className="text-xs font-bold text-[#44546f]">Step 1 of 2</span>
        </div>
        <p className="mt-2 text-sm text-[#44546f]">
          {entries.length} status{entries.length === 1 ? ' is' : 'es are'} being removed but still hold live requests.
          Choose where those requests should go.
        </p>
        {publishError && <p className="mt-3 rounded-lg bg-[#fff0f0] p-3 text-sm text-[#b42318]" role="alert">{publishError}</p>}
        <div className="mt-4 grid gap-4">
          {entries.map((entry) => {
            const chosen = selections[entry.statusCode] ?? '';
            const targetPauses = pausesSla.get(chosen) ?? false;
            const slaMismatch = Boolean(chosen) && entry.sourcePausesSla !== targetPauses;
            const selectId = `remap-${entry.statusCode}`;
            return (
              <div key={entry.statusCode} className="rounded-lg border border-[#dbe3ef] p-3">
                <div className="flex items-baseline justify-between">
                  <strong className="text-sm font-black text-[#101418]">{entry.statusCode}</strong>
                  <span className="text-xs text-[#44546f]">{entry.requestCount} request{entry.requestCount === 1 ? '' : 's'}</span>
                </div>
                <label className="mt-2 block text-xs font-semibold text-[#334a70]" htmlFor={selectId}>Move to</label>
                <select
                  id={selectId}
                  className="mt-1 w-full rounded-lg border border-[#b9c8de] px-3 py-2 text-sm"
                  value={chosen}
                  onChange={(event) => setSelections((current) => ({ ...current, [entry.statusCode]: event.target.value }))}
                >
                  <option value="">Choose a status…</option>
                  <optgroup label="Keeps the request open">
                    {entry.allowedTargets.filter((t) => !nodes.find((n) => n.statusCode === t)?.isFinal).map((target) => (
                      <option key={target} value={target}>{target}</option>
                    ))}
                  </optgroup>
                  <optgroup label="Closes the request">
                    {entry.allowedTargets.filter((t) => nodes.find((n) => n.statusCode === t)?.isFinal).map((target) => (
                      <option key={target} value={target}>{target}</option>
                    ))}
                  </optgroup>
                </select>
                <p className="mt-1 text-xs text-[#44546f]">{entry.suggestionReason}</p>
                {slaMismatch && (
                  <p className="mt-1 text-xs text-[#8a5a00]">
                    ⚠ {entry.statusCode} {entry.sourcePausesSla ? 'pauses' : 'does not pause'} SLA, {chosen} {targetPauses ? 'does' : 'does not'}.
                    Clocks are left untouched — this request&apos;s SLA state will not change.
                  </p>
                )}
              </div>
            );
          })}
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <button className="rounded-lg border border-[#b9c8de] px-4 py-2 text-sm font-semibold text-[#334a70]" onClick={onClose}>Cancel</button>
          <button
            className="rounded-lg bg-[#0052cc] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            disabled={!allTargetsChosen}
            onClick={() => setStep(2)}
          >
            Continue
          </button>
        </div>
      </>,
    );
  }

  return shell(
    <>
      <div className="flex items-baseline justify-between">
        <h2 id="publish-title" className="text-xl font-black text-[#101418]">Publish workflow v{version.version}</h2>
        {needsRemap && <span className="text-xs font-bold text-[#44546f]">Step 2 of 2</span>}
      </div>
      <p className="mt-2 text-sm text-[#44546f]">
        This will activate the new version of <strong>{workflow.name}</strong> for {workflow.requestTypes.length} request type{workflow.requestTypes.length === 1 ? '' : 's'}.
      </p>
      {unresolvedBlocking.length > 0 && (
        <div className="mt-4 rounded-lg bg-[#fff0f0] p-3 text-sm text-[#b42318]">
          <strong>Publishing is blocked.</strong> Resolve {unresolvedBlocking.length} blocking finding{unresolvedBlocking.length === 1 ? '' : 's'} first.
        </div>
      )}
      {warnings.length > 0 && (
        <label className="mt-4 flex gap-2 rounded-lg bg-[#fff4d6] p-3 text-sm text-[#8a5a00]">
          <input type="checkbox" checked={accepted} onChange={(event) => setAccepted(event.target.checked)} />
          I accept the {warnings.length} validation warning{warnings.length === 1 ? '' : 's'}.
        </label>
      )}
      {needsRemap && (
        <label className="mt-4 flex gap-2 rounded-lg bg-[#eef4ff] p-3 text-sm text-[#334a70]">
          <input type="checkbox" checked={remapAccepted} onChange={(event) => setRemapAccepted(event.target.checked)} />
          {movedCount} request{movedCount === 1 ? '' : 's'} will be moved when you publish.
        </label>
      )}
      <div className="mt-6 flex justify-end gap-3">
        {needsRemap && (
          <button className="mr-auto rounded-lg border border-[#b9c8de] px-4 py-2 text-sm font-semibold text-[#334a70]" onClick={() => setStep(1)}>Back</button>
        )}
        <button className="rounded-lg border border-[#b9c8de] px-4 py-2 text-sm font-semibold text-[#334a70]" onClick={onClose}>Cancel</button>
        <button
          className="rounded-lg bg-[#0052cc] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          disabled={busy || unresolvedBlocking.length > 0 || !accepted || !remapAccepted}
          onClick={() => onConfirm(needsRemap ? selections : {})}
        >
          {busy ? 'Publishing…' : 'Publish version'}
        </button>
      </div>
    </>,
  );
}