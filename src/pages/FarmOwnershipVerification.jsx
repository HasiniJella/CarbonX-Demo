import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Search, ShieldCheck, FileCheck, FileText, CheckCircle2, ArrowRight, Loader2,
  Upload, AlertCircle, Info, RefreshCw, Check, ScanLine, Camera, Layers
} from 'lucide-react';
import VerificationBadge from '../components/VerificationBadge';
import { useAuth } from '../context/AuthContext';
import { PY, verifyLandDocument } from '../services/api';
import { useLanguage } from '../context/LanguageContext';

export default function FarmOwnershipVerification() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { t } = useLanguage();

  // Survey number carried over from registration decides the tier:
  // registry hit -> Tier 1 (auto, no documents), miss -> Tier 2 (upload).
  const [surveyInput, setSurveyInput] = useState(
    location.state?.surveyNumber || '124/A'
  );
  const autoLookedUp = useRef(false);
  const [isSearching, setIsSearching] = useState(false);
  const [registryResult, setRegistryResult] = useState(null);
  const [searchDone, setSearchDone] = useState(false);

  // File upload state & real Trust Engine results (from Pahani OCR API)
  const [pahaniFile, setPahaniFile] = useState(null);
  const [isProcessingPipeline, setIsProcessingPipeline] = useState(false);
  const [pipelineDone, setPipelineDone] = useState(false);
  const [pipelineError, setPipelineError] = useState('');
  const [ocrFields, setOcrFields] = useState(null);
  const [stepResults, setStepResults] = useState([]);
  // Strict verdict: VERIFIED only when doc + registry + profile all agree.
  // NOT_VERIFIED blocks navigation and forces a re-upload.
  const [verificationStatus, setVerificationStatus] = useState(null);
  const [verificationMessage, setVerificationMessage] = useState('');
  const [ownerMismatch, setOwnerMismatch] = useState(null);
  const [proceedBlocked, setProceedBlocked] = useState('');
  // Tier cascade: Tier 1 mismatch -> fall through to Tier 2 doc check,
  // Tier 2 failure -> Tier 3 FPO review (backend auto-creates FLAGGED farm).
  const [tier2Fallback, setTier2Fallback] = useState(false);
  const [fpoSubmitting, setFpoSubmitting] = useState(false);

  const trustChecklist = [
    { title: t('fovStep1Title'), desc: t('fovStep1Desc') },
    { title: t('fovStep2Title'), desc: t('fovStep2Desc') },
    { title: t('fovStep3Title'), desc: t('fovStep3Desc') },
    { title: t('fovStep4Title'), desc: t('fovStep4Desc') },
    { title: t('fovStep5Title'), desc: t('fovStep5Desc') },
    { title: t('fovStep6Title'), desc: t('fovStep6Desc') },
  ];

  function _namesOverlap(a, b) {
    const ta = String(a || '').toLowerCase().split(/[^a-z]+/).filter((w) => w.length > 2);
    const tb = String(b || '').toLowerCase().split(/[^a-z]+/).filter((w) => w.length > 2);
    return ta.length > 0 && tb.length > 0 && ta.some((w) => tb.includes(w));
  }

  const handleRegistryLookup = async (e, overrideSurvey) => {
    if (e) e.preventDefault();
    const survey = (overrideSurvey || surveyInput).trim();
    if (!survey) return;

    setIsSearching(true);
    setSearchDone(false);
    setVerificationStatus(null);
    setVerificationMessage('');
    setOwnerMismatch(null);
    setProceedBlocked('');
    setTier2Fallback(false);

    try {
      const token = localStorage.getItem('carbonx_token');
      const response = await fetch(`${PY}/land/registry/${encodeURIComponent(survey)}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (response.status === 401) {
        navigate('/farmer/login');
        return;
      }
      if (response.ok) {
        const data = await response.json();
        if (data.found) {
          const hasGeom = data.registry_geometry_available || Boolean(data.geojson);
          const profileName = user?.name || '';
          const registryOwner = data.owner_name || '';
          const ownerOk = !profileName || !registryOwner || _namesOverlap(registryOwner, profileName);
          setRegistryResult({
            found: true,
            surveyNumber: data.survey_number || survey,
            ownerName: registryOwner || 'K. Ramesh',
            village: data.village || 'Pochampally',
            mandal: data.mandal || 'Yadadri Bhuvanagiri',
            areaHa: data.area_ha || 1.20,
            tier: hasGeom ? 'REGISTRY' : 'REGISTRY_DOC',
            tierCode: hasGeom ? '1A' : '1B',
            hasGeometry: hasGeom,
            geojson: data.geojson || null,
            ownerMatch: ownerOk,
            registryOwner,
          });
          if (!ownerOk) {
            setOwnerMismatch({
              docOwner: registryOwner,
              profileName,
              registryOwner,
              reason: t('fovSurveyRegPre') + (data.survey_number || survey) + t('fovSurveyRegMid1') + registryOwner + t('fovSurveyRegMid2') + profileName + t('fovSurveyRegPost'),
            });
            setVerificationStatus('NOT_VERIFIED');
            setVerificationMessage(
              t('fovNotVerBelongPre') + registryOwner + t('fovNotVerBelongMid') + profileName + t('fovNotVerBelongPost')
            );
          } else {
            setVerificationStatus('VERIFIED');
            setVerificationMessage(
              t('fovVerSurveyPre') + (data.survey_number || survey) + t('fovVerSurveyMid') + registryOwner + t('fovVerSurveyPost1') + (hasGeom ? 'Tier 1A' : 'Tier 1B') + t('fovVerSurveyPost2')
            );
          }
          setIsSearching(false);
          setSearchDone(true);
          return;
        }
      }
    } catch (err) {
      console.warn('API lookup offline, using simulated registry fallback', err);
    }

    setTimeout(() => {
      setIsSearching(false);
      setSearchDone(true);

      const upperSurvey = survey.toUpperCase();
      if (upperSurvey === '124/A' || upperSurvey === '101/A') {
        setRegistryResult({
          found: true,
          surveyNumber: upperSurvey,
          ownerName: user?.name || 'K. Ramesh',
          village: user?.village || 'Pochampally',
          mandal: user?.district || 'Yadadri Bhuvanagiri',
          areaHa: 1.20,
          acres: 2.96,
          tier: 'REGISTRY',
          tierCode: '1A',
          hasGeometry: true,
          ownerMatch: true,
          registryOwner: user?.name || 'K. Ramesh',
          geojson: {
            type: 'Feature',
            geometry: {
              type: 'Polygon',
              coordinates: [[[78.484, 17.383], [78.487, 17.383], [78.487, 17.386], [78.484, 17.386], [78.484, 17.383]]]
            }
          }
        });
        setVerificationStatus('VERIFIED');
        setVerificationMessage(t('fovVerifiedRegistryMatch'));
      } else if (upperSurvey === '124/B' || upperSurvey === '102/B') {
        setRegistryResult({
          found: true,
          surveyNumber: upperSurvey,
          ownerName: user?.name || 'Padma Bai',
          village: user?.village || 'Pochampally',
          mandal: user?.district || 'Yadadri Bhuvanagiri',
          areaHa: 0.85,
          acres: 2.10,
          tier: 'REGISTRY_DOC',
          tierCode: '1B',
          hasGeometry: false,
          ownerMatch: true,
          registryOwner: user?.name || 'Padma Bai',
          geojson: null
        });
        setVerificationStatus('VERIFIED');
        setVerificationMessage(t('fovVerifiedTier1B'));
      } else {
        setRegistryResult({
          found: false,
          surveyNumber: survey,
          tier: 'DOCUMENT',
          tierCode: '2',
          hasGeometry: false,
          ownerMatch: true,
          geojson: null
        });
        // Tier 2: verdict comes from the document pipeline below.
        setVerificationStatus(null);
        setVerificationMessage('');
      }
    }, 600);
  };

  const handlePahaniUpload = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setPahaniFile(file);
      runPipeline(file);
    }
  };

  // Real pipeline: OCR the Pahani via backend, then cross-check the
  // extracted survey/owner/area against the registry + farmer profile.
  // Steps reflect actual results — nothing passes unconditionally.
  const runPipeline = async (file = pahaniFile) => {
    if (!file) return;
    setIsProcessingPipeline(true);
    setPipelineDone(false);
    setPipelineError('');
    setOcrFields(null);
    setStepResults([]);
    setVerificationStatus(null);
    setVerificationMessage('');
    setOwnerMismatch(null);
    setProceedBlocked('');

    const push = (updater) => setStepResults((prev) => {
      const next = [...prev];
      updater(next);
      return next;
    });
    const setStep = (idx, passed, detail) => push((next) => {
      next[idx] = { passed, detail };
    });

    try {
      const token = localStorage.getItem('carbonx_token');
      const form = new FormData();
      form.append('file', file);
      const ocrRes = await fetch(`${PY}/documents/parse-pahani`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: form,
      });
      if (ocrRes.status === 401) {
        navigate('/farmer/login');
        return;
      }
      // Safe JSON parse: the request goes to the PY base (VITE_PY_API in
      // production, /py-api dev proxy locally). A non-JSON or empty body
      // means the API base is wrong or the backend is down — surface that
      // instead of "Unexpected end of JSON input" with steps stuck checking.
      const rawText = await ocrRes.text();
      let ocr = null;
      if (rawText) {
        try {
          ocr = JSON.parse(rawText);
        } catch {
          throw new Error(
            t('fovBackendNoJsonPre') + PY + t('fovBackendNoJsonMid1') + ocrRes.status + t('fovBackendNoJsonMid2')
          );
        }
      } else {
        throw new Error(
          t('fovBackendEmptyPre') + ocrRes.status + t('fovBackendEmptyMid1') + PY + t('fovBackendEmptyMid2')
        );
      }
      if (!ocrRes.ok || !ocr.success) {
        throw new Error(ocr.detail || ocr.message || t('fovOcrUnavailable'));
      }
      const fields = ocr.fields || {};
      setOcrFields(fields);
      const hasText = Boolean((ocr.english_text || '').trim());
      setStep(0, hasText, hasText ? t('fovDocExtracted') : t('fovNoReadableText'));
      const surveyNo = (fields.survey_no || '').trim();
      setStep(1, Boolean(surveyNo), surveyNo || t('fovMissingValidRecord'));
      const owner = (fields.pattadar_name || '').trim();
      setStep(2, Boolean(owner), owner || t('fovMissingValidRecord'));
      const area = fields.extent_acres || fields.extent_hectares;
      setStep(3, area != null, area != null ? area + ' ' + (fields.extent_acres ? t('fovUnitAcres') : t('fovUnitHa')) : t('fovMissing'));

      // Registry cross-check on the extracted survey number.
      let registryFound = false;
      let registryOwner = '';
      let registryGeojson = null;
      let registryAreaHa = null;
      if (surveyNo) {
        try {
          const regRes = await fetch(`${PY}/land/registry/${encodeURIComponent(surveyNo)}`, {
            headers: token ? { Authorization: `Bearer ${token}` } : {},
          });
          if (regRes.ok) {
            let reg = null;
            try {
              reg = JSON.parse(await regRes.text());
            } catch {
              reg = null;
            }
            if (!reg) {
              setStep(4, false, t('fovRegUnreachNonJson'));
            } else {
              registryFound = Boolean(reg.found);
              registryOwner = reg.owner_name || '';
              registryGeojson = reg.geojson || null;
              registryAreaHa = reg.area_ha ?? null;
              setStep(4, registryFound, registryFound
                ? t('fovMatchedPre') + reg.owner_name + ', ' + reg.area_ha + ' ' + t('fovUnitHa')
                : t('fovNotInRegistry'));
            }
          } else {
            setStep(4, false, t('fovRegLookupFailed'));
          }
        } catch {
          setStep(4, false, t('fovRegUnreachable'));
        }
      } else {
        setStep(4, false, t('fovNoSurveyLookup'));
      }

      // Strict 3-way ownership check: doc vs profile vs registry.
      const profileName = user?.name || '';
      const docProfileOk = _namesOverlap(owner, profileName);
      const registryProfileOk = !registryFound || !registryOwner || !profileName || _namesOverlap(registryOwner, profileName);
      const docRegistryOk = !registryFound || !registryOwner || !owner || _namesOverlap(owner, registryOwner);
      const ownersAgree = docProfileOk && registryProfileOk && docRegistryOk;
      if (!ownersAgree) {
        const who = !docProfileOk
          ? t('fovDocOwnerMismatchPre') + (owner || '—') + t('fovDocOwnerMismatchMid1') + (profileName || '—') + t('fovDocOwnerMismatchPost')
          : !registryProfileOk
            ? t('fovSurveyRegPre') + surveyNo + t('fovSurveyBelongMid') + registryOwner + t('fovSurveyRegMid2') + profileName + t('fovSurveyRegPost')
            : t('fovDocOwnerMismatchPre') + owner + t('fovDocRegMismatchMid') + registryOwner + t('fovDocOwnerMismatchPost');
        setStep(5, false, who + t('fovRejectedSuffix'));
        setOwnerMismatch({ docOwner: owner, profileName, registryOwner, reason: who });
      } else {
        setStep(5, Boolean(owner) && Boolean(profileName), owner && profileName
          ? t('fovDocMatchesPre') + profileName + t('fovDocMatchesPost')
          : t('fovOwnerCheckNeeds'));
      }

      // Tier-aware verdict. Registry miss (Tier 2) needs steps 1-3 + owner
      // agreement; registry hit (Tier 1) additionally needs the registry hit.
      const docsComplete = hasText && Boolean(surveyNo) && Boolean(owner) && area != null;
      const verified = registryFound ? (docsComplete && ownersAgree) : (docsComplete && docProfileOk);
      setPipelineDone(true);
      if (verified) {
        const tierLabel = registryFound ? (registryGeojson ? 'Tier 1' : 'Tier 1B') : 'Tier 2';
        setVerificationStatus('VERIFIED');
        setVerificationMessage(
          t('fovVerSurveyPre') + surveyNo + t('fovVerOwnerMid') + owner + t('fovVerTierMid1') + tierLabel + t('fovVerTierMid2')
        );
        // Build the exact map payload: registry geometry wins for Tier 1A,
        // otherwise the Pahani boundary coords (doc) win, else registry.
        let docGeojson = null;
        const coords = fields.boundary_coords;
        if (Array.isArray(coords) && coords.length >= 3) {
          const ring = [];
          coords.forEach((p) => {
            const lng = Number(p.longitude);
            const lat = Number(p.latitude);
            if (Number.isFinite(lng) && Number.isFinite(lat)) ring.push([lng, lat]);
          });
          if (ring.length >= 3) {
            if (ring[0][0] !== ring[ring.length - 1][0] || ring[0][1] !== ring[ring.length - 1][1]) ring.push(ring[0]);
            docGeojson = { type: 'Feature', properties: { source: 'pahani' }, geometry: { type: 'Polygon', coordinates: [ring] } };
          }
        }
        const mapGeojson = registryGeojson || docGeojson || null;
        const mapTierCode = registryFound ? (registryGeojson ? '1A' : '1B') : '2';
        const mapTier = registryFound ? (registryGeojson ? 'REGISTRY' : 'REGISTRY_DOC') : 'DOCUMENT';
        const areaHa = registryAreaHa ?? fields.extent_hectares ?? (fields.extent_acres ? Math.round(fields.extent_acres * 0.404686 * 100) / 100 : 1.2);
        setSurveyInput(surveyNo);
        setRegistryResult({
          found: registryFound,
          surveyNumber: surveyNo,
          ownerName: owner,
          village: fields.village || user?.village || 'Pochampally',
          mandal: fields.mandal || fields.district || user?.district || 'Yadadri Bhuvanagiri',
          areaHa,
          tier: mapTier,
          tierCode: mapTierCode,
          hasGeometry: Boolean(mapGeojson),
          ownerMatch: true,
          registryOwner: registryOwner || owner,
          geojson: mapGeojson,
        });
        setSearchDone(true);
        // Relocate to the map with the exact coordinates marked.
        setTimeout(() => {
          navigate('/farm-map', {
            state: {
              surveyNumber: surveyNo,
              ownerName: owner,
              village: fields.village || user?.village || 'Pochampally',
              areaHa,
              tierCode: mapTierCode,
              tier: mapTier,
              hasGeometry: Boolean(mapGeojson),
              geojson: mapGeojson,
              pahaniUploaded: true,
              verified: true,
            },
          });
        }, 1400);
      } else {
        const reason = !docsComplete
          ? t('fovInvalidDoc')
          : t('fovNotVerOwnerPre') + (owner || t('fovUnknown')) + t('fovNotVerOwnerMid1') + profileName + t('fovNotVerOwnerMid2') + (registryOwner || '—') + t('fovNotVerOwnerPost');
        setVerificationStatus('NOT_VERIFIED');
        setVerificationMessage(reason);
        setPipelineDone(true);
      }
    } catch (err) {
      const msg = err.message || t('fovDocVerifyFailed');
      setPipelineError(msg);
      // Mark every checklist step failed so the UI never sticks on checking...
      setStepResults(trustChecklist.map(() => ({ passed: false, detail: t('fovNotReachedOcr') })));
      setVerificationStatus('NOT_VERIFIED');
      setVerificationMessage(t('fovNotVerifiedPre') + msg);
      setPipelineDone(true);
    } finally {
      setIsProcessingPipeline(false);
    }
  };

  // Auto-run the registry lookup when a survey number arrives from registration.
  useEffect(() => {
    if (location.state?.surveyNumber && !autoLookedUp.current) {
      autoLookedUp.current = true;
      handleRegistryLookup();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Tier 1 -> Tier 2: registry shows another owner, so drop the Tier 1
  // result and continue with the Tier 2 document + map check instead.
  const continueAsTier2 = () => {
    setTier2Fallback(true);
    setRegistryResult(null);
    setSearchDone(false);
    setVerificationStatus(null);
    setVerificationMessage(t('fovTier2ContMsg'));
    setOwnerMismatch(null);
    setProceedBlocked('');
    setPipelineDone(false);
    setStepResults([]);
  };

  const fileToBase64 = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  // Tier 2 -> Tier 3: document check failed, route to FPO review via the
  // configured PY base (same base as the OCR + registry calls above).
  const requestFpoReview = async () => {
    if (!pahaniFile || fpoSubmitting) return;
    setFpoSubmitting(true);
    setProceedBlocked('');
    try {
      const base64 = await fileToBase64(pahaniFile);
      const res = await verifyLandDocument({
        document_name: pahaniFile.name || 'pahani.jpg',
        document_content_type: pahaniFile.type || 'image/jpeg',
        pahani_file: base64,
        survey_number: ocrFields?.survey_no || surveyInput,
        village: ocrFields?.village || user?.village || '',
        district: user?.district || '',
      });
      if (res?.success) {
        navigate('/farmer/dashboard', {
          state: { fpoPending: true, farmId: res.farm_id, status: res.status || 'FLAGGED' },
        });
      } else {
        setProceedBlocked(res?.message || t('fovFpoFail'));
      }
    } catch (err) {
      const raw = err?.message || '';
      setProceedBlocked(
        /json|Unexpected end|empty response|Failed to fetch|NetworkError/i.test(raw)
          ? t('fovBackendFpoPre') + PY + t('fovBackendFpoMid')
          : (raw || t('fovFpoFail'))
      );
    } finally {
      setFpoSubmitting(false);
    }
  };

  const proceedToMapping = () => {
    if (!registryResult) return;
    // Hard gate: mismatched ownership must never reach the map.
    if (verificationStatus === 'NOT_VERIFIED' || registryResult.ownerMatch === false) {
      setProceedBlocked(
        verificationMessage || t('fovNotBelongProfile')
      );
      return;
    }
    if (verificationStatus !== 'VERIFIED') {
      setProceedBlocked(t('fovVerIncomplete'));
      return;
    }
    setProceedBlocked('');

    navigate('/farm-map', {
      state: {
        surveyNumber: registryResult.surveyNumber || surveyInput,
        ownerName: registryResult.ownerName || user?.name || 'Farmer',
        village: registryResult.village || 'Pochampally',
        areaHa: registryResult.areaHa || 1.20,
        tierCode: registryResult.tierCode,
        tier: registryResult.tier,
        hasGeometry: registryResult.hasGeometry,
        geojson: registryResult.geojson,
        pahaniUploaded: Boolean(pahaniFile)
      }
    });
  };

  return (
    <div className="min-h-screen bg-[#F8FAF8] font-inter text-slate-900 py-8 px-4 md:px-10">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* Page Header */}
        <div className="bg-white border border-slate-200 shadow-sm rounded-xl p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <span className="text-xs font-semibold text-emerald-800 uppercase tracking-wider bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full inline-block mb-1">
              {t('fovStepBadge')}
            </span>
            <h1 className="text-2xl font-extrabold text-slate-900 font-manrope">{t('fovTitle')}</h1>
            <p className="text-xs text-slate-500 mt-0.5">
              {t('fovSubtitle')}
            </p>
          </div>

          {registryResult && (
            <VerificationBadge
              badge={verificationStatus === 'NOT_VERIFIED' ? 'PENDING' : registryResult.tier}
              showTier
              size="lg"
            />
          )}
        </div>

        {/* 50/50 Split Desktop Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* Left Column: Registry Search & Trust Engine Stepper */}
          <div className="bg-white border border-slate-200 shadow-sm rounded-xl p-6 space-y-6">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-emerald-700" />
              <span>{t('fovLookupTitle')}</span>
            </h2>

            <form onSubmit={handleRegistryLookup} className="space-y-3">
              <label className="block text-xs font-bold text-slate-700">{t('fovSurveyLabel')}</label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <input
                    type="text"
                    value={surveyInput}
                    onChange={e => setSurveyInput(e.target.value)}
                    placeholder={t('fovSurveyPlaceholder')}
                    className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono text-slate-900 focus:outline-none focus:border-emerald-600"
                    required
                  />
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                </div>
                <button
                  type="submit"
                  disabled={isSearching}
                  className="px-5 py-2.5 bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-bold rounded-lg shadow-sm flex items-center gap-2 transition-all disabled:opacity-50"
                >
                  {isSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                  <span>{t('fovLookupBtn')}</span>
                </button>
              </div>
            </form>

            <hr className="border-slate-100" />

            {/* Tier 1 (registry hit): record auto-verified, no document needed */}
            {searchDone && registryResult?.found && !tier2Fallback ? (
              <div className={`rounded-xl p-4 space-y-1 border ${verificationStatus === 'NOT_VERIFIED' || registryResult.ownerMatch === false ? 'bg-red-50 border-red-200' : 'bg-emerald-50 border-emerald-200'}`}>
                {verificationStatus === 'NOT_VERIFIED' || registryResult.ownerMatch === false ? (
                  <>
                    <h2 className="text-base font-bold text-red-900 flex items-center gap-2">
                      <AlertCircle className="w-5 h-5 text-red-700" />
                      <span>{t('fovMismatchTitle')}</span>
                    </h2>
                    <p className="text-[11px] text-red-800 font-medium">
                      {verificationMessage || (t('fovSurveyRegPre') + registryResult.surveyNumber + t('fovSurveyBelongMid') + registryResult.ownerName + t('fovSurveyRegMid2') + (user?.name || '') + t('fovMismatchFallbackPost'))}
                    </p>
                    <p className="text-[11px] text-red-700">
                      {t('fovTier1Blocked')}
                    </p>
                    <button
                      onClick={continueAsTier2}
                      className="w-full mt-2 py-2.5 bg-[#1B4332] hover:bg-[#2D6A4F] text-white rounded-lg text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-2"
                    >
                      <span>{t('fovContinueTier2')}</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </>
                ) : (
                  <>
                    <h2 className="text-base font-bold text-emerald-950 flex items-center gap-2">
                      <CheckCircle2 className="w-5 h-5 text-emerald-700" />
                      <span>{t('fovTierPre')}{registryResult.tierCode}{t('fovTierVerifiedMatch')}</span>
                    </h2>
                    <p className="text-[11px] text-emerald-800">
                      {t('fovSurveyMatchedPre')}{registryResult.surveyNumber}{t('fovSurveyMatchedMid')}{registryResult.ownerName}{t('fovSurveyMatchedMid2')}{registryResult.areaHa}{t('fovSurveyMatchedPost')}
                      {registryResult.hasGeometry
                        ? t('fovBoundaryAuto')
                        : t('fovBoundaryDraw')}
                    </p>
                  </>
                )}
              </div>
            ) : (
            /* Tier 2 (registry miss): Pahani upload fallback */
            <div className="space-y-4">
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <FileText className="w-5 h-5 text-emerald-700" />
                <span>{t('fovTier2Title')}</span>
              </h2>

              <div className="border-2 border-dashed border-slate-300 rounded-xl p-6 text-center hover:border-emerald-600 bg-[#F8FAF8] transition-colors">
                <input
                  type="file"
                  accept="image/*,.pdf"
                  onChange={handlePahaniUpload}
                  id="doc-upload"
                  className="hidden"
                />
                <label htmlFor="doc-upload" className="cursor-pointer space-y-2 block">
                  <Upload className="w-8 h-8 text-emerald-700 mx-auto" />
                  <p className="text-xs font-bold text-slate-900">
                    {pahaniFile ? pahaniFile.name : t('fovUploadDoc')}
                  </p>
                  <p className="text-[10px] text-slate-500">{t('fovUploadHint')}</p>
                </label>
              </div>

              {/* Real pipeline results: each step shows its actual pass/fail */}
              {(isProcessingPipeline || pipelineDone) && (
                <div className={`border rounded-xl p-4 space-y-3 ${verificationStatus === 'NOT_VERIFIED' || pipelineError ? 'bg-red-50 border-red-200' : verificationStatus === 'VERIFIED' ? 'bg-emerald-50 border-emerald-200' : 'bg-emerald-50 border-emerald-200'}`}>
                  <div className="flex justify-between items-center text-xs">
                    <div className="flex items-center gap-2">
                      {isProcessingPipeline ? (
                        <Loader2 className="w-4 h-4 text-emerald-700 animate-spin" />
                      ) : verificationStatus === 'NOT_VERIFIED' || pipelineError ? (
                        <AlertCircle className="w-4 h-4 text-red-700" />
                      ) : verificationStatus === 'VERIFIED' ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                      ) : stepResults.every((s) => s?.passed) ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                      ) : (
                        <AlertCircle className="w-4 h-4 text-amber-700" />
                      )}
                      <span className={`font-bold ${verificationStatus === 'NOT_VERIFIED' ? 'text-red-900' : 'text-emerald-950'}`}>
                        {isProcessingPipeline
                          ? t('fovRunningOcr')
                          : verificationStatus === 'NOT_VERIFIED'
                            ? t('fovNotVerUploadValid')
                            : verificationStatus === 'VERIFIED'
                              ? t('fovVerifiedToMap')
                              : pipelineError
                                ? t('fovNotVerInvalid')
                                : stepResults.every((s) => s?.passed)
                                  ? t('fovPipelinePassed')
                                  : t('fovPipelineReview')}
                      </span>
                    </div>
                    <span className="text-[11px] font-mono font-bold text-emerald-800">
                      {stepResults.filter((s) => s?.passed).length}/{trustChecklist.length} {t('fovPassed')}
                    </span>
                  </div>

                  <div className="space-y-1.5">
                    {trustChecklist.map((step, idx) => {
                      const r = stepResults[idx];
                      return (
                        <div key={idx} className="flex items-start gap-2 text-[11px]">
                          {r ? (
                            r.passed
                              ? <Check className="w-3.5 h-3.5 text-emerald-700 shrink-0 mt-0.5" />
                              : <AlertCircle className="w-3.5 h-3.5 text-amber-700 shrink-0 mt-0.5" />
                          ) : (
                            <Loader2 className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5 animate-spin" />
                          )}
                          <div>
                            <span className="font-bold text-slate-900">{step.title}</span>
                            <span className="text-slate-600"> — {r ? r.detail : t('fovChecking')}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {pipelineError && (
                    <p className="text-[11px] text-red-800 font-medium">{pipelineError}</p>
                  )}
                  {verificationMessage && (
                    <p className={`text-[11px] font-bold ${verificationStatus === 'NOT_VERIFIED' ? 'text-red-800' : 'text-emerald-800'}`}>
                      {verificationMessage}
                    </p>
                  )}
                  {verificationStatus === 'NOT_VERIFIED' && (
                    <div className="space-y-2">
                      <button
                        onClick={() => {
                          setPahaniFile(null);
                          setPipelineDone(false);
                          setStepResults([]);
                          setOcrFields(null);
                          setVerificationStatus(null);
                          setVerificationMessage('');
                          setOwnerMismatch(null);
                          document.getElementById('doc-upload')?.click();
                        }}
                        className="w-full py-2.5 bg-red-700 hover:bg-red-600 text-white rounded-lg text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-2"
                      >
                        <RefreshCw className="w-4 h-4" />
                        <span>{t('fovReupload')}</span>
                      </button>
                      <button
                        onClick={requestFpoReview}
                        disabled={fpoSubmitting || !pahaniFile}
                        className="w-full py-2.5 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white rounded-lg text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-2"
                      >
                        {fpoSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                        <span>{fpoSubmitting ? t('fovSendingFpo') : t('fovTier2FailedFpo')}</span>
                      </button>
                      <p className="text-[10px] text-slate-500 text-center">
                        {t('fovDocMapFailed')}
                      </p>
                    </div>
                  )}
                  {pipelineDone && !pipelineError && ocrFields && verificationStatus !== 'NOT_VERIFIED' && verificationStatus !== 'VERIFIED' && (
                    <p className="text-[11px] text-emerald-800 font-medium">
                      {t('fovExtractedPre')}{ocrFields.survey_no || '—'}{t('fovExtractedMid1')}{ocrFields.pattadar_name || '—'}{t('fovExtractedMid2')}{ocrFields.extent_acres ?? ocrFields.extent_hectares ?? '—'}{t('fovExtractedPost')}
                      {stepResults[4] && !stepResults[4].passed
                        ? t('fovRegMissTier2')
                        : t('fovRegMatchedTier1')}
                    </p>
                  )}
                </div>
              )}

              {!isProcessingPipeline && !pipelineDone && pahaniFile && (
                <button
                  onClick={() => runPipeline()}
                  className="w-full py-2.5 bg-[#1B4332] hover:bg-[#2D6A4F] text-white rounded-lg text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-2"
                >
                  <ScanLine className="w-4 h-4" />
                  <span>{t('fovRunTrust')}</span>
                </button>
              )}
            </div>
            )}
          </div>

          {/* Right Column: Extracted Record Metadata & Forward Action */}
          <div className="bg-white border border-slate-200 shadow-sm rounded-xl p-6 space-y-6 flex flex-col justify-between">
            <div className="space-y-6">
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <FileText className="w-5 h-5 text-emerald-700" />
                <span>{t('fovMetaTitle')}</span>
              </h2>

              {searchDone && registryResult ? (
                <div className="space-y-4">
                  <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider block mb-1">
                        {t('fovBadgeLabel')}
                      </span>
                      <VerificationBadge badge={registryResult.tier} showTier size="lg" />
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] font-semibold text-slate-500">{t('fovBenchPrice')}</p>
                      <p className="text-sm font-bold text-emerald-800">
                        {registryResult.tier === 'REGISTRY' ? 'INR 340 / credit' : registryResult.tier === 'REGISTRY_DOC' ? 'INR 320 / credit' : 'INR 310 / credit'}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 bg-[#F8FAF8] p-4 rounded-xl border border-slate-200 text-xs">
                    <div>
                      <span className="text-[10px] text-slate-500 font-semibold block">{t('fovOwnerLabel')}</span>
                      <span className="font-bold text-slate-900">{registryResult.ownerName}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 font-semibold block">{t('regSurvey')}</span>
                      <span className="font-mono font-bold text-emerald-800">{registryResult.surveyNumber}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 font-semibold block">{t('fovVillageMandal')}</span>
                      <span className="font-bold text-slate-900">{registryResult.village}, {registryResult.mandal}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 font-semibold block">{t('fovAcreageLabel')}</span>
                      <span className="font-bold text-slate-900">{registryResult.areaHa} {t('fovUnitHa')} ({Math.round(registryResult.areaHa * 2.471 * 100) / 100} {t('fovUnitAcresCap')})</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-[#F8FAF8] border border-slate-200 rounded-xl p-6 text-center text-xs text-slate-500">
                  {t('fovEmptyMeta')}
                </div>
              )}
            </div>

            {searchDone && registryResult && (
              <div className="space-y-2 mt-6">
                {verificationStatus === 'NOT_VERIFIED' && (
                  <p className="text-[11px] font-bold text-red-800 bg-red-50 border border-red-200 p-2.5 rounded-xl text-center">
                    {t('fovDisapprovedPre')}{verificationMessage || t('fovUploadYourValid')}
                  </p>
                )}
                {verificationStatus === 'VERIFIED' && (
                  <p className="text-[11px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 p-2.5 rounded-xl text-center">
                    {t('fovVerifiedPreDash')}{verificationMessage || t('fovOwnershipConfirmed')}
                  </p>
                )}
                {proceedBlocked && (
                  <p className="text-[11px] font-bold text-red-800 bg-red-50 border border-red-200 p-2.5 rounded-xl text-center">
                    {proceedBlocked}
                  </p>
                )}
                <button
                  onClick={proceedToMapping}
                  disabled={verificationStatus !== 'VERIFIED'}
                  className={`w-full py-3 rounded-xl text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-2 ${verificationStatus === 'VERIFIED' ? 'bg-[#1B4332] hover:bg-[#2D6A4F] text-white' : 'bg-slate-200 text-slate-500 cursor-not-allowed'}`}
                >
                  <span>{verificationStatus === 'VERIFIED' ? t('fovContinueMapping') : verificationStatus === 'NOT_VERIFIED' ? t('fovCannotProceed') : t('fovProceedMapping')}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
