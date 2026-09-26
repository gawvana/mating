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
const MAX_OVERDRAG = 42;       // asymptotic rubber band limit

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
  const itemRef = useRef<HTMLDivElement>(null);
  const bgRightRef = useRef<HTMLDivElement>(null);
  const bgLeftRef = useRef<HTMLDivElement>(null);
  const iconRightRef = useRef<SVGSVGElement>(null);
  const iconLeftRef = useRef<SVGSVGElement>(null);

  const startX = useRef(0);
  const startY = useRef(0);
  const currentX = useRef(0);
  const isDragging = useRef(false);
  const isDecided = useRef(false);  // vertical or horizontal scroll decision
  const committed = useRef(false);
  const thresholdPassed = useRef(false);
  const lastMoveTime = useRef(0);
  const lastMoveX = useRef(0);
  const moveVelocity = useRef(0);

  const resetPosition = useCallback((animate = true) => {
    const el = itemRef.current;
    if (!el) return;
    el.style.willChange = "";
    el.classList.remove("swiping");
    el.style.transition = animate ? "transform .45s var(--spring)" : "none";
    el.style.transform = "translateX(0)";
    if (bgRightRef.current) bgRightRef.current.style.opacity = "0";
    if (bgLeftRef.current) bgLeftRef.current.style.opacity = "0";
    if (iconRightRef.current) iconRightRef.current.style.opacity = "0";
    if (iconLeftRef.current) iconLeftRef.current.style.opacity = "0";
  }, []);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (!swipeEnabled || e.button !== 0) return;
    startX.current = e.clientX;
    startY.current = e.clientY;
    lastMoveX.current = e.clientX;
    lastMoveTime.current = performance.now();
    currentX.current = 0;
    moveVelocity.current = 0;
    isDragging.current = false;
    isDecided.current = false;
    committed.current = false;
    thresholdPassed.current = false;
    // NOTE: DO NOT capture pointer here to allow native pan-y scrolling on iOS/Android
  }, [swipeEnabled]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (committed.current) return;
    const dx = e.clientX - startX.current;
    const dy = e.clientY - startY.current;

    // Track instantaneous release velocity
    const now = performance.now();
    const dt = now - lastMoveTime.current;
    if (dt > 16) {
      moveVelocity.current = (e.clientX - lastMoveX.current) / dt;
      lastMoveX.current = e.clientX;
      lastMoveTime.current = now;
    }

    if (!isDecided.current) {
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
      isDecided.current = true;
      if (Math.abs(dy) >= Math.abs(dx)) {
        // Vertical scroll - abandon swipe and allow native scrolling
        isDragging.current = false;
        return;
      }
      // Horizontal swipe confirmed: capture pointer now
      isDragging.current = true;
      try {
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      } catch {}
      if (itemRef.current) {
        itemRef.current.style.willChange = "transform";
        itemRef.current.classList.add("swiping");
      }
    }

    if (!isDragging.current) return;

    currentX.current = dx;
    const el = itemRef.current;
    if (!el) return;

    // Asymptotic rubber-band resistance beyond threshold
    let tx: number;
    const adx = Math.abs(dx);
    if (adx <= COMMIT_THRESHOLD) {
      tx = dx;
    } else {
      const over = adx - COMMIT_THRESHOLD;
      const damped = (over * MAX_OVERDRAG) / (over + MAX_OVERDRAG);
      tx = Math.sign(dx) * (COMMIT_THRESHOLD + damped);
    }

    // Detent haptic tick on crossing commit threshold
    if (adx >= COMMIT_THRESHOLD && !thresholdPassed.current) {
      thresholdPassed.current = true;
      if (hapticsEnabled) triggerHaptic("selection");
    } else if (adx < COMMIT_THRESHOLD && thresholdPassed.current) {
      thresholdPassed.current = false;
    }

    const progress = clamp(adx / COMMIT_THRESHOLD, 0, 1);
    const iconOpacity = String(clamp(progress * 2 - 0.4, 0, 1));

    if (dx > 0) {
      if (bgRightRef.current) bgRightRef.current.style.opacity = String(progress);
      if (bgLeftRef.current) bgLeftRef.current.style.opacity = "0";
      if (iconRightRef.current) iconRightRef.current.style.opacity = iconOpacity;
      if (iconLeftRef.current) iconLeftRef.current.style.opacity = "0";
    } else {
      if (bgLeftRef.current) bgLeftRef.current.style.opacity = String(progress);
      if (bgRightRef.current) bgRightRef.current.style.opacity = "0";
      if (iconLeftRef.current) iconLeftRef.current.style.opacity = iconOpacity;
      if (iconRightRef.current) iconRightRef.current.style.opacity = "0";
    }

    el.style.transition = "none";
    el.style.transform = `translateX(${tx}px)`;
  }, [hapticsEnabled]);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    if (!isDragging.current || committed.current) {
      isDragging.current = false;
      return;
    }
    isDragging.current = false;

    const dx = currentX.current;
    const v = Math.abs(moveVelocity.current);
    // Requires minimum 36px displacement even on fast flicks
    const shouldCommit = (Math.abs(dx) >= COMMIT_THRESHOLD) || (Math.abs(dx) >= 36 && v >= 0.55);

    if (shouldCommit) {
      committed.current = true;
      if (hapticsEnabled) triggerHaptic("medium");
      if (dx > 0) {
        onSwipeRight(item);
      } else {
        onSwipeLeft(item);
      }

      setTimeout(() => {
        committed.current = false;
        resetPosition(true);
      }, 100);
    } else {
      resetPosition(true);
    }

    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {}
  }, [hapticsEnabled, item, onSwipeLeft, onSwipeRight, resetPosition]);

  const handlePointerCancel = useCallback(() => {
    isDragging.current = false;
    committed.current = false;
    resetPosition(true);
  }, [resetPosition]);

  if (!swipeEnabled) {
    return (
      <div className="swipe-wrapper">
        <div className="swipe-item" ref={itemRef}>
          {children}
        </div>
      </div>
    );
  }

  return (
    <div className="swipe-wrapper">
      {/* Right swipe background (Buy/Restore) */}
      <div className="swipe-bg swipe-bg-right" ref={bgRightRef} style={{ opacity: 0 }}>
        <svg className="swipe-bg-icon" ref={iconRightRef} viewBox="0 0 24 24" aria-hidden="true" style={{ opacity: 0 }}>
          {onSwipedRight
            ? <path d="M3 12h18M12 3l9 9-9 9" />   /* restore arrow */
            : <path d="M20 6L9 17l-5-5" />          /* checkmark */
          }
        </svg>
      </div>

      {/* Left swipe background (Delete) */}
      <div className="swipe-bg swipe-bg-left" ref={bgLeftRef} style={{ opacity: 0 }}>
        <svg className="swipe-bg-icon" ref={iconLeftRef} viewBox="0 0 24 24" aria-hidden="true" style={{ opacity: 0 }}>
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
      >
        {children}
      </div>
    </div>
  );
});

SwipeableItem.displayName = "SwipeableItem";
