import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import creditService, { Pagination } from '../src/services/credit.service';
import { useAuth } from '../src/context/AuthContext';
import { hasPermission } from '../src/utils/permissions';
import BorrowerKpiCards from '../src/components/credit/borrowers/BorrowerKpiCards';
import BorrowerFilterBar, { BorrowerFilterState } from '../src/components/credit/borrowers/BorrowerFilterBar';
import BorrowerDataTable, { BorrowerProfileRow } from '../src/components/credit/borrowers/BorrowerDataTable';
import BorrowerQuickPreview from '../src/components/credit/borrowers/BorrowerQuickPreview';

const BorrowerProfileList: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const accountIdFilter = searchParams.get('accountId') || '';

  const [profiles, setProfiles] = useState<BorrowerProfileRow[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [selectedBorrower, setSelectedBorrower] = useState<BorrowerProfileRow | null>(null);

  const [filters, setFilters] = useState<BorrowerFilterState>({
    search: '',
    typeFilter: '',
    statusFilter: '',
    riskFilter: '',
  });

  const canCreate = hasPermission(user, 'credit:create');

  // KPI data — populated from /borrowers/stats endpoint
  const [kpiData, setKpiData] = useState({ total: 0, active: 0, pendingKyc: 0, watchlist: 0 });

  const fetchProfiles = useCallback(async (page = 1) => {
    try {
      setLoading(true);
      const data = await creditService.listBorrowerProfiles({
        page,
        limit: 20,
        search: filters.search || undefined,
        borrowerType: filters.typeFilter || undefined,
        accountId: accountIdFilter || undefined,
      });
      setProfiles((data.profiles as unknown) as BorrowerProfileRow[]);
      setPagination(data.pagination);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [filters.search, filters.typeFilter, accountIdFilter]);

  // Fetch KPI stats
  useEffect(() => {
    creditService.getBorrowerStats()
      .then(stats => setKpiData(stats))
      .catch(() => { /* KPI non-critical, silently fail */ });
  }, []);

  useEffect(() => { fetchProfiles(); }, [fetchProfiles]);

  const handleRowClick = (id: string) => {
    // On desktop xl+: select for quick preview; on smaller: navigate
    const borrower = profiles.find(p => p.id === id);
    if (borrower) setSelectedBorrower(borrower);
  };

  const handleNameClick = (id: string) => {
    navigate(`/credit/borrowers/${id}`);
  };

  const handleActionClick = (id: string, action: string) => {
    switch (action) {
      case 'view':
      case 'edit':
        navigate(`/credit/borrowers/${id}`);
        break;
      case 'newApp':
        navigate(`/credit/applications/new?borrowerId=${id}`);
        break;
    }
  };

  const handleOpen360 = (id: string) => {
    navigate(`/credit/borrowers/${id}`);
  };

  const handleNewApp = (id: string) => {
    navigate(`/credit/applications/new?borrowerId=${id}`);
  };

  const handleExport = () => {
    console.log('Export not yet implemented');
  };

  // Pagination helpers
  const currentPage = pagination.page;
  const totalPages = pagination.totalPages;
  const totalItems = pagination.total;
  const startItem = totalItems === 0 ? 0 : (currentPage - 1) * 20 + 1;
  const endItem = Math.min(currentPage * 20, totalItems);

  const getPageNumbers = (): (number | '...')[] => {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
    const pages: (number | '...')[] = [1];
    if (currentPage > 3) pages.push('...');
    for (let i = Math.max(2, currentPage - 1); i <= Math.min(totalPages - 1, currentPage + 1); i++) {
      pages.push(i);
    }
    if (currentPage < totalPages - 2) pages.push('...');
    pages.push(totalPages);
    return pages;
  };

  return (
    <>
      <div style={{ padding: '24px 32px 48px' }}>
        {/* ── Header ── */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px', marginBottom: '20px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: 'var(--cr-text-body-sm, 13px)', color: 'var(--cr-on-surface-variant, #45464d)', marginBottom: '4px' }}>
              <Link to="/credit" style={{ textDecoration: 'none', color: 'inherit' }}>Credit</Link>
              <span>/</span>
              <span style={{ fontWeight: 600, color: 'var(--cr-on-surface, #191c1e)' }}>Borrower Management</span>
            </div>
            <h1 style={{
              fontSize: 'var(--cr-text-headline-lg, 24px)',
              lineHeight: 'var(--cr-leading-headline-lg, 32px)',
              fontFamily: 'var(--cr-font-display, Geist, system-ui, sans-serif)',
              fontWeight: 700,
              color: 'var(--cr-on-surface, #191c1e)',
              letterSpacing: 'var(--cr-tracking-headline-lg, -0.01em)',
              margin: 0,
            }}>Borrower Management</h1>
          </div>
          {canCreate && (
            <button
              onClick={() => navigate('/credit/borrowers/new')}
              style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                padding: '8px 16px',
                backgroundColor: 'var(--cr-primary, #000000)',
                color: 'var(--cr-on-primary, #ffffff)',
                border: 'none', borderRadius: 'var(--cr-radius, 0.25rem)',
                fontFamily: 'var(--cr-font-body, Inter, system-ui, sans-serif)',
                fontSize: 'var(--cr-text-label-md, 12px)',
                fontWeight: 600,
                letterSpacing: 'var(--cr-tracking-label, 0.05em)',
                cursor: 'pointer',
                transition: 'background-color 0.15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'rgba(0,0,0,0.85)'; }}
              onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'var(--cr-primary, #000000)'; }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>add</span>
              New Borrower
            </button>
          )}
        </div>

        {/* ── Account filter banner ── */}
        {accountIdFilter && (
          <div style={{
            backgroundColor: '#eff6ff', border: '1px solid #bfdbfe',
            borderRadius: 'var(--cr-radius-lg, 0.5rem)',
            padding: '12px 16px', marginBottom: '16px',
            display: 'flex', alignItems: 'center', gap: '12px',
          }}>
            <span className="material-symbols-outlined" style={{ fontSize: '18px', color: '#2563eb' }}>filter_alt</span>
            <span style={{ fontSize: 'var(--cr-text-body-md, 14px)', color: '#1e40af' }}>Filtered by account</span>
            <Link to={`/crm/accounts/${accountIdFilter}`} style={{ fontSize: 'var(--cr-text-body-md, 14px)', fontWeight: 600, color: '#1d4ed8', textDecoration: 'underline' }}>View Account</Link>
            <Link to="/credit/borrowers" style={{ marginLeft: 'auto', fontSize: 'var(--cr-text-label-md, 12px)', fontWeight: 600, color: '#2563eb', textDecoration: 'none' }}>Clear filter</Link>
          </div>
        )}

        {/* ── KPI Cards ── */}
        <BorrowerKpiCards total={kpiData.total} active={kpiData.active} pendingKyc={kpiData.pendingKyc} watchlist={kpiData.watchlist} />

        {/* ── Master-detail layout ── */}
        <div style={{ display: 'flex', gap: '0', alignItems: 'flex-start' }}>
          {/* ── Left: Main content ── */}
          <div style={{ flex: '1', minWidth: 0 }}>
            {/* ── Filter Bar ── */}
            <BorrowerFilterBar filters={filters} onFilterChange={setFilters} onExport={handleExport} />

            {/* ── Data Table ── */}
            <div style={{
              backgroundColor: 'var(--cr-surface-container-lowest, #ffffff)',
              border: '1px solid var(--cr-outline-variant, #c6c6cd)',
              borderRadius: 'var(--cr-radius-lg, 0.5rem)',
              overflow: 'hidden',
            }}>
              <BorrowerDataTable
                profiles={profiles}
                loading={loading}
                onRowClick={handleRowClick}
                onNameClick={handleNameClick}
                onActionClick={handleActionClick}
              />

              {/* ── Pagination Footer ── */}
              {totalPages > 0 && (
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '12px 16px',
                  borderTop: '1px solid var(--cr-outline-variant, #c6c6cd)',
                  backgroundColor: 'var(--cr-surface-container-lowest, #ffffff)',
                }}>
                  <span style={{
                    fontSize: 'var(--cr-text-body-sm, 13px)',
                    fontFamily: 'var(--cr-font-body, Inter, system-ui, sans-serif)',
                    color: 'var(--cr-on-surface-variant, #45464d)',
                  }}>
                    Showing {startItem} to {endItem} of {totalItems.toLocaleString()} entries
                  </span>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    <button
                      onClick={() => fetchProfiles(Math.max(1, currentPage - 1))}
                      disabled={currentPage <= 1}
                      style={{
                        padding: '4px 8px',
                        border: '1px solid var(--cr-outline-variant, #c6c6cd)',
                        borderRadius: 'var(--cr-radius, 0.25rem)',
                        backgroundColor: 'var(--cr-surface-container-lowest, #ffffff)',
                        color: 'var(--cr-on-surface-variant, #45464d)',
                        cursor: currentPage <= 1 ? 'not-allowed' : 'pointer',
                        opacity: currentPage <= 1 ? 0.5 : 1,
                        display: 'flex', alignItems: 'center',
                      }}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>chevron_left</span>
                    </button>
                    {getPageNumbers().map((p, i) =>
                      p === '...' ? (
                        <span key={`ellipsis-${i}`} style={{ padding: '4px 8px', color: 'var(--cr-on-surface-variant, #45464d)' }}>…</span>
                      ) : (
                        <button
                          key={p}
                          onClick={() => fetchProfiles(p)}
                          style={{
                            padding: '4px 12px',
                            border: p === currentPage ? '1px solid var(--cr-secondary, #0051d5)' : '1px solid var(--cr-outline-variant, #c6c6cd)',
                            borderRadius: 'var(--cr-radius, 0.25rem)',
                            backgroundColor: p === currentPage ? 'var(--cr-secondary, #0051d5)' : 'var(--cr-surface-container-lowest, #ffffff)',
                            color: p === currentPage ? 'var(--cr-on-secondary, #ffffff)' : 'var(--cr-on-surface, #191c1e)',
                            fontSize: 'var(--cr-text-body-sm, 13px)',
                            fontFamily: 'var(--cr-font-body, Inter, system-ui, sans-serif)',
                            cursor: 'pointer',
                          }}
                        >{p}</button>
                      )
                    )}
                    <button
                      onClick={() => fetchProfiles(Math.min(totalPages, currentPage + 1))}
                      disabled={currentPage >= totalPages}
                      style={{
                        padding: '4px 8px',
                        border: '1px solid var(--cr-outline-variant, #c6c6cd)',
                        borderRadius: 'var(--cr-radius, 0.25rem)',
                        backgroundColor: 'var(--cr-surface-container-lowest, #ffffff)',
                        color: 'var(--cr-on-surface-variant, #45464d)',
                        cursor: currentPage >= totalPages ? 'not-allowed' : 'pointer',
                        opacity: currentPage >= totalPages ? 0.5 : 1,
                        display: 'flex', alignItems: 'center',
                      }}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>chevron_right</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ── Right: Quick-preview drawer (xl+ only) ── */}
          {selectedBorrower && (
            <div style={{
              width: '400px',
              flexShrink: 0,
              marginLeft: '16px',
              backgroundColor: 'var(--cr-surface-container-lowest, #ffffff)',
              border: '1px solid var(--cr-outline-variant, #c6c6cd)',
              borderRadius: 'var(--cr-radius-lg, 0.5rem)',
              overflow: 'hidden',
              position: 'sticky',
              top: '24px',
              alignSelf: 'flex-start',
            }}>
              <BorrowerQuickPreview
                borrower={selectedBorrower}
                onClose={() => setSelectedBorrower(null)}
                onOpen360={handleOpen360}
                onNewApp={handleNewApp}
              />
            </div>
          )}
        </div>
      </div>

    </>
  );
};

export default BorrowerProfileList;