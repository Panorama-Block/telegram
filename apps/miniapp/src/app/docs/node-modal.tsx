"use client";

import React, { useState, useEffect } from "react";
import { X } from "lucide-react";

export interface NodeFormData {
  label: string;
  description: string;
  icon: string;
  image: string;
  status: "active" | "beta" | "inactive" | "planned";
  category: "core" | "defi" | "external" | "infra" | "zico" | "future";
}

interface NodeModalProps {
  open: boolean;
  initial?: Partial<NodeFormData>;
  onSave: (data: NodeFormData) => void;
  onClose: () => void;
}

const ICONS = ["User", "Shield", "Database", "Boxes", "Zap", "MessageSquare", "Monitor"];
const IMAGES = ["", "zico", "benqi", "lido", "avax", "thirdweb", "uniswap", "panorama", "swap"];
const STATUSES = ["active", "beta", "inactive", "planned"] as const;
const CATEGORIES = ["core", "defi", "external", "infra", "zico", "future"] as const;

export function NodeModal({ open, initial, onSave, onClose }: NodeModalProps) {
  const [form, setForm] = useState<NodeFormData>({
    label: "",
    description: "",
    icon: "Boxes",
    image: "",
    status: "active",
    category: "core",
  });

  useEffect(() => {
    if (initial) {
      setForm((prev) => ({ ...prev, ...initial }));
    }
  }, [initial]);

  if (!open) return null;

  const set = (key: keyof NodeFormData, val: string) =>
    setForm((prev) => ({ ...prev, [key]: val }));

  return (
    <div className="nmodal-overlay" onClick={onClose}>
      <div className="nmodal" onClick={(e) => e.stopPropagation()}>
        <div className="nmodal__header">
          <span className="nmodal__title">{initial?.label ? "Edit Node" : "Add Node"}</span>
          <button className="nmodal__close" onClick={onClose}><X size={16} /></button>
        </div>

        <div className="nmodal__body">
          <label className="nmodal__label">
            Label
            <input
              className="nmodal__input"
              value={form.label}
              onChange={(e) => set("label", e.target.value)}
              placeholder="SERVICE NAME"
            />
          </label>

          <label className="nmodal__label">
            Description
            <input
              className="nmodal__input"
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
              placeholder="Short description"
            />
          </label>

          <div className="nmodal__row">
            <label className="nmodal__label">
              Category
              <select className="nmodal__select" value={form.category} onChange={(e) => set("category", e.target.value)}>
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>

            <label className="nmodal__label">
              Status
              <select className="nmodal__select" value={form.status} onChange={(e) => set("status", e.target.value)}>
                {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </label>
          </div>

          <div className="nmodal__row">
            <label className="nmodal__label">
              Icon (fallback)
              <select className="nmodal__select" value={form.icon} onChange={(e) => set("icon", e.target.value)}>
                {ICONS.map((i) => <option key={i} value={i}>{i}</option>)}
              </select>
            </label>

            <label className="nmodal__label">
              Brand Image
              <select className="nmodal__select" value={form.image} onChange={(e) => set("image", e.target.value)}>
                {IMAGES.map((i) => <option key={i} value={i}>{i || "(none)"}</option>)}
              </select>
            </label>
          </div>
        </div>

        <div className="nmodal__footer">
          <button className="nmodal__btn nmodal__btn--cancel" onClick={onClose}>Cancel</button>
          <button
            className="nmodal__btn nmodal__btn--save"
            disabled={!form.label.trim()}
            onClick={() => onSave(form)}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
