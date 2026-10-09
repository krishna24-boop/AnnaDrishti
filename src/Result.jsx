import { useState } from "react";
import { motion } from "framer-motion";
import { Volume2, Square } from "lucide-react";
import { DISEASES } from "./data";
import { speak, stopSpeaking, hasHindiVoice, voiceSupported } from "./lib";

export default function Result({ res, spray }) {
  const [talking, setTalking] = useState(false);
  const [noVoice, setNoVoice] = useState(false);
  const d = DISEASES[res.label];
  const sick = res.label !== "healthy";
  const low = res.confidence < 70;

  const say = () => {
    if (talking) { stopSpeaking(); setTalking(false); return; }
    const p = [d.hi];
    if (res.reason) p.push(res.reason);
    if (low) p.push("पक्का नहीं है, कृपया कृषि विज्ञान केंद्र से मिलें");
    if (sick && spray?.best) p.push(`छिड़काव के लिए ${spray.best.label} ठीक रहेगा`);
    setNoVoice(!hasHindiVoice());
    setTalking(speak(p.join(". "), () => setTalking(false)));
  };

  return (
    <motion.section initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
      className="rounded-2xl border border-pine/15 bg-white p-5">
      {res.demo && <p className="mb-2 inline-block rounded bg-straw px-2 text-sm font-bold">DEMO MODE: यह नक़ली नतीजा है</p>}
      <h2 className={`text-2xl font-extrabold ${sick ? "text-apple" : "text-pine"}`}>{d.hi}</h2>

      <div className="mt-3 h-2.5 rounded-full bg-pine/10">
        <motion.div className={`h-full rounded-full ${low ? "bg-straw" : "bg-pine"}`}
          initial={{ width: 0 }} animate={{ width: `${res.confidence}%` }} transition={{ duration: 0.8, delay: 0.2 }} />
      </div>
      <p className="mt-1 text-sm text-pine/70">भरोसा: {res.confidence}%</p>

      {res.reason && <p className="mt-3">{res.reason}</p>}
      {low && (
        <p className="mt-3 rounded-lg bg-straw/20 p-3 font-semibold">
          AI को पक्का भरोसा नहीं है। नज़दीकी कृषि विज्ञान केंद्र (KVK) या कृषि विभाग से मिलें।
        </p>
      )}

      {voiceSupported() && (
        <button onClick={say} className="mt-4 flex items-center gap-2 rounded-lg border-2 border-pine px-4 py-2 font-bold text-pine">
          {talking ? <Square size={18} /> : <Volume2 size={20} />} {talking ? "रोकें" : "हिंदी में सुनें"}
        </button>
      )}
      {noVoice && (
        <p className="mt-2 text-sm text-pine/70">इस फ़ोन/ब्राउज़र में हिंदी आवाज़ नहीं मिली, आवाज़ अंग्रेज़ी लहजे में आ सकती है।</p>
      )}
    </motion.section>
  );
}
