import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Phone, ArrowRight, ShieldCheck, RefreshCw, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { sendLoginOtp, loginUser } from '../services/api';
import DemoNumberBanner, { DEMO_FARMER_PHONE } from '../components/DemoNumberBanner';

export default function FarmerLogin() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const { t } = useLanguage();

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
      const res = await sendLoginOtp(phone);
      if (!res.success) {
        setError(res.message || 'Failed to send OTP. Please try again.');
        return;
      }

      if (res.dev_otp) {
        setDevOtp(res.dev_otp);
        setOtpDigits(res.dev_otp.split(''));
      } else {
        setOtpDigits(['', '', '', '', '', '']);
      }

      setShowOtp(true);
      setCountdown(60);
      setCanResend(false);
    } catch (err) {
      setError(t('errOtpService'));
    } finally {
      setIsSendingOtp(false);
    }
  };

  const handleDigitChange = (index, value) => {
    if (!/^\d*$/.test(value)) return;

    const newDigits = [...otpDigits];
    newDigits[index] = value.slice(-1);
    setOtpDigits(newDigits);

    // Auto advance to next input
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otpDigits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleResendOtp = async () => {
    if (!canResend) return;

    setError('');
    setIsSendingOtp(true);
    setDevOtp(null);

    try {
      const res = await sendLoginOtp(phone);
      if (!res.success) {
        setError(res.message || 'Failed to resend OTP. Please try again.');
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
    } catch (err) {
      setError(t('errResendOtp'));
    } finally {
      setIsSendingOtp(false);
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
      const res = await loginUser(phone, fullOtp);
      if (!res.success) {
        setError(res.message || 'Invalid OTP. Please try again.');
        return;
      }

      login(res.token, res.user);
      navigate('/farmer/dashboard');
    } catch (err) {
      setError(t('errVerifyOtp'));
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface font-inter text-agriText-main py-10 px-4 flex items-center justify-center">
      <div className="max-w-md w-full space-y-6">

        {/* Auth Card */}
        <div className="bg-white border border-forest-100 shadow-card rounded-2xl p-6 space-y-5">
          <div className="text-center space-y-1">
            <div className="w-12 h-12 bg-surface-sage border border-forest-200 rounded-2xl flex items-center justify-center text-primary mx-auto mb-2 shadow-xs">
              <Phone className="w-6 h-6" />
            </div>
            <div className="flex items-center justify-center gap-1.5">
              <span className="text-[10px] font-bold text-primary uppercase tracking-wider bg-surface-sage border border-forest-200 px-2.5 py-0.5 rounded-full">
                Phone OTP Verification
              </span>
            </div>
            <h1 className="text-2xl font-extrabold text-carbon-900 font-manrope">{t('loginTitle')}</h1>
            <p className="text-xs text-agriText-muted">{t('loginPhoneDesc')}</p>
          </div>

          {/* Demo number for judges / SIH evaluators (Twilio trial can't SMS unverified numbers) */}
          <DemoNumberBanner onAutofill={(phone) => setPhone(phone || DEMO_FARMER_PHONE)} />

          {error && (
            <p className="text-xs font-bold text-red-700 bg-red-50 border border-red-200 p-2.5 rounded-xl text-center">
              {error}
            </p>
          )}

          {!showOtp ? (
            <form onSubmit={handleSendOtpSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-carbon-800 mb-1">{t('mobileLabel')}</label>
                <div className="flex bg-surface-sage/40 border border-forest-200 rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-primary/30">
                  <span className="bg-surface-sage text-carbon-800 px-3 py-2.5 text-xs font-bold border-r border-forest-200 flex items-center">
                    +91
                  </span>
                  <input
                    type="text"
                    required
                    maxLength={10}
                    placeholder="9876543210"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full px-3 py-2.5 bg-transparent text-xs font-bold text-carbon-900 focus:outline-none"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isSendingOtp}
                className="w-full py-3 bg-primary hover:bg-primary-hover text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <span>{isSendingOtp ? t('sendingOtpBtn') : t('sendOtpBtn')}</span>
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
                <label className="block text-xs font-bold text-carbon-800 mb-1.5 text-center">
                  {t('otpCodeTitle')}
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
                      className="w-10 h-12 text-center text-lg font-mono font-bold bg-surface-sage/50 border border-forest-200 rounded-xl text-carbon-900 focus:outline-none focus:ring-2 focus:ring-primary/40"
                    />
                  ))}
                </div>
              </div>

              {/* 60s Countdown & Resend Button */}
              <div className="flex justify-between items-center bg-surface-sage/50 border border-forest-200 rounded-xl p-2.5 text-xs text-agriText-muted">
                <span>
                  {canResend ? (
                    <span className="text-carbon-800 font-semibold">{t('noCode')}</span>
                  ) : (
                    <span>
                      {t('resendInX')} <strong className="font-mono text-primary font-bold">{countdown}s</strong>
                    </span>
                  )}
                </span>
                <button
                  type="button"
                  onClick={handleResendOtp}
                  disabled={!canResend || isSendingOtp}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${
                    canResend
                      ? 'bg-primary text-white hover:bg-primary-hover shadow-xs'
                      : 'bg-warm-cream text-agriText-subtle cursor-not-allowed'
                  }`}
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>{t('resendOtpBtn')}</span>
                </button>
              </div>

              <button
                type="submit"
                disabled={isVerifying}
                className="w-full py-3 bg-primary hover:bg-primary-hover text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <span>{isVerifying ? t('verifyingBtn') : t('verifyContinueBtn')}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          )}

          <div className="text-center pt-2 border-t border-forest-100">
            <p className="text-xs text-agriText-muted">
              {t('noFarmYet')}{' '}
              <button
                type="button"
                onClick={() => navigate('/farmer/land-verification')}
                className="text-primary font-bold hover:underline"
              >
                {t('startVerificationLink')}
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
