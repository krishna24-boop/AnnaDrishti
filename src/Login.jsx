import { useState } from "react";
import { motion } from "framer-motion";
import { Leaf } from "lucide-react";
import { COORDS } from "./data";

const inputCls = "mt-1 mb-4 w-full rounded-lg border border-pine/20 bg-white p-3 text-lg";

export default function Login({ onLogin }) {
  const [f, setF] = useState({ name: "", phone: "", district: "Dehradun", crop: "Seb" });
  const [err, setErr] = useState("");
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const submit = () => {
    if (f.name.trim().length < 2) return setErr("अपना नाम लिखें");
    if (!/^[6-9]\d{9}$/.test(f.phone)) return setErr("सही 10 अंकों का मोबाइल नंबर डालें");
    setErr("");
    onLogin(f);
  };

  return (
    <div className="mx-auto min-h-screen max-w-md bg-pine px-5 pt-14 pb-8">
      <div className="flex items-center gap-2 text-mist">
        <Leaf size={30} />
        <h1 className="text-4xl font-extrabold">अन्नदृष्टि</h1>
      </div>
      <p className="mt-1 mb-8 text-mist/80">पहाड़ की फ़सल पर AI की नज़र</p>

      <div className="rounded-t-3xl rounded-b-lg bg-mist p-5">
        <label className="font-semibold">नाम</label>
        <input className={inputCls} value={f.name} onChange={set("name")} placeholder="आपका नाम" />
        <label className="font-semibold">मोबाइल नंबर</label>
        <input className={inputCls} inputMode="numeric" maxLength={10} value={f.phone}
          onChange={(e) => setF({ ...f, phone: e.target.value.replace(/\D/g, "") })} placeholder="10 अंकों का नंबर" />
        <label className="font-semibold">ज़िला</label>
        <select className={inputCls} value={f.district} onChange={set("district")}>
          {Object.keys(COORDS).map((d) => <option key={d}>{d}</option>)}
        </select>
        <label className="font-semibold">मुख्य फ़सल</label>
        <select className={inputCls} value={f.crop} onChange={set("crop")}>
          <option value="Seb">सेब</option>
          <option value="Aloo">आलू</option>
        </select>
        {err && <motion.p animate={{ x: [0, -8, 8, -4, 0] }} className="mb-3 font-semibold text-apple">{err}</motion.p>}
        <motion.button whileTap={{ scale: 0.97 }} onClick={submit}
          className="w-full rounded-lg bg-pine p-4 text-xl font-bold text-white">
          शुरू करें
        </motion.button>
      </div>
    </div>
  );
}
