import React, { useState, useEffect, lazy, Suspense } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { MapPin, ShieldCheck, Wallet, ArrowRight, Compass, AlertTriangle, Upload, Loader2, CheckCircle2 } from 'lucide-react';
import VerificationBadge from '../components/VerificationBadge';
const LeafletMap = lazy(() => import('../components/LeafletMap'));
import { useAuth } from '../context/AuthContext';
import { getMe, verifyLandDocument, analyzeFarm, saveFarm } from '../services/api';

const CREDIT_RATE = 340;

export default function FarmerDashboard() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const navState = location.state || {};

  const [loading, setLoading] = useState(true);
  const [farms, setFarms] = useState([]);
  const [kyc, setKyc] = useState(null);
  const [selectedFarmIndex, setSelectedFarmIndex] = useState(0);
  const [loadError, setLoadError] = useState('');

  // Tier 2 verification panel state (shown when the farmer has no farms yet)
  const [surveyNumber, setSurveyNumber] = useState('');
  const [pahaniFile, setPahaniFile] = useState(null);
  const [pahaniBase64, setPahaniBase64] = useState('');
  const [drawnGeojson, setDrawnGeojson] = useState(null);
  const [drawnAreaHa, setDrawnAreaHa] = useState(0);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verifyResult, setVerifyResult] = useState(null);
  const [verifyError, setVerifyError] = useState('');
  const [scores, setScores] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  async function refresh() {
    setLoading(true);
    setLoadError('');
    try {
      const res = await getMe();
      if (res.success) {
        setFarms(res.farms || []);
        setKyc(res.kyc || null);
      } else {
        setLoadError(res.message || 'Could not load farm data.');
      }
    } catch {
      setLoadError('Could not reach the backend. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { refresh(); }, []);

  const handlePahaniFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPahaniFile(file);
    const reader = new FileReader();
    reader.onload = () => setPahaniBase64(String(reader.result || ''));
    reader.readAsDataURL(file);
  };

  const handleVerifyTier2 = async () => {
    setVerifyError('');
    setVerifyResult(null);
    setScores(null);
    if (!surveyNumber.trim()) {
      setVerifyError('Enter your survey number first.');
      return;
    }
    if (!pahaniBase64) {
      setVerifyError('Upload your Pahani document first.');
      return;
    }
    if (!drawnGeojson) {
      setVerifyError('Draw your farm boundary on the map first.');
      return;
    }
    setIsVerifying(true);
    try {
      const res = await verifyLandDocument({
        survey_number: surveyNumber.trim(),
        village: user?.village || '',
        district: user?.district || '',
        area_hectares: drawnAreaHa || undefined,
        geojson: drawnGeojson,
        confirm_polygon: true,
        document_name: pahaniFile?.name || 'pahani.jpg',
        document_content_base64: pahaniBase64,
        document_content_type: pahaniFile?.type || 'image/jpeg',
      });
      if (!res.success) {
        setVerifyError(res.message || 'Verification failed.');
        return;
      }
      setVerifyResult(res);
      // Scores become visible once the document verifies.
      if (res.status === 'VERIFIED') {
        try {
          const analysis = await analyzeFarm(
            res.polygon_geojson || drawnGeojson,
            `Survey ${surveyNumber.trim()}`,
            res.extracted?.crop || 'Mixed Crop',
            res.extracted?.irrigation || 'Rainfed'
          );
          if (analysis.success) setScores(analysis);
        } catch {
          /* scores optional — verification already succeeded */
        }
      }
    } catch {
      setVerifyError('Could not reach the verification service.');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleSaveFarm = async () => {
    if (!verifyResult || verifyResult.status !== 'VERIFIED') return;
    setIsSaving(true);
    try {
      const geo = verifyResult.polygon_geojson || drawnGeojson;
      const res = await saveFarm({
        farm: {
          name: `Survey ${surveyNumber.trim()} — Document Farm`,
          crop_type: verifyResult.extracted?.crop || 'Mixed Crop',
          irrigation: verifyResult.extracted?.irrigation || 'Rainfed',
          geojson: geo,
          area_hectares: drawnAreaHa,
          ndvi: scores?.ndvi,
          carbon_tonnes: scores?.carbon_tonnes,
          biodiversity_score: scores?.biodiversity_score,
          biodiversity_credits: scores?.biodiversity_credits,
          total_credits: scores?.total_credits,
          status: 'VERIFIED',
          badge: verifyResult.badge || 'DOCUMENT',
        },
      });
      if (res.success) {
        await refresh();
      } else {
        setVerifyError(res.message || 'Could not save farm.');
      }
    } catch {
      setVerifyError('Could not save farm.');
    } finally {
      setIsSaving(false);
    }
  };

  const farmerName = user?.name || 'Farmer';
  const village = user?.village || '';
  const district = user?.district || '';

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F8FAF8] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-emerald-700 animate-spin" />
      </div>
    );
  }

  const currentFarm = farms[selectedFarmIndex] || null;
  const badge = currentFarm?.badge || null;
  const status = String(currentFarm?.status || '').toUpperCase();
  const isPending = status === 'PENDING' || status === 'FLAGGED' || badge === 'PENDING';
  const credits = parseFloat(currentFarm?.total_credits || 0) || 0;
  const earnings = Math.round(credits * CREDIT_RATE);

  return (
    <div className="min-h-screen bg-[#F8FAF8] font-inter text-slate-900 py-8 px-4 md:px-10">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* Top Profile Bar */}
        <div className="bg-white border border-slate-200 shadow-sm rounded-2xl p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              {badge && <VerificationBadge badge={badge} showTier size="sm" />}
              {kyc && (
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider bg-slate-100 border border-slate-200 px-2 py-0.5 rounded">
                  KYC: {kyc.status}
                </span>
              )}
            </div>
            <h1 className="text-2xl font-extrabold text-[#0F172A] font-manrope tracking-tight">{farmerName}</h1>
            <p className="text-xs text-slate-500 mt-1 flex items-center gap-1.5 font-medium">
              <MapPin className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
              <span>
                {village}{village && district ? ', ' : ''}{district}
                {currentFarm ? ` | ${currentFarm.name}` : ' | No verified farm yet'}
              </span>
            </p>
          </div>

          {farms.length > 1 && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold text-slate-500 mr-1">Switch Farm:</span>
              {farms.map((f, idx) => (
                <button
                  key={f.id}
                  onClick={() => setSelectedFarmIndex(idx)}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all border ${
                    selectedFarmIndex === idx
                      ? 'bg-[#1B4332] text-white border-[#1B4332] shadow-xs'
                      : 'bg-[#F8FAF8] text-slate-700 border-slate-200 hover:bg-emerald-50'
                  }`}
                >
                  {f.name} ({f.badge || f.status})
                </button>
              ))}
            </div>
          )}
        </div>

        {loadError && (
          <p className="text-xs font-bold text-rose-700 bg-rose-50 border border-rose-200 p-2.5 rounded-xl text-center">
            {loadError}
          </p>
        )}

        {/* ── No farms yet: Tier 2 draw-and-verify panel ── */}
        {!currentFarm && (
          <div className="bg-white border border-slate-200 shadow-sm rounded-2xl p-6 space-y-5">
            <div>
              <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full">
                Tier 2 — Document + Boundary Verification
              </span>
              <h2 className="text-xl font-extrabold font-manrope mt-2">Verify your land to unlock credits</h2>
              <p className="text-xs text-slate-500 mt-1">
                Your survey number was not found in the registry. Upload your Pahani, draw your boundary on the map,
                and the Trust Engine cross-checks the drawn area (±20% tolerance).
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Survey Number</label>
                  <input
                    type="text"
                    value={surveyNumber}
                    onChange={(e) => setSurveyNumber(e.target.value)}
                    placeholder="e.g. 999/Z"
                    className="w-full px-3 py-2.5 bg-[#F8FAF8] border border-slate-200 rounded-lg text-xs font-mono text-slate-900 focus:outline-none focus:border-emerald-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Pahani Document (JPG/PNG/PDF)</label>
                  <div className="border-2 border-dashed border-slate-300 rounded-xl p-5 text-center hover:border-emerald-600 bg-[#F8FAF8] transition-colors">
                    <input type="file" accept="image/*,.pdf" onChange={handlePahaniFile} id="dash-pahani" className="hidden" />
                    <label htmlFor="dash-pahani" className="cursor-pointer space-y-1 block">
                      <Upload className="w-7 h-7 text-emerald-700 mx-auto" />
                      <p className="text-xs font-bold text-slate-900">{pahaniFile ? pahaniFile.name : 'Upload Pahani / RoR 1B'}</p>
                    </label>
                  </div>
                </div>
                <div className="bg-[#F8FAF8] border border-slate-200 rounded-xl p-3 text-xs flex justify-between">
                  <span className="font-semibold text-slate-500">Drawn area</span>
                  <span className="font-mono font-bold text-emerald-800">{drawnAreaHa} ha</span>
                </div>
                {verifyError && (
                  <p className="text-xs font-bold text-rose-700 bg-rose-50 border border-rose-200 p-2.5 rounded-xl">{verifyError}</p>
                )}
                <button
                  onClick={handleVerifyTier2}
                  disabled={isVerifying}
                  className="w-full py-3 bg-[#1B4332] hover:bg-[#2D6A4F] text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isVerifying ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                  <span>{isVerifying ? 'Verifying...' : 'Verify Boundary & Document'}</span>
                </button>
              </div>

              <div className="h-[420px] rounded-2xl overflow-hidden border border-slate-200">
                <Suspense fallback={<div className="h-full flex items-center justify-center text-xs text-slate-500">Loading map…</div>}>
                <LeafletMap
                  onGeojsonDrawn={setDrawnGeojson}
                  onAreaCalculated={(r) => r && setDrawnGeojson && setDrawnAreaHa(r.area)}
                  showHeatmapToggle={false}
                  height="100%"
                />
                </Suspense>
              </div>
            </div>

            {/* Verification outcome + scores */}
            {verifyResult && (
              <div className={`border rounded-2xl p-5 space-y-3 ${verifyResult.status === 'VERIFIED' ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'}`}>
                <div className="flex items-center gap-2 flex-wrap">
                  {verifyResult.status === 'VERIFIED'
                    ? <CheckCircle2 className="w-5 h-5 text-emerald-700" />
                    : <AlertTriangle className="w-5 h-5 text-amber-700" />}
                  <span className="text-sm font-extrabold">
                    {verifyResult.status === 'VERIFIED'
                      ? `Verified — ${verifyResult.badge} badge (Tier ${verifyResult.tier})`
                      : `${verifyResult.status} — routed to FPO for manual review (Tier 3)`}
                  </span>
                  {verifyResult.badge && <VerificationBadge badge={verifyResult.badge} showTier size="sm" />}
                </div>
                {(verifyResult.reasons || []).length > 0 && (
                  <p className="text-xs text-slate-600">Checks: {(verifyResult.reasons || []).join(', ')}</p>
                )}
                {verifyResult.status === 'VERIFIED' && scores?.success && (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                    <div className="bg-white rounded-xl border border-emerald-200 p-3">
                      <p className="font-bold text-slate-500 uppercase text-[10px]">NDVI</p>
                      <p className="text-lg font-extrabold text-emerald-900">{scores.ndvi}</p>
                    </div>
                    <div className="bg-white rounded-xl border border-emerald-200 p-3">
                      <p className="font-bold text-slate-500 uppercase text-[10px]">Carbon</p>
                      <p className="text-lg font-extrabold text-emerald-900">{scores.carbon_tonnes} t</p>
                    </div>
                    <div className="bg-white rounded-xl border border-emerald-200 p-3">
                      <p className="font-bold text-slate-500 uppercase text-[10px]">Biodiversity</p>
                      <p className="text-lg font-extrabold text-emerald-900">{scores.biodiversity_score}</p>
                    </div>
                    <div className="bg-white rounded-xl border border-emerald-200 p-3">
                      <p className="font-bold text-slate-500 uppercase text-[10px]">Total credits</p>
                      <p className="text-lg font-extrabold text-emerald-900">{scores.total_credits}</p>
                    </div>
                  </div>
                )}
                {verifyResult.status === 'VERIFIED' && (
                  <button
                    onClick={handleSaveFarm}
                    disabled={isSaving}
                    className="px-5 py-2.5 bg-[#1B4332] hover:bg-[#2D6A4F] text-white text-xs font-bold rounded-xl flex items-center gap-2 disabled:opacity-50"
                  >
                    <span>{isSaving ? 'Saving...' : 'Save Farm to Dashboard'}</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── Pending / flagged farm: Tier 3 routing ── */}
        {currentFarm && isPending && (
          <div className="bg-amber-50 border border-amber-200 text-amber-950 rounded-2xl p-6 shadow-xs space-y-3">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-6 h-6 text-amber-700 shrink-0 mt-1" />
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-amber-900 uppercase tracking-wider bg-amber-200 px-2.5 py-0.5 rounded-full">
                  {status} — FPO Review (Tier 3)
                </span>
                <h2 className="text-xl font-extrabold font-manrope">Complete verification to earn carbon credits</h2>
                <p className="text-xs text-amber-800 max-w-2xl leading-relaxed">
                  Parcel <code className="font-mono font-bold">{currentFarm.name}</code> is awaiting FPO attestation.
                  Credit minting and earnings stay locked until your FPO officer confirms it.
                </p>
                {(kyc?.reasons || []).length > 0 && isPending && (
                  <p className="text-xs text-amber-800">Flagged checks: {(kyc.reasons || []).join(', ')}</p>
                )}
              </div>
            </div>
            <div className="pt-2 flex flex-wrap gap-3">
              <button
                onClick={() => navigate('/farmer/land-verification')}
                className="px-5 py-2.5 bg-[#1B4332] hover:bg-[#2D6A4F] text-white font-bold text-xs rounded-xl transition-all shadow-xs flex items-center gap-2"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>Re-run Verification Flow</span>
              </button>
            </div>
          </div>
        )}

        {/* ── Verified farm: revenue + scores ── */}
        {currentFarm && !isPending && (
          <div className="bg-[#F0FDF4] border border-[#BBF7D0] text-slate-900 rounded-2xl p-6 shadow-sm relative overflow-hidden">
            <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
              <div>
                <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider bg-white border border-emerald-200 px-2.5 py-0.5 rounded-full">
                  ESTIMATED ANNUAL CARBON REVENUE
                </span>
                <h2 className="text-3xl md:text-4xl font-extrabold font-manrope text-[#1B4332] mt-2">
                  ₹{earnings.toLocaleString('en-IN')} <span className="text-sm font-normal text-slate-600">/ year</span>
                </h2>
                <p className="text-xs text-slate-600 mt-1 max-w-xl font-medium">
                  {currentFarm.area_hectares} ha {currentFarm.crop_type} = {credits} credits/year, benchmarked under verified {badge} badge status.
                </p>
              </div>
              <button
                onClick={() => navigate('/farmer/wallet')}
                className="px-6 py-3 bg-[#1B4332] hover:bg-[#2D6A4F] text-white font-bold text-xs rounded-xl transition-all shadow-sm flex items-center gap-2 shrink-0"
              >
                <Wallet className="w-4 h-4 text-emerald-300" />
                <span>Open Wallet & UPI Ledger</span>
              </button>
            </div>
          </div>
        )}

        {/* 3-Column Core Metric Row */}
        {currentFarm && !isPending && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white border border-slate-200 border-l-4 border-l-emerald-600 shadow-sm rounded-2xl p-6 space-y-1">
              <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">NDVI Vegetation Index</p>
              <p className="text-3xl font-extrabold text-[#1B4332] font-manrope">{currentFarm.ndvi ?? '—'} Index</p>
              <p className="text-xs text-slate-500 font-medium pt-1">Sentinel-2 Multi-Spectral Active Vegetation Canopy</p>
            </div>
            <div className="bg-white border border-slate-200 border-l-4 border-l-emerald-600 shadow-sm rounded-2xl p-6 space-y-1">
              <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Active Carbon Credits</p>
              <p className="text-3xl font-extrabold text-slate-900 font-manrope">{credits} tCO2e</p>
              <p className="text-xs text-emerald-800 font-semibold mt-1">Minted & Verified ({badge})</p>
            </div>
            <div className="bg-white border border-slate-200 border-l-4 border-l-emerald-600 shadow-sm rounded-2xl p-6 space-y-1">
              <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Soil Biodiversity Index</p>
              <p className="text-3xl font-extrabold text-amber-700 font-manrope">{currentFarm.biodiversity_score ?? '—'} / 100</p>
              <p className="text-xs text-slate-500 font-medium pt-1">Ecosystem Richness Score</p>
            </div>
          </div>
        )}

        {currentFarm && (
          <button
            onClick={() => navigate('/farmer/land-verification')}
            className="text-xs font-bold text-emerald-800 hover:underline flex items-center gap-1.5"
          >
            <Compass className="w-4 h-4" />
            <span>Verify another parcel</span>
          </button>
        )}

      </div>
    </div>
  );
}
