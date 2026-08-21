import React, { useEffect, useMemo, useState } from 'react';
import Modal from '../../ui/Modal';
import Button from '../../ui/Button';
import creditService from '../../../services/credit.service';
import toast from 'react-hot-toast';

export type BureauFacilityDraft = {
  facilityType: string;
  lender: string;
  balance: string;
  installment: string;
  conductStatus: string;
};

export interface BureauUploadModalProps {
  borrowerId: string;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}

const FACILITY_TYPES = [
  'TERM_LOAN',
  'REVOLVING_CREDIT',
  'OVERDRAFT',
  'LETTER_OF_CREDIT',
  'BANK_GUARANTEE',
  'TRADE_FINANCE',
  'BRIDGE_LOAN',
  'PROJECT_FINANCE',
];

const SOURCE_OPTIONS = [
  { value: 'CTOS', label: 'CTOS' },
  { value: 'CCRIS_BORROWER_UPLOAD', label: 'CCRIS Borrower Upload' },
];

const emptyFacility = (): BureauFacilityDraft => ({
  facilityType: 'TERM_LOAN',
  lender: '',
  balance: '',
  installment: '',
  conductStatus: '',
});

const toNumberOrNull = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const num = Number(trimmed);
  return Number.isFinite(num) ? num : null;
};

const BureauUploadModal: React.FC<BureauUploadModalProps> = ({ borrowerId, open, onClose, onSaved }) => {
  const [source, setSource] = useState<'CTOS' | 'CCRIS_BORROWER_UPLOAD'>('CTOS');
  const [reportDate, setReportDate] = useState('');
  const [creditScore, setCreditScore] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [facilities, setFacilities] = useState<BureauFacilityDraft[]>([emptyFacility()]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setSource('CTOS');
    setReportDate('');
    setCreditScore('');
    setSelectedFile(null);
    setFacilities([emptyFacility()]);
    setSaving(false);
    setError(null);
  }, [open]);

  const summary = useMemo(() => facilities.filter((facility) => facility.facilityType || facility.lender || facility.balance || facility.installment || facility.conductStatus), [facilities]);

  const updateFacility = (index: number, field: keyof BureauFacilityDraft, value: string) => {
    setFacilities((prev) => prev.map((facility, idx) => (idx === index ? { ...facility, [field]: value } : facility)));
  };

  const addFacility = () => setFacilities((prev) => [...prev, emptyFacility()]);
  const removeFacility = (index: number) => setFacilities((prev) => (prev.length === 1 ? prev : prev.filter((_, idx) => idx !== index)));

  const handleSubmit = async () => {
    setError(null);
    if (!selectedFile) {
      setError('Select the bureau report file before saving.');
      return;
    }
    const parsedScore = Number(creditScore);
    if (!creditScore.trim() || !Number.isInteger(parsedScore) || parsedScore < 0 || parsedScore > 999) {
      setError('Enter a valid bureau credit score from 0 to 999.');
      return;
    }
    setSaving(true);
    try {
      const uploadedDocument = await creditService.uploadBorrowerDocument(borrowerId, selectedFile, 'CREDIT_BUREAU_REPORT');
      const payload = {
        source,
        creditScore: parsedScore,
        reportDate: reportDate ? new Date(reportDate).toISOString() : null,
        fileName: uploadedDocument.fileName,
        filePath: uploadedDocument.filePath,
        facilities: summary.map((facility) => ({
          facilityType: facility.facilityType.trim(),
          lender: facility.lender.trim() || null,
          balance: toNumberOrNull(facility.balance),
          installment: toNumberOrNull(facility.installment),
          conductStatus: facility.conductStatus.trim() || null,
        })),
      };

      await creditService.createBorrowerBureauReport(borrowerId, payload);
      onSaved();
      toast.success('Bureau report saved and borrower summary refreshed');
      onClose();
    } catch (e: any) {
      console.error(e);
      setError(e?.response?.data?.message || e?.message || 'Failed to upload bureau report');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen={open}
      onClose={onClose}
      title="Upload Bureau Report"
      size="xl"
      footer={
        <div className="flex items-center justify-end gap-3">
          <Button variant="ghost" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button variant="primary" icon="upload" loading={saving} onClick={handleSubmit}>
            Save Report
          </Button>
        </div>
      }
    >
      <div className="space-y-5">
        {error ? (
          <div className="rounded-fc border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        <div className="grid gap-4 md:grid-cols-2">
          <label className="space-y-1">
            <span className="text-[11px] font-bold uppercase tracking-wide text-fc-on-variant">Source</span>
            <select
              value={source}
              onChange={(e) => setSource(e.target.value as 'CTOS' | 'CCRIS_BORROWER_UPLOAD')}
              className="w-full rounded-fc border border-cwc-border bg-white px-3 py-2 text-sm"
            >
              {SOURCE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>

          <label className="space-y-1">
            <span className="text-[11px] font-bold uppercase tracking-wide text-fc-on-variant">Report Date</span>
            <input
              type="date"
              value={reportDate}
              onChange={(e) => setReportDate(e.target.value)}
              aria-label="Report date"
              className="w-full rounded-fc border border-cwc-border bg-white px-3 py-2 text-sm"
            />
          </label>

          <label className="space-y-1">
            <span className="text-[11px] font-bold uppercase tracking-wide text-fc-on-variant">Bureau credit score</span>
            <input type="number" min="0" max="999" step="1" value={creditScore} onChange={(e) => setCreditScore(e.target.value)} aria-label="Bureau credit score" placeholder="0–999" className="w-full rounded-fc border border-cwc-border bg-white px-3 py-2 text-sm" />
          </label>

          <label className="space-y-1">
            <span className="text-[11px] font-bold uppercase tracking-wide text-fc-on-variant">Report file</span>
            <input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)} aria-label="Report file" className="w-full rounded-fc border border-cwc-border bg-white px-3 py-2 text-sm" />
            <span className="block text-xs text-fc-on-variant">PDF or image; the file is stored as a credit document.</span>
          </label>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold uppercase tracking-wide text-fc-primary">Facility Rows</h3>
            <Button variant="secondary" size="sm" icon="add" onClick={addFacility}>Add Row</Button>
          </div>

          <div className="space-y-3">
            {facilities.map((facility, index) => (
              <div key={`${facility.facilityType}-${index}`} className="rounded-fc border border-fc-outline bg-fc-surface p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <p className="text-xs font-bold uppercase tracking-wide text-fc-on-variant">Facility {index + 1}</p>
                  <button
                    type="button"
                    onClick={() => removeFacility(index)}
                    className="text-xs font-semibold text-red-600 hover:underline"
                    disabled={facilities.length === 1}
                  >
                    Remove
                  </button>
                </div>
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                  <label className="space-y-1 xl:col-span-1">
                    <span className="text-[11px] font-bold uppercase tracking-wide text-fc-on-variant">Type</span>
                    <select
                      value={facility.facilityType}
                      onChange={(e) => updateFacility(index, 'facilityType', e.target.value)}
                      className="w-full rounded-fc border border-cwc-border bg-white px-3 py-2 text-sm"
                    >
                      {FACILITY_TYPES.map((type) => (
                        <option key={type} value={type}>{type.replace(/_/g, ' ')}</option>
                      ))}
                    </select>
                  </label>
                  <label className="space-y-1">
                    <span className="text-[11px] font-bold uppercase tracking-wide text-fc-on-variant">Lender</span>
                    <input
                      type="text"
                      value={facility.lender}
                      onChange={(e) => updateFacility(index, 'lender', e.target.value)}
                      className="w-full rounded-fc border border-cwc-border bg-white px-3 py-2 text-sm"
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="text-[11px] font-bold uppercase tracking-wide text-fc-on-variant">Balance</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={facility.balance}
                      onChange={(e) => updateFacility(index, 'balance', e.target.value)}
                      className="w-full rounded-fc border border-cwc-border bg-white px-3 py-2 text-sm"
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="text-[11px] font-bold uppercase tracking-wide text-fc-on-variant">Installment</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={facility.installment}
                      onChange={(e) => updateFacility(index, 'installment', e.target.value)}
                      className="w-full rounded-fc border border-cwc-border bg-white px-3 py-2 text-sm"
                    />
                  </label>
                  <label className="space-y-1">
                    <span className="text-[11px] font-bold uppercase tracking-wide text-fc-on-variant">Conduct</span>
                    <input
                      type="text"
                      value={facility.conductStatus}
                      onChange={(e) => updateFacility(index, 'conductStatus', e.target.value)}
                      placeholder="PASS / WATCH / ARREARS"
                      className="w-full rounded-fc border border-cwc-border bg-white px-3 py-2 text-sm"
                    />
                  </label>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default BureauUploadModal;
