# ai/classify.py
import sys
import os
import numpy as np
import onnxruntime as ort
from PIL import Image
from torchvision import transforms

CLASSES = ["open", "sealed"]  # alphabetical = ImageFolder order

transform = transforms.Compose([
    transforms.Resize((256, 256)),
    transforms.CenterCrop(224),
    transforms.ToTensor(),
    transforms.Normalize([0.485, 0.456, 0.406],
                         [0.229, 0.224, 0.225])
])

_session = None

def _get_session():
    global _session
    if _session is None:
        model_path = "ai/model/freshness_classifier.onnx"
        if not os.path.exists(model_path):
            raise FileNotFoundError(
                f"ONNX model not found at {model_path}. "
                f"Run train.py first."
            )
        _session = ort.InferenceSession(model_path)
    return _session

def classify(image_path):
    img    = Image.open(image_path).convert("RGB")
    tensor = transform(img).unsqueeze(0).numpy()
    logits = _get_session().run(None, {"input": tensor})[0][0]
    logits = logits - np.max(logits)
    probs  = np.exp(logits) / np.exp(logits).sum()
    idx    = int(np.argmax(probs))
    return {
        "state":      CLASSES[idx].upper(),
        "confidence": round(float(probs[idx]), 3),
        "open_prob":  round(float(probs[0]), 3),
        "sealed_prob": round(float(probs[1]), 3),
        "low_confidence": bool(probs[idx] < 0.75),
    }

if __name__ == "__main__":
    path   = sys.argv[1]  # python classify.py my_photo.jpg
    result = classify(path)
    print(f"State:      {result['state']}")
    print(f"Confidence: {result['confidence']}")
    print(f"Open:       {result['open_prob']}")
    print(f"Sealed:     {result['sealed_prob']}")