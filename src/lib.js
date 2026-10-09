import { getOfflineCache, saveOfflineCache } from "./offline";

// Chrome mein voices der se load hote hain, isliye pehle se garma lete hain.
if (typeof window !== "undefined" && "speechSynthesis" in window) {
  speechSynthesis.getVoices();
  speechSynthesis.addEventListener?.("voiceschanged", () => speechSynthesis.getVoices());
}

export const voiceSupported = () => typeof window !== "undefined" && "speechSynthesis" in window;
export const hasHindiVoice = () => voiceSupported() && speechSynthesis.getVoices().some((v) => v.lang.toLowerCase().startsWith("hi"));
export const stopSpeaking = () => voiceSupported() && speechSynthesis.cancel();

// onEnd tab bhi chalta hai jab bolna khatam ho ya error aaye (button wapas normal karne ke liye).
export function speak(text, onEnd) {
  if (!voiceSupported()) return false;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = "hi-IN";
  u.rate = 0.9;
  const v = speechSynthesis.getVoices().find((v) => v.lang.toLowerCase().startsWith("hi"));
  if (v) u.voice = v;
  u.onend = u.onerror = () => onEnd?.();
  speechSynthesis.speak(u);
  return true;
}

const loadImg = (file) =>
  new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = rej;
    img.src = URL.createObjectURL(file);
  });

// Dhundhli / andheri / zyada roshni wali photo pakadta hai. Thresholds apni photos par tune karein.
export async function checkQuality(file) {
  const img = await loadImg(file);
  const w = 200, h = Math.round((200 * img.height) / img.width) || 200;
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const ctx = c.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(img, 0, 0, w, h);
  const d = ctx.getImageData(0, 0, w, h).data;
  const g = new Float32Array(w * h);
  let sum = 0;
  for (let i = 0; i < w * h; i++) {
    g[i] = 0.299 * d[i * 4] + 0.587 * d[i * 4 + 1] + 0.114 * d[i * 4 + 2];
    sum += g[i];
  }
  const bright = sum / (w * h);
  let m = 0, m2 = 0, n = 0;
  for (let y = 1; y < h - 1; y++)
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const l = 4 * g[i] - g[i - 1] - g[i + 1] - g[i - w] - g[i + w];
      m += l; m2 += l * l; n++;
    }
  const blur = m2 / n - (m / n) ** 2;
  const issues = [];
  if (blur < 40) issues.push("फ़ोटो धुंधली है। फ़ोन को स्थिर रखकर पत्ते के पास से खींचें।");
  if (bright < 60) issues.push("फ़ोटो में रोशनी कम है। दिन की रोशनी में खींचें।");
  if (bright > 225) issues.push("फ़ोटो में बहुत तेज़ रोशनी है। छाया में पत्ता रखकर खींचें।");
  return { issues, blur, bright };
}

// Upload se pehle photo chhoti karta hai (tez upload, API size limit safe).
export async function compress(file) {
  const img = await loadImg(file);
  const s = Math.min(1, 1280 / Math.max(img.width, img.height));
  const c = document.createElement("canvas");
  c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
  c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
  return new Promise((r) => c.toBlob(r, "image/jpeg", 0.85));
}

const h12 = (h) => h % 12 || 12;
const part = (h) => (h < 12 ? "सुबह" : h < 16 ? "दोपहर" : "शाम");

// Open-Meteo se agle 2 din ka mausam; rule: baarish ki sambhavna <=20%, hawa <=12 km/h.
export async function getSprayWindow(lat, lon) {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&hourly=precipitation_probability,wind_speed_10m&forecast_days=2&timezone=Asia%2FKolkata`;
  const cacheKey = `spray:${lat}:${lon}`;
  try {
  const r = await fetch(url);
  if (!r.ok) throw new Error("weather");
  const { hourly } = await r.json();
  const nowKey = new Date().toLocaleString("sv-SE", { timeZone: "Asia/Kolkata" }).replace(" ", "T").slice(0, 13);
  const today = nowKey.slice(0, 10);
  const days = [{ label: "आज", hours: [] }, { label: "कल", hours: [] }];
  hourly.time.forEach((t, i) => {
    const hr = parseInt(t.slice(11, 13), 10);
    if (hr < 6 || hr > 17) return;
    const rain = hourly.precipitation_probability[i];
    const wind = hourly.wind_speed_10m[i];
    const nextRain = hourly.precipitation_probability[i + 1] ?? 0;
    days[t.slice(0, 10) === today ? 0 : 1].hours.push({
      h: hr, rain, wind, past: t.slice(0, 13) < nowKey,
      ok: t.slice(0, 13) >= nowKey && rain <= 20 && wind <= 12 && nextRain <= 30,
    });
  });
  let best = null;
  days.forEach((d) => {
    let run = [];
    const close = () => {
      if (run.length >= 2 && (!best || run.length > best.len))
        best = { day: d.label, from: run[0], to: run[run.length - 1], len: run.length };
      run = [];
    };
    d.hours.forEach((x) => (x.ok ? run.push(x.h) : close()));
    close();
  });
  if (best)
    {
    const e = best.to + 1;
    best.label = `${best.day} ${part(best.from)} ${h12(best.from)} से ${part(e) === part(best.from) ? "" : part(e) + " "}${h12(e)} बजे`;
  }
  const result = { days, best, stale: false };
  await saveOfflineCache(cacheKey, result);
  return result;
  } catch (error) {
    const cached = await getOfflineCache(cacheKey);
    if (cached) return { ...cached.value, stale: true };
    throw error;
  }
}

export async function getWeatherRisk(district, crop) {
  const params = new URLSearchParams({ district, crop });
  const cacheKey = `risk:${district}:${crop}`;
  try {
    const response = await fetch(`/api/weather-risk?${params}`);
    if (!response.ok) {
      let message = "मौसम का जोखिम संकेत अभी नहीं मिल पाया।";
      try {
        const body = await response.json();
        if (typeof body.detail === "string") message = body.detail;
      } catch {}
      throw new Error(message);
    }
    const result = await response.json();
    await saveOfflineCache(cacheKey, result);
    return { ...result, stale: false };
  } catch (error) {
    const cached = await getOfflineCache(cacheKey);
    if (cached) return { ...cached.value, stale: true };
    throw error;
  }
}
