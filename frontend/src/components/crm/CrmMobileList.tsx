import React from 'react';

interface MobileListProps<T> {
  items: T[];
  keyField: string;
  titleField: string;
  subtitleField?: string;
  metaFields?: { key: string; label: string; render?: (item: T) => string }[];
  statusField?: string;
  statusColors?: Record<string, { bg: string; text: string }>;
  onCardClick: (item: T) => void;
  onSwipeLeft?: (item: T) => void;
  onSwipeRight?: (item: T) => void;
  leftActionLabel?: string;
  rightActionLabel?: string;
}

export default function CrmMobileList<T extends Record<string, any>>({
  items,
  keyField,
  titleField,
  subtitleField,
  metaFields,
  statusField,
  statusColors,
  onCardClick,
  onSwipeLeft,
  onSwipeRight,
  leftActionLabel = 'Delete',
  rightActionLabel = 'Edit',
}: MobileListProps<T>) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {items.map(item => {
        const status = statusField ? item[statusField] : null;
        const colors = status && statusColors ? statusColors[status] : null;
        return (
          <div
            key={item[keyField]}
            onClick={() => onCardClick(item)}
            style={{
              background: '#fff',
              border: '1px solid #e5e7eb',
              borderRadius: 10,
              padding: '12px 16px',
              cursor: 'pointer',
              WebkitTapHighlightColor: 'transparent',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontWeight: 600, fontSize: 15, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {item[titleField]}
                  </span>
                  {colors && (
                    <span style={{
                      fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 4,
                      background: colors.bg, color: colors.text,
                    }}>
                      {status}
                    </span>
                  )}
                </div>
                {subtitleField && item[subtitleField] && (
                  <div style={{ fontSize: 13, color: '#6b7280', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {item[subtitleField]}
                  </div>
                )}
              </div>
              <span className="material-icons" style={{ color: '#9ca3af', fontSize: 20 }}>chevron_right</span>
            </div>
            {metaFields && metaFields.length > 0 && (
              <div style={{ display: 'flex', gap: 16, marginTop: 8, flexWrap: 'wrap' }}>
                {metaFields.map(meta => {
                  const value = meta.render ? meta.render(item) : String(item[meta.key] ?? '—');
                  return (
                    <div key={meta.key} style={{ fontSize: 12 }}>
                      <span style={{ color: '#9ca3af' }}>{meta.label}: </span>
                      <span style={{ color: '#374151', fontWeight: 500 }}>{value}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
      {items.length === 0 && (
        <div style={{ textAlign: 'center', padding: 40, color: '#9ca3af', fontSize: 14 }}>
          No items found
        </div>
      )}
    </div>
  );
}