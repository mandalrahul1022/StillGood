import torch
import torch.nn as nn
from torchvision import models, transforms, datasets
from torch.utils.data import DataLoader
from pathlib import Path
import random
import json
import numpy as np
from sklearn.metrics import classification_report, confusion_matrix

SEED = 42
random.seed(SEED)
np.random.seed(SEED)
torch.manual_seed(SEED)
if torch.backends.mps.is_available():
    torch.mps.manual_seed(SEED)

# ── CONFIG ──────────────────────────────────────────────────────
TRAIN_DIR  = "ai/dataset/v1/train"
VAL_DIR    = "ai/dataset/v1/val"
MODEL_DIR  = "ai/model"
EPOCHS     = 25
BATCH_SIZE = 32
LR         = 0.001

# ── TRANSFORMS (replaces OpenCV entirely) ───────────────────────
train_tf = transforms.Compose([
    transforms.Resize((256, 256)),
    transforms.CenterCrop(224),
    transforms.RandomHorizontalFlip(),
    transforms.RandomRotation(20),
    transforms.ColorJitter(brightness=0.4, contrast=0.4),
    transforms.ToTensor(),
    transforms.Normalize([0.485, 0.456, 0.406],
                         [0.229, 0.224, 0.225])
])

val_tf = transforms.Compose([
    transforms.Resize((256, 256)),
    transforms.CenterCrop(224),
    transforms.ToTensor(),
    transforms.Normalize([0.485, 0.456, 0.406],
                         [0.229, 0.224, 0.225])
])

# ── DATASET ─────────────────────────────────────────────────────
# Pre-split directories: v1/train/{open,sealed}  v1/val/{open,sealed}
train_set = datasets.ImageFolder(TRAIN_DIR, transform=train_tf)
val_set   = datasets.ImageFolder(VAL_DIR,   transform=val_tf)

print(f"Classes found: {train_set.classes}")
print(f"Train images:  {len(train_set)}")
print(f"Val images:    {len(val_set)}")

train_loader = DataLoader(train_set, batch_size=BATCH_SIZE,
                          shuffle=True,  num_workers=2)
val_loader   = DataLoader(val_set,   batch_size=BATCH_SIZE,
                          shuffle=False, num_workers=2)

# ── MODEL ────────────────────────────────────────────────────────
model = models.mobilenet_v2(weights="IMAGENET1K_V1")

# Freeze backbone, train only the last 4 layers + classifier
for param in model.parameters():
    param.requires_grad = False
for param in model.features[-4:].parameters():
    param.requires_grad = True

# Replace classifier head: 1280 → 2 (OPEN / SEALED)
model.classifier = nn.Sequential(
    nn.Dropout(0.3),
    nn.Linear(1280, 2)
)

# ── DEVICE: uses your Mac M-series GPU automatically ─────────────
device = (
    "mps"  if torch.backends.mps.is_available() else
    "cuda" if torch.cuda.is_available()          else
    "cpu"
)
print(f"Training on: {device}")
model = model.to(device)

optimizer = torch.optim.Adam(
    filter(lambda p: p.requires_grad, model.parameters()),
    lr=LR, weight_decay=1e-4
)
scheduler = torch.optim.lr_scheduler.StepLR(
    optimizer, step_size=8, gamma=0.1
)
criterion = nn.CrossEntropyLoss()

# ── TRAINING LOOP ────────────────────────────────────────────────
Path(MODEL_DIR).mkdir(parents=True, exist_ok=True)
best_acc = 0
history = []

for epoch in range(EPOCHS):
    model.train()
    correct = total = 0

    for imgs, labels in train_loader:
        imgs, labels = imgs.to(device), labels.to(device)
        optimizer.zero_grad()
        outputs = model(imgs)
        loss = criterion(outputs, labels)
        loss.backward()
        optimizer.step()
        preds = outputs.argmax(1)
        correct += (preds == labels).sum().item()
        total   += labels.size(0)

    # Validation
    model.eval()
    val_correct = val_total = 0
    all_preds = []
    all_labels = []
    with torch.no_grad():
        for imgs, labels in val_loader:
            imgs, labels = imgs.to(device), labels.to(device)
            preds = model(imgs).argmax(1)
            val_correct += (preds == labels).sum().item()
            val_total   += labels.size(0)
            all_preds.extend(preds.cpu().numpy().tolist())
            all_labels.extend(labels.cpu().numpy().tolist())

    train_acc = 100 * correct / total
    val_acc   = 100 * val_correct / val_total
    print(f"Epoch {epoch+1:2d}/{EPOCHS} | "
          f"Train {train_acc:.1f}% | Val {val_acc:.1f}%")
    print("Val per-class metrics:")
    print(classification_report(
        all_labels,
        all_preds,
        target_names=["open", "sealed"]
    ))
    if epoch % 5 == 0:
        print("Val confusion matrix:")
        print(confusion_matrix(all_labels, all_preds))

    if val_acc > best_acc:
        best_acc = val_acc
        torch.save(model.state_dict(), f"{MODEL_DIR}/best_model.pth")
        print(f"  ✓ Saved ({val_acc:.1f}%)")

    history.append({
        "epoch": epoch + 1,
        "train_acc": train_acc,
        "val_acc": val_acc,
        "train_loss": float(loss.item()),
    })

    scheduler.step()

print(f"\nBest accuracy: {best_acc:.1f}%")
with open(f"{MODEL_DIR}/training_history.json", "w") as f:
    json.dump(history, f, indent=2)

# ── ONNX EXPORT ──────────────────────────────────────────────────
model.load_state_dict(
    torch.load(
        f"{MODEL_DIR}/best_model.pth",
        map_location=device,
        weights_only=True
    )
)
model.eval()
dummy = torch.randn(1, 3, 224, 224).to(device)
torch.onnx.export(
    model, dummy,
    f"{MODEL_DIR}/freshness_classifier.onnx",
    input_names=["input"],
    output_names=["output"],
    dynamic_axes={"input": {0: "batch"}},
    opset_version=11
)
print("Exported: freshness_classifier.onnx")

# ── HELD-OUT TEST SET EVALUATION ─────────────────────────────────
# This runs ONCE after training is locked. The test set must never
# influence training decisions — it is the honest deployment estimate.
TEST_DIR = "ai/dataset/v1/test"
SUPPORTED_TEST_EXTS = {".jpg", ".jpeg", ".png", ".webp", ".bmp", ".tif", ".tiff"}
has_test_images = (
    Path(TEST_DIR).exists()
    and any(p.suffix.lower() in SUPPORTED_TEST_EXTS for p in Path(TEST_DIR).rglob("*"))
)

if has_test_images:
    print("\n" + "=" * 60)
    print("HELD-OUT TEST SET EVALUATION")
    print("=" * 60)

    test_set = datasets.ImageFolder(TEST_DIR, transform=val_tf)
    test_loader = DataLoader(
        test_set,
        batch_size=BATCH_SIZE,
        shuffle=False,
        num_workers=2
    )

    # Reload best model to be safe
    model.load_state_dict(
        torch.load(
            f"{MODEL_DIR}/best_model.pth",
            map_location=device,
            weights_only=True
        )
    )
    model.eval()

    test_preds = []
    test_labels = []
    with torch.no_grad():
        for imgs, labels in test_loader:
            imgs, labels = imgs.to(device), labels.to(device)
            preds = model(imgs).argmax(1)
            test_preds.extend(preds.cpu().numpy().tolist())
            test_labels.extend(labels.cpu().numpy().tolist())

    test_correct = sum(p == l for p, l in zip(test_preds, test_labels))
    test_acc = 100 * test_correct / len(test_labels)
    val_test_gap = best_acc - test_acc

    print(f"\nTest accuracy:    {test_acc:.1f}%")
    print(f"Best val accuracy: {best_acc:.1f}%")
    print(f"Val→Test gap:     {val_test_gap:+.1f}%")

    if val_test_gap > 8:
        print("\n⚠  WARNING: Val→Test gap > 8%. Model is likely overfit")
        print("   to the train/val distribution. Add more diverse data.")
    elif val_test_gap > 4:
        print("\n⚠  Note: Val→Test gap is moderate (4-8%). Acceptable")
        print("   but watch this number on next iteration.")
    else:
        print("\n✓ Val→Test gap is healthy.")

    print("\nTest set per-class metrics:")
    print(classification_report(
        test_labels,
        test_preds,
        target_names=["open", "sealed"]
    ))
    print("Test confusion matrix:")
    print(confusion_matrix(test_labels, test_preds))

    # Save test results to JSON
    test_results = {
        "test_accuracy": test_acc,
        "best_val_accuracy": best_acc,
        "val_test_gap": val_test_gap,
        "n_test_images": len(test_labels),
    }
    with open(f"{MODEL_DIR}/test_results.json", "w") as f:
        json.dump(test_results, f, indent=2)
else:
    print("\nNo test set found at ai/dataset/v1/test/. Skipping test eval.")
    print("Add test images (.jpg/.jpeg/.png/.webp/.bmp/.tif/.tiff) and re-run.")
