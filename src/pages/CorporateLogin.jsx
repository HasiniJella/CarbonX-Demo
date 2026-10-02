import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, ArrowRight, ShieldCheck, RefreshCw, KeyRound, Lock, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { PY } from '../services/api';

export default function CorporateLogin() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const { t } = useLanguage();

  const [name, setName] = useState('Telangana Sustainable Agro Pvt Ltd');
  const [password, setPassword] = useState('Corporate@2026');
  const [useOtpToggle, setUseOtpToggle] = useState(false);
  
  // OTP step state if toggle enabled
  const [showOtp, setShowOtp] = useState(false);
  const [otpDigits, setOtpDigits] = useState(['1', '2', '3', '4', '5', '6']);
  const [countdown, setCountdown] = useState(60);
  const [canResend, setCanResend] = useState(false);
  
  const [error, setError] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);

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

  const handleResendOtp = () => {
    if (!canResend) return;
    setCountdown(60);
    setCanResend(false);
    setOtpDigits(['1', '2', '3', '4', '5', '6']);
    setError('');
  };

  const handleCorporateLogin = async (e) => {
    if (e) e.preventDefault();
    if (!name || !password) {
      setError(t('clogErrMissing'));
      return;
    }
    setError('');

    if (useOtpToggle && !showOtp) {
      setShowOtp(true);
      setCountdown(60);
      setCanResend(false);
      return;
    }

    setIsVerifying(true);

    try {
      // Attempt backend authentication (PY base: VITE_PY_API in production)
      const response = await fetch(`${PY}/corporate/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, password })
      });
      if (response.ok) {
        const data = await response.json();
        await login(data.token, {
          c_id: data.c_id || 101,
          name: data.name || name,
          role: 'buyer'
        });
        setIsVerifying(false);
        navigate('/corporate/dashboard');
        return;
      }
    } catch (err) {
      console.warn('Backend corporate login API offline, using fallback auth', err);
    }

    setError(t('clogErrService'));
    setIsVerifying(false);
  };

  return (
    <div className="min-h-screen bg-[#F8FAF8] font-inter text-slate-900 py-10 px-4 flex items-center justify-center">
      <div className="max-w-md w-full space-y-6">

        {/* Corporate Auth Card */}
        <div className="bg-white border border-slate-200 shadow-sm rounded-2xl p-6 space-y-5">
          <div className="text-center space-y-1">
            <div className="w-12 h-12 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center justify-center text-emerald-800 mx-auto mb-2 shadow-xs">
              <Building2 className="w-6 h-6" />
            </div>
            <div className="flex items-center justify-center gap-1.5">
              <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full">
                {t('clogBadge')}
              </span>
              <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                {t('clogEsg')}
              </span>
            </div>
            <h1 className="text-2xl font-extrabold text-slate-900 font-manrope">{t('clogTitle')}</h1>
            <p className="text-xs text-slate-500">{t('clogDesc')}</p>
          </div>

          {error && (
            <p className="text-xs font-bold text-rose-700 bg-rose-50 border border-rose-200 p-2.5 rounded-xl text-center">
              {error}
            </p>
          )}

          {!showOtp ? (
            <form onSubmit={handleCorporateLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">{t('clogNameLabel')}</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Telangana Sustainable Agro Pvt Ltd"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-[#F8FAF8] border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:border-emerald-600"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">{t('clogPassLabel')}</label>
                <input
                  type="password"
                  required
                  placeholder="••••••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-[#F8FAF8] border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:border-emerald-600"
                />
              </div>

              {/* 2FA Secondary OTP Toggle Option */}
              <div className="flex items-center justify-between bg-[#F8FAF8] border border-slate-200 rounded-xl p-3 text-xs">
                <div className="flex items-center gap-2">
                  <KeyRound className="w-4 h-4 text-emerald-700" />
                  <span className="font-semibold text-slate-700">{t('clog2fa')}</span>
                </div>
                <input
                  type="checkbox"
                  checked={useOtpToggle}
                  onChange={(e) => setUseOtpToggle(e.target.checked)}
                  className="accent-emerald-700 w-4 h-4 cursor-pointer"
                />
              </div>

              <button
                type="submit"
                disabled={isVerifying}
                className="w-full py-3 bg-[#1B4332] hover:bg-[#2D6A4F] text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-2"
              >
                <span>{useOtpToggle ? t('clogProceed2fa') : t('clogSignIn')}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          ) : (
            <form onSubmit={handleCorporateLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1.5 text-center">
                  {t('clogOtpTitle')}
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
                <span>{isVerifying ? t('clogVerifying') : t('clogVerifyBtn')}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          )}

          <div className="text-center pt-2 border-t border-slate-100">
            <p className="text-xs text-slate-500">
              {t('clogNeedAccess')}{' '}
              <button
                type="button"
                onClick={() => navigate('/corporate/welcome')}
                className="text-emerald-800 font-bold hover:underline"
              >
                {t('clogViewOverview')}
              </button>
            </p>
          </div>
        </div>

      </div>
    </div>
  );
}
