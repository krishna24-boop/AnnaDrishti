import { useEffect, useState } from "react";
import { ArrowLeft, CalendarDays, Leaf, LogOut, MapPin, Phone, Sprout } from "lucide-react";
import CropHistory from "./CropHistory";
import { getCropHistory } from "./history";

export default function FarmerProfile({ user, onBack, onLogout }) {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [stale, setStale] = useState(false);
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    getCropHistory(user.phone)
      .then(({ records: history, stale: cached }) => {
        if (active) {
          setRecords(history);
          setStale(cached);
          setError("");
        }
      })
      .catch((cause) => {
        if (active) setError(cause.message || "किसान का इतिहास लोड नहीं हुआ।");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [user.phone, refresh]);

  const activeDiseases = records.filter((record) => record.label !== "healthy" && record.label !== "unknown").length;
  const pendingFollowUps = records.filter((record) => record.follow_up_at && !record.follow_up_done).length;

  return (
    <div className="mx-auto min-h-screen max-w-2xl pb-10">
      <header className="flex items-center justify-between bg-pine px-5 py-4 text-mist">
        <button onClick={onBack} className="flex items-center gap-2 font-semibold" aria-label="मुख्य डैशबोर्ड पर वापस जाएँ">
          <ArrowLeft /> वापस
        </button>
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-extrabold">किसान प्रोफ़ाइल</h1>
          <button onClick={onLogout} aria-label="बाहर निकलें"><LogOut /></button>
        </div>
      </header>

      <main className="space-y-4 px-4 pt-4">
        <section className="rounded-2xl bg-pine p-5 text-mist">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-mist/15 p-3"><Leaf size={30} /></div>
            <div>
              <h2 className="text-2xl font-extrabold">{user.name}</h2>
              <p className="mt-1 flex items-center gap-2 text-sm text-mist/80"><Phone size={15} /> {user.phone}</p>
            </div>
          </div>
          <div className="mt-5 grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-mist/10 p-3">
              <p className="flex items-center gap-2 text-sm text-mist/75"><MapPin size={15} /> ज़िला</p>
              <p className="mt-1 font-bold">{user.district}</p>
            </div>
            <div className="rounded-xl bg-mist/10 p-3">
              <p className="flex items-center gap-2 text-sm text-mist/75"><Sprout size={15} /> मुख्य फ़सल</p>
              <p className="mt-1 font-bold">{user.crop === "Aloo" ? "आलू" : "सेब"}</p>
            </div>
          </div>
        </section>

        <section className="grid grid-cols-3 gap-2">
          <div className="rounded-xl border border-pine/15 bg-white p-3 text-center">
            <p className="text-2xl font-extrabold text-pine">{records.length}</p>
            <p className="text-xs text-pine/70">कुल जाँच</p>
          </div>
          <div className="rounded-xl border border-pine/15 bg-white p-3 text-center">
            <p className="text-2xl font-extrabold text-apple">{activeDiseases}</p>
            <p className="text-xs text-pine/70">रोग जाँच</p>
          </div>
          <div className="rounded-xl border border-pine/15 bg-white p-3 text-center">
            <p className="text-2xl font-extrabold text-straw">{pendingFollowUps}</p>
            <p className="text-xs text-pine/70">फ़ॉलो-अप</p>
          </div>
        </section>

        <CropHistory
          farmerId={user.phone}
          records={records}
          loading={loading}
          error={error}
          stale={stale}
          onReload={() => setRefresh((version) => version + 1)}
        />
        <p className="flex items-start gap-2 px-1 text-xs text-pine/70">
          <CalendarDays size={15} className="mt-0.5 shrink-0" />
          फ़सल की जाँच, फोटो, उपचार नोट और फ़ॉलो-अप इसी प्रोफ़ाइल में मिलेंगे।
        </p>
      </main>
    </div>
  );
}
