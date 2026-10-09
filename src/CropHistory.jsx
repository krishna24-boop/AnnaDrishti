import { useState } from "react";
import { CalendarClock, Check, Clock3, RefreshCw, Save } from "lucide-react";
import { DISEASES } from "./data";
import { updateCropHistory } from "./history";

const localDateTime = (value) => {
  if (!value) return "";
  const date = new Date(value);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
};

const formattedDate = (value) => new Date(value).toLocaleString("hi-IN", {
  dateStyle: "medium",
  timeStyle: "short",
});

function HistoryEntry({ record, farmerId, onUpdated }) {
  const [notes, setNotes] = useState(record.treatment_notes || "");
  const [followUp, setFollowUp] = useState(localDateTime(record.follow_up_at));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");
  const disease = DISEASES[record.label]?.hi || record.label;
  const photoUrl = `/api/history/${encodeURIComponent(record.id)}/photo?farmer_id=${encodeURIComponent(farmerId)}`;
  const due = record.follow_up_at && !record.follow_up_done && new Date(record.follow_up_at) <= new Date();

  const save = async (fields) => {
    setBusy(true);
    setError("");
    setSaved("");
    try {
      await updateCropHistory(record.id, { farmer_id: farmerId, ...fields });
      setSaved("इतिहास सेव हो गया।");
      onUpdated();
    } catch (e) {
      setError(e.message || "इतिहास सेव नहीं हुआ।");
    } finally {
      setBusy(false);
    }
  };

  return (
    <article className="rounded-xl border border-pine/15 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-bold">{disease}</p>
          <p className="text-sm text-pine/70">{record.crop === "Aloo" ? "आलू" : "सेब"} · भरोसा {record.confidence}%</p>
          <p className="mt-1 flex items-center gap-1 text-sm text-pine/70">
            <Clock3 size={14} /> {formattedDate(record.created_at)}
          </p>
        </div>
        {record.follow_up_at && (
          <span className={`rounded-full px-2 py-1 text-xs font-bold ${record.follow_up_done ? "bg-pine/10 text-pine" : due ? "bg-apple/10 text-apple" : "bg-straw/20 text-pine"}`}>
            {record.follow_up_done ? "पूरा" : due ? "फ़ॉलो-अप बाकी" : "फ़ॉलो-अप"}
          </span>
        )}
      </div>

      {record.has_photo && (
        <img src={photoUrl} alt={`${disease} की अपलोड की गई फ़ोटो`}
          className="mt-3 h-40 w-full rounded-lg object-cover" loading="lazy" />
      )}
      {record.reason && <p className="mt-3 text-sm">{record.reason}</p>}

      <label className="mt-4 block text-sm font-semibold">
        उपचार / निरीक्षण नोट
        <textarea value={notes} onChange={(event) => setNotes(event.target.value)} maxLength={2000}
          placeholder="खेत में क्या देखा या क्या उपचार किया?"
          className="mt-1 w-full rounded-lg border border-pine/20 p-3" rows={3} />
      </label>
      <div className="mt-3 flex flex-wrap items-end gap-2">
        <label className="min-w-0 flex-1 text-sm font-semibold">
          फ़ॉलो-अप तारीख़
          <input type="datetime-local" value={followUp} onChange={(event) => setFollowUp(event.target.value)}
            className="mt-1 w-full rounded-lg border border-pine/20 p-2" />
        </label>
        <button onClick={() => save({
          treatment_notes: notes,
          follow_up_at: followUp ? new Date(followUp).toISOString() : null,
          ...(followUp ? { follow_up_done: false } : {}),
        })} disabled={busy}
          className="flex items-center gap-2 rounded-lg bg-pine px-3 py-2 font-semibold text-white disabled:opacity-60">
          <Save size={16} /> सेव
        </button>
        {record.follow_up_at && !record.follow_up_done && (
          <button onClick={() => save({ follow_up_done: true })} disabled={busy}
            className="flex items-center gap-2 rounded-lg border border-pine px-3 py-2 font-semibold text-pine disabled:opacity-60">
            <Check size={16} /> पूरा
          </button>
        )}
      </div>
      {error && <p role="alert" className="mt-2 text-sm text-apple">{error}</p>}
      {saved && <p role="status" className="mt-2 text-sm text-pine">{saved}</p>}
    </article>
  );
}

export default function CropHistory({ farmerId, records, loading, error, stale, onReload }) {
  const dueCount = records.filter((record) => record.follow_up_at
    && !record.follow_up_done && new Date(record.follow_up_at) <= new Date()).length;

  return (
    <section className="rounded-2xl border border-pine/15 bg-mist p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-extrabold">फ़सल की सेहत का इतिहास</h2>
          <p className="text-sm text-pine/70">जाँच, फ़ोटो और फ़ॉलो-अप की समयरेखा</p>
        </div>
        <button onClick={onReload} disabled={loading} aria-label="इतिहास फिर से लोड करें"
          className="rounded-lg p-2 text-pine disabled:opacity-50">
          <RefreshCw size={19} className={loading ? "animate-spin" : ""} />
        </button>
      </div>

      {dueCount > 0 && (
        <p className="mt-3 flex items-center gap-2 rounded-lg bg-apple/10 p-3 font-semibold text-apple">
          <CalendarClock size={18} /> {dueCount} फ़ॉलो-अप याद{dueCount === 1 ? "दिलानी है" : "दिलाने हैं"}
        </p>
      )}
      {stale && <p className="mt-3 text-sm font-semibold text-straw">ऑफ़लाइन: डिवाइस पर सहेजा पुराना इतिहास</p>}
      {error && <p role="alert" className="mt-3 rounded-lg bg-white p-3 text-sm text-apple">{error}</p>}
      {loading && <p className="mt-3 text-pine/70">आपका इतिहास लोड हो रहा है...</p>}
      {!loading && !error && records.length === 0 && (
        <p className="mt-3 rounded-lg bg-white p-3 text-sm">अभी कोई पुरानी जाँच नहीं है। पहली फ़सल जाँच के बाद उसकी फ़ोटो और नतीजा यहाँ दिखेगा।</p>
      )}
      {records.length > 0 && (
        <div className="mt-3 space-y-3">
          {records.map((record) => (
            <HistoryEntry key={record.id} record={record} farmerId={farmerId} onUpdated={onReload} />
          ))}
        </div>
      )}
    </section>
  );
}
