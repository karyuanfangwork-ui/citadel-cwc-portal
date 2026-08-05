import React from 'react';
import { Link, useLocation } from 'react-router-dom';

const NotFound = () => {
  const location = useLocation();
  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-brand-50 text-brand-700">
          <span className="material-symbols-outlined text-4xl">explore_off</span>
        </div>
        <p className="text-xs font-bold uppercase tracking-widest text-text-tertiary mb-2">Error 404</p>
        <h1 className="text-2xl font-extrabold text-text-primary mb-2">Page not found</h1>
        <p className="text-sm text-text-secondary mb-6">
          We couldn't find <span className="font-mono text-text-primary">{location.pathname}</span>.
          It may have been moved, renamed, or never existed.
        </p>
        <div className="flex flex-col sm:flex-row gap-2 justify-center">
          <Link
            to="/"
            className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-cwc-md bg-brand-700 text-white text-sm font-bold hover:opacity-90 transition-opacity"
          >
            <span className="material-symbols-outlined text-base">home</span>
            Back to dashboard
          </Link>
          <Link
            to="/my-requests"
            className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-cwc-md bg-surface-muted text-text-primary text-sm font-bold hover:bg-gray-200 transition-colors"
          >
            <span className="material-symbols-outlined text-base">list_alt</span>
            My Requests
          </Link>
        </div>
      </div>
    </div>
  );
};

export default NotFound;
