import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Leaf, Sparkles, Sprout, Droplets, ShieldCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';

export default function FarmDetailsForm() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t } = useLanguage();

  const [crop, setCrop] = useState('Cotton');
  const [irrigation, setIrrigation] = useState('Drip Irrigation');
  const [tillage, setTillage] = useState('Zero-Till');
  const [fertilizer, setFertilizer] = useState('Bio-Fertilizers & Compost');

  // Real-time estimated carbon bonus per practice
  const getBonus = () => {
    let bonus = 0;
    if (tillage === 'Zero-Till') bonus += 0.50;
    if (tillage === 'Reduced-Till') bonus += 0.25;
    if (irrigation === 'Drip Irrigation') bonus += 0.35;
    if (fertilizer.includes('Bio-Fertilizers')) bonus += 0.40;
    return bonus.toFixed(2);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    localStorage.setItem('carbonx_farm_details', JSON.stringify({ crop, irrigation, tillage, fertilizer, bonus: getBonus() }));
    navigate('/satellite-preview');
  };

  return (
    <div className="min-h-screen bg-slate-50 font-inter text-slate-900 py-8 px-4 md:px-10">
      <div className="max-w-2xl mx-auto space-y-6">

        {/* Page Title */}
        <div className="bg-white border border-slate-200 shadow-sm rounded-xl p-6 flex justify-between items-center">
          <div>
            <span className="text-xs font-semibold text-emerald-800 uppercase tracking-wider bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full inline-block mb-1">
              {t('fdetBadge')}
            </span>
            <h1 className="text-2xl font-extrabold text-slate-900 font-manrope">{t('fdetTitle')}</h1>
            <p className="text-xs text-slate-500 mt-0.5">{t('fdetSubtitle')}</p>
          </div>
          <Sprout className="w-10 h-10 text-emerald-700" />
        </div>

        {/* Real-Time Impact Preview Banner */}
        <div className="bg-[#0D2F1D] text-white border border-emerald-800 shadow-sm rounded-xl p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-800/80 rounded-xl flex items-center justify-center text-emerald-300">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-bold text-emerald-300 uppercase tracking-wider">{t('fdetBonusYield')}</p>
              <p className="text-xl font-extrabold font-manrope text-white mt-0.5">
                +{getBonus()} {t('fdetCreditsPerAcre')}
              </p>
            </div>
          </div>
          <span className="text-[11px] bg-emerald-950 border border-emerald-600 text-emerald-300 px-3 py-1 rounded-full font-semibold">
            {t('fdetLstmBoost')}
          </span>
        </div>

        {/* Practices Form */}
        <form onSubmit={handleSubmit} className="bg-white border border-slate-200 shadow-sm rounded-xl p-6 space-y-5">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">{t('fdetPrimaryCrop')}</label>
            <select
              value={crop}
              onChange={e => setCrop(e.target.value)}
              className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-900 focus:outline-none focus:border-emerald-600"
            >
              <option value="Cotton">{t('fdetCropCotton')}</option>
              <option value="Paddy (Rice)">{t('fdetCropPaddy')}</option>
              <option value="Pulses & Millets">{t('fdetCropPulses')}</option>
              <option value="Maize">{t('fdetCropMaize')}</option>
              <option value="Sugarcane">{t('fdetCropSugarcane')}</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">{t('fdetIrrigationSystem')}</label>
            <select
              value={irrigation}
              onChange={e => setIrrigation(e.target.value)}
              className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-900 focus:outline-none focus:border-emerald-600"
            >
              <option value="Drip Irrigation">{t('fdetIrrDrip')}</option>
              <option value="Sprinkler System">{t('fdetIrrSprinkler')}</option>
              <option value="Rain-fed">{t('fdetIrrRainfed')}</option>
              <option value="Canal Flood">{t('fdetIrrCanal')}</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">{t('fdetTillageLabel')}</label>
            <select
              value={tillage}
              onChange={e => setTillage(e.target.value)}
              className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-900 focus:outline-none focus:border-emerald-600"
            >
              <option value="Zero-Till">{t('fdetTillZero')}</option>
              <option value="Reduced-Till">{t('fdetTillReduced')}</option>
              <option value="Conventional">{t('fdetTillConventional')}</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">{t('fdetFertLabel')}</label>
            <select
              value={fertilizer}
              onChange={e => setFertilizer(e.target.value)}
              className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-900 focus:outline-none focus:border-emerald-600"
            >
              <option value="Bio-Fertilizers & Compost">{t('fdetFertBio')}</option>
              <option value="Integrated Nutrient Mgmt">{t('fdetFertInm')}</option>
              <option value="Synthetic NPK">{t('fdetFertSynthetic')}</option>
            </select>
          </div>

          <button
            type="submit"
            className="w-full py-3 bg-emerald-700 hover:bg-emerald-600 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-2 mt-4"
          >
            <span>{t('fdetProceedBtn')}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

      </div>
    </div>
  );
}
