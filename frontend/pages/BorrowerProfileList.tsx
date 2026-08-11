import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
  const queryState = useMemo(() => ({
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

  return <div style={{ padding: '24px 32px 48px' }}>
    <div style={{ marginBottom: 20 }}><div style={{ display: 'flex', gap: 8, color: '#45464d', fontSize: 13 }}><Link to="/credit">Credit</Link><span>/</span><strong>Borrowers</strong></div><h1 style={{ margin: '6px 0 2px', fontSize: 26 }}>Borrower Management</h1><p style={{ margin: 0, color: '#64748b' }}>Search, review, and manage borrower relationships across the credit lifecycle.</p></div>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}><strong>{response.pagination.total.toLocaleString()} borrowers</strong>{canCreate && <button type="button" onClick={() => navigate('/credit/borrowers/new')} style={{ padding: '9px 14px', border: 0, borderRadius: 6, background: '#000', color: '#fff', cursor: 'pointer' }}>+ Create Borrower</button>}</div>
    <BorrowerKpiCards {...stats} />
    <BorrowerFilterBar filters={filters} onFilterChange={updateFilters} />
    <div style={{ background: '#fff', border: '1px solid #c6c6cd', borderRadius: 8, overflow: 'hidden' }}>
      {error ? <div role="alert" style={{ padding: 32, textAlign: 'center' }}><p>{error}</p><button type="button" onClick={() => void fetchBorrowers()}>Retry</button></div> : <BorrowerDataTable profiles={response.items} loading={loading} sortBy={queryState.sort} sortDirection={queryState.direction} canCreate={canCreate} canWrite={canWrite} onSort={onSort} onRowClick={(id) => setSelectedBorrower(response.items.find((item) => item.id === id) || null)} onNameClick={(id) => navigate(`/credit/borrowers/${id}`)} onActiveApplicationsClick={(id) => navigate(`/credit/applications?borrowerId=${encodeURIComponent(id)}&status=active`)} onActionClick={(id, action) => action === 'newApp' ? navigate(`/credit/applications/new?borrowerId=${encodeURIComponent(id)}`) : navigate(`/credit/borrowers/${id}`)} />}
      {!loading && !error && response.pagination.totalPages > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 12, borderTop: '1px solid #e1e2e6' }}><span style={{ color: '#64748b', fontSize: 13 }}>Page {response.pagination.page} of {response.pagination.totalPages}</span><div style={{ display: 'flex', gap: 4 }}><button type="button" disabled={queryState.page <= 1} onClick={() => goToPage(queryState.page - 1)}>Previous</button>{pageNumbers.map((page) => <button type="button" key={page} aria-current={page === queryState.page ? 'page' : undefined} onClick={() => goToPage(page)}>{page}</button>)}<button type="button" disabled={queryState.page >= response.pagination.totalPages} onClick={() => goToPage(queryState.page + 1)}>Next</button></div></div>}
    </div>
    {selectedBorrower && <aside style={{ position: 'fixed', right: 24, top: 96, width: 360, maxWidth: 'calc(100vw - 48px)', background: '#fff', border: '1px solid #c6c6cd', borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,.16)', zIndex: 30 }}><BorrowerQuickPreview borrower={selectedBorrower} onClose={() => setSelectedBorrower(null)} onOpen360={(id) => navigate(`/credit/borrowers/${id}`)} onNewApp={(id) => navigate(`/credit/applications/new?borrowerId=${encodeURIComponent(id)}`)} /></aside>}
  </div>;
};

export default BorrowerProfileList;
