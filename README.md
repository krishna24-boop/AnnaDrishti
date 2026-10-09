# AnnaDrishti AI (Round 1 prototype)

## Chalane ka tareeka
Terminal 1 (backend):
    cd backend && python -m venv venv && venv\Scripts\activate   (Mac/Linux: source venv/bin/activate)
    pip install -r requirements.txt
    copy .env.example .env   -> .env mein GEMINI_API_KEY daalein (free, aistudio.google.com/apikey)
    .env mein MONGODB_URI aur MONGODB_DATABASE set karein; Atlas Network Access mein apna IP allow karein.
    uvicorn main:app --reload --port 8000
    (check: http://localhost:8000/api/health  ->  "demo": false hona chahiye)

Terminal 2 (frontend):
    npm install
    npm run dev      -> http://localhost:5173  (phone-size window mein kholein)
    npm run build    -> production PWA (service worker + offline app shell)
    npm run preview  -> production build ko localhost par test karein

## Offline / PWA
- Online रहते app shell service worker में cache होता है; बाद में app बिना internet खुल सकता है.
- पिछला weather forecast IndexedDB में रहता है और offline पर stale बताकर दिखता है.
- Offline ली गई crop photos IndexedDB queue में रहती हैं; internet लौटने और app खुले होने पर diagnosis अपने-आप retry होता है.
- `फ़ोटो खींचें` live browser camera preview खोलता है; camera permission allow karein. Camera unavailable/denied ho to isi screen se gallery चुनें.
- Hindi voice assistant browser ke `SpeechRecognition` se sawal/commands leta hai, kheti ke jawab Gemini backend se deta hai, aur maujooda Hindi speech synthesis se jawab bolta hai. Voice commands: `फोटो खींचो`, `मेरी प्रोफ़ाइल खोलो`, `मौसम बताओ`, `जाँच बताओ`. Browser mic permission/recognition available na ho to text box use karein.
- Crop history MongoDB Atlas ki `crop_history` collection mein save hota hai; har record existing farmer phone number se scope hota hai. Diagnosis photo same record ke saath save hoti hai.
- History screen par purane diagnosis, photos, treatment/inspection notes aur due follow-up reminders milte hain; dekhi hui photos offline cache hoti hain.
- Phone number abhi verify/OTP nahi hota. Yeh prototype partitioning hai, secure login nahi; real farmer data ke liye OTP/authentication aur production privacy controls zaroori hain.
- Production PWA को install करने के लिए HTTPS या localhost इस्तेमाल करें. `npm run build` के बाद `npm run preview` से service worker जाँचें.
- `npm run dev` development ke liye hai; offline app-shell/PWA behavior build + preview/deployment par test karein.
- Pending photos उसी browser/device पर रहती हैं; diagnosis server पर तभी जाती है जब connection वापस आता है.

## Render par deploy
- Project ke GitHub repo ko Render Blueprint ke roop mein connect karein; `render.yaml` Docker-based web service define karta hai.
- Setup ke waqt `GEMINI_API_KEY` aur `MONGODB_URI` Render dashboard mein secret environment variables ke roop mein set karein. Inhe GitHub ya `render.yaml` mein commit na karein.
- MongoDB Atlas Network Access mein Render ke outbound IPs allow karein; Atlas par `0.0.0.0/0` sirf tab use karein jab is prototype ke liye us risk ko samajhkar accept karein.
- Render service frontend aur API dono ko ek HTTPS origin se serve karti hai. Free instance kuch der idle rehne par sleep ho sakta hai; pehli request ko start hone mein waqt lag sakta hai.

## Files
- backend/main.py     : /api/diagnose, /api/history (MongoDB Atlas), /api/weather-risk, /api/health
- backend/eval.py     : eval_images/<label>/*.jpg par accuracy napta hai (slide ka asli number)
- src/Home.jsx        : main screen, photo (camera + gallery), quality check, flow
- src/FarmerProfile.jsx : farmer profile summary and crop-health dashboard
- src/CropHistory.jsx : farmer diagnosis/photo timeline, treatment notes, follow-up reminders
- src/Result.jsx      : diagnosis card, confidence bar, Hindi voice
- src/Treatment.jsx   : bina-dawai upay, jaivik, rasayanik (matra + kharch + source)
- src/SprayWindow.jsx : Open-Meteo se spray slot
- src/Roadmap.jsx     : "jaldi aa raha hai" (koi nakli data nahi)
- src/data.js         : bimari + treatment JSON, district coordinates

## Video se pehle ZAROOR karein
1. src/data.js: "jaivik" aur "rasayanik" (naam, matra, kharch, source) sirf ICAR / CIB&RC / KVK advisory se verify karke bharein. Khali (null) rahe to app KVK se poochhne ko kehta hai.
2. District coordinates Google Maps se verify karein.
3. PlantVillage ki 20-30 photos backend/eval_images/ mein rakhkar `python eval.py` chalayein; slide mein wahi number likhein.
4. DEMO MODE badge dikhe to video record na karein (key set karein).
5. Blur/roshni thresholds (src/lib.js) apni photos par tune karein.
6. Chrome/Edge mein hi record karein; hindi voice na mile to Windows mein Hindi language pack lagayein.
