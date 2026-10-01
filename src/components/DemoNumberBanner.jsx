import React from 'react';
import { Smartphone } from 'lucide-react';

// Pre-seeded demo farmer (scripts/seed_tier_demo.py): Tier-1 registry-hit
// account, so judges can log in and verify land without waiting for SMS.
export const DEMO_FARMER_PHONE = '9000000011';
export const DEMO_FARMER_NAME = 'Ramesh Kumar';

export default function DemoNumberBanner({ onAutofill }) {
  return (
    <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-center justify-between gap-3">
      <div className="flex items-center gap-2.5 min-w-0">
        <Smartphone className="w-5 h-5 text-amber-600 shrink-0" />
        <p className="text-xs text-amber-900">
          <span className="font-bold">SIH demo?</span> Use{' '}
          <span className="font-mono font-bold tracking-widest">{DEMO_FARMER_PHONE}</span>
          <span className="hidden sm:inline text-amber-700"> — pre-verified Tier-1 farm, no SMS wait</span>
        </p>
      </div>
      {onAutofill && (
        <button
          type="button"
          onClick={onAutofill}
          className="shrink-0 px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold rounded-lg transition-colors"
        >
          Autofill
        </button>
      )}
    </div>
  );
}
