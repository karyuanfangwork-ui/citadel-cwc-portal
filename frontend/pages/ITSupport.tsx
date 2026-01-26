import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { serviceDeskService } from '../src/services/serviceDesk.service';

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

const ITSupport = () => {
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

      // Fetch all service desks and find IT
      const desks = await serviceDeskService.getAllServiceDesks();
      const itDesk = desks.find((d: ServiceDesk) => d.code === 'IT');

      if (itDesk) {
        setServiceDesk(itDesk);
        const cats = await serviceDeskService.getCategories(itDesk.id);
        setCategories(cats);
      } else {
        setError('IT Support service desk not found');
      }
    } catch (err: any) {
      console.error('Error fetching service desk:', err);
      setError(err.message || 'Failed to load service desk');
    } finally {
      setLoading(false);
    }
  };

  const getIconForCategory = (categoryName: string) => {
    const iconMap: Record<string, string> = {
      'Hardware': 'laptop',
      'Software': 'apps',
      'Access & Permissions': 'key',
      'Network': 'wifi',
      'Email': 'mail',
      'Servers': 'dns',
      'General IT Support': 'bolt',
    };
    return iconMap[categoryName] || 'help';
  };

  if (loading) {
    return (
      <div className="max-w-[1440px] mx-auto px-6 py-8">
        <div className="flex justify-center items-center py-20">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0052cc]"></div>
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
      <nav className="flex items-center gap-2 mb-8 text-sm font-medium text-[#5e718d]">
        <Link to="/" className="hover:text-[#0052cc]">
          Help Center
        </Link>
        <span className="material-symbols-outlined text-sm">chevron_right</span>
        <span className="text-[#101418] font-bold">{serviceDesk.name}</span>
      </nav>

      <div className="mb-12">
        <h1 className="text-4xl font-black text-[#101418] mb-4">{serviceDesk.name}</h1>
        <p className="text-lg text-[#5e718d] max-w-3xl">
          {serviceDesk.description || 'Get help with IT-related requests and support'}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {categories.length === 0 ? (
          <div className="col-span-full text-center py-12 text-[#5e718d]">
            <p>No categories available</p>
          </div>
        ) : (
          categories.map((category) => (
            <Link
              key={category.id}
              to={`/it/${serviceDesk.id}/create/${category.id}`}
              className="group p-6 bg-white border border-gray-100 rounded-xl hover:shadow-lg hover:border-[#0052cc]/20 transition-all"
            >
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform">
                  <span className="material-symbols-outlined text-2xl">
                    {category.icon || getIconForCategory(category.name)}
                  </span>
                </div>
                <div className="flex-1">
                  <h3 className="font-bold text-lg mb-2 group-hover:text-[#0052cc] transition-colors">
                    {category.name}
                  </h3>
                  <p className="text-sm text-[#5e718d] leading-relaxed">
                    {category.description || 'Click to view available services'}
                  </p>
                </div>
              </div>
            </Link>
          ))
        )}
      </div>

      <div className="mt-16 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 rounded-2xl p-8">
        <div className="flex items-center gap-6">
          <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center text-[#0052cc]">
            <span className="material-symbols-outlined text-3xl">support_agent</span>
          </div>
          <div className="flex-1">
            <h3 className="font-bold text-xl mb-2">Need immediate assistance?</h3>
            <p className="text-[#5e718d]">
              Our IT support team is available Monday-Friday, 9 AM - 6 PM
            </p>
          </div>
          <button className="px-8 py-3 bg-[#0052cc] text-white font-bold rounded-xl hover:bg-blue-700 transition-colors">
            Contact Support
          </button>
        </div>
      </div>
    </div>
  );
};

export default ITSupport;
