import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { requestService } from '../../services/request.service';

interface RecentService {
  id: string;
  name: string;
  icon: string | null;
  description: string | null;
  serviceCategoryId: string;
  deskId: string | null;
  deskCode: string | null;
  count: number;
}

interface RecentServicesProps {
  /** Which service desk to create requests under, e.g. '/create-request?desk=it' */
  deskSlug?: string;
  className?: string;
}

export default function RecentServices({ className = '' }: RecentServicesProps) {
  const navigate = useNavigate();
  const [services, setServices] = useState<RecentService[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    requestService
      .getRecentServices(5)
      .then((data: RecentService[]) => setServices(data))
      .catch(() => setServices([]))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className={`animate-pulse ${className}`}>
        <div className="h-5 w-40 bg-gray-200 rounded mb-3" />
        <div className="flex gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-20 w-32 bg-gray-100 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  if (services.length === 0) return null;

  const handleClick = (service: RecentService) => {
    if (service.deskCode && service.deskId && service.serviceCategoryId) {
      navigate(`/${service.deskCode}/${service.deskId}/create/${service.serviceCategoryId}`);
    }
  };

  return (
    <div className={className}>
      <h3 className="text-sm font-bold text-text-primary mb-3 flex items-center gap-2">
        <span className="material-symbols-outlined text-base text-brand-700">history</span>
        Recently Used
      </h3>
      <div className="flex flex-wrap gap-3">
        {services.map((service) => (
          <button
            key={service.id}
            type="button"
            onClick={() => handleClick(service)}
            className="group flex items-center gap-2.5 px-4 py-3 bg-white border border-cwc-border rounded-cwc-lg hover:border-brand-700 hover:bg-brand-50/50 hover:shadow-cwc-sm transition-all text-left"
          >
            <div className="w-8 h-8 rounded-cwc-md flex items-center justify-center bg-surface-muted group-hover:bg-brand-100 text-text-tertiary group-hover:text-brand-700 transition-colors">
              <span className="material-symbols-outlined text-lg">
                {service.icon || 'mail'}
              </span>
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-text-primary truncate">{service.name}</p>
              <p className="text-xs text-text-tertiary">{service.count} request{service.count !== 1 ? 's' : ''}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}