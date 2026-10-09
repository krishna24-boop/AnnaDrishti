import { motion } from "framer-motion";
import { Leaf, FlaskConical } from "lucide-react";
import { DISEASES } from "./data";

const item = { hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0 } };
const Src = ({ s }) => <p className="mt-1 text-xs text-pine/60">स्रोत: {s}</p>;

export default function Treatment({ label }) {
  const d = DISEASES[label];
  const { jaivik, rasayanik, steps } = d;
  return (
    <motion.section initial="hidden" animate="show" variants={{ show: { transition: { staggerChildren: 0.15 } } }}
      className="space-y-5 rounded-lg border border-pine/15 bg-white p-5">
      <div>
        <h3 className="mb-2 text-xl font-extrabold">पहले ये करें (बिना दवा)</h3>
        <ul className="space-y-2">
          {steps.map((s) => (
            <motion.li key={s} variants={item} className="border-l-4 border-pine pl-3">{s}</motion.li>
          ))}
        </ul>
      </div>

      {jaivik && (
        <motion.div variants={item}>
          <h3 className="mb-1 flex items-center gap-2 text-xl font-extrabold"><Leaf size={20} className="text-pine" /> जैविक उपाय</h3>
          <p className="font-semibold">{jaivik.naam}</p>
          <p>{jaivik.vidhi}</p>
          <Src s={jaivik.source} />
        </motion.div>
      )}

      <motion.div variants={item}>
        <h3 className="mb-1 flex items-center gap-2 text-xl font-extrabold"><FlaskConical size={20} className="text-apple" /> रासायनिक दवा</h3>
        {rasayanik ? (
          <dl className="space-y-1">
            <div><dt className="inline font-semibold">दवा: </dt><dd className="inline">{rasayanik.naam}</dd></div>
            <div><dt className="inline font-semibold">मात्रा: </dt><dd className="inline">{rasayanik.matra}</dd></div>
            <div><dt className="inline font-semibold">अनुमानित खर्च: </dt><dd className="inline">{rasayanik.kharch}</dd></div>
            <Src s={rasayanik.source} />
            <p className="mt-2 text-sm font-semibold text-apple">लेबल पढ़कर और सुरक्षा के साथ छिड़कें। कटाई से पहले का इंतज़ार-समय ज़रूर देखें।</p>
          </dl>
        ) : (
          <p>दवा और मात्रा अपने KVK या कृषि विभाग से पूछकर ही डालें।</p>
        )}
      </motion.div>
    </motion.section>
  );
}
