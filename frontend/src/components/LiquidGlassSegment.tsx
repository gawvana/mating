import React, { useRef } from "react";
import { triggerHaptic } from "../telegram/telegram";

export interface SegmentOption<T extends string = string> {
  value: T;
  label: React.ReactNode;
  icon?: React.ReactNode;
  ariaLabel?: string;
}

export interface LiquidGlassSegmentProps<T extends string = string> {
  options: SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  size?: "sm" | "md" | "lg";
  className?: string;
  style?: React.CSSProperties;
  ariaLabel?: string;
}

/**
 * Liquid Glass 2.0 Segmented Control
 *
 * Implements Apple-grade GPU-composited moving glass lens:
 * - Single track + single moving liquid glass lens (zero redundant backdrop filters)
 * - Pure hardware-accelerated GPU translation via translate3d (No layout thrashing / no left animation)
 * - Interruptible continuous spring retargeting on rapid switching (zero timer glitches)
 * - High-contrast text transition with specular refraction
 * - Full WAI-ARIA radiogroup semantics & keyboard Arrow navigation
 */
export function LiquidGlassSegment<T extends string = string>({
  options,
  value,
  onChange,
  size = "md",
  className = "",
  style,
  ariaLabel,
}: LiquidGlassSegmentProps<T>) {
  const containerRef = useRef<HTMLDivElement>(null);

  const activeIndex = Math.max(0, options.findIndex((opt) => opt.value === value));
  const count = options.length;

  const handleSelect = (val: T) => {
    if (val === value) return;
    triggerHaptic("selection");
    onChange(val);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      e.preventDefault();
      const nextIdx = (activeIndex + 1) % count;
      handleSelect(options[nextIdx].value);
    } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      e.preventDefault();
      const prevIdx = (activeIndex - 1 + count) % count;
      handleSelect(options[prevIdx].value);
    } else if (e.key === "Home") {
      e.preventDefault();
      handleSelect(options[0].value);
    } else if (e.key === "End") {
      e.preventDefault();
      handleSelect(options[count - 1].value);
    }
  };

  return (
    <div
      ref={containerRef}
      role="radiogroup"
      aria-label={ariaLabel}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      className={`glass-seg-track glass-seg-track--${size} ${className}`}
      style={{
        ...style,
        "--seg-count": count,
        "--seg-idx": activeIndex,
      } as React.CSSProperties}
    >
      {/* Moving Liquid Glass Lens — 100% GPU compositor-driven via CSS translate3d */}
      <span
        className="glass-seg-lens"
        aria-hidden="true"
      >
        <span className="glass-seg-lens-sheen" />
      </span>

      {/* Segment Option Buttons */}
      {options.map((opt) => {
        const isSelected = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={isSelected}
            aria-label={opt.ariaLabel || (typeof opt.label === "string" ? opt.label : undefined)}
            className={`glass-seg-btn ${isSelected ? "is-selected" : ""}`}
            onClick={() => handleSelect(opt.value)}
            tabIndex={-1}
          >
            {opt.icon && <span className="glass-seg-icon">{opt.icon}</span>}
            <span className="glass-seg-label">{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}
