import React from 'react';
import { Smartphone } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

// Pre-seeded demo farmers (scripts/seed_tier_demo.py) so judges can view
// every verification tier without waiting for SMS.
export const DEMO_NUMBERS = [
  { phone: '9000000011', name: 'Ramesh Kumar', tierKey: 'tier1Label' },
  { phone: '9000000012', name: 'Lakshmi Narayana', tierKey: 'tier2Label' },
  { phone: '9000000013', name: 'Mallaiah Yadav', tierKey: 'tier3Label' },
];

// Backwards-compatible default (Tier 1).
export const DEMO_FARMER_PHONE = DEMO_NUMBERS[0].phone;
export const DEMO_FARMER_NAME = DEMO_NUMBERS[0].name;

export default function DemoNumberBanner({ onAutofill }) {
  const { t } = useLanguage();
  const fill = (phone) => {
    if (!onAutofill) return;
    // Supports both setPhone-style setters and no-arg callbacks.
    if (onAutofill.length === 0) onAutofill();
    else onAutofill(phone);
  };

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 space-y-2">
      <div className="flex items-center gap-2">
        <Smartphone className="w-5 h-5 text-amber-600 shrink-0" />
        <p className="text-xs font-bold text-amber-900">
          {t('demoBannerTitle')}
        </p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        {DEMO_NUMBERS.map((d) => (
          <button
            key={d.phone}
            type="button"
            onClick={() => fill(d.phone)}
            className="flex items-center justify-between gap-2 px-3 py-2 bg-white hover:bg-amber-100 border border-amber-200 rounded-lg transition-colors text-left"
          >
            <span>
              <span className="block font-mono font-bold tracking-widest text-xs text-amber-900">{d.phone}</span>
              <span className="block text-[10px] text-amber-700">{d.name} — {t(d.tierKey)}</span>
            </span>
            <span className="shrink-0 px-2 py-1 bg-amber-600 text-white text-[10px] font-bold rounded-md">{t('demoUse')}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
