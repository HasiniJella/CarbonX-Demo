import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Globe, Download, FileText, Sparkles, ArrowRight, ShieldCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';

export default function CorporateDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t } = useLanguage();

  const companyName = user?.name || 'Telangana Sustainable Agro Pvt Ltd';
  const targetOffsets = 1000.0;
  const purchasedOffsets = 350.0;
  const progressPercent = ((purchasedOffsets / targetOffsets) * 100).toFixed(1);

  const [isExporting, setIsExporting] = useState(false);

  const handleExportBRSR = () => {
    setIsExporting(true);
    setTimeout(() => {
      setIsExporting(false);
      alert(t('cdashBrsrDone'));
    }, 1500);
  };

  return (
    <div className="min-h-screen bg-[#F8FAF8] font-inter text-slate-900 py-8 px-4 md:px-10">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* Corporate Profile Header */}
        <div className="bg-white border border-slate-200 border-l-4 border-l-emerald-600 shadow-sm rounded-xl p-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <span className="text-xs font-semibold text-emerald-800 uppercase tracking-wider bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full">
              {t('cdashBadge')}
            </span>
            <h1 className="text-2xl font-extrabold text-slate-900 font-manrope mt-1">{companyName}</h1>
            <p className="text-xs text-slate-500 mt-0.5">{t('cdashSub')}</p>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => navigate('/marketplace/checkout')}
              className="px-4 py-2.5 bg-[#1B4332] hover:bg-[#2D6A4F] text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-2"
            >
              <Sparkles className="w-4 h-4 text-emerald-300" />
              <span>{t('cdashBulkMatch')}</span>
            </button>
          </div>
        </div>

        {/* Net-Zero Progress Bar */}
        <div className="bg-[#1B4332] text-white border border-emerald-900 shadow-sm rounded-xl p-6 space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-xs font-bold text-emerald-300 uppercase tracking-wider">{t('cdashProgress')}</p>
              <h2 className="text-3xl font-extrabold font-manrope text-white mt-1">
                {purchasedOffsets} / {targetOffsets} MT CO2e
              </h2>
            </div>
            <span className="text-xl font-extrabold font-mono text-[#D1FAE5]">{progressPercent}% {t('cdashAchieved')}</span>
          </div>

          <div className="w-full bg-emerald-950 border border-emerald-800 h-3.5 rounded-full overflow-hidden">
            <div
              className="bg-emerald-400 h-full rounded-full transition-all duration-1000"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* BRSR Export Card & Procurement Certificates */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

          {/* BRSR Export Card */}
          <div className="bg-white border border-slate-200 border-l-4 border-l-emerald-600 shadow-sm rounded-xl p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-emerald-50 text-emerald-800 rounded-xl flex items-center justify-center">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">{t('cdashBrsrTitle')}</h3>
                <p className="text-xs text-slate-500">{t('cdashBrsrSub')}</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              {t('cdashBrsrDesc')}
            </p>

            <button
              onClick={handleExportBRSR}
              disabled={isExporting}
              className="w-full py-2.5 bg-[#1B4332] hover:bg-[#2D6A4F] text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-2"
            >
              <Download className="w-4 h-4" />
              <span>{isExporting ? t('cdashGenerating') : t('cdashDownloadBrsr')}</span>
            </button>
          </div>

          {/* Procurement Certificates */}
          <div className="bg-white border border-slate-200 border-l-4 border-l-emerald-600 shadow-sm rounded-xl p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-emerald-50 text-emerald-800 rounded-xl flex items-center justify-center">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">{t('cdashCertTitle')}</h3>
                <p className="text-xs text-slate-500">{t('cdashCertSub')}</p>
              </div>
            </div>

            <div className="space-y-2">
              <div
                onClick={() => navigate('/buyer/certificates/CX-2026-CERT-00123')}
                className="bg-[#F8FAF8] border border-slate-200 rounded-lg p-3 flex justify-between items-center hover:border-emerald-600 cursor-pointer transition-all"
              >
                <div>
                  <p className="text-xs font-mono font-bold text-slate-900">CX-2026-CERT-00123</p>
                  <p className="text-[10px] text-slate-500">100 MT CO2e : {t('cdashHeldEscrow')}</p>
                </div>
                <ArrowRight className="w-4 h-4 text-emerald-700" />
              </div>

              <div
                onClick={() => navigate('/buyer/certificates/CX-2026-CERT-00089')}
                className="bg-[#F8FAF8] border border-slate-200 rounded-lg p-3 flex justify-between items-center hover:border-emerald-600 cursor-pointer transition-all"
              >
                <div>
                  <p className="text-xs font-mono font-bold text-slate-900">CX-2026-CERT-00089</p>
                  <p className="text-[10px] text-slate-500">250 MT CO2e : {t('cdashRetired')}</p>
                </div>
                <ArrowRight className="w-4 h-4 text-emerald-700" />
              </div>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
