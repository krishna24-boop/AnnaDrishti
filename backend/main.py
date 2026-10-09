import asyncio, base64, json, logging, os, re, uuid
from contextlib import asynccontextmanager
from datetime import datetime, time, timedelta, timezone
from typing import Optional
from fastapi import FastAPI, File, Form, HTTPException, Response, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
from dotenv import load_dotenv
import httpx
from pymongo import DESCENDING, MongoClient
from pymongo.errors import PyMongoError

load_dotenv()

logger = logging.getLogger(__name__)
IST = timezone(timedelta(hours=5, minutes=30), "IST")
LABELS = ["apple_scab", "apple_black_rot", "cedar_apple_rust",
          "potato_early_blight", "potato_late_blight", "healthy", "unknown"]
CROPS = {"Seb", "Aloo"}
DISTRICTS = {
    "Almora": (29.6, 79.66), "Bageshwar": (29.84, 79.77), "Chamoli": (30.41, 79.32),
    "Champawat": (29.34, 80.09), "Dehradun": (30.32, 78.03), "Haridwar": (29.95, 78.16),
    "Nainital": (29.38, 79.46), "Pauri Garhwal": (30.15, 78.78),
    "Pithoragarh": (29.58, 80.22), "Rudraprayag": (30.28, 78.98),
    "Tehri Garhwal": (30.38, 78.43), "Udham Singh Nagar": (28.98, 79.4),
    "Uttarkashi": (30.73, 78.45),
}
WEATHER_SUBSCRIPTIONS = set()
SCHEDULED_WEATHER = {}

# Provider apne-aap chunta hai: GEMINI_API_KEY ho to Gemini (free), warna ANTHROPIC_API_KEY ho to Claude.
GEMINI_KEY = os.getenv("GEMINI_API_KEY", "").strip()
CLAUDE_KEY = os.getenv("ANTHROPIC_API_KEY", "").strip()
if CLAUDE_KEY == "your_key_here":
    CLAUDE_KEY = ""
if GEMINI_KEY == "your_key_here":
    GEMINI_KEY = ""
PROVIDER = "gemini" if GEMINI_KEY else "claude" if CLAUDE_KEY else None
MODEL = os.getenv("GEMINI_MODEL", "gemini-3-flash-preview") if PROVIDER == "gemini" \
    else os.getenv("CLAUDE_MODEL", "claude-sonnet-5-5")
DEMO = os.getenv("DEMO_MODE") == "1" or PROVIDER is None
MONGODB_URI = os.getenv("MONGODB_URI", "").strip()
MONGODB_DATABASE = os.getenv("MONGODB_DATABASE", "annadrishti").strip()
_mongo_client = None
_history_records = None

SYSTEM = f"""You are a plant pathologist helping hill farmers in Uttarakhand (apple and potato).
Look at the leaf/fruit photo and choose exactly ONE label from: {LABELS}.
Use "unknown" if the photo is not an apple or potato leaf/fruit.
Reply with JSON only, no markdown:
{{"label": "<label>", "confidence": <integer 0-100, honest>, "reason": "<1-2 short sentences in simple Hindi (Devanagari) naming the visible symptoms>"}}"""

ASSISTANT_SYSTEM = """आप उत्तराखंड के किसानों के लिए अन्नदृष्टि के हिंदी कृषि सहायक हैं।
किसान के सवाल का सरल, छोटा और काम का जवाब केवल हिंदी (देवनागरी) में दें।
संदर्भ में दी गई मुख्य फ़सल और ज़िले को ध्यान में रखें। मौसम की जानकारी मिले तो उसे जिला-स्तर का अनुमान बताएं, पक्की भविष्यवाणी नहीं।
फोटो या प्रत्यक्ष जांच के बिना पौधे की बीमारी का पक्का निदान न करें।
कीटनाशक/फफूंदनाशक की दवा का नाम, मात्रा, मिश्रण या छिड़काव schedule न बताएं; किसान को स्थानीय KVK या कृषि विभाग की verified सलाह लेने को कहें।
जवाब 2-5 छोटे वाक्यों में रखें।"""

DEMO_RESULT = {"label": "apple_scab", "confidence": 82, "demo": True,
               "reason": "पत्ते पर जैतूनी-भूरे रंग के मखमली धब्बे दिख रहे हैं।"}


def _ask_claude(data: bytes, crop: str) -> str:
    import anthropic
    msg = anthropic.Anthropic(api_key=CLAUDE_KEY).messages.create(
        model=MODEL, max_tokens=400, system=SYSTEM,
        messages=[{"role": "user", "content": [
            {"type": "image", "source": {"type": "base64", "media_type": "image/jpeg",
                                          "data": base64.b64encode(data).decode()}},
            {"type": "text", "text": f"Crop declared by farmer: {crop}. Diagnose."},
        ]}],
    )
    return msg.content[0].text


def _ask_gemini(data: bytes, crop: str) -> str:
    import httpx
    r = httpx.post(
        f"https://generativelanguage.googleapis.com/v1beta/models/{MODEL}:generateContent",
        headers={"x-goog-api-key": GEMINI_KEY},
        json={
            "systemInstruction": {"parts": [{"text": SYSTEM}]},
            "contents": [{"parts": [
                {"inline_data": {"mime_type": "image/jpeg", "data": base64.b64encode(data).decode()}},
                {"text": f"Crop declared by farmer: {crop}. Diagnose."},
            ]}],
            "generationConfig": {"responseMimeType": "application/json", "temperature": 0.2},
        },
        timeout=60,
    )
    if r.status_code == 429:
        raise RuntimeError("Gemini free limit lag gayi, 1 minute ruk kar dobara try karein")
    if r.status_code == 404:
        logger.error("Gemini model %s was not found (HTTP 404)", MODEL)
        raise RuntimeError(f"Gemini model {MODEL} उपलब्ध नहीं है। Render में GEMINI_MODEL जाँचें।")
    if r.status_code in (400, 401, 403):
        logger.error("Gemini diagnosis request was rejected (HTTP %s)", r.status_code)
        raise RuntimeError("Gemini ने API key या model access अस्वीकार किया। Render में GEMINI_API_KEY जाँचें।")
    r.raise_for_status()
    return r.json()["candidates"][0]["content"]["parts"][0]["text"]


def classify(data: bytes, crop: str = "Seb") -> dict:
    """Ek photo (JPEG bytes) -> {label, confidence, reason}. eval.py bhi yahi use karta hai."""
    if DEMO:
        return dict(DEMO_RESULT)
    text = _ask_gemini(data, crop) if PROVIDER == "gemini" else _ask_claude(data, crop)
    out = json.loads(text[text.index("{"): text.rindex("}") + 1])
    if out.get("label") not in LABELS:
        out["label"] = "unknown"
    try:
        out["confidence"] = max(0, min(100, int(out.get("confidence", 0))))
    except (TypeError, ValueError):
        out["confidence"] = 0
    out["reason"] = str(out.get("reason", ""))[:300]
    return out


def _weather_risk(hourly: dict, crop: str, district: str) -> dict:
    now = datetime.now(IST)
    end = now + timedelta(hours=24)
    risk_hours = []
    humidity = hourly.get("relative_humidity_2m", [])
    temperatures = hourly.get("temperature_2m", [])
    precipitation = hourly.get("precipitation", [])
    rain_probability = hourly.get("precipitation_probability", [])

    for i, stamp in enumerate(hourly.get("time", [])):
        hour = datetime.fromisoformat(stamp).replace(tzinfo=IST)
        if not now <= hour < end:
            continue
        values = (humidity, temperatures, precipitation, rain_probability)
        if any(i >= len(series) or series[i] is None for series in values):
            continue
        humid, temp, rain, rain_chance = (series[i] for series in values)
        if humid >= 85 and 10 <= temp <= 25 and (rain > 0 or rain_chance >= 40):
            risk_hours.append((humid, rain_chance))

    count = len(risk_hours)
    level = "high" if count >= 6 else "watch" if count >= 2 else "low"
    crop_name = "सेब" if crop == "Seb" else "आलू"
    if level == "high":
        message = f"अगले 24 घंटे में नमी और तापमान {crop_name} के फफूंद रोगों के अनुकूल हो सकते हैं। खेत और पत्तों की निगरानी करें।"
    elif level == "watch":
        message = f"अगले 24 घंटे में {crop_name} के लिए कुछ नम मौसम के घंटे हैं। पत्तों पर धब्बे या सड़न दिखे तो ध्यान दें।"
    else:
        message = f"अगले 24 घंटे में {crop_name} के फफूंद रोगों के लिए मौसम का संकेत कम है। नियमित निगरानी जारी रखें।"
    return {
        "district": district,
        "crop": crop,
        "checked_at": now.isoformat(),
        "risk_level": level,
        "risk_hours": count,
        "message": message,
        "disclaimer": "यह जिला-स्तर का मौसम संकेत है, खेत या रोग का निदान नहीं।",
    }


async def _fetch_weather_risk(district: str, crop: str) -> dict:
    latitude, longitude = DISTRICTS[district]
    try:
        async with httpx.AsyncClient(timeout=20) as client:
            response = await client.get(
                "https://api.open-meteo.com/v1/forecast",
                params={
                    "latitude": latitude,
                    "longitude": longitude,
                    "hourly": "temperature_2m,relative_humidity_2m,precipitation,precipitation_probability",
                    "forecast_days": 2,
                    "timezone": "Asia/Kolkata",
                },
            )
            response.raise_for_status()
            hourly = response.json()["hourly"]
        return _weather_risk(hourly, crop, district)
    except (httpx.HTTPError, KeyError, ValueError) as exc:
        logger.exception("Open-Meteo weather-risk check failed for %s", district)
        raise HTTPException(502, "मौसम का जोखिम संकेत अभी नहीं मिल पाया। थोड़ी देर बाद फिर कोशिश करें।") from exc


async def _scheduled_weather_checks():
    while True:
        now = datetime.now(IST)
        next_check = datetime.combine(now.date(), time(12, 0), tzinfo=IST)
        if next_check <= now:
            next_check += timedelta(days=1)
        await asyncio.sleep((next_check - now).total_seconds())
        for district, crop in tuple(WEATHER_SUBSCRIPTIONS):
            try:
                result = await _fetch_weather_risk(district, crop)
                SCHEDULED_WEATHER[(next_check.date().isoformat(), district, crop)] = result
            except HTTPException:
                logger.exception("Scheduled weather-risk check failed for %s", district)


@asynccontextmanager
async def lifespan(app):
    task = asyncio.create_task(_scheduled_weather_checks())
    try:
        yield
    finally:
        task.cancel()
        try:
            await task
        except asyncio.CancelledError:
            pass


app = FastAPI(title="AnnaDrishti AI", lifespan=lifespan)
app.add_middleware(CORSMiddleware,
                   allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
                   allow_methods=["*"], allow_headers=["*"])


def _history_collection():
    global _mongo_client, _history_records
    if not _mongo_configured():
        raise HTTPException(503, "फ़सल इतिहास चालू करने के लिए backend .env में MongoDB Atlas URI सेट करें।")
    if _history_records is None:
        _mongo_client = MongoClient(MONGODB_URI, serverSelectionTimeoutMS=3000, tz_aware=True)
        _history_records = _mongo_client[MONGODB_DATABASE]["crop_history"]
        _history_records.create_index([("farmer_id", 1), ("created_at", DESCENDING)])
        _history_records.create_index([("farmer_id", 1), ("follow_up_at", 1)])
    return _history_records


def _validate_farmer_id(farmer_id: str):
    if not re.fullmatch(r"[6-9]\d{9}", farmer_id or ""):
        raise HTTPException(422, "किसान के 10 अंकों के सही मोबाइल नंबर की ज़रूरत है।")


def _mongo_configured() -> bool:
    return bool(MONGODB_URI and "<username>" not in MONGODB_URI)


def _record_for_response(record: dict) -> dict:
    record.pop("_id", None)
    record.pop("photo", None)
    record["has_photo"] = bool(record.get("has_photo"))
    for key in ("created_at", "follow_up_at", "updated_at"):
        if isinstance(record.get(key), datetime):
            record[key] = record[key].isoformat()
    return record


def _store_diagnosis(data: bytes, crop: str, farmer_id: str, farmer_name: str,
                     district: str, diagnosis: dict) -> str:
    _validate_farmer_id(farmer_id)
    record_id = uuid.uuid4().hex
    record = {
        "id": record_id,
        "farmer_id": farmer_id,
        "farmer_name": farmer_name[:100],
        "district": district if district in DISTRICTS else "",
        "crop": crop,
        "label": diagnosis["label"],
        "confidence": diagnosis["confidence"],
        "reason": diagnosis["reason"],
        "treatment_notes": "",
        "created_at": datetime.now(timezone.utc),
        "follow_up_at": None,
        "follow_up_done": False,
        "has_photo": bool(data),
        "photo": data or None,
        "photo_content_type": "image/jpeg" if data else None,
    }
    _history_collection().insert_one(record)
    return record_id


class HistoryUpdate(BaseModel):
    farmer_id: str
    treatment_notes: Optional[str] = Field(default=None, max_length=2000)
    follow_up_at: Optional[datetime] = None
    follow_up_done: Optional[bool] = None


class AssistantQuestion(BaseModel):
    question: str = Field(min_length=1, max_length=1000)
    crop: str = "Seb"
    district: str = ""


@app.get("/api/health")
def health():
    return {
        "ok": True, "demo": DEMO, "provider": PROVIDER,
        "model": None if DEMO else MODEL, "history_configured": _mongo_configured(),
    }


@app.post("/api/assistant")
def ask_assistant(request: AssistantQuestion):
    question = request.question.strip()
    if not question:
        raise HTTPException(422, "अपना सवाल बोलें या लिखें।")
    if not GEMINI_KEY:
        raise HTTPException(503, "कृषि सवालों के जवाब के लिए Gemini API key सेट होना ज़रूरी है।")
    crop = request.crop if request.crop in CROPS else "Seb"
    district = request.district if request.district in DISTRICTS else "उत्तराखंड"
    try:
        response = httpx.post(
            f"https://generativelanguage.googleapis.com/v1beta/models/{MODEL}:generateContent",
            headers={"x-goog-api-key": GEMINI_KEY},
            json={
                "systemInstruction": {"parts": [{"text": ASSISTANT_SYSTEM}]},
                "contents": [{"parts": [{
                    "text": f"किसान का ज़िला: {district}। मुख्य फ़सल: {'सेब' if crop == 'Seb' else 'आलू'}। सवाल: {question}"
                }]}],
                "generationConfig": {"temperature": 0.4, "maxOutputTokens": 400},
            },
            timeout=30,
        )
        if response.status_code == 429:
            raise HTTPException(429, "Gemini की मुफ्त सीमा पूरी हो गई। थोड़ी देर बाद फिर पूछें।")
        if response.status_code == 404:
            logger.error("Gemini model %s was not found (HTTP 404)", MODEL)
            raise HTTPException(502, f"Gemini model {MODEL} उपलब्ध नहीं है। Render में GEMINI_MODEL जाँचें।")
        if response.status_code in (400, 401, 403):
            logger.error("Gemini assistant request was rejected (HTTP %s)", response.status_code)
            raise HTTPException(502, "Gemini ने API key या model access अस्वीकार किया। Render में GEMINI_API_KEY जाँचें।")
        response.raise_for_status()
        answer = response.json()["candidates"][0]["content"]["parts"][0]["text"].strip()
        if not answer:
            raise ValueError("Gemini returned an empty response")
        return {"answer": answer[:2000]}
    except HTTPException:
        raise
    except (httpx.HTTPError, KeyError, IndexError, ValueError) as exc:
        logger.exception("Gemini farmer-assistant request failed")
        raise HTTPException(502, "अभी जवाब नहीं मिल पाया। इंटरनेट और Gemini API सेटिंग जाँचकर फिर कोशिश करें।") from exc


@app.get("/api/history")
def crop_history(farmer_id: str):
    _validate_farmer_id(farmer_id)
    try:
        records = _history_collection().find(
            {"farmer_id": farmer_id},
            {"_id": 0, "photo": 0, "photo_content_type": 0},
        ).sort("created_at", DESCENDING).limit(100)
        return {"records": [_record_for_response(record) for record in records]}
    except PyMongoError as exc:
        logger.exception("MongoDB crop-history read failed")
        raise HTTPException(503, "MongoDB से फ़सल इतिहास नहीं मिल पाया। Atlas कनेक्शन जाँचें।") from exc


@app.get("/api/history/{record_id}/photo")
def crop_history_photo(record_id: str, farmer_id: str):
    _validate_farmer_id(farmer_id)
    try:
        record = _history_collection().find_one(
            {"id": record_id, "farmer_id": farmer_id},
            {"_id": 0, "photo": 1, "photo_content_type": 1},
        )
    except PyMongoError as exc:
        logger.exception("MongoDB crop-history photo read failed")
        raise HTTPException(503, "MongoDB से फ़सल की फ़ोटो नहीं मिल पाई। Atlas कनेक्शन जाँचें।") from exc
    if not record or not record.get("photo"):
        raise HTTPException(404, "इस जाँच की फ़ोटो उपलब्ध नहीं है।")
    return Response(content=record["photo"], media_type=record.get("photo_content_type") or "image/jpeg")


@app.patch("/api/history/{record_id}")
def update_crop_history(record_id: str, update: HistoryUpdate):
    _validate_farmer_id(update.farmer_id)
    fields = update.model_dump(exclude={"farmer_id"}, exclude_unset=True)
    if not fields:
        raise HTTPException(422, "नोट या फ़ॉलो-अप में कोई बदलाव दें।")
    if "follow_up_at" in fields and fields["follow_up_at"] is not None:
        if fields["follow_up_at"].tzinfo is None:
            fields["follow_up_at"] = fields["follow_up_at"].replace(tzinfo=IST)
        fields["follow_up_at"] = fields["follow_up_at"].astimezone(timezone.utc)
    fields["updated_at"] = datetime.now(timezone.utc)
    try:
        result = _history_collection().update_one(
            {"id": record_id, "farmer_id": update.farmer_id},
            {"$set": fields},
        )
    except PyMongoError as exc:
        logger.exception("MongoDB crop-history update failed")
        raise HTTPException(503, "फ़सल इतिहास सेव नहीं हुआ। Atlas कनेक्शन जाँचें।") from exc
    if not result.matched_count:
        raise HTTPException(404, "यह जाँच इस किसान के इतिहास में नहीं मिली।")
    return {"ok": True}


@app.get("/api/weather-risk")
async def weather_risk(district: str, crop: str):
    if district not in DISTRICTS:
        raise HTTPException(422, "ज़िला सूची में से चुनें")
    if crop not in CROPS:
        raise HTTPException(422, "मुख्य फ़सल सूची में से चुनें")
    WEATHER_SUBSCRIPTIONS.add((district, crop))
    today = datetime.now(IST).date().isoformat()
    scheduled = SCHEDULED_WEATHER.get((today, district, crop))
    if scheduled:
        return scheduled
    return await _fetch_weather_risk(district, crop)


@app.post("/api/diagnose")
async def diagnose(
    image: UploadFile = File(...),
    crop: str = Form("Seb"),
    farmer_id: str = Form(""),
    farmer_name: str = Form(""),
    district: str = Form(""),
):
    if crop not in CROPS:
        crop = "Seb"
    data = await image.read()
    if len(data) > 5_000_000:
        raise HTTPException(413, "Photo bahut badi hai")
    if not data.startswith(b"\xff\xd8"):  # frontend hamesha JPEG bhejta hai
        raise HTTPException(415, "Sirf JPEG photo chalegi")
    try:
        result = classify(data, crop)
    except Exception as e:
        raise HTTPException(502, f"AI jaanch fail: {e}")
    if not farmer_id:
        return result
    try:
        result["history_saved"] = True
        result["history_id"] = _store_diagnosis(data, crop, farmer_id, farmer_name, district, result)
    except HTTPException as exc:
        if exc.status_code == 422:
            raise
        logger.warning("Diagnosis completed but crop history was not saved: %s", exc.detail)
        result["history_saved"] = False
        result["history_error"] = exc.detail
    except PyMongoError:
        logger.exception("Diagnosis completed but MongoDB crop-history save failed")
        result["history_saved"] = False
        result["history_error"] = "जाँच हो गई, लेकिन फ़सल इतिहास MongoDB में सेव नहीं हुआ। Atlas कनेक्शन जाँचें।"
    return result


frontend_dist = os.path.join(os.path.dirname(os.path.dirname(__file__)), "dist")
if os.path.isdir(frontend_dist):
    app.mount("/", StaticFiles(directory=frontend_dist, html=True), name="frontend")
