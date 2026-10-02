import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Sparkles, Sliders } from 'lucide-react';
import BadgePill from '../components/BadgePill';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';

export default function CreateListing() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t } = useLanguage();

  const [volume, setVolume] = useState(12.5);
  const [unitPrice, setUnitPrice] = useState(340);
  const [assignedBadge, setAssignedBadge] = useState('REGISTRY');

  // Live revenue calculations
  const grossValue = volume * unitPrice;
  const platformFee = grossValue * 0.02;
  const netEarnings = grossValue - platformFee;

  const handleSubmitListing = (e) => {
    e.preventDefault();
    alert(`${t('clistPublished')} ${t('clistGross')} INR ${grossValue.toLocaleString()} | ${t('clistNet')} INR ${netEarnings.toLocaleString()}`);
    navigate('/marketplace');
  };

  return (
    <div className="min-h-screen bg-slate-50 font-inter text-slate-900 py-8 px-4 md:px-10">
      <div className="max-w-2xl mx-auto space-y-6">

        {/* Header */}
        <div className="bg-white border border-slate-200 shadow-sm rounded-xl p-6 flex justify-between items-center">
          <div>
            <span className="text-xs font-semibold text-emerald-800 uppercase tracking-wider bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full inline-block mb-1">
              {t('clistBadge')}
            </span>
            <h1 className="text-2xl font-extrabold text-slate-900 font-manrope">{t('clistTitle')}</h1>
            <p className="text-xs text-slate-500 mt-0.5">{t('clistDesc')}</p>
          </div>

          <button
            onClick={() => navigate('/farmer/dashboard')}
            className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>{t('navDashboard')}</span>
          </button>
        </div>

        {/* Configuration Panel */}
        <form onSubmit={handleSubmitListing} className="bg-white border border-slate-200 shadow-sm rounded-xl p-6 space-y-6">
          <div className="flex items-center justify-between bg-slate-50 border border-slate-200 p-4 rounded-xl">
            <div>
              <p className="text-xs font-bold text-slate-900">{t('clistParcel')}</p>
              <p className="text-[11px] text-slate-500">{t('clistParcelDesc')}</p>
            </div>
            <BadgePill badge={assignedBadge} size="sm" />
          </div>

          {/* Interactive Volume Slider */}
          <div className="space-y-2">
            <div className="flex justify-between items-center text-xs font-bold">
              <label className="text-slate-700 uppercase tracking-wider">{t('clistVolumeLabel')}</label>
              <span className="text-emerald-800 font-mono text-base">{volume} MT</span>
            </div>
            <input
              type="range"
              min="1.0"
              max="25.0"
              step="0.5"
              value={volume}
              onChange={(e) => setVolume(parseFloat(e.target.value))}
              className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-emerald-700"
            />
          </div>

          {/* Unit Benchmark Price Input */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              {t('clistPriceLabel')}
            </label>
            <input
              type="number"
              value={unitPrice}
              onChange={(e) => setUnitPrice(parseFloat(e.target.value) || 300)}
              className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold text-slate-900 focus:outline-none focus:border-emerald-600"
            />
            <p className="text-[10px] text-slate-500 mt-1">{t('clistBenchmarkHint')}</p>
          </div>

          {/* Live Revenue Projection Box */}
          <div className="bg-[#0D2F1D] text-white border border-emerald-800 rounded-xl p-5 space-y-3">
            <div className="flex justify-between items-center border-b border-emerald-800/80 pb-3">
              <span className="text-xs font-bold text-emerald-300 uppercase tracking-wider">{t('clistGrossValue')}</span>
              <span className="text-base font-bold text-white font-mono">INR {grossValue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
            </div>

            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-300">{t('clistFee')}</span>
              <span className="text-rose-400 font-mono font-semibold">- INR {platformFee.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
            </div>

            <div className="flex justify-between items-center text-xs pt-1">
              <span className="text-emerald-300 font-bold uppercase tracking-wider">{t('clistNetEarnings')}</span>
              <span className="text-xl font-extrabold text-emerald-400 font-manrope font-mono">
                INR {netEarnings.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>

          <button
            type="submit"
            className="w-full py-3 bg-emerald-700 hover:bg-emerald-600 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-2"
          >
            <Sparkles className="w-4 h-4" />
            <span>{t('clistPublish')}</span>
          </button>
        </form>

      </div>
    </div>
  );
}
