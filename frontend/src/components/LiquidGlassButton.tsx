import React, { useRef, useCallback, memo, useEffect } from "react";
import { triggerHaptic } from "../telegram/telegram";

export type LiquidGlassButtonVariant =
  | "prominent"
  | "primary"
  | "neutral"
  | "secondary"
  | "glass"
  | "subtle"
  | "tonal"
  | "ghost"
  | "destructive"
  | "danger";

export type LiquidGlassButtonSize = "sm" | "md" | "lg" | "icon";
export type LiquidGlassButtonHaptic = "light" | "medium" | "heavy" | "selection" | "none";

export interface LiquidGlassButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: LiquidGlassButtonVariant;
  size?: LiquidGlassButtonSize;
  selected?: boolean;
  loading?: boolean;
  haptic?: LiquidGlassButtonHaptic;
  specular?: boolean;
  icon?: React.ReactNode;
  trailingIcon?: React.ReactNode;
  children?: React.ReactNode;
}

/**
 * Normalizes material variant to one of the 4 canonical Liquid Glass tiers:
 * - prominent: Vibrant accent tinted glass with specular shine & outer glow (Primary CTA)
 * - neutral: Frosted translucent glass with subtle specular border (Utility/Default)
 * - subtle: Low-weight surface for secondary/ghost actions
 * - destructive: Frosted danger tinted glass (Delete/Clear)
 */
function normalizeVariant(v: LiquidGlassButtonVariant): "prominent" | "neutral" | "subtle" | "destructive" {
  if (v === "prominent" || v === "primary") return "prominent";
  if (v === "neutral" || v === "secondary" || v === "glass") return "neutral";
  if (v === "destructive" || v === "danger") return "destructive";
  return "subtle";
}

/**
 * Liquid Glass 2.0 Button Primitive
 *
 * Implements Apple-inspired Liquid Glass material with tactile compression:
 * - 4 distinct material variants: prominent, neutral, subtle, destructive
 * - Real translucent refractive depth (color-mix + backdrop-filter + specular inset)
 * - Zero forced-layout specular tracking (cached rect on enter + rAF throttle)
 * - Hardware-accelerated press compression (scale 0.97)
 * - Built-in zero-layout-shift centered loading spinner
 * - Integrated Telegram/web haptics
 */
export const LiquidGlassButton = memo<LiquidGlassButtonProps>(({
  variant = "neutral",
  size = "md",
  selected = false,
  loading = false,
  disabled = false,
  haptic = "selection",
  specular = true,
  icon,
  trailingIcon,
  children,
  className = "",
  style,
  onClick,
  onPointerDown,
  onPointerMove,
  onPointerEnter,
  onPointerLeave,
  type = "button",
  ...rest
}) => {
  const btnRef = useRef<HTMLButtonElement>(null);
  const rectRef = useRef<{ left: number; top: number; width: number; height: number } | null>(null);
  const rAfRef = useRef<number | null>(null);

  // Clean up rAF on unmount
  useEffect(() => {
    return () => {
      if (rAfRef.current !== null) {
        cancelAnimationFrame(rAfRef.current);
      }
    };
  }, []);

  // Cache button rect on pointer enter to avoid getBoundingClientRect layout thrashing in pointermove
  const handlePointerEnter = useCallback(
    (e: React.PointerEvent<HTMLButtonElement>) => {
      if (window.matchMedia?.("(pointer: fine)").matches && btnRef.current) {
        const r = btnRef.current.getBoundingClientRect();
        rectRef.current = { left: r.left, top: r.top, width: r.width, height: r.height };
      }
      onPointerEnter?.(e);
    },
    [onPointerEnter]
  );

  // Desktop specular tracking & subtle magnetic pull with rAF batching
  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLButtonElement>) => {
      if (window.matchMedia?.("(pointer: fine)").matches && btnRef.current && rectRef.current) {
        const rect = rectRef.current;
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        if (rAfRef.current !== null) {
          cancelAnimationFrame(rAfRef.current);
        }
        rAfRef.current = requestAnimationFrame(() => {
          if (!btnRef.current) return;
          if (specular) {
            btnRef.current.style.setProperty("--btn-mx", `${x}px`);
            btnRef.current.style.setProperty("--btn-my", `${y}px`);
          }
          // Magnetic subtle pull (max 4px)
          const centerX = rect.width / 2;
          const centerY = rect.height / 2;
          const pullX = Math.max(-4, Math.min(4, (x - centerX) * 0.1));
          const pullY = Math.max(-4, Math.min(4, (y - centerY) * 0.1));
          btnRef.current.style.transform = `translate3d(${pullX}px, ${pullY}px, 0)`;
        });
      }
      onPointerMove?.(e);
    },
    [specular, onPointerMove]
  );

  const handlePointerLeave = useCallback(
    (e: React.PointerEvent<HTMLButtonElement>) => {
      rectRef.current = null;
      if (rAfRef.current !== null) {
        cancelAnimationFrame(rAfRef.current);
        rAfRef.current = null;
      }
      if (btnRef.current) {
        btnRef.current.style.transform = "";
      }
      onPointerLeave?.(e);
    },
    [onPointerLeave]
  );

  // Tactile press & ripple feedback
  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLButtonElement>) => {
      if (!disabled && !loading) {
        if (haptic !== "none") {
          triggerHaptic(haptic);
        }

        // Tap ripple feedback for tactile warmth
        if (btnRef.current) {
          const r = rectRef.current || btnRef.current.getBoundingClientRect();
          const ripple = document.createElement("span");
          ripple.className = "ripple-effect";
          const rippleSize = Math.max(r.width, r.height);
          const x = e.clientX - r.left - rippleSize / 2;
          const y = e.clientY - r.top - rippleSize / 2;
          ripple.style.width = `${rippleSize}px`;
          ripple.style.height = `${rippleSize}px`;
          ripple.style.left = `${x}px`;
          ripple.style.top = `${y}px`;
          btnRef.current.appendChild(ripple);
          setTimeout(() => ripple.remove(), 550);
        }
      }
      onPointerDown?.(e);
    },
    [disabled, loading, haptic, onPointerDown]
  );

  const canonicalVariant = normalizeVariant(variant);
  const isInteractive = !disabled && !loading;

  return (
    <button
      ref={btnRef}
      type={type}
      disabled={disabled || loading}
      aria-disabled={disabled || loading}
      aria-busy={loading}
      aria-pressed={selected ? true : undefined}
      data-selected={selected ? "true" : undefined}
      data-loading={loading ? "true" : undefined}
      data-variant={canonicalVariant}
      onPointerEnter={handlePointerEnter}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      onPointerDown={handlePointerDown}
      onClick={isInteractive ? onClick : undefined}
      className={`glass-btn glass-btn--${canonicalVariant} glass-btn--${size} ${selected ? "is-selected" : ""} ${loading ? "is-loading" : ""} ${className}`}
      style={style}
      {...rest}
    >
      {/* Specular sheen overlay */}
      <span className="glass-btn__sheen" aria-hidden="true" />

      {/* Button content (hidden during loading to preserve layout) */}
      <span className="glass-btn__inner" style={{ visibility: loading ? "hidden" : "visible" }}>
        {icon && <span className="glass-btn__icon" aria-hidden="true">{icon}</span>}
        {children && <span className="glass-btn__label">{children}</span>}
        {trailingIcon && <span className="glass-btn__icon glass-btn__icon--trailing" aria-hidden="true">{trailingIcon}</span>}
      </span>

      {/* Loading Spinner: absolute centered, zero layout shift */}
      {loading && (
        <span className="glass-btn__spinner-slot" aria-hidden="true">
          <span className="glass-btn__spinner" />
        </span>
      )}
    </button>
  );
});

LiquidGlassButton.displayName = "LiquidGlassButton";

/**
 * Re-export as GlassButton for seamless drop-in backwards compatibility
 */
export const GlassButton = LiquidGlassButton;

/**
 * Liquid Glass Icon Button
 */
export interface LiquidGlassIconButtonProps extends Omit<LiquidGlassButtonProps, "size" | "icon" | "trailingIcon"> {
  size?: "sm" | "md" | "lg";
  icon: React.ReactNode;
}

export const LiquidGlassIconButton = memo<LiquidGlassIconButtonProps>(({
  size = "md",
  icon,
  className = "",
  ...props
}) => {
  return (
    <LiquidGlassButton
      {...props}
      size="icon"
      className={`glass-btn--icon-${size} ${className}`}
    >
      {icon}
    </LiquidGlassButton>
  );
});

LiquidGlassIconButton.displayName = "LiquidGlassIconButton";

/**
 * Liquid Glass Chip Primitive
 */
export interface LiquidGlassChipProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  selected?: boolean;
  icon?: React.ReactNode;
  children: React.ReactNode;
}

export const LiquidGlassChip = memo<LiquidGlassChipProps>(({
  selected = false,
  icon,
  children,
  className = "",
  onClick,
  ...rest
}) => {
  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    triggerHaptic("selection");
    onClick?.(e);
  };

  return (
    <button
      type="button"
      className={`glass-chip ${selected ? "is-selected" : ""} ${className}`}
      onClick={handleClick}
      aria-pressed={selected}
      {...rest}
    >
      {icon && <span className="glass-chip-icon">{icon}</span>}
      <span>{children}</span>
    </button>
  );
});

LiquidGlassChip.displayName = "LiquidGlassChip";
