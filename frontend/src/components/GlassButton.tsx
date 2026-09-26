import React, { useRef, useCallback, memo } from "react";
import { triggerHaptic } from "../telegram/telegram";

export type GlassButtonVariant = "glass" | "primary" | "secondary" | "tonal" | "ghost" | "danger";
export type GlassButtonSize = "sm" | "md" | "lg" | "icon";
export type GlassButtonHaptic = "light" | "medium" | "heavy" | "selection" | "none";

export interface GlassButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: GlassButtonVariant;
  size?: GlassButtonSize;
  selected?: boolean;
  loading?: boolean;
  haptic?: GlassButtonHaptic;
  specular?: boolean;
  icon?: React.ReactNode;
  trailingIcon?: React.ReactNode;
  children?: React.ReactNode;
}

export const GlassButton = memo<GlassButtonProps>(({
  variant = "glass",
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
  type = "button",
  ...rest
}) => {
  const btnRef = useRef<HTMLButtonElement>(null);

  // Desktop specular tracking: update local CSS vars only on fine pointers
  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLButtonElement>) => {
      if (specular && window.matchMedia?.("(pointer: fine)").matches && btnRef.current) {
        const rect = btnRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        btnRef.current.style.setProperty("--btn-mx", `${x}px`);
        btnRef.current.style.setProperty("--btn-my", `${y}px`);
      }
      onPointerMove?.(e);
    },
    [specular, onPointerMove]
  );

  // Snappy press tactile feedback
  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLButtonElement>) => {
      if (!disabled && !loading && haptic !== "none") {
        triggerHaptic(haptic);
      }
      onPointerDown?.(e);
    },
    [disabled, loading, haptic, onPointerDown]
  );

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
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onClick={isInteractive ? onClick : undefined}
      className={`glass-btn glass-btn--${variant} glass-btn--${size} ${selected ? "is-selected" : ""} ${loading ? "is-loading" : ""} ${className}`}
      style={style}
      {...rest}
    >
      {/* Visual content container: visibility toggles in loading state to prevent layout shift */}
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

GlassButton.displayName = "GlassButton";
