import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Item, api } from "../api/client";

const ALL_CATEGORIES = [
  "produce",
  "dairy",
  "meat",
  "leftovers",
  "bread",
  "frozen",
  "beverages",
  "condiments",
  "grains",
  "snacks",
  "other"
];

interface EditItemModalProps {
  item: Item | null;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}

export function EditItemModal({ item, onClose, onSaved }: EditItemModalProps) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState("other");
  const [quantity, setQuantity] = useState("");
  const [opened, setOpened] = useState(false);
  const [customFreshDays, setCustomFreshDays] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!item) return;
    setName(item.name);
    setCategory(item.category || "other");
    setQuantity(item.quantity);
    setOpened(item.opened === true);
    setCustomFreshDays(
      item.customFreshDays !== null && item.customFreshDays !== undefined
        ? String(item.customFreshDays)
        : ""
    );
    setError(null);
    setSubmitting(false);
  }, [item]);

  const handleClose = useCallback(() => {
    if (submitting) return;
    onClose();
  }, [submitting, onClose]);

  useEffect(() => {
    if (!item) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [item, handleClose]);

  const categoryOptions = useMemo(() => {
    const known = new Set(ALL_CATEGORIES);
    if (item?.category && !known.has(item.category)) {
      return [item.category, ...ALL_CATEGORIES];
    }
    return ALL_CATEGORIES;
  }, [item?.category]);

  if (!item) return null;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError(null);

    const trimmedName = name.trim();
    const trimmedQty = quantity.trim();
    if (!trimmedName) {
      setError("Name can't be empty.");
      setSubmitting(false);
      return;
    }
    if (!trimmedQty) {
      setError("Quantity can't be empty.");
      setSubmitting(false);
      return;
    }

    const freshDaysTrimmed = customFreshDays.trim();
    let customFreshDaysValue: number | null = null;
    if (freshDaysTrimmed !== "") {
      const parsed = Number(freshDaysTrimmed);
      if (!Number.isFinite(parsed) || parsed < 0 || parsed > 3650) {
        setError("Custom fresh days must be a number between 0 and 3650.");
        setSubmitting(false);
        return;
      }
      customFreshDaysValue = Math.round(parsed);
    }

    try {
      await api.updateItem(item.id, {
        name: trimmedName,
        category,
        quantity: trimmedQty,
        opened,
        customFreshDays: customFreshDaysValue
      });
      await onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save changes.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="edit-modal-backdrop"
      onClick={handleClose}
      role="presentation"
    >
      <div
        className="edit-modal-shell"
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          className="edit-modal-close"
          onClick={handleClose}
          aria-label="Close"
          disabled={submitting}
        >
          ×
        </button>

        <div className="edit-modal-head">
          <span className="section-eyebrow">Edit item</span>
          <h2 id="edit-modal-title">
            Tweak the details of <em>{item.name}</em>
          </h2>
          <p className="subtle" style={{ marginTop: 4 }}>
            Changes here update the whole household instantly.
          </p>
        </div>

        <form className="edit-modal-form" onSubmit={(e) => void submit(e)}>
          <div className="auth-form-field">
            <label htmlFor="edit-item-name">Name</label>
            <input
              id="edit-item-name"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </div>

          <div className="edit-modal-grid">
            <div className="auth-form-field">
              <label htmlFor="edit-item-category">Category</label>
              <select
                id="edit-item-category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                {categoryOptions.map((c) => (
                  <option key={c} value={c}>
                    {c.charAt(0).toUpperCase() + c.slice(1)}
                  </option>
                ))}
              </select>
            </div>

            <div className="auth-form-field">
              <label htmlFor="edit-item-qty">Quantity</label>
              <input
                id="edit-item-qty"
                type="text"
                required
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="e.g. 1 lb, 2 units"
              />
            </div>
          </div>

          <div className="edit-modal-grid">
            <div className="auth-form-field">
              <label htmlFor="edit-item-days">Custom fresh days</label>
              <input
                id="edit-item-days"
                type="number"
                min={0}
                max={3650}
                step={1}
                value={customFreshDays}
                onChange={(e) => setCustomFreshDays(e.target.value)}
                placeholder="Leave blank for default"
              />
            </div>

            <label className="edit-modal-toggle">
              <input
                type="checkbox"
                checked={opened}
                onChange={(e) => setOpened(e.target.checked)}
              />
              <span>
                <strong>Opened</strong>
                <small>Mark as opened to speed up its fresh-days clock.</small>
              </span>
            </label>
          </div>

          {error ? <p className="error-text">{error}</p> : null}

          <div className="edit-modal-actions">
            <button
              type="button"
              className="button ghost"
              onClick={handleClose}
              disabled={submitting}
            >
              Cancel
            </button>
            <button type="submit" className="button" disabled={submitting}>
              {submitting ? "Saving…" : "Save changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
