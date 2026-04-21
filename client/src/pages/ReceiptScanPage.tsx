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
          <strong>Take a photo</strong>
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

function Stepper({ stage }: { stage: Stage }) {
  const states = (function () {
    if (stage === "idle") return ["active", "pending", "pending"];
    if (stage === "scanning") return ["active", "pending", "pending"];
    if (stage === "reviewing" || stage === "adding") return ["done", "active", "pending"];
    return ["done", "done", "done"];
  })();

  const labels = ["Upload receipt", "Review items", "Add to inventory"];

  return (
    <div className="scan-stepper" role="list">
      {labels.map((label, i) => (
        <div key={label} className={`scan-step ${states[i]}`} role="listitem">
          <div className="scan-step-num"><span>{i + 1}</span></div>
          <span className="scan-step-label">{label}</span>
        </div>
      ))}
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
        setError("No grocery items were detected on this receipt. Try a clearer photo with even lighting.");
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

  const toggleAll = (selected: boolean) => {
    setReviewItems((prev) => prev.map((item) => ({ ...item, selected })));
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
        // continue
      }
    }
    setStage("done");
  };

  if (stage === "done") {
    return (
      <section className="stack">
        <div className="page-hero">
          <div className="page-hero-icon sage">🎉</div>
          <div style={{ flex: 1, minWidth: 240 }}>
            <span className="section-eyebrow sage">Receipt imported</span>
            <h2>
              {addedCount} {addedCount === 1 ? "item" : "items"} <em>added</em>.
            </h2>
            <p>Your fridge got a little smarter. Back to the kitchen?</p>
          </div>
        </div>

        <div className="panel receipt-done">
          <div className="receipt-done-icon">✅</div>
          <h2>Nicely done.</h2>
          <p>
            Everything from that receipt is now tracked and will alert you
            before it turns.
          </p>
          <div className="row" style={{ justifyContent: "center", marginTop: 8, gap: 10, flexWrap: "wrap" }}>
            <button className="button" onClick={() => navigate("/")}>View inventory →</button>
            <button
              className="button ghost"
              onClick={() => {
                setStage("idle");
                setReviewItems([]);
                setStoreInfo(null);
                setAddedCount(0);
              }}
            >
              Scan another
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
        <div className="page-hero">
          <div className="page-hero-icon">🧾</div>
          <div style={{ flex: 1, minWidth: 240 }}>
            <span className="section-eyebrow">Receipt scan station</span>
            <h2>
              A whole week of groceries, in <em>one photo</em>.
            </h2>
            <p>
              Drop a receipt image or use your camera — we&rsquo;ll read the
              items, guess the category, and let you rubber-stamp everything
              into your inventory.
            </p>
          </div>
        </div>

        <Stepper stage={stage} />

        {stage === "idle" || stage === "scanning" ? (
          <div className="panel stack">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,application/pdf"
              style={{ display: "none" }}
              onChange={(e) => {
                handleFile(e.target.files?.[0]);
                e.target.value = "";
              }}
            />

            {stage === "scanning" ? (
              <div className="receipt-dropzone-v2 scanning">
                <div className="scan-spinner" style={{ margin: "0 auto 14px" }} />
                <h3>
                  Reading your <em>receipt</em>…
                </h3>
                <p>Normally takes 5&ndash;15 seconds. Hang tight.</p>
              </div>
            ) : (
              <>
                <div
                  className={`receipt-dropzone-v2${isDragOver ? " drag-over" : ""}`}
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDragOver(true);
                  }}
                  onDragLeave={() => setIsDragOver(false)}
                  onDrop={handleDrop}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") fileInputRef.current?.click();
                  }}
                >
                  <div className="receipt-big-icon" aria-hidden>🧾</div>
                  <h3>
                    Drop a receipt <em>right here</em>
                  </h3>
                  <p>or click to browse — JPEG, PNG, WebP, PDF · up to 10MB</p>
                </div>

                <div className="receipt-divider"><span>or snap one now</span></div>

                <button
                  type="button"
                  className="button secondary receipt-camera-btn"
                  onClick={() => setShowCamera(true)}
                >
                  📷 Open camera
                </button>

                <div className="scan-tips">
                  <div className="scan-tip">
                    <span className="scan-tip-icon" aria-hidden>💡</span>
                    <div>
                      <strong>Good lighting</strong>
                      Natural daylight reads best. Avoid shadows across the receipt.
                    </div>
                  </div>
                  <div className="scan-tip">
                    <span className="scan-tip-icon" aria-hidden>📐</span>
                    <div>
                      <strong>Flat and straight</strong>
                      Smooth out wrinkles; fit the whole receipt in the frame.
                    </div>
                  </div>
                  <div className="scan-tip">
                    <span className="scan-tip-icon" aria-hidden>🔎</span>
                    <div>
                      <strong>Zoom if long</strong>
                      Snap the top half and bottom half separately if needed.
                    </div>
                  </div>
                </div>
              </>
            )}

            {error && <p className="error-text">{error}</p>}
          </div>
        ) : null}

        {stage === "reviewing" || stage === "adding" ? (
          <div className="panel stack">
            <div className="row between" style={{ flexWrap: "wrap", gap: 10 }}>
              <div>
                <span className="section-eyebrow sage">Step 2 · Review</span>
                <h3 style={{ fontFamily: '"Merriweather", serif', fontSize: 20, margin: "6px 0 2px" }}>
                  Looks right? Uncheck anything odd.
                </h3>
                {storeInfo?.store && (
                  <p style={{ fontSize: 13 }}>
                    {storeInfo.store}
                    {storeInfo.date ? ` · ${storeInfo.date}` : ""}
                  </p>
                )}
              </div>
              <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
                <span className="hero-badge">{selectedItems.length} selected</span>
                <button
                  type="button"
                  className="button tiny ghost"
                  onClick={() => toggleAll(true)}
                >
                  Select all
                </button>
                <button
                  type="button"
                  className="button tiny ghost"
                  onClick={() => toggleAll(false)}
                >
                  Clear
                </button>
              </div>
            </div>

            {storeInfo?.store && (
              <div className="scan-receipt-meta">
                <span aria-hidden>🏪</span>
                <span>
                  Detected from <strong>{storeInfo.store}</strong>
                  {storeInfo.date ? ` on ${storeInfo.date}` : ""}.
                </span>
              </div>
            )}

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
              <button
                className="button ghost"
                onClick={() => {
                  setStage("idle");
                  setReviewItems([]);
                }}
              >
                ← Start over
              </button>
              <button
                className="button"
                disabled={selectedItems.length === 0 || stage === "adding"}
                onClick={() => void addAll()}
              >
                {stage === "adding"
                  ? `Adding… (${addedCount}/${selectedItems.length})`
                  : `Add ${selectedItems.length} ${selectedItems.length === 1 ? "item" : "items"} →`}
              </button>
            </div>
          </div>
        ) : null}
      </section>
    </>
  );
}
