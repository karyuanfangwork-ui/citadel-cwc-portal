import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import crmService from '../src/services/crm.service';
import { useAuth } from '../src/context/AuthContext';

type EntityType = 'LEAD' | 'CONTACT' | 'ACCOUNT' | 'OPPORTUNITY';
type ImportMode = 'create' | 'activity-update' | 'email-delivery-update';

const ENTITY_LABELS: Record<EntityType, string> = {
  LEAD: 'Leads',
  CONTACT: 'Contacts',
  ACCOUNT: 'Clients',
  OPPORTUNITY: 'Opportunities',
};

const ENTITY_ICONS: Record<EntityType, string> = {
  LEAD: 'lightbulb',
  CONTACT: 'person',
  ACCOUNT: 'groups',
  OPPORTUNITY: 'monetization_on',
};

type ImportStep = 'upload' | 'mapping' | 'validating' | 'importing' | 'complete';

interface FieldDef {
  key: string;
  label: string;
  required: boolean;
  type: string;
  enumValues?: string[];
  default?: unknown;
}

interface DuplicateDetail {
  row: number;
  matchedBy: string;
  matchedRow?: number;
  matchSource: 'existing lead' | 'earlier spreadsheet row';
}

const STEP_LABELS: Record<ImportStep, string> = {
  upload: 'Upload',
  mapping: 'Map Columns',
  validating: 'Validate',
  importing: 'Importing',
  complete: 'Complete',
};

const STEP_ORDER: ImportStep[] = ['upload', 'mapping', 'validating', 'importing', 'complete'];

const CrmImportExport = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const canImport = (user?.permissions || []).includes('crm:import');
  const canExport = (user?.permissions || []).includes('crm:export');


  // ── Tab state ──
  const [tab, setTab] = useState<'import' | 'export'>(() => {
    const param = searchParams.get('tab');
    return param === 'export' && canExport ? 'export' : canImport ? 'import' : 'export';
  });

  useEffect(() => {
    if (tab === 'import' && !canImport && canExport) setTab('export');
    if (tab === 'export' && !canExport && canImport) setTab('import');
  }, [tab, canImport, canExport]);

  // ── Import state ──
  const [entity, setEntity] = useState<EntityType>(() => {
    const param = searchParams.get('entity');
    return (['LEAD','CONTACT','ACCOUNT','OPPORTUNITY'].includes(String(param)) ? param : 'LEAD') as EntityType;
  });
  const [importMode, setImportMode] = useState<ImportMode>('create');

  // ── Sync URL params when entity or tab changes ──
  useEffect(() => {
    const params = new URLSearchParams();
    params.set('entity', entity);
    params.set('tab', tab);
    navigate(`/crm/import-export?${params.toString()}`, { replace: true });
  }, [entity, tab]);

  const [importStep, setImportStep] = useState<ImportStep>('upload');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [jobId, setJobId] = useState<string>('');
  const [preview, setPreview] = useState<Record<string, unknown>[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [suggestedMapping, setSuggestedMapping] = useState<Record<string, string>>({});
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});
  const [fieldDefs, setFieldDefs] = useState<FieldDef[]>([]);
  const [totalRows, setTotalRows] = useState(0);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ importedRows: number; activitiesCreated?: number; updatedRows?: number; skippedRows?: number; duplicateRows: number; duplicateDetails: DuplicateDetail[]; failedRows: number; errors: Array<{ row: number; error: string }> } | null>(null);
  const [validationResult, setValidationResult] = useState<{ valid: boolean; errors: Array<{ row: number; field: string; error: string }>; warnings: string[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expandedImportId, setExpandedImportId] = useState<string | null>(null);

  // ── Export state ──
  const [exportEntity, setExportEntity] = useState<EntityType>('LEAD');
  const [exportFormat, setExportFormat] = useState<'CSV' | 'XLSX'>('CSV');
  const [exporting, setExporting] = useState(false);
  const [exportHistory, setExportHistory] = useState<Record<string, unknown>[]>([]);
  const [importHistory, setImportHistory] = useState<Record<string, unknown>[]>([]);

  // ── Load field definitions when entity changes ──
  useEffect(() => {
    if (tab === 'import' && canImport) {
      setFieldDefs([]);
      setError(null);
      crmService.getFieldDefinitions(entity, entity === 'LEAD' ? importMode : 'create').then(res => {
        setFieldDefs(res.fields);
      }).catch((err: any) => {
        setError(err?.response?.data?.message || err?.message || 'Unable to load import column definitions');
      });
    }
  }, [entity, importMode, tab, canImport]);

  // ── Load histories ──
  useEffect(() => {
    if (canImport) crmService.getImportHistory().then(res => setImportHistory(res.jobs)).catch(() => {});
    if (canExport) crmService.getExportHistory().then(res => setExportHistory(res.jobs)).catch(() => {});
  }, [canImport, canExport]);

  // ── Drag & drop handlers ──
  const handleDragOver = useCallback((e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); }, []);
  const handleDragLeave = useCallback(() => setIsDragging(false), []);
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) { setSelectedFile(file); setError(null); }
  }, []);

  // ── File selection handler ──
  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) { setSelectedFile(file); setError(null); }
  }, []);

  // ── Upload + parse ──
  const handleUpload = useCallback(async () => {
    if (!selectedFile) return;
    setImporting(true);
    setError(null);
    try {
      const result = await crmService.uploadImportFile(selectedFile, entity, entity === 'LEAD' ? importMode : 'create');
      setJobId(result.jobId);
      setPreview(result.preview);
      setHeaders(result.headers);
      setSuggestedMapping(result.suggestedMapping);
      setColumnMapping(result.suggestedMapping);
      setTotalRows(result.totalRows);
      setImportStep('mapping');
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Upload failed');
    } finally {
      setImporting(false);
    }
  }, [selectedFile, entity, importMode]);

  // ── Validate ──
  const handleValidate = useCallback(async () => {
    setImporting(true);
    setError(null);
    try {
      const result = await crmService.validateImportMapping(jobId, columnMapping);
      setValidationResult(result);
      setImportStep('validating');
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Validation failed');
    } finally {
      setImporting(false);
    }
  }, [jobId, columnMapping]);

  // ── Execute import ──
  const handleExecuteImport = useCallback(async () => {
    setImporting(true);
    setError(null);
    setImportStep('importing');
    try {
      const result = await crmService.executeImport(jobId);
      setImportResult(result);
      setImportStep('complete');
      // Refresh history
      const hist = await crmService.getImportHistory();
      setImportHistory(hist.jobs);
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Import failed');
      setImportStep('validating');
    } finally {
      setImporting(false);
    }
  }, [jobId]);

  // ── Reset import ──
  const handleResetImport = useCallback(() => {
    setImportStep('upload');
    setSelectedFile(null);
    setJobId('');
    setPreview([]);
    setHeaders([]);
    setSuggestedMapping({});
    setColumnMapping({});
    setTotalRows(0);
    setImportResult(null);
    setValidationResult(null);
    setError(null);
  }, []);

  // ── Export handler ──
  const handleExport = useCallback(async () => {
    setExporting(true);
    setError(null);
    try {
      const result = await crmService.requestExport(exportEntity, null, exportFormat);
      const pollInterval = setInterval(async () => {
        try {
          const status = await crmService.getImportStatus(result.jobId);
          if (status.status === 'COMPLETED') {
            clearInterval(pollInterval);
            crmService.downloadExport(result.jobId);
            setExporting(false);
            const hist = await crmService.getExportHistory();
            setExportHistory(hist.jobs);
          } else if (status.status === 'FAILED') {
            clearInterval(pollInterval);
            setError('Export failed. Please try again.');
            setExporting(false);
          }
        } catch {
          // keep polling
        }
      }, 2000);
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Export failed');
      setExporting(false);
    }
  }, [exportEntity, exportFormat]);

  const currentStepIdx = STEP_ORDER.indexOf(importStep);

  return (
    <div className="min-h-screen bg-bg-subtle">

      <div className="max-w-[960px] mx-auto px-4 sm:px-6 lg:px-8 pb-12">
        {/* ── Page header ── */}
        <div className="flex items-center justify-between pt-6 pb-4">
          <div>
            <h1 className="text-xl font-bold text-text-primary">Import / Export</h1>
            <p className="text-sm text-text-secondary mt-1">Move data in and out of CWC CRM</p>
          </div>
          <span className="material-symbols-outlined text-[32px] text-brand-400">swap_horiz</span>
        </div>

        {/* ── Tabs ── */}
        <div className="flex gap-1 p-1 bg-bg-subtle rounded-cwc-lg mb-6">
          {(['import', 'export'] as const).filter(t => t === 'import' ? canImport : canExport).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-cwc-md text-sm font-semibold transition-colors ${
                tab === t
                  ? 'bg-surface text-brand-700 shadow-sm'
                  : 'text-text-secondary hover:text-text-primary hover:bg-surface/50'
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">{t === 'import' ? 'upload' : 'download'}</span>
              {t === 'import' ? 'Import Data' : 'Export Data'}
            </button>
          ))}
        </div>

        {/* ── Error alert ── */}
        {error && (
          <div className="mb-4 flex items-start gap-3 rounded-cwc-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-800">
            <span className="material-symbols-outlined text-red-500 mt-0.5">error</span>
            <span>{error}</span>
            <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-600" style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
              <span className="material-symbols-outlined text-[18px]">close</span>
            </button>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════
            IMPORT TAB
            ══════════════════════════════════════════════════════════════ */}
        {tab === 'import' && (
          <>
            {/* ── Stepper ── */}
            <div className="flex items-center gap-0 mb-6 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
              {STEP_ORDER.map((step, i) => {
                const isDone = i < currentStepIdx;
                const isCurrent = step === importStep;
                return (
                  <React.Fragment key={step}>
                    <div className="flex items-center gap-2 shrink-0">
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                        isDone ? 'bg-brand-600 text-white'
                          : isCurrent ? 'bg-brand-600 text-white'
                          : 'bg-bg-subtle text-text-secondary border border-border'
                      }`}>
                        {isDone ? <span className="material-symbols-outlined text-[14px]">check</span> : i + 1}
                      </div>
                      <span className={`text-xs font-medium whitespace-nowrap ${
                        isDone || isCurrent ? 'text-brand-700' : 'text-text-secondary'
                      }`}>{STEP_LABELS[step]}</span>
                    </div>
                    {i < STEP_ORDER.length - 1 && (
                      <div className={`flex-1 h-0.5 mx-2 ${i < currentStepIdx ? 'bg-brand-600' : 'bg-border'}`} />
                    )}
                  </React.Fragment>
                );
              })}
            </div>

            {/* ── Upload step ── */}
            {importStep === 'upload' && (
              <div className="bg-surface rounded-cwc-xl border border-border p-6">
                <h3 className="text-base font-bold text-text-primary mb-4">Select Entity & Upload File</h3>

                {/* Entity selector */}
                <div className="mb-4">
                  <label className="block text-sm font-semibold text-text-primary mb-1.5">Entity type</label>
                  <div className="flex flex-wrap gap-2">
                    {(Object.entries(ENTITY_LABELS) as [EntityType, string][]).map(([key, label]) => (
                      <button
                        key={key}
                        onClick={() => setEntity(key)}
                        className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-cwc-md text-sm font-medium transition-colors ${
                          entity === key
                            ? 'bg-brand-50 text-brand-700 ring-2 ring-brand-600'
                            : 'bg-bg-subtle text-text-secondary hover:bg-bg-subtle/80'
                        }`}
                        style={{ border: 'none', cursor: 'pointer' }}
                      >
                        <span className="material-symbols-outlined text-[16px]">{ENTITY_ICONS[key]}</span>
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                {entity === 'LEAD' && (
                  <div className="mb-4">
                    <label className="block text-sm font-semibold text-text-primary mb-1.5">Import mode</label>
                    <select
                      value={importMode}
                      onChange={e => { setImportMode(e.target.value as ImportMode); setSelectedFile(null); setFieldDefs([]); }}
                      className="w-full px-3 py-2 rounded-cwc-md border border-border bg-bg-subtle text-sm text-text-primary focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none"
                    >
                      <option value="create">Create new Leads</option>
                      <option value="activity-update">Add activities to existing Leads</option>
                      <option value="email-delivery-update">Update Email Delivery Date</option>
                    </select>
                    {importMode === 'activity-update' && (
                      <p className="text-xs text-brand-700 mt-1.5">Only activity logs will be added. Match rows using Lead ID.</p>
                    )}
                    {importMode === 'email-delivery-update' && (
                      <p className="text-xs text-brand-700 mt-1.5">Only Email Delivery Date will be updated. Match rows using Lead ID.</p>
                    )}
                  </div>
                )}

                {/* ── Field reference table + download template ── */}
                {fieldDefs.length > 0 && (
                  <div className="mb-4 bg-bg-subtle rounded-cwc-lg border border-border overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-2.5 bg-brand-50/60 border-b border-border">
                      <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-[18px] text-brand-600">schema</span>
                        <span className="text-sm font-semibold text-brand-700">Column Reference — {ENTITY_LABELS[entity]}</span>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={async () => { try { await crmService.downloadImportTemplate(entity, 'csv', entity === 'LEAD' ? importMode : 'create'); } catch (e) { console.error('CSV template download failed:', e); } }}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-cwc-md bg-surface border border-border text-xs font-medium text-text-secondary hover:bg-bg-subtle hover:text-text-primary transition-colors"
                        >
                          <span className="material-symbols-outlined text-[14px]">download</span> CSV Template
                        </button>
                        <button
                          onClick={async () => { try { await crmService.downloadImportTemplate(entity, 'xlsx', entity === 'LEAD' ? importMode : 'create'); } catch (e) { console.error('Excel template download failed:', e); } }}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-cwc-md bg-surface border border-border text-xs font-medium text-text-secondary hover:bg-bg-subtle hover:text-text-primary transition-colors"
                        >
                          <span className="material-symbols-outlined text-[14px]">download</span> Excel Template
                        </button>
                      </div>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-border bg-bg-subtle/50">
                            <th className="text-left px-3 py-1.5 font-bold uppercase text-text-secondary tracking-wide">Column Name</th>
                            <th className="text-left px-3 py-1.5 font-bold uppercase text-text-secondary tracking-wide">Type</th>
                            <th className="text-left px-3 py-1.5 font-bold uppercase text-text-secondary tracking-wide">Required</th>
                            <th className="text-left px-3 py-1.5 font-bold uppercase text-text-secondary tracking-wide">Allowed Values</th>
                          </tr>
                        </thead>
                        <tbody>
                          {fieldDefs.map(f => (
                            <tr key={f.key} className="border-b border-border/50">
                              <td className="px-3 py-1.5 font-medium text-text-primary">{f.label}</td>
                              <td className="px-3 py-1.5 text-text-secondary capitalize">{f.type === 'enum' ? 'dropdown' : f.type}</td>
                              <td className="px-3 py-1.5">
                                {f.required ? (
                                  <span className="inline-flex items-center px-1.5 py-0.5 rounded-cwc-full bg-red-100 text-red-700 text-[10px] font-bold">Required</span>
                                ) : (
                                  <span className="text-text-secondary">Optional</span>
                                )}
                              </td>
                              <td className="px-3 py-1.5 text-text-secondary">
                                {f.enumValues ? (
                                  <span className="text-[11px]" title={f.enumValues.join(', ')}>
                                    {f.enumValues.length <= 4 ? f.enumValues.join(', ') : `${f.enumValues.slice(0, 4).join(', ')}… (+${f.enumValues.length - 4})`}
                                  </span>
                                ) : f.default !== undefined ? (
                                  <span className="text-[11px]">Default: {String(f.default)}</span>
                                ) : '—'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Drag & drop zone */}
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`relative flex flex-col items-center justify-center border-2 border-dashed rounded-cwc-xl p-10 cursor-pointer transition-colors ${
                    isDragging ? 'border-brand-500 bg-brand-50' : 'border-border hover:border-brand-400 bg-bg-subtle/50'
                  }`}
                >
                  <span className="material-symbols-outlined text-[40px] text-brand-400 mb-2">cloud_upload</span>
                  <p className="text-sm font-medium text-text-primary">
                    {selectedFile ? selectedFile.name : 'Drop your file here, or click to browse'}
                  </p>
                  {selectedFile ? (
                    <p className="text-xs text-text-secondary mt-1">{(selectedFile.size / 1024).toFixed(1)} KB</p>
                  ) : (
                    <p className="text-xs text-text-secondary mt-1">Supports CSV, XLS, XLSX</p>
                  )}
                  <input ref={fileInputRef} type="file" accept=".csv,.xlsx,.xls" onChange={handleFileSelect} className="hidden" />
                </div>

                {/* Upload button */}
                <div className="flex justify-end mt-4">
                  <button
                    onClick={handleUpload}
                    disabled={!selectedFile || importing}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-cwc-md bg-brand-600 text-white text-sm font-semibold hover:bg-brand-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {importing ? (
                      <><span className="material-symbols-outlined text-[18px] animate-spin">progress_activity</span> Uploading…</>
                    ) : (
                      <><span className="material-symbols-outlined text-[18px]">upload</span> Upload & Preview</>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* ── Mapping step ── */}
            {importStep === 'mapping' && (
              <div className="bg-surface rounded-cwc-xl border border-border p-6">
                <div className="flex items-center justify-between mb-1">
                  <h3 className="text-base font-bold text-text-primary">Map Columns</h3>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-cwc-full bg-brand-50 text-brand-700 text-xs font-semibold">
                    {totalRows} rows
                  </span>
                </div>
                <p className="text-sm text-text-secondary mb-4">Match your file columns to CRM fields</p>

                <div className="divide-y divide-border">
                  {/* Header row */}
                  <div className="grid grid-cols-[1fr_1fr_auto] gap-3 py-2">
                    <span className="text-xs font-bold uppercase text-text-secondary tracking-wide">Your Column</span>
                    <span className="text-xs font-bold uppercase text-text-secondary tracking-wide">CRM Field</span>
                    <span className="text-xs font-bold uppercase text-text-secondary tracking-wide w-20">Required</span>
                  </div>
                  {headers.map(header => (
                    <div key={header} className="grid grid-cols-[1fr_1fr_auto] gap-3 py-2.5 items-center">
                      <span className="text-sm font-medium text-text-primary truncate">{header}</span>
                      <select
                        value={columnMapping[header] || ''}
                        onChange={e => setColumnMapping(prev => ({ ...prev, [header]: e.target.value }))}
                        className="w-full px-3 py-2 rounded-cwc-md border border-border bg-bg-subtle text-sm text-text-primary focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none transition-colors"
                      >
                        <option value="">— Skip —</option>
                        {fieldDefs.map(f => (
                          <option key={f.key} value={f.key}>{f.label}</option>
                        ))}
                      </select>
                      <span className="w-20 text-xs">
                        {fieldDefs.find(f => f.key === columnMapping[header])?.required ? (
                          <span className="text-red-500 font-semibold">* Required</span>
                        ) : (
                          <span className="text-text-secondary">Optional</span>
                        )}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="flex gap-3 mt-6">
                  <button onClick={handleResetImport} className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-cwc-md border border-border text-sm font-medium text-text-secondary hover:bg-bg-subtle transition-colors" style={{ background: 'none', cursor: 'pointer' }}>
                    <span className="material-symbols-outlined text-[16px]">arrow_back</span> Back
                  </button>
                  <button onClick={handleValidate} disabled={importing} className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-cwc-md bg-brand-600 text-white text-sm font-semibold hover:bg-brand-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                    {importing ? <><span className="material-symbols-outlined text-[18px] animate-spin">progress_activity</span> Validating…</> : <><span className="material-symbols-outlined text-[18px]">verified</span> Validate & Continue</>}
                  </button>
                </div>
              </div>
            )}

            {/* ── Validation step ── */}
            {importStep === 'validating' && validationResult && (
              <div className="bg-surface rounded-cwc-xl border border-border p-6">
                <h3 className="text-base font-bold text-text-primary mb-4">Validation Results</h3>

                {validationResult.warnings.length > 0 && (
                  <div className="flex items-start gap-2 rounded-cwc-lg bg-amber-50 border border-amber-200 px-4 py-3 mb-3">
                    <span className="material-symbols-outlined text-amber-500 mt-0.5">warning</span>
                    <div className="text-sm text-amber-800">
                      {validationResult.warnings.map((w, i) => <p key={i}>{w}</p>)}
                    </div>
                  </div>
                )}

                {validationResult.errors.length > 0 && (
                  <div className="rounded-cwc-lg bg-red-50 border border-red-200 px-4 py-3 mb-3 max-h-48 overflow-y-auto">
                    {validationResult.errors.slice(0, 20).map((e, i) => (
                      <p key={i} className="text-sm text-red-800">Row {e.row}: {e.field} — {e.error}</p>
                    ))}
                    {validationResult.errors.length > 20 && (
                      <p className="text-sm text-red-600 font-medium mt-1">…and {validationResult.errors.length - 20} more errors</p>
                    )}
                  </div>
                )}

                {validationResult.valid ? (
                  <div className="flex items-center gap-2 text-emerald-600 font-medium mb-4">
                    <span className="material-symbols-outlined">check_circle</span> Validation passed — ready to import
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-red-600 font-medium mb-4">
                    <span className="material-symbols-outlined">cancel</span> Validation failed — fix your data and re-upload
                  </div>
                )}

                <div className="flex gap-3">
                  <button onClick={() => setImportStep('mapping')} className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-cwc-md border border-border text-sm font-medium text-text-secondary hover:bg-bg-subtle transition-colors" style={{ background: 'none', cursor: 'pointer' }}>
                    <span className="material-symbols-outlined text-[16px]">arrow_back</span> Back to Mapping
                  </button>
                  {validationResult.valid && (
                    <button onClick={handleExecuteImport} disabled={importing} className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-cwc-md bg-brand-600 text-white text-sm font-semibold hover:bg-brand-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                      {importing ? <><span className="material-symbols-outlined text-[18px] animate-spin">progress_activity</span> Importing…</> : <><span className="material-symbols-outlined text-[18px]">rocket_launch</span> Start Import</>}
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* ── Importing step ── */}
            {importStep === 'importing' && (
              <div className="bg-surface rounded-cwc-xl border border-border p-10 text-center">
                <span className="material-symbols-outlined text-[48px] text-brand-500 animate-spin">progress_activity</span>
                <h3 className="text-lg font-bold text-text-primary mt-4">Importing data…</h3>
                <p className="text-sm text-text-secondary mt-1">Processing {totalRows} rows</p>
              </div>
            )}

            {/* ── Complete step ── */}
            {importStep === 'complete' && importResult && (
              <div className="bg-surface rounded-cwc-xl border border-border p-6">
                <div className="flex items-center gap-2 mb-4">
                  <span className="material-symbols-outlined text-emerald-500 text-xl">check_circle</span>
                  <h3 className="text-base font-bold text-text-primary">{importMode === 'activity-update' ? 'Activity Update Complete' : importMode === 'email-delivery-update' ? 'Email Delivery Date Update Complete' : 'Import Complete'}</h3>
                </div>

                <div className="grid grid-cols-4 gap-4 mb-4">
                  <div className="bg-emerald-50 rounded-cwc-lg p-4 text-center">
                    <div className="text-2xl font-bold text-emerald-600">{importResult.importedRows}</div>
                    <div className="text-xs text-emerald-700 font-medium">{importMode === 'activity-update' ? 'Activities created' : importMode === 'email-delivery-update' ? 'Leads updated' : 'Imported'}</div>
                  </div>
                  <div className={`rounded-cwc-lg p-4 text-center ${importResult.failedRows > 0 ? 'bg-red-50' : 'bg-bg-subtle'}`}>
                    <div className={`text-2xl font-bold ${importResult.failedRows > 0 ? 'text-red-600' : 'text-text-secondary'}`}>{importResult.failedRows}</div>
                    <div className="text-xs text-text-secondary font-medium">Failed</div>
                  </div>
                  <div className={`rounded-cwc-lg p-4 text-center ${(importMode === 'activity-update' ? (importResult.skippedRows || 0) : importResult.duplicateRows) > 0 ? 'bg-amber-50' : 'bg-bg-subtle'}`}>
                    <div className={`text-2xl font-bold ${(importMode === 'activity-update' ? (importResult.skippedRows || 0) : importResult.duplicateRows) > 0 ? 'text-amber-600' : 'text-text-secondary'}`}>{importMode === 'activity-update' ? (importResult.skippedRows || 0) : importResult.duplicateRows}</div>
                    <div className="text-xs text-text-secondary font-medium">{importMode === 'activity-update' ? 'Skipped' : 'Duplicates skipped'}</div>
                  </div>
                  <div className="bg-bg-subtle rounded-cwc-lg p-4 text-center">
                    <div className="text-2xl font-bold text-text-primary">{totalRows}</div>
                    <div className="text-xs text-text-secondary font-medium">Total</div>
                  </div>
                </div>

                {importResult.errors.length > 0 && (
                  <div className="rounded-cwc-lg bg-red-50 border border-red-200 px-4 py-3 mb-4 max-h-48 overflow-y-auto">
                    {importResult.errors.slice(0, 20).map((e, i) => (
                      <p key={i} className="text-sm text-red-800">Row {e.row}: {e.error}</p>
                    ))}
                    {importResult.errors.length > 20 && (
                      <p className="text-sm text-red-600 font-medium mt-1">…and {importResult.errors.length - 20} more errors</p>
                    )}
                  </div>
                )}

                {importResult.duplicateDetails.length > 0 && (
                  <div className="rounded-cwc-lg bg-amber-50 border border-amber-200 px-4 py-3 mb-4">
                    <p className="text-sm font-semibold text-amber-900">Duplicate rows were skipped</p>
                    <p className="text-sm text-amber-800 mt-1">
                      These spreadsheet rows were not imported because they matched an earlier row in this file or an existing Lead. Review the matching field and source below.
                    </p>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {importResult.duplicateDetails.map((duplicate) => (
                        <span key={duplicate.row} className="inline-flex items-center rounded-full bg-white border border-amber-300 px-2.5 py-1 text-xs font-medium text-amber-900">
                          Row {duplicate.row} · {duplicate.matchedBy} · {duplicate.matchSource === 'earlier spreadsheet row' ? `matches row ${duplicate.matchedRow}` : 'matches an existing Lead'}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <button onClick={handleResetImport} className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-cwc-md bg-brand-600 text-white text-sm font-semibold hover:bg-brand-700 transition-colors">
                  <span className="material-symbols-outlined text-[18px]">refresh</span> Import More Data
                </button>
              </div>
            )}

            {/* ── Import history ── */}
            {importHistory.length > 0 && importStep === 'upload' && (
              <div className="bg-surface rounded-cwc-xl border border-border p-6 mt-6">
                <h3 className="text-base font-bold text-text-primary mb-4">Recent Imports</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left py-2 text-xs font-bold uppercase text-text-secondary tracking-wide">File</th>
                        <th className="text-left py-2 text-xs font-bold uppercase text-text-secondary tracking-wide">Entity</th>
                        <th className="text-left py-2 text-xs font-bold uppercase text-text-secondary tracking-wide">Status</th>
                        <th className="text-left py-2 text-xs font-bold uppercase text-text-secondary tracking-wide">Rows</th>
                        <th className="text-left py-2 text-xs font-bold uppercase text-text-secondary tracking-wide">Duplicates</th>
                        <th className="text-left py-2 text-xs font-bold uppercase text-text-secondary tracking-wide">Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {importHistory.slice(0, 10).map((job: any) => (
                        <React.Fragment key={job.id}>
                          <tr className="border-b border-border/50 hover:bg-bg-subtle/50">
                          <td className="py-2.5 text-text-primary font-medium">{job.fileName}</td>
                          <td className="py-2.5 text-text-secondary">{ENTITY_LABELS[(job.entity as EntityType)] || job.entity}</td>
                          <td className="py-2.5">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-cwc-full text-xs font-semibold ${
                              job.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-700'
                                : job.status === 'FAILED' ? 'bg-red-100 text-red-700'
                                : 'bg-amber-100 text-amber-700'
                            }`}>{job.status}</span>
                          </td>
                          <td className="py-2.5 text-text-secondary">{job.importedRows ?? 0}/{job.totalRows ?? 0}</td>
                          <td className="py-2.5">
                            {Array.isArray(job.duplicateReport) && job.duplicateReport.length > 0 ? (
                              <button
                                type="button"
                                onClick={() => setExpandedImportId(expandedImportId === job.id ? null : job.id)}
                                className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700 hover:text-amber-900"
                              >
                                {job.duplicateReport.length} skipped
                                <span className="material-symbols-outlined text-[16px]">{expandedImportId === job.id ? 'expand_less' : 'expand_more'}</span>
                              </button>
                            ) : <span className="text-text-secondary">—</span>}
                          </td>
                          <td className="py-2.5 text-text-secondary">{new Date(job.createdAt).toLocaleDateString()}</td>
                        </tr>
                        {expandedImportId === job.id && Array.isArray(job.duplicateReport) && job.duplicateReport.length > 0 && (
                          <tr key={`${job.id}-duplicates`} className="border-b border-border/50 bg-amber-50/60">
                            <td colSpan={6} className="px-4 py-3">
                              <p className="text-xs font-semibold text-amber-900">Skipped rows from this import</p>
                              <p className="text-xs text-amber-800 mt-1">These rows were skipped during this specific import. The matching field and source are shown for traceability.</p>
                              <div className="flex flex-wrap gap-2 mt-2">
                                {(job.duplicateReport as DuplicateDetail[]).map((duplicate) => (
                                  <span key={`${job.id}-${duplicate.row}`} className="inline-flex items-center rounded-full bg-white border border-amber-300 px-2.5 py-1 text-xs font-medium text-amber-900">
                                    Row {duplicate.row} · {duplicate.matchedBy} · {duplicate.matchSource === 'earlier spreadsheet row' ? `matches row ${duplicate.matchedRow}` : 'matches an existing Lead'}
                                  </span>
                                ))}
                              </div>
                            </td>
                          </tr>
                        )}
                        </React.Fragment>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}

        {/* ══════════════════════════════════════════════════════════════
            EXPORT TAB
            ══════════════════════════════════════════════════════════════ */}
        {tab === 'export' && (
          <>
            <div className="bg-surface rounded-cwc-xl border border-border p-6">
              <h3 className="text-base font-bold text-text-primary mb-4">Export Data</h3>

              {/* Entity selector */}
              <div className="mb-4">
                <label className="block text-sm font-semibold text-text-primary mb-1.5">Entity type</label>
                <div className="flex flex-wrap gap-2">
                  {(Object.entries(ENTITY_LABELS) as [EntityType, string][]).map(([key, label]) => (
                    <button
                      key={key}
                      onClick={() => setExportEntity(key)}
                      className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-cwc-md text-sm font-medium transition-colors ${
                        exportEntity === key
                          ? 'bg-brand-50 text-brand-700 ring-2 ring-brand-600'
                          : 'bg-bg-subtle text-text-secondary hover:bg-bg-subtle/80'
                      }`}
                      style={{ border: 'none', cursor: 'pointer' }}
                    >
                      <span className="material-symbols-outlined text-[16px]">{ENTITY_ICONS[key]}</span>
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Format selector */}
              <div className="mb-6">
                <label className="block text-sm font-semibold text-text-primary mb-1.5">Format</label>
                <div className="flex gap-2">
                  {(['CSV', 'XLSX'] as const).map(fmt => (
                    <button
                      key={fmt}
                      onClick={() => setExportFormat(fmt)}
                      className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-cwc-md text-sm font-medium transition-colors ${
                        exportFormat === fmt
                          ? 'bg-brand-50 text-brand-700 ring-2 ring-brand-600'
                          : 'bg-bg-subtle text-text-secondary hover:bg-bg-subtle/80'
                      }`}
                      style={{ border: 'none', cursor: 'pointer' }}
                    >
                      <span className="material-symbols-outlined text-[16px]">{fmt === 'CSV' ? 'description' : 'table_chart'}</span>
                      {fmt === 'CSV' ? 'CSV' : 'Excel (XLSX)'}
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={handleExport}
                disabled={exporting}
                className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-cwc-md bg-brand-600 text-white text-sm font-semibold hover:bg-brand-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {exporting ? (
                  <><span className="material-symbols-outlined text-[18px] animate-spin">progress_activity</span> Generating…</>
                ) : (
                  <><span className="material-symbols-outlined text-[18px]">download</span> Export</>
                )}
              </button>
            </div>

            {/* ── Export history ── */}
            {exportHistory.length > 0 && (
              <div className="bg-surface rounded-cwc-xl border border-border p-6 mt-6">
                <h3 className="text-base font-bold text-text-primary mb-4">Recent Exports</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left py-2 text-xs font-bold uppercase text-text-secondary tracking-wide">Entity</th>
                        <th className="text-left py-2 text-xs font-bold uppercase text-text-secondary tracking-wide">Format</th>
                        <th className="text-left py-2 text-xs font-bold uppercase text-text-secondary tracking-wide">Rows</th>
                        <th className="text-left py-2 text-xs font-bold uppercase text-text-secondary tracking-wide">Status</th>
                        <th className="text-left py-2 text-xs font-bold uppercase text-text-secondary tracking-wide">Date</th>
                        <th className="text-left py-2 text-xs font-bold uppercase text-text-secondary tracking-wide">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {exportHistory.slice(0, 10).map((job: any) => (
                        <tr key={job.id} className="border-b border-border/50 hover:bg-bg-subtle/50">
                          <td className="py-2.5 text-text-primary font-medium">{ENTITY_LABELS[(job.entity as EntityType)] || job.entity}</td>
                          <td className="py-2.5 text-text-secondary">{job.format}</td>
                          <td className="py-2.5 text-text-secondary">{job.rowCount ?? '—'}</td>
                          <td className="py-2.5">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-cwc-full text-xs font-semibold ${
                              job.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-700'
                                : job.status === 'FAILED' ? 'bg-red-100 text-red-700'
                                : 'bg-amber-100 text-amber-700'
                            }`}>{job.status}</span>
                          </td>
                          <td className="py-2.5 text-text-secondary">{new Date(job.createdAt).toLocaleDateString()}</td>
                          <td className="py-2.5">
                            {job.status === 'COMPLETED' && (
                              <button
                                onClick={() => crmService.downloadExport(job.id)}
                                className="inline-flex items-center gap-1 text-brand-600 hover:text-brand-700 text-sm font-medium"
                                style={{ background: 'none', border: 'none', cursor: 'pointer' }}
                              >
                                <span className="material-symbols-outlined text-[16px]">download</span> Download
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default CrmImportExport;