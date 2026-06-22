import React, { useRef } from 'react';
import { FormData, UploadedDoc } from './BasicInfoStep';

interface DocumentUploadStepProps {
  formData: FormData;
  onFormDataChange: (updates: Partial<FormData>) => void;
}

interface DocSlot {
  class: string;
  label: string;
  mandatory: boolean;
}

const INDIVIDUAL_SLOTS: DocSlot[] = [
  { class: 'NRIC_PASSPORT', label: 'Identity Document (NRIC)', mandatory: true },
  { class: 'PAYSLIP', label: '3 Months Payslips', mandatory: true },
  { class: 'BANK_STATEMENT', label: 'Bank Statements (3 months)', mandatory: false },
];

const SME_SLOTS: DocSlot[] = [
  { class: 'SSM_CERT', label: 'SSM Certificate', mandatory: true },
  { class: 'BANK_STATEMENT', label: 'Bank Statements (6 months)', mandatory: true },
  { class: 'AUDITED_FINANCIALS', label: 'Audited Financials / Management Accounts', mandatory: true },
];

const ACCEPTED = '.pdf,.jpg,.jpeg,.png';

const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
};

const slotBoxStyle: React.CSSProperties = {
  backgroundColor: 'var(--cr-surface-container-lowest, #ffffff)',
  border: '1px dashed var(--cr-outline-variant, #c6c6cd)',
  borderRadius: 'var(--cr-radius-lg, 0.5rem)',
  padding: 16,
  display: 'flex',
  flexDirection: 'column',
  gap: 12,
};

const headerRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 8,
};

const labelStyle: React.CSSProperties = {
  fontFamily: 'var(--cr-font-display, Geist, system-ui, sans-serif)',
  fontSize: 'var(--cr-text-label-lg, 14px)',
  fontWeight: 700,
  color: 'var(--cr-on-surface, #191c1e)',
  margin: 0,
};

const uploadZoneStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 8,
  padding: '20px 12px',
  borderRadius: 'var(--cr-radius, 0.25rem)',
  border: '1px dashed var(--cr-outline, #76777d)',
  color: 'var(--cr-on-surface-variant, #45464d)',
  fontSize: 'var(--cr-text-body-sm, 13px)',
  cursor: 'pointer',
  textAlign: 'center',
  userSelect: 'none',
};

const fileRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 8,
  padding: '10px 12px',
  borderRadius: 'var(--cr-radius, 0.25rem)',
  backgroundColor: 'var(--cr-surface-container-high, #f0f0f3)',
};

const fileNameStyle: React.CSSProperties = {
  fontSize: 'var(--cr-text-body-sm, 13px)',
  color: 'var(--cr-on-surface, #191c1e)',
  fontWeight: 600,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

const fileSizeStyle: React.CSSProperties = {
  fontSize: 'var(--cr-text-label-sm, 11px)',
  color: 'var(--cr-on-surface-variant, #45464d)',
};

const removeBtnStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  padding: 4,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: 'var(--cr-error, #d93025)',
  flexShrink: 0,
};

const hiddenInputStyle: React.CSSProperties = { display: 'none' };

const DocumentUploadStep: React.FC<DocumentUploadStepProps> = ({
  formData,
  onFormDataChange,
}) => {
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const slots: DocSlot[] =
    formData.borrowerType === 'INDIVIDUAL' ? INDIVIDUAL_SLOTS : SME_SLOTS;

  const getDoc = (docClass: string): UploadedDoc | undefined =>
    formData.documents.find((d) => d.documentClass === docClass);

  const handleFileSelect = (slot: DocSlot, file: File | undefined) => {
    if (!file) return;
    const newDoc: UploadedDoc = {
      documentClass: slot.class,
      fileName: file.name,
      file,
    };
    // Replace any existing doc of same class, keep others
    const others = formData.documents.filter((d) => d.documentClass !== slot.class);
    onFormDataChange({ documents: [...others, newDoc] });
    // Reset input value so same file can be re-selected
    const input = inputRefs.current[slot.class];
    if (input) input.value = '';
  };

  const handleRemove = (slot: DocSlot) => {
    const remaining = formData.documents.filter((d) => d.documentClass !== slot.class);
    onFormDataChange({ documents: remaining });
    const input = inputRefs.current[slot.class];
    if (input) input.value = '';
  };

  const triggerInput = (docClass: string) => {
    inputRefs.current[docClass]?.click();
  };

  return (
    <div>
      {/* Section heading */}
      <div style={{ marginBottom: 24 }}>
        <span
          style={{
            fontFamily: 'var(--cr-font-display, Geist)',
            fontSize: 'var(--cr-text-label-md, 12px)',
            fontWeight: 700,
            color: 'var(--cr-secondary, #0051d5)',
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            marginRight: 8,
          }}
        >
          Section 09
        </span>
        <h2
          style={{
            fontFamily: 'var(--cr-font-display, Geist, system-ui, sans-serif)',
            fontSize: 'var(--cr-text-headline-md, 20px)',
            fontWeight: 600,
            color: 'var(--cr-on-surface, #191c1e)',
            margin: '4px 0 0',
          }}
        >
          Document Requirements
        </h2>
        <p
          style={{
            fontSize: 'var(--cr-text-body-md, 14px)',
            color: 'var(--cr-on-surface-variant, #45464d)',
            margin: '4px 0 0',
          }}
        >
          Upload the required supporting documents for this applicant. Accepted formats: PDF, JPG, PNG.
        </p>
      </div>

      {/* Upload slots grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
        {slots.map((slot) => {
          const existing = getDoc(slot.class);
          const showErrorIcon = slot.mandatory && !existing;
          return (
            <div key={slot.class} style={slotBoxStyle}>
              {/* Header row */}
              <div style={headerRowStyle}>
                <h3 style={labelStyle}>{slot.label}</h3>
                {showErrorIcon && (
                  <span
                    className="material-symbols-outlined"
                    style={{
                      fontSize: 20,
                      color: 'var(--cr-error, #d93025)',
                      flexShrink: 0,
                    }}
                    title="Required document"
                  >
                    error
                  </span>
                )}
                {slot.mandatory && existing && (
                  <span
                    className="material-symbols-outlined"
                    style={{
                      fontSize: 20,
                      color: 'var(--cr-success, #1e8e3e)',
                      flexShrink: 0,
                    }}
                    title="Uploaded"
                  >
                    check_circle
                  </span>
                )}
                {!slot.mandatory && (
                  <span
                    style={{
                      fontSize: 'var(--cr-text-label-sm, 11px)',
                      color: 'var(--cr-on-surface-variant, #45464d)',
                      fontStyle: 'italic',
                      flexShrink: 0,
                    }}
                  >
                    Optional
                  </span>
                )}
              </div>

              {/* Hidden file input */}
              <input
                ref={(el) => {
                  inputRefs.current[slot.class] = el;
                }}
                type="file"
                accept={ACCEPTED}
                style={hiddenInputStyle}
                onChange={(e) => handleFileSelect(slot, e.target.files?.[0])}
              />

              {/* Upload zone or file row */}
              {existing ? (
                <div style={fileRowStyle}>
                  <span
                    className="material-symbols-outlined"
                    style={{
                      fontSize: 20,
                      color: 'var(--cr-secondary, #0051d5)',
                      flexShrink: 0,
                    }}
                  >
                    description
                  </span>
                  <div style={{ minWidth: 0, flex: 1, display: 'flex', flexDirection: 'column' }}>
                    <span style={fileNameStyle} title={existing.fileName}>
                      {existing.fileName}
                    </span>
                    <span style={fileSizeStyle}>{formatFileSize(existing.file.size)}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemove(slot)}
                    style={removeBtnStyle}
                    title="Remove file"
                    aria-label="Remove file"
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 20 }}>
                      delete
                    </span>
                  </button>
                </div>
              ) : (
                <label
                  style={uploadZoneStyle}
                  onClick={() => triggerInput(slot.class)}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const file = e.dataTransfer.files?.[0];
                    if (file) handleFileSelect(slot, file);
                  }}
                >
                  <span
                    className="material-symbols-outlined"
                    style={{
                      fontSize: 22,
                      color: 'var(--cr-on-surface-variant, #45464d)',
                    }}
                  >
                    upload_file
                  </span>
                  Click or drag to upload PDF/JPG
                </label>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default DocumentUploadStep;