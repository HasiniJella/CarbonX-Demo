import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { AlertTriangle, Sparkles, TrendingUp, Compass, ArrowLeft, Leaf, Sliders, CheckCircle2 } from 'lucide-react';
import VerificationBadge from '../components/VerificationBadge';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';

export default function DetailedFarmAnalytics() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t } = useLanguage();

  // Multi-season Kharif vs Rabi historical NDVI dataset
  const trendData = [
    { month: t('dfaMonth1'), ndvi: 0.42, rabi_baseline: 0.40 },
    { month: t('dfaMonth2'), ndvi: 0.76, rabi_baseline: 0.60 },
    { month: t('dfaMonth3'), ndvi: 0.82, rabi_baseline: 0.70 },
    { month: t('dfaMonth4'), ndvi: 0.58, rabi_baseline: 0.55 },
    { month: t('dfaMonth5'), ndvi: 0.74, rabi_baseline: 0.72 },
    { month: t('dfaMonth6'), ndvi: 0.38, rabi_baseline: 0.35 }
  ];

  // P3 Score Simulator Practice Options
  const practiceOptions = [
    {
      id: 'none',
      name: t('dfaPracticeNone'),
      scoreDelta: 0,
      creditDelta: 0,
      earningsDelta: 0,
      desc: t('dfaPracticeNoneDesc')
    },
    {
      id: 'no_till',
      name: t('dfaPracticeNoTill'),
      scoreDelta: 8,
      creditDelta: 2.2,
      earningsDelta: 748,
      desc: t('dfaPracticeNoTillDesc')
    },
    {
      id: 'cover_crop',
      name: t('dfaPracticeCover'),
      scoreDelta: 6,
      creditDelta: 1.8,
      earningsDelta: 612,
      desc: t('dfaPracticeCoverDesc')
    },
    {
      id: 'awd_rice',
      name: t('dfaPracticeAwd'),
      scoreDelta: 10,
      creditDelta: 3.1,
      earningsDelta: 1054,
      desc: t('dfaPracticeAwdDesc')
    },
    {
      id: 'biochar',
      name: t('dfaPracticeBiochar'),
      scoreDelta: 12,
      creditDelta: 3.8,
      earningsDelta: 1292,
      desc: t('dfaPracticeBiocharDesc')
    }
  ];

  const [selectedPracticeId, setSelectedPracticeId] = useState('no_till');

  const activePractice = practiceOptions.find((p) => p.id === selectedPracticeId) || practiceOptions[0];

  const baseScore = 78;
  const baseCredits = 12.5;
  const baseEarnings = 4250;

  const currentScore = baseScore + activePractice.scoreDelta;
  const currentCredits = Math.round((baseCredits + activePractice.creditDelta) * 10) / 10;
  const currentEarnings = baseEarnings + activePractice.earningsDelta;

  return (
    <div className="min-h-screen bg-surface font-inter text-agriText-main py-8 px-4 md:px-10">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* Page Header */}
        <div className="bg-white border border-forest-100 shadow-card rounded-2xl p-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] font-bold text-primary uppercase tracking-wider bg-surface-sage border border-forest-200 px-2.5 py-0.5 rounded-full">
                {t('dfaBadge')}
              </span>
              <VerificationBadge badge="REGISTRY" showTier size="sm" />
            </div>
            <h1 className="text-2xl font-extrabold text-carbon-900 font-manrope">{t('dfaTitle')}</h1>
            <p className="text-xs text-agriText-muted mt-0.5">{t('dfaDesc')}</p>
          </div>

          <button
            onClick={() => navigate('/farmer/dashboard')}
            className="px-4 py-2.5 bg-surface-sage hover:bg-forest-100 border border-forest-200 text-carbon-800 rounded-xl text-xs font-bold transition-all flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>{t('cwelBackDashboard')}</span>
          </button>
        </div>

        {/* P3 Interactive Score Improvement Simulator */}
        <div className="bg-white border border-forest-100 shadow-card rounded-2xl p-6 space-y-5">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-forest-100 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <Sliders className="w-5 h-5 text-primary" />
                <h2 className="text-base font-bold text-carbon-900">{t('dfaSimTitle')}</h2>
              </div>
              <p className="text-xs text-agriText-muted">{t('dfaSimDesc')}</p>
            </div>

            <span className="text-[10px] font-bold text-agriText-subtle bg-warm-cream px-2 py-1 rounded">
              {t('dfaSimBadge')}
            </span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Practice Selection Form */}
            <div className="space-y-3">
              <label className="block text-xs font-bold text-carbon-800">
                {t('dfaSelectLabel')}
              </label>
              <select
                value={selectedPracticeId}
                onChange={(e) => setSelectedPracticeId(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-surface-sage/40 border border-forest-200 rounded-xl text-xs font-bold text-carbon-900 focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                {practiceOptions.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} {p.scoreDelta > 0 ? `(+${p.scoreDelta} ${t('dfaPts')})` : ''}
                  </option>
                ))}
              </select>
              <p className="text-xs text-agriText-muted bg-surface-sage/30 p-3 rounded-xl border border-forest-100 leading-relaxed">
                {activePractice.desc}
              </p>
            </div>

            {/* Projected Impact Displays */}
            <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-surface-sage/40 border border-forest-200 rounded-xl p-4 space-y-1">
                <span className="text-[10px] text-agriText-subtle font-semibold uppercase tracking-wider block">{t('dfaProjScore')}</span>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-extrabold text-carbon-900 font-manrope">{currentScore}</span>
                  <span className="text-xs text-agriText-subtle">/ 100</span>
                </div>
                {activePractice.scoreDelta > 0 && (
                  <span className="text-[11px] font-bold text-primary flex items-center gap-0.5">
                    <Sparkles className="w-3.5 h-3.5" /> +{activePractice.scoreDelta} {t('dfaBoost')}
                  </span>
                )}
              </div>

              <div className="bg-surface-sage/40 border border-forest-200 rounded-xl p-4 space-y-1">
                <span className="text-[10px] text-agriText-subtle font-semibold uppercase tracking-wider block">{t('dfaProjCredits')}</span>
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-extrabold text-carbon-900 font-manrope">{currentCredits}</span>
                  <span className="text-xs text-agriText-subtle">tCO2e</span>
                </div>
                {activePractice.creditDelta > 0 && (
                  <span className="text-[11px] font-bold text-primary flex items-center gap-0.5">
                    <TrendingUp className="w-3.5 h-3.5" /> +{activePractice.creditDelta} tCO2e/yr
                  </span>
                )}
              </div>

              <div className="bg-surface-sage border border-forest-200 rounded-xl p-4 space-y-1">
                <span className="text-[10px] text-agriText-subtle font-semibold uppercase tracking-wider block">{t('dfaProjRevenue')}</span>
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-extrabold text-primary font-manrope">₹{currentEarnings.toLocaleString('en-IN')}</span>
                  <span className="text-xs text-agriText-muted">{t('dfaPerYr')}</span>
                </div>
                {activePractice.earningsDelta > 0 && (
                  <span className="text-[11px] font-bold text-primary flex items-center gap-0.5">
                    <CheckCircle2 className="w-3.5 h-3.5" /> +₹{activePractice.earningsDelta}{t('dfaDeltaSuffix')}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Recharts Trend Visualizer */}
        <div className="bg-white border border-forest-100 shadow-card rounded-2xl p-6 space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-base font-bold text-carbon-900">{t('dfaChartTitle')}</h2>
              <p className="text-xs text-agriText-muted">{t('dfaChartDesc')}</p>
            </div>
            <div className="flex items-center gap-4 text-xs font-medium">
              <span className="flex items-center gap-1.5 text-primary font-bold">
                <span className="w-3 h-3 bg-primary rounded-full inline-block" /> {t('dfaLegendKharif')}
              </span>
              <span className="flex items-center gap-1.5 text-agriText-subtle">
                <span className="w-3 h-3 bg-agriText-subtle rounded-full inline-block" /> {t('dfaLegendRabi')}
              </span>
            </div>
          </div>

          <div className="h-72 w-full pt-4">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#EEF5EE" />
                <XAxis dataKey="month" stroke="#526056" style={{ fontSize: '11px', fontWeight: '600' }} />
                <YAxis domain={[0.2, 1.0]} stroke="#526056" style={{ fontSize: '11px', fontWeight: '600' }} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1F2923', borderColor: '#323C34', borderRadius: '12px', color: '#FFF', fontSize: '12px' }}
                />
                <Line type="monotone" dataKey="ndvi" stroke="#1F7A4D" strokeWidth={3} dot={{ r: 4, fill: '#1F7A4D' }} />
                <Line type="monotone" dataKey="rabi_baseline" stroke="#94A397" strokeWidth={2} strokeDasharray="5 5" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>
    </div>
  );
}
