import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Leaf, ArrowRight, ShieldCheck, Cpu, Globe, Users, Building2, Wallet, CheckCircle2 } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

export default function LandingPage() {
  const navigate = useNavigate();
  const { currentLang, changeLanguage, t } = useLanguage();

  return (
    <div className="min-h-screen bg-[#F8FAF8] font-inter text-slate-900">
      {/* Full-width Organic Green Header */}
      <header className="sticky top-0 z-50 bg-[#1B4332] border-b border-emerald-900 text-white px-3 md:px-10 py-3 md:py-3.5 shadow-md">
        <div className="max-w-7xl mx-auto flex justify-between items-center gap-2">
          <div className="flex items-center gap-2 sm:gap-3 cursor-pointer min-w-0" onClick={() => navigate('/')}>
            <div className="w-9 h-9 sm:w-10 sm:h-10 bg-[#2D6A4F] border border-emerald-500 rounded-xl flex items-center justify-center text-white shadow-sm shrink-0">
              <Leaf className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <span className="font-manrope font-extrabold text-lg sm:text-xl tracking-tight block leading-tight text-white">CarbonX</span>
              <span className="hidden sm:block text-[10px] font-medium text-emerald-200 truncate">Enterprise AgTech & Carbon Infrastructure</span>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-4 shrink-0">
            <div className="flex items-center gap-1.5 bg-[#2D6A4F]/60 border border-emerald-600 rounded-xl px-2 sm:px-3 py-1.5 text-xs text-white">
              <Globe className="w-3.5 h-3.5 text-emerald-300" />
              <select
                value={currentLang}
                onChange={(e) => changeLanguage(e.target.value)}
                className="bg-transparent border-none outline-none text-xs font-semibold text-white cursor-pointer"
              >
                <option value="en" className="bg-[#1B4332] text-white">English</option>
                <option value="te" className="bg-[#1B4332] text-white">తెలుగు (Telugu)</option>
              </select>
            </div>

            <button
              onClick={() => navigate('/role-selection')}
              className="text-xs font-semibold text-emerald-100 hover:text-white px-3 py-2 rounded-xl transition-colors hidden sm:block"
            >
              {t('landSignIn')}
            </button>

            <button
              onClick={() => navigate('/role-selection')}
              className="text-xs font-bold text-white bg-[#2D6A4F] hover:bg-[#40916C] px-3 py-2 sm:px-4 sm:py-2.5 rounded-xl transition-all shadow-sm flex items-center gap-2 border border-emerald-500"
            >
              <span className="hidden min-[400px]:inline">{t('landGetStarted')}</span>
              <span className="min-[400px]:hidden">{t('continue')}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Hero Banner with authentic farmland imagery overlay */}
      <section className="relative bg-[#1B4332] text-white py-20 px-4 md:px-10 overflow-hidden">
        <div className="absolute inset-0 z-0 opacity-20 bg-[url('https://images.unsplash.com/photo-1500937386664-56d1dfef3854?auto=format&fit=crop&q=80&w=1600')] bg-cover bg-center" />
        <div className="absolute inset-0 bg-gradient-to-b from-[#1B4332]/85 via-[#1B4332]/95 to-[#1B4332]" />

        <div className="relative z-10 max-w-5xl mx-auto text-center pt-6">
          <div className="inline-flex items-center gap-2 bg-[#2D6A4F]/80 border border-emerald-400/40 px-4 py-1.5 rounded-full text-xs font-semibold text-[#D1FAE5] mb-6 shadow-inner">
            <ShieldCheck className="w-4 h-4 text-emerald-300" />
            <span>{t('landHeroBadge')}</span>
          </div>

          <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight leading-tight mb-6 font-manrope">
            {t('landHeroA')} <span className="text-emerald-300">{t('landHeroB')}</span>
          </h1>

          <p className="text-lg md:text-xl text-emerald-100 max-w-3xl mx-auto leading-relaxed mb-10">
            {t('landHeroSub')}
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={() => navigate('/role-selection')}
              className="px-8 py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold text-sm transition-all shadow-md flex items-center justify-center gap-2"
            >
              <span>{t('landGetStarted')}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
            <button
              onClick={() => navigate('/marketplace')}
              className="px-8 py-3.5 bg-transparent hover:bg-white/10 text-[#D1FAE5] border border-emerald-500 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2"
            >
              <span>{t('landExplore')}</span>
            </button>
          </div>
          <p className="text-xs text-emerald-200/80 mt-5">
            {t('landPortalHint')}
          </p>
        </div>
      </section>

      {/* Live Key Performance Indicators (Bento Grid) */}
      <section className="max-w-7xl mx-auto px-4 md:px-10 -mt-8 relative z-20 mb-16">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white border border-slate-200 border-l-4 border-l-emerald-600 shadow-sm rounded-xl p-6 flex items-center gap-4">
            <div className="w-12 h-12 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-center text-emerald-800">
              <Leaf className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{t('landKpi1T')}</p>
              <p className="text-2xl font-extrabold text-slate-900 font-manrope mt-1">14,200 Acres</p>
              <p className="text-xs text-emerald-700 font-medium mt-0.5">{t('landKpi1S')}</p>
            </div>
          </div>

          <div className="bg-white border border-slate-200 border-l-4 border-l-emerald-600 shadow-sm rounded-xl p-6 flex items-center gap-4">
            <div className="w-12 h-12 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-center text-emerald-800">
              <Cpu className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{t('landKpi2T')}</p>
              <p className="text-2xl font-extrabold text-slate-900 font-manrope mt-1">285.4K Tonnes</p>
              <p className="text-xs text-emerald-700 font-medium mt-0.5">{t('landKpi2S')}</p>
            </div>
          </div>

          <div className="bg-white border border-slate-200 border-l-4 border-l-emerald-600 shadow-sm rounded-xl p-6 flex items-center gap-4">
            <div className="w-12 h-12 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-center text-emerald-800">
              <Wallet className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{t('landKpi3T')}</p>
              <p className="text-2xl font-extrabold text-slate-900 font-manrope mt-1">INR 12.4 Cr</p>
              <p className="text-xs text-emerald-700 font-medium mt-0.5">{t('landKpi3S')}</p>
            </div>
          </div>
        </div>
      </section>

      {/* Institutional Trust Ribbon */}
      <section className="bg-[#1B4332] text-emerald-100 py-6 border-y border-emerald-900 mb-16">
        <div className="max-w-7xl mx-auto px-4 md:px-10 flex flex-wrap justify-between items-center gap-6 text-xs font-semibold">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-300" />
            <span>{t('landTrust1')}</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-300" />
            <span>{t('landTrust2')}</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-300" />
            <span>{t('landTrust3')}</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-300" />
            <span>{t('landTrust4')}</span>
          </div>
        </div>
      </section>

      {/* Quick Portal Navigation Cards */}
      <section className="max-w-7xl mx-auto px-4 md:px-10 mb-20">
        <div className="text-center mb-12">
          <h2 className="text-2xl md:text-3xl font-extrabold text-slate-900 font-manrope">{t('landChooseT')}</h2>
          <p className="text-sm text-slate-600 mt-2">{t('landChooseS')}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Farmer Card */}
          <div className="bg-white border border-slate-200 border-l-4 border-l-emerald-600 shadow-sm rounded-xl p-6 flex flex-col justify-between hover:border-emerald-500 transition-all">
            <div>
              <div className="w-12 h-12 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-center text-emerald-800 mb-4">
                <Users className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-900">{t('landFarmerT')}</h3>
              <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                {t('landFarmerD')}
              </p>
            </div>
            <button
              onClick={() => navigate('/farmer/register')}
              className="mt-6 w-full py-2.5 bg-[#1B4332] hover:bg-[#2D6A4F] text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2"
            >
              <span>{t('landFarmerCta')}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          {/* FPO Card */}
          <div className="bg-white border border-slate-200 border-l-4 border-l-emerald-600 shadow-sm rounded-xl p-6 flex flex-col justify-between hover:border-emerald-500 transition-all">
            <div>
              <div className="w-12 h-12 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-center text-emerald-800 mb-4">
                <Building2 className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-900">{t('landFpoT')}</h3>
              <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                {t('landFpoD')}
              </p>
            </div>
            <button
              onClick={() => navigate('/fpo/login')}
              className="mt-6 w-full py-2.5 bg-[#1B4332] hover:bg-[#2D6A4F] text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2"
            >
              <span>{t('landFpoCta')}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          {/* Corporate Card */}
          <div className="bg-white border border-slate-200 border-l-4 border-l-emerald-600 shadow-sm rounded-xl p-6 flex flex-col justify-between hover:border-emerald-500 transition-all">
            <div>
              <div className="w-12 h-12 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-center text-emerald-800 mb-4">
                <Globe className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-900">{t('landCorpT')}</h3>
              <p className="text-xs text-slate-600 mt-2 leading-relaxed">
                {t('landCorpD')}
              </p>
            </div>
            <button
              onClick={() => navigate('/corporate/welcome')}
              className="mt-6 w-full py-2.5 bg-[#1B4332] hover:bg-[#2D6A4F] text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2"
            >
              <span>{t('landCorpCta')}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-[#1B4332] text-emerald-100 py-8 border-t border-emerald-900 text-center text-xs">
        <div className="max-w-7xl mx-auto px-4 md:px-10 flex flex-col sm:flex-row justify-between items-center gap-4">
          <p>{t('landFooterTag')}</p>
          <div className="flex gap-4">
            <button onClick={() => navigate('/role-selection')} className="hover:text-white transition-colors">{t('landRolePortal')}</button>
            <button onClick={() => navigate('/support')} className="hover:text-white transition-colors">{t('navSupport')}</button>
            <button onClick={() => navigate('/marketplace')} className="hover:text-white transition-colors">{t('navMarketplace')}</button>
          </div>
        </div>
      </footer>
    </div>
  );
}
