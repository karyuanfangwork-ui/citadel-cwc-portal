import React from 'react';
import { Link, useLocation } from 'react-router-dom';

export interface NavItem {
  to: string;
  label: string;
  icon: string;
}

interface NavMoreDropdownProps {
  items: NavItem[];
  adminItems?: NavItem[];
  isActive: (path: string) => boolean;
}

const NavMoreDropdown: React.FC<NavMoreDropdownProps> = ({ items, adminItems = [], isActive }) => {
  const [open, setOpen] = React.useState(false);
  const dropdownRef = React.useRef<HTMLDivElement>(null);

  // Close on click outside
  React.useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, [open]);

  // Close on Escape
  React.useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open]);

  // Auto-close on navigation
  const location = useLocation();
  React.useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  const hasActive = [...items, ...adminItems].some(i => isActive(i.to));

  return (
    <div ref={dropdownRef} className="relative">
      <button
        onClick={(e) => { e.stopPropagation(); setOpen(o => !o); }}
        className={`text-sm font-semibold transition-colors pb-1 border-b-2 flex items-center gap-0.5 ${
          hasActive
            ? 'text-[#0052cc] border-[#0052cc]'
            : open
              ? 'text-[#0052cc] border-[#0052cc]'
              : 'text-text-secondary border-transparent hover:text-[#0052cc]'
        }`}
        aria-expanded={open}
        aria-haspopup="true"
        aria-label="More navigation"
      >
        More
        <span className={`material-symbols-outlined text-base transition-transform ${open ? 'rotate-180' : ''}`}>
          expand_more
        </span>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-lg shadow-lg border border-gray-100 py-1 z-[70]">
          {items.map(item => (
            <Link
              key={item.to}
              to={item.to}
              className={`flex items-center gap-2.5 px-4 py-2.5 text-sm transition-colors ${
                isActive(item.to)
                  ? 'bg-brand-50 text-brand-700 font-semibold'
                  : 'text-text-secondary hover:bg-gray-50'
              }`}
            >
              <span className="material-symbols-outlined text-lg">{item.icon}</span>
              {item.label}
            </Link>
          ))}

          {adminItems.length > 0 && (
            <>
              <div className="border-t border-gray-100 my-1" />
              <p className="px-4 pt-1 pb-1 text-[11px] font-bold uppercase tracking-wider text-text-tertiary">
                Admin
              </p>
              {adminItems.map(item => (
                <Link
                  key={item.to}
                  to={item.to}
                  className={`flex items-center gap-2.5 px-4 py-2.5 text-sm transition-colors ${
                    isActive(item.to)
                      ? 'bg-brand-50 text-brand-700 font-semibold'
                      : 'text-text-secondary hover:bg-gray-50'
                  }`}
                >
                  <span className="material-symbols-outlined text-lg">{item.icon}</span>
                  {item.label}
                </Link>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default NavMoreDropdown;