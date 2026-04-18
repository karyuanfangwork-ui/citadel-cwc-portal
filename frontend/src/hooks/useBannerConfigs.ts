import { useState, useEffect } from 'react';
import { bannerConfigService, BannerConfigItem } from '../services/bannerConfigService';

export const COLOR_SCHEME_CLASSES: Record<string, { bgClass: string; borderClass: string; iconBgClass: string; iconColor: string }> = {
  blue:    { bgClass: 'bg-blue-50',    borderClass: 'border-blue-200',    iconBgClass: 'bg-blue-600',    iconColor: 'text-white' },
  indigo:  { bgClass: 'bg-indigo-50',  borderClass: 'border-indigo-200',  iconBgClass: 'bg-indigo-600',  iconColor: 'text-white' },
  purple:  { bgClass: 'bg-purple-50',  borderClass: 'border-purple-300',  iconBgClass: 'bg-purple-600',  iconColor: 'text-white' },
  amber:   { bgClass: 'bg-amber-50',   borderClass: 'border-amber-300',   iconBgClass: 'bg-amber-500',   iconColor: 'text-white' },
  orange:  { bgClass: 'bg-orange-50',  borderClass: 'border-orange-300',  iconBgClass: 'bg-orange-500',  iconColor: 'text-white' },
  green:   { bgClass: 'bg-green-50',   borderClass: 'border-green-200',   iconBgClass: 'bg-green-600',   iconColor: 'text-white' },
  emerald: { bgClass: 'bg-emerald-50', borderClass: 'border-emerald-300', iconBgClass: 'bg-emerald-600', iconColor: 'text-white' },
  yellow:  { bgClass: 'bg-yellow-50',  borderClass: 'border-yellow-300',  iconBgClass: 'bg-yellow-500',  iconColor: 'text-white' },
  red:     { bgClass: 'bg-red-50',     borderClass: 'border-red-300',     iconBgClass: 'bg-red-600',     iconColor: 'text-white' },
};

export interface ResolvedBannerConfig {
  icon: string;
  title: string;
  description: string;
  bgClass: string;
  borderClass: string;
  iconBgClass: string;
  iconColor: string;
}

let cache: BannerConfigItem[] | null = null;

export function clearBannerCache() {
  cache = null;
}

export function useBannerConfigs() {
  const [configs, setConfigs] = useState<BannerConfigItem[]>(cache ?? []);
  const [loading, setLoading] = useState(cache === null);

  useEffect(() => {
    if (cache !== null) return;
    bannerConfigService.getActive().then((data) => {
      cache = data;
      setConfigs(data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  function getBannerConfig(role: string, status: string, assignedToName?: string): ResolvedBannerConfig | null {
    const match = configs.find(c => c.role === role && c.status === status)
                ?? configs.find(c => c.role === 'all' && c.status === status);
    if (!match) return null;

    const colors = COLOR_SCHEME_CLASSES[match.colorScheme] ?? COLOR_SCHEME_CLASSES.blue;
    const description = assignedToName
      ? match.description.replace('{{assignedToName}}', assignedToName)
      : match.description.replace(' {{assignedToName}}', '').replace('{{assignedToName}}', '');

    return { icon: match.icon, title: match.title, description, ...colors };
  }

  return { configs, loading, getBannerConfig };
}
