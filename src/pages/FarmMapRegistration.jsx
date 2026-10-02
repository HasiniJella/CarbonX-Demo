import React, { useState, useEffect, useMemo, lazy, Suspense } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowRight, CheckCircle2, AlertTriangle, ShieldCheck, Compass, Info, Check, Edit3, X } from 'lucide-react';
import VerificationBadge from '../components/VerificationBadge';
const LeafletMap = lazy(() => import('../components/LeafletMap'));
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';

function geojsonToLatLngs(geojson) {
  try {
    const geom = geojson?.geometry || geojson;
    const ring = geom?.coordinates?.[0];
    if (!Array.isArray(ring) || ring.length < 3) return null;
    const pts = ring.map(([lng, lat]) => [Number(lat), Number(lng)]).filter(([la, ln]) => Number.isFinite(la) && Number.isFinite(ln));
    return pts.length >= 3 ? pts : null;
  } catch {
    return null;
  }
}

function centroidOf(pts) {
  if (!pts || pts.length === 0) return null;
  const lat = pts.reduce((s, p) => s + p[0], 0) / pts.length;
  const lng = pts.reduce((s, p) => s + p[1], 0) / pts.length;
  return [lat, lng];
}

export default function FarmMapRegistration() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { t } = useLanguage();

  // Received state from land-verification step
  const navState = location.state || {};
  const surveyNumber = navState.surveyNumber || '124/A';
  const ownerName = navState.ownerName || user?.name || 'K. Ramesh';
  const village = navState.village || 'Pochampally';
  const registryAreaHa = navState.areaHa || 1.20;
  const tierCode = navState.tierCode || (surveyNumber === '124/A' ? '1A' : surveyNumber === '124/B' ? '1B' : '2');
  const initialBadge = navState.tier || (tierCode === '1A' ? 'REGISTRY' : tierCode === '1B' ? 'REGISTRY_DOC' : 'DOCUMENT');
  const isReadOnly = tierCode === '1A';
  const verified = navState.verified === true;

  // Exact location from verification: registry geometry wins for Tier 1A,
  // Pahani/doc polygon wins for Tier 1B / Tier 2. The map flies to it and
  // marks the exact coordinates.
  const mapInitialPoints = useMemo(() => geojsonToLatLngs(navState.geojson), [navState.geojson]);
  const mapCentroid = useMemo(() => centroidOf(mapInitialPoints), [mapInitialPoints]);
  const geometrySource = navState.geojson?.properties?.source === 'pahani'
    ? t('fmapSrcPahani')
    : navState.geojson
      ? t('fmapSrcRegistry')
      : null;

  // Live calculated state from map drawing
  const [drawnAreaHa, setDrawnAreaHa] = useState(registryAreaHa);
  const [assignedBadge, setAssignedBadge] = useState(initialBadge);
  const [showConfirmationModal, setShowConfirmationModal] = useState(false);
  const [showAdvisory, setShowAdvisory] = useState(true);

  // Compute variance & tolerance
  const areaDiffHa = Math.abs(drawnAreaHa - registryAreaHa);
  const variancePercent = registryAreaHa > 0 ? (areaDiffHa / registryAreaHa) * 100 : 0;
  const isWithinTolerance = variancePercent <= 20;

  useEffect(() => {
    // If mismatch is outside 20% tolerance, flag as advisory FPO review (without hard-blocking)
    if (!isWithinTolerance && tierCode !== '1A') {
      setAssignedBadge('PENDING');
    } else {
      setAssignedBadge(initialBadge);
    }
  }, [drawnAreaHa, registryAreaHa, isWithinTolerance, tierCode, initialBadge]);

  const handleAreaCalculated = (res) => {
    if (res && res.area > 0) {
      setDrawnAreaHa(res.area);
    }
  };

  const handleFinalSubmit = () => {
    navigate('/farm-details', {
      state: {
        surveyNumber,
        ownerName,
        village,
        areaHa: drawnAreaHa,
        badge: assignedBadge,
        tierCode,
        flaggedForFpo: !isWithinTolerance
      }
    });
  };

  return (
    <div className="min-h-screen bg-surface font-inter text-agriText-main flex flex-col">

      {/* Top Header Bar */}
      <div className="bg-white border-b border-forest-100 px-4 md:px-8 py-3.5 shadow-xs flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold text-primary uppercase tracking-wider bg-surface-sage border border-forest-200 px-2.5 py-0.5 rounded-full">
              {t('fmapTierWord')} {tierCode} {t('fmapMappingVerif')}
            </span>
            <VerificationBadge badge={assignedBadge} showTier size="sm" />
          </div>
          <h1 className="text-lg font-extrabold text-carbon-900 font-manrope mt-1">
            {t('fmapParcelGeometry')} {t('fmapSurveyWord')} {surveyNumber} ({village})
          </h1>
        </div>

        {/* Live Area Cross-Verification Display Bar */}
        <div className="bg-surface-sage/60 border border-forest-200 rounded-xl px-4 py-2.5 text-xs flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div>
              <span className="text-[10px] text-agriText-subtle font-semibold block uppercase tracking-wider">{t('fmapRegistryArea')}</span>
              <span className="font-mono font-bold text-carbon-900">{registryAreaHa} ha</span>
            </div>
            <div className="h-6 border-r border-forest-200" />
            <div>
              <span className="text-[10px] text-agriText-subtle font-semibold block uppercase tracking-wider">{t('fmapDrawnArea')}</span>
              <span className="font-mono font-bold text-primary">{drawnAreaHa} ha</span>
            </div>
          </div>

          <div>
            {isWithinTolerance ? (
              <span className="text-emerald-800 font-bold bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-full flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5 text-emerald-700" />
                <span>{t('fmapWithinTol')}</span>
              </span>
            ) : (
              <span className="text-amber-800 font-bold bg-amber-50 border border-amber-200 px-3 py-1 rounded-full flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-700" />
                <span>{t('fmapAreaMismatch')}</span>
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Main Map Workspace */}
      <div className="flex-1 p-4 md:p-6 space-y-4 max-w-6xl mx-auto w-full">

        {/* Verified location banner — exact coordinates from registry / doc */}
        {mapCentroid && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3.5 text-xs text-emerald-900 flex items-start gap-3 shadow-xs">
            <ShieldCheck className="w-5 h-5 text-emerald-700 shrink-0 mt-0.5" />
            <div>
              <h3 className="font-bold">
                {verified ? t('fmapVerifiedWord') : t('fmapLocatedWord')} — {t('fmapSurveyWord')} {surveyNumber} {t('fmapMarkedAtExact')} {geometrySource || t('fmapRecordWord')} {t('fmapCoordinatesWord')}
              </h3>
              <p className="text-[11px] mt-0.5 font-mono">
                {mapCentroid[0].toFixed(5)}, {mapCentroid[1].toFixed(5)}
                {mapInitialPoints ? <> · {mapInitialPoints.length} {t('fmapBoundaryVertices')}</> : ''}
                {isReadOnly ? t('fmapLockedBoundary') : t('fmapConfirmRedraw')}
              </p>
            </div>
          </div>
        )}

        {/* Mismatch Advisory Warning (Dismissible & Non-Blocking!) */}
        {!isWithinTolerance && showAdvisory && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 text-xs text-amber-900 flex items-start justify-between gap-3 shadow-xs">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
              <div className="flex-1">
                <h3 className="font-bold text-amber-900">{t('fmapMismatchTitle')}</h3>
                <p className="text-[11px] text-amber-800 mt-0.5">
                  {t('fmapMismatchA')} (<code className="font-mono font-bold">{drawnAreaHa} ha</code>) {t('fmapMismatchB')} (<code className="font-mono font-bold">{registryAreaHa} ha</code>) {t('fmapMismatchC')} {Math.round(variancePercent)}%. {t('fmapMismatchD')}
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowAdvisory(false)}
              className="p-1 hover:bg-amber-100 rounded-lg text-amber-800 transition-colors"
              title={t('fmapDismissAdvisory')}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Interactive Leaflet Map Container */}
        <div className="z-0 relative h-[380px] md:h-[520px] rounded-2xl overflow-hidden shadow-card border border-forest-100">
          <Suspense fallback={<div className="h-full flex items-center justify-center text-xs text-agriText-muted">{t('fmapLoadingMap')}</div>}>
          <LeafletMap
            readOnly={isReadOnly}
            initialPoints={mapInitialPoints}
            center={mapCentroid}
            placeLabel={`${t('fmapSurveyWord')} ${surveyNumber} · ${village}`}
            subLabel={`${ownerName} · ${registryAreaHa} ha · ${t('fmapTierWord')} ${tierCode}`}
            onAreaCalculated={handleAreaCalculated}
            showHeatmapToggle={true}
            height="100%"
          />
          </Suspense>
        </div>

        {/* Action Bar */}
        <div className="bg-white border border-forest-100 rounded-2xl p-4 flex flex-col sm:flex-row justify-between items-center gap-4 shadow-card">
          <div className="text-xs text-agriText-muted">
            {isReadOnly ? (
              <span className="flex items-center gap-1.5 text-emerald-800 font-semibold">
                <ShieldCheck className="w-4 h-4 text-primary" />
                {t('fmapCadastralVerified')}
              </span>
            ) : (
              <span>
                {t('fmapDrawHint')}
              </span>
            )}
          </div>

          <button
            onClick={() => setShowConfirmationModal(true)}
            className="w-full sm:w-auto px-6 py-2.5 bg-primary hover:bg-primary-hover text-white text-xs font-bold rounded-xl shadow-sm flex items-center justify-center gap-2 transition-all"
          >
            <span>{t('fmapConfirmBoundary')}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Confirmation Modal Overlay */}
      {showConfirmationModal && (
        <div className="fixed inset-0 z-50 bg-[#1B4332]/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-forest-100 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl animate-in fade-in zoom-in duration-150">
            <div className="flex justify-between items-center border-b border-forest-100 pb-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-primary" />
                <h3 className="text-sm font-extrabold text-carbon-900 font-manrope">
                  {t('fmapIsThisYourLand')} {t('fmapSurveyWord')} {surveyNumber}, {Math.round(drawnAreaHa * 2.471 * 10) / 10} {t('fmapAcresWord')}, {village}
                </h3>
              </div>
              <button
                onClick={() => setShowConfirmationModal(false)}
                className="p-1 text-agriText-subtle hover:text-carbon-900 rounded-lg hover:bg-surface-sage"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="bg-surface-sage/50 border border-forest-200 rounded-xl p-4 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-agriText-subtle font-semibold">{t('fmapOwnerLabel')}</span>
                <span className="font-bold text-carbon-900">{ownerName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-agriText-subtle font-semibold">{t('regSurvey')}:</span>
                <span className="font-mono font-bold text-primary">{surveyNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-agriText-subtle font-semibold">{t('fmapVillageMandal')}</span>
                <span className="font-bold text-carbon-900">{village}</span>
              </div>
              <div className="flex justify-between border-t border-forest-200 pt-2">
                <span className="text-agriText-subtle font-semibold">{t('fmapVerifiedArea')}</span>
                <span className="font-mono font-bold text-primary">{drawnAreaHa} ha ({Math.round(drawnAreaHa * 2.471 * 100) / 100} acres)</span>
              </div>
              <div className="flex justify-between items-center border-t border-forest-200 pt-2">
                <span className="text-agriText-subtle font-semibold">{t('fmapAssignedBadge')}</span>
                <VerificationBadge badge={assignedBadge} showTier size="sm" />
              </div>
            </div>

            {!isWithinTolerance && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-[11px] text-amber-900">
                {t('fmapVarianceNotice')}
              </div>
            )}

            <div className="flex gap-2">
              <button
                onClick={() => setShowConfirmationModal(false)}
                className="flex-1 py-2.5 bg-surface-sage border border-forest-200 text-carbon-800 text-xs font-bold rounded-xl hover:bg-forest-100 transition-all flex items-center justify-center gap-1.5"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>{t('fmapEditPolygon')}</span>
              </button>
              <button
                onClick={handleFinalSubmit}
                className="flex-1 py-2.5 bg-primary hover:bg-primary-hover text-white text-xs font-bold rounded-xl shadow-sm transition-all flex items-center justify-center gap-1.5"
              >
                <Check className="w-3.5 h-3.5" />
                <span>{t('fmapConfirmSubmit')}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
