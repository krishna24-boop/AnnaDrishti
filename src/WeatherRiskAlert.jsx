import { AlertTriangle, CloudRain, RefreshCw } from "lucide-react";

const STYLES = {
  high: "border-apple/40 bg-apple/5",
  watch: "border-straw/60 bg-straw/10",
  low: "border-pine/20 bg-white",
};

const TITLES = {
  high: "मौसम से फसल-जोखिम अधिक",
  watch: "मौसम पर नज़र रखें",
  low: "अभी मौसम का जोखिम कम",
};

export default function WeatherRiskAlert({ risk, loading, error, onRetry }) {
  return (
    <section className={`rounded-2xl border p-5 ${risk ? STYLES[risk.risk_level] : "border-pine/15 bg-white"}`}>
      <h3 className="flex items-center gap-2 text-xl font-extrabold">
        <CloudRain size={22} /> मौसम और फसल-जोखिम
      </h3>
      {loading && <p className="mt-2 text-pine/70">ताज़ा मौसम संकेत देख रहे हैं...</p>}
      {error && (
        <div className="mt-2">
          <p className="text-apple">{error}</p>
          <button onClick={onRetry} className="mt-2 flex items-center gap-2 font-semibold text-pine underline">
            <RefreshCw size={16} /> फिर से देखें
          </button>
        </div>
      )}
      {risk && !loading && (
        <div className="mt-2">
          <p className="flex items-center gap-2 font-bold">
            {risk.risk_level === "high" && <AlertTriangle size={18} />}
            {TITLES[risk.risk_level] || TITLES.watch}
          </p>
          <p className="mt-1">{risk.message}</p>
          <p className="mt-2 text-sm text-pine/70">
            {risk.risk_hours} अनुकूल मौसम घंटे · जाँच: {new Date(risk.checked_at).toLocaleTimeString("hi-IN", { hour: "numeric", minute: "2-digit" })}
          </p>
          {risk.stale && <p className="mt-1 text-sm font-semibold text-straw">ऑफ़लाइन: पिछला सहेजा हुआ मौसम संकेत</p>}
          <p className="mt-2 text-xs text-pine/70">{risk.disclaimer}</p>
        </div>
      )}
    </section>
  );
}
