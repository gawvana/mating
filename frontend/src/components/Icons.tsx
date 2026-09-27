import React from "react";

export interface IconProps extends React.SVGProps<SVGSVGElement> {
  size?: number | string;
  filled?: boolean;
  strokeWidth?: number;
}

const defaultProps = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

/**
 * 1. IconList — Shopping list / clipboard (Navigation & Sections)
 */
export const IconList: React.FC<IconProps> = ({
  size = 20,
  filled = false,
  strokeWidth = 1.85,
  className = "",
  style,
  ...props
}) => (
  <svg
    {...defaultProps}
    width={size}
    height={size}
    strokeWidth={strokeWidth}
    className={`icon icon-list ${className}`}
    style={style}
    aria-hidden="true"
    {...props}
  >
    {filled ? (
      <>
        <rect x="4" y="4" width="16" height="16" rx="4" fill="currentColor" fillOpacity="0.18" stroke="currentColor" />
        <path d="M9 9h6M9 13h6M9 17h3" stroke="currentColor" />
        <circle cx="6.5" cy="9" r="0.75" fill="currentColor" stroke="none" />
        <circle cx="6.5" cy="13" r="0.75" fill="currentColor" stroke="none" />
        <circle cx="6.5" cy="17" r="0.75" fill="currentColor" stroke="none" />
      </>
    ) : (
      <>
        <rect x="4" y="3.5" width="16" height="17" rx="3.5" />
        <path d="M8.5 8.5h7M8.5 12h7M8.5 15.5h4.5" />
      </>
    )}
  </svg>
);

/**
 * 2. IconAI — Sparkles / Intelligence (Navigation & AI Assistant)
 */
export const IconAI: React.FC<IconProps> = ({
  size = 20,
  filled = false,
  strokeWidth = 1.85,
  className = "",
  style,
  ...props
}) => (
  <svg
    {...defaultProps}
    width={size}
    height={size}
    strokeWidth={strokeWidth}
    className={`icon icon-ai ${className}`}
    style={style}
    aria-hidden="true"
    {...props}
  >
    {filled ? (
      <>
        <path
          d="M12 2.5C12 7.2 15.8 11 20.5 11C15.8 11 12 14.8 12 19.5C12 14.8 8.2 11 3.5 11C8.2 11 12 7.2 12 2.5Z"
          fill="currentColor"
          stroke="currentColor"
        />
        <path
          d="M19 16C19 17.7 20.3 19 22 19C20.3 19 19 20.3 19 22C19 20.3 17.7 19 16 19C17.7 19 19 17.7 19 16Z"
          fill="currentColor"
          stroke="none"
        />
      </>
    ) : (
      <>
        <path d="M12 2.5C12 7.2 15.8 11 20.5 11C15.8 11 12 14.8 12 19.5C12 14.8 8.2 11 3.5 11C8.2 11 12 7.2 12 2.5Z" />
        <path d="M19 16C19 17.7 20.3 19 22 19C20.3 19 19 20.3 19 22C19 20.3 17.7 19 16 19C17.7 19 19 17.7 19 16Z" />
      </>
    )}
  </svg>
);

/**
 * 3. IconHistory — Time clock / Recent history
 */
export const IconHistory: React.FC<IconProps> = ({
  size = 20,
  filled = false,
  strokeWidth = 1.85,
  className = "",
  style,
  ...props
}) => (
  <svg
    {...defaultProps}
    width={size}
    height={size}
    strokeWidth={strokeWidth}
    className={`icon icon-history ${className}`}
    style={style}
    aria-hidden="true"
    {...props}
  >
    <circle cx="12" cy="12" r="8.5" fill={filled ? "currentColor" : "none"} fillOpacity={filled ? 0.18 : 0} />
    <path d="M12 7.5V12L15 14" />
  </svg>
);

/**
 * 4. IconStats — Analytical bar chart
 */
export const IconStats: React.FC<IconProps> = ({
  size = 20,
  filled = false,
  strokeWidth = 1.85,
  className = "",
  style,
  ...props
}) => (
  <svg
    {...defaultProps}
    width={size}
    height={size}
    strokeWidth={strokeWidth}
    className={`icon icon-stats ${className}`}
    style={style}
    aria-hidden="true"
    {...props}
  >
    <path d="M6 19.5V12" />
    <path d="M12 19.5V5.5" />
    <path d="M18 19.5V9" />
    {filled && (
      <>
        <rect x="5" y="12" width="2" height="7.5" rx="1" fill="currentColor" stroke="none" />
        <rect x="11" y="5.5" width="2" height="14" rx="1" fill="currentColor" stroke="none" />
        <rect x="17" y="9" width="2" height="10.5" rx="1" fill="currentColor" stroke="none" />
      </>
    )}
  </svg>
);

/**
 * 5. IconSettings — Precision gear / control
 */
export const IconSettings: React.FC<IconProps> = ({
  size = 20,
  filled = false,
  strokeWidth = 1.85,
  className = "",
  style,
  ...props
}) => (
  <svg
    {...defaultProps}
    width={size}
    height={size}
    strokeWidth={strokeWidth}
    className={`icon icon-settings ${className}`}
    style={style}
    aria-hidden="true"
    {...props}
  >
    <circle cx="12" cy="12" r="3" fill={filled ? "currentColor" : "none"} fillOpacity={filled ? 0.35 : 0} />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </svg>
);

/**
 * 6. IconPlus — Geometric plus (FAB & Add items)
 */
export const IconPlus: React.FC<IconProps> = ({
  size = 20,
  strokeWidth = 2.2,
  className = "",
  style,
  ...props
}) => (
  <svg
    {...defaultProps}
    width={size}
    height={size}
    strokeWidth={strokeWidth}
    className={`icon icon-plus ${className}`}
    style={style}
    aria-hidden="true"
    {...props}
  >
    <path d="M12 5v14M5 12h14" />
  </svg>
);

/**
 * 7. IconClose — Dismiss / X
 */
export const IconClose: React.FC<IconProps> = ({
  size = 20,
  strokeWidth = 2.2,
  className = "",
  style,
  ...props
}) => (
  <svg
    {...defaultProps}
    width={size}
    height={size}
    strokeWidth={strokeWidth}
    className={`icon icon-close ${className}`}
    style={style}
    aria-hidden="true"
    {...props}
  >
    <path d="M18 6L6 18M6 6l12 12" />
  </svg>
);

/**
 * 8. IconCheck — Success / Completed item checkmark
 */
export const IconCheck: React.FC<IconProps> = ({
  size = 20,
  strokeWidth = 2.2,
  className = "",
  style,
  ...props
}) => (
  <svg
    {...defaultProps}
    width={size}
    height={size}
    strokeWidth={strokeWidth}
    className={`icon icon-check ${className}`}
    style={style}
    aria-hidden="true"
    {...props}
  >
    <path d="M4.5 12.5L9.5 17.5L19.5 6.5" />
  </svg>
);

/**
 * 9. IconTrash — Apple-style clean wastebasket
 */
export const IconTrash: React.FC<IconProps> = ({
  size = 20,
  strokeWidth = 1.85,
  className = "",
  style,
  ...props
}) => (
  <svg
    {...defaultProps}
    width={size}
    height={size}
    strokeWidth={strokeWidth}
    className={`icon icon-trash ${className}`}
    style={style}
    aria-hidden="true"
    {...props}
  >
    <path d="M4 6.5h16" />
    <path d="M9 4h6a1 1 0 0 1 1 1v1.5H8V5a1 1 0 0 1 1-1z" />
    <path d="M6.5 6.5l1 13a2 2 0 0 0 2 1.5h5a2 2 0 0 0 2-1.5l1-13" />
    <path d="M10 11v6M14 11v6" />
  </svg>
);

/**
 * 10. IconEdit — Apple-style pencil and paper
 */
export const IconEdit: React.FC<IconProps> = ({
  size = 20,
  strokeWidth = 1.85,
  className = "",
  style,
  ...props
}) => (
  <svg
    {...defaultProps}
    width={size}
    height={size}
    strokeWidth={strokeWidth}
    className={`icon icon-edit ${className}`}
    style={style}
    aria-hidden="true"
    {...props}
  >
    <path d="M11 4H5a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h13a2 2 0 0 0 2-2v-6" />
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
  </svg>
);

/**
 * 11. IconChevron — Smooth arrow chevron (rotatable)
 */
export const IconChevron: React.FC<IconProps & { direction?: "up" | "down" | "left" | "right" }> = ({
  size = 20,
  strokeWidth = 2,
  direction = "down",
  className = "",
  style,
  ...props
}) => {
  const rotation = {
    down: 0,
    up: 180,
    left: 90,
    right: -90,
  }[direction];

  return (
    <svg
      {...defaultProps}
      width={size}
      height={size}
      strokeWidth={strokeWidth}
      className={`icon icon-chevron ${className}`}
      style={{ transform: `rotate(${rotation}deg)`, transition: "transform 0.25s cubic-bezier(0.28, 1.25, 0.45, 1)", ...style }}
      aria-hidden="true"
      {...props}
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
};

/**
 * 12. IconShare — iOS share box with arrow pointing up
 */
export const IconShare: React.FC<IconProps> = ({
  size = 20,
  strokeWidth = 1.85,
  className = "",
  style,
  ...props
}) => (
  <svg
    {...defaultProps}
    width={size}
    height={size}
    strokeWidth={strokeWidth}
    className={`icon icon-share ${className}`}
    style={style}
    aria-hidden="true"
    {...props}
  >
    <path d="M4 12v6a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-6" />
    <path d="M12 15V3m0 0l-4 4m4-4l4 4" />
  </svg>
);

/**
 * 13. IconSort — Clean slider sort lines
 */
export const IconSort: React.FC<IconProps> = ({
  size = 20,
  strokeWidth = 1.85,
  className = "",
  style,
  ...props
}) => (
  <svg
    {...defaultProps}
    width={size}
    height={size}
    strokeWidth={strokeWidth}
    className={`icon icon-sort ${className}`}
    style={style}
    aria-hidden="true"
    {...props}
  >
    <path d="M4 7h16M7 12h10M10 17h4" />
  </svg>
);

/**
 * 14. IconSun — Theme toggle (Light)
 */
export const IconSun: React.FC<IconProps> = ({
  size = 20,
  strokeWidth = 1.85,
  className = "",
  style,
  ...props
}) => (
  <svg
    {...defaultProps}
    width={size}
    height={size}
    strokeWidth={strokeWidth}
    className={`icon icon-sun ${className}`}
    style={style}
    aria-hidden="true"
    {...props}
  >
    <circle cx="12" cy="12" r="4.5" />
    <path d="M12 2.5v2.5M12 19v2.5M3 12h2.5M18.5 12H21M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M18.4 5.6l-1.8 1.8M7.4 16.6l-1.8 1.8" />
  </svg>
);

/**
 * 15. IconMoon — Theme toggle (Dark)
 */
export const IconMoon: React.FC<IconProps> = ({
  size = 20,
  strokeWidth = 1.85,
  className = "",
  style,
  ...props
}) => (
  <svg
    {...defaultProps}
    width={size}
    height={size}
    strokeWidth={strokeWidth}
    className={`icon icon-moon ${className}`}
    style={style}
    aria-hidden="true"
    {...props}
  >
    <path d="M20.5 13.8A8.5 8.5 0 1 1 10.2 3.5a6.8 6.8 0 0 0 10.3 10.3z" />
  </svg>
);

/**
 * 16. IconUndo — Curved rollback arrow
 */
export const IconUndo: React.FC<IconProps> = ({
  size = 18,
  strokeWidth = 2,
  className = "",
  style,
  ...props
}) => (
  <svg
    {...defaultProps}
    width={size}
    height={size}
    strokeWidth={strokeWidth}
    className={`icon icon-undo ${className}`}
    style={style}
    aria-hidden="true"
    {...props}
  >
    <path d="M3 10h11a5 5 0 0 1 0 10h-2" />
    <path d="M7 6L3 10l4 4" />
  </svg>
);

/**
 * 17. IconArrowUp — Action arrow up (Quick add submit)
 */
export const IconArrowUp: React.FC<IconProps> = ({
  size = 18,
  strokeWidth = 2.2,
  className = "",
  style,
  ...props
}) => (
  <svg
    {...defaultProps}
    width={size}
    height={size}
    strokeWidth={strokeWidth}
    className={`icon icon-arrow-up ${className}`}
    style={style}
    aria-hidden="true"
    {...props}
  >
    <path d="M12 19V5M5 12l7-7 7 7" />
  </svg>
);

/**
 * 18. IconSliders — Details tuning / preferences
 */
export const IconSliders: React.FC<IconProps> = ({
  size = 18,
  strokeWidth = 1.85,
  className = "",
  style,
  ...props
}) => (
  <svg
    {...defaultProps}
    width={size}
    height={size}
    strokeWidth={strokeWidth}
    className={`icon icon-sliders ${className}`}
    style={style}
    aria-hidden="true"
    {...props}
  >
    <line x1="4" y1="21" x2="4" y2="14" />
    <line x1="4" y1="10" x2="4" y2="3" />
    <line x1="12" y1="21" x2="12" y2="12" />
    <line x1="12" y1="8" x2="12" y2="3" />
    <line x1="20" y1="21" x2="20" y2="16" />
    <line x1="20" y1="12" x2="20" y2="3" />
    <line x1="1" y1="14" x2="7" y2="14" />
    <line x1="9" y1="8" x2="15" y2="8" />
    <line x1="17" y1="16" x2="23" y2="16" />
  </svg>
);

/**
 * 19. IconCart — Shopping bag / empty state
 */
export const IconCart: React.FC<IconProps> = ({
  size = 28,
  strokeWidth = 1.85,
  className = "",
  style,
  ...props
}) => (
  <svg
    {...defaultProps}
    width={size}
    height={size}
    strokeWidth={strokeWidth}
    className={`icon icon-cart ${className}`}
    style={style}
    aria-hidden="true"
    {...props}
  >
    <path d="M6 3L3 7v13a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V7l-3-4z" />
    <line x1="3" y1="7" x2="21" y2="7" />
    <path d="M16 11a4 4 0 0 1-8 0" />
  </svg>
);

/**
 * 20. IconRefresh — Sync / retry circle arrow
 */
export const IconRefresh: React.FC<IconProps> = ({
  size = 18,
  strokeWidth = 2,
  className = "",
  style,
  ...props
}) => (
  <svg
    {...defaultProps}
    width={size}
    height={size}
    strokeWidth={strokeWidth}
    className={`icon icon-refresh ${className}`}
    style={style}
    aria-hidden="true"
    {...props}
  >
    <path d="M21.5 2v6h-6M2.5 22v-6h6" />
    <path d="M20 11.5A8.5 8.5 0 0 0 5.5 6.5L2.5 9.5M21.5 14.5l-3 3A8.5 8.5 0 0 1 4 12.5" />
  </svg>
);

/**
 * 21. IconSearch — Search glass
 */
export const IconSearch: React.FC<IconProps> = ({
  size = 18,
  strokeWidth = 1.85,
  className = "",
  style,
  ...props
}) => (
  <svg
    {...defaultProps}
    width={size}
    height={size}
    strokeWidth={strokeWidth}
    className={`icon icon-search ${className}`}
    style={style}
    aria-hidden="true"
    {...props}
  >
    <circle cx="10.5" cy="10.5" r="7" />
    <path d="M15.5 15.5L21 21" />
  </svg>
);

/**
 * 22. Recipe Icons (Replaces emojis 🥘, 🍳, 🍲, 🥛 in AIScreen)
 */
export const IconRecipePot: React.FC<IconProps> = ({ size = 22, strokeWidth = 1.8, className = "", ...props }) => (
  <svg {...defaultProps} width={size} height={size} strokeWidth={strokeWidth} className={`icon icon-pot ${className}`} aria-hidden="true" {...props}>
    <path d="M4 11h16a1 1 0 0 1 1 1v6a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3v-6a1 1 0 0 1 1-1z" />
    <path d="M2 13h2M20 13h2M6 8a4 4 0 0 1 12 0" />
    <circle cx="12" cy="5" r="1.5" />
  </svg>
);

export const IconRecipePan: React.FC<IconProps> = ({ size = 22, strokeWidth = 1.8, className = "", ...props }) => (
  <svg {...defaultProps} width={size} height={size} strokeWidth={strokeWidth} className={`icon icon-pan ${className}`} aria-hidden="true" {...props}>
    <ellipse cx="10" cy="13" rx="7.5" ry="5.5" />
    <path d="M16.5 11l5-5" />
    <circle cx="9.5" cy="13" r="2" />
  </svg>
);

export const IconRecipeSoup: React.FC<IconProps> = ({ size = 22, strokeWidth = 1.8, className = "", ...props }) => (
  <svg {...defaultProps} width={size} height={size} strokeWidth={strokeWidth} className={`icon icon-soup ${className}`} aria-hidden="true" {...props}>
    <path d="M3 11c0 5 4 8 9 8s9-3 9-8H3z" />
    <path d="M8 4c0 2 2 3 2 4M12 4c0 2 2 3 2 4M16 4c0 2 2 3 2 4" />
  </svg>
);

export const IconRecipeBottle: React.FC<IconProps> = ({ size = 22, strokeWidth = 1.8, className = "", ...props }) => (
  <svg {...defaultProps} width={size} height={size} strokeWidth={strokeWidth} className={`icon icon-bottle ${className}`} aria-hidden="true" {...props}>
    <path d="M9 3h6v3H9zM8 8a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2V8z" />
    <path d="M8 12h8" />
  </svg>
);

/**
 * 23. IconScroll — Receipt / Document parchment (Replaces 📜 in HistoryScreen)
 */
export const IconScroll: React.FC<IconProps> = ({ size = 26, strokeWidth = 1.8, className = "", ...props }) => (
  <svg {...defaultProps} width={size} height={size} strokeWidth={strokeWidth} className={`icon icon-scroll ${className}`} aria-hidden="true" {...props}>
    <path d="M8 3h9a2 2 0 0 1 2 2v13.5a1.5 1.5 0 0 1-2.5 1.1L15 18.5l-2.5 1.6-2.5-1.6L5 20.1a1.5 1.5 0 0 1-2-1.4V6a3 3 0 0 1 3-3z" />
    <path d="M8 8h8M8 12h6" />
  </svg>
);
