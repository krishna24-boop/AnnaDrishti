import { Radar, MapPinned, CalendarDays } from "lucide-react";

// Round 1 mein ye sirf "aage aane wale" feature hain. Koi nakli data nahi dikhaya jaata.
const ITEMS = [
  { Icon: Radar, t: "रोग रडार", d: "आपके इलाक़े में कौन सा रोग फैल रहा है" },
  { Icon: MapPinned, t: "नज़दीकी KVK", d: "नक़्शे पर सबसे पास का कृषि विज्ञान केंद्र" },
  { Icon: CalendarDays, t: "फ़सल कैलेंडर", d: "मौसम के हिसाब से छिड़काव की याद" },
];

export default function Roadmap() {
  return (
    <section className="rounded-2xl border border-dashed border-pine/30 p-5">
      <h3 className="mb-3 text-lg font-extrabold text-pine/80">जल्द आ रहा है</h3>
      <ul className="space-y-3">
        {ITEMS.map(({ Icon, t, d }) => (
          <li key={t} className="flex items-start gap-3 opacity-70">
            <Icon size={22} className="mt-0.5 shrink-0 text-pine" />
            <div><p className="font-semibold">{t}</p><p className="text-sm">{d}</p></div>
          </li>
        ))}
      </ul>
    </section>
  );
}
