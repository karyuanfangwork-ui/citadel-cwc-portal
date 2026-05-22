import React, { useCallback, useEffect, useRef, useState } from 'react';
import creditService, {
  CreditApplication,
  CashflowProjection,
  SensitivityScenario,
  ProjectionScenario,
} from '../../../src/services/credit.service';
import CaMemoSection from '../../../src/components/credit/CaMemoSection';
import { CashflowProjectionChart, SensitivityScenarioChart, DscrTrendLine, GearingRatioLine } from '../../../src/components/credit/FinancialCharts';
import useAutosave from '../../../src/hooks/useAutosave';

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
  onDirtyChange?: (dirty: boolean) => void;
};

// ─── Way Out section ──────────────────────────────────────────────────────────

const WayOutSection: React.FC<{
  application: CreditApplication;
  readOnly: boolean;
  onUpdated: (next: CreditApplication) => void;
  autosave: ReturnType<typeof useAutosave<void>>;
  onMarkDirty: (key: string) => void;
  syncRef: React.MutableRefObject<Record<string, string>>;
}> = ({ application, readOnly, onUpdated, autosave, onMarkDirty, syncRef }) => {
  const [form, setForm] = useState({
    firstWayOut: application.firstWayOut ?? '',
    secondWayOut: application.secondWayOut ?? '',
    otherWayOut: application.otherWayOut ?? '',
  });

  useEffect(() => {
    setForm({
      firstWayOut: application.firstWayOut ?? '',
      secondWayOut: application.secondWayOut ?? '',
      otherWayOut: application.otherWayOut ?? '',
    });
    syncRef.current = {
      firstWayOut: application.firstWayOut ?? '',
      secondWayOut: application.secondWayOut ?? '',
      otherWayOut: application.otherWayOut ?? '',
    };
  }, [application.id, application.updatedAt]);

  const update = (key: string, value: string) => {
    setForm(f => ({ ...f, [key]: value }));
    (syncRef.current as any)[key] = value;
    onMarkDirty(key);
  };

  const textareaProps = (key: string) => ({
    className: 'w-full border rounded px-3 py-2 text-sm resize-none h-24',
    value: (form as any)[key],
    onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => update(key, e.target.value),
    onBlur: () => autosave.save(),
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

const ProjectionSection: React.FC<{
  appId: string;
  readOnly: boolean;
  autosave: ReturnType<typeof useAutosave<void>>;
  onMarkDirty: () => void;
  syncRef: React.MutableRefObject<{ cells: CellMap; assumptions: string }>;
}> = ({ appId, readOnly, autosave, onMarkDirty, syncRef }) => {
  const [projection, setProjection] = useState<CashflowProjection | null>(null);
  const [cells, setCells] = useState<CellMap>({});
  const [assumptions, setAssumptions] = useState('');

  useEffect(() => {
    creditService.getCashflowProjection(appId).then(p => {
      if (p) {
        setProjection(p);
        setAssumptions(p.assumptions ?? '');
        syncRef.current.assumptions = p.assumptions ?? '';
        const map: CellMap = {};
        p.lineItems.forEach(li => { map[`${li.lineKey}_${li.projectionYear}` as CellKey] = String(li.amount); });
        setCells(map);
        syncRef.current.cells = map;
      }
    });
  }, [appId]);

  const updateCell = (lineKey: string, year: number, value: string) => {
    const key = `${lineKey}_${year}` as CellKey;
    setCells(c => {
      const next = { ...c, [key]: value };
      syncRef.current.cells = next;
      return next;
    });
    onMarkDirty();
  };

  // Chart data: derive ProjectionLine[] from cells
  const chartLines = PROJECTION_LINES.map(line => ({
    lineKey: line.key,
    label: line.label,
    values: Object.fromEntries(
      [1, 2, 3, 4, 5].map(y => [y, Number(cells[`${line.key}_${y}` as CellKey]) || 0])
    ),
  }));

  return (
    <section>
      <CashflowProjectionChart lines={chartLines} />
      <DscrTrendLine lines={chartLines} />
      <GearingRatioLine lines={chartLines} />
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
                            onBlur={() => autosave.save()}
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
          : <textarea className="w-full border rounded px-3 py-2 text-sm resize-none h-20" value={assumptions} onChange={e => { setAssumptions(e.target.value); syncRef.current.assumptions = e.target.value; onMarkDirty(); }} onBlur={() => autosave.save()} placeholder="Describe projection assumptions…" />}
      </div>
    </section>
  );
};

// ─── Sensitivity Scenarios section ───────────────────────────────────────────

const SensitivitySection: React.FC<{
  appId: string;
  readOnly: boolean;
  autosave: ReturnType<typeof useAutosave<void>>;
  onMarkDirty: (scenario: ProjectionScenario) => void;
  syncRef: React.MutableRefObject<Record<ProjectionScenario, Partial<SensitivityScenario>>>;
}> = ({ appId, readOnly, autosave, onMarkDirty, syncRef }) => {
  const [local, setLocal] = useState<Record<ProjectionScenario, Partial<SensitivityScenario>>>({
    BASE: {}, SCENARIO_1: {}, SCENARIO_2: {}, SCENARIO_3: {},
  });

  useEffect(() => {
    creditService.listSensitivityScenarios(appId).then(scenarios => {
      setLocal(prev => {
        const next = { ...prev };
        scenarios.forEach(s => { next[s.scenario] = s; });
        syncRef.current = next;
        return next;
      });
    });
  }, [appId]);

  const update = (scenario: ProjectionScenario, key: keyof SensitivityScenario, value: string) => {
    setLocal(l => {
      const next = { ...l, [scenario]: { ...l[scenario], [key]: value } };
      syncRef.current = next;
      return next;
    });
    onMarkDirty(scenario);
  };

  // Chart data: derive ScenarioData[] from local
  const scenarioChartData = SCENARIOS.map(({ scenario, label }) => ({
    scenario,
    label: (local[scenario]?.label as string) || label,
    revenueAmount: local[scenario]?.revenueAmount ?? null,
    opCashflow: local[scenario]?.opCashflow ?? null,
    ebitda: local[scenario]?.ebitda ?? null,
    financingCosts: local[scenario]?.financingCosts ?? null,
    gearingRatio: local[scenario]?.gearingRatio ?? null,
    dscr: local[scenario]?.dscr ?? null,
  }));

  return (
    <section>
      <SensitivityScenarioChart scenarios={scenarioChartData} />
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
                    : <input className="border rounded px-2 py-1 text-sm w-48" placeholder="e.g. -20% Revenue" value={row.label ?? ''} onChange={e => update(scenario, 'label', e.target.value)} onBlur={() => autosave.save()} />}
                </div>
                {autosave.saving && <span className="text-xs text-gray-400">Saving…</span>}
              </div>
              <div className="grid grid-cols-3 gap-3 mb-3">
                {SCENARIO_COLS.map(({ key, label: colLabel }) => (
                  <div key={key}>
                    <label className="block text-xs text-gray-500 mb-1">{colLabel}</label>
                    {readOnly
                      ? <span className="text-sm">{row[key] != null ? String(row[key]) : '—'}</span>
                      : <input type="number" className="border rounded px-2 py-1 text-sm w-full" value={(row[key] as any) ?? ''} onChange={e => update(scenario, key, e.target.value)} onBlur={() => autosave.save()} placeholder="0.00" />}
                  </div>
                ))}
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Assumptions</label>
                {readOnly
                  ? <p className="text-sm text-gray-600">{row.assumptions ?? '—'}</p>
                  : <textarea className="w-full border rounded px-2 py-1 text-sm resize-none h-16" value={row.assumptions ?? ''} onChange={e => update(scenario, 'assumptions', e.target.value)} onBlur={() => autosave.save()} placeholder="Describe scenario assumptions…" />}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};

// ─── Main tab ─────────────────────────────────────────────────────────────────

type DirtySection = 'wayOut' | 'projection' | 'sensitivity';

const PaymentCapabilityTab: React.FC<Props> = ({ application, onUpdated, onDirtyChange }) => {
  const readOnly = application.state !== 'DRAFT';
  const dirtyKeys = useRef<Set<DirtySection>>(new Set());

  // Refs for sub-section state that the saveFn needs to read
  const wayOutRef = useRef<Record<string, string>>({
    firstWayOut: application.firstWayOut ?? '',
    secondWayOut: application.secondWayOut ?? '',
    otherWayOut: application.otherWayOut ?? '',
  });
  const wayOutDirtyKeys = useRef<Set<string>>(new Set());

  const projectionRef = useRef<{ cells: CellMap; assumptions: string }>({ cells: {}, assumptions: '' });

  const sensitivityRef = useRef<Record<ProjectionScenario, Partial<SensitivityScenario>>>({
    BASE: {}, SCENARIO_1: {}, SCENARIO_2: {}, SCENARIO_3: {},
  });
  const sensitivityDirtyScenarios = useRef<Set<ProjectionScenario>>(new Set());

  const onMarkDirtyWayOut = useCallback((key: string) => {
    dirtyKeys.current.add('wayOut');
    wayOutDirtyKeys.current.add(key);
    autosave.markDirty();
  }, []);

  const onMarkDirtyProjection = useCallback(() => {
    dirtyKeys.current.add('projection');
    autosave.markDirty();
  }, []);

  const onMarkDirtySensitivity = useCallback((scenario: ProjectionScenario) => {
    dirtyKeys.current.add('sensitivity');
    sensitivityDirtyScenarios.current.add(scenario);
    autosave.markDirty();
  }, []);

  // ── Autosave ────────────────────────────────────────────────────────────
  const autosave = useAutosave<void>({
    saveFn: async () => {
      if (readOnly || dirtyKeys.current.size === 0) return;
      const dirty = new Set(dirtyKeys.current);
      dirtyKeys.current.clear();

      if (dirty.has('wayOut')) {
        const payload: any = {};
        wayOutDirtyKeys.current.forEach(k => { payload[k] = wayOutRef.current[k] || null; });
        wayOutDirtyKeys.current.clear();
        const updated = await creditService.updateApplication(application.id, payload);
        onUpdated(updated);
      }

      if (dirty.has('projection')) {
        const { cells, assumptions } = projectionRef.current;
        const lines = PROJECTION_LINES.flatMap(line =>
          [1, 2, 3, 4, 5].map(y => ({
            lineKey: line.key,
            lineLabel: line.label,
            projectionYear: y,
            amount: cells[`${line.key}_${y}` as CellKey] || '0',
            displayOrder: line.order,
          })),
        );
        const saved = await creditService.upsertProjectionLines(application.id, lines);
        // Also save assumptions if changed
        await creditService.upsertCashflowProjection(application.id, assumptions || null);
      }

      if (dirty.has('sensitivity')) {
        const scenarios = new Set(sensitivityDirtyScenarios.current);
        sensitivityDirtyScenarios.current.clear();
        for (const scenario of scenarios) {
          const saved = await creditService.upsertSensitivityScenario(
            application.id,
            scenario,
            sensitivityRef.current[scenario],
          );
          // Update local ref with saved data
          sensitivityRef.current = { ...sensitivityRef.current, [scenario]: saved };
        }
      }
    },
    readOnly,
    debounceMs: 1500,
  });

  // Notify parent of dirty state changes (for useDirtyFormGuard)
  useEffect(() => {
    onDirtyChange?.(autosave.dirty);
  }, [autosave.dirty, onDirtyChange]);

  return (
    <CaMemoSection
      title="Payment Capability — Section 8"
      phase="Phase 3"
      readOnly={readOnly}
      saving={autosave.saving}
      savedAt={autosave.savedAt}
      error={autosave.error}
    >
      <div className="space-y-8">
        <WayOutSection application={application} readOnly={readOnly} onUpdated={onUpdated} autosave={autosave} onMarkDirty={onMarkDirtyWayOut} syncRef={wayOutRef} />
        <ProjectionSection appId={application.id} readOnly={readOnly} autosave={autosave} onMarkDirty={onMarkDirtyProjection} syncRef={projectionRef} />
        <SensitivitySection appId={application.id} readOnly={readOnly} autosave={autosave} onMarkDirty={onMarkDirtySensitivity} syncRef={sensitivityRef} />
      </div>
    </CaMemoSection>
  );
};

export default PaymentCapabilityTab;