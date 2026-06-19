import React, { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import creditService, {
  CreditApplication,
  CreditDocument,
  EvidenceFieldMapping,
  EvidenceMappingSnapshot,
  EvidenceSourceType,
} from '../../services/credit.service';
import { friendlyMessage } from '../../utils/errorMessages';

interface EvidenceMappingPanelProps {
  application: CreditApplication;
}

type RowState = EvidenceFieldMapping;

const SOURCE_OPTIONS: Array<{ value: EvidenceSourceType; label: string }> = [
  { value: 'MANUAL', label: 'Manual input' },
  { value: 'APPLICATION_FORM', label: 'Application form' },
  { value: 'PAYROLL_RECORDS', label: 'Payroll records' },
  { value: 'CREDIT_BUREAU', label: 'Credit bureau' },
  { value: 'CORE_BANKING_SYSTEM', label: 'Core banking system' },
  { value: 'BANK_STATEMENT_ANALYSIS', label: 'Bank statement analysis' },
  { value: 'UPLOADED_FINANCIAL_STATEMENTS', label: 'Uploaded financial statements' },
  { value: 'OCR_EXTRACTION', label: 'OCR extraction' },
  { value: 'TAX_DOCUMENTS', label: 'Tax documents' },
  { value: 'INTERNAL_RISK_ENGINE', label: 'Internal risk engine' },
  { value: 'CREDIT_SCORING_ENGINE', label: 'Credit scoring engine' },
];

const FIELD_TEMPLATES: Array<Pick<EvidenceFieldMapping, 'fieldKey' | 'fieldLabel' | 'sourceType' | 'documentId' | 'documentLabel' | 'note' | 'autoPopulated' | 'ocrExtracted' | 'confidence'>> = [
  {
    fieldKey: 'grossMonthlyIncome',
    fieldLabel: 'Gross monthly income',
    sourceType: 'PAYROLL_RECORDS',
    documentId: null,
    documentLabel: null,
    note: 'Baseline payroll / stated income source.',
    autoPopulated: true,
    ocrExtracted: false,
    confidence: 'MEDIUM',
  },
  {
    fieldKey: 'netMonthlyIncome',
    fieldLabel: 'Net monthly income',
    sourceType: 'PAYROLL_RECORDS',
    documentId: null,
    documentLabel: null,
    note: 'Used for disposable income and DSR checks.',
    autoPopulated: true,
    ocrExtracted: false,
    confidence: 'MEDIUM',
  },
  {
    fieldKey: 'monthlyCommitments',
    fieldLabel: 'Monthly commitments',
    sourceType: 'BANK_STATEMENT_ANALYSIS',
    documentId: null,
    documentLabel: null,
    note: 'Existing repayment obligations and deductions.',
    autoPopulated: true,
    ocrExtracted: false,
    confidence: 'MEDIUM',
  },
  {
    fieldKey: 'businessRevenue',
    fieldLabel: 'Business revenue',
    sourceType: 'UPLOADED_FINANCIAL_STATEMENTS',
    documentId: null,
    documentLabel: null,
    note: 'Top-line revenue from financial statements.',
    autoPopulated: false,
    ocrExtracted: true,
    confidence: 'MEDIUM',
  },
  {
    fieldKey: 'businessExpenses',
    fieldLabel: 'Business expenses',
    sourceType: 'UPLOADED_FINANCIAL_STATEMENTS',
    documentId: null,
    documentLabel: null,
    note: 'Operating cost base used in spread analysis.',
    autoPopulated: false,
    ocrExtracted: true,
    confidence: 'MEDIUM',
  },
  {
    fieldKey: 'taxProfile',
    fieldLabel: 'Tax profile / declarations',
    sourceType: 'TAX_DOCUMENTS',
    documentId: null,
    documentLabel: null,
    note: 'Tax returns or supporting filings.',
    autoPopulated: false,
    ocrExtracted: true,
    confidence: 'MEDIUM',
  },
  {
    fieldKey: 'bureauExposure',
    fieldLabel: 'External bureau exposure',
    sourceType: 'CREDIT_BUREAU',
    documentId: null,
    documentLabel: null,
    note: 'Reference exposure / liabilities pulled from bureau.',
    autoPopulated: true,
    ocrExtracted: false,
    confidence: 'LOW',
  },
];

const confidenceLabels: Record<NonNullable<EvidenceFieldMapping['confidence']>, string> = {
  LOW: 'Low confidence',
  MEDIUM: 'Medium confidence',
  HIGH: 'High confidence',
};

const documentTypeLabels: Partial<Record<CreditDocument['documentType'], string>> = {
  BANK_STATEMENT: 'Bank statement',
  FINANCIAL_STATEMENT: 'Financial statement',
  TAX_RETURN: 'Tax return',
  BUSINESS_REG: 'Business registration',
  OTHER: 'Other',
};

const sourceTypeLabelMap = Object.fromEntries(SOURCE_OPTIONS.map(option => [option.value, option.label])) as Record<EvidenceSourceType, string>;

function inferDocument(documents: CreditDocument[], fieldKey: string): CreditDocument | undefined {
  const priority: CreditDocument['documentType'][] =
    fieldKey === 'taxProfile'
      ? ['TAX_RETURN', 'FINANCIAL_STATEMENT', 'BANK_STATEMENT', 'OTHER']
      : fieldKey === 'businessRevenue' || fieldKey === 'businessExpenses'
        ? ['FINANCIAL_STATEMENT', 'BANK_STATEMENT', 'TAX_RETURN', 'OTHER']
        : fieldKey === 'bureauExposure'
          ? ['OTHER', 'BANK_STATEMENT', 'FINANCIAL_STATEMENT', 'TAX_RETURN']
          : ['BANK_STATEMENT', 'FINANCIAL_STATEMENT', 'TAX_RETURN', 'OTHER'];

  for (const type of priority) {
    const found = documents.find(doc => doc.documentType === type);
    if (found) return found;
  }
  return documents[0];
}

function inferInitialRows(documents: CreditDocument[]): RowState[] {
  return FIELD_TEMPLATES.map(template => {
    const inferredDoc = inferDocument(documents, template.fieldKey);
    return {
      ...template,
      documentId: inferredDoc?.id ?? null,
      documentLabel: inferredDoc?.fileName ?? null,
      sourceType: inferredDoc?.verificationStatus === 'VERIFIED' ? template.sourceType : template.sourceType,
      autoPopulated: inferredDoc ? template.autoPopulated : false,
    };
  });
}

const EvidenceMappingPanel: React.FC<EvidenceMappingPanelProps> = ({ application }) => {
  const [documents, setDocuments] = useState<CreditDocument[]>([]);
  const [rows, setRows] = useState<RowState[]>([]);
  const [sourceSummary, setSourceSummary] = useState('');
  const [savedSnapshot, setSavedSnapshot] = useState<EvidenceMappingSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [previewingId, setPreviewingId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        setLoading(true);
        const [docs, snapshot] = await Promise.all([
          creditService.listApplicationDocuments(application.id).catch(() => [] as CreditDocument[]),
          creditService.getEvidenceMapping(application.id).catch(() => null),
        ]);

        if (cancelled) return;

        setDocuments(docs);
        if (snapshot?.mappings?.length) {
          setRows(snapshot.mappings as RowState[]);
          setSourceSummary(snapshot.sourceSummary ?? '');
          setSavedSnapshot(snapshot);
        } else {
          const inferredRows = inferInitialRows(docs);
          setRows(inferredRows);
          setSourceSummary('');
          setSavedSnapshot(snapshot);
        }
      } catch (error) {
        toast.error(friendlyMessage(error, 'Failed to load evidence mappings'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [application.id]);

  const mappedCount = useMemo(() => rows.filter(row => row.documentId || row.sourceType !== 'MANUAL').length, [rows]);
  const gapCount = useMemo(() => rows.filter(row => !row.documentId && row.sourceType === 'MANUAL').length, [rows]);
  const verifiedDocumentCount = useMemo(() => documents.filter(doc => doc.verificationStatus === 'VERIFIED').length, [documents]);

  const updateRow = (fieldKey: string, patch: Partial<RowState>) => {
    setRows(current => current.map(row => (row.fieldKey === fieldKey ? { ...row, ...patch } : row)));
  };

  const handlePreview = async (documentId: string) => {
    try {
      setPreviewingId(documentId);
      const url = await creditService.getDocumentDownloadUrl(documentId);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (error) {
      toast.error(friendlyMessage(error, 'Failed to open document preview'));
    } finally {
      setPreviewingId(null);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const result = await creditService.saveEvidenceMapping(application.id, {
        sourceSummary: sourceSummary.trim() || null,
        mappings: rows.map(row => ({
          ...row,
          note: row.note?.trim() || null,
        })),
      });
      setSavedSnapshot(result);
      setRows(result.mappings as RowState[]);
      setSourceSummary(result.sourceSummary ?? '');
      toast.success('Evidence mapping saved');
    } catch (error) {
      toast.error(friendlyMessage(error, 'Failed to save evidence mapping'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Source mapping and evidence traceability</h3>
            <p className="mt-1 text-xs text-slate-500">
              Link each important financial figure to a document or source type so reviewers can trace the origin quickly.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 text-[11px] font-medium">
            <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">{rows.length} fields</span>
            <span className="rounded-full bg-emerald-50 px-3 py-1 text-emerald-700">{mappedCount} mapped</span>
            <span className="rounded-full bg-amber-50 px-3 py-1 text-amber-700">{gapCount} manual gaps</span>
            <span className="rounded-full bg-blue-50 px-3 py-1 text-blue-700">{verifiedDocumentCount} verified docs</span>
          </div>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-3 text-xs text-slate-600">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <div className="font-semibold text-slate-900">Saved snapshot</div>
            <div className="mt-1">
              {savedSnapshot?.updatedAt ? new Date(savedSnapshot.updatedAt).toLocaleString() : 'No saved snapshot yet'}
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <div className="font-semibold text-slate-900">Saved by</div>
            <div className="mt-1">{savedSnapshot?.updatedBy ? `${savedSnapshot.updatedBy.firstName} ${savedSnapshot.updatedBy.lastName}` : 'Not yet saved'}</div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <div className="font-semibold text-slate-900">Traceability note</div>
            <div className="mt-1">Auto-populated rows and OCR-derived rows are marked explicitly.</div>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-4 py-3">
          <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">Evidence summary</label>
          <textarea
            value={sourceSummary}
            onChange={e => setSourceSummary(e.target.value)}
            placeholder="Example: Salaried income backed by payroll slips and 3 months of bank statements; SME figures backed by FY2025 audited accounts."
            rows={3}
            className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400"
          />
        </div>

        {loading ? (
          <div className="px-4 py-6 text-sm text-slate-500">Loading evidence mappings…</div>
        ) : (
          <div className="divide-y divide-slate-200">
            {rows.map(row => {
              const selectedDocument = documents.find(doc => doc.id === row.documentId) ?? null;
              return (
                <div key={row.fieldKey} className="grid gap-3 px-4 py-4 lg:grid-cols-[1.4fr_1fr_1.2fr_1fr] lg:items-start">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="text-sm font-semibold text-slate-900">{row.fieldLabel}</h4>
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                        {sourceTypeLabelMap[row.sourceType]}
                      </span>
                      {row.autoPopulated && <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-700">Auto</span>}
                      {row.ocrExtracted && <span className="rounded-full bg-violet-50 px-2 py-0.5 text-[11px] font-medium text-violet-700">OCR</span>}
                      {row.confidence && <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">{confidenceLabels[row.confidence]}</span>}
                    </div>
                    <p className="mt-1 text-xs text-slate-500">{row.note || 'No note provided'}</p>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold uppercase tracking-wide text-slate-500">Source type</label>
                    <select
                      value={row.sourceType}
                      onChange={e => updateRow(row.fieldKey, { sourceType: e.target.value as EvidenceSourceType })}
                      className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400"
                    >
                      {SOURCE_OPTIONS.map(option => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold uppercase tracking-wide text-slate-500">Document link</label>
                    <select
                      value={row.documentId ?? ''}
                      onChange={e => {
                        const nextDoc = documents.find(doc => doc.id === e.target.value) ?? null;
                        updateRow(row.fieldKey, {
                          documentId: nextDoc?.id ?? null,
                          documentLabel: nextDoc?.fileName ?? null,
                          confidence: nextDoc ? (nextDoc.verificationStatus === 'VERIFIED' ? 'HIGH' : row.confidence) : row.confidence,
                        });
                      }}
                      className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400"
                    >
                      <option value="">No document selected</option>
                      {documents.map(doc => (
                        <option key={doc.id} value={doc.id}>
                          {doc.fileName} · {documentTypeLabels[doc.documentType] ?? doc.documentType}
                        </option>
                      ))}
                    </select>
                    {selectedDocument ? (
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                        <span>{selectedDocument.verificationStatus ?? 'UNVERIFIED'}</span>
                        <span>•</span>
                        <span>{selectedDocument.fileName}</span>
                        <button
                          type="button"
                          onClick={() => void handlePreview(selectedDocument.id)}
                          disabled={previewingId === selectedDocument.id}
                          className="rounded-full bg-slate-100 px-2.5 py-1 font-medium text-slate-700 hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {previewingId === selectedDocument.id ? 'Opening…' : 'Preview'}
                        </button>
                      </div>
                    ) : null}
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold uppercase tracking-wide text-slate-500">Reviewer notes</label>
                    <textarea
                      value={row.note ?? ''}
                      onChange={e => updateRow(row.fieldKey, { note: e.target.value })}
                      rows={3}
                      className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-4 py-3">
          <div className="text-xs text-slate-500">
            Reviewer can trace each field back to its source. Save writes an audit-chain snapshot so the mapping survives refresh and submission.
          </div>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || loading}
            className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save evidence mapping'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default EvidenceMappingPanel;
