"""Overpass çıktısını uygulamanın okuduğu kompakt JSON'a çevirir.

Kullanım: python scripts/build_osm.py overpass.json data/munich.json
Veri: © OpenStreetMap katkıcıları, ODbL.
"""
import json, os, sys, datetime

KEEP = ["name", "amenity", "cuisine", "opening_hours", "addr:street", "addr:housenumber",
        "addr:suburb", "diet:vegan", "diet:vegetarian", "outdoor_seating", "wheelchair",
        "check_date:opening_hours", "check_date", "survey:date"]

def main(src, dst):
    with open(src, encoding="utf-8") as f:
        raw = json.load(f)
    out, seen = [], set()
    for e in raw.get("elements", []):
        t = e.get("tags") or {}
        if not t.get("name") or not t.get("amenity"):
            continue
        lat = e.get("lat", (e.get("center") or {}).get("lat"))
        lon = e.get("lon", (e.get("center") or {}).get("lon"))
        if lat is None or lon is None:
            continue
        key = e["type"][0] + str(e["id"])
        if key in seen:
            continue
        seen.add(key)
        out.append([key, round(lat, 6), round(lon, 6), {k: t[k] for k in KEEP if k in t}])
    if len(out) < 500:
        sys.exit(f"Çok az mekan geldi ({len(out)}), dosya güncellenmedi.")
    data = {
        "source": "© OpenStreetMap katkıcıları (ODbL)",
        "generated": datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%d"),
        "bbox": [48.06, 11.36, 48.25, 11.72],
        "elements": out,
    }
    os.makedirs(os.path.dirname(dst) or ".", exist_ok=True)
    with open(dst, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, separators=(",", ":"))
    print(f"{len(out)} mekan yazıldı -> {dst}")

if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
