/**
 * SafeTooltip - MUI Tooltip wrapper that properly hides on click.
 *
 * Fixes the known MUI issue where Tooltip stays visible when the child
 * element opens a portal-based component (Select, Menu, Popover, etc.).
 * The tooltip is manually controlled: it shows on mouseenter, hides on
 * mouseleave AND on click, preventing stuck tooltips.
 *
 * Usage: Drop-in replacement for MUI Tooltip.
 *   <SafeTooltip title="description">
 *     <FormControl>...</FormControl>
 *   </SafeTooltip>
 */
import React, { useState, useCallback, useRef } from 'react';
import { Tooltip, TooltipProps } from '@mui/material';

export type SafeTooltipProps = Omit<
  TooltipProps,
  | 'open'
  | 'onOpen'
  | 'onClose'
  | 'disableHoverListener'
  | 'disableFocusListener'
  | 'disableTouchListener'
>;

const SafeTooltip: React.FC<SafeTooltipProps> = ({
  children,
  title,
  ...rest
}) => {
  const [open, setOpen] = useState(false);
  const hoverRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const handleMouseEnter = useCallback(() => {
    hoverRef.current = true;
    clearTimer();
    // Delay showing tooltip so quick hover+click doesn't flash
    timerRef.current = setTimeout(() => {
      if (hoverRef.current) setOpen(true);
    }, 300);
  }, [clearTimer]);

  const handleMouseLeave = useCallback(() => {
    hoverRef.current = false;
    clearTimer();
    setOpen(false);
  }, [clearTimer]);

  // Close on mousedown (before portal opens for Select/Menu)
  const handleMouseDown = useCallback(() => {
    clearTimer();
    setOpen(false);
  }, [clearTimer]);

  // Don't render tooltip if no title
  if (!title) {
    return <>{children}</>;
  }

  return (
    <Tooltip
      {...rest}
      title={title}
      open={open}
      disableHoverListener
      disableFocusListener
      disableTouchListener
    >
      <span
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onMouseDown={handleMouseDown}
        style={{ display: 'inline-flex' }}
      >
        {children}
      </span>
    </Tooltip>
  );
};

export default SafeTooltip;
