"""
Scans ai/dataset/v1/{train,val,test}/{sealed,open}/ and writes
ai/dataset/v1/manifest.csv with one row per image.

Run after adding or removing images:
    python ai/build_manifest.py
"""
import csv
import datetime
from pathlib import Path

DATASET_ROOT = Path("ai/dataset/v1")
IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".webp", ".bmp", ".tif", ".tiff"}
OUT = DATASET_ROOT / "manifest.csv"

rows = []
for split in ("train", "val", "test"):
    split_dir = DATASET_ROOT / split
    if not split_dir.exists():
        continue
    for label_dir in sorted(split_dir.iterdir()):
        if not label_dir.is_dir():
            continue
        label = label_dir.name  # "sealed" or "open"
        for img in sorted(label_dir.iterdir()):
            if img.suffix.lower() not in IMAGE_EXTS:
                continue
            rows.append({
                "filename": img.name,
                "path": str(img.relative_to(DATASET_ROOT)),
                "label": label,
                "split": split,
                "date_added": datetime.date.today().isoformat(),
            })

with open(OUT, "w", newline="") as f:
    writer = csv.DictWriter(f, fieldnames=["filename", "path", "label", "split", "date_added"])
    writer.writeheader()
    writer.writerows(rows)

print(f"Wrote {len(rows)} entries to {OUT}")
for split in ("train", "val", "test"):
    n = sum(1 for r in rows if r["split"] == split)
    sealed = sum(1 for r in rows if r["split"] == split and r["label"] == "sealed")
    opened = sum(1 for r in rows if r["split"] == split and r["label"] == "open")
    print(f"  {split:5s}: {n:4d} images  (sealed={sealed}, open={opened})")
