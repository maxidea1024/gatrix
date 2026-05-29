import React, { useRef, useState, useEffect } from 'react';
import { Tooltip, TooltipProps } from '@mui/material';

interface OverflowTooltipProps extends Omit<TooltipProps, 'children'> {
  children: React.ReactElement;
}

/**
 * A wrapper around MUI Tooltip that only displays the tooltip if the
 * child element's content is actually overflowing (e.g. truncated with text-overflow: ellipsis).
 */
const OverflowTooltip: React.FC<OverflowTooltipProps> = ({
  title,
  children,
  ...props
}) => {
  const textElementRef = useRef<HTMLElement>(null);
  const [isOverflowed, setIsOverflowed] = useState(false);

  useEffect(() => {
    const checkOverflow = () => {
      const element = textElementRef.current;
      if (element) {
        setIsOverflowed(
          element.scrollWidth > element.clientWidth ||
            element.scrollHeight > element.clientHeight
        );
      }
    };

    // Check immediately and on window resize
    checkOverflow();
    window.addEventListener('resize', checkOverflow);
    return () => window.removeEventListener('resize', checkOverflow);
  }, [children, title]);

  return (
    <Tooltip
      title={title}
      disableHoverListener={!isOverflowed}
      disableFocusListener={!isOverflowed}
      disableTouchListener={!isOverflowed}
      {...props}
    >
      {React.cloneElement(children as React.ReactElement<any>, {
        ref: textElementRef,
      })}
    </Tooltip>
  );
};

export default OverflowTooltip;
