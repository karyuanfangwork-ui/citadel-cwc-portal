import React, { useState } from 'react';

interface PipelineCard {
  id: string;
  name: string;
  value?: number;
  contactName?: string;
  closeDate?: string;
}

interface Stage {
  id: string;
  name: string;
  color?: string;
  cards: PipelineCard[];
}

interface Props {
  stages: Stage[];
  onCardClick: (card: PipelineCard) => void;
  onStageChange?: (cardId: string, newStageId: string) => void;
}

export default function CrmMobilePipeline({ stages, onCardClick, onStageChange }: Props) {
  const [activeStage, setActiveStage] = useState(0);
  const currentStage = stages[activeStage];

  const formatCurrency = (val?: number) => {
    if (val == null) return '';
    return new Intl.NumberFormat('en-MY', { style: 'currency', currency: 'MYR', maximumFractionDigits: 0 }).format(val);
  };

  const handleSwipeLeft = () => {
    if (activeStage < stages.length - 1) {
      setActiveStage(activeStage + 1);
    }
  };

  const handleSwipeRight = () => {
    if (activeStage > 0) {
      setActiveStage(activeStage - 1);
    }
  };

  let touchStartX = 0;
  let touchStartY = 0;

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    const dx = e.changedTouches[0].clientX - touchStartX;
    const dy = e.changedTouches[0].clientY - touchStartY;
    // Only respond to horizontal swipes
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) {
      if (dx < 0) handleSwipeLeft();
      else handleSwipeRight();
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Stage Tabs */}
      <div style={{
        display: 'flex', overflowX: 'auto', gap: 0,
        borderBottom: '2px solid #e5e7eb', background: '#fff',
        WebkitOverflowScrolling: 'touch',
      }}>
        {stages.map((stage, i) => (
          <button
            key={stage.id}
            onClick={() => setActiveStage(i)}
            style={{
              flex: '1 0 auto', padding: '10px 8px', border: 'none', background: 'none',
              cursor: 'pointer', fontSize: 13, fontWeight: i === activeStage ? 600 : 400,
              color: i === activeStage ? '#2563eb' : '#6b7280',
              borderBottom: i === activeStage ? `2px solid ${stage.color || '#2563eb'}` : '2px solid transparent',
              whiteSpace: 'nowrap', WebkitTapHighlightColor: 'transparent',
            }}
          >
            {stage.name}
            <span style={{ fontSize: 11, marginLeft: 4, color: '#9ca3af' }}>({stage.cards.length})</span>
          </button>
        ))}
      </div>

      {/* Cards Area */}
      <div
        style={{ flex: 1, overflowY: 'auto', padding: 12 }}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: currentStage?.color || '#111827' }}>
            {currentStage?.name}
          </h3>
          <span style={{ fontSize: 13, color: '#6b7280' }}>{currentStage?.cards.length || 0} deals</span>
        </div>

        {currentStage?.cards.length === 0 && (
          <div style={{ textAlign: 'center', padding: 40, color: '#9ca3af', fontSize: 14 }}>
            No deals in this stage
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {currentStage?.cards.map(card => (
            <div
              key={card.id}
              onClick={() => onCardClick(card)}
              style={{
                background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10,
                padding: '10px 14px', cursor: 'pointer',
                WebkitTapHighlightColor: 'transparent',
              }}
            >
              <div style={{ fontWeight: 600, fontSize: 14, color: '#111827' }}>{card.name}</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                {card.value != null && (
                  <span style={{ fontSize: 13, color: '#2563eb', fontWeight: 500 }}>{formatCurrency(card.value)}</span>
                )}
                {card.closeDate && (
                  <span style={{ fontSize: 12, color: '#9ca3af' }}>Close: {card.closeDate}</span>
                )}
              </div>
              {card.contactName && (
                <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>{card.contactName}</div>
              )}
            </div>
          ))}
        </div>

        {/* Stage Navigation Hints */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12 }}>
          {activeStage > 0 ? (
            <button onClick={handleSwipeRight} style={{ padding: '6px 14px', border: '1px solid #d1d5db', borderRadius: 6, background: '#fff', fontSize: 13, cursor: 'pointer' }}>
              ← {stages[activeStage - 1]?.name}
            </button>
          ) : <div />}
          {activeStage < stages.length - 1 ? (
            <button onClick={handleSwipeLeft} style={{ padding: '6px 14px', border: '1px solid #d1d5db', borderRadius: 6, background: '#fff', fontSize: 13, cursor: 'pointer' }}>
              {stages[activeStage + 1]?.name} →
            </button>
          ) : <div />}
        </div>
      </div>
    </div>
  );
}