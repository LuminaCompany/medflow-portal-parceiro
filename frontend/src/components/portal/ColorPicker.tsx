"use client";

import { HexColorPicker } from "react-colorful";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

// Roda de cores (RGB/hex) para o gestor definir a cor do parceiro. Clara/escura,
// vibrante ou fosca — total liberdade. Presets só atalham, o controle é a roda.
const PRESETS = [
  "#7C3AED",
  "#2563EB",
  "#0EA5E9",
  "#10B981",
  "#F59E0B",
  "#EF4444",
  "#EC4899",
  "#64748B",
];

export function ColorPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (cor: string) => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="mf-colorwheel">
        <HexColorPicker color={value} onChange={onChange} />
      </div>

      <div className="flex items-center gap-2">
        <span
          className="size-9 shrink-0 rounded-lg ring-1 ring-border"
          style={{ background: value }}
        />
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-label="Cor (hex)"
          className="h-9 font-mono uppercase"
          spellCheck={false}
        />
      </div>

      <div className="flex flex-wrap gap-1.5">
        {PRESETS.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => onChange(c)}
            aria-label={`Cor ${c}`}
            className={cn(
              "size-6 rounded-md ring-1 ring-border transition-transform hover:scale-110",
              value.toLowerCase() === c.toLowerCase() && "ring-2 ring-ring",
            )}
            style={{ background: c }}
          />
        ))}
      </div>
    </div>
  );
}
