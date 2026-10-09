"""Accuracy napne ki script (slide ke liye asli number).

Folder banayein (label ka naam = folder ka naam, main.py ke LABELS wahi):
  eval_images/apple_scab/*.jpg
  eval_images/potato_late_blight/*.jpg
  eval_images/healthy/*.jpg   ... (har label ki 4-6 photo, kul 20-30)

Chalayein:   python eval.py
Note: PlantVillage ki photo lab-background wali hoti hain, khet ki asli photo par
accuracy kam aa sakti hai. Slide mein dono alag likhein, agar khet ki photo bhi test karein.
"""
import csv, io, sys
from pathlib import Path
from collections import Counter
import main

if main.DEMO:
    sys.exit("DEMO MODE on hai. .env mein ANTHROPIC_API_KEY daalein, tabhi asli accuracy aayegi.")

root = Path(__file__).parent / "eval_images"
rows, ok = [], 0
for folder in sorted(p for p in root.iterdir() if p.is_dir()):
    for img in sorted(folder.glob("*")):
        if img.suffix.lower() not in (".jpg", ".jpeg", ".png"):
            continue
        try:
            from PIL import Image
            buf = io.BytesIO()
            im = Image.open(img).convert("RGB")
            im.thumbnail((1280, 1280))
            im.save(buf, "JPEG", quality=85)
            out = main.classify(buf.getvalue())
        except Exception as e:
            out = {"label": f"ERROR {e}", "confidence": 0}
        hit = out["label"] == folder.name
        ok += hit
        rows.append([img.name, folder.name, out["label"], out["confidence"], "OK" if hit else "GALAT"])
        print(f"{rows[-1][4]:5}  {folder.name:22} -> {out['label']:22} ({out['confidence']}%)  {img.name}")

if not rows:
    sys.exit("eval_images/ mein photo nahi mili.")
print(f"\nAccuracy: {ok}/{len(rows)} = {100*ok/len(rows):.0f}%")
wrong = Counter((r[1], r[2]) for r in rows if r[4] == "GALAT")
for (t, p), n in wrong.most_common():
    print(f"  {t} ko {p} bola: {n} baar")
with open("eval_results.csv", "w", newline="", encoding="utf-8") as f:
    csv.writer(f).writerows([["file", "asli", "AI ne bola", "confidence", "natija"], *rows])
print("Detail: eval_results.csv")
