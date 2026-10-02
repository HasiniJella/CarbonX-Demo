import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, ArrowRight, Download, CheckCircle2, Hash, Layers } from 'lucide-react';
import BadgePill from '../components/BadgePill';
import { useLanguage } from '../context/LanguageContext';

export default function VerificationSuccess() {
  const navigate = useNavigate();
  const { t } = useLanguage();

  return (
    <div className="min-h-screen bg-slate-50 font-inter text-slate-900 py-10 px-4 flex items-center justify-center">
      <div className="max-w-xl w-full space-y-6">

        {/* Verification Card */}
        <div className="bg-white border border-slate-200 shadow-sm rounded-xl p-6 text-center space-y-4">
          <div className="w-14 h-14 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-center text-emerald-700 mx-auto">
            <ShieldCheck className="w-8 h-8" />
          </div>

          <div>
            <span className="text-xs font-semibold text-emerald-800 uppercase tracking-wider bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full">
              {t('vsucBadge')}
            </span>
            <h1 className="text-2xl font-extrabold text-slate-900 font-manrope mt-2">
              {t('vsucTitle')}
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              {t('vsucDesc')}
            </p>
          </div>

          <div className="py-2">
            <BadgePill badge="REGISTRY" size="lg" />
          </div>

          {/* Blockchain Transaction Hash Display */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs flex items-center justify-between font-mono">
            <div className="flex items-center gap-2 text-slate-600">
              <Hash className="w-4 h-4 text-emerald-700" />
              <span>{t('vsucHashLabel')}</span>
            </div>
            <span className="font-bold text-slate-900 truncate max-w-[200px] sm:max-w-xs">
              0x7f9a883ce42b91028471abc882
            </span>
          </div>

          {/* Data Summary Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 text-left">
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
              <p className="text-[10px] font-semibold text-slate-500 uppercase">{t('vsucParcelId')}</p>
              <p className="text-xs font-bold text-slate-900 mt-0.5">TEL-124/A</p>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
              <p className="text-[10px] font-semibold text-slate-500 uppercase">{t('vsucAcreage')}</p>
              <p className="text-xs font-bold text-slate-900 mt-0.5">2.50 Acres</p>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
              <p className="text-[10px] font-semibold text-slate-500 uppercase">{t('vsucBaselineNdvi')}</p>
              <p className="text-xs font-bold text-emerald-800 mt-0.5">0.78 Index</p>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
              <p className="text-[10px] font-semibold text-slate-500 uppercase">{t('vsucAnnualCredits')}</p>
              <p className="text-xs font-bold text-emerald-800 mt-0.5">12.50 MT</p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <button
              onClick={() => alert(t('vsucDownloading'))}
              className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2"
            >
              <Download className="w-4 h-4" />
              <span>{t('vsucDownload')}</span>
            </button>

            <button
              onClick={() => navigate('/farmer/dashboard')}
              className="flex-1 py-2.5 bg-emerald-700 hover:bg-emerald-600 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-2"
            >
              <span>{t('vsucGoDashboard')}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
