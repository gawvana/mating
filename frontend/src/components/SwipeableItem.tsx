import React, { useCallback, useRef } from "react";
import { triggerHaptic } from "../telegram/telegram";
import { ShoppingItem } from "../types";

interface SwipeableItemProps {
  item: ShoppingItem;
  children: React.ReactNode;
  onSwipeRight: (item: ShoppingItem) => void; // Buy / Restore
  onSwipedRight?: boolean; // whether the right action label should say "Restore"
  onSwipeLeft: (item: ShoppingItem) => void;  // Delete
  hapticsEnabled: boolean;
  swipeEnabled: boolean;
}

const COMMIT_THRESHOLD = 80;   // px to commit action
const RESIST_FACTOR = 0.35;    // how much resistance beyond threshold

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

export const SwipeableItem: React.FC<SwipeableItemProps> = React.memo(({
  item,
  children,
  onSwipeRight,
  onSwipedRight = false,
  onSwipeLeft,
  hapticsEnabled,
  swipeEnabled,
}) => {
  const wrapRef = useRef<HTMLDivElement>(null);
  const itemRef = useRef<HTMLDivElement>(null);
  const bgRightRef = useRef<HTMLDivElement>(null);
  const bgLeftRef = useRef<HTMLDivElement>(null);
  const startX = useRef(0);
  const startY = useRef(0);
  const currentX = useRef(0);
  const isDragging = useRef(false);
  const isDecided = useRef(false);  // vertical or horizontal scroll decision
  const startTime = useRef(0);
  const committed = useRef(false);

  const resetPosition = useCallback((animate = true) => {
    const el = itemRef.current;
    if (!el) return;
    el.style.transition = animate ? "transform .45s var(--spring)" : "none";
    el.style.transform = "translateX(0)";
    if (bgRightRef.current) bgRightRef.current.style.opacity = "0";
    if (bgLeftRef.current) bgLeftRef.current.style.opacity = "0";
    const icons = wrapRef.current?.querySelectorAll<HTMLElement>(".swipe-bg-icon");
    icons?.forEach(ic => ic.style.opacity = "0");
  }, []);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (!swipeEnabled || e.button !== 0) return;
    startX.current = e.clientX;
    startY.current = e.clientY;
    startTime.current = Date.now();
    currentX.current = 0;
    isDragging.current = false;
    isDecided.current = false;
    committed.current = false;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }, [swipeEnabled]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (committed.current) return;
    const dx = e.clientX - startX.current;
    const dy = e.clientY - startY.current;

    if (!isDecided.current) {
      if (Math.abs(dx) < 5 && Math.abs(dy) < 5) return;
      isDecided.current = true;
      // if more vertical, don't swipe
      if (Math.abs(dy) > Math.abs(dx)) {
        isDragging.current = false;
        return;
      }
      isDragging.current = true;
    }

    if (!isDragging.current) return;

    currentX.current = dx;
    const el = itemRef.current;
    if (!el) return;

    let tx: number;
    let bgOpacity = 0;

    if (dx > 0) {
      // swiping right → buy action
      tx = dx < COMMIT_THRESHOLD
        ? dx
        : COMMIT_THRESHOLD + (dx - COMMIT_THRESHOLD) * RESIST_FACTOR;
      bgOpacity = clamp(dx / COMMIT_THRESHOLD, 0, 1);
      if (bgRightRef.current) bgRightRef.current.style.opacity = String(bgOpacity);
      if (bgLeftRef.current) bgLeftRef.current.style.opacity = "0";
    } else {
      // swiping left → delete action
      const adx = Math.abs(dx);
      tx = adx < COMMIT_THRESHOLD
        ? dx
        : -(COMMIT_THRESHOLD + (adx - COMMIT_THRESHOLD) * RESIST_FACTOR);
      bgOpacity = clamp(adx / COMMIT_THRESHOLD, 0, 1);
      if (bgLeftRef.current) bgLeftRef.current.style.opacity = String(bgOpacity);
      if (bgRightRef.current) bgRightRef.current.style.opacity = "0";
    }

    // Show icon when approaching threshold
    const icons = wrapRef.current?.querySelectorAll<HTMLElement>(".swipe-bg-icon");
    icons?.forEach(ic => ic.style.opacity = String(clamp(bgOpacity * 2 - 0.5, 0, 1)));

    el.style.transition = "none";
    el.style.transform = `translateX(${tx}px)`;
  }, []);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    if (!isDragging.current || committed.current) {
      isDragging.current = false;
      return;
    }
    isDragging.current = false;

    const dx = currentX.current;
    const elapsed = Date.now() - startTime.current;
    const velocity = Math.abs(dx) / Math.max(1, elapsed);

    const shouldCommit = Math.abs(dx) >= COMMIT_THRESHOLD || velocity >= 0.5;

    if (shouldCommit) {
      committed.current = true;
      if (dx > 0) {
        if (hapticsEnabled) triggerHaptic("medium");
        onSwipeRight(item);
      } else {
        if (hapticsEnabled) triggerHaptic("medium");
        onSwipeLeft(item);
      }
      // Spring back after short delay (action will cause rerender)
      setTimeout(() => {
        committed.current = false;
        resetPosition(true);
      }, 80);
    } else {
      // Spring back without action
      resetPosition(true);
    }
    void e; // suppress lint
  }, [hapticsEnabled, item, onSwipeLeft, onSwipeRight, resetPosition]);

  const handlePointerCancel = useCallback(() => {
    isDragging.current = false;
    committed.current = false;
    resetPosition(true);
  }, [resetPosition]);

  if (!swipeEnabled) {
    return (
      <div className="swipe-wrapper" ref={wrapRef}>
        <div className="swipe-item" ref={itemRef}>
          {children}
        </div>
      </div>
    );
  }

  return (
    <div className="swipe-wrapper" ref={wrapRef}>
      {/* Right swipe background (Buy/Restore) */}
      <div className="swipe-bg swipe-bg-right" ref={bgRightRef} style={{ opacity: 0 }}>
        <svg className="swipe-bg-icon" viewBox="0 0 24 24" aria-hidden="true">
          {onSwipedRight
            ? <path d="M3 12h18M12 3l9 9-9 9" />   /* restore arrow */
            : <path d="M20 6L9 17l-5-5" />          /* checkmark */
          }
        </svg>
      </div>

      {/* Left swipe background (Delete) */}
      <div className="swipe-bg swipe-bg-left" ref={bgLeftRef} style={{ opacity: 0 }}>
        <svg className="swipe-bg-icon" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" />
        </svg>
      </div>

      {/* The actual item row */}
      <div
        className="swipe-item"
        ref={itemRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        style={{ touchAction: "pan-y" }}
      >
        {children}
      </div>
    </div>
  );
});

SwipeableItem.displayName = "SwipeableItem";
