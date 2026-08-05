import React, { useState } from 'react';

export type TabItem = {
  id: string;
  label: string;
  icon?: string;
  badge?: number | string;
  content?: React.ReactNode;
};

export type TabsProps = {
  tabs: TabItem[];
  defaultTab?: string;
  onChange?: (tabId: string) => void;
  className?: string;
};

export const Tabs: React.FC<TabsProps> = ({
  tabs,
  defaultTab,
  onChange,
  className = '',
}) => {
  const [activeTab, setActiveTab] = useState(defaultTab || tabs[0]?.id || '');

  const handleTabClick = (tabId: string) => {
    setActiveTab(tabId);
    onChange?.(tabId);
  };

  const activeItem = tabs.find((t) => t.id === activeTab);

  return (
    <div className={className}>
      {/* Tab headers */}
      <nav
        className="flex border-b border-cwc-border overflow-x-auto"
        role="tablist"
        aria-label="Tabs"
      >
        {tabs.map((tab) => {
          const isActive = tab.id === activeTab;
          return (
            <button
              key={tab.id}
              role="tab"
              aria-selected={isActive}
              onClick={() => handleTabClick(tab.id)}
              className={`
                relative flex items-center gap-2 px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors
                focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2
                ${
                  isActive
                    ? 'text-brand-700 border-b-2 border-brand-700'
                    : 'text-text-tertiary hover:text-text-secondary border-b-2 border-transparent'
                }
              `}
            >
              {tab.icon && (
                <span className="material-symbols-outlined text-lg">{tab.icon}</span>
              )}
              {tab.label}
              {tab.badge !== undefined && tab.badge !== '' && (
                <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-semibold rounded-full bg-brand-100 text-brand-700">
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Tab content */}
      {activeItem?.content && (
        <div role="tabpanel" className="pt-4">
          {activeItem.content}
        </div>
      )}
    </div>
  );
};

export default Tabs;