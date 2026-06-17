import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import {
  collateralApi, guaranteeApi, Collateral, CollateralValuation, CollateralLien,
  InsuranceCover, Guarantee, CollateralType, GuaranteeType, CurrencyCode, LienStatus,
} from '../src/services/credit.service';
import creditService from '../src/services/credit.service';
import apiClient from '../src/services/api';
import { useAuth } from '../src/context/AuthContext';
import { hasPermission } from '../src/utils/permissions';

const formatCurrency = (val: number | null, currency = 'MYR') =>
  val != null ? new Intl.NumberFormat('en-MY', { style: 'currency', currency: currency as any, maximumFractionDigits: 0 }).format(val) : '—';
const formatDate = (d: string | null) =>
  d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

const COLLATERAL_TYPE_LABELS: Record<string, string> = {
  PROPERTY: 'Property', VEHICLE: 'Vehicle', FIXED_DEPOSIT: 'Fixed Deposit',
  SHARES: 'Shares', INSURANCE: 'Insurance', MACHINERY: 'Machinery',
  INVENTORY: 'Inventory', RECEIVABLES: 'Receivables', OTHER: 'Other',
};
const COLLATERAL_TYPES: CollateralType[] = ['PROPERTY', 'VEHICLE', 'FIXED_DEPOSIT', 'SHARES', 'INSURANCE', 'MACHINERY', 'INVENTORY', 'RECEIVABLES', 'OTHER'];
const GUARANTEE_TYPE_LABELS: Record<string, string> = {
  PERSONAL: 'Personal', CORPORATE: 'Corporate', BANK: 'Bank', GOVERNMENT: 'Government', OTHER: 'Other',
};
const GUARANTEE_TYPES: GuaranteeType[] = ['PERSONAL', 'CORPORATE', 'BANK', 'GOVERNMENT', 'OTHER'];
const CURRENCIES = ['MYR', 'USD', 'SGD', 'GBP', 'EUR', 'JPY', 'CNY', 'THB', 'IDR', 'AUD', 'HKD'] as const;

interface CrmContactOption {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
}

const CollateralManagement: React.FC = () => {
  const [searchParams] = useSearchParams();
  const applicationId = searchParams.get('applicationId') || '';
  const { user } = useAuth();

  const [collaterals, setCollaterals] = useState<Collateral[]>([]);
  const [guarantees, setGuarantees] = useState<Guarantee[]>([]);
  const [application, setApplication] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [expandedCollateralId, setExpandedCollateralId] = useState<string | null>(null);

  // Sub-data for expanded collateral
  const [valuations, setValuations] = useState<CollateralValuation[]>([]);
  const [liens, setLiens] = useState<CollateralLien[]>([]);
  const [insuranceCovers, setInsuranceCovers] = useState<InsuranceCover[]>([]);

  // Collateral form
  const [showCollateralDialog, setShowCollateralDialog] = useState(false);
  const [collateralForm, setCollateralForm] = useState({
    collateralType: 'PROPERTY' as CollateralType,
    description: '',
    ownershipDoc: '',
    registeredOwner: '',
  });
  const [savingCollateral, setSavingCollateral] = useState(false);

  // Valuation form
  const [showValuationDialog, setShowValuationDialog] = useState(false);
  const [valuationForm, setValuationForm] = useState({
    valuedAmount: 0, currency: 'MYR' as CurrencyCode, valuedAt: '', valuer: '', notes: '',
  });
  const [savingValuation, setSavingValuation] = useState(false);

  // Lien form
  const [showLienDialog, setShowLienDialog] = useState(false);
  const [lienForm, setLienForm] = useState({
    lienHolder: '', lienAmount: 0, currency: 'MYR' as CurrencyCode, notes: '',
  });
  const [savingLien, setSavingLien] = useState(false);

  // Insurance form
  const [showInsuranceDialog, setShowInsuranceDialog] = useState(false);
  const [insuranceForm, setInsuranceForm] = useState({
    insurerName: '', policyNumber: '', coverAmount: 0, currency: 'MYR' as CurrencyCode, validFrom: '', validTo: '',
  });
  const [savingInsurance, setSavingInsurance] = useState(false);

  // Guarantee form
  const [showGuaranteeDialog, setShowGuaranteeDialog] = useState(false);
  const [guaranteeForm, setGuaranteeForm] = useState({
    guarantorId: '', guarantorName: '', guaranteeType: 'PERSONAL' as GuaranteeType,
    amount: 0, currency: 'MYR' as CurrencyCode, documentRef: '',
  });
  const [savingGuarantee, setSavingGuarantee] = useState(false);

  // Contact search for guarantor
  const [contactSearch, setContactSearch] = useState('');
  const [contactResults, setContactResults] = useState<CrmContactOption[]>([]);
  const [searchingContacts, setSearchingContacts] = useState(false);

  const canWrite = hasPermission(user, 'credit:write');

  const fetchData = useCallback(async () => {
    if (!applicationId) return;
    try {
      setLoading(true);
      const [cols, guars] = await Promise.all([
        collateralApi.list(applicationId),
        guaranteeApi.list(applicationId),
      ]);
      setCollaterals(cols);
      setGuarantees(guars);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [applicationId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Fetch application for breadcrumb context
  useEffect(() => {
    if (!applicationId) return;
    creditService.getApplication(applicationId)
      .then(app => setApplication(app))
      .catch(() => setApplication(null));
  }, [applicationId]);

  const fetchSubData = useCallback(async (collateralId: string) => {
    try {
      const [vals, ls, ins] = await Promise.all([
        collateralApi.listValuations(collateralId),
        collateralApi.listLiens(collateralId),
        collateralApi.listInsurance(collateralId),
      ]);
      setValuations(vals);
      setLiens(ls);
      setInsuranceCovers(ins);
    } catch (e) { console.error(e); }
  }, []);

  useEffect(() => {
    if (expandedCollateralId) fetchSubData(expandedCollateralId);
  }, [expandedCollateralId, fetchSubData]);

  const toggleExpand = (id: string) => {
    setExpandedCollateralId(prev => prev === id ? null : id);
  };

  const handleCreateCollateral = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!applicationId) return;
    try {
      setSavingCollateral(true);
      await collateralApi.create(applicationId, {
        collateralType: collateralForm.collateralType,
        description: collateralForm.description,
        ownershipDoc: collateralForm.ownershipDoc || undefined,
        registeredOwner: collateralForm.registeredOwner || undefined,
      });
      setShowCollateralDialog(false);
      setCollateralForm({ collateralType: 'PROPERTY', description: '', ownershipDoc: '', registeredOwner: '' });
      fetchData();
    } catch (e) { console.error(e); }
    finally { setSavingCollateral(false); }
  };

  const handleDeleteCollateral = async (id: string) => {
    if (!confirm('Delete this collateral?')) return;
    try {
      await collateralApi.delete(id);
      if (expandedCollateralId === id) setExpandedCollateralId(null);
      fetchData();
    } catch (e) { console.error(e); }
  };

  const handleAddValuation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!expandedCollateralId) return;
    try {
      setSavingValuation(true);
      await collateralApi.addValuation(expandedCollateralId, {
        valuedAmount: valuationForm.valuedAmount,
        currency: valuationForm.currency,
        valuedAt: new Date(valuationForm.valuedAt).toISOString(),
        valuer: valuationForm.valuer || undefined,
        notes: valuationForm.notes || undefined,
      });
      setShowValuationDialog(false);
      setValuationForm({ valuedAmount: 0, currency: 'MYR', valuedAt: '', valuer: '', notes: '' });
      fetchSubData(expandedCollateralId);
    } catch (e) { console.error(e); }
    finally { setSavingValuation(false); }
  };

  const handleAddLien = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!expandedCollateralId) return;
    try {
      setSavingLien(true);
      await collateralApi.addLien(expandedCollateralId, {
        lienHolder: lienForm.lienHolder,
        lienAmount: lienForm.lienAmount || undefined,
        currency: lienForm.currency,
        notes: lienForm.notes || undefined,
      });
      setShowLienDialog(false);
      setLienForm({ lienHolder: '', lienAmount: 0, currency: 'MYR', notes: '' });
      fetchSubData(expandedCollateralId);
    } catch (e) { console.error(e); }
    finally { setSavingLien(false); }
  };

  const handleDischargeLien = async (lienId: string) => {
    if (!confirm('Discharge this lien?')) return;
    try {
      await collateralApi.dischargeLien(lienId);
      if (expandedCollateralId) fetchSubData(expandedCollateralId);
    } catch (e) { console.error(e); }
  };

  const handleAddInsurance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!expandedCollateralId) return;
    try {
      setSavingInsurance(true);
      await collateralApi.addInsurance(expandedCollateralId, {
        insurerName: insuranceForm.insurerName,
        policyNumber: insuranceForm.policyNumber,
        coverAmount: insuranceForm.coverAmount,
        currency: insuranceForm.currency,
        validFrom: new Date(insuranceForm.validFrom).toISOString(),
        validTo: new Date(insuranceForm.validTo).toISOString(),
      });
      setShowInsuranceDialog(false);
      setInsuranceForm({ insurerName: '', policyNumber: '', coverAmount: 0, currency: 'MYR', validFrom: '', validTo: '' });
      fetchSubData(expandedCollateralId);
    } catch (e) { console.error(e); }
    finally { setSavingInsurance(false); }
  };

  const handleCreateGuarantee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!applicationId) return;
    try {
      setSavingGuarantee(true);
      await guaranteeApi.create(applicationId, {
        guarantorId: guaranteeForm.guarantorId,
        guarantorName: guaranteeForm.guarantorName,
        guaranteeType: guaranteeForm.guaranteeType,
        amount: guaranteeForm.amount,
        currency: guaranteeForm.currency,
        documentRef: guaranteeForm.documentRef || undefined,
      });
      setShowGuaranteeDialog(false);
      setGuaranteeForm({ guarantorId: '', guarantorName: '', guaranteeType: 'PERSONAL', amount: 0, currency: 'MYR', documentRef: '' });
      fetchData();
    } catch (e) { console.error(e); }
    finally { setSavingGuarantee(false); }
  };

  const handleDeleteGuarantee = async (id: string) => {
    if (!confirm('Delete this guarantee?')) return;
    try {
      await guaranteeApi.delete(id);
      fetchData();
    } catch (e) { console.error(e); }
  };

  const searchContacts = async (query: string) => {
    setContactSearch(query);
    if (query.length < 2) { setContactResults([]); return; }
    try {
      setSearchingContacts(true);
      const res = await apiClient.get('/crm/contacts', { params: { search: query, limit: 10 } });
      const contacts = res.data.data?.contacts || [];
      setContactResults(contacts.map((c: any) => ({
        id: c.id, firstName: c.firstName, lastName: c.lastName, email: c.email,
      })));
    } catch (e) { console.error(e); }
    finally { setSearchingContacts(false); }
  };

  const selectContact = (contact: CrmContactOption) => {
    setGuaranteeForm(f => ({
      ...f,
      guarantorId: contact.id,
      guarantorName: `${contact.firstName} ${contact.lastName}`,
    }));
    setContactSearch(`${contact.firstName} ${contact.lastName}`);
    setContactResults([]);
  };

  if (!applicationId) {
    return (
      <>
        <div className="px-4 sm:px-8 py-8">
          <div className="text-center py-12 text-text-secondary bg-bg-surface border border-border rounded-xl">
            <span className="material-symbols-outlined text-5xl block mb-3 opacity-30">lock</span>
            <p className="font-semibold">No application selected</p>
            <p className="text-sm mt-1">Please access this page from an application detail page.</p>
            <Link to="/credit/applications" className="text-sm text-brand-700 hover:underline mt-2 inline-block"
              style={{ textDecoration: 'none' }}>Go to Applications</Link>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <div style={{ maxWidth: 1200, margin: '0 auto', paddingBottom: '3rem' }} className="px-4 sm:px-8 py-4 sm:py-8">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-text-secondary mb-4">
          <Link to="/credit" style={{ textDecoration: 'none', color: 'inherit' }} className="hover:text-brand-700">Credit</Link>
          <span>/</span>
          <Link to="/credit/applications" style={{ textDecoration: 'none', color: 'inherit' }} className="hover:text-brand-700">Applications</Link>
          <span>/</span>
          <Link to={`/credit/applications/${applicationId}`} style={{ textDecoration: 'none', color: 'inherit' }} className="hover:text-brand-700">
            {application?.borrowerProfile?.account?.name
              || (application?.borrowerProfile?.contact
                ? `${application.borrowerProfile.contact.firstName} ${application.borrowerProfile.contact.lastName}`
                : application?.borrowerProfile?.name || applicationId.slice(0, 8))}
          </Link>
          <span>/</span>
          <span className="font-semibold text-text-primary">Collateral & Guarantees</span>
        </div>

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-black text-text-primary">Collateral & Guarantees</h1>
            <p className="text-sm text-text-secondary mt-1">Manage collateral, valuations, liens, insurance, and guarantees for this application</p>
          </div>
        </div>

        {/* Collateral Section */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-black text-text-primary flex items-center gap-2">
              <span className="material-symbols-outlined text-brand-700">real_estate_agent</span>
              Collateral
            </h2>
            {canWrite && (
              <button onClick={() => setShowCollateralDialog(true)}
                className="flex items-center gap-1.5 bg-brand-700 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-brand-800 transition-colors"
                style={{ border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
                <span className="material-symbols-outlined text-base">add</span> Add Collateral
              </button>
            )}
          </div>

          {loading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <div key={i} style={{ height: 60, borderRadius: 12, background: 'var(--bg-subtle)', animation: 'pulse 1.5s infinite' }} />
              ))}
            </div>
          ) : collaterals.length === 0 ? (
            <div className="text-center py-8 text-text-secondary bg-bg-surface border border-border rounded-xl">
              <span className="material-symbols-outlined text-4xl block mb-2 opacity-30">real_estate_agent</span>
              <p className="font-semibold text-sm">No collateral recorded</p>
            </div>
          ) : (
            <div className="space-y-3">
              {collaterals.map(col => {
                const isExpanded = expandedCollateralId === col.id;
                return (
                  <div key={col.id} className="bg-bg-surface border border-border rounded-xl overflow-hidden">
                    {/* Collateral Row */}
                    <button onClick={() => toggleExpand(col.id)}
                      className="w-full flex items-center gap-4 px-5 py-4 text-left hover:bg-bg-subtle transition-colors"
                      style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
                      <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600 shrink-0">
                        <span className="material-symbols-outlined text-lg">category</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700">
                            {COLLATERAL_TYPE_LABELS[col.collateralType] || col.collateralType}
                          </span>
                          <p className="font-semibold text-text-primary text-sm truncate">{col.description}</p>
                        </div>
                        <p className="text-xs text-text-secondary mt-0.5">
                          Owner: {col.registeredOwner || '—'}
                          {col.ownershipDoc && ` · Doc: ${col.ownershipDoc}`}
                        </p>
                      </div>
                      {canWrite && (
                        <button onClick={e => { e.stopPropagation(); handleDeleteCollateral(col.id); }}
                          className="text-red-500 hover:text-red-700 transition-colors"
                          style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                          <span className="material-symbols-outlined text-base">delete</span>
                        </button>
                      )}
                      <span className={`material-symbols-outlined text-lg text-text-secondary transition-transform ${isExpanded ? 'rotate-180' : ''}`}>
                        expand_more
                      </span>
                    </button>

                    {/* Expanded Detail */}
                    {isExpanded && (
                      <div className="border-t border-border px-5 py-4" onClick={e => e.stopPropagation()}>
                        {/* Valuations */}
                        <div className="mb-6">
                          <div className="flex items-center justify-between mb-2">
                            <h5 className="text-xs font-bold text-text-secondary uppercase tracking-wider">Valuations</h5>
                            {canWrite && (
                              <button onClick={() => setShowValuationDialog(true)}
                                className="flex items-center gap-1 text-xs font-bold text-brand-700 hover:underline"
                                style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
                                <span className="material-symbols-outlined text-sm">add</span> Add Valuation
                              </button>
                            )}
                          </div>
                          {valuations.length === 0 ? (
                            <p className="text-sm text-text-secondary py-2">No valuations recorded.</p>
                          ) : (
                            <div className="overflow-x-auto">
                              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead>
                                  <tr style={{ background: 'var(--color-surface-muted)' }}>
                                    {['Amount', 'Currency', 'Valued At', 'Valuer', 'Notes'].map(h => (
                                      <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{h}</th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody>
                                  {valuations.map(v => (
                                    <tr key={v.id} style={{ borderTop: '1px solid var(--color-border-subtle)' }}>
                                      <td style={{ padding: '8px 12px', fontSize: 13, fontWeight: 600 }}>{formatCurrency(v.valuedAmount, v.currency)}</td>
                                      <td style={{ padding: '8px 12px', fontSize: 13 }}>{v.currency}</td>
                                      <td style={{ padding: '8px 12px', fontSize: 13 }}>{formatDate(v.valuedAt)}</td>
                                      <td style={{ padding: '8px 12px', fontSize: 13 }}>{v.valuer || '—'}</td>
                                      <td style={{ padding: '8px 12px', fontSize: 13 }} className="truncate max-w-[200px]">{v.notes || '—'}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>

                        {/* Liens */}
                        <div className="mb-6">
                          <div className="flex items-center justify-between mb-2">
                            <h5 className="text-xs font-bold text-text-secondary uppercase tracking-wider">Liens</h5>
                            {canWrite && (
                              <button onClick={() => setShowLienDialog(true)}
                                className="flex items-center gap-1 text-xs font-bold text-brand-700 hover:underline"
                                style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
                                <span className="material-symbols-outlined text-sm">add</span> Add Lien
                              </button>
                            )}
                          </div>
                          {liens.length === 0 ? (
                            <p className="text-sm text-text-secondary py-2">No liens recorded.</p>
                          ) : (
                            <div className="overflow-x-auto">
                              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead>
                                  <tr style={{ background: 'var(--color-surface-muted)' }}>
                                    {['Lien Holder', 'Amount', 'Status', 'Registered', 'Discharged', 'Actions'].map(h => (
                                      <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{h}</th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody>
                                  {liens.map(l => (
                                    <tr key={l.id} style={{ borderTop: '1px solid var(--color-border-subtle)' }}>
                                      <td style={{ padding: '8px 12px', fontSize: 13, fontWeight: 500 }}>{l.lienHolder}</td>
                                      <td style={{ padding: '8px 12px', fontSize: 13 }}>{l.lienAmount ? formatCurrency(l.lienAmount, l.currency) : '—'}</td>
                                      <td style={{ padding: '8px 12px', fontSize: 13 }}>
                                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${l.status === 'ACTIVE' ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
                                          {l.status}
                                        </span>
                                      </td>
                                      <td style={{ padding: '8px 12px', fontSize: 13 }}>{formatDate(l.registeredAt)}</td>
                                      <td style={{ padding: '8px 12px', fontSize: 13 }}>{formatDate(l.dischargedAt)}</td>
                                      <td style={{ padding: '8px 12px' }}>
                                        {canWrite && l.status === 'ACTIVE' && (
                                          <button onClick={() => handleDischargeLien(l.id)}
                                            className="flex items-center gap-1 text-xs font-bold text-green-700 bg-green-50 border border-green-200 rounded px-2 py-1 hover:bg-green-100 transition-colors"
                                            style={{ cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
                                            Discharge
                                          </button>
                                        )}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>

                        {/* Insurance */}
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <h5 className="text-xs font-bold text-text-secondary uppercase tracking-wider">Insurance</h5>
                            {canWrite && (
                              <button onClick={() => setShowInsuranceDialog(true)}
                                className="flex items-center gap-1 text-xs font-bold text-brand-700 hover:underline"
                                style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
                                <span className="material-symbols-outlined text-sm">add</span> Add Insurance
                              </button>
                            )}
                          </div>
                          {insuranceCovers.length === 0 ? (
                            <p className="text-sm text-text-secondary py-2">No insurance recorded.</p>
                          ) : (
                            <div className="overflow-x-auto">
                              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead>
                                  <tr style={{ background: 'var(--color-surface-muted)' }}>
                                    {['Insurer', 'Policy #', 'Cover Amount', 'Valid From', 'Valid To'].map(h => (
                                      <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{h}</th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody>
                                  {insuranceCovers.map(ic => (
                                    <tr key={ic.id} style={{ borderTop: '1px solid var(--color-border-subtle)' }}>
                                      <td style={{ padding: '8px 12px', fontSize: 13 }}>{ic.insurerName}</td>
                                      <td style={{ padding: '8px 12px', fontSize: 13 }}>{ic.policyNumber}</td>
                                      <td style={{ padding: '8px 12px', fontSize: 13, fontWeight: 600 }}>{formatCurrency(ic.coverAmount, ic.currency)}</td>
                                      <td style={{ padding: '8px 12px', fontSize: 13 }}>{formatDate(ic.validFrom)}</td>
                                      <td style={{ padding: '8px 12px', fontSize: 13 }}>{formatDate(ic.validTo)}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Guarantees Section */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-black text-text-primary flex items-center gap-2">
              <span className="material-symbols-outlined text-brand-700">verified_user</span>
              Guarantees
            </h2>
            {canWrite && (
              <button onClick={() => setShowGuaranteeDialog(true)}
                className="flex items-center gap-1.5 bg-brand-700 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-brand-800 transition-colors"
                style={{ border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
                <span className="material-symbols-outlined text-base">add</span> Add Guarantee
              </button>
            )}
          </div>

          {loading ? (
            <div className="space-y-3">
              {[...Array(2)].map((_, i) => (
                <div key={i} style={{ height: 60, borderRadius: 12, background: 'var(--bg-subtle)', animation: 'pulse 1.5s infinite' }} />
              ))}
            </div>
          ) : guarantees.length === 0 ? (
            <div className="text-center py-8 text-text-secondary bg-bg-surface border border-border rounded-xl">
              <span className="material-symbols-outlined text-4xl block mb-2 opacity-30">verified_user</span>
              <p className="font-semibold text-sm">No guarantees recorded</p>
            </div>
          ) : (
            <div className="bg-bg-surface border border-border rounded-xl overflow-hidden">
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'var(--color-surface-muted)' }}>
                    {['Guarantor', 'Type', 'Amount', 'Currency', 'Doc Ref', 'Actions'].map(h => (
                      <th key={h} style={{ padding: 'var(--space-3) var(--space-5)', textAlign: 'left', fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {guarantees.map(g => (
                    <tr key={g.id} style={{ borderTop: '1px solid var(--color-border-subtle)' }}>
                      <td style={{ padding: 'var(--space-3) var(--space-5)', fontSize: 'var(--text-sm)', fontWeight: 500 }}>{g.guarantorName}</td>
                      <td style={{ padding: 'var(--space-3) var(--space-5)', fontSize: 'var(--text-sm)' }}>
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-brand-50 text-brand-700">
                          {GUARANTEE_TYPE_LABELS[g.guaranteeType] || g.guaranteeType}
                        </span>
                      </td>
                      <td style={{ padding: 'var(--space-3) var(--space-5)', fontSize: 'var(--text-sm)', fontWeight: 600 }}>{formatCurrency(g.amount, g.currency)}</td>
                      <td style={{ padding: 'var(--space-3) var(--space-5)', fontSize: 'var(--text-sm)' }}>{g.currency}</td>
                      <td style={{ padding: 'var(--space-3) var(--space-5)', fontSize: 'var(--text-sm)' }}>{g.documentRef || '—'}</td>
                      <td style={{ padding: 'var(--space-3) var(--space-5)' }}>
                        {canWrite && (
                          <button onClick={() => handleDeleteGuarantee(g.id)}
                            className="text-red-500 hover:text-red-700 transition-colors"
                            style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                            <span className="material-symbols-outlined text-base">delete</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Add Collateral Dialog */}
      {showCollateralDialog && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center" onClick={() => setShowCollateralDialog(false)}>
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-black text-text-primary mb-4">Add Collateral</h2>
            <form onSubmit={handleCreateCollateral} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1">Type *</label>
                <select required value={collateralForm.collateralType} onChange={e => setCollateralForm(f => ({ ...f, collateralType: e.target.value as CollateralType }))}
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm" style={{ fontFamily: 'var(--font-sans)' }}>
                  {COLLATERAL_TYPES.map(t => <option key={t} value={t}>{COLLATERAL_TYPE_LABELS[t]}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1">Description *</label>
                <textarea required rows={2} value={collateralForm.description} onChange={e => setCollateralForm(f => ({ ...f, description: e.target.value }))}
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm resize-none" style={{ fontFamily: 'var(--font-sans)', background: '#fff' }} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1">Ownership Document</label>
                <input value={collateralForm.ownershipDoc} onChange={e => setCollateralForm(f => ({ ...f, ownershipDoc: e.target.value }))}
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm" style={{ background: '#fff' }} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1">Registered Owner</label>
                <input value={collateralForm.registeredOwner} onChange={e => setCollateralForm(f => ({ ...f, registeredOwner: e.target.value }))}
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm" style={{ background: '#fff' }} />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowCollateralDialog(false)}
                  className="px-4 py-2 text-sm font-semibold rounded-lg border border-border hover:bg-bg-subtle transition-colors"
                  style={{ background: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>Cancel</button>
                <button type="submit" disabled={savingCollateral}
                  className="px-4 py-2 text-sm font-bold rounded-lg bg-brand-700 text-white hover:bg-brand-800 transition-colors disabled:opacity-50"
                  style={{ border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
                  {savingCollateral ? 'Saving...' : 'Add Collateral'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Valuation Dialog */}
      {showValuationDialog && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center" onClick={() => setShowValuationDialog(false)}>
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-black text-text-primary mb-4">Add Valuation</h2>
            <form onSubmit={handleAddValuation} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-text-secondary mb-1">Valued Amount *</label>
                  <input required type="number" min="0" value={valuationForm.valuedAmount || ''} onChange={e => setValuationForm(f => ({ ...f, valuedAmount: Number(e.target.value) }))}
                    className="w-full border border-border rounded-lg px-3 py-2 text-sm" style={{ background: '#fff' }} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-text-secondary mb-1">Currency *</label>
                  <select required value={valuationForm.currency} onChange={e => setValuationForm(f => ({ ...f, currency: e.target.value as CurrencyCode }))}
                    className="w-full border border-border rounded-lg px-3 py-2 text-sm" style={{ fontFamily: 'var(--font-sans)' }}>
                    {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1">Valued At *</label>
                <input required type="date" value={valuationForm.valuedAt} onChange={e => setValuationForm(f => ({ ...f, valuedAt: e.target.value }))}
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm" style={{ background: '#fff' }} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1">Valuer</label>
                <input value={valuationForm.valuer} onChange={e => setValuationForm(f => ({ ...f, valuer: e.target.value }))}
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm" style={{ background: '#fff' }} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1">Notes</label>
                <textarea rows={2} value={valuationForm.notes} onChange={e => setValuationForm(f => ({ ...f, notes: e.target.value }))}
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm resize-none" style={{ fontFamily: 'var(--font-sans)', background: '#fff' }} />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowValuationDialog(false)}
                  className="px-4 py-2 text-sm font-semibold rounded-lg border border-border hover:bg-bg-subtle transition-colors"
                  style={{ background: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>Cancel</button>
                <button type="submit" disabled={savingValuation}
                  className="px-4 py-2 text-sm font-bold rounded-lg bg-brand-700 text-white hover:bg-brand-800 transition-colors disabled:opacity-50"
                  style={{ border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
                  {savingValuation ? 'Saving...' : 'Add Valuation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Lien Dialog */}
      {showLienDialog && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center" onClick={() => setShowLienDialog(false)}>
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-black text-text-primary mb-4">Add Lien</h2>
            <form onSubmit={handleAddLien} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1">Lien Holder *</label>
                <input required value={lienForm.lienHolder} onChange={e => setLienForm(f => ({ ...f, lienHolder: e.target.value }))}
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm" style={{ background: '#fff' }} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-text-secondary mb-1">Lien Amount</label>
                  <input type="number" min="0" value={lienForm.lienAmount || ''} onChange={e => setLienForm(f => ({ ...f, lienAmount: Number(e.target.value) }))}
                    className="w-full border border-border rounded-lg px-3 py-2 text-sm" style={{ background: '#fff' }} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-text-secondary mb-1">Currency *</label>
                  <select required value={lienForm.currency} onChange={e => setLienForm(f => ({ ...f, currency: e.target.value as CurrencyCode }))}
                    className="w-full border border-border rounded-lg px-3 py-2 text-sm" style={{ fontFamily: 'var(--font-sans)' }}>
                    {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1">Notes</label>
                <textarea rows={2} value={lienForm.notes} onChange={e => setLienForm(f => ({ ...f, notes: e.target.value }))}
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm resize-none" style={{ fontFamily: 'var(--font-sans)', background: '#fff' }} />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowLienDialog(false)}
                  className="px-4 py-2 text-sm font-semibold rounded-lg border border-border hover:bg-bg-subtle transition-colors"
                  style={{ background: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>Cancel</button>
                <button type="submit" disabled={savingLien}
                  className="px-4 py-2 text-sm font-bold rounded-lg bg-brand-700 text-white hover:bg-brand-800 transition-colors disabled:opacity-50"
                  style={{ border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
                  {savingLien ? 'Saving...' : 'Add Lien'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Insurance Dialog */}
      {showInsuranceDialog && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center" onClick={() => setShowInsuranceDialog(false)}>
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-black text-text-primary mb-4">Add Insurance</h2>
            <form onSubmit={handleAddInsurance} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1">Insurer Name *</label>
                <input required value={insuranceForm.insurerName} onChange={e => setInsuranceForm(f => ({ ...f, insurerName: e.target.value }))}
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm" style={{ background: '#fff' }} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1">Policy Number *</label>
                <input required value={insuranceForm.policyNumber} onChange={e => setInsuranceForm(f => ({ ...f, policyNumber: e.target.value }))}
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm" style={{ background: '#fff' }} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-text-secondary mb-1">Cover Amount *</label>
                  <input required type="number" min="0" value={insuranceForm.coverAmount || ''} onChange={e => setInsuranceForm(f => ({ ...f, coverAmount: Number(e.target.value) }))}
                    className="w-full border border-border rounded-lg px-3 py-2 text-sm" style={{ background: '#fff' }} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-text-secondary mb-1">Currency *</label>
                  <select required value={insuranceForm.currency} onChange={e => setInsuranceForm(f => ({ ...f, currency: e.target.value as CurrencyCode }))}
                    className="w-full border border-border rounded-lg px-3 py-2 text-sm" style={{ fontFamily: 'var(--font-sans)' }}>
                    {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-text-secondary mb-1">Valid From *</label>
                  <input required type="date" value={insuranceForm.validFrom} onChange={e => setInsuranceForm(f => ({ ...f, validFrom: e.target.value }))}
                    className="w-full border border-border rounded-lg px-3 py-2 text-sm" style={{ background: '#fff' }} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-text-secondary mb-1">Valid To *</label>
                  <input required type="date" value={insuranceForm.validTo} onChange={e => setInsuranceForm(f => ({ ...f, validTo: e.target.value }))}
                    className="w-full border border-border rounded-lg px-3 py-2 text-sm" style={{ background: '#fff' }} />
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowInsuranceDialog(false)}
                  className="px-4 py-2 text-sm font-semibold rounded-lg border border-border hover:bg-bg-subtle transition-colors"
                  style={{ background: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>Cancel</button>
                <button type="submit" disabled={savingInsurance}
                  className="px-4 py-2 text-sm font-bold rounded-lg bg-brand-700 text-white hover:bg-brand-800 transition-colors disabled:opacity-50"
                  style={{ border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
                  {savingInsurance ? 'Saving...' : 'Add Insurance'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Guarantee Dialog */}
      {showGuaranteeDialog && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center" onClick={() => setShowGuaranteeDialog(false)}>
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-black text-text-primary mb-4">Add Guarantee</h2>
            <form onSubmit={handleCreateGuarantee} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1">Guarantor (Search Contacts) *</label>
                <input required value={contactSearch} onChange={e => searchContacts(e.target.value)}
                  placeholder="Search CRM contacts..."
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm" style={{ background: '#fff' }} />
                {searchingContacts && <p className="text-xs text-text-secondary mt-1">Searching...</p>}
                {contactResults.length > 0 && (
                  <div className="mt-1 border border-border rounded-lg bg-white max-h-40 overflow-y-auto">
                    {contactResults.map(c => (
                      <button key={c.id} type="button" onClick={() => selectContact(c)}
                        className="w-full text-left px-3 py-2 hover:bg-bg-subtle transition-colors border-b border-border last:border-0"
                        style={{ background: 'none', border: 'none', borderLeft: 'none', borderRight: 'none', cursor: 'pointer', fontSize: 13 }}>
                        <span className="font-medium text-text-primary">{c.firstName} {c.lastName}</span>
                        <span className="text-text-secondary text-xs ml-2">{c.email || ''}</span>
                      </button>
                    ))}
                  </div>
                )}
                {guaranteeForm.guarantorId && (
                  <p className="text-xs text-green-700 mt-1 font-semibold">Selected: {guaranteeForm.guarantorName}</p>
                )}
              </div>
              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1">Guarantee Type *</label>
                <select required value={guaranteeForm.guaranteeType} onChange={e => setGuaranteeForm(f => ({ ...f, guaranteeType: e.target.value as GuaranteeType }))}
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm" style={{ fontFamily: 'var(--font-sans)' }}>
                  {GUARANTEE_TYPES.map(t => <option key={t} value={t}>{GUARANTEE_TYPE_LABELS[t]}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-text-secondary mb-1">Amount *</label>
                  <input required type="number" min="0" value={guaranteeForm.amount || ''} onChange={e => setGuaranteeForm(f => ({ ...f, amount: Number(e.target.value) }))}
                    className="w-full border border-border rounded-lg px-3 py-2 text-sm" style={{ background: '#fff' }} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-text-secondary mb-1">Currency *</label>
                  <select required value={guaranteeForm.currency} onChange={e => setGuaranteeForm(f => ({ ...f, currency: e.target.value as CurrencyCode }))}
                    className="w-full border border-border rounded-lg px-3 py-2 text-sm" style={{ fontFamily: 'var(--font-sans)' }}>
                    {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1">Document Reference</label>
                <input value={guaranteeForm.documentRef} onChange={e => setGuaranteeForm(f => ({ ...f, documentRef: e.target.value }))}
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm" style={{ background: '#fff' }} />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowGuaranteeDialog(false)}
                  className="px-4 py-2 text-sm font-semibold rounded-lg border border-border hover:bg-bg-subtle transition-colors"
                  style={{ background: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>Cancel</button>
                <button type="submit" disabled={!guaranteeForm.guarantorId || savingGuarantee}
                  className="px-4 py-2 text-sm font-bold rounded-lg bg-brand-700 text-white hover:bg-brand-800 transition-colors disabled:opacity-50"
                  style={{ border: 'none', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>
                  {savingGuarantee ? 'Saving...' : 'Add Guarantee'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};

export default CollateralManagement;