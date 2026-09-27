import React, { useCallback, useEffect, useRef } from "react";
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
 * Implements high-performance physics-based tactile switch interaction:
 * - Zero React re-renders during high-frequency pointer drag (120Hz smooth)
 * - Geometry cached once on pointerdown (Zero forced synchronous layout in pointermove)
 * - Hardware-accelerated direct GPU transform with rAF batching
 * - Tactile elongation (scaleX 1.12) in the direction of drag
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
  const thumbRef = useRef<HTMLSpanElement>(null);

  const isDraggingRef = useRef(false);
  const startXRef = useRef(0);
  const travelRef = useRef(size === "sm" ? 18 : 22);
  const initialCheckedRef = useRef(checked);
  const currentDragRatioRef = useRef<number | null>(null);
  const rAfRef = useRef<number | null>(null);

  // Keep initialCheckedRef in sync when checked prop updates from outside
  useEffect(() => {
    initialCheckedRef.current = checked;
    if (trackRef.current && !isDraggingRef.current) {
      if (checked) {
        trackRef.current.classList.add("is-checked");
      } else {
        trackRef.current.classList.remove("is-checked");
      }
    }
  }, [checked]);

  // Clean up any pending rAF on unmount
  useEffect(() => {
    return () => {
      if (rAfRef.current !== null) {
        cancelAnimationFrame(rAfRef.current);
      }
    };
  }, []);

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

    // Cache track and thumb geometry once at start of gesture (prevents layout thrashing during move)
    if (trackRef.current && thumbRef.current) {
      const trackRect = trackRef.current.getBoundingClientRect();
      const thumbRect = thumbRef.current.getBoundingClientRect();
      travelRef.current = Math.max(12, trackRect.width - thumbRect.width - 4);
    } else {
      travelRef.current = size === "sm" ? 18 : 22;
    }

    isDraggingRef.current = true;
    startXRef.current = e.clientX;
    initialCheckedRef.current = checked;
    currentDragRatioRef.current = checked ? 1 : 0;

    trackRef.current?.classList.add("is-pressed");
    thumbRef.current?.classList.add("is-pressed");

    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {}
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current || !thumbRef.current) return;
    const dx = e.clientX - startXRef.current;

    if (Math.abs(dx) > 2) {
      trackRef.current?.classList.add("is-dragging");
      const travel = travelRef.current;
      const initialPos = initialCheckedRef.current ? travel : 0;
      const newPos = Math.max(0, Math.min(travel, initialPos + dx));
      const ratio = newPos / travel;
      currentDragRatioRef.current = ratio;

      // Batch transform directly on compositor frame — ZERO React state updates
      if (rAfRef.current !== null) {
        cancelAnimationFrame(rAfRef.current);
      }
      rAfRef.current = requestAnimationFrame(() => {
        if (thumbRef.current) {
          thumbRef.current.style.transform = `translate3d(${newPos}px, 0, 0) scaleX(1.12)`;
        }
        if (trackRef.current) {
          if (ratio >= 0.5) {
            trackRef.current.classList.add("is-checked");
          } else {
            trackRef.current.classList.remove("is-checked");
          }
        }
      });
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;

    if (rAfRef.current !== null) {
      cancelAnimationFrame(rAfRef.current);
      rAfRef.current = null;
    }

    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {}

    trackRef.current?.classList.remove("is-pressed", "is-dragging");
    if (thumbRef.current) {
      thumbRef.current.classList.remove("is-pressed");
      thumbRef.current.style.transform = "";
    }

    const ratio = currentDragRatioRef.current;
    const dragDelta = Math.abs(e.clientX - startXRef.current);
    currentDragRatioRef.current = null;

    if (ratio !== null && dragDelta > 4) {
      const nextChecked = ratio >= 0.5;
      if (nextChecked !== checked) {
        triggerHaptic("selection");
        onChange(nextChecked);
        return;
      }
      // Revert track class if stayed in the same state
      if (checked) {
        trackRef.current?.classList.add("is-checked");
      } else {
        trackRef.current?.classList.remove("is-checked");
      }
      return;
    }

    // Tap without significant drag
    handleToggle();
  };

  const handlePointerCancel = () => {
    isDraggingRef.current = false;
    if (rAfRef.current !== null) {
      cancelAnimationFrame(rAfRef.current);
      rAfRef.current = null;
    }
    trackRef.current?.classList.remove("is-pressed", "is-dragging");
    if (thumbRef.current) {
      thumbRef.current.classList.remove("is-pressed");
      thumbRef.current.style.transform = "";
    }
    if (checked) {
      trackRef.current?.classList.add("is-checked");
    } else {
      trackRef.current?.classList.remove("is-checked");
    }
    currentDragRatioRef.current = null;
  };

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
      className={`glass-switch-track size-${size} ${checked ? "is-checked" : ""} ${disabled ? "is-disabled" : ""} ${className}`}
      data-checked={checked ? "true" : "false"}
    >
      {name && <input type="hidden" name={name} value={checked ? "on" : "off"} />}
      <span
        ref={thumbRef}
        className="glass-switch-thumb"
      >
        <span className="glass-switch-specular" />
      </span>
    </div>
  );
};
