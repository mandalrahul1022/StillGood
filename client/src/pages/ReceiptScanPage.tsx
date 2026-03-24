import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, ScannedItem } from "../api/client";

const ALL_CATEGORIES = [
  "produce", "dairy", "meat", "leftovers", "bread",
  "frozen", "beverages", "condiments", "grains", "snacks", "other"
];

interface ReviewItem extends ScannedItem {
  selected: boolean;
}

type Stage = "idle" | "scanning" | "reviewing" | "adding" | "done";

function CameraModal({ onCapture, onClose }: {
  onCapture: (file: File) => void;
  onClose: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [camError, setCamError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  const startStream = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } }
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => setReady(true);
      }
    } catch {
      setCamError("Camera access was denied or is unavailable. Please allow camera permissions and try again.");
    }
  }, []);

  useEffect(() => {
    void startStream();
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, [startStream]);

  const capture = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d")!.drawImage(video, 0, 0);
    canvas.toBlob((blob) => {
      if (!blob) return;
      const file = new File([blob], "receipt.jpg", { type: "image/jpeg" });
      streamRef.current?.getTracks().forEach((t) => t.stop());
      onCapture(file);
    }, "image/jpeg", 0.92);
  };

  return (
    <div className="camera-modal-backdrop" onClick={onClose}>
      <div className="camera-modal" onClick={(e) => e.stopPropagation()}>
        <div className="camera-modal-header">
          <strong>Take a Photo</strong>
          <button className="camera-close-btn" onClick={onClose}>✕</button>
        </div>

        {camError ? (
          <div className="camera-error">
            <p>{camError}</p>
            <button className="button ghost" onClick={onClose}>Close</button>
          </div>
        ) : (
          <>
            <div className="camera-viewfinder">
              <video ref={videoRef} autoPlay playsInline muted className="camera-video" />
              {!ready && (
                <div className="camera-loading">
                  <div className="scan-spinner" />
                  <span>Starting camera…</span>
                </div>
              )}
              <div className="camera-overlay-guide" />
            </div>
            <canvas ref={canvasRef} style={{ display: "none" }} />
            <div className="camera-controls">
              <button className="button ghost" onClick={onClose}>Cancel</button>
              <button className="button camera-shutter-btn" disabled={!ready} onClick={capture}>
                📷 Capture
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export function ReceiptScanPage() {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [stage, setStage] = useState<Stage>("idle");
  const [error, setError] = useState<string | null>(null);
  const [reviewItems, setReviewItems] = useState<ReviewItem[]>([]);
  const [storeInfo, setStoreInfo] = useState<{ store: string | null; date: string | null } | null>(null);
  const [addedCount, setAddedCount] = useState(0);
  const [isDragOver, setIsDragOver] = useState(false);
  const [showCamera, setShowCamera] = useState(false);

  const processFile = async (file: File) => {
    setShowCamera(false);
    setError(null);
    setStage("scanning");
    try {
      const result = await api.scanReceipt(file);
      if (result.items.length === 0) {
        setError("No grocery items were detected on this receipt. Try a clearer photo.");
        setStage("idle");
        return;
      }
      setStoreInfo({ store: result.store, date: result.date });
      setReviewItems(result.items.map((item) => ({ ...item, selected: true })));
      setStage("reviewing");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to scan receipt");
      setStage("idle");
    }
  };

  const handleFile = (file: File | undefined) => {
    if (!file) return;
    void processFile(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    handleFile(e.dataTransfer.files[0]);
  };

  const updateItem = (index: number, patch: Partial<ReviewItem>) => {
    setReviewItems((prev) => prev.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  };

  const selectedItems = reviewItems.filter((i) => i.selected);

  const addAll = async () => {
    setStage("adding");
    let count = 0;
    for (const item of selectedItems) {
      try {
        await api.createItem({ name: item.name, category: item.category, quantity: item.quantity, opened: false });
        count++;
        setAddedCount(count);
      } catch {
        // continue adding remaining items
      }
    }
    setStage("done");
  };

  if (stage === "done") {
    return (
      <section className="stack">
        <div className="panel receipt-done">
          <div className="receipt-done-icon">✅</div>
          <h2>{addedCount} {addedCount === 1 ? "item" : "items"} added to inventory</h2>
          <p>Your receipt has been imported successfully.</p>
          <div className="row" style={{ justifyContent: "center", marginTop: 8 }}>
            <button className="button" onClick={() => navigate("/")}>View Inventory</button>
            <button className="button ghost" onClick={() => { setStage("idle"); setReviewItems([]); setStoreInfo(null); }}>
              Scan Another
            </button>
          </div>
        </div>
      </section>
    );
  }

  return (
    <>
      {showCamera && (
        <CameraModal
          onCapture={(file) => void processFile(file)}
          onClose={() => setShowCamera(false)}
        />
      )}

      <section className="stack">
        <div className="panel">
          <h2>Receipt Scanner</h2>
          <p>Upload a photo of your grocery receipt to bulk-import items into your inventory.</p>
        </div>

        {stage === "idle" || stage === "scanning" ? (
          <div className="panel stack">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,application/pdf"
              style={{ display: "none" }}
              onChange={(e) => { handleFile(e.target.files?.[0]); e.target.value = ""; }}
            />

            {stage === "scanning" ? (
              <div className="receipt-dropzone scanning">
                <div className="receipt-scanning-state">
                  <div className="scan-spinner" />
                  <strong>Reading your receipt…</strong>
                  <p>This usually takes 5–15 seconds</p>
                </div>
              </div>
            ) : (
              <>
                <div
                  className={`receipt-dropzone${isDragOver ? " drag-over" : ""}`}
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
                  onDragLeave={() => setIsDragOver(false)}
                  onDrop={handleDrop}
                >
                  <div className="receipt-idle-state">
                    <div className="receipt-icon">🧾</div>
                    <strong>Drop your receipt here</strong>
                    <p>or click to browse — JPEG, PNG, WebP, PDF up to 10MB</p>
                  </div>
                </div>

                <div className="receipt-divider"><span>or</span></div>

                <button
                  type="button"
                  className="button secondary receipt-camera-btn"
                  onClick={() => setShowCamera(true)}
                >
                  📷 Use Camera
                </button>
              </>
            )}

            {error && <p className="error-text">{error}</p>}
          </div>
        ) : null}

        {stage === "reviewing" || stage === "adding" ? (
          <div className="panel stack">
            <div className="row between">
              <div>
                <h3>Review Detected Items</h3>
                {storeInfo?.store && (
                  <p>{storeInfo.store}{storeInfo.date ? ` · ${storeInfo.date}` : ""}</p>
                )}
              </div>
              <span className="hero-badge">{selectedItems.length} selected</span>
            </div>

            <div className="receipt-item-list">
              {reviewItems.map((item, i) => (
                <div key={i} className={`receipt-item${item.selected ? "" : " deselected"}`}>
                  <label className="receipt-item-check">
                    <input
                      type="checkbox"
                      checked={item.selected}
                      onChange={(e) => updateItem(i, { selected: e.target.checked })}
                      style={{ width: "auto" }}
                    />
                  </label>
                  <div className="receipt-item-fields">
                    <input
                      className="receipt-item-name"
                      value={item.name}
                      onChange={(e) => updateItem(i, { name: e.target.value })}
                      disabled={!item.selected}
                    />
                    <select
                      value={item.category}
                      onChange={(e) => updateItem(i, { category: e.target.value })}
                      disabled={!item.selected}
                      className="receipt-item-cat"
                    >
                      {ALL_CATEGORIES.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                    <input
                      className="receipt-item-qty"
                      value={item.quantity}
                      onChange={(e) => updateItem(i, { quantity: e.target.value })}
                      disabled={!item.selected}
                      placeholder="Qty"
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="add-item-actions">
              <button className="button ghost" onClick={() => { setStage("idle"); setReviewItems([]); }}>
                Start Over
              </button>
              <button
                className="button"
                disabled={selectedItems.length === 0 || stage === "adding"}
                onClick={() => void addAll()}
              >
                {stage === "adding"
                  ? `Adding… (${addedCount}/${selectedItems.length})`
                  : `Add ${selectedItems.length} ${selectedItems.length === 1 ? "item" : "items"} to Inventory`}
              </button>
            </div>
          </div>
        ) : null}
      </section>
    </>
  );
}
