
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

const HardwareForm = () => {
  const navigate = useNavigate();
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <div class="max-w-[1200px] mx-auto px-6 py-24 text-center">
        <div class="w-24 h-24 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-8 shadow-xl shadow-emerald-500/10">
          <span class="material-symbols-outlined !text-6xl font-bold">check_circle</span>
        </div>
        <h1 class="text-4xl font-black mb-4">Request Submitted Successfully</h1>
        <div class="inline-flex items-center gap-3 bg-gray-100 px-6 py-2 rounded-full mb-8">
            <span class="text-sm font-bold text-gray-500 uppercase tracking-widest">Reference:</span>
            <span class="text-sm font-bold text-[#0052cc]">HW-542</span>
        </div>
        <p class="text-lg text-gray-500 max-w-xl mx-auto mb-12">
            Our IT and Procurement teams have been notified and will review your request shortly. You can track the progress of your ticket in the request portal.
        </p>
        <div class="flex items-center justify-center gap-4">
            <button 
                onClick={() => navigate('/my-requests')}
                class="bg-[#0052cc] text-white px-10 py-4 rounded-xl font-bold shadow-lg shadow-blue-200 hover:bg-blue-700 transition-all"
            >
                View Request Status
            </button>
            <button 
                onClick={() => navigate('/')}
                class="bg-white border-2 border-gray-100 px-10 py-4 rounded-xl font-bold hover:border-[#0052cc] transition-all"
            >
                Return to Help Center
            </button>
        </div>
      </div>
    );
  }

  return (
    <div class="max-w-[1280px] mx-auto px-6 py-8">
      <nav class="flex flex-wrap gap-2 mb-8 items-center text-sm font-medium text-[#5e718d]">
        <Link to="/" class="hover:text-[#0052cc]">Help Center</Link>
        <span class="material-symbols-outlined text-sm">chevron_right</span>
        <Link to="/it" class="hover:text-[#0052cc]">IT Support</Link>
        <span class="material-symbols-outlined text-sm">chevron_right</span>
        <span class="text-[#101418] font-bold">Request new hardware</span>
      </nav>

      <div class="mb-10">
        <h1 class="text-4xl font-black tracking-tight mb-3">Custom Hardware Request</h1>
        <p class="text-[#5e718d] text-lg max-w-2xl">Use this form to request specialized hardware not listed in the standard catalog. Detailed information speeds up approval.</p>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-12 gap-10">
        <div class="lg:col-span-8">
          <form onSubmit={handleSubmit} class="bg-white border border-gray-100 rounded-2xl p-10 shadow-sm space-y-8">
            <div class="space-y-2">
              <label class="block text-sm font-bold">Hardware Name/Model <span class="text-red-500">*</span></label>
              <input 
                required
                type="text" 
                placeholder="e.g. Dell UltraSharp 32 4K Monitor (U3223QE)" 
                class="w-full h-12 px-4 rounded-xl border-gray-200 focus:border-[#0052cc] focus:ring-4 focus:ring-[#0052cc]/5 outline-none transition-all"
              />
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div class="space-y-2">
                <label class="block text-sm font-bold">Estimated Price</label>
                <div class="relative">
                  <span class="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold">$</span>
                  <input type="number" placeholder="0.00" class="w-full h-12 pl-8 pr-4 rounded-xl border-gray-200 focus:border-[#0052cc] focus:ring-4 focus:ring-[#0052cc]/5 outline-none transition-all" />
                </div>
              </div>
              <div class="space-y-2">
                <label class="block text-sm font-bold">Preferred Vendor (Optional)</label>
                <input type="text" placeholder="e.g. Amazon, B&H, Dell Direct" class="w-full h-12 px-4 rounded-xl border-gray-200 focus:border-[#0052cc] focus:ring-4 focus:ring-[#0052cc]/5 outline-none transition-all" />
              </div>
            </div>

            <div class="space-y-2">
              <label class="block text-sm font-bold">URL / Link to product</label>
              <input type="url" placeholder="https://www.example.com/product-page" class="w-full h-12 px-4 rounded-xl border-gray-200 focus:border-[#0052cc] focus:ring-4 focus:ring-[#0052cc]/5 outline-none transition-all" />
            </div>

            <div class="space-y-2">
              <label class="block text-sm font-bold">Business Justification <span class="text-red-500">*</span></label>
              <textarea 
                required
                rows={5}
                placeholder="Please explain why standard catalog options do not meet your technical requirements..." 
                class="w-full p-4 rounded-xl border-gray-200 focus:border-[#0052cc] focus:ring-4 focus:ring-[#0052cc]/5 outline-none transition-all"
              ></textarea>
            </div>

            <div class="bg-blue-50/50 border border-blue-100 p-6 rounded-xl flex items-start gap-4">
              <input type="checkbox" id="confirm" class="mt-1 size-5 text-[#0052cc] rounded border-gray-300 focus:ring-[#0052cc]" />
              <label htmlFor="confirm" class="text-sm font-medium text-gray-700 leading-relaxed">
                I confirm this hardware is compatible with company security standards and my manager has verbally pre-approved this request.
              </label>
            </div>

            <div class="pt-6 border-t border-gray-100 flex items-center gap-6">
                <button type="submit" class="bg-[#0052cc] text-white px-10 py-3.5 rounded-xl font-bold shadow-xl shadow-blue-200 hover:bg-blue-700 transition-all flex items-center gap-2">
                    <span class="material-symbols-outlined">send</span>
                    Send Request
                </button>
                <button type="button" onClick={() => navigate('/it')} class="text-[#5e718d] font-bold hover:text-[#101418] transition-colors">Cancel</button>
            </div>
          </form>
        </div>

        <aside class="lg:col-span-4 space-y-6">
          <div class="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
            <div class="bg-blue-50 px-6 py-4 border-b border-blue-100">
                <h3 class="text-[#0052cc] font-bold flex items-center gap-2">
                    <span class="material-symbols-outlined text-lg">info</span>
                    Procurement Guidelines
                </h3>
            </div>
            <div class="p-8 space-y-8">
              <div class="flex gap-4">
                <span class="material-symbols-outlined text-[#0052cc]">schedule</span>
                <div>
                  <p class="font-bold text-sm">Shipping Timeline</p>
                  <p class="text-xs text-[#5e718d] mt-1 leading-relaxed">Custom orders typically take 10-15 business days for approval and fulfillment.</p>
                </div>
              </div>
              <div class="flex gap-4">
                <span class="material-symbols-outlined text-[#0052cc]">account_balance_wallet</span>
                <div>
                  <p class="font-bold text-sm">Budget Caps</p>
                  <p class="text-xs text-[#5e718d] mt-1 leading-relaxed">Requests over $2,500 require VP-level approval in addition to your direct manager.</p>
                </div>
              </div>
              <div class="flex gap-4">
                <span class="material-symbols-outlined text-[#0052cc]">verified_user</span>
                <div>
                  <p class="font-bold text-sm">Security Policy</p>
                  <p class="text-xs text-[#5e718d] mt-1 leading-relaxed">All wireless devices must be TAA compliant.</p>
                </div>
              </div>
              <hr class="border-gray-100" />
              <div>
                <p class="text-sm font-bold mb-4">Need help?</p>
                <button class="w-full py-2.5 bg-white border-2 border-blue-100 text-[#0052cc] font-bold rounded-xl hover:bg-blue-50 transition-all">Chat with Procurement</button>
              </div>
            </div>
          </div>
          
          <div class="bg-gray-100/50 p-8 rounded-2xl border border-gray-200">
            <h4 class="text-sm font-bold mb-4 uppercase tracking-widest opacity-60">Popular Items</h4>
            <div class="space-y-4">
                <a href="#" class="flex items-center justify-between text-sm font-bold text-[#0052cc] hover:underline">
                    MacBook Pro 14" (M3)
                    <span class="material-symbols-outlined text-sm">open_in_new</span>
                </a>
                <a href="#" class="flex items-center justify-between text-sm font-bold text-[#0052cc] hover:underline">
                    Dell Latitude 5440
                    <span class="material-symbols-outlined text-sm">open_in_new</span>
                </a>
                <a href="#" class="flex items-center justify-between text-sm font-bold text-[#0052cc] hover:underline">
                    Logitech MX Master 3S
                    <span class="material-symbols-outlined text-sm">open_in_new</span>
                </a>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
};

export default HardwareForm;
