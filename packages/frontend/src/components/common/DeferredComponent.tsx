import React, { useState, useEffect } from 'react';

interface DeferredComponentProps {
  shouldRender: boolean;
  delay?: number;
  children: React.ReactNode;
}

/**
 * Renders children only if 'shouldRender' stays true for longer than 'delay'.
 * Useful for preventing loading skeletons from flickering during fast loads.
 */
export const DeferredComponent: React.FC<DeferredComponentProps> = ({
  shouldRender,
  delay = 200,
  children,
}) => {
  const [show, setShow] = useState(false);

  useEffect(() => {
    let timeout: NodeJS.Timeout;
    if (shouldRender) {
      timeout = setTimeout(() => {
        setShow(true);
      }, delay);
    } else {
      setShow(false);
    }
    return () => clearTimeout(timeout);
  }, [shouldRender, delay]);

  if (!shouldRender || !show) return null;

  return <>{children}</>;
};
