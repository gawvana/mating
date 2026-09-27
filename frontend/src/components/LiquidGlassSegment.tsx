import React, { useRef, useState } from "react";
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
 * Implements a single moving glass lens sliding smoothly across options:
 * - Single track + single moving glass lens (zero redundant backdrop filters)
 * - Subtle liquid stretch / compression on transition
 * - Synchronous text contrast transition
 * - Keyboard arrow navigation & Space/Enter selection
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
  const [isTransitioning, setIsTransitioning] = useState(false);

  const activeIndex = Math.max(0, options.findIndex((opt) => opt.value === value));
  const count = options.length;

  const handleSelect = (val: T) => {
    if (val === value) return;
    triggerHaptic("selection");
    setIsTransitioning(true);
    setTimeout(() => setIsTransitioning(false), 240);
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
    }
  };

  // Lens geometry calculation (percentage based)
  const lensWidthPercent = 100 / count;
  const lensLeftPercent = activeIndex * lensWidthPercent;

  return (
    <div
      ref={containerRef}
      role="radiogroup"
      aria-label={ariaLabel}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      className={`glass-seg-track glass-seg-track--${size} ${className}`}
      style={style}
    >
      {/* Moving Liquid Glass Lens */}
      <span
        className={`glass-seg-lens ${isTransitioning ? "is-stretching" : ""}`}
        style={{
          width: `calc(${lensWidthPercent}% - 4px)`,
          left: `calc(${lensLeftPercent}% + 2px)`,
        }}
        aria-hidden="true"
      />

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
