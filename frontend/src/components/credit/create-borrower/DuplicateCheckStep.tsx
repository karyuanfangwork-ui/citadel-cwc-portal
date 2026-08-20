import React, { useState, useCallback } from 'react';
import creditService, { BorrowerSearchResult } from '../../../services/credit.service';
import type { DuplicateIdentityResult } from '../../../types/credit-ui.types';

interface DuplicateCheckStepProps {
  onUseExisting: (borrowerId: string) => void;
  onProceed: () => void;
  onIdentityCheck?: (identifier: string) => Promise<void>;
  identityResult?: DuplicateIdentityResult | null;
  identityChecking?: boolean;
  identityError?: string | null;
  canProceed?: boolean;
  onRequestException?: (input: { category: string; justification: string }) => Promise<void>;
  exceptionRequesting?: boolean;
}

const BORROWER_TYPE_LABELS: Record<string, string> = {
  INDIVIDUAL: 'Individual',
  CORPORATE: 'Corporate',
  SOLE_PROPRIETOR: 'Sole Proprietor',
  JOINT: 'Joint',
};

const DuplicateCheckStep: React.FC<DuplicateCheckStepProps> = ({ onUseExisting, onProceed, onIdentityCheck, identityResult, identityChecking, identityError, canProceed = true, onRequestException, exceptionRequesting }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<BorrowerSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [exceptionCategory, setExceptionCategory] = useState('DISTINCT PERSON');
  const [exceptionJustification, setExceptionJustification] = useState('');

  const handleSearch = useCallback(async () => {
    const q = query.trim();
    if (q.length < 2) return;
    setSearching(true);
    setHasSearched(true);
    try {
      const data = await creditService.searchBorrowers(q);
      setResults(data);
    } catch {
      setResults([]);
      setHasSearched(true);
    } finally {
      setSearching(false);
    }
  }, [query]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSearch();
    }
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    paddingLeft: 36,
    paddingRight: 16,
    paddingTop: 8,
    paddingBottom: 8,
    border: '1px solid var(--cr-outline, #76777d)',
    borderRadius: 'var(--cr-radius, 0.25rem)',
    fontSize: 'var(--cr-text-body-md, 14px)',
    fontFamily: 'var(--cr-font-body, Inter, system-ui, sans-serif)',
    backgroundColor: 'var(--cr-surface-container-lowest, #ffffff)',
    color: 'var(--cr-on-surface, #191c1e)',
    outline: 'none',
  };

  const searchBtnStyle: React.CSSProperties = {
    padding: '8px 20px',
    fontFamily: 'var(--cr-font-display, Geist, system-ui, sans-serif)',
    fontSize: 'var(--cr-text-label-md, 12px)',
    fontWeight: 700,
    backgroundColor: 'var(--cr-primary, #000000)',
    color: 'var(--cr-on-primary, #ffffff)',
    border: 'none',
    borderRadius: 'var(--cr-radius, 0.25rem)',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  };

  const tableHeaderStyle: React.CSSProperties = {
    padding: '10px 12px',
    fontSize: 'var(--cr-text-label-sm, 11px)',
    fontWeight: 600,
    color: 'var(--cr-on-surface-variant, #45464d)',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    borderBottom: '1px solid var(--cr-outline-variant, #c6c6cd)',
    textAlign: 'left',
  };

  const tableCellStyle: React.CSSProperties = {
    padding: '10px 12px',
    fontSize: 'var(--cr-text-body-sm, 13px)',
    color: 'var(--cr-on-surface, #191c1e)',
    borderBottom: '1px solid var(--cr-outline-variant, #c6c6cd)',
  };

  return (
    <div>
      {/* Section heading */}
      <div style={{ marginBottom: 24 }}>
        <span style={{ fontFamily: 'var(--cr-font-display, Geist)', fontSize: 'var(--cr-text-label-md, 12px)', fontWeight: 700, color: 'var(--cr-secondary, #0051d5)', textTransform: 'uppercase', letterSpacing: '0.1em', marginRight: 8 }}>
          Section 01
        </span>
        <h2 style={{ fontFamily: 'var(--cr-font-display, Geist, system-ui, sans-serif)', fontSize: 'var(--cr-text-headline-md, 20px)', fontWeight: 600, color: 'var(--cr-on-surface, #191c1e)', margin: '4px 0 0' }}>
          Duplicate Check
        </h2>
        <p style={{ fontSize: 'var(--cr-text-body-md, 14px)', color: 'var(--cr-on-surface-variant, #45464d)', margin: '4px 0 0' }}>
          Search existing borrower records before creating a new profile. The final server check remains the authoritative safety recheck.
        </p>
      </div>

      {/* Search bar */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <span className="material-symbols-outlined" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 18, color: 'var(--cr-on-surface-variant, #45464d)', pointerEvents: 'none' }}>
            search
          </span>
          <input
            type="text"
            value={query}
            onChange={e => { setQuery(e.target.value); setHasSearched(false); }}
            onKeyDown={handleKeyDown}
            placeholder="Search NRIC, Passport, CIF, Mobile or Email..."
            style={inputStyle}
            autoFocus
          />
        </div>
        <button onClick={handleSearch} disabled={query.trim().length < 2 || searching} style={{ ...searchBtnStyle, opacity: query.trim().length < 2 || searching ? 0.5 : 1, cursor: query.trim().length < 2 || searching ? 'not-allowed' : 'pointer' }}>
          {searching ? (
            <span className="material-symbols-outlined" style={{ fontSize: 16, animation: 'spin 1s linear infinite' }}>progress_activity</span>
          ) : null}
          Search Records
        </button>
      </div>

      {onIdentityCheck && (
        <div style={{ marginBottom: 16, padding: 16, border: '1px solid var(--cr-outline-variant, #c6c6cd)', borderRadius: 6, background: '#f8fafc' }}>
          <strong>Governed identity check</strong>
          <p style={{ margin: '4px 0 10px', fontSize: 13, color: '#45464d' }}>Run the server-side fingerprint check before continuing. Raw identity values are not returned or stored in the browser.</p>
          <button type="button" onClick={() => void onIdentityCheck(query.trim())} disabled={identityChecking || query.trim().length < 4} style={searchBtnStyle}>{identityChecking ? 'Checking…' : 'Check Identity'}</button>
          {identityError && <p role="alert" style={{ color: '#b42318', marginBottom: 0 }}>{identityError}</p>}
          {identityResult?.exactMatch && identityResult.match && (
            <div role="alert" style={{ marginTop: 12, padding: 12, background: '#fff4e5', border: '1px solid #f2c078', borderRadius: 6 }}>
              <strong>Possible exact match: {identityResult.match.name}</strong>
              <div>{identityResult.match.borrowerNumber} · {identityResult.match.maskedIdentifier}</div>
              {identityResult.exceptionRequestId ? <p style={{ marginBottom: 0 }}>Exception request status: {identityResult.exceptionStatus || 'PENDING'}. Continue only after approval.</p> : onRequestException && <div style={{ marginTop: 10 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700 }}>Exception category<input value={exceptionCategory} onChange={e => setExceptionCategory(e.target.value)} style={{ display: 'block', width: '100%', marginTop: 4, padding: 6 }} /></label>
                <label style={{ display: 'block', marginTop: 8, fontSize: 12, fontWeight: 700 }}>Justification<textarea value={exceptionJustification} onChange={e => setExceptionJustification(e.target.value)} minLength={20} rows={3} style={{ display: 'block', width: '100%', marginTop: 4, padding: 6 }} /></label>
                <button type="button" onClick={() => void onRequestException({ category: exceptionCategory, justification: exceptionJustification })} disabled={exceptionRequesting || exceptionJustification.trim().length < 20} style={{ ...searchBtnStyle, marginTop: 8, backgroundColor: '#b54708' }}>{exceptionRequesting ? 'Requesting…' : 'Request Duplicate Exception'}</button>
              </div>}
            </div>
          )}
          {identityResult && !identityResult.exactMatch && <p style={{ color: '#067647', marginBottom: 0 }}>No exact identity match found. You may continue.</p>}
        </div>
      )}

      {/* Results */}
      {hasSearched && !searching && results.length === 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '40px 24px', backgroundColor: 'var(--cr-surface-container-low, #f2f4f6)', borderRadius: 'var(--cr-radius-lg, 0.5rem)', border: '1px solid var(--cr-outline-variant, #c6c6cd)' }}>
          <span className="material-symbols-outlined" style={{ fontSize: 40, color: 'var(--cr-secondary, #0051d5)' }}>search_off</span>
          <p style={{ fontSize: 'var(--cr-text-body-md, 14px)', fontWeight: 600, color: 'var(--cr-on-surface, #191c1e)', margin: 0 }}>No matches found</p>
          <p style={{ fontSize: 'var(--cr-text-body-sm, 13px)', color: 'var(--cr-on-surface-variant, #45464d)', margin: 0 }}>No existing record matched this search. Complete the type-aware identity check before creating a new profile.</p>
          <button onClick={onProceed} disabled={!canProceed} style={{ ...searchBtnStyle, backgroundColor: 'var(--cr-secondary, #0051d5)', opacity: canProceed ? 1 : 0.5 }}>
            Continue after identity check
            <span className="material-symbols-outlined" style={{ fontSize: 16, marginLeft: 4 }}>arrow_forward</span>
          </button>
        </div>
      )}

      {results.length > 0 && (
        <div style={{ border: '1px solid var(--cr-outline-variant, #c6c6cd)', borderRadius: 'var(--cr-radius, 0.25rem)', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ backgroundColor: 'var(--cr-surface-container, #eceef0)' }}>
                <th style={tableHeaderStyle}>Full Name</th>
                <th style={tableHeaderStyle}>Type</th>
                <th style={tableHeaderStyle}>ID / Reg No</th>
                <th style={tableHeaderStyle}>KYC Status</th>
                <th style={{ ...tableHeaderStyle, textAlign: 'center' }}>Apps</th>
                <th style={{ ...tableHeaderStyle, textAlign: 'right' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {results.map(r => (
                <tr key={r.id} style={{ backgroundColor: 'var(--cr-surface-container-lowest, #ffffff)' }}>
                  <td style={{ ...tableCellStyle, fontWeight: 600 }}>{r.name}</td>
                  <td style={tableCellStyle}>{BORROWER_TYPE_LABELS[r.borrowerType] || r.borrowerType}</td>
                  <td style={{ ...tableCellStyle, fontFamily: 'var(--cr-font-display, Geist, monospace)', fontSize: 'var(--cr-text-body-sm, 13px)' }}>
                    {r.nricPassport || r.registrationNumber || '—'}
                  </td>
                  <td style={tableCellStyle}>
                    {r.kycVerified ? (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 9999, fontSize: 'var(--cr-text-label-sm, 11px)', fontWeight: 700, backgroundColor: '#dcfce7', color: '#166534', border: '1px solid #bbf7d0' }}>
                        <span className="material-symbols-outlined" style={{ fontSize: 12 }}>check_circle</span>
                        VERIFIED
                      </span>
                    ) : (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 9999, fontSize: 'var(--cr-text-label-sm, 11px)', fontWeight: 700, backgroundColor: 'var(--cr-surface-container, #eceef0)', color: 'var(--cr-on-surface-variant, #45464d)' }}>
                        PENDING
                      </span>
                    )}
                  </td>
                  <td style={{ ...tableCellStyle, textAlign: 'center' }}>
                    {r.applicationCount ?? 0}
                  </td>
                  <td style={{ ...tableCellStyle, textAlign: 'right' }}>
                    <button
                      onClick={() => onUseExisting(r.id)}
                      style={{ fontSize: 'var(--cr-text-label-md, 12px)', fontWeight: 700, color: 'var(--cr-secondary, #0051d5)', background: 'none', border: 'none', cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.05em' }}
                    >
                      Use Existing
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Skip link */}
      {(!hasSearched || (hasSearched && results.length === 0 && !searching)) && (
        <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end' }}>
          <button
            onClick={onProceed}
            disabled={!canProceed}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              padding: '6px 14px',
              fontFamily: 'var(--cr-font-body, Inter, system-ui, sans-serif)',
              fontSize: 'var(--cr-text-label-md, 12px)',
              fontWeight: 600,
              backgroundColor: 'transparent',
              color: 'var(--cr-on-surface-variant, #45464d)',
              border: '1px solid var(--cr-outline-variant, #c6c6cd)',
              borderRadius: 'var(--cr-radius, 0.25rem)',
              cursor: canProceed ? 'pointer' : 'not-allowed',
              opacity: canProceed ? 1 : 0.5,
            }}
          >
            {canProceed ? 'Continue after identity check' : 'Complete identity check to continue'}
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>arrow_forward</span>
          </button>
        </div>
      )}
    </div>
  );
};

export default DuplicateCheckStep;