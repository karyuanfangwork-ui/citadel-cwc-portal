import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import creditService from '../src/services/credit.service';
import type { BorrowerListItem, BorrowerListQuery, BorrowerListResponse, BorrowerStatsResponse } from '../src/types/credit-ui.types';
import { useAuth } from '../src/context/AuthContext';
import { hasPermission } from '../src/utils/permissions';
import BorrowerKpiCards from '../src/components/credit/borrowers/BorrowerKpiCards';
import BorrowerFilterBar, { BorrowerFilterState } from '../src/components/credit/borrowers/BorrowerFilterBar';
import BorrowerDataTable from '../src/components/credit/borrowers/BorrowerDataTable';

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

  const handleActionClick = (id: string, action: string) => {
    const borrower = response.items.find((item) => item.id === id);
    if (action === 'newApp' && borrower?.dataQuality === 'INCOMPLETE') {
      const fields = borrower.missingFields.join(', ');
      if (!window.confirm(`This borrower is missing ${fields}. Create application anyway?`)) return;
    }
    if (action === 'newApp') navigate(`/credit/applications/new?borrowerId=${encodeURIComponent(id)}`);
    else navigate(`/credit/borrowers/${id}`);
  };

  return <div style={{ minWidth: 0, padding: '24px clamp(16px, 3vw, 32px) 40px', color: 'var(--cr-on-surface)' }}>
    <header aria-label="Borrower list heading" role="region" style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-end', gap: 16, marginBottom: 20 }}>
      <div style={{ minWidth: 0 }}>
        <nav aria-label="Breadcrumb" style={{ display: 'flex', gap: 8, color: 'var(--cr-on-surface-variant)', fontSize: 'var(--cr-text-body-sm)', lineHeight: 'var(--cr-leading-body-sm)' }}><Link to="/credit" style={{ color: 'inherit' }}>Credit</Link><span aria-hidden="true">/</span><strong>Borrowers</strong></nav>
        <h1 style={{ margin: '8px 0 4px', fontFamily: 'var(--cr-font-display)', fontSize: 'var(--cr-text-headline-lg)', fontWeight: 'var(--cr-fw-display)', letterSpacing: 'var(--cr-tracking-headline-lg)' }}>Borrower Management</h1>
        <p style={{ margin: 0, color: 'var(--cr-on-surface-variant)', fontSize: 'var(--cr-text-body-md)', lineHeight: 'var(--cr-leading-body-md)' }}>Search, review, and manage borrower relationships across the credit lifecycle.</p>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12 }}>
        <strong style={{ fontSize: 'var(--cr-text-body-lg)', fontVariantNumeric: 'tabular-nums' }}>{response.pagination.total.toLocaleString()} borrowers</strong>
        {canCreate && <button type="button" onClick={() => navigate('/credit/borrowers/new')} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, minHeight: 40, padding: '9px 14px', border: 0, borderRadius: 'var(--cr-radius)', background: 'var(--cr-primary)', color: 'var(--cr-on-primary)', cursor: 'pointer', fontFamily: 'var(--cr-font-body)', fontSize: 'var(--cr-text-body-md)', fontWeight: 'var(--cr-fw-label)' }}><span aria-hidden="true">+</span> Create Borrower</button>}
      </div>
    </header>
    <BorrowerKpiCards {...stats} scope="global" />
    <BorrowerFilterBar filters={filters} onFilterChange={updateFilters} />
    <div style={{ background: 'var(--cr-surface-container-lowest)', border: '1px solid var(--cr-outline-variant)', borderRadius: 'var(--cr-radius-lg)', overflow: 'hidden' }}>
      {error ? <div role="alert" style={{ padding: 32, textAlign: 'center' }}><p>{error}</p><button type="button" onClick={() => void fetchBorrowers()}>Retry</button></div> : <BorrowerDataTable profiles={response.items} loading={loading} sortBy={queryState.sort} sortDirection={queryState.direction} canCreate={canCreate} canWrite={canWrite} onSort={onSort} onRowClick={(id) => navigate(`/credit/borrowers/${id}`)} onNameClick={(id) => navigate(`/credit/borrowers/${id}`)} onActiveApplicationsClick={(id) => navigate(`/credit/applications?borrowerId=${encodeURIComponent(id)}&status=active`)} onActionClick={handleActionClick} onClearFilters={() => updateFilters({ search: '', segmentFilter: '', statusFilter: '', activeApplicationFilter: '' })} />}
      {!loading && !error && response.pagination.totalPages > 0 && <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 12, padding: 12, borderTop: '1px solid var(--cr-outline-variant)' }}><span style={{ color: 'var(--cr-on-surface-variant)', fontSize: 'var(--cr-text-body-sm)' }}>Page {response.pagination.page} of {response.pagination.totalPages}</span><div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}><button type="button" disabled={queryState.page <= 1} onClick={() => goToPage(queryState.page - 1)}>Previous</button>{pageNumbers.map((page) => <button type="button" key={page} aria-current={page === queryState.page ? 'page' : undefined} onClick={() => goToPage(page)}>{page}</button>)}<button type="button" disabled={queryState.page >= response.pagination.totalPages} onClick={() => goToPage(queryState.page + 1)}>Next</button></div></div>}
    </div>
  </div>;
};

export default BorrowerProfileList;
