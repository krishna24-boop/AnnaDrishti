import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Camera, ImageUp, LogOut, AlertTriangle, MapPin, Wifi, WifiOff, Download, RefreshCw, UserRound, X, RotateCcw, Mic, Square, Send, Volume2 } from "lucide-react";
import { DISEASES, COORDS } from "./data";
import { checkQuality, compress, getSprayWindow, getWeatherRisk, speak, stopSpeaking, voiceSupported } from "./lib";
import { enqueueDiagnosis, getQueuedDiagnoses, removeQueuedDiagnosis } from "./offline";
import Result from "./Result";
import Treatment from "./Treatment";
import SprayWindow from "./SprayWindow";
import WeatherRiskAlert from "./WeatherRiskAlert";
import Roadmap from "./Roadmap";

export default function Home({ user, onLogout, onOpenProfile, canInstall, onInstall }) {
  const camRef = useRef();
  const galRef = useRef();
  const videoRef = useRef();
  const cameraStream = useRef(null);
  const recognitionRef = useRef(null);
  const reqId = useRef(0); // purani request ka jawab nayi photo ko na bigaade
  const activeQueuedId = useRef(null);
  const syncing = useRef(false);
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [warn, setWarn] = useState([]);
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState(null);
  const [err, setErr] = useState("");
  const [spray, setSpray] = useState(null);
  const [sprayErr, setSprayErr] = useState(false);
  const [weatherRisk, setWeatherRisk] = useState(null);
  const [weatherRiskLoading, setWeatherRiskLoading] = useState(true);
  const [weatherRiskError, setWeatherRiskError] = useState("");
  const [weatherRefresh, setWeatherRefresh] = useState(0);
  const [online, setOnline] = useState(navigator.onLine);
  const [queueCount, setQueueCount] = useState(0);
  const [queueVersion, setQueueVersion] = useState(0);
  const [queueSyncVersion, setQueueSyncVersion] = useState(0);
  const [queueSyncing, setQueueSyncing] = useState(false);
  const [offlineNotice, setOfflineNotice] = useState("");
  const [historyError, setHistoryError] = useState("");
  const [assistantQuestion, setAssistantQuestion] = useState("");
  const [assistantAnswer, setAssistantAnswer] = useState("");
  const [assistantError, setAssistantError] = useState("");
  const [assistantBusy, setAssistantBusy] = useState(false);
  const [assistantListening, setAssistantListening] = useState(false);
  const [assistantTalking, setAssistantTalking] = useState(false);

  useEffect(() => {
    const [lat, lon] = COORDS[user.district];
    getSprayWindow(lat, lon).then(setSpray).catch(() => setSprayErr(true));
  }, [user.district]);

  useEffect(() => {
    let active = true;
    const loadRisk = async () => {
      setWeatherRiskLoading(true);
      try {
        const result = await getWeatherRisk(user.district, user.crop);
        if (active) {
          setWeatherRisk(result);
          setWeatherRiskError("");
        }
      } catch (e) {
        if (active) setWeatherRiskError(e.message || "मौसम का संकेत नहीं मिल पाया।");
      } finally {
        if (active) setWeatherRiskLoading(false);
      }
    };
    loadRisk();
    const timer = setInterval(loadRisk, 15 * 60 * 1000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [user.district, user.crop, weatherRefresh]);

  useEffect(() => () => preview && URL.revokeObjectURL(preview), [preview]);

  useEffect(() => {
    if (videoRef.current && cameraStream.current) {
      videoRef.current.srcObject = cameraStream.current;
      videoRef.current.play().catch(() => setCameraError("कैमरा preview शुरू नहीं हुआ। फिर कोशिश करें।"));
    }
  }, [cameraOpen]);

  useEffect(() => () => {
    cameraStream.current?.getTracks().forEach((track) => track.stop());
    recognitionRef.current?.abort();
    stopSpeaking();
  }, []);

  useEffect(() => {
    const updateOnline = () => setOnline(navigator.onLine);
    window.addEventListener("online", updateOnline);
    window.addEventListener("offline", updateOnline);
    return () => {
      window.removeEventListener("online", updateOnline);
      window.removeEventListener("offline", updateOnline);
    };
  }, []);

  useEffect(() => {
    getQueuedDiagnoses(user.phone)
      .then((entries) => setQueueCount(entries.length))
      .catch((error) => setOfflineNotice(error.message));
  }, [queueVersion, user.phone]);

  useEffect(() => {
    if (!online || syncing.current) return;
    let active = true;
    const syncQueue = async () => {
      syncing.current = true;
      setQueueSyncing(true);
      try {
        const entries = await getQueuedDiagnoses(user.phone);
        setQueueCount(entries.length);
        for (const entry of entries) {
          if (!active) break;
          const form = new FormData();
          form.append("image", entry.image, "leaf.jpg");
          form.append("crop", entry.crop);
          form.append("farmer_id", entry.farmer.phone);
          form.append("farmer_name", entry.farmer.name);
          form.append("district", entry.farmer.district);
          const response = await fetch("/api/diagnose", { method: "POST", body: form });
          if (!response.ok) {
            const body = await response.json().catch(() => ({}));
            throw new Error(body.detail || `जाँच नहीं हो पाई (HTTP ${response.status})`);
          }
          const result = await response.json();
          if (result.history_saved) {
            setHistoryError("");
          } else {
            setHistoryError(result.history_error || "जाँच हुई, लेकिन इतिहास सेव नहीं हुआ।");
          }
          await removeQueuedDiagnosis(entry.id);
          setQueueCount((count) => Math.max(0, count - 1));
          if (entry.id === activeQueuedId.current) {
            setRes(result);
            setErr("");
            activeQueuedId.current = null;
          }
        }
        setOfflineNotice(entries.length ? "सहेजी गई फ़ोटो की जाँच पूरी हुई।" : "");
      } catch (error) {
        if (active) setOfflineNotice(`${error.message} फ़ोटो डिवाइस पर सुरक्षित है; फिर कोशिश करें।`);
      } finally {
        syncing.current = false;
        if (active) setQueueSyncing(false);
      }
    };
    syncQueue();
    return () => { active = false; };
  }, [online, queueSyncVersion, user.phone]);

  const run = async (f) => {
    const id = ++reqId.current;
    setWarn([]); setBusy(true); setErr(""); setRes(null);
    let image;
    try {
      image = await compress(f);
      if (!image) throw new Error("फ़ोटो तैयार नहीं हो पाई।");
      if (!navigator.onLine) {
        const entry = await enqueueDiagnosis(image, user.crop, user);
        activeQueuedId.current = entry.id;
        setQueueVersion((version) => version + 1);
        setOfflineNotice("इंटरनेट नहीं है। फ़ोटो इस डिवाइस पर सुरक्षित है; कनेक्शन मिलते ही जाँच होगी।");
        return;
      }
      const fd = new FormData();
      fd.append("image", image, "leaf.jpg");
      fd.append("crop", user.crop);
      fd.append("farmer_id", user.phone);
      fd.append("farmer_name", user.name);
      fd.append("district", user.district);
      const r = await fetch("/api/diagnose", { method: "POST", body: fd });
      if (!r.ok) {
        let message = `जाँच नहीं हो पाई (HTTP ${r.status})`;
        try {
          const body = await r.json();
          if (typeof body.detail === "string") message = body.detail.slice(0, 300);
        } catch {}
        throw new Error(message);
      }
      const out = await r.json();
      if (id === reqId.current) {
        setRes(out);
        if (out.history_saved) {
          setHistoryError("");
        } else {
          setHistoryError(out.history_error || "");
        }
      }
    } catch (e) {
      if (image && (e instanceof TypeError || !navigator.onLine)) {
        if (e instanceof TypeError) setOnline(false);
        try {
          const entry = await enqueueDiagnosis(image, user.crop, user);
          activeQueuedId.current = entry.id;
          setQueueVersion((version) => version + 1);
          if (navigator.onLine) setQueueSyncVersion((version) => version + 1);
          setOfflineNotice("कनेक्शन नहीं मिला। फ़ोटो इस डिवाइस पर सुरक्षित है; कनेक्शन मिलते ही जाँच होगी।");
        } catch (storageError) {
          if (id === reqId.current) setErr(storageError.message);
        }
      } else if (id === reqId.current) {
        setErr(e.message || "जाँच नहीं हो पाई। फिर दोबारा कोशिश करें।");
      }
    } finally {
      if (id === reqId.current) setBusy(false);
    }
  };

  const stopCamera = () => {
    cameraStream.current?.getTracks().forEach((track) => track.stop());
    cameraStream.current = null;
    setCameraOpen(false);
  };

  const openCamera = async () => {
    setCameraError("");
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError("इस browser में live camera उपलब्ध नहीं है। गैलरी से फ़ोटो चुनें।");
      setCameraOpen(true);
      return;
    }
    try {
      cameraStream.current = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 } },
      });
      setCameraOpen(true);
    } catch (error) {
      const message = error.name === "NotAllowedError" || error.name === "SecurityError"
        ? "कैमरा permission बंद है। Browser address bar के lock icon में Camera को Allow करें, फिर दोबारा कोशिश करें।"
        : error.name === "NotFoundError" || error.name === "DevicesNotFoundError"
          ? "इस device पर camera नहीं मिला। गैलरी से फ़ोटो चुनें।"
          : error.name === "NotReadableError" || error.name === "TrackStartError"
            ? "कैमरा किसी दूसरे app में इस्तेमाल हो रहा है। उसे बंद करके फिर कोशिश करें।"
            : "कैमरा चालू नहीं हो पाया। Permission जाँचें या गैलरी से फ़ोटो चुनें।";
      setCameraError(message);
      setCameraOpen(true);
    }
  };

  const capturePhoto = () => {
    const video = videoRef.current;
    if (!video?.videoWidth || !video?.videoHeight) {
      setCameraError("कैमरा अभी तैयार नहीं है। एक पल रुककर फिर कोशिश करें।");
      return;
    }
    const canvas = document.createElement("canvas");
    const scale = Math.min(1, 1280 / Math.max(video.videoWidth, video.videoHeight));
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    canvas.getContext("2d").drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((blob) => {
      if (!blob) {
        setCameraError("फ़ोटो तैयार नहीं हो पाई। फिर कोशिश करें।");
        return;
      }
      const photo = new File([blob], "leaf.jpg", { type: "image/jpeg" });
      stopCamera();
      processPhoto(photo);
    }, "image/jpeg", 0.88);
  };

  const processPhoto = async (f) => {
    if (!f) return;
    reqId.current++;
    activeQueuedId.current = null;
    setBusy(false); setRes(null); setErr(""); setFile(f); setPreview(URL.createObjectURL(f));
    const q = await checkQuality(f).catch(() => ({ issues: [] }));
    setWarn(q.issues);
    if (!q.issues.length) run(f);
  };

  const pick = (e) => {
    const f = e.target.files[0];
    e.target.value = "";
    processPhoto(f);
  };

  const answerOutLoud = (text, onEnd) => {
    if (!voiceSupported()) {
      onEnd?.();
      return;
    }
    setAssistantTalking(speak(text, () => {
      setAssistantTalking(false);
      onEnd?.();
    }));
  };

  const askAssistant = async (rawQuestion, readAloud = false) => {
    const question = rawQuestion.trim();
    if (!question || assistantBusy) return;
    const normalized = question.toLowerCase().replace(/[?!.,।]/g, "").replace(/\s+/g, " ").trim();
    setAssistantQuestion(question);
    setAssistantAnswer("");
    setAssistantError("");

    const reply = (text) => {
      setAssistantAnswer(text);
      if (readAloud) answerOutLoud(text);
    };
    const cameraCommand = /^(कैमरा|camera)( चालू| खोलो?| शुरू)?$/.test(normalized)
      || /(?:फोटो|तस्वीर).*(?:खींच|खिच|ले लो|लें|खोल)|कैमरा.*(?:खोल|चालू|शुरू)|^(take photo|open camera)$/.test(normalized);
    const profileCommand = /^(मेरी )?(प्रोफाइल|प्रोफ़ाइल|profile|इतिहास|पुरानी जांच|पुरानी जाँच)( दिखाओ| खोलो| खोलें| पर जाओ)?$/.test(normalized);
    const weatherCommand = /^(आज का )?मौसम( बताओ| बताइए| क्या है| दिखाओ| देखो)?$/.test(normalized);
    const diagnosisCommand = /^(जांच|जाँच|नतीजा|रिपोर्ट)( बताओ| सुनाओ| दिखाओ)?$/.test(normalized);

    if (cameraCommand) {
      reply("कैमरा खोल रही हूँ। पत्ते की फ़ोटो लेकर जाँच कर सकती हैं।");
      openCamera();
      return;
    }
    if (profileCommand) {
      const message = "आपकी किसान प्रोफ़ाइल और फ़सल का इतिहास खोल रही हूँ।";
      setAssistantAnswer(message);
      if (readAloud) answerOutLoud(message, onOpenProfile);
      else onOpenProfile();
      return;
    }
    if (weatherCommand) {
      reply(weatherRisk
        ? `${weatherRisk.message} ${weatherRisk.disclaimer}`
        : "अभी मौसम की जानकारी नहीं मिली। इंटरनेट जुड़ने पर दोबारा पूछें।");
      return;
    }
    if (diagnosisCommand) {
      if (res) {
        const diseaseName = DISEASES[res.label]?.hi || "नतीजा स्पष्ट नहीं है";
        reply(`${diseaseName}। ${res.reason || ""} भरोसा ${res.confidence} प्रतिशत।`);
      } else {
        reply("अभी इस सत्र में कोई जाँच रिपोर्ट नहीं है। पहले पत्ते की फ़ोटो लेकर जाँच करें।");
      }
      return;
    }

    setAssistantBusy(true);
    try {
      const response = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, crop: user.crop, district: user.district }),
      });
      if (!response.ok) {
        let message = `जवाब नहीं मिला (HTTP ${response.status})`;
        try {
          const body = await response.json();
          if (typeof body.detail === "string") message = body.detail;
        } catch {}
        throw new Error(message);
      }
      const data = await response.json();
      if (typeof data.answer !== "string" || !data.answer.trim()) throw new Error("जवाब खाली मिला। फिर पूछें।");
      reply(data.answer);
    } catch (error) {
      setAssistantError(error.message || "अभी जवाब नहीं मिल पाया। फिर कोशिश करें।");
    } finally {
      setAssistantBusy(false);
    }
  };

  const startListening = () => {
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition) {
      setAssistantError("इस browser में आवाज़ पहचान उपलब्ध नहीं है। नीचे अपना सवाल लिखकर पूछें।");
      return;
    }
    setAssistantError("");
    setAssistantAnswer("");
    stopSpeaking();
    setAssistantTalking(false);
    const recognition = new Recognition();
    recognition.lang = "hi-IN";
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    let transcript = "";
    recognitionRef.current = recognition;
    setAssistantListening(true);
    recognition.onerror = (event) => {
      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        setAssistantError("माइक permission बंद है। Browser settings में Microphone को Allow करें।");
      } else if (event.error === "no-speech") {
        setAssistantError("आवाज़ सुनाई नहीं दी। माइक के पास बोलकर फिर कोशिश करें।");
      } else if (event.error !== "aborted") {
        setAssistantError("आवाज़ समझ नहीं आई। दोबारा बोलें या सवाल लिखें।");
      }
    };
    recognition.onend = () => {
      setAssistantListening(false);
      recognitionRef.current = null;
      if (transcript) askAssistant(transcript, true);
    };
    recognition.onresult = (event) => {
      const recognized = event.results?.[0]?.[0]?.transcript?.trim();
      if (recognized) {
        transcript = recognized;
        setAssistantQuestion(recognized);
      }
    };
    try {
      recognition.start();
    } catch {
      recognitionRef.current = null;
      setAssistantListening(false);
      setAssistantError("माइक चालू नहीं हुआ। थोड़ी देर बाद फिर कोशिश करें।");
    }
  };

  const stopListening = () => recognitionRef.current?.stop();

  const d = res && DISEASES[res.label];
  const unknown = res && !d;
  const sick = d && res.label !== "healthy";

  return (
    <div className="mx-auto min-h-screen max-w-md pb-10">
      <header className="flex items-center justify-between bg-pine px-5 py-4 text-mist">
        <div>
          <h1 className="text-2xl font-extrabold">अन्नदृष्टि</h1>
          <p className="flex items-center gap-1 text-sm text-mist/80"><MapPin size={14} />{user.name}, {user.district}</p>
        </div>
        <div className="flex items-center gap-3">
          {canInstall && <button onClick={onInstall} aria-label="ऐप इंस्टॉल करें" title="ऐप इंस्टॉल करें"><Download /></button>}
          <button onClick={onOpenProfile} aria-label="किसान प्रोफ़ाइल खोलें" title="किसान प्रोफ़ाइल">
            <UserRound />
          </button>
          <button onClick={onLogout} aria-label="बाहर निकलें"><LogOut /></button>
        </div>
      </header>

      <main className="space-y-4 px-4 pt-4">
        <div className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm font-semibold ${online ? "bg-white text-pine" : "bg-straw/20 text-apple"}`}>
          <span className="flex items-center gap-2">
            {online ? <Wifi size={18} /> : <WifiOff size={18} />}
            {online ? "ऑनलाइन" : "ऑफ़लाइन मोड"}
            {queueCount > 0 && ` · ${queueCount} फ़ोटो जाँच के लिए सहेजी`}
          </span>
          {online && queueCount > 0 && (
            <button onClick={() => setQueueSyncVersion((version) => version + 1)} disabled={queueSyncing}
              className="flex items-center gap-1 underline disabled:opacity-60">
              <RefreshCw size={14} className={queueSyncing ? "animate-spin" : ""} /> फिर जाँचें
            </button>
          )}
        </div>
        {offlineNotice && <p role="status" className="rounded-lg bg-white p-3 text-sm">{offlineNotice}</p>}
        <input ref={galRef} type="file" accept="image/*" hidden onChange={pick} />
        <section className="rounded-2xl border border-pine/15 bg-white p-4">
          <h2 className="flex items-center gap-2 text-xl font-extrabold"><Mic size={21} /> बोलकर पूछें</h2>
          <p className="mt-1 text-sm text-pine/70">खेती का सवाल पूछें या कहें: “फोटो खींचो”, “मेरी प्रोफ़ाइल खोलो”, “मौसम बताओ”।</p>
          <div className="mt-3 flex gap-2">
            <input value={assistantQuestion} onChange={(event) => setAssistantQuestion(event.target.value)}
              onKeyDown={(event) => { if (event.key === "Enter") askAssistant(assistantQuestion); }}
              placeholder="जैसे: सेब के पत्ते पर धब्बे क्यों हैं?"
              className="min-w-0 flex-1 rounded-lg border border-pine/20 px-3 py-2" />
            <button onClick={() => askAssistant(assistantQuestion)} disabled={!assistantQuestion.trim() || assistantBusy}
              aria-label="सवाल भेजें" className="rounded-lg bg-pine p-3 text-white disabled:opacity-50">
              <Send size={19} />
            </button>
          </div>
          <div className="mt-2 flex items-center gap-2">
            <button onClick={assistantListening ? stopListening : startListening}
              disabled={assistantBusy}
              className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-3 font-bold text-white disabled:opacity-50 ${assistantListening ? "bg-apple" : "bg-pine"}`}>
              {assistantListening ? <Square size={18} /> : <Mic size={19} />}
              {assistantListening ? "सुनना बंद करें" : "बोलकर पूछें"}
            </button>
            {assistantAnswer && voiceSupported() && (
              <button onClick={() => {
                if (assistantTalking) {
                  stopSpeaking();
                  setAssistantTalking(false);
                } else {
                  answerOutLoud(assistantAnswer);
                }
              }} aria-label={assistantTalking ? "जवाब सुनना बंद करें" : "जवाब फिर से सुनें"}
                className="rounded-lg border border-pine p-3 text-pine"><Volume2 size={19} /></button>
            )}
          </div>
          {assistantListening && <p role="status" className="mt-2 text-sm font-semibold text-pine">सुन रही हूँ… अब हिंदी में बोलें।</p>}
          {assistantBusy && <p role="status" className="mt-2 text-sm text-pine/70">आपके सवाल का जवाब ढूँढ़ रही हूँ...</p>}
          {assistantAnswer && <p className="mt-3 rounded-lg bg-mist p-3 leading-relaxed">{assistantAnswer}</p>}
          {assistantError && <p role="alert" className="mt-2 text-sm font-semibold text-apple">{assistantError}</p>}
        </section>
        <div className="flex gap-3">
          <motion.button whileTap={{ scale: 0.97 }} onClick={openCamera}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-pine p-5 text-lg font-bold text-white">
            <Camera /> फ़ोटो खींचें
          </motion.button>
          <motion.button whileTap={{ scale: 0.97 }} onClick={() => galRef.current.click()}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl border-2 border-pine p-5 text-lg font-bold text-pine">
            <ImageUp /> गैलरी से
          </motion.button>
        </div>

        {preview && <img src={preview} alt="चुनी हुई फ़ोटो" className="h-56 w-full rounded-xl object-cover" />}

        {warn.length > 0 && (
          <motion.div animate={{ x: [0, -8, 8, -4, 0] }} className="rounded-xl border-2 border-straw bg-white p-4">
            <p className="mb-1 flex items-center gap-2 font-bold"><AlertTriangle className="text-straw" /> फ़ोटो साफ़ नहीं है</p>
            {warn.map((w) => <p key={w}>{w}</p>)}
            <button onClick={() => run(file)} className="mt-3 font-semibold text-pine underline">फिर भी जाँचें</button>
          </motion.div>
        )}

        {busy && (
          <div className="rounded-xl bg-white p-5 text-center font-semibold">
            <motion.div className="mx-auto mb-3 h-1 rounded bg-pine" animate={{ width: ["10%", "90%", "10%"] }} transition={{ duration: 1.6, repeat: Infinity }} />
            AI पत्ते को देख रहा है...
          </div>
        )}

        {err && <p className="rounded-xl bg-white p-4 font-semibold text-apple">{err}</p>}
        {historyError && <p role="alert" className="rounded-xl bg-white p-4 text-sm font-semibold text-apple">{historyError} किसान प्रोफ़ाइल में इतिहास देखें।</p>}
        {unknown && <p className="rounded-xl bg-white p-4 font-semibold">यह सेब या आलू के पत्ते की फ़ोटो नहीं लगती। पत्ते की साफ़ फ़ोटो दोबारा लें।</p>}

        {d && <Result res={res} spray={spray} />}
        {sick && <Treatment label={res.label} />}

        <WeatherRiskAlert
          risk={weatherRisk}
          loading={weatherRiskLoading}
          error={weatherRiskError}
          onRetry={() => setWeatherRefresh((value) => value + 1)}
        />
        <SprayWindow spray={spray} error={sprayErr} />
        <Roadmap />
      </main>

      {cameraOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" role="dialog" aria-modal="true" aria-label="पत्ते की फ़ोटो खींचें">
          <section className="w-full max-w-lg rounded-2xl bg-mist p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-xl font-extrabold">पत्ते की फ़ोटो खींचें</h2>
              <button onClick={stopCamera} aria-label="कैमरा बंद करें" className="rounded-lg p-2"><X /></button>
            </div>
            {cameraStream.current
              ? <video ref={videoRef} autoPlay playsInline muted className="max-h-[65vh] w-full rounded-xl bg-black object-contain" />
              : <p className="rounded-xl bg-white p-4 text-apple">{cameraError}</p>}
            {cameraError && cameraStream.current && <p role="alert" className="mt-2 text-sm text-apple">{cameraError}</p>}
            <div className="mt-3 flex gap-3">
              {cameraStream.current && (
                <button onClick={capturePhoto} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-pine p-3 font-bold text-white">
                  <Camera size={20} /> फ़ोटो खींचें
                </button>
              )}
              <button onClick={() => { stopCamera(); galRef.current.click(); }}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl border-2 border-pine p-3 font-bold text-pine">
                <ImageUp size={20} /> गैलरी से चुनें
              </button>
              {cameraError && cameraStream.current && (
                <button onClick={() => { stopCamera(); openCamera(); }} aria-label="कैमरा फिर शुरू करें"
                  className="rounded-xl border border-pine p-3 text-pine"><RotateCcw size={20} /></button>
              )}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
