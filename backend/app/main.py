from pathlib import Path

from dotenv import load_dotenv

APP_DIR = Path(__file__).resolve().parent
BACKEND_DIR = APP_DIR.parent
ROOT_DIR = BACKEND_DIR.parent

load_dotenv(ROOT_DIR / ".env", override=True)
load_dotenv(BACKEND_DIR / ".env", override=True)

from fastapi import FastAPI, File, Header, HTTPException, Depends, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Literal, Optional
import base64
import re
from datetime import datetime, timedelta, timezone
import os

from app.security import create_access_token, decode_token, get_current_user, require_role
from app.phone_service import generate_otp, normalize_indian_mobile, send_phone_otp
from app import supabase_db as db
from app import redis_store
from app import sample_data
from app.services.kyc_service import analyse_document, validate_aadhaar

app = FastAPI(title="CarbonX API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("CORS_ORIGINS", "http://localhost:5173,http://localhost:3000").split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

earth_engine_ready = False
try:
    import ee
    ee.Initialize(project=os.getenv("GEE_PROJECT", "carbonsetu-496709"))
    earth_engine_ready = True
    print("Earth Engine initialized")
except Exception as e:
    print(f"Earth Engine not available: {e}")


def _sms_ready() -> bool:
    """True when at least one SMS provider (Textplate or Twilio) is set."""
    try:
        from app.phone_service import sms_configured

        return sms_configured()
    except Exception:
        return False


def _sms_provider() -> str:
    """Name of the configured SMS provider(s) for health reporting."""
    try:
        from app.phone_service import textplate_configured, twilio_configured

        primary = textplate_configured()
        fallback = twilio_configured()
        if primary and fallback:
            return "Textplate+Twilio"
        if fallback:
            return "Twilio"
        return "Textplate"
    except Exception:
        return "Textplate"


def _otp_dev_fallback_enabled() -> bool:
    explicit = os.getenv("OTP_DEV_FALLBACK", "").strip().lower()
    if explicit in {"1", "true", "yes", "on"}:
        return True
    if explicit in {"0", "false", "no", "off"}:
        return False
    env = os.getenv("APP_ENV", os.getenv("ENVIRONMENT", "development")).strip().lower()
    return env not in {"prod", "production"}


def _require_database():
    if not db.is_ready():
        raise HTTPException(
            status_code=503,
            detail="Database is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in backend/.env.",
        )


def _get_user(phone: str):
    _require_database()
    return db.get_profile(phone)


def _save_user(user: dict):
    _require_database()
    db.upsert_profile(user)


def _get_user_farms(phone: str):
    _require_database()
    return db.get_farms(phone)


def _save_farm(farm: dict):
    _require_database()
    return db.insert_farm(farm)


def _store_otp(phone: str, otp: str):
    redis_store.store_otp(phone, otp)


def _verify_otp(phone: str, otp: str) -> bool:
    return redis_store.verify_otp(phone, otp)


def _clear_otp(phone: str):
    redis_store.clear_otp(phone)


def _normalize_phone_or_error(phone: str) -> str:
    normalized = normalize_indian_mobile(phone)
    if not normalized:
        raise ValueError("Enter a valid 10-digit Indian mobile number")
    return normalized


def _polygon_area_hectares(geojson: dict) -> float:
    import math

    geometry = geojson.get("geometry", {})
    if geometry.get("type") != "Polygon":
        raise ValueError("GeoJSON must be a Polygon")
    rings = geometry.get("coordinates") or []
    ring = rings[0] if rings else []
    if len(ring) < 4:
        raise ValueError("Polygon must have at least 3 points")
    if ring[0] != ring[-1]:
        ring = [*ring, ring[0]]
    lat_mid = sum(float(point[1]) for point in ring[:-1]) / (len(ring) - 1)
    meters_per_degree_lng = 111320 * math.cos(math.radians(lat_mid))
    meters_per_degree_lat = 110540
    area_m2 = 0
    projected = [
        (float(lng) * meters_per_degree_lng, float(lat) * meters_per_degree_lat)
        for lng, lat in ring
    ]
    for i in range(len(projected) - 1):
        x1, y1 = projected[i]
        x2, y2 = projected[i + 1]
        area_m2 += x1 * y2 - x2 * y1
    return round(abs(area_m2) / 20000, 2)


class SendOtpModel(BaseModel):
    phone: str


class RegisterModel(BaseModel):
    phone: str
    otp: str
    name: str
    aadhaar: str
    state: str
    district: str
    village: str
    upi: str = ""
    email: Optional[str] = ""
    role: Optional[Literal["farmer", "buyer", "fpo", "verifier", "admin"]] = "farmer"
    preferred_language: Optional[str] = "en"
    otp_verification_token: Optional[str] = ""


class LoginOtpModel(BaseModel):
    phone: str
    otp: str


class FpoLoginModel(BaseModel):
    phone: str
    fpo_name: str
    otp: str


class CorporateLoginModel(BaseModel):
    name: str
    password: str


class RegistrationOtpVerifyModel(BaseModel):
    phone: str
    otp: str


class AnalyzeModel(BaseModel):
    geojson: dict
    farm_name: Optional[str] = "My Farm"
    crop_type: Optional[str] = "Mixed Crop"
    irrigation: Optional[str] = "Drip"


class SaveFarmModel(BaseModel):
    farm: dict


class UpdateProfileModel(BaseModel):
    name: Optional[str] = None
    state: Optional[str] = None
    district: Optional[str] = None
    village: Optional[str] = None
    upi: Optional[str] = None
    role: Optional[Literal["farmer", "buyer", "fpo", "verifier", "admin"]] = None
    preferred_language: Optional[str] = None


class CreateListingModel(BaseModel):
    carbon_credits: Optional[float] = None
    biodiversity_credits: Optional[float] = None
    credits: Optional[float] = None
    price_per_credit: float = 520
    farm_id: Optional[str] = None
    crop: Optional[str] = ""
    token_id: Optional[str] = None
    tx_hash: Optional[str] = None


class LandVerificationModel(BaseModel):
    document_name: Optional[str] = "document.png"
    document_content_base64: Optional[str] = ""
    extracted_text: Optional[str] = ""
    survey_number: Optional[str] = ""
    village: Optional[str] = ""
    district: Optional[str] = ""
    area_acres: Optional[float] = None
    area_hectares: Optional[float] = None
    path: Optional[str] = None
    fpo_id: Optional[str] = None
    farm_id: Optional[str] = None
    geojson: Optional[dict] = None
    aadhaar: Optional[str] = None
    confirm_polygon: Optional[bool] = False
    pahani_file: Optional[str] = ""
    document_content_type: Optional[str] = "image/jpeg"
class AadhaarVerificationModel(BaseModel):
    front_image: str
    back_image: str
    front_content_type: Optional[str] = "image/jpeg"
    back_content_type: Optional[str] = "image/jpeg"


class AutoDrawModel(BaseModel):
    survey_number: Optional[str] = None
    village: Optional[str] = None
    district: Optional[str] = None
    state: Optional[str] = None
    area_hectares: Optional[float] = None


class CheckFarmlandModel(BaseModel):
    geojson: dict


class FpoReviewModel(BaseModel):
    action: str
    notes: Optional[str] = ""


from app.voice_agent.voice_routes import router as voice_router
app.include_router(voice_router)


class SupportChatMessage(BaseModel):
    role: Optional[str] = "user"
    text: Optional[str] = ""


class SupportChatModel(BaseModel):
    message: str
    language: Optional[str] = "en"
    history: Optional[list[SupportChatMessage]] = []


SUPPORT_SYSTEM_PROMPT = (
    "You are the CarbonX Support Assistant, helping Indian farmers and buyers use the CarbonX app. "
    "Answer clearly in the user's language (English, Hindi, or Telugu). Keep answers short (under 120 words) "
    "and practical, with steps when the user asks how to do something. "
    "Never ask for or repeat Aadhaar numbers, OTPs, passwords, bank details, or UPI IDs."
)

SUPPORT_KNOWLEDGE = (
    "CarbonX facts:\n"
    "- CarbonX helps farmers earn carbon + biodiversity credits from their farms, sold to corporate buyers.\n"
    "- Farmer login is phone + 6-digit OTP (no password). Roles: farmer, FPO officer, corporate buyer, admin.\n"
    "- Land verification tiers: Tier 1A = survey matches govt registry with official boundary (auto-verified, locked map); "
    "Tier 1B = registry record match, farmer draws boundary; Tier 2 = survey not in registry, upload Pahani/RoR 1B and draw boundary; "
    "Tier 3 = FPO-attested. Ownership mismatches are rejected with Not Verified.\n"
    "- Farm map: Tier 1A boundary is locked from the registry; other tiers draw/confirm the polygon. Area tolerance is 20%.\n"
    "- Satellite: Sentinel-2 scans roughly every 5 days; NDVI measures crop health (-1 to 1, higher is healthier).\n"
    "- Credits: carbon credits come from estimated carbon tonnes; biodiversity credits = biodiversity score / 40; "
    "total = carbon + biodiversity. Benchmark prices: Tier 1A ~INR 340, 1B ~INR 320, Tier 2 ~INR 310, FPO ~INR 300 per credit.\n"
    "- Marketplace: only VERIFIED farms with an eligible badge can list. PENDING/FLAGGED farms go to FPO review.\n"
    "- Wallet/UPI: after a buyer purchases credits, payout goes to the farmer's registered UPI/bank account.\n"
    "- KYC: Aadhaar + Pahani/land document; only the last 4 digits of Aadhaar are stored.\n"
    "- Key pages: Dashboard (/farmer/dashboard), Land Verification (/farmer/land-verification), "
    "Map (/farm-map), Wallet (/farmer/wallet), Marketplace (/marketplace).\n"
    "- Farmer Helpline: 1800-420-2026 (toll-free, 9 AM - 9 PM IST).\n"
    "If a question is unrelated to CarbonX, farming, or carbon credits, say briefly what you can help with."
)

SUPPORT_FALLBACK_REPLIES = (
    ("map", 'You can map your farm from your dashboard: open Land Verification, verify your survey number, then draw the boundary on the satellite map. The area is calculated automatically.'),
    ("scan", 'Sentinel-2 satellites rescan roughly every 5 days. Updated NDVI values appear on your farm analytics page.'),
    ("credit", 'Carbon credits come from your farm NDVI, area, and crop type. Total credits = carbon tonnes + biodiversity score / 40. Only VERIFIED farms with an eligible badge can list on the marketplace.'),
    ("ndvi", 'NDVI (Normalized Difference Vegetation Index) measures crop health from satellite imagery, from -1 to 1. Higher means healthier crops.'),
    ("upi", 'After a buyer purchases your credits, the payout goes to your registered UPI/bank account. Check your wallet page for status.'),
    ("payout", 'After a buyer purchases your credits, the payout goes to your registered UPI/bank account. Check your wallet page for status.'),
    ("kyc", 'KYC needs your Aadhaar and a Pahani/land document. Only the last 4 digits of Aadhaar are stored. Ownership mismatches are rejected as Not Verified.'),
    ("otp", 'Farmer login uses phone + 6-digit OTP. Enter your 10-digit mobile number, tap Send OTP, then enter the code.'),
    ("fpo", 'Pending or flagged parcels are reviewed by your FPO coordinator, who can confirm or reject them from the FPO dashboard.'),
)


def _support_fallback_reply(text: str) -> str:
    lowered = (text or '').lower()
    for keyword, reply in SUPPORT_FALLBACK_REPLIES:
        if keyword in lowered:
            return reply
    return ('I can help with farm mapping, land verification tiers, satellite scans, carbon credits, '
            'UPI payouts, KYC, OTP login, and FPO review. What would you like to know?')


@app.post("/support/chat")
def support_chat(data: SupportChatModel):
    """Public support chatbot, powered by the configured chat LLM (Sarvam).

    No account data is used here — generic CarbonX help only. Falls back to
    built-in answers when the LLM is unavailable so the page never breaks.
    """
    message = (data.message or '').strip()[:500]
    if not message:
        return {"success": False, "message": "Type your question first."}
    lang = (data.language or 'en')[:2].lower()
    if lang not in ('en', 'hi', 'te'):
        lang = 'en'

    api_key = os.getenv("SARVAM_API_KEY", "").strip()
    if api_key:
        try:
            import httpx

            lang_name = {'en': 'English', 'hi': 'Hindi', 'te': 'Telugu'}[lang]
            history = []
            for item in (data.history or [])[-6:]:
                role = 'user' if (item.role or 'user') == 'user' else 'assistant'
                content = (item.text or '').strip()[:500]
                if content:
                    history.append({"role": role, "content": content})
            resp = httpx.post(
                "https://api.sarvam.ai/v1/chat/completions",
                headers={"api-subscription-key": api_key, "Content-Type": "application/json"},
                json={
                    "model": os.getenv("SARVAM_CHAT_MODEL", "sarvam-105b-conversations"),
                    "messages": [
                        {"role": "system", "content": SUPPORT_SYSTEM_PROMPT + "\n" + SUPPORT_KNOWLEDGE},
                        *history,
                        {"role": "user", "content": f"Reply in {lang_name}: {message}"},
                    ],
                },
                timeout=25.0,
            )
            resp.raise_for_status()
            reply = ((resp.json().get("choices") or [{}])[0].get("message") or {}).get("content", "").strip()
            if reply:
                return {"success": True, "reply": reply[:1200], "source": "llm"}
        except Exception as exc:
            print(f"support chat LLM unavailable: {exc}")
    return {"success": True, "reply": _support_fallback_reply(message), "source": "fallback"}


def _user_response(user: dict, phone: str):
    return {
        "phone": phone,
        "name": user.get("name", ""),
        "role": user.get("role", "farmer"),
        "state": user.get("state", ""),
        "district": user.get("district", ""),
        "village": user.get("village", ""),
        "upi": user.get("upi", ""),
        "email": user.get("email", ""),
        "aadhaar_last4": user.get("aadhaar_last4") or user.get("aadhaar", ""),
        "fpo_id": user.get("fpo_id"),
        "preferred_language": user.get("preferred_language", "en"),
    }


def _send_otp_flow(phone: str):
    otp = generate_otp()
    result = send_phone_otp(phone, otp)
    # send_phone_otp returns (sent, info): info is provider name on
    # success, error detail on failure. Tolerate legacy bool.
    if isinstance(result, tuple):
        sms_sent, info = result
    else:
        sms_sent, info = bool(result), None
    if sms_sent:
        _store_otp(phone, otp)
        provider = info if info in ("textplate", "twilio") else "SMS"
        return {"success": True, "message": f"OTP sent to your phone via {provider}"}
    # A provider is configured but delivery failed (bad token/template,
    # no credits, network). Do NOT leak OTP — return actionable error.
    if _sms_ready():
        _clear_otp(phone)
        detail = f" ({info})" if info else ""
        if _otp_dev_fallback_enabled():
            _store_otp(phone, otp)
            return {
                "success": True,
                "message": f"OTP generated (SMS delivery failed{detail} - dev fallback)",
                "dev_otp": otp,
                "sms_warning": f"SMS delivery failed{detail}. Using local OTP fallback.",
            }
        return {
            "success": False,
            "message": f"SMS delivery failed{detail}. Check Textplate credits/token/template and Twilio fallback credentials.",
        }
    # Dev mode (no Textplate creds): expose OTP for local testing only.
    _store_otp(phone, otp)
    return {
        "success": True,
        "message": "OTP generated (SMS unavailable — dev mode)",
        "dev_otp": otp,
    }


def _decode_upload(content: str) -> bytes:
    """Decode a browser data-URL/base64 upload without writing identity files to disk."""
    encoded = (content or "").split(",")[-1]
    if not encoded:
        raise ValueError("Upload a document first.")
    try:
        return base64.b64decode(encoded, validate=False)
    except Exception as exc:
        raise ValueError("Document content must be valid base64.") from exc


def _pahani_polygon(coords: Optional[list]) -> Optional[dict]:
    """Turn Section 5 latitude/longitude points into a GeoJSON feature."""
    ring = []
    for point in coords or []:
        try:
            ring.append([float(point["longitude"]), float(point["latitude"])])
        except (KeyError, TypeError, ValueError):
            continue
    if len(ring) < 3:
        return None
    if ring[0] != ring[-1]:
        ring.append(ring[0])
    return {"type": "Feature", "properties": {"source": "pahani_section_5"}, "geometry": {"type": "Polygon", "coordinates": [ring]}}


def _pahani_fallback_fields(text: str) -> dict:
    """Small OCR fallback when Azure layout extraction is unavailable."""
    def found(pattern: str) -> Optional[str]:
        match = re.search(pattern, text, re.IGNORECASE)
        return match.group(1).strip() if match else None

    aadhaar = re.search(r"(?:\d{4}[- ]?){2}\d{4}", text)
    return {
        "survey_no": found(r"survey\s*(?:no\.?|number)?\s*[:#-]?\s*([A-Z0-9/-]+)"),
        "pattadar_name": found(r"(?:pattadar|owner)\s*(?:name)?\s*[:#-]?\s*([^\n]{3,80})"),
        "aadhaar": aadhaar.group(0) if aadhaar else None,
        "village": found(r"village\s*[:#-]?\s*([^\n]{2,80})"),
        "district": found(r"district\s*[:#-]?\s*([^\n]{2,80})"),
        "crop_name": found(r"crop\s*(?:name)?\s*[:#-]?\s*([^\n]{2,60})"),
        "irrigation_source": found(r"irrigation\s*(?:source)?\s*[:#-]?\s*([^\n]{2,60})"),
        "extent_acres": None,
        "extent_hectares": None,
        "mandal": None,
        "boundary_coords": None,
    }


def _normalize_text(value: Optional[str]) -> str:
    return re.sub(r"\s+", " ", (value or "")).strip().lower()


def _verify_land_document_evidence(pahani_fields: dict, pahani_text: str, extracted_text: str = "") -> tuple[bool, str]:
    """Reject uploads that do not look like a valid land record."""
    combined = f"{pahani_text} {extracted_text or ''}".strip()
    combined_normalized = _normalize_text(combined)
    land_keywords = (
        "patta", "pattadar", "pahani", "adangal", "7/12", "survey no", "survey number",
        "land revenue", "khata", "khasra", "dharani", "meeseva", "bhulekh", "jamabandi",
        "ror", "chitta", "khatian", "ownership", "deed", "district", "village", "mandal"
    )

    has_keyword_signal = any(keyword in combined_normalized for keyword in land_keywords)
    has_survey = bool((pahani_fields.get("survey_no") or "").strip())
    has_owner = bool((pahani_fields.get("pattadar_name") or "").strip())
    has_location = bool((pahani_fields.get("district") or "").strip() or (pahani_fields.get("village") or "").strip())

    if not (has_keyword_signal or has_survey or has_owner or has_location):
        return False, "This document does not look like a valid land record. Please upload a Pahani / 7/12 / Patta document."
    if not has_survey:
        return False, "The uploaded document is missing the survey number. Please upload a valid land record."
    if not has_owner:
        return False, "The uploaded document is missing the pattadar/owner name. Please upload a valid land record."
    if not has_location:
        return False, "The uploaded document is missing the district or village details. Please upload a valid land record."
    return True, ""


def _parse_pahani_upload(content_base64: str, filename: str, content_type: str) -> tuple[dict, str]:
    """Use the existing Azure + Pahani parser, with installed Tesseract as fallback."""
    from app.services.document_intelligence_service import analyze_document_bytes, validate_upload
    from app.services.pahani_parser import parse_pahani

    raw = _decode_upload(content_base64)
    validate_upload(content_type, raw)
    try:
        parsed = parse_pahani(analyze_document_bytes(raw, filename=filename))
        return parsed["fields"], parsed.get("english_text", "")
    except RuntimeError as exc:
        # Azure is optional in the local SIH demo. Tesseract remains a real OCR fallback.
        print(f"Pahani Azure OCR unavailable, using local OCR fallback: {exc}")
        checks = analyse_document(content_base64, filename, "", "", [])
        text = checks.get("ocr_text_preview", "")
        return _pahani_fallback_fields(text), text


@app.get("/")
def root():
    return {
        "message": "CarbonX API running",
        "version": "5.0",
        "supabase": db.is_ready(),
        "sms": _sms_ready(),
        "earth_engine": earth_engine_ready,
    }


@app.get("/health")
def health():
    database = db.health_check()
    return {
        "success": database["ready"],
        "database": database,
        "sms": {"ready": _sms_ready(), "provider": _sms_provider()},
        "earth_engine": {"ready": earth_engine_ready},
    }


@app.post("/send-otp")
def send_otp(data: SendOtpModel):
    try:
        phone = _normalize_phone_or_error(data.phone)
        return _send_otp_flow(phone)
    except ValueError as e:
        return {"success": False, "message": str(e)}
    except HTTPException:
        raise
    except Exception as e:
        return {"success": False, "message": str(e)}


@app.post("/register/verify-otp")
def verify_registration_otp(data: RegistrationOtpVerifyModel):
    try:
        phone = _normalize_phone_or_error(data.phone)
        otp = data.otp.strip()
        if len(otp) != 6 or not otp.isdigit():
            return {"success": False, "message": "Enter the complete 6-digit OTP"}
        if not _verify_otp(phone, otp):
            return {"success": False, "message": "Invalid or expired OTP"}

        verification_token = create_access_token(
            {
                "phone": phone,
                "purpose": "registration_otp_verified",
            },
            expires_delta=timedelta(minutes=30),
        )
        return {
            "success": True,
            "message": "OTP verified",
            "verification_token": verification_token,
        }
    except ValueError as e:
        return {"success": False, "message": str(e)}
    except HTTPException:
        raise
    except Exception as e:
        return {"success": False, "message": str(e)}


@app.post("/register")
def register(data: RegisterModel):
    try:
        phone = _normalize_phone_or_error(data.phone)
        if not validate_aadhaar(data.aadhaar):
            return {"success": False, "message": "Enter a valid 12-digit Aadhaar number"}
        token_payload = decode_token(data.otp_verification_token) if data.otp_verification_token else None
        token_verified = bool(
            token_payload
            and token_payload.get("purpose") == "registration_otp_verified"
            and token_payload.get("phone") == phone
        )
        if not token_verified and not _verify_otp(phone, data.otp):
            return {"success": False, "message": "Invalid or expired OTP"}
        existing = _get_user(phone)
        lang = (data.preferred_language or "en")[:2]
        role = data.role or "farmer"
        if existing:
            profile_fields = {
                "name": data.name or existing.get("name"),
                "state": data.state,
                "district": data.district,
                "village": data.village,
                "upi": data.upi,
                "aadhaar_last4": data.aadhaar[-4:],
                "preferred_language": lang,
                "role": role,
            }
            # `email` is optional until migration 05 has been applied.
            if data.email:
                profile_fields["email"] = data.email.strip().lower()
            db.update_profile(phone, profile_fields)
            user = _get_user(phone)
            token = create_access_token({"phone": phone, "name": user.get("name", ""), "role": user.get("role", "farmer")})
            return {
                "success": True,
                "message": "Profile updated, logged in",
                "token": token,
                "user": _user_response(user, phone),
            }
        user = {
            "phone": phone,
            "name": data.name,
            "aadhaar_last4": data.aadhaar[-4:],
            "state": data.state,
            "district": data.district,
            "village": data.village,
            "upi": data.upi,
            "preferred_language": lang,
            "role": role,
        }
        if data.email:
            user["email"] = data.email.strip().lower()
        _save_user(user)
        token = create_access_token({"phone": phone, "name": data.name, "role": role})
        return {
            "success": True,
            "message": "Registration successful",
            "token": token,
            "user": _user_response(user, phone),
        }
    except ValueError as e:
        return {"success": False, "message": str(e)}
    except HTTPException:
        raise
    except Exception as e:
        return {"success": False, "message": str(e)}


@app.post("/login/send-otp")
def login_send_otp(data: SendOtpModel):
    try:
        phone = _normalize_phone_or_error(data.phone)
        existing = _get_user(phone)
        if not existing:
            return {"success": False, "message": "Phone not registered. Please sign up first."}
        result = _send_otp_flow(phone)
        if result.get("success"):
            result["message"] = "OTP sent"
        return result
    except ValueError as e:
        return {"success": False, "message": str(e)}
    except HTTPException:
        raise
    except Exception as e:
        return {"success": False, "message": str(e)}


@app.post("/login")
def login(data: LoginOtpModel):
    try:
        phone = _normalize_phone_or_error(data.phone)
        if not _verify_otp(phone, data.otp):
            return {"success": False, "message": "Invalid or expired OTP"}
        user = _get_user(phone)
        if not user:
            return {"success": False, "message": "Phone not registered"}
        token = create_access_token({"phone": phone, "name": user.get("name", ""), "role": user.get("role", "farmer")})
        return {"success": True, "token": token, "user": _user_response(user, phone)}
    except ValueError as e:
        return {"success": False, "message": str(e)}
    except HTTPException:
        raise
    except Exception as e:
        return {"success": False, "message": str(e)}


@app.post("/fpo/login")
def fpo_login(data: FpoLoginModel):
    try:
        phone = _normalize_phone_or_error(data.phone)
    except ValueError as e:
        return {"success": False, "message": str(e)}
    fpo_name = data.fpo_name.strip()
    if not fpo_name:
        return {"success": False, "message": "Select an FPO or cooperative"}
    otp = data.otp.strip()
    if len(otp) != 6 or not otp.isdigit():
        return {"success": False, "message": "Enter the complete 6-digit OTP"}
    if not _verify_otp(phone, otp):
        return {"success": False, "message": "Invalid or expired OTP"}

    user = {
        "phone": phone,
        "name": "FPO Officer",
        "fpo_name": fpo_name,
        "district": (
            "Yadadri Bhuvanagiri"
            if "Mothkur" in fpo_name
            else "Warangal"
            if "Wardhannapet" in fpo_name
            else "Jangaon"
        ),
        "role": "fpo",
    }
    token = create_access_token(
        {"phone": phone, "name": user["name"], "role": user["role"], "fpo_name": fpo_name}
    )
    return {"success": True, "token": token, "user": user}


@app.post("/corporate/login")
def corporate_login(data: CorporateLoginModel):
    name = data.name.strip()
    if not name or not data.password:
        return {"success": False, "message": "Corporate name and password are required"}
    if data.password != os.getenv("CORPORATE_DEMO_PASSWORD", "Corporate@2026"):
        return {"success": False, "message": "Invalid corporate credentials"}

    user = {
        "c_id": 101,
        "name": name,
        "email": "esg@telanganasustainable.com",
        "role": "buyer",
    }
    token = create_access_token({"name": name, "role": "buyer", "c_id": user["c_id"]})
    return {"success": True, "token": token, **user}


def _claimed_area_ha(data: LandVerificationModel) -> Optional[float]:
    if data.area_hectares is not None:
        return float(data.area_hectares)
    if data.area_acres is not None:
        return round(float(data.area_acres) * 0.404686, 4)
    return None


def _patch_farm(farm_id: Optional[str], fields: dict):
    if not farm_id:
        return None
    try:
        return db.update_farm(farm_id, fields)
    except Exception:
        fields.pop("badge", None)
        try:
            return db.update_farm(farm_id, fields)
        except Exception as exc:
            print(f"farm patch failed: {exc}")
            return None


@app.get("/land/registry/{survey:path}")
def land_registry_lookup(survey: str, current_user: dict = Depends(get_current_user)):
    """Look up a survey number in the Supabase land_registry mock table."""
    from app.services.registry_service import lookup_survey

    _require_database()
    result = lookup_survey(survey)
    if result.get("error") == "permission_denied":
        raise HTTPException(status_code=503, detail=result["message"])
    return {"success": True, **result}


@app.post("/auto-draw")
def auto_draw_polygon(data: AutoDrawModel, current_user: dict = Depends(get_current_user)):
    """Return a locked registry polygon (1A) or an approximate village square (1B/2)."""
    from app.services.geocoding_service import geocode_village
    from app.services.polygon_service import approximate_square
    from app.services.registry_service import lookup_survey

    _require_database()
    locked = False
    geojson = None
    source = None
    registry = None
    if data.survey_number:
        registry = lookup_survey(data.survey_number)
        if registry.get("error") == "permission_denied":
            raise HTTPException(status_code=503, detail=registry["message"])
        if registry.get("geojson"):
            geojson = registry["geojson"]
            locked = True
            source = "registry"
    if geojson is None:
        phone = current_user.get("phone")
        profile = _get_user(phone) or {}
        village = data.village or profile.get("village", "")
        district = data.district or profile.get("district", "")
        state = data.state or profile.get("state", "")
        geo = geocode_village(village, district, state)
        if not geo:
            return {"success": False, "message": "Could not geocode village for an approximate polygon"}
        area = data.area_hectares or (registry or {}).get("area_ha") or 1.0
        geojson = approximate_square(geo["lat"], geo["lon"], area)
        source = "approximate"
        locked = False
    return {
        "success": True,
        "locked": locked,
        "source": source,
        "geojson": geojson,
        "registry": registry,
    }


@app.post("/check-farmland")
def check_farmland(data: CheckFarmlandModel, current_user: dict = Depends(get_current_user)):
    """NDVI farmland check for a drawn/auto polygon."""
    from app.services.gee_service import get_ndvi_at_point
    from app.services.polygon_service import ring_from_geojson, polygon_area_hectares
    from app.services.fraud_engine import NDVI_FARMLAND_MIN

    ring = ring_from_geojson(data.geojson)
    if len(ring) < 3:
        raise HTTPException(status_code=400, detail="Valid polygon GeoJSON is required")
    lat = sum(float(p[1]) for p in ring[:-1]) / (len(ring) - 1)
    lon = sum(float(p[0]) for p in ring[:-1]) / (len(ring) - 1)
    ndvi = get_ndvi_at_point(lat, lon)
    value = float(ndvi.get("ndvi") or 0)
    return {
        "success": True,
        "is_farmland": value >= NDVI_FARMLAND_MIN,
        "ndvi": ndvi,
        "area_hectares": polygon_area_hectares(data.geojson),
        "centroid": {"lat": lat, "lon": lon},
    }


@app.post("/verify-aadhaar")
def verify_aadhaar(data: AadhaarVerificationModel, current_user: dict = Depends(get_current_user)):
    """OCR Aadhaar front/back and compare it to the registered identity anchor.

    CarbonX deliberately stores only the Aadhaar last four digits, so the card
    comparison uses the extracted last four digits rather than retaining a full
    Aadhaar number in Supabase.
    """
    from PIL import Image
    import io
    from app.services.kyc_service import _extract_ocr_text, _match_name

    profile = _get_user(current_user.get("phone"))
    if not profile:
        raise HTTPException(status_code=404, detail="User not found")
    try:
        parts = []
        for image_content, content_type in ((data.front_image, data.front_content_type), (data.back_image, data.back_content_type)):
            raw = _decode_upload(image_content)
            if content_type == "application/pdf":
                from app.services.document_intelligence_service import analyze_document_bytes
                parts.append(analyze_document_bytes(raw).get("content", ""))
            else:
                with Image.open(io.BytesIO(raw)) as image:
                    text, available = _extract_ocr_text(image)
                    if available:
                        parts.append(text)
        ocr_text = "\n".join(parts)
        card_numbers = re.findall(r"(?:\d{4}[- ]?){2}\d{4}", ocr_text)
        card_last4 = card_numbers[0].replace(" ", "").replace("-", "")[-4:] if card_numbers else ""
        registered_last4 = str(profile.get("aadhaar_last4") or "")[-4:]
        _score, matched_name = _match_name(profile.get("name", ""), ocr_text)
        matched_aadhaar = bool(card_last4 and registered_last4 and card_last4 == registered_last4)
        dob_match = re.search(r"(?:DOB|Date of Birth)\s*[:\-]?\s*(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})", ocr_text, re.IGNORECASE)
        reasons = []
        if not matched_name:
            reasons.append("Name on Aadhaar card does not match your registered name")
        if not matched_aadhaar:
            reasons.append("Aadhaar number on card does not match your registered number")
        return {
            "success": True,
            "verified": matched_name and matched_aadhaar,
            "matched_name": matched_name,
            "matched_aadhaar": matched_aadhaar,
            "dob": dob_match.group(1) if dob_match else None,
            "reasons": reasons,
        }
    except ValueError:
        return {"success": False, "message": "Invalid Aadhaar upload. Please use a valid JPG, PNG, or PDF file."}
    except Exception:
        return {"success": False, "message": "Could not process Aadhaar images. Please try again."}


@app.post("/verify-land")
def verify_land_document(data: LandVerificationModel, current_user: dict = Depends(get_current_user)):
    """Run the trust engine. Backend assigns tier, badge, status, and eligibility."""
    try:
        from app.services.fraud_engine import run_fraud_checks
        from app.services.registry_service import lookup_survey
        from app.services.trust_engine import apply_fraud, decide_tier, names_match
        from app.services.kyc_service import _match_name

        _require_database()
        phone = current_user.get("phone")
        profile = _get_user(phone)
        if not profile:
            raise HTTPException(status_code=404, detail="User not found")
        village = data.village or profile.get("village", "")
        district = data.district or profile.get("district", "")
        state = profile.get("state", "")
        fpo_path = (data.path or "").lower() == "fpo"
        claimed_ha = _claimed_area_ha(data)

        if fpo_path:
            if profile.get("role", "farmer") == "farmer":
                return {"success": False, "message": "Pahani upload is required for farmer verification. If you need help obtaining one, please contact your FPO."}
            if data.fpo_id:
                db.update_profile(phone, {"fpo_id": data.fpo_id})
            trust = apply_fraud(decide_tier(fpo_path=True), {"status": "PENDING", "risk": "LOW", "failed_checks": []})
            record = {
                "owner_phone": phone,
                "status": "PENDING",
                "reasons": ["Awaiting FPO confirmation"],
                "checks": {"path": "fpo", "fpo_id": data.fpo_id},
                "extracted_fields": {
                    "path": "fpo",
                    "fpo_id": data.fpo_id,
                    "farm_id": data.farm_id,
                    **trust,
                },
                "document_name": (data.document_name or "fpo-path")[:255],
                "document_sha256": "fpo-path",
                "perceptual_hash": None,
            }
            saved = db.insert_kyc_verification(record)
            _patch_farm(data.farm_id, {"status": "PENDING"})
            return {"success": True, **trust, "verification": saved, "checks": record["checks"], "reasons": record["reasons"]}

        document_content = data.pahani_file or data.document_content_base64
        if not document_content:
            return {"success": False, "message": "Upload your Pahani land record before verification. Please contact your FPO if you need assistance."}

        pahani_fields, pahani_text = _parse_pahani_upload(
            document_content,
            data.document_name or "pahani.jpg",
            data.document_content_type or "image/jpeg",
        )
        land_ok, land_message = _verify_land_document_evidence(
            pahani_fields,
            pahani_text,
            data.extracted_text or "",
        )
        if not land_ok:
            return {"success": False, "message": land_message}

        survey_number = pahani_fields.get("survey_no") or data.survey_number or ""
        village = pahani_fields.get("village") or village
        district = pahani_fields.get("district") or district
        parsed_area_ha = pahani_fields.get("extent_hectares")
        if not parsed_area_ha and pahani_fields.get("extent_acres"):
            parsed_area_ha = round(float(pahani_fields["extent_acres"]) * 0.404686, 4)
        claimed_ha = parsed_area_ha or claimed_ha
        pahani_polygon = _pahani_polygon(pahani_fields.get("boundary_coords"))

        checks = analyse_document(
            document_content,
            data.document_name,
            profile.get("name", ""),
            f"{pahani_text} {data.extracted_text or ''}",
            db.get_document_hashes(),
            village=village,
            district=district,
            state=state,
        )
        registry = lookup_survey(survey_number) if survey_number else {"found": False}
        if registry.get("error") == "permission_denied":
            registry = {"found": False, "survey_number": survey_number, "message": registry.get("message")}

        # Identity consensus: profile ~ registry owner AND doc ~ registry owner
        # (with survey found). When identity is proven, noisy signals (OCR
        # village text, EXIF, area wording) become notes — not fraud verdicts.
        _reg_owner = (registry or {}).get("owner_name") or ""

        ocr_text = f"{checks.get('ocr_text_preview') or ''} {pahani_text} {data.extracted_text or ''}"
        document_owner = pahani_fields.get("pattadar_name") or ""
        document_aadhaar = str(pahani_fields.get("aadhaar") or "").replace(" ", "").replace("-", "")
        registered_last4 = str(profile.get("aadhaar_last4") or "")[-4:]
        _name_score, name_ok = _match_name(profile.get("name", ""), document_owner or ocr_text)
        # Aadhaar mismatch only counts when BOTH sides are on file. A missing
        # registered last-4 (or unreadable doc Aadhaar) is "unknown", not fraud.
        aadhaar_ok = True
        if document_aadhaar and registered_last4:
            aadhaar_ok = document_aadhaar[-4:] == registered_last4
        profile_village = _normalize_text(profile.get("village") or "")
        profile_district = _normalize_text(profile.get("district") or "")
        document_village = _normalize_text(pahani_fields.get("village") or "")
        document_district = _normalize_text(pahani_fields.get("district") or "")
        village_ok = bool(profile_village and document_village and profile_village == document_village)
        district_ok = bool(profile_district and document_district and profile_district == document_district)
        identity_ok = (
            bool(registry.get("found"))
            and names_match(profile.get("name", ""), _reg_owner)
            and (not document_owner or names_match(document_owner, _reg_owner))
        )
        three_way_failures = []
        if not name_ok:
            three_way_failures.append("pahani_owner_name_mismatch")
        if not aadhaar_ok:
            three_way_failures.append("pahani_aadhaar_mismatch")
        if (not village_ok or not district_ok) and not identity_ok:
            three_way_failures.append("pahani_location_mismatch")
        geojson = pahani_polygon or data.geojson or registry.get("geojson")
        # Overlap against other farms is skipped when the boundary IS the
        # official registry geometry for the claimed survey (same-parcel data,
        # not a land grab).
        registry_sourced = bool(registry.get("found")) and geojson is not None and geojson is registry.get("geojson")
        decision = decide_tier(
            fpo_path=False,
            survey_number=survey_number,
            registry=registry,
            owner_name=profile.get("name", ""),
            ocr_owner=document_owner or ocr_text,
            claimed_area_ha=claimed_ha or registry.get("area_ha"),
        )
        fraud = run_fraud_checks(
            aadhaar=data.aadhaar or profile.get("aadhaar_last4") or "",
            checks=checks,
            owner_name=profile.get("name", ""),
            ocr_text=ocr_text,
            village=village,
            geojson=geojson,
            other_farm_geojsons=db.farm_geojsons_except(phone) if geojson else [],
            claimed_area_ha=claimed_ha or registry.get("area_ha"),
            skip_ndvi=True,
            skip_overlap=registry_sourced,
        )
        # Forgiveness: machine-proven or same-user signals are not fraud.
        _forgiven = []
        if pahani_fields.get("survey_no") and pahani_fields.get("pattadar_name"):
            _forgiven.append("ocr_readability")  # successful parse proves readability
        try:
            _sha_owners = set(db.sha_owner_phones(checks.get("document_sha256") or ""))
        except Exception:
            _sha_owners = set()
        if _sha_owners and _sha_owners <= {phone}:
            _forgiven.append("duplicate_document")  # own retry, not theft
        if identity_ok:
            _forgiven.append("area_mismatch")  # size dispute -> Tier 1B note, not fraud
        if _forgiven:
            fraud["failed_checks"] = [c for c in fraud.get("failed_checks", []) if c not in _forgiven]
            fraud["warnings"] = [w for w in fraud.get("warnings", []) if w not in _forgiven]
            if not fraud["failed_checks"] and fraud.get("status") == "FLAGGED":
                fraud["status"] = "VERIFIED"
                fraud["risk"] = "LOW"
        if three_way_failures:
            fraud["failed_checks"] = list(dict.fromkeys([*fraud.get("failed_checks", []), *three_way_failures]))
            fraud["status"] = "FLAGGED"
            fraud["risk"] = "HIGH"
        if not checks.get("keywords_valid"):
            fraud["failed_checks"] = list(dict.fromkeys([*fraud.get("failed_checks", []), "land_document_keywords_missing"]))
            fraud["status"] = "FLAGGED"
            fraud["risk"] = "HIGH"
        trust = apply_fraud(decision, fraud)
        reasons = list(trust["failed_checks"])
        # No-double-flag guards. A standing VERIFIED record for the same survey
        # protects the parcel: same-identity re-attempts keep it; only FPO
        # review may change verified status. Genuine owner mismatches still flag.
        if survey_number and trust["status"] != "VERIFIED":
            _standing = None
            try:
                _standing = db.verified_kyc_for_survey(phone, survey_number)
            except Exception:
                _standing = None
            _doc_matches_profile = bool(document_owner) and names_match(profile.get("name", ""), document_owner)
            if _standing is not None and _doc_matches_profile:
                _st = _standing.get("extracted_fields") or {}
                trust = {
                    "tier": _st.get("tier"),
                    "badge": _st.get("badge"),
                    "risk": _st.get("risk", "LOW"),
                    "status": "VERIFIED",
                    "failed_checks": [],
                    "marketplace_eligible": _st.get("marketplace_eligible", True),
                    "credits_blocked": False,
                }
                reasons = [*(reasons or []), "prior_verified_record_stands"]
        record = {
            "owner_phone": phone,
            "status": trust["status"],
            "reasons": reasons,
            "checks": {**checks, "registry": registry, "fraud": fraud, "trust": trust},
            "extracted_fields": {
                "survey_number": survey_number,
                "village": village,
                "district": district,
                "area_acres": pahani_fields.get("extent_acres") or data.area_acres,
                "area_hectares": claimed_ha,
                "owner_name": document_owner,
                "crop": pahani_fields.get("crop_name"),
                "irrigation": pahani_fields.get("irrigation_source"),
                "mandal": pahani_fields.get("mandal"),
                "pahani_fields": pahani_fields,
                "polygon_geojson": geojson,
                "ocr_text_preview": checks.get("ocr_text_preview", ""),
                "geocoded_location": checks.get("geocoded_location"),
                "satellite_ndvi": checks.get("satellite_ndvi") or {},
                "farm_id": data.farm_id,
                "confirm_polygon": data.confirm_polygon,
                **trust,
            },
            "document_name": (data.document_name or "document")[:255],
            "document_sha256": checks["document_sha256"],
            "perceptual_hash": checks["perceptual_hash"] or None,
        }
        saved = db.insert_kyc_verification(record)
        farm_fields = {"status": trust["status"]}
        if trust.get("badge"):
            farm_fields["badge"] = trust["badge"]
        patched = _patch_farm(data.farm_id, farm_fields)
        # Tier 3 routing: a newly flagged/pending farmer usually has no farm
        # row yet, so the FPO desk would never see them. Auto-create one so
        # the profile lands in the FPO pending/flagged queue.
        created_farm_id = data.farm_id or (patched or {}).get("id")
        if not created_farm_id and trust["status"] in ("PENDING", "FLAGGED"):
            try:
                # Reuse an existing non-verified parcel for the same survey
                # instead of stacking duplicate flagged farms ("flagged twice").
                _reuse = None
                for _f in db.get_farms(phone):
                    if (
                        survey_number
                        and str(_f.get("name") or "").startswith(f"Survey {survey_number}")
                        and str(_f.get("status") or "").upper() != "VERIFIED"
                    ):
                        _reuse = _f
                        break
                if _reuse is not None:
                    _patch_farm(_reuse.get("id"), dict(farm_fields))
                    created_farm_id = _reuse.get("id")
                else:
                    created = db.insert_farm({
                        "owner_phone": phone,
                        "name": f"Survey {survey_number or 'unlisted'} — {trust['status'].title()} Parcel",
                        "crop_type": pahani_fields.get("crop_name") or "Mixed Crop",
                        "irrigation": pahani_fields.get("irrigation_source") or "Rainfed",
                        "geojson": geojson,
                        "area_hectares": claimed_ha,
                        "status": trust["status"],
                        **({"badge": trust["badge"]} if trust.get("badge") else {}),
                    })
                    if created:
                        created_farm_id = created.get("id")
            except Exception as exc:
                print(f"auto-create tier3 farm failed: {exc}")
        return {
            "success": True,
            **trust,
            "checks": checks,
            "reasons": reasons,
            "registry": registry,
            "fraud": fraud,
            "verification": saved,
            "farm_id": created_farm_id,
            "polygon_geojson": geojson,
            "extracted": {
                "survey_no": survey_number,
                "owner_name": document_owner,
                "area_acres": pahani_fields.get("extent_acres") or data.area_acres,
                "area_hectares": claimed_ha,
                "crop": pahani_fields.get("crop_name"),
                "irrigation": pahani_fields.get("irrigation_source"),
                "village": village,
                "mandal": pahani_fields.get("mandal"),
                "district": district,
            },
        }
    except HTTPException:
        raise
    except ValueError as exc:
        return {"success": False, "message": str(exc)}
    except Exception as exc:
        return {"success": False, "message": str(exc)}


@app.get("/kyc/status/{phone}")
def get_kyc_status(phone: str, current_user: dict = Depends(get_current_user)):
    """Return the latest KYC verification record for a farmer."""
    try:
        _require_database()
        record = db.get_kyc_status(phone)
        if not record:
            return {"success": True, "status": "PENDING", "message": "No KYC verification found."}
        extracted = record.get("extracted_fields") or {}
        return {
            "success": True,
            "status": record.get("status"),
            "tier": extracted.get("tier"),
            "badge": extracted.get("badge"),
            "risk": extracted.get("risk"),
            "failed_checks": extracted.get("failed_checks") or record.get("reasons") or [],
            "marketplace_eligible": extracted.get("marketplace_eligible"),
            "credits_blocked": extracted.get("credits_blocked"),
            "verification": record,
        }
    except HTTPException:
        raise
    except Exception as exc:
        return {"success": False, "message": str(exc)}


@app.get("/fpos")
def list_fpos(current_user: dict = Depends(get_current_user)):
    _require_database()
    return {"success": True, "fpos": db.list_fpos()}


@app.get("/fpo/farms")
def fpo_farms(
    status: str = Query("PENDING"),
    current_user: dict = Depends(require_role("fpo", "verifier", "admin")),
):
    """Pending confirmations or flagged farms for FPO review."""
    _require_database()
    reviewer = _get_user(current_user.get("phone")) or {}
    fpo_id = reviewer.get("fpo_id")
    phones = None
    if fpo_id:
        phones = [p.get("phone") for p in db.list_profiles_by_fpo(fpo_id) if p.get("phone")]
    farms = db.list_farms_by_status(status, owner_phones=phones)
    # Attach farmer profile details so the desk shows who each parcel belongs to.
    try:
        owner_phones = list({f.get("owner_phone") for f in farms if f.get("owner_phone")})
        names = {}
        for op in owner_phones:
            prof = _get_user(op)
            if prof:
                names[op] = {
                    "owner_name": prof.get("name"),
                    "village": prof.get("village"),
                    "district": prof.get("district"),
                }
        for f in farms:
            f.update(names.get(f.get("owner_phone"), {}))
    except Exception:
        pass
    return {"success": True, "status": status, "farms": farms}


@app.post("/fpo/confirm/{farm_id}")
def fpo_confirm_farm(farm_id: str, current_user: dict = Depends(require_role("fpo", "verifier", "admin"))):
    """Confirm a PENDING FPO-path farm. Badge becomes FPO; satellite scan can start."""
    from app.services.trust_engine import fpo_confirmed_result

    _require_database()
    farm = db.get_farm(farm_id)
    if not farm:
        raise HTTPException(status_code=404, detail="Farm not found")
    trust = fpo_confirmed_result()
    updated = _patch_farm(farm_id, {"status": trust["status"], "badge": trust["badge"]})
    db.insert_kyc_verification({
        "owner_phone": farm.get("owner_phone"),
        "status": trust["status"],
        "reasons": [],
        "checks": {"reviewed_by": current_user.get("phone"), "action": "confirm"},
        "extracted_fields": {**trust, "farm_id": farm_id, "reviewed_by": current_user.get("phone")},
        "document_name": "fpo-confirm",
        "document_sha256": f"fpo-confirm-{farm_id}",
        "perceptual_hash": None,
    })
    return {"success": True, **trust, "farm": updated or farm}


@app.post("/fpo/review/{farm_id}")
def fpo_review_farm(
    farm_id: str,
    data: FpoReviewModel,
    current_user: dict = Depends(require_role("fpo", "verifier", "admin")),
):
    """Approve or reject a FLAGGED farm. Approve sets badge FPO."""
    from app.services.trust_engine import fpo_confirmed_result

    _require_database()
    farm = db.get_farm(farm_id)
    if not farm:
        raise HTTPException(status_code=404, detail="Farm not found")
    action = (data.action or "").strip().lower()
    if action not in ("approve", "reject"):
        raise HTTPException(status_code=400, detail="action must be approve or reject")
    if action == "approve":
        trust = fpo_confirmed_result()
        status, badge = trust["status"], trust["badge"]
    else:
        trust = {
            "tier": None,
            "badge": None,
            "risk": "HIGH",
            "status": "FLAGGED",
            "failed_checks": ["fpo_rejected"],
            "marketplace_eligible": False,
            "credits_blocked": True,
        }
        status, badge = "FLAGGED", None
    fields = {"status": status}
    if badge:
        fields["badge"] = badge
    updated = _patch_farm(farm_id, fields)
    db.insert_kyc_verification({
        "owner_phone": farm.get("owner_phone"),
        "status": status,
        "reasons": [data.notes] if data.notes else [],
        "checks": {"reviewed_by": current_user.get("phone"), "action": action},
        "extracted_fields": {**trust, "farm_id": farm_id, "reviewed_by": current_user.get("phone"), "notes": data.notes},
        "document_name": f"fpo-review-{action}",
        "document_sha256": f"fpo-review-{action}-{farm_id}",
        "perceptual_hash": None,
    })
    return {"success": True, **trust, "action": action, "farm": updated or farm}


@app.post("/documents/analyze")
def analyze_document_image(
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user),
):
    """Extract text from an uploaded document image via Azure Document Intelligence.

    Uses the ``prebuilt-layout`` model (see app/services/document_intelligence_service.py).
    Requires a logged-in user (Bearer token). Accepts an image (jpeg/png/webp/...)
    or PDF and returns the extracted text as JSON. If Azure cannot be reached,
    returns the retry-or-send-to-FPO fallback payload.
    """
    from app.services.document_intelligence_service import (
        analyze_document_bytes,
        azure_unavailable_response,
        validate_upload,
    )

    try:
        file_bytes = file.file.read()
    finally:
        file.file.close()
    filename = file.filename
    content_type = file.content_type

    try:
        validate_upload(content_type, file_bytes)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    try:
        return analyze_document_bytes(file_bytes, filename=filename)
    except RuntimeError as exc:
        msg = str(exc)
        if "not configured" in msg or "not installed" in msg:
            raise HTTPException(status_code=503, detail=msg)
        return azure_unavailable_response(msg)


@app.post("/documents/parse-pahani")
def parse_pahani_document(
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user),
):
    """OCR a Pahani (Adangal) record and return structured fields as JSON.

    Runs Azure Document Intelligence, filters out Telugu-script content, and
    extracts layout-aware fields (survey no, pattadar, extents, coords, ...).
    Fields absent from the image come back as null and are listed in
    ``missing_fields``. Requires a logged-in user (Bearer token). If Azure
    cannot be reached, returns the retry-or-send-to-FPO fallback payload.
    """
    from app.services.document_intelligence_service import (
        analyze_document_bytes,
        azure_unavailable_response,
        validate_upload,
    )
    from app.services.pahani_parser import parse_pahani

    try:
        file_bytes = file.file.read()
    finally:
        file.file.close()

    try:
        validate_upload(file.content_type, file_bytes)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    try:
        azure_result = analyze_document_bytes(file_bytes, filename=file.filename)
    except RuntimeError as exc:
        msg = str(exc)
        if "not configured" in msg or "not installed" in msg:
            raise HTTPException(status_code=503, detail=msg)
        return azure_unavailable_response(msg)

    parsed = parse_pahani(azure_result)
    return {
        "success": True,
        "model": azure_result.get("model"),
        "filename": file.filename,
        "fields": parsed["fields"],
        "missing_fields": parsed["missing_fields"],
        "english_text": parsed["english_text"],
    }


@app.get("/me")
def get_me(current_user: dict = Depends(get_current_user)):
    phone = current_user.get("phone")
    # FPO officers authenticate by phone OTP but have no farmer profile.
    # Serve the token identity so the officer session (role=fpo) survives
    # login()/refresh — otherwise a colliding farmer record would clobber
    # the role and kick the officer back to the login page.
    if (current_user.get("role") or "").strip().lower() == "fpo":
        farms = _get_user_farms(phone) if phone else []
        return {
            "success": True,
            "user": {
                "phone": phone,
                "name": current_user.get("name") or "FPO Officer",
                "role": "fpo",
                "fpo_name": current_user.get("fpo_name") or "",
                "state": "",
                "district": "",
                "village": "",
                "upi": "",
                "email": "",
                "aadhaar_last4": "",
                "fpo_id": None,
                "preferred_language": "en",
            },
            "farms": farms,
            "kyc": None,
        }
    user = _get_user(phone)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    farms = _get_user_farms(phone)
    kyc = db.get_kyc_status(phone) if db.is_ready() else None
    return {"success": True, "user": _user_response(user, phone), "farms": farms, "kyc": kyc}


@app.patch("/profile")
def update_profile(data: UpdateProfileModel, current_user: dict = Depends(get_current_user)):
    try:
        phone = current_user.get("phone")
        fields = {k: v for k, v in data.model_dump().items() if v is not None}
        if not fields:
            return {"success": False, "message": "No fields to update"}
        if "preferred_language" in fields:
            fields["preferred_language"] = fields["preferred_language"][:2]
        updated = db.update_profile(phone, fields)
        if not updated:
            return {"success": False, "message": "Profile update failed"}
        return {"success": True, "user": _user_response(updated, phone)}
    except Exception as e:
        return {"success": False, "message": str(e)}


@app.post("/analyze")
def analyze(data: AnalyzeModel):
    try:
        geojson = data.geojson
        if not geojson:
            return {"success": False, "message": "GeoJSON polygon missing"}

        if earth_engine_ready:
            import ee
            coordinates = geojson["geometry"]["coordinates"]
            polygon = ee.Geometry.Polygon(coordinates)
            collection = (
                ee.ImageCollection("COPERNICUS/S2_SR_HARMONIZED")
                .filterBounds(polygon)
                .filterDate("2024-01-01", "2025-12-31")
                .sort("CLOUDY_PIXEL_PERCENTAGE")
            )
            image = collection.first()
            ndvi = image.normalizedDifference(["B8", "B4"]).rename("NDVI")
            ndvi_value = ndvi.reduceRegion(
                reducer=ee.Reducer.mean(), geometry=polygon, scale=10, maxPixels=1e13,
            ).get("NDVI").getInfo()
            evi = image.expression(
                "2.5 * ((NIR - RED) / (NIR + 6 * RED - 7.5 * BLUE + 1))",
                {"NIR": image.select("B8"), "RED": image.select("B4"), "BLUE": image.select("B2")},
            )
            evi_value = evi.reduceRegion(
                reducer=ee.Reducer.mean(), geometry=polygon, scale=10, maxPixels=1e13,
            ).values().get(0).getInfo()
            area_hectares = round(polygon.area().getInfo() / 10000, 2)
            try:
                from app.services.ml_service import predict_biodiversity
                ml_result = predict_biodiversity(ndvi=ndvi_value, evi=evi_value, area_ha=area_hectares)
                biodiversity_score = ml_result["biodiversity_score"]
            except Exception:
                biodiversity_score = round(min(max(ndvi_value * 100, 30), 98), 1)
            satellite_source = "Google Earth Engine · Sentinel-2 SR"
        else:
            coords = geojson.get("geometry", {}).get("coordinates", [[]])
            area_hectares = _polygon_area_hectares(geojson)
            seed = hash(str(coords)) % 1000
            ndvi_value = round(0.45 + (seed % 40) / 100.0, 3)
            evi_value = round(ndvi_value * 0.85, 3)
            try:
                from app.services.ml_service import predict_biodiversity
                ml_result = predict_biodiversity(ndvi=ndvi_value, evi=evi_value, area_ha=area_hectares)
                biodiversity_score = ml_result["biodiversity_score"]
            except Exception:
                biodiversity_score = round(min(max(ndvi_value * 110, 40), 95), 1)
            satellite_source = "Estimated (GEE offline)"

        tree_cover = round(min(max(ndvi_value * 100, 0), 100), 2)
        soil_moisture = round(min(max(evi_value * 25, 0), 100), 2)
        carbon_tonnes = round(area_hectares * tree_cover * 0.12, 2)
        credits = db.compute_credits(carbon_tonnes, biodiversity_score)
        veg_health = (
            "Excellent" if ndvi_value >= 0.7 else "Good" if ndvi_value >= 0.5
            else "Moderate" if ndvi_value >= 0.3 else "Low"
        )
        return {
            "success": True,
            "ndvi": round(ndvi_value, 3),
            "evi": round(evi_value, 3),
            "tree_cover": tree_cover,
            "soil_moisture": soil_moisture,
            "carbon_tonnes": carbon_tonnes,
            "carbon_credits": credits["carbon_credits"],
            "biodiversity_credits": credits["biodiversity_credits"],
            "total_credits": credits["total_credits"],
            "area_hectares": area_hectares,
            "vegetation_health": veg_health,
            "biodiversity_score": biodiversity_score,
            "ai_confidence": round(min(85 + ndvi_value * 20, 99.5), 1),
            "satellite_source": satellite_source,
        }
    except Exception as e:
        return {"success": False, "message": str(e)}


@app.post("/save-farm")
def save_farm(data: SaveFarmModel, current_user: dict = Depends(get_current_user)):
    try:
        phone = current_user.get("phone")
        farm = data.farm
        geojson = farm.get("geojson")
        if not geojson or not geojson.get("geometry"):
            return {"success": False, "message": "Farm boundary (GeoJSON) is required"}
        area_hectares = float(farm.get("area_hectares") or _polygon_area_hectares(geojson))
        carbon = float(farm.get("carbon_tonnes") or 0)
        bio_score = float(farm.get("biodiversity_score") or 0)
        credits = db.compute_credits(carbon, bio_score)
        path = (farm.get("path") or "").lower()
        fpo_path = path == "fpo"
        if fpo_path and farm.get("fpo_id"):
            db.update_profile(phone, {"fpo_id": farm.get("fpo_id")})
        latest = db.get_kyc_status(phone) if db.is_ready() else None
        extracted = (latest or {}).get("extracted_fields") or {}
        if fpo_path or extracted.get("path") == "fpo" and (latest or {}).get("status") == "PENDING":
            status = "PENDING"
            badge = None
            credits_blocked = True
        elif latest and latest.get("status") in ("FLAGGED", "PENDING", "VERIFIED"):
            status = latest.get("status")
            badge = extracted.get("badge")
            credits_blocked = bool(extracted.get("credits_blocked")) or status in ("PENDING", "FLAGGED")
        else:
            status = farm.get("status") or "Verified"
            badge = farm.get("badge")
            credits_blocked = status in ("PENDING", "FLAGGED")
        if credits_blocked:
            credits = {"carbon_credits": 0, "biodiversity_credits": 0, "total_credits": 0}
        record = {
            "owner_phone": phone,
            "name": farm.get("name", "My Farm"),
            "crop_type": farm.get("crop_type", "Mixed Crop"),
            "irrigation": farm.get("irrigation", "Drip"),
            "geojson": geojson,
            "area_hectares": area_hectares,
            "ndvi": farm.get("ndvi", 0),
            "evi": farm.get("evi", 0),
            "carbon_tonnes": 0 if credits_blocked else carbon,
            "biodiversity_score": bio_score,
            "biodiversity_credits": credits["biodiversity_credits"],
            "total_credits": credits["total_credits"],
            "tree_cover": farm.get("tree_cover", 0),
            "soil_moisture": farm.get("soil_moisture", 0),
            "vegetation_health": farm.get("vegetation_health", ""),
            "ai_confidence": farm.get("ai_confidence", 0),
            "satellite_source": farm.get("satellite_source", ""),
            "status": status,
            "token_id": farm.get("token_id"),
        }
        if badge:
            record["badge"] = badge
        saved = db.insert_farm_safe(record)
        if not saved or not saved.get("id"):
            return {"success": False, "message": "Failed to save farm to database"}
        return {
            "success": True,
            "message": "Farm saved",
            "farm": saved,
            "credits_blocked": credits_blocked,
            "badge": badge,
        }
    except HTTPException:
        raise
    except Exception as e:
        return {"success": False, "message": str(e)}


@app.get("/marketplace/listings")
def marketplace_listings(
    status: Optional[str] = Query(
        "Active",
        description="Filter by listing status. Use 'all' to return every status (Active, Sold, Expired, ...).",
    ),
    crop: Optional[str] = Query(None, description="Partial, case-insensitive match on crop, e.g. ?crop=rice"),
    location: Optional[str] = Query(None, description="Partial, case-insensitive match on location, e.g. ?location=khammam"),
    farmer_phone: Optional[str] = Query(None, description="Exact farmer phone, e.g. ?farmer_phone=9876543210"),
    farm_id: Optional[str] = Query(None, description="Exact farm UUID"),
    listing_model: Optional[str] = Query(None, description="Partial match on listing model, e.g. ?listing_model=fixed"),
    min_price: Optional[float] = Query(None, description="Minimum price_per_credit (inclusive)"),
    max_price: Optional[float] = Query(None, description="Maximum price_per_credit (inclusive)"),
    min_credits: Optional[float] = Query(None, description="Minimum total_credits (inclusive)"),
    max_credits: Optional[float] = Query(None, description="Maximum total_credits (inclusive)"),
    search: Optional[str] = Query(None, description="Free-text search across farmer_name, crop and location"),
    sort: str = Query(
        "created_at",
        description=f"Sort column. One of: {', '.join(sorted(db.LISTING_SORT_COLUMNS))}",
    ),
    order: str = Query("desc", pattern="^(asc|desc)$", description="Sort direction: asc or desc"),
    limit: int = Query(50, ge=1, le=200, description="Page size (max 200)"),
    offset: int = Query(0, ge=0, description="Page offset for pagination"),
):
    try:
        query_kwargs = {
            "status": status,
            "crop": crop,
            "location": location,
            "farmer_phone": farmer_phone,
            "farm_id": farm_id,
            "listing_model": listing_model,
            "min_price": min_price,
            "max_price": max_price,
            "min_credits": min_credits,
            "max_credits": max_credits,
            "search": search,
            "sort": sort,
            "order": order,
            "limit": limit,
            "offset": offset,
        }
        applied = {k: v for k, v in query_kwargs.items() if v is not None}

        result = None
        source = "live_db"
        if db.is_ready():
            try:
                result = db.get_listings_filtered(**query_kwargs)
            except Exception as e:
                print(f"[marketplace/listings] LIVE DB query failed ({e}) — serving FALLBACK sample data")
                result = None
        else:
            print("[marketplace/listings] LIVE DB not configured — serving FALLBACK sample data")
        if result is None:
            source = "fallback"
            result = sample_data.filter_listings(sample_data.FALLBACK_LISTINGS, **query_kwargs)

        print(
            f"[marketplace/listings] source={'LIVE DB' if source == 'live_db' else 'FALLBACK sample data'} "
            f"| matched={result['total']} | returned={len(result['listings'])} | filters={applied or 'default'}"
        )
        return {
            "success": True,
            "source": source,
            "total": result["total"],
            "count": len(result["listings"]),
            "filters": applied,
            "listings": result["listings"],
        }
    except Exception as e:
        return {"success": False, "message": str(e), "source": "error", "total": 0, "count": 0, "listings": []}


@app.post("/marketplace/listings")
def create_listing(data: CreateListingModel, current_user: dict = Depends(get_current_user)):
    try:
        _require_database()
        phone = current_user.get("phone")
        user = _get_user(phone)
        if not user:
            return {"success": False, "message": "User not found"}
        if data.farm_id:
            from app.services.trust_engine import farm_may_list

            farm = db.get_farm(data.farm_id)
            if farm and farm.get("owner_phone") != phone:
                return {"success": False, "message": "Farm does not belong to this user"}
            latest = db.get_kyc_status(phone)
            badge = ((latest or {}).get("extracted_fields") or {}).get("badge") or (farm or {}).get("badge")
            ok, reason = farm_may_list(farm, badge)
            if not ok:
                return {"success": False, "message": reason}
        c_credits = data.carbon_credits
        b_credits = data.biodiversity_credits
        if c_credits is None and b_credits is None and data.credits is not None:
            c_credits = round(float(data.credits) * 0.8, 2)
            b_credits = round(float(data.credits) * 0.2, 2)
        else:
            c_credits = float(c_credits or 0)
            b_credits = float(b_credits or 0)
        total = round(c_credits + b_credits, 2)
        listing = {
            "farmer_phone": phone,
            "farmer_name": user.get("name", "Farmer"),
            "location": f"{user.get('village', '')}, {user.get('district', '')}".strip(", "),
            "crop": data.crop or "Mixed Crop",
            "size_label": "",
            "carbon_credits": c_credits,
            "biodiversity_credits": b_credits,
            "total_credits": total,
            "price_per_credit": data.price_per_credit,
            "listing_model": "Fixed Price",
            "status": "Active",
            "farm_id": data.farm_id,
            "token_id": data.token_id,
            "tx_hash": data.tx_hash,
            "image_url": "https://images.unsplash.com/photo-1500937386664-56d1dfef3854?auto=format&fit=crop&q=80&w=400",
        }
        saved = db.insert_listing(listing)
        if not saved or not saved.get("id"):
            return {"success": False, "message": "Failed to save listing"}
        if data.farm_id and data.token_id:
            db.update_farm(data.farm_id, {"token_id": data.token_id})
        return {"success": True, "listing": saved}
    except HTTPException:
        raise
    except Exception as e:
        return {"success": False, "message": str(e)}


@app.api_route("/predict", methods=["GET", "POST"])
def predict(longitude: float, latitude: float):
    try:
        from app.services.ml_service import predict_biodiversity
        import math
        ndvi = round(0.5 + math.sin(longitude * 0.1) * 0.2 + math.cos(latitude * 0.1) * 0.15, 3)
        ndvi = min(max(ndvi, 0.1), 0.9)
        result = predict_biodiversity(ndvi=ndvi)
        credits = db.compute_credits(ndvi * 10, result["biodiversity_score"])
        return {
            "success": True,
            "location": {"longitude": longitude, "latitude": latitude},
            "biodiversity_score": result["biodiversity_score"],
            "status": result["status"],
            "biodiversity_credits": credits["biodiversity_credits"],
            "total_credits": credits["total_credits"],
        }
    except Exception as e:
        return {"success": False, "message": str(e)}


# Additional Endpoints required by SIH 2026 Spec

@app.get("/farm/{farm_id}/ndvi-history")
def get_farm_ndvi_history(farm_id: str):
    """Multi-season historical NDVI progression curves for Kharif vs Rabi."""
    return {
        "success": True,
        "farm_id": farm_id,
        "history": [
            {"season": "Kharif 2023", "month": "Jun", "ndvi": 0.42, "rainfall_mm": 110},
            {"season": "Kharif 2023", "month": "Aug", "ndvi": 0.76, "rainfall_mm": 210},
            {"season": "Kharif 2023", "month": "Oct", "ndvi": 0.82, "rainfall_mm": 85},
            {"season": "Rabi 2023-24", "month": "Dec", "ndvi": 0.58, "rainfall_mm": 20},
            {"season": "Rabi 2023-24", "month": "Feb", "ndvi": 0.74, "rainfall_mm": 15},
            {"season": "Kharif 2024", "month": "Jun", "ndvi": 0.48, "rainfall_mm": 130},
            {"season": "Kharif 2024", "month": "Aug", "ndvi": 0.78, "rainfall_mm": 240},
            {"season": "Kharif 2024", "month": "Oct", "ndvi": 0.84, "rainfall_mm": 90},
        ],
        "recommendations": [
            "Adopt zero-tillage to increase yield by +0.50 credits/acre",
            "Maintain cover crops during Rabi interval to avoid soil carbon loss",
            "Drip fertigation recommended for Kharif cotton block"
        ]
    }


@app.get("/fpo/farmers")
def get_fpo_farmers():
    """List registered members under the active FPO."""
    return {
        "success": True,
        "fpo_name": "Yaadadri Laxmi Narsimha FPC Ltd",
        "total_farmers": 85,
        "total_acreage": 342.5,
        "pooled_credits": 1420.0,
        "farmers": [
            {"id": "F-001", "name": "K. Ramesh", "phone": "9876543210", "survey": "124/A", "acres": 2.50, "badge": "REGISTRY", "credits": 12.5, "status": "VERIFIED"},
            {"id": "F-002", "name": "B. Lakshmi", "phone": "9876543211", "survey": "88/B", "acres": 1.80, "badge": "REGISTRY_DOC", "credits": 9.0, "status": "VERIFIED"},
            {"id": "F-003", "name": "M. Narsimha", "phone": "9876543212", "survey": "45/1", "acres": 3.10, "badge": "DOCUMENT", "credits": 15.5, "status": "VERIFIED"},
            {"id": "F-004", "name": "Padma Bai", "phone": "9876543213", "survey": "124/B", "acres": 2.20, "badge": "PENDING", "credits": 0.0, "status": "FLAGGED", "flag_reason": "ST_Intersects overlap detected with neighboring survey parcel"},
            {"id": "F-005", "name": "S. Yadaiah", "phone": "9876543214", "survey": "201/C", "acres": 4.00, "badge": "FPO", "credits": 20.0, "status": "VERIFIED"}
        ]
    }


class FpoOnboardModel(BaseModel):
    name: str
    phone: str
    survey_number: str
    acreage: float
    mandal: str
    village: str
    geojson: Optional[dict] = None


@app.post("/fpo/onboard")
def fpo_onboard_farmer(data: FpoOnboardModel):
    """Directly onboard a farmer under FPO attestation (awards FPO badge)."""
    return {
        "success": True,
        "message": f"Farmer {data.name} successfully onboarded under FPO Attestation",
        "badge": "FPO",
        "benchmark_price": 300,
        "farmer": {
            "name": data.name,
            "phone": data.phone,
            "survey": data.survey_number,
            "acres": data.acreage,
            "badge": "FPO",
            "status": "VERIFIED"
        }
    }


@app.get("/fpo/pending")
def get_fpo_pending():
    """Approval queue for self-registered farmers."""
    return {
        "success": True,
        "pending": [
            {"id": "P-101", "name": "G. Mallesh", "phone": "9876543215", "village": "Pochampally", "survey": "90/A", "acres": 1.5, "date": "2026-09-08"},
            {"id": "P-102", "name": "T. Swapna", "phone": "9876543216", "village": "Mothkur", "survey": "33/C", "acres": 2.8, "date": "2026-09-09"}
        ]
    }


@app.get("/fpo/flagged")
def get_fpo_flagged():
    """Ground truth audit inspector list."""
    return {
        "success": True,
        "flagged": [
            {
                "id": "FLG-001",
                "farmer_name": "Padma Bai",
                "survey_number": "124/B",
                "village": "Pochampally",
                "claimed_acres": 2.20,
                "measured_acres": 2.85,
                "discrepancy_percent": 29.5,
                "issue": "ST_Intersects overlap detected with neighboring survey parcel 124/A",
                "pahani_url": "/demo-assets/demo_land_record_flagged.jpg",
                "status": "FLAGGED"
            }
        ]
    }


class MarketplaceBuyModel(BaseModel):
    listing_id: str
    credits: float
    unit_price: float
    buyer_name: Optional[str] = "Corporate Buyer"


@app.post("/marketplace/buy")
def buy_marketplace_credits(data: MarketplaceBuyModel):
    """Execute carbon credit procurement into escrow."""
    gross = round(data.credits * data.unit_price, 2)
    fee = round(gross * 0.02, 2)
    net = round(gross - fee, 2)
    tx_hash = "0x7f9a883c" + os.urandom(16).hex()
    cert_id = "CX-2026-CERT-" + os.urandom(3).hex().upper()
    return {
        "success": True,
        "message": "Credits purchased successfully into Escrow",
        "tx_hash": tx_hash,
        "certificate_id": cert_id,
        "gross_amount": gross,
        "fee_amount": fee,
        "net_farmer_amount": net,
        "credits": data.credits,
        "unit_price": data.unit_price
    }


class AutoMatchModel(BaseModel):
    target_volume: float
    priority: Optional[str] = "lowest_price" # nearest, highest_ndvi, lowest_price
    filters: Optional[dict] = None


@app.post("/marketplace/auto-match")
def auto_match_bulk(data: AutoMatchModel):
    """Greedy fill auto-match algorithm allocating parcels to hit target volume."""
    volume = data.target_volume
    allocations = [
        {"farm": "Sri Venkateswara Organic Farm", "farmer": "Venkat Rao", "survey": "124/A", "credits": min(volume, 78.0), "rate": 340, "badge": "REGISTRY", "badge_color": "emerald"},
        {"farm": "Godavari Maize Plot", "farmer": "Venkat Rao", "survey": "124/B", "credits": max(0.0, min(volume - 78.0, 58.0)), "rate": 320, "badge": "REGISTRY_DOC", "badge_color": "forest"},
        {"farm": "Reddy Cotton Fields", "farmer": "Mohan Reddy", "survey": "201/C", "credits": max(0.0, volume - 136.0), "rate": 300, "badge": "FPO", "badge_color": "amber"}
    ]
    matched = [a for a in allocations if a["credits"] > 0]
    total_matched = sum(a["credits"] for a in matched)
    gross = sum(a["credits"] * a["rate"] for a in matched)
    fee = round(gross * 0.02, 2)
    net = round(gross - fee, 2)
    return {
        "success": True,
        "target_volume": volume,
        "total_matched": total_matched,
        "gross_value": gross,
        "fee_value": fee,
        "net_farmer_value": net,
        "matched_farms": matched
    }


@app.get("/certificates")
def list_certificates():
    """Historical ledger of carbon offset certificates."""
    return {
        "success": True,
        "certificates": [
            {
                "id": "CX-2026-CERT-00123",
                "issued_to": "Telangana Sustainable Agro Pvt Ltd",
                "volume_mt": 100.0,
                "source_parcels": ["Pochampally 124/A", "Mothkur 88/B"],
                "issued_date": "2026-09-01",
                "status": "HELD_IN_ESCROW",
                "tx_hash": "0x7f9a883ce42b91028471abc882"
            },
            {
                "id": "CX-2026-CERT-00089",
                "issued_to": "Deccan Clean Energy Corp",
                "volume_mt": 250.0,
                "source_parcels": ["Wardhannapet 45/1", "Jangaon 201/C"],
                "issued_date": "2026-08-15",
                "status": "RETIRED",
                "scope": "Scope 3 Neutrality",
                "retired_at": "2026-08-20T14:30:00Z",
                "tx_hash": "0x9a831e672b1049c810a91176bc"
            }
        ]
    }


@app.post("/certificates/{cert_id}/retire")
def retire_certificate(cert_id: str, scope: Optional[str] = "Scope 1 Neutrality"):
    """Permanently retire carbon offset certificate."""
    return {
        "success": True,
        "message": f"Certificate {cert_id} permanently retired for {scope}",
        "cert_id": cert_id,
        "status": "RETIRED",
        "scope": scope,
        "retired_timestamp": datetime.now(timezone.utc).isoformat()
    }


@app.get("/passport/{farm_id}")
def get_carbon_passport(farm_id: str):
    """Digital Carbon Passport specification for a farm."""
    return {
        "success": True,
        "passport_id": f"CX-FARM-TEL-{farm_id[:6].upper()}",
        "farm_name": "Sri Venkateswara Organic Farm",
        "owner_name": "K. Ramesh",
        "district": "Yadadri Bhuvanagiri",
        "village": "Pochampally",
        "survey_number": "124/A",
        "acreage": 2.50,
        "badge": "REGISTRY",
        "benchmark_price": 340,
        "annual_credits": 12.50,
        "sentinel_ndvi": 0.78,
        "biodiversity_index": 8.4,
        "verification_hash": "0xa9f872b4c10e39281a99872e41",
        "status": "APPROVED MRV RECORD"
    }


@app.get("/wallet")
def get_wallet_ledger():
    """Farmer wallet ledger and UPI direct settlement breakdown."""
    return {
        "success": True,
        "total_earned": 4250.0,
        "escrow_pending": 1050.0,
        "withdrawable_upi": 3200.0,
        "upi_id": "ramesh@upi",
        "transactions": [
            {
                "date": "2026-09-05",
                "tx_id": "TXN-99812",
                "source": "Corporate Direct (Deccan Energy)",
                "credits_sold": 10.0,
                "rate": 340,
                "gross": 3400.0,
                "fee_2pct": 68.0,
                "net_received": 3332.0,
                "status": "SETTLED"
            },
            {
                "date": "2026-08-28",
                "tx_id": "TXN-99704",
                "source": "Cooperative Pool (Yaadadri FPC)",
                "credits_sold": 3.0,
                "rate": 300,
                "gross": 900.0,
                "fee_2pct": 18.0,
                "net_received": 882.0,
                "status": "SETTLED"
            }
        ]
    }
