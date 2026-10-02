import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Globe, ShieldCheck, ArrowRight, Layers, Sparkles, Building2, Info } from 'lucide-react';
import BadgePill from '../components/BadgePill';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';

export default function CorporateWelcome() {
  const navigate = useNavigate();
  const { isAuthenticated, role, user } = useAuth();
  const { t } = useLanguage();
  const isBuyer = role === 'buyer';
  const isFarmerSession = isAuthenticated && !isBuyer;

  return (
    <div className="min-h-screen bg-[#F8FAF8] font-inter text-slate-900 py-8 px-4 md:px-10">
      <div className="max-w-7xl mx-auto space-y-6">

        {isFarmerSession && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center gap-3 text-xs">
            <div className="flex items-start gap-2 flex-1">
              <Info className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
              <p className="text-amber-900">
                <span className="font-bold">{t('cwelSignedInAs')} {user?.name || t('cwelFarmerFallback')}.</span>{' '}
                {t('cwelPortalNote')}
              </p>
            </div>
            <div className="flex gap-2 shrink-0">
              <button
                onClick={() => navigate('/corporate/login')}
                className="px-4 py-2 bg-[#1B4332] hover:bg-[#2D6A4F] text-white rounded-xl text-xs font-bold transition-all"
              >
                {t('cwelContinueCompany')}
              </button>
              <button
                onClick={() => navigate('/dashboard')}
                className="px-4 py-2 bg-white border border-amber-200 text-amber-900 rounded-xl text-xs font-bold hover:bg-amber-100 transition-all"
              >
                {t('cwelBackDashboard')}
              </button>
            </div>
          </div>
        )}

        {/* Hero */}
        <div className="bg-[#1B4332] text-white border border-emerald-900 shadow-sm rounded-xl p-8 relative overflow-hidden">
          <div className="max-w-3xl relative z-10 space-y-4">
            <span className="text-xs font-semibold text-emerald-300 uppercase tracking-wider bg-emerald-950 border border-emerald-700 px-3 py-1 rounded-full">
              {t('cwelGateway')}
            </span>
            <h1 className="text-3xl md:text-4xl font-extrabold font-manrope text-white">
              {t('cwelHeroTitle')}
            </h1>
            <p className="text-xs md:text-sm text-slate-300 leading-relaxed">
              {t('cwelHeroSub')}
            </p>

            <div className="flex flex-wrap gap-4 pt-2">
              <button
                onClick={() => navigate('/marketplace')}
                className="px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-2"
              >
                <span>{t('cwelExploreMarket')}</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <button
                onClick={() => navigate(isBuyer ? '/marketplace/checkout' : '/corporate/login')}
                className="px-6 py-3 bg-[#2D6A4F] hover:bg-[#40916C] text-[#D1FAE5] border border-emerald-500 rounded-xl text-xs font-bold transition-all flex items-center gap-2"
              >
                <Sparkles className="w-4 h-4 text-emerald-300" />
                <span>{isBuyer ? t('cwelBulkMatch') : t('cwelCompanySignIn')}</span>
              </button>
            </div>
            {!isBuyer && (
              <p className="text-[11px] text-slate-400">
                {t('cwelBrowseNote')}
              </p>
            )}
          </div>
        </div>

        {/* Verification Badge Tiers Explanation */}
        <div className="bg-white border border-slate-200 shadow-sm rounded-xl p-6 space-y-6">
          <h2 className="text-lg font-bold text-slate-900">{t('cwelBadgeTitle')}</h2>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 space-y-2">
              <BadgePill badge="REGISTRY" size="sm" />
              <p className="text-xs font-bold text-slate-900 mt-2">{t('cwelTier1A')}</p>
              <p className="text-[11px] text-slate-600">{t('cwelTier1ADesc')}</p>
            </div>

            <div className="bg-emerald-50/60 border border-emerald-200 rounded-xl p-4 space-y-2">
              <BadgePill badge="REGISTRY_DOC" size="sm" />
              <p className="text-xs font-bold text-slate-900 mt-2">{t('cwelTier1B')}</p>
              <p className="text-[11px] text-slate-600">{t('cwelTier1BDesc')}</p>
            </div>

            <div className="bg-sky-50 border border-sky-200 rounded-xl p-4 space-y-2">
              <BadgePill badge="DOCUMENT" size="sm" />
              <p className="text-xs font-bold text-slate-900 mt-2">{t('cwelTier2')}</p>
              <p className="text-[11px] text-slate-600">{t('cwelTier2Desc')}</p>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-2">
              <BadgePill badge="FPO" size="sm" />
              <p className="text-xs font-bold text-slate-900 mt-2">{t('cwelTier3')}</p>
              <p className="text-[11px] text-slate-600">{t('cwelTier3Desc')}</p>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
