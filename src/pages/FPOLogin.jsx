import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, Phone, ArrowRight, ShieldCheck, RefreshCw, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { loginFpo, sendOtp } from '../services/api';

export default function FPOLogin() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const { t } = useLanguage();

  const telanganaFpos = [
    'Yaadadri Laxmi Narsimha Farmers Producer Company (Mothkur)',
    'Prasanna Farmers Producer Company Limited (Mothkur)',
    'Eruvaka Farmers Producer Company Limited (Wardhannapet)',
    'Nava Vikas Farmers Producer Company Limited (Jangaon)',
    'Enabavi Producers Cooperative (Jangaon)'
  ];

  const [selectedFpo, setSelectedFpo] = useState(telanganaFpos[0]);
  const [phone, setPhone] = useState('9876543210');
  const [showOtp, setShowOtp] = useState(false);
  const [otpDigits, setOtpDigits] = useState(['', '', '', '', '', '']);
  const [countdown, setCountdown] = useState(60);
  const [canResend, setCanResend] = useState(false);
  const [error, setError] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [devOtp, setDevOtp] = useState(null);

  const inputRefs = useRef([]);

  useEffect(() => {
    let timer;
    if (showOtp && countdown > 0) {
      timer = setInterval(() => {
        setCountdown((prev) => prev - 1);
      }, 1000);
    } else if (countdown === 0) {
      setCanResend(true);
    }
    return () => clearInterval(timer);
  }, [showOtp, countdown]);

  const handleSendOtpSubmit = async (e) => {
    e.preventDefault();
    if (phone.length < 10) {
      setError(t('errValidPhone'));
      return;
    }
    setError('');
    setIsSendingOtp(true);
    setDevOtp(null);

    try {
      // FPO officers may not be in the farmer DB; use the generic send-otp endpoint.
      const res = await sendOtp(phone);

      if (!res.success) {
        setError(res.message || t('regErrSendOtp'));
        return;
      }

      if (res.dev_otp) {
        setDevOtp(res.dev_otp);
        // auto-fill the 6 boxes
        setOtpDigits(res.dev_otp.split(''));
      } else {
        setOtpDigits(['', '', '', '', '', '']);
      }

      setShowOtp(true);
      setCountdown(60);
      setCanResend(false);
    } catch {
      setError(t('errOtpService'));
    } finally {
      setIsSendingOtp(false);
    }
  };

  const handleResendOtp = async () => {
    if (!canResend) return;
    setError('');
    setIsSendingOtp(true);
    setDevOtp(null);

    try {
      const res = await sendOtp(phone);

      if (!res.success) {
        setError(res.message || t('fpoLoginErrResend'));
        return;
      }

      if (res.dev_otp) {
        setDevOtp(res.dev_otp);
        setOtpDigits(res.dev_otp.split(''));
      } else {
        setOtpDigits(['', '', '', '', '', '']);
      }

      setCountdown(60);
      setCanResend(false);
    } catch {
      setError(t('errResendOtp'));
    } finally {
      setIsSendingOtp(false);
    }
  };

  const handleDigitChange = (index, value) => {
    if (!/^\d*$/.test(value)) return;
    const newDigits = [...otpDigits];
    newDigits[index] = value.slice(-1);
    setOtpDigits(newDigits);
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otpDigits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleVerifyOtpSubmit = async (e) => {
    e.preventDefault();
    const fullOtp = otpDigits.join('');
    if (fullOtp.length !== 6) {
      setError(t('errOtpIncomplete'));
      return;
    }

    setIsVerifying(true);
    setError('');
    try {
      const fpoRes = await loginFpo(phone, selectedFpo, fullOtp);
      if (!fpoRes.success) {
        setError(fpoRes.message || t('fpoLoginErrInvalid'));
        return;
      }
      await login(fpoRes.token, fpoRes.user);
      navigate('/fpo/dashboard');
    } catch {
      setError(t('fpoLoginErrAuth'));
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAF8] font-inter text-slate-900 py-10 px-4 flex items-center justify-center">
      <div className="max-w-md w-full space-y-6">

        {/* FPO Auth Card */}
        <div className="bg-white border border-slate-200 shadow-sm rounded-2xl p-6 space-y-5">
          <div className="text-center space-y-1">
            <div className="w-12 h-12 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center justify-center text-emerald-800 mx-auto mb-2 shadow-xs">
              <Building2 className="w-6 h-6" />
            </div>
            <div className="flex items-center justify-center gap-1.5">
              <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full">
                {t('fpoLoginBadge')}
              </span>
              <span className="text-[10px] font-semibold text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded">
                {t('fpoLoginCoop')}
              </span>
            </div>
            <h1 className="text-2xl font-extrabold text-slate-900 font-manrope">{t('fpoLoginTitle')}</h1>
            <p className="text-xs text-slate-500">{t('fpoLoginDesc')}</p>
          </div>

          {error && (
            <p className="text-xs font-bold text-rose-700 bg-rose-50 border border-rose-200 p-2.5 rounded-xl text-center">
              {error}
            </p>
          )}

          {!showOtp ? (
            <form onSubmit={handleSendOtpSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">{t('fpoLoginFpoLabel')}</label>
                <select
                  value={selectedFpo}
                  onChange={(e) => setSelectedFpo(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-[#F8FAF8] border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:border-emerald-600 cursor-pointer"
                >
                  {telanganaFpos.map((fpo, idx) => (
                    <option key={idx} value={fpo}>{fpo}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">{t('fpoLoginPhoneLabel')}</label>
                <div className="flex bg-[#F8FAF8] border border-slate-200 rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-emerald-600/30">
                  <span className="bg-emerald-50 text-emerald-800 px-3 py-2.5 text-xs font-bold border-r border-slate-200 flex items-center">
                    +91
                  </span>
                  <input
                    type="text"
                    required
                    maxLength={10}
                    placeholder="9876543210"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full px-3 py-2.5 bg-transparent text-xs font-bold text-slate-900 focus:outline-none"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isSendingOtp}
                className="w-full py-3 bg-[#1B4332] hover:bg-[#2D6A4F] text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <span>{isSendingOtp ? t('sendingOtpBtn') : t('fpoLoginSendOtp')}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          ) : (
            <form onSubmit={handleVerifyOtpSubmit} className="space-y-4">
              {devOtp && (
                <div className="bg-amber-50 border border-amber-300 rounded-lg px-3 py-2 text-xs text-amber-800 font-mono font-bold text-center">
                  🔧 {t('devModeLabel')} <span className="text-lg tracking-widest">{devOtp}</span>
                </div>
              )}
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1.5 text-center">
                  {t('fpoLoginOtpTitle')}
                </label>
                <div className="flex justify-between gap-1.5 max-w-xs mx-auto">
                  {otpDigits.map((digit, idx) => (
                    <input
                      key={idx}
                      ref={(el) => (inputRefs.current[idx] = el)}
                      type="text"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleDigitChange(idx, e.target.value)}
                      onKeyDown={(e) => handleKeyDown(idx, e)}
                      className="w-10 h-12 text-center text-lg font-mono font-bold bg-[#F8FAF8] border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-600/40"
                    />
                  ))}
                </div>
              </div>

              <div className="flex justify-between items-center bg-[#F8FAF8] border border-slate-200 rounded-xl p-2.5 text-xs text-slate-600">
                <span>
                  {canResend ? (
                    <span className="text-slate-800 font-semibold">{t('noCode')}</span>
                  ) : (
                    <span>
                      {t('resendInX')} <strong className="font-mono text-emerald-800 font-bold">{countdown}s</strong>
                    </span>
                  )}
                </span>
                <button
                  type="button"
                  onClick={handleResendOtp}
                  disabled={!canResend}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${
                    canResend
                      ? 'bg-[#1B4332] text-white hover:bg-[#2D6A4F] shadow-xs'
                      : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                  }`}
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>{t('resendOtpBtn')}</span>
                </button>
              </div>

              <button
                type="submit"
                disabled={isVerifying}
                className="w-full py-3 bg-[#1B4332] hover:bg-[#2D6A4F] text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <span>{isVerifying ? t('fpoLoginVerifying') : t('fpoLoginVerifyBtn')}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          )}

          <div className="text-center pt-2 border-t border-slate-100">
            <p className="text-xs text-slate-500">
              {t('fpoLoginSelected')} <strong className="text-slate-800 truncate block">{selectedFpo}</strong>
            </p>
          </div>
        </div>

      </div>
    </div>
  );
}
