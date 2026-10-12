import React from "react";

const TONES = {
  ok: "bg-emerald-50 text-emerald-800 border-emerald-200",
  info: "bg-sky-50 text-sky-800 border-sky-200",
  warning: "bg-amber-50 text-amber-900 border-amber-200",
  critical: "bg-red-50 text-red-800 border-red-200",
  neutral: "bg-stone-100 text-stone-700 border-stone-200",
  model: "bg-violet-50 text-violet-800 border-violet-200",
};

export default function Pill({ tone = "neutral", className = "", children }) {
  return (
    <span
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-medium ${
        TONES[tone] || TONES.neutral
      } ${className}`}
    >
      {children}
    </span>
  );
}
