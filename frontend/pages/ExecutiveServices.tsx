import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { serviceDeskService } from '../src/services/serviceDesk.service';
import SkeletonCategoryCard from '../src/components/SkeletonCategoryCard';
import { friendlyMessage } from '../src/utils/errorMessages';

interface ServiceDesk {
  id: string;
  name: string;
  code: string;
  description: string | null;
}

interface Category {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  displayOrder: number;
}

const ExecutiveServices = () => {
  const [serviceDesk, setServiceDesk] = useState<ServiceDesk | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchServiceDeskData();
  }, []);

  const fetchServiceDeskData = async () => {
    try {
      setLoading(true);
      setError(null);

      const desks = await serviceDeskService.getAllServiceDesks();
      const esmDesk = desks.find((d: ServiceDesk) => d.code === 'ESM');

      if (esmDesk) {
        setServiceDesk(esmDesk);
        const cats = await serviceDeskService.getCategories(esmDesk.id);
        setCategories(cats);
      } else {
        setError('Executive Services desk not found');
      }
    } catch (err: any) {
      console.error('Error fetching service desk:', err);
      setError(friendlyMessage(err, 'Unable to load Executive Services categories. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  const getIconForCategory = (categoryName: string) => {
    const iconMap: Record<string, string> = {
      'Travel Request': 'flight_takeoff',
      'Travel': 'flight',
      'Booking': 'booking',
      'General': 'help',
    };
    return iconMap[categoryName] || 'flight_takeoff';
  };

  if (loading) {
    return (
      <div className="max-w-[1440px] mx-auto px-6 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonCategoryCard key={i} />
          ))}
        </div>
      </div>
    );
  }

  if (error || !serviceDesk) {
    return (
      <div className="max-w-[1440px] mx-auto px-6 py-8">
        <div className="bg-red-50 border border-red-200 text-red-700 px-6 py-4 rounded-lg">
          <p className="font-semibold">Error loading service desk</p>
          <p className="text-sm">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[1440px] mx-auto px-6 py-8">
      <nav className="flex items-center gap-2 mb-8 text-sm font-medium text-[#44546f]">
        <Link to="/" className="hover:text-indigo-600">
          CWC
        </Link>
        <span className="material-symbols-outlined text-sm">chevron_right</span>
        <span className="text-[#101418] font-bold">{serviceDesk.name}</span>
      </nav>

      <div className="mb-12">
        <h1 className="text-4xl font-black text-[#101418] mb-4">{serviceDesk.name}</h1>
        <p className="text-lg text-[#44546f] max-w-3xl">
          {serviceDesk.description || 'Submit and track executive service requests including travel, bookings, and approvals.'}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {categories.length === 0 ? (
          <div className="col-span-full text-center py-12 text-[#44546f]">
            <span className="material-symbols-outlined text-6xl text-gray-300 mb-4 block">flight_takeoff</span>
            <p className="text-lg font-medium">No categories available yet</p>
            <p className="text-sm mt-1">Check back soon for executive service categories.</p>
          </div>
        ) : (
          categories.map((category) => (
            <Link
              key={category.id}
              to={`/esm/${serviceDesk.id}/create/${category.id}`}
              className="group p-6 bg-white border border-gray-100 rounded-xl hover:shadow-lg hover:border-indigo-600/20 transition-all"
            >
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform">
                  <span className="material-symbols-outlined text-2xl">
                    {category.icon || getIconForCategory(category.name)}
                  </span>
                </div>
                <div className="flex-1">
                  <h3 className="font-bold text-lg mb-2 group-hover:text-indigo-600 transition-colors">
                    {category.name}
                  </h3>
                  <p className="text-sm text-[#44546f] leading-relaxed">
                    {category.description || 'Click to submit a travel request'}
                  </p>
                </div>
              </div>
            </Link>
          ))
        )}
      </div>

      <div className="mt-16 bg-gradient-to-r from-indigo-50 to-violet-50 border border-indigo-100 rounded-2xl p-8">
        <div className="flex items-center gap-6">
          <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center text-indigo-600">
            <span className="material-symbols-outlined text-3xl">support_agent</span>
          </div>
          <div className="flex-1">
            <h3 className="font-bold text-xl mb-2">Need executive assistance?</h3>
            <p className="text-[#44546f]">
              Our executive services team is available Monday–Friday, 9 AM – 5 PM
            </p>
          </div>
          <Link
            to={`/esm/${serviceDesk?.id}/create/${categories[0]?.id || ''}`}
            className="px-8 py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-colors"
          >
            Submit Request
          </Link>
        </div>
      </div>
    </div>
  );
};

export default ExecutiveServices;