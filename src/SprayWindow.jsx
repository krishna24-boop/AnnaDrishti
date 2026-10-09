import { motion } from "framer-motion";
import { CloudRain } from "lucide-react";

export default function SprayWindow({ spray, error }) {
  return (
    <section className="rounded-2xl border border-pine/15 bg-white p-5">
      <h3 className="flex items-center gap-2 text-xl font-extrabold"><CloudRain size={22} /> छिड़काव का सही समय</h3>
      {error && <p className="mt-2 text-apple">मौसम की जानकारी नहीं मिली। इंटरनेट देखें।</p>}
      {!spray && !error && <p className="mt-2 text-pine/70">मौसम देख रहे हैं...</p>}
      {spray && (
        <>
          {spray.stale && <p className="mt-2 text-sm font-semibold text-straw">ऑफ़लाइन: पिछला सहेजा हुआ पूर्वानुमान</p>}
          <p className="mt-1 mb-3 font-semibold">
            {spray.best ? `${spray.best.label} छिड़काव करें` : "अगले 2 दिन में छिड़काव के लिए साफ़ समय नहीं मिला"}
          </p>
          {spray.days.map((day) => (
            <div key={day.label} className="mb-3">
              <p className="mb-1 text-sm font-semibold text-pine/70">{day.label} (सुबह 6 से शाम 6)</p>
              <div className="flex gap-1">
                {day.hours.map((x, i) => {
                  const inBest = spray.best && spray.best.day === day.label && x.h >= spray.best.from && x.h <= spray.best.to;
                  return (
                    <motion.div key={x.h} title={`बारिश ${x.rain}%, हवा ${x.wind} km/h`}
                      initial={{ scaleY: 0 }} animate={{ scaleY: 1 }} transition={{ delay: i * 0.03 }}
                      className={`h-9 flex-1 rounded-sm ${x.past ? "bg-stone-100" : x.ok ? "bg-pine" : "bg-stone-300"} ${inBest ? "ring-2 ring-straw ring-offset-1" : ""}`} />
                  );
                })}
              </div>
            </div>
          ))}
          <p className="text-sm text-pine/70">गहरा हरा = बारिश कम और हवा धीमी। पीला घेरा = सबसे अच्छा समय।</p>
        </>
      )}
    </section>
  );
}
