import React from 'react';
import { Link } from 'react-router-dom';

interface Crumb {
  label: string;
  to?: string;
}

interface BreadcrumbsProps {
  items: Crumb[];
}

const Breadcrumbs: React.FC<BreadcrumbsProps> = ({ items }) => (
  <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-sm mb-4">
    {items.map((item, i) => (
      <React.Fragment key={i}>
        {i > 0 && (
          <span className="material-symbols-outlined text-text-tertiary" style={{ fontSize: 16 }}>
            chevron_right
          </span>
        )}
        {item.to ? (
          <Link
            to={item.to}
            className="text-text-secondary hover:text-brand-700 transition-colors font-medium"
          >
            {item.label}
          </Link>
        ) : (
          <span className="text-text-primary font-semibold">{item.label}</span>
        )}
      </React.Fragment>
    ))}
  </nav>
);

export default Breadcrumbs;