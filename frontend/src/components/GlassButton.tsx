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

  // Desktop specular tracking & Magnetic pull (#36)
  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLButtonElement>) => {
      if (window.matchMedia?.("(pointer: fine)").matches && btnRef.current) {
        const rect = btnRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        if (specular) {
          btnRef.current.style.setProperty("--btn-mx", `${x}px`);
          btnRef.current.style.setProperty("--btn-my", `${y}px`);
        }

        // Magnetic pull effect (max 6px)
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;
        const pullX = Math.max(-6, Math.min(6, (x - centerX) * 0.15));
        const pullY = Math.max(-6, Math.min(6, (y - centerY) * 0.15));
        btnRef.current.style.transform = `translate3d(${pullX}px, ${pullY}px, 0)`;
      }
      onPointerMove?.(e);
    },
    [specular, onPointerMove]
  );

  const handlePointerLeave = useCallback(
    (e: React.PointerEvent<HTMLButtonElement>) => {
      if (btnRef.current) {
        btnRef.current.style.transform = "";
      }
      rest.onPointerLeave?.(e);
    },
    [rest]
  );

  // Snappy press tactile feedback & Ripple tap (#58)
  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLButtonElement>) => {
      if (!disabled && !loading) {
        if (haptic !== "none") {
          triggerHaptic(haptic);
        }

        if (btnRef.current) {
          const rect = btnRef.current.getBoundingClientRect();
          const ripple = document.createElement("span");
          ripple.className = "ripple-effect";
          const size = Math.max(rect.width, rect.height);
          const x = e.clientX - rect.left - size / 2;
          const y = e.clientY - rect.top - size / 2;
          ripple.style.width = `${size}px`;
          ripple.style.height = `${size}px`;
          ripple.style.left = `${x}px`;
          ripple.style.top = `${y}px`;
          btnRef.current.appendChild(ripple);
          setTimeout(() => ripple.remove(), 600);
        }
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
      onPointerLeave={handlePointerLeave}
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
