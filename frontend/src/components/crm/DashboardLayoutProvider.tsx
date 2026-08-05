import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import crmService from '../../services/crm.service';

export interface WidgetConfig {
  widgetId: string;
  order: number;
  size: 'small' | 'medium' | 'full';
  visible: boolean;
}

interface DashboardLayoutContextType {
  layout: WidgetConfig[];
  registry: any[];
  isDefault: boolean;
  loading: boolean;
  editing: boolean;
  setEditing: (v: boolean) => void;
  toggleWidget: (widgetId: string) => void;
  reorderWidgets: (newLayout: WidgetConfig[]) => void;
  resetLayout: () => void;
  saveLayout: () => Promise<void>;
}

const DashboardLayoutContext = createContext<DashboardLayoutContextType | null>(null);

export const useDashboardLayout = () => {
  const ctx = useContext(DashboardLayoutContext);
  if (!ctx) throw new Error('useDashboardLayout must be used within DashboardLayoutProvider');
  return ctx;
};

export const DashboardLayoutProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [layout, setLayout] = useState<WidgetConfig[]>([]);
  const [registry, setRegistry] = useState<any[]>([]);
  const [isDefault, setIsDefault] = useState(true);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    Promise.all([crmService.getDashboardLayout(), crmService.getWidgetRegistry()])
      .then(([layoutData, regData]) => {
        setLayout(layoutData.layout as WidgetConfig[]);
        setIsDefault(layoutData.isDefault);
        setRegistry(regData);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const toggleWidget = useCallback((widgetId: string) => {
    setLayout(prev => {
      const existing = prev.find(w => w.widgetId === widgetId);
      if (existing) {
        return prev.map(w => w.widgetId === widgetId ? { ...w, visible: !w.visible } : w);
      }
      // Add from registry
      const reg = registry.find(r => r.widgetId === widgetId);
      if (reg) {
        return [...prev, { widgetId, order: prev.length, size: reg.size, visible: true }];
      }
      return prev;
    });
    setDirty(true);
  }, [registry]);

  const reorderWidgets = useCallback((newLayout: WidgetConfig[]) => {
    setLayout(newLayout);
    setDirty(true);
  }, []);

  const saveLayout = useCallback(async () => {
    await crmService.saveDashboardLayout(layout);
    setIsDefault(false);
    setDirty(false);
  }, [layout]);

  const resetLayout = useCallback(async () => {
    const result = await crmService.resetDashboardLayout();
    setLayout(result.layout as WidgetConfig[]);
    setIsDefault(true);
    setDirty(false);
  }, []);

  return (
    <DashboardLayoutContext.Provider value={{
      layout, registry, isDefault, loading, editing, setEditing,
      toggleWidget, reorderWidgets, resetLayout, saveLayout,
    }}>
      {children}
    </DashboardLayoutContext.Provider>
  );
};

export default DashboardLayoutProvider;