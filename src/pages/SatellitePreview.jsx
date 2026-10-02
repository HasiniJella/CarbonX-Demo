import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Satellite, CheckCircle2, Lock, Sparkles, Activity, Layers, Sprout } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

export default function SatellitePreview() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [progress, setProgress] = useState(0);
  const [mrvLocked, setMrvLocked] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev < 100) {
          return prev + 20;
        } else {
          clearInterval(interval);
          setMrvLocked(true);
          setTimeout(() => navigate('/verification-success'), 1800);
          return 100;
        }
      });
    }, 600);
    return () => clearInterval(interval);
  }, [navigate]);

  return (
    <div className="min-h-screen bg-[#F8FAF8] font-inter text-slate-900 flex flex-col items-center justify-center p-4 md:p-8">
      <div className="max-w-2xl w-full space-y-6">

        {/* HUD Scanner Box */}
        <div className="bg-[#1B4332] text-white border border-emerald-900 rounded-2xl p-8 text-center relative overflow-hidden shadow-xl">
          <div className="relative w-24 h-24 mx-auto mb-4">
            <div className="absolute inset-0 bg-emerald-400/20 rounded-full animate-ping" />
            <div className="absolute inset-0 border-2 border-emerald-400 rounded-full flex items-center justify-center bg-[#1B4332] shadow-inner">
              <Satellite className="w-10 h-10 text-emerald-300" />
            </div>
          </div>

          <span className="text-[10px] font-bold uppercase tracking-wider bg-[#2D6A4F] text-[#D1FAE5] border border-emerald-500/40 px-3 py-1 rounded-full inline-block mb-2">
            {t('satScannerBadge')}
          </span>
          <h1 className="text-2xl font-extrabold font-manrope text-white">{t('satTitle')}</h1>
          <p className="text-xs text-emerald-100/80 mt-1 max-w-md mx-auto">
            {t('satDesc')}
          </p>

          {/* Linear Progress Bar */}
          <div className="mt-6 max-w-md mx-auto space-y-2">
            <div className="flex justify-between items-center text-xs font-semibold text-emerald-200">
              <span>{mrvLocked ? t('satScanComplete') : t('satIndexing')}</span>
              <span className="font-mono">{progress}%</span>
            </div>
            <div className="w-full bg-emerald-950/80 border border-emerald-700/50 h-3 rounded-full overflow-hidden">
              <div
                className="bg-emerald-400 h-full rounded-full transition-all duration-500 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          {mrvLocked && (
            <div className="mt-6 inline-flex items-center gap-2 bg-[#2D6A4F] border border-emerald-400 text-[#D1FAE5] px-5 py-2 rounded-full text-xs font-bold font-mono shadow-md animate-in fade-in zoom-in duration-200">
              <Lock className="w-4 h-4" />
              <span>{t('satLocked')}</span>
            </div>
          )}
        </div>

        {/* 3-Column Real-Time Metric Ribbon */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-1">
            <div className="flex items-center gap-2 text-emerald-700 mb-1">
              <Sprout className="w-4 h-4" />
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">{t('satNdviLabel')}</span>
            </div>
            <p className="text-2xl font-extrabold text-slate-900 font-mono">0.78</p>
            <p className="text-[11px] text-emerald-700 font-semibold">{t('satNdviDesc')}</p>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-1">
            <div className="flex items-center gap-2 text-emerald-700 mb-1">
              <Activity className="w-4 h-4" />
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">{t('satBioLabel')}</span>
            </div>
            <p className="text-2xl font-extrabold text-slate-900 font-mono">8.4 / 10</p>
            <p className="text-[11px] text-emerald-700 font-semibold">{t('satBioDesc')}</p>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-1">
            <div className="flex items-center gap-2 text-emerald-700 mb-1">
              <Layers className="w-4 h-4" />
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">{t('satSeqLabel')}</span>
            </div>
            <p className="text-2xl font-extrabold text-slate-900 font-mono">12.50 MT</p>
            <p className="text-[11px] text-emerald-700 font-semibold">{t('satSeqDesc')}</p>
          </div>
        </div>

      </div>
    </div>
  );
}
