/**
 * RelativeTime Component
 *
 * Displays relative time (e.g., "3 minutes ago", "just now") that auto-updates.
 * Uses smooth text updates to avoid flickering.
 */
import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
  memo,
} from "react";
import { Tooltip, Typography, TypographyProps } from "@mui/material";
import { useTranslation } from "react-i18next";
import { formatRelativeTime, formatDateTimeDetailed } from "@/utils/dateFormat";

interface RelativeTimeProps {
  /** Date value (ISO string, Date object, or null/undefined) */
  date: string | Date | null | undefined;
  /** Show tooltip with full date/time on hover (default: true) */
  showTooltip?: boolean;
  /** Typography variant (default: 'body2') */
  variant?: TypographyProps["variant"];
  /** Typography color (default: 'text.secondary') */
  color?: TypographyProps["color"];
  /** Additional sx props */
  sx?: TypographyProps["sx"];
  /** Update interval in milliseconds (default: auto based on time distance) */
  updateInterval?: number;
  /** Show seconds for recent times (default: false) */
  showSeconds?: boolean;
  /** Base time for calculation (default: Date.now()) */
  baseTime?: number;
}

/**
 * Calculate optimal update interval based on time distance
 * - Less than 1 minute: update every 1 second (when showSeconds) or 10 seconds
 * - Less than 1 hour: update every 30 seconds
 * - Less than 1 day: update every 1 minute
 * - More than 1 day: update every 5 minutes
 */
const getOptimalInterval = (date: Date, showSeconds?: boolean): number => {
  const now = Date.now();
  const diff = now - date.getTime();

  if (diff < 60 * 1000) {
    return showSeconds ? 1000 : 10000; // < 1 minute: every 1 sec (showSeconds) or 10 sec
  }
  if (diff < 60 * 60 * 1000) return 30000; // < 1 hour: every 30 seconds
  if (diff < 24 * 60 * 60 * 1000) return 60000; // < 1 day: every 1 minute
  return 5 * 60 * 1000; // > 1 day: every 5 minutes
};

/**
 * RelativeTime component that displays time like "3 minutes ago" and auto-updates
 * Memoized to prevent unnecessary re-renders from parent components
 */
const RelativeTimeInner: React.FC<RelativeTimeProps> = ({
  date,
  showTooltip = true,
  variant = "body2",
  color = "text.secondary",
  sx,
  updateInterval,
  showSeconds = false,
  baseTime,
}) => {
  const { t, i18n } = useTranslation();
  const [relativeText, setRelativeText] = useState(() =>
    formatRelativeTime(date, { showSeconds, baseTime }, i18n.language),
  );
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Memoize the parsed date to avoid recalculating
  const parsedDate = useMemo(() => {
    if (!date) return null;
    return date instanceof Date ? date : new Date(date);
  }, [date]);

  // Update the relative time text only if it actually changed
  const updateRelativeTime = useCallback(() => {
    const newText = formatRelativeTime(
      date,
      { showSeconds, baseTime },
      i18n.language,
    );
    setRelativeText((prev) => (prev === newText ? prev : newText));
  }, [date, showSeconds, baseTime, i18n.language]);

  useEffect(() => {
    // Initial update
    updateRelativeTime();

    if (!parsedDate || isNaN(parsedDate.getTime())) return;

    // Clear existing interval
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    // Calculate interval
    const interval =
      updateInterval ?? getOptimalInterval(parsedDate, showSeconds);

    // Set up interval for updates
    intervalRef.current = setInterval(updateRelativeTime, interval);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [
    parsedDate,
    updateInterval,
    updateRelativeTime,
    showSeconds,
    i18n.language,
  ]);

  // Handle invalid or missing date
  if (!date || relativeText === "-") {
    return (
      <Typography variant={variant} color={color} sx={sx}>
        -
      </Typography>
    );
  }

  // Process the text - handle __SECONDS_AGO__ special format
  let displayText = relativeText;
  if (relativeText.startsWith("__SECONDS_AGO__")) {
    const seconds = parseInt(relativeText.replace("__SECONDS_AGO__", ""), 10);
    displayText = t("common.relativeTime.secondsAgo", { seconds });
  }

  const fullDateTime = formatDateTimeDetailed(date);

  const content = (
    <Typography
      component="span"
      variant={variant}
      color={color}
      sx={{
        display: "inline-flex",
        whiteSpace: "nowrap",
        verticalAlign: "middle",
        ...sx,
      }}
    >
      {displayText}
    </Typography>
  );

  if (showTooltip) {
    return (
      <Tooltip title={fullDateTime} arrow placement="top">
        {content}
      </Tooltip>
    );
  }

  return content;
};

// Memoize the component to prevent unnecessary re-renders
export const RelativeTime = memo(RelativeTimeInner);

export default RelativeTime;
