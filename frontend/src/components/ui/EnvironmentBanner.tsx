import React, { useState, useEffect } from 'react';

type Env = 'local' | 'dev' | 'staging' | 'prod';

const STORAGE_KEY = 'env-banner-dismissed';

const resolveEnv = (): Env => {
  const raw = (import.meta.env.VITE_ENV as string | undefined)?.toLowerCase();
  if (raw === 'prod' || raw === 'production') return 'prod';
  if (raw === 'staging' || raw === 'stage') return 'staging';
  if (raw === 'dev' || raw === 'development') return 'dev';
  if (raw === 'local') return 'local';
  return import.meta.env.DEV ? 'local' : 'prod';
};

const STYLES: Record<Exclude<Env, 'prod'>, { bg: string; label: string }> = {
  local: { bg: 'bg-slate-700', label: 'LOCAL' },
  dev: { bg: 'bg-orange-600', label: 'DEV' },
  staging: { bg: 'bg-purple-700', label: 'STAGING' },
};

export const EnvironmentBanner: React.FC = () => {
  const env = resolveEnv();
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    setDismissed(sessionStorage.getItem(STORAGE_KEY) === '1');
  }, []);

  if (env === 'prod' || dismissed) return null;

  const { bg, label } = STYLES[env];

  return (
    <div
      role="region"
      aria-label={`${label} environment notice`}
      className={`${bg} text-white text-xs font-semibold tracking-wide flex items-center justify-center gap-3 px-4 py-1.5`}
    >
      <span className="material-symbols-outlined text-base" aria-hidden="true">warning</span>
      <span>{label} ENVIRONMENT — changes do not affect production.</span>
      <button
        type="button"
        onClick={() => {
          sessionStorage.setItem(STORAGE_KEY, '1');
          setDismissed(true);
        }}
        aria-label="Dismiss environment banner"
        className="ml-2 opacity-80 hover:opacity-100"
      >
        <span className="material-symbols-outlined text-base" aria-hidden="true">close</span>
      </button>
    </div>
  );
};

export default EnvironmentBanner;
