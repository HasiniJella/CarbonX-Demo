import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, Layers, ShieldCheck, ArrowRight, CheckCircle2, Building, Hash } from 'lucide-react';
import BadgePill from '../components/BadgePill';
import { useLanguage } from '../context/LanguageContext';

export default function CorporateCreditAnalysis() {
  const navigate = useNavigate();
  const { t } = useLanguage();

  // Bulk Auto-Match Engine State
  const [targetVolume, setTargetVolume] = useState(100);
  const [priority, setPriority] = useState('lowest_price'); // nearest, highest_ndvi, lowest_price
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [paymentDone, setPaymentDone] = useState(false);

  // Greedy Fill Matched Parcels
  const matchedParcels = [
    { farm: 'Sri Venkateswara Organic Farm', farmer: 'Venkat Rao', survey: '124/A', credits: 78.0, rate: 340, badge: 'REGISTRY' },
    { farm: 'Godavari Maize Plot', farmer: 'Venkat Rao', survey: '124/B', credits: 22.0, rate: 320, badge: 'REGISTRY_DOC' }
  ];

  const totalMatchedCredits = matchedParcels.reduce((acc, item) => acc + item.credits, 0);
  const grossValue = matchedParcels.reduce((acc, item) => acc + item.credits * item.rate, 0);
  const facilitationFee = grossValue * 0.02;
  const netFarmerEscrow = grossValue - facilitationFee;

  const handleExecutePayment = () => {
    setPaymentDone(true);
    setTimeout(() => {
      setShowCheckoutModal(false);
      setPaymentDone(false);
      navigate('/buyer/certificates/CX-2026-CERT-00123');
    }, 2000);
  };

  return (
    <div className="min-h-screen bg-slate-50 font-inter text-slate-900 py-8 px-4 md:px-10">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* Header */}
        <div className="bg-white border border-slate-200 shadow-sm rounded-xl p-6 flex justify-between items-center">
          <div>
            <span className="text-xs font-semibold text-emerald-800 uppercase tracking-wider bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full inline-block mb-1">
              {t('ccaBadge')}
            </span>
            <h1 className="text-2xl font-extrabold text-slate-900 font-manrope">{t('ccaTitle')}</h1>
            <p className="text-xs text-slate-500 mt-0.5">{t('ccaDesc')}</p>
          </div>
          <Sparkles className="w-10 h-10 text-emerald-700" />
        </div>

        {/* Bulk Procurement Matrix */}
        <div className="bg-white border border-slate-200 shadow-sm rounded-xl p-6 space-y-6">
          <h2 className="text-base font-bold text-slate-900">{t('ccaConfigTitle')}</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Target Volume Slider */}
            <div className="space-y-2">
              <div className="flex justify-between items-center text-xs font-bold">
                <label className="text-slate-700 uppercase tracking-wider">{t('ccaTargetLabel')}</label>
                <span className="text-emerald-800 font-mono text-base">{targetVolume} MT</span>
              </div>
              <input
                type="range"
                min="50"
                max="1000"
                step="25"
                value={targetVolume}
                onChange={e => setTargetVolume(parseFloat(e.target.value))}
                className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-emerald-700"
              />
              <p className="text-[10px] text-slate-500">{t('ccaRange')}</p>
            </div>

            {/* Preference Priorities Selector */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                {t('ccaPriorityLabel')}
              </label>
              <select
                value={priority}
                onChange={e => setPriority(e.target.value)}
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-900 focus:outline-none"
              >
                <option value="lowest_price">{t('ccaOptPrice')}</option>
                <option value="highest_ndvi">{t('ccaOptNdvi')}</option>
                <option value="nearest">{t('ccaOptNearest')}</option>
              </select>
            </div>
          </div>

          {/* Matched Farm Parcels Summary Table */}
          <div className="space-y-3 pt-4 border-t border-slate-100">
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">{t('ccaTableTitle')}</h3>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 font-semibold uppercase tracking-wider">
                    <th className="py-2.5 px-4">{t('ccaThParcel')}</th>
                    <th className="py-2.5 px-4">{t('ccaThFarmer')}</th>
                    <th className="py-2.5 px-4">{t('ccaThSurvey')}</th>
                    <th className="py-2.5 px-4">{t('ccaThBadge')}</th>
                    <th className="py-2.5 px-4">{t('ccaThVolume')}</th>
                    <th className="py-2.5 px-4">{t('ccaThRate')}</th>
                    <th className="py-2.5 px-4">{t('ccaThSubtotal')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {matchedParcels.map((item, idx) => (
                    <tr key={idx} className="hover:bg-slate-50 transition-colors">
                      <td className="py-2.5 px-4 font-bold text-slate-900">{item.farm}</td>
                      <td className="py-2.5 px-4 text-slate-700">{item.farmer}</td>
                      <td className="py-2.5 px-4 font-mono text-slate-600">{item.survey}</td>
                      <td className="py-2.5 px-4">
                        <BadgePill badge={item.badge} size="sm" />
                      </td>
                      <td className="py-2.5 px-4 font-bold text-emerald-800">{item.credits} MT</td>
                      <td className="py-2.5 px-4 text-slate-900">INR {item.rate}</td>
                      <td className="py-2.5 px-4 font-extrabold text-slate-900">
                        INR {(item.credits * item.rate).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Escrow Financial Ledger Breakdown */}
        <div className="bg-[#1B4332] text-white border border-emerald-900 shadow-sm rounded-xl p-6 space-y-4">
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <Layers className="w-5 h-5 text-emerald-400" />
            <span>{t('ccaLedgerTitle')}</span>
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2 border-t border-emerald-800/80">
            <div>
              <p className="text-xs font-semibold text-slate-300 uppercase tracking-wider">{t('ccaTotalValue')}</p>
              <p className="text-2xl font-extrabold font-manrope text-white mt-1">
                INR {grossValue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </p>
            </div>

            <div>
              <p className="text-xs font-semibold text-slate-300 uppercase tracking-wider">{t('ccaFee')}</p>
              <p className="text-2xl font-extrabold font-manrope text-rose-300 mt-1">
                INR {facilitationFee.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </p>
            </div>

            <div>
              <p className="text-xs font-semibold text-slate-300 uppercase tracking-wider">{t('ccaFarmerAlloc')}</p>
              <p className="text-2xl font-extrabold font-manrope text-emerald-400 mt-1">
                INR {netFarmerEscrow.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </p>
            </div>
          </div>

          <button
            onClick={() => setShowCheckoutModal(true)}
            className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center justify-center gap-2 mt-4"
          >
            <span>{t('ccaProceedPay')}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        {/* Payment Gateway Modal */}
        {showCheckoutModal && (
          <div className="fixed inset-0 z-50 bg-[#1B4332]/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white border border-slate-200 shadow-xl rounded-xl p-6 max-w-md w-full space-y-4">
              <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <Building className="w-5 h-5 text-emerald-700" />
                  <h3 className="text-sm font-bold text-slate-900">{t('ccaGatewayTitle')}</h3>
                </div>
              </div>

              {paymentDone ? (
                <div className="bg-emerald-50 border border-emerald-200 text-emerald-900 p-4 rounded-xl text-center space-y-2">
                  <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto" />
                  <p className="font-bold text-sm">{t('ccaEscrowDone')}</p>
                  <p className="text-xs text-slate-600 font-mono">TX Hash: 0x7f9a883ce42b91028471abc882</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-1 text-xs">
                    <p className="font-semibold text-slate-700">{t('ccaGrossAmt')}: <strong className="text-slate-900">INR {grossValue.toLocaleString()}</strong></p>
                    <p className="text-[11px] text-slate-500">{t('ccaFeeNote')}</p>
                  </div>

                  <div className="flex gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowCheckoutModal(false)}
                      className="flex-1 py-2.5 bg-slate-100 text-slate-700 rounded-lg text-xs font-bold hover:bg-slate-200"
                    >
                      {t('mktCancel')}
                    </button>
                    <button
                      type="button"
                      onClick={handleExecutePayment}
                      className="flex-1 py-2.5 bg-emerald-700 text-white rounded-lg text-xs font-bold hover:bg-emerald-600 flex items-center justify-center gap-1"
                    >
                      <span>{t('ccaSimulate')}</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
