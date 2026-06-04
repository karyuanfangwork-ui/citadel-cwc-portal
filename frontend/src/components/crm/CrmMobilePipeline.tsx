import React, { useState, useMemo } from 'react';
import { CrmPipelineStage, CrmOpportunity } from '../../services/crm.service';
import { formatCurrency, formatShortDate, winProbStyle, stageBadgeColor } from '../crm/crmConstants';

interface Props {
  stages: CrmPipelineStage[];
  onCardClick: (oppId: string) => void;
  onStageChange?: (oppId: string, stageId: string, lostReason?: string) => void;
  searchQuery?: string;
}

export default function CrmMobilePipeline({ stages, onCardClick, onStageChange, searchQuery }: Props) {
  const [activeStage, setActiveStage] = useState(0);
  const [touchStartX, setTouchStartX] = useState(0);
  const [touchStartY, setTouchStartY] = useState(0);

  const currentStage = stages[activeStage];

  const filteredOpportunities = useMemo(() => {
    const opps = currentStage?.opportunities ?? [];
    if (!searchQuery) return opps;
    const q = searchQuery.toLowerCase();
    return opps.filter(opp =>
      opp.name.toLowerCase().includes(q) ||
      opp.account?.name?.toLowerCase().includes(q) ||
      (opp.owner && `${opp.owner.firstName} ${opp.owner.lastName}`.toLowerCase().includes(q))
    );
  }, [currentStage?.opportunities, searchQuery]);

  const allOpportunityCount = useMemo(() => {
    if (!searchQuery) return undefined;
    return stages.reduce((sum, s) => {
      const opps = s.opportunities ?? [];
      const q = searchQuery.toLowerCase();
      return sum + opps.filter(opp =>
        opp.name.toLowerCase().includes(q) ||
        opp.account?.name?.toLowerCase().includes(q) ||
        (opp.owner && `${opp.owner.firstName} ${opp.owner.lastName}`.toLowerCase().includes(q))
      ).length;
    }, 0);
  }, [stages, searchQuery]);

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStartX(e.touches[0].clientX);
    setTouchStartY(e.touches[0].clientY);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    const dx = e.changedTouches[0].clientX - touchStartX;
    const dy = e.changedTouches[0].clientY - touchStartY;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) {
      if (dx < 0 && activeStage < stages.length - 1) setActiveStage(activeStage + 1);
      else if (dx > 0 && activeStage > 0) setActiveStage(activeStage - 1);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Stage Tabs */}
      <div className="flex overflow-x-auto border-b-2 border-border bg-surface"
        style={{ WebkitOverflowScrolling: 'touch' }}>
        {stages.map((stage, i) => {
          const color = stageBadgeColor(stage);
          const isActive = i === activeStage;
          return (
            <button
              key={stage.id}
              onClick={() => setActiveStage(i)}
              className="flex-1 px-2 py-2.5 text-xs font-semibold whitespace-nowrap transition-colors"
              style={{
                border: 'none',
                background: 'none',
                cursor: 'pointer',
                color: isActive ? color : 'var(--color-text-secondary)',
                borderBottom: isActive ? `2px solid ${color}` : '2px solid transparent',
                WebkitTapHighlightColor: 'transparent',
                fontWeight: isActive ? 700 : 400,
              }}
            >
              {stage.name}
              <span className="ml-1 text-text-tertiary" style={{ fontSize: 10 }}>
                ({(stage.opportunities ?? []).length})
              </span>
            </button>
          );
        })}
      </div>

      {/* Stage Info */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-surface">
        <h3 className="text-sm font-bold" style={{ color: stageBadgeColor(currentStage) }}>
          {currentStage?.name}
        </h3>
        <span className="text-xs text-text-secondary">
          {filteredOpportunities.length} deal{filteredOpportunities.length !== 1 ? 's' : ''}
          {currentStage && ` · ${formatCurrency(currentStage.probability * (filteredOpportunities.reduce((s, o) => s + Number(o.value), 0) / 100))} weighted`}
        </span>
      </div>

      {/* Cards Area */}
      <div
        className="flex-1 overflow-y-auto p-3 space-y-2"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        style={{ background: 'var(--color-surface-muted)' }}
      >
        {filteredOpportunities.length === 0 && (
          <div className="text-center py-10 text-text-tertiary text-sm">
            {searchQuery ? 'No matching deals' : 'No deals in this stage'}
          </div>
        )}

        {filteredOpportunities.map(opp => {
          const ws = opp.aiWinProbability != null ? winProbStyle(opp.aiWinProbability) : null;
          return (
            <div
              key={opp.id}
              onClick={() => onCardClick(opp.id)}
              className="bg-surface border border-border rounded-xl p-3.5 cursor-pointer active:scale-[0.98] transition-transform"
              style={{ WebkitTapHighlightColor: 'transparent' }}
            >
              <div className="text-sm font-bold text-text-primary mb-1 line-clamp-2" title={opp.name}>
                {opp.name}
              </div>
              <div className="text-base font-black text-brand-600 mb-1.5">
                {formatCurrency(Number(opp.value))}
              </div>

              {ws && (
                <span
                  className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-xs font-bold mb-1.5"
                  style={{ background: ws.bg, color: ws.text }}
                  title={opp.aiWinReason ?? 'AI Win Probability'}
                >
                  <span className="material-symbols-outlined text-sm">{ws.icon}</span>
                  AI {opp.aiWinProbability}%
                </span>
              )}

              <div className="flex items-center justify-between mt-1">
                <div className="flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-text-tertiary text-sm">business</span>
                  <span className="text-xs text-text-secondary truncate max-w-[160px]" title={opp.account?.name ?? ''}>
                    {opp.account?.name || '—'}
                  </span>
                </div>
                {opp.expectedCloseDate && (
                  <span className="text-xs text-text-tertiary">{formatShortDate(opp.expectedCloseDate)}</span>
                )}
              </div>

              {opp.owner && (
                <div className="flex items-center gap-1.5 mt-2">
                  <div className="w-5 h-5 rounded-full bg-brand-100 flex items-center justify-center">
                    <span className="text-[10px] font-bold text-brand-600">
                      {opp.owner.firstName?.[0]}{opp.owner.lastName?.[0]}
                    </span>
                  </div>
                  <span className="text-xs text-text-tertiary" title={`${opp.owner.firstName} ${opp.owner.lastName}`}>
                    {opp.owner.firstName} {opp.owner.lastName}
                  </span>
                </div>
              )}
            </div>
          );
        })}

        {/* Stage Navigation */}
        <div className="flex justify-between pt-2 pb-4">
          {activeStage > 0 ? (
            <button
              onClick={() => setActiveStage(activeStage - 1)}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-border bg-surface text-text-primary hover:bg-bg-subtle transition-colors"
              style={{ cursor: 'pointer' }}
            >
              ← {stages[activeStage - 1]?.name}
            </button>
          ) : <div />}
          {activeStage < stages.length - 1 ? (
            <button
              onClick={() => setActiveStage(activeStage + 1)}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-border bg-surface text-text-primary hover:bg-bg-subtle transition-colors"
              style={{ cursor: 'pointer' }}
            >
              {stages[activeStage + 1]?.name} →
            </button>
          ) : <div />}
        </div>
      </div>
    </div>
  );
}