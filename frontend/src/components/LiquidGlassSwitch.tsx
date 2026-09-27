import React, { useCallback, useRef, useState } from "react";
import { triggerHaptic } from "../telegram/telegram";

export interface LiquidGlassSwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  size?: "sm" | "md";
  id?: string;
  name?: string;
  ariaLabel?: string;
  className?: string;
}

/**
 * Liquid Glass 2.0 Switch Primitive
 *
 * Implements physics-based tactile switch interaction:
 * - Press compression: thumb compresses on active press
 * - Elongation & fluid stretch during slide/drag
 * - Continuous pointer drag tracking with 0..100% position
 * - Spring snap settle on release
 * - Specular highlight and inner reflection
 * - Full WAI-ARIA switch accessibility (role="switch", aria-checked, keyboard Space/Enter)
 */
export const LiquidGlassSwitch: React.FC<LiquidGlassSwitchProps> = ({
  checked,
  onChange,
  disabled = false,
  size = "md",
  id,
  name,
  ariaLabel,
  className = "",
}) => {
  const trackRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);
  const startXRef = useRef(0);
  const currentDragRatioRef = useRef<number | null>(null);

  const [isPressed, setIsPressed] = useState(false);
  const [dragProgress, setDragProgress] = useState<number | null>(null);

  const effectiveChecked = dragProgress !== null ? dragProgress >= 0.5 : checked;

  const handleToggle = useCallback(() => {
    if (disabled) return;
    triggerHaptic("selection");
    onChange(!checked);
  }, [checked, disabled, onChange]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (disabled) return;
    if (e.key === " " || e.key === "Enter") {
      e.preventDefault();
      handleToggle();
    }
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (disabled || e.button !== 0) return;
    setIsPressed(true);
    isDraggingRef.current = true;
    startXRef.current = e.clientX;
    currentDragRatioRef.current = checked ? 1 : 0;

    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {}
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current || !trackRef.current) return;
    const rect = trackRef.current.getBoundingClientRect();
    const trackWidth = rect.width;
    const thumbWidth = 24;
    const travel = trackWidth - thumbWidth - 6; // padding 3px each side

    if (travel <= 0) return;

    const dx = e.clientX - startXRef.current;
    if (Math.abs(dx) > 3) {
      const initialPos = checked ? travel : 0;
      const newPos = Math.max(0, Math.min(travel, initialPos + dx));
      const ratio = newPos / travel;
      currentDragRatioRef.current = ratio;
      setDragProgress(ratio);
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;
    setIsPressed(false);

    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {}

    const ratio = currentDragRatioRef.current;
    setDragProgress(null);
    currentDragRatioRef.current = null;

    if (ratio !== null) {
      const nextChecked = ratio >= 0.5;
      if (nextChecked !== checked) {
        triggerHaptic("selection");
        onChange(nextChecked);
        return;
      }
    }

    // Tap without significant drag
    handleToggle();
  };

  const handlePointerCancel = () => {
    isDraggingRef.current = false;
    setIsPressed(false);
    setDragProgress(null);
    currentDragRatioRef.current = null;
  };

  // Determine dynamic thumb transform based on drag or state
  const isSm = size === "sm";
  const defaultTravel = isSm ? 18 : 22;
  const thumbStyle: React.CSSProperties = {};
  if (dragProgress !== null) {
    const travelPx = defaultTravel;
    const tx = dragProgress * travelPx;
    thumbStyle.transform = `translateX(${tx}px) scaleX(${isPressed ? 1.15 : 1})`;
    thumbStyle.transition = "none";
  }

  return (
    <div
      ref={trackRef}
      id={id}
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      aria-disabled={disabled}
      tabIndex={disabled ? -1 : 0}
      onKeyDown={handleKeyDown}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      className={`glass-switch-track size-${size} ${checked ? "is-checked" : ""} ${isPressed ? "is-pressed" : ""} ${disabled ? "is-disabled" : ""} ${className}`}
      data-checked={checked ? "true" : "false"}
    >
      {name && <input type="hidden" name={name} value={checked ? "on" : "off"} />}
      <span
        className={`glass-switch-thumb ${effectiveChecked ? "is-checked" : ""} ${isPressed ? "is-pressed" : ""}`}
        style={thumbStyle}
      >
        <span className="glass-switch-specular" />
      </span>
    </div>
  );
};
