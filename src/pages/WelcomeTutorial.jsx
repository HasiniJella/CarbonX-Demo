import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Compass, Leaf, Wallet, ArrowRight, ArrowLeft } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

export default function WelcomeTutorial() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [slideIndex, setSlideIndex] = useState(0);

  const steps = [
    {
      step: 1,
      title: t('tutStep1Title'),
      desc: t('tutStep1Desc'),
      icon: Compass,
      bgColor: 'bg-emerald-50 text-emerald-800 border-emerald-200'
    },
    {
      step: 2,
      title: t('tutStep2Title'),
      desc: t('tutStep2Desc'),
      icon: Leaf,
      bgColor: 'bg-sky-50 text-sky-800 border-sky-200'
    },
    {
      step: 3,
      title: t('tutStep3Title'),
      desc: t('tutStep3Desc'),
      icon: Wallet,
      bgColor: 'bg-amber-50 text-amber-800 border-amber-200'
    }
  ];

  const currentStep = steps[slideIndex];
  const Icon = currentStep.icon;

  const handleNext = () => {
    if (slideIndex < steps.length - 1) {
      setSlideIndex(slideIndex + 1);
    } else {
      navigate('/farmer/dashboard');
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAF8] font-inter text-slate-900 py-10 px-4 flex flex-col items-center justify-center">
      <div className="max-w-md w-full space-y-6">

        {/* Top Progress & Skip */}
        <div className="flex justify-between items-center">
          <button
            onClick={() => slideIndex > 0 ? setSlideIndex(slideIndex - 1) : navigate('/farmer/dashboard')}
            className="p-2 hover:bg-slate-200 rounded-lg text-slate-700"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>

          {/* Progress Dot Indicators */}
          <div className="flex gap-2">
            {steps.map((_, idx) => (
              <div
                key={idx}
                className={`h-2 rounded-full transition-all ${
                  idx === slideIndex ? 'w-6 bg-[#1B4332]' : 'w-2 bg-slate-300'
                }`}
              />
            ))}
          </div>

          <button
            onClick={() => navigate('/farmer/dashboard')}
            className="text-xs font-bold text-slate-500 hover:text-slate-900"
          >
            {t('tutSkip')}
          </button>
        </div>

        {/* Walkthrough Slide Card */}
        <div className="bg-white border border-slate-200 shadow-sm rounded-xl p-8 text-center space-y-5">
          <div className={`w-16 h-16 rounded-xl flex items-center justify-center mx-auto border ${currentStep.bgColor}`}>
            <Icon className="w-8 h-8" />
          </div>

          <div className="space-y-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              {t('tutStepWord')} {currentStep.step} {t('tutOfWord')} 3
            </span>
            <h2 className="text-xl font-extrabold text-slate-900 font-manrope">{currentStep.title}</h2>
            <p className="text-xs text-slate-600 leading-relaxed">{currentStep.desc}</p>
          </div>
        </div>

        {/* Next Button */}
        <button
          onClick={handleNext}
          className="w-full py-3 bg-[#1B4332] hover:bg-[#2D6A4F] text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-2"
        >
          <span>{slideIndex < steps.length - 1 ? t('tutNextStep') : t('tutProceedFarm')}</span>
          <ArrowRight className="w-4 h-4" />
        </button>

      </div>
    </div>
  );
}
