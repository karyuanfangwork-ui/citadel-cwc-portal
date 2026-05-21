import React, { useEffect, useRef, useState } from 'react';
import creditService, {
  CreditApplication,
  CashflowProjection,
  SensitivityScenario,
  ProjectionScenario,
} from '../../../src/services/credit.service';
import CaMemoSection from '../../../src/components/credit/CaMemoSection';

// ─── Constants ────────────────────────────────────────────────────────────────

const PROJECTION_LINES = [
  { key: 'revenue',      label: 'Revenue / Sales',     order: 1 },
  { key: 'total_inflow', label: 'Total Inflow',         order: 2 },
  { key: 'op_costs',     label: 'Operating Costs',      order: 3 },
  { key: 'net_cf',       label: 'Net Cashflow',         order: 4 },
  { key: 'dscr',         label: 'DSCR',                 order: 5 },
  { key: 'gearing',      label: 'Gearing Ratio',        order: 6 },
];

const SCENARIOS: { scenario: ProjectionScenario; label: string }[] = [
  { scenario: 'BASE',       label: 'Base Case' },
  { scenario: 'SCENARIO_1', label: 'Scenario 1' },
  { scenario: 'SCENARIO_2', label: 'Scenario 2' },
  { scenario: 'SCENARIO_3', label: 'Scenario 3' },
];

const SCENARIO_COLS: { key: keyof SensitivityScenario; label: string }[] = [
  { key: 'revenueAmount',  label: 'Revenue (RM)' },
  { key: 'opCashflow',     label: 'Op. CF (RM)' },
  { key: 'ebitda',         label: 'EBITDA (RM)' },
  { key: 'financingCosts', label: 'Fin. Costs (RM)' },
  { key: 'gearingRatio',   label: 'Gearing' },
  { key: 'dscr',           label: 'DSCR' },
];

type Props = {
  application: CreditApplication;
  onUpdated: (next: CreditApplication) => void;
};

// ─── Way Out section ──────────────────────────────────────────────────────────

const WayOutSection: React.FC<{ application: CreditApplication; readOnly: boolean; onUpdated: (next: CreditApplication) => void; onSaving?: (saving: boolean) => void; onSaved?: () => void }> = ({ application, readOnly, onUpdated, onSaving, onSaved }) => {
  const [form, setForm] = useState({
    firstWayOut: application.firstWayOut ?? '',
    secondWayOut: application.secondWayOut ?? '',
    otherWayOut: application.otherWayOut ?? '',
  });
  const dirty = useRef<Set<string>>(new Set());

  useEffect(() => {
    setForm({
      firstWayOut: application.firstWayOut ?? '',
      secondWayOut: application.secondWayOut ?? '',
      otherWayOut: application.otherWayOut ?? '',
    });
  }, [application.id, application.updatedAt]);

  const update = (key: string, value: string) => {
    setForm(f => ({ ...f, [key]: value }));
    dirty.current.add(key);
  };

  const flush = async () => {
    if (readOnly || dirty.current.size === 0) return;
    onSaving?.(true);
    const payload: any = {};
    dirty.current.forEach(k => { payload[k] = (form as any)[k] || null; });
    try {
      const updated = await creditService.updateApplication(application.id, payload);
      onUpdated(updated);
      onSaved?.();
      dirty.current.clear();
    } finally { onSaving?.(false); }
  };

  const textareaProps = (key: string) => ({
    className: 'w-full border rounded px-3 py-2 text-sm resize-none h-24',
    value: (form as any)[key],
    onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => update(key, e.target.value),
    onBlur: flush,
    readOnly,
  });

  return (
    <section>
      <div className="space-y-4">
        {[
          { key: 'firstWayOut',  label: 'First Way Out' },
          { key: 'secondWayOut', label: 'Second Way Out' },
          { key: 'otherWayOut',  label: 'Other Way Out' },
        ].map(({ key, label }) => (
          <div key={key}>
            <label className="block text-xs text-gray-500 mb-1">{label}</label>
            <textarea {...textareaProps(key)} />
          </div>
        ))}
      </div>
    </section>
  );
};

// ─── Cashflow Projection section ──────────────────────────────────────────────

type CellKey = `${string}_${number}`;
type CellMap = Record<CellKey, string>;

const ProjectionSection: React.FC<{ appId: string; readOnly: boolean; onSaving?: (saving: boolean) => void; onSaved?: () => void }> = ({ appId, readOnly, onSaving, onSaved }) => {
  const [projection, setProjection] = useState<CashflowProjection | null>(null);
  const [cells, setCells] = useState<CellMap>({});
  const [assumptions, setAssumptions] = useState('');
  const dirty = useRef(false);

  useEffect(() => {
    creditService.getCashflowProjection(appId).then(p => {
      if (p) {
        setProjection(p);
        setAssumptions(p.assumptions ?? '');
        const map: CellMap = {};
        p.lineItems.forEach(li => { map[`${li.lineKey}_${li.projectionYear}` as CellKey] = String(li.amount); });
        setCells(map);
      }
    });
  }, [appId]);

  const updateCell = (lineKey: string, year: number, value: string) => {
    setCells(c => ({ ...c, [`${lineKey}_${year}` as CellKey]: value }));
    dirty.current = true;
  };

  const flush = async () => {
    if (!dirty.current) return;
    onSaving?.(true);
    const lines = PROJECTION_LINES.flatMap(line =>
      [1, 2, 3, 4, 5].map(y => ({
        lineKey: line.key,
        lineLabel: line.label,
        projectionYear: y,
        amount: cells[`${line.key}_${y}` as CellKey] || '0',
        displayOrder: line.order,
      })),
    );
    try {
      const saved = await creditService.upsertProjectionLines(appId, lines);
      setProjection(saved);
      dirty.current = false;
      onSaved?.();
    } finally { onSaving?.(false); }
  };

  const flushAssumptions = async () => {
    await creditService.upsertCashflowProjection(appId, assumptions || null);
  };

  return (
    <section>
      <div className="border rounded-lg overflow-x-auto mb-4">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
            <tr>
              <th className="p-2 text-left w-40">Line Item</th>
              {[1, 2, 3, 4, 5].map(y => <th key={y} className="p-2 text-right">Y{y}</th>)}
            </tr>
          </thead>
          <tbody>
            {PROJECTION_LINES.map(line => (
              <tr key={line.key} className="border-t hover:bg-gray-50">
                <td className="p-2 text-sm font-medium">{line.label}</td>
                {[1, 2, 3, 4, 5].map(y => {
                  const val = cells[`${line.key}_${y}` as CellKey] ?? '';
                  return (
                    <td key={y} className="p-1 text-right">
                      {readOnly
                        ? <span className="text-sm">{val ? Number(val).toLocaleString('en-MY', { maximumFractionDigits: 2 }) : '—'}</span>
                        : <input
                            type="number"
                            className="border rounded px-1 py-0.5 text-sm w-28 text-right"
                            value={val}
                            onChange={e => updateCell(line.key, y, e.target.value)}
                            onBlur={flush}
                            placeholder="0"
                          />}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div>
        <label className="block text-xs text-gray-500 mb-1">Projection Assumptions</label>
        {readOnly
          ? <p className="text-sm whitespace-pre-wrap">{assumptions || '—'}</p>
          : <textarea className="w-full border rounded px-3 py-2 text-sm resize-none h-20" value={assumptions} onChange={e => setAssumptions(e.target.value)} onBlur={flushAssumptions} placeholder="Describe projection assumptions…" />}
      </div>
    </section>
  );
};

// ─── Sensitivity Scenarios section ───────────────────────────────────────────

const SensitivitySection: React.FC<{ appId: string; readOnly: boolean; onSaving?: (saving: boolean) => void; onSaved?: () => void }> = ({ appId, readOnly, onSaving, onSaved }) => {
  const [local, setLocal] = useState<Record<ProjectionScenario, Partial<SensitivityScenario>>>({
    BASE: {}, SCENARIO_1: {}, SCENARIO_2: {}, SCENARIO_3: {},
  });
  const [savingScenario, setSavingScenario] = useState<ProjectionScenario | null>(null);

  useEffect(() => {
    creditService.listSensitivityScenarios(appId).then(scenarios => {
      setLocal(prev => {
        const next = { ...prev };
        scenarios.forEach(s => { next[s.scenario] = s; });
        return next;
      });
    });
  }, [appId]);

  const update = (scenario: ProjectionScenario, key: keyof SensitivityScenario, value: string) => {
    setLocal(l => ({ ...l, [scenario]: { ...l[scenario], [key]: value } }));
  };

  const flush = async (scenario: ProjectionScenario) => {
    setSavingScenario(scenario);
    onSaving?.(true);
    try {
      const saved = await creditService.upsertSensitivityScenario(appId, scenario, local[scenario]);
      setLocal(l => ({ ...l, [scenario]: saved }));
      onSaved?.();
    } finally {
      setSavingScenario(null);
      onSaving?.(false);
    }
  };

  return (
    <section>
      <div className="space-y-4">
        {SCENARIOS.map(({ scenario, label }) => {
          const row = local[scenario];
          return (
            <div key={scenario} className="border rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-semibold">{label}</span>
                  {readOnly
                    ? <span className="text-sm text-gray-500">{row.label ?? ''}</span>
                    : <input className="border rounded px-2 py-1 text-sm w-48" placeholder="e.g. -20% Revenue" value={row.label ?? ''} onChange={e => update(scenario, 'label', e.target.value)} onBlur={() => flush(scenario)} />}
                </div>
                {savingScenario === scenario && <span className="text-xs text-gray-400">Saving…</span>}
              </div>
              <div className="grid grid-cols-3 gap-3 mb-3">
                {SCENARIO_COLS.map(({ key, label: colLabel }) => (
                  <div key={key}>
                    <label className="block text-xs text-gray-500 mb-1">{colLabel}</label>
                    {readOnly
                      ? <span className="text-sm">{row[key] != null ? String(row[key]) : '—'}</span>
                      : <input type="number" className="border rounded px-2 py-1 text-sm w-full" value={(row[key] as any) ?? ''} onChange={e => update(scenario, key, e.target.value)} onBlur={() => flush(scenario)} placeholder="0.00" />}
                  </div>
                ))}
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Assumptions</label>
                {readOnly
                  ? <p className="text-sm text-gray-600">{row.assumptions ?? '—'}</p>
                  : <textarea className="w-full border rounded px-2 py-1 text-sm resize-none h-16" value={row.assumptions ?? ''} onChange={e => update(scenario, 'assumptions', e.target.value)} onBlur={() => flush(scenario)} placeholder="Describe scenario assumptions…" />}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};

// ─── Main tab ─────────────────────────────────────────────────────────────────

const PaymentCapabilityTab: React.FC<Props> = ({ application, onUpdated }) => {
  const readOnly = application.state !== 'DRAFT';
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);

  const handleSaving = (s: boolean) => setSaving(s);
  const handleSaved = () => setSavedAt(new Date());

  return (
    <CaMemoSection
      title="Payment Capability — Section 8"
      phase="Phase 3"
      readOnly={readOnly}
      saving={saving}
      savedAt={savedAt}
    >
      <div className="space-y-8">
        <WayOutSection application={application} readOnly={readOnly} onUpdated={onUpdated} onSaving={handleSaving} onSaved={handleSaved} />
        <ProjectionSection appId={application.id} readOnly={readOnly} onSaving={handleSaving} onSaved={handleSaved} />
        <SensitivitySection appId={application.id} readOnly={readOnly} onSaving={handleSaving} onSaved={handleSaved} />
      </div>
    </CaMemoSection>
  );
};

export default PaymentCapabilityTab;
