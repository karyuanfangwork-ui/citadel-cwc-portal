import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import creditService from '../src/services/credit.service';
import type { BorrowerListItem, BorrowerListQuery, BorrowerListResponse, BorrowerStatsResponse } from '../src/types/credit-ui.types';
import { useAuth } from '../src/context/AuthContext';
import { hasPermission } from '../src/utils/permissions';
import BorrowerKpiCards from '../src/components/credit/borrowers/BorrowerKpiCards';
import BorrowerFilterBar, { BorrowerFilterState } from '../src/components/credit/borrowers/BorrowerFilterBar';
import BorrowerDataTable from '../src/components/credit/borrowers/BorrowerDataTable';
import BorrowerQuickPreview from '../src/components/credit/borrowers/BorrowerQuickPreview';

const parsePage = (value: string | null, fallback: number) => { const parsed = Number(value); return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback; };
const parseLimit = (value: string | null) => { const parsed = Number(value); return [20, 40, 60, 100].includes(parsed) ? parsed : 20; };

const BorrowerProfileList: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const canCreate = hasPermission(user, 'credit:create');
  const canWrite = hasPermission(user, 'credit:write');
  const queryState = React.useMemo(() => ({
    search: searchParams.get('q') || '',
    segment: searchParams.get('segment') || '',
    status: searchParams.get('status') || '',
    activeApplication: searchParams.get('activeApplication') || '',
    sort: searchParams.get('sort') || 'updatedAt',
    direction: searchParams.get('direction') === 'asc' ? 'asc' as const : 'desc' as const,
    page: parsePage(searchParams.get('page'), 1),
    limit: parseLimit(searchParams.get('limit')),
  }), [searchParams]);
  const [searchDraft, setSearchDraft] = useState(queryState.search);
  const [response, setResponse] = useState<BorrowerListResponse>({ items: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 0 }, appliedSort: { field: 'updatedAt', direction: 'desc' } });
  const [stats, setStats] = useState<BorrowerStatsResponse>({ total: 0, active: 0, individual: 0, sme: 0, corporate: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedBorrower, setSelectedBorrower] = useState<BorrowerListItem | null>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const dialogRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => setSearchDraft(queryState.search), [queryState.search]);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (searchDraft === queryState.search) return;
      const next = new URLSearchParams(searchParams);
      if (searchDraft.trim()) next.set('q', searchDraft.trim()); else next.delete('q');
      next.set('page', '1');
      setSearchParams(next, { replace: true });
    }, 300);
    return () => window.clearTimeout(timer);
  }, [searchDraft, queryState.search, searchParams, setSearchParams]);

  const fetchBorrowers = useCallback(async (signal?: AbortSignal) => {
    setLoading(true); setError(null);
    const query: BorrowerListQuery = {
      page: queryState.page,
      limit: queryState.limit,
      search: queryState.search || undefined,
      segment: (queryState.segment || undefined) as BorrowerListQuery['segment'],
      status: (queryState.status || undefined) as BorrowerListQuery['status'],
      hasActiveApplication: queryState.activeApplication === '' ? undefined : queryState.activeApplication === 'true',
      sortBy: queryState.sort as BorrowerListQuery['sortBy'],
      sortDirection: queryState.direction,
    };
    try { const result = await creditService.listBorrowers(query, signal); if (!signal?.aborted) setResponse(result); } catch (err: any) { if (!signal?.aborted && err?.code !== 'ERR_CANCELED' && err?.name !== 'CanceledError') setError('Unable to load borrowers.'); }
    finally { if (!signal?.aborted) setLoading(false); }
  }, [queryState]);

  useEffect(() => { const controller = new AbortController(); void fetchBorrowers(controller.signal); return () => controller.abort(); }, [fetchBorrowers]);
  useEffect(() => { creditService.getOperationalBorrowerStats().then(setStats).catch(() => undefined); }, []);

  const updateParams = (updates: Record<string, string | null>) => {
    const next = new URLSearchParams(searchParams);
    Object.entries(updates).forEach(([key, value]) => value ? next.set(key, value) : next.delete(key));
    setSearchParams(next, { replace: true });
  };
  const filters: BorrowerFilterState = { search: searchDraft, segmentFilter: queryState.segment, statusFilter: queryState.status, activeApplicationFilter: queryState.activeApplication };
  const updateFilters = (next: BorrowerFilterState) => {
    setSearchDraft(next.search);
    updateParams({ segment: next.segmentFilter || null, status: next.statusFilter || null, activeApplication: next.activeApplicationFilter || null, page: '1' });
  };
  const onSort = (field: NonNullable<BorrowerListQuery['sortBy']>) => updateParams({ sort: field, direction: queryState.sort === field && queryState.direction === 'asc' ? 'desc' : 'asc', page: '1' });
  const goToPage = (page: number) => updateParams({ page: String(page) });
  const pageNumbers = Array.from({ length: Math.min(response.pagination.totalPages, 7) }, (_, index) => index + 1);

  const handleRowClick = (id: string) => {
    triggerRef.current = document.activeElement as HTMLElement;
    setSelectedBorrower(response.items.find((item) => item.id === id) || null);
  };

  const handleClosePreview = useCallback(() => {
    setSelectedBorrower(null);
    // Restore focus to the trigger element
    requestAnimationFrame(() => {
      if (triggerRef.current && 'focus' in triggerRef.current) {
        triggerRef.current.focus();
      }
    });
  }, []);

  // Close drawer on Escape at page level (backup for the component-level handler)
  useEffect(() => {
    if (!selectedBorrower) return undefined;
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        handleClosePreview();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [selectedBorrower, handleClosePreview]);

  // Prevent background scroll when drawer is open
  useEffect(() => {
    if (selectedBorrower) {
      document.body.style.overflow = 'hidden';
      if (contentRef.current) contentRef.current.inert = true;
      return () => { document.body.style.overflow = ''; };
    }
    if (contentRef.current) contentRef.current.inert = false;
    return undefined;
  }, [selectedBorrower]);

  useEffect(() => {
    if (!selectedBorrower) return undefined;
    const dialog = dialogRef.current;
    if (!dialog) return undefined;
    const focusable = () => Array.from(dialog.querySelectorAll<HTMLElement>('button, a[href], [tabindex]:not([tabindex="-1"])')).filter((element) => !element.hasAttribute('disabled'));
    requestAnimationFrame(() => focusable()[0]?.focus());
    const handleTab = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;
      const elements = focusable();
      if (elements.length === 0) return;
      const first = elements[0];
      const last = elements[elements.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    dialog.addEventListener('keydown', handleTab);
    return () => dialog.removeEventListener('keydown', handleTab);
  }, [selectedBorrower]);

  const handleActionClick = (id: string, action: string) => {
    const borrower = response.items.find((item) => item.id === id);
    if (action === 'newApp' && borrower?.dataQuality === 'INCOMPLETE') {
      const fields = borrower.missingFields.join(', ');
      if (!window.confirm(`This borrower is missing ${fields}. Create application anyway?`)) return;
    }
    if (action === 'newApp') navigate(`/credit/applications/new?borrowerId=${encodeURIComponent(id)}`);
    else navigate(`/credit/borrowers/${id}`);
  };

  return <div style={{ padding: '24px 32px 48px' }}>
    <div ref={contentRef} aria-hidden={selectedBorrower ? true : undefined}>
    <div style={{ marginBottom: 20 }}><div style={{ display: 'flex', gap: 8, color: '#45464d', fontSize: 13 }}><Link to="/credit">Credit</Link><span>/</span><strong>Borrowers</strong></div><h1 style={{ margin: '6px 0 2px', fontSize: 26 }}>Borrower Management</h1><p style={{ margin: 0, color: '#64748b' }}>Search, review, and manage borrower relationships across the credit lifecycle.</p></div>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}><strong>{response.pagination.total.toLocaleString()} borrowers</strong>{canCreate && <button type="button" onClick={() => navigate('/credit/borrowers/new')} style={{ padding: '9px 14px', border: 0, borderRadius: 6, background: '#000', color: '#fff', cursor: 'pointer' }}>+ Create Borrower</button>}</div>
    <BorrowerKpiCards {...stats} scope="global" />
    <BorrowerFilterBar filters={filters} onFilterChange={updateFilters} />
    <div style={{ background: '#fff', border: '1px solid #c6c6cd', borderRadius: 8, overflow: 'hidden' }}>
      {error ? <div role="alert" style={{ padding: 32, textAlign: 'center' }}><p>{error}</p><button type="button" onClick={() => void fetchBorrowers()}>Retry</button></div> : <BorrowerDataTable profiles={response.items} loading={loading} sortBy={queryState.sort} sortDirection={queryState.direction} canCreate={canCreate} canWrite={canWrite} onSort={onSort} onRowClick={handleRowClick} onNameClick={(id) => navigate(`/credit/borrowers/${id}`)} onActiveApplicationsClick={(id) => navigate(`/credit/applications?borrowerId=${encodeURIComponent(id)}&status=active`)} onActionClick={handleActionClick} onClearFilters={() => updateFilters({ search: '', segmentFilter: '', statusFilter: '', activeApplicationFilter: '' })} />}
      {!loading && !error && response.pagination.totalPages > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 12, borderTop: '1px solid #e1e2e6' }}><span style={{ color: '#64748b', fontSize: 13 }}>Page {response.pagination.page} of {response.pagination.totalPages}</span><div style={{ display: 'flex', gap: 4 }}><button type="button" disabled={queryState.page <= 1} onClick={() => goToPage(queryState.page - 1)}>Previous</button>{pageNumbers.map((page) => <button type="button" key={page} aria-current={page === queryState.page ? 'page' : undefined} onClick={() => goToPage(page)}>{page}</button>)}<button type="button" disabled={queryState.page >= response.pagination.totalPages} onClick={() => goToPage(queryState.page + 1)}>Next</button></div></div>}
    </div>
    </div>

    {selectedBorrower && (
      <>
        {/* Translucent backdrop */}
        <div
          aria-hidden="true"
          onClick={handleClosePreview}
          style={{ position: 'fixed', inset: 0, zIndex: 40, background: 'rgba(0,0,0,0.4)' }}
        />
        {/* Drawer panel */}
        <div
          ref={dialogRef}
          style={{
            position: 'fixed',
            top: 0,
            right: 0,
            bottom: 0,
            width: 400,
            maxWidth: '100vw',
            background: '#fff',
            boxShadow: '-4px 0 24px rgba(0,0,0,0.12)',
            zIndex: 50,
            overflowY: 'auto',
            maxHeight: '100dvh',
          }}
        >
          <BorrowerQuickPreview
            borrower={selectedBorrower}
            onClose={handleClosePreview}
            onOpen360={(id) => { handleClosePreview(); navigate(`/credit/borrowers/${id}`); }}
            onNewApp={(id) => { handleClosePreview(); navigate(`/credit/applications/new?borrowerId=${encodeURIComponent(id)}`); }}
            canWrite={canWrite}
          />
        </div>
      </>
    )}
  </div>;
};

export default BorrowerProfileList;