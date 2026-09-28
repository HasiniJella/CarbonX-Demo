export const PY = import.meta.env.VITE_PY_API || '/py-api';
export const BC = import.meta.env.VITE_BC_API || '/bc-api';

/** Thrown when the backend returns 401 Unauthorized (token missing/expired/invalid). */
export class AuthError extends Error {
  constructor(message = 'Session expired. Please log in again.') {
    super(message);
    this.name = 'AuthError';
    this.status = 401;
  }
}

function authHeaders() {
  const token = localStorage.getItem('carbonx_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function _checkAuth(res) {
  if (res.status === 401) {
    throw new AuthError();
  }
  return res;
}

async function post(url, body) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(body),
  });
  await _checkAuth(res);
  return res.json();
}

async function patch(url, body) {
  const res = await fetch(url, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(body),
  });
  await _checkAuth(res);
  return res.json();
}

async function get(url) {
  const res = await fetch(url, { headers: authHeaders() });
  await _checkAuth(res);
  return res.json();
}

// ── Auth ──

export async function sendOtp(phone) {
  return post(`${PY}/send-otp`, { phone });
}

export async function verifyRegistrationOtp(phone, otp) {
  return post(`${PY}/register/verify-otp`, { phone, otp });
}

export async function sendLoginOtp(phone) {
  return post(`${PY}/login/send-otp`, { phone });
}

export async function registerUser(payload) {
  return post(`${PY}/register`, payload);
}

export async function loginUser(phone, otp) {
  return post(`${PY}/login`, { phone, otp });
}

export async function loginFpo(phone, fpoName, otp) {
  return post(`${PY}/fpo/login`, { phone, fpo_name: fpoName, otp });
}

export async function getMe() {
  return get(`${PY}/me`);
}

export async function updateProfile(fields) {
  return patch(`${PY}/profile`, fields);
}

// Voice assistant

export async function supportChat(message, history = [], language = 'en') {
  return post(`${PY}/support/chat`, { message, history, language });
}

export async function sendVoiceTextQuery(payload) {
  return post(`${PY}/api/v1/voice/text-query`, payload);
}

export async function sendVoiceAudioQuery({ file, language_code, session_id }) {
  const form = new FormData();
  form.append('file', file);
  if (language_code) form.append('language_code', language_code);
  if (session_id) form.append('session_id', session_id);
  const res = await fetch(`${PY}/api/v1/voice/query`, {
    method: 'POST',
    headers: authHeaders(),
    body: form,
  });
  await _checkAuth(res);
  return res.json();
}

// ── KYC ──

export async function verifyAadhaar(payload) {
  return post(`${PY}/verify-aadhaar`, payload);
}

export async function verifyLandDocument(payload) {
  return post(`${PY}/verify-land`, payload);
}

export async function getKycStatus(phone) {
  return get(`${PY}/kyc/status/${phone}`);
}

// ── Farms & satellite (GEE + ML) ──

export async function analyzeFarm(geojson, farmName, cropType, irrigation) {
  return post(`${PY}/analyze`, {
    geojson,
    farm_name: farmName,
    crop_type: cropType,
    irrigation,
  });
}

export async function saveFarm(farm) {
  return post(`${PY}/save-farm`, { farm });
}

export async function predictBiodiversity(longitude, latitude) {
  const res = await fetch(
    `${PY}/predict?longitude=${longitude}&latitude=${latitude}`,
    { headers: authHeaders() }
  );
  return res.json();
}

// ── Land registry & verification tiers ──

export async function lookupRegistry(surveyNumber) {
  return get(`${PY}/land/registry/${encodeURIComponent(surveyNumber)}`);
}

export async function autoDrawBoundary(payload) {
  return post(`${PY}/land/auto-draw`, payload);
}

// ── FPO review queue (Tier 3) ──

export async function getFpoFarms(status = 'PENDING') {
  return get(`${PY}/fpo/farms?status=${encodeURIComponent(status)}`);
}

export async function confirmFpoFarm(farmId) {
  return post(`${PY}/fpo/confirm/${encodeURIComponent(farmId)}`, {});
}

export async function reviewFpoFarm(farmId, action, notes = '') {
  return post(`${PY}/fpo/review/${encodeURIComponent(farmId)}`, { action, notes });
}

// ── Marketplace ──

// params: { status, crop, location, farmer_phone, farm_id, listing_model,
//           min_price, max_price, min_credits, max_credits, search,
//           sort, order, limit, offset }  (empty/null/undefined values are dropped)
export async function getMarketplaceListings(params = {}) {
  const qs = new URLSearchParams(
    Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '')
  ).toString();
  return get(`${PY}/marketplace/listings${qs ? `?${qs}` : ''}`);
}

export async function createMarketplaceListing(payload) {
  return post(`${PY}/marketplace/listings`, payload);
}

export async function placeListingBid(listingId) {
  return post(`${PY}/marketplace/listings/${listingId}/bid`, {});
}

// ── Blockchain ──

export async function mintCredit(payload) {
  return post(`${BC}/api/credits/mint`, payload);
}

export async function listCredit(tokenId, price) {
  return post(`${BC}/api/credits/list`, { tokenId, price });
}

export async function buyCredit(tokenId, price, buyerPrivateKey) {
  return post(`${BC}/api/credits/buy`, { tokenId, price, buyerPrivateKey });
}

export async function retireCredit(tokenId, ownerPrivateKey) {
  return post(`${BC}/api/credits/retire`, { tokenId, ownerPrivateKey });
}

export async function getCreditData(tokenId) {
  return get(`${BC}/api/credits/${tokenId}`);
}

export async function getBlockchainHealth() {
  try {
    const res = await fetch(`${BC}/health`);
    return res.ok;
  } catch {
    return false;
  }
}

/** Combined carbon + biodiversity credits from farm or analysis row */
export function combinedCredits(row) {
  const carbon = parseFloat(row?.carbon_tonnes ?? row?.carbon_credits ?? 0) || 0;
  const bio =
    parseFloat(row?.biodiversity_credits ?? 0) ||
    (parseFloat(row?.biodiversity_score ?? 0) / 40) ||
    0;
  const total = parseFloat(row?.total_credits ?? 0) || carbon + bio;
  return {
    carbon: Math.round(carbon * 100) / 100,
    biodiversity: Math.round(bio * 100) / 100,
    total: Math.round(total * 100) / 100,
  };
}
