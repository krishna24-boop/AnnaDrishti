// District HQ ke approximate coordinates. Final karne se pehle Google Maps se verify karein.
export const COORDS = {
  Almora: [29.6, 79.66], Bageshwar: [29.84, 79.77], Chamoli: [30.41, 79.32],
  Champawat: [29.34, 80.09], Dehradun: [30.32, 78.03], Haridwar: [29.95, 78.16],
  Nainital: [29.38, 79.46], "Pauri Garhwal": [30.15, 78.78], Pithoragarh: [29.58, 80.22],
  Rudraprayag: [30.28, 78.98], "Tehri Garhwal": [30.38, 78.43],
  "Udham Singh Nagar": [28.98, 79.4], Uttarkashi: [30.73, 78.45],
};

// ===== TREATMENT DATA: SIRF VERIFIED JAANKARI BHARNA =====
// Har bimari mein do optional blocks hain. null rehne par app KVK se poochhne ko kehta hai.
//   jaivik:    { naam: "...", vidhi: "...", source: "ICAR/KVK ka document + saal" }
//   rasayanik: { naam: "...", matra: "...", kharch: "...", source: "CIB&RC / ICAR / KVK + saal" }
// "source" bharna zaroori hai: wahi screen par dikhta hai, aur video mein aapko jawab dene mein kaam aata hai.
// Dawai ka naam ya matra yaad se ya AI se mat likhein; sirf official advisory se copy karein.
export const DISEASES = {
  apple_scab: {
    hi: "सेब का स्कैब (पपड़ी रोग)",
    steps: ["संक्रमित पत्ते और गिरे हुए फल इकट्ठा करके खेत से हटाएँ", "छँटाई करें ताकि पेड़ में हवा और धूप पहुँचे", "ऊपर से पानी देने से बचें"],
    jaivik: null, rasayanik: null,
  },
  apple_black_rot: {
    hi: "सेब का ब्लैक रॉट (काला सड़न)",
    steps: ["सूखे, सड़े फल और रोगी टहनियाँ काटकर हटाएँ", "कटाई-छँटाई के औज़ार साफ़ रखें", "पेड़ के नीचे सफ़ाई रखें"],
    jaivik: null, rasayanik: null,
  },
  cedar_apple_rust: {
    hi: "सेब का रस्ट (जंग रोग)",
    steps: ["रोगी पत्ते हटाएँ", "आसपास जुनिपर जैसे मेज़बान पौधे हों तो हटाने के बारे में KVK से पूछें", "पेड़ों के बीच हवा का रास्ता रखें"],
    jaivik: null, rasayanik: null,
  },
  potato_early_blight: {
    hi: "आलू का अगेती झुलसा",
    steps: ["नीचे के रोगी पत्ते तोड़कर हटाएँ", "हर साल खेत में फ़सल बदलकर बोएँ", "खाद-पानी संतुलित रखें, पौधे को कमज़ोर न होने दें"],
    jaivik: null, rasayanik: null,
  },
  potato_late_blight: {
    hi: "आलू का पछेती झुलसा",
    steps: ["बादल और नमी में यह तेज़ी से फैलता है, खेत की रोज़ निगरानी करें", "रोगी पौधे तुरंत उखाड़कर दूर फेंकें", "प्रमाणित बीज ही इस्तेमाल करें"],
    jaivik: null, rasayanik: null,
  },
  healthy: { hi: "पत्ता स्वस्थ दिख रहा है", steps: [], jaivik: null, rasayanik: null },
};
