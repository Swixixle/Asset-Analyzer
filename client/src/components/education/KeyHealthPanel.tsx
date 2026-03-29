import { useState } from "react";
import type { KeyStatus } from "@shared/evidenceChainModel";

interface KeyHealthPanelProps {
  keys: KeyStatus[];
}

const statusStyle = (s: KeyStatus["status"]) =>
  ({
    set: "text-emerald-600",
    auto: "text-amber-600",
    missing: "text-red-600",
  })[s];

const statusLabel = (s: KeyStatus["status"]) =>
  ({
    set: "✓ set",
    auto: "⚠ auto-generated",
    missing: "✗ not set",
  })[s];

export function KeyHealthPanel({ keys }: KeyHealthPanelProps) {
  const [selected, setSelected] = useState<KeyStatus | null>(null);

  return (
    <div className="border-t border-slate-200 mt-4">
      <div className="px-4 pt-2.5 pb-1.5 text-[11px] font-medium text-slate-500 uppercase tracking-wide">
        Key health
      </div>

      {keys.map((k) => (
        <div
          key={k.name}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              setSelected(selected?.name === k.name ? null : k);
            }
          }}
          onClick={() => setSelected(selected?.name === k.name ? null : k)}
          className={`px-4 py-2 flex items-center gap-2.5 cursor-pointer border-b border-slate-200 text-left w-full ${
            selected?.name === k.name ? "bg-slate-50" : "bg-transparent"
          }`}
        >
          <span className="text-[11px] font-mono text-slate-600 flex-1 min-w-0 truncate">{k.name}</span>
          <span className={`text-[11px] shrink-0 ${statusStyle(k.status)}`}>{statusLabel(k.status)}</span>
        </div>
      ))}

      {selected ? (
        <div className="px-4 py-3 bg-slate-50 border-b border-slate-200">
          <div className="text-sm font-medium text-slate-900 mb-1.5">{selected.displayName}</div>
          <div className="text-sm text-slate-600 mb-2.5 leading-relaxed">
            {selected.role}
          </div>

          {selected.status !== "set" ? (
            <div className="bg-red-50 text-red-800 rounded-md px-3 py-2 text-xs mb-2.5">{selected.consequence}</div>
          ) : null}

          <div className="text-xs text-slate-500 mb-1 font-medium">How to store this safely</div>
          <div className="text-sm text-slate-600 mb-2.5 leading-relaxed">{selected.howToStore}</div>

          {selected.rotationSteps.length > 0 ? (
            <>
              <div className="text-xs text-slate-500 mb-1.5 font-medium">How to rotate this key</div>
              {selected.rotationSteps.map((step, i) => (
                <div key={i} className="flex gap-2 mb-1.5 text-sm text-slate-600">
                  <span className="text-slate-400 shrink-0">{i + 1}.</span>
                  <span>{step}</span>
                </div>
              ))}
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
