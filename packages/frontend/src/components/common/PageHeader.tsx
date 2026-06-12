/**
 * PageHeader Component
 *
 * Portal pattern: injects header props into PageHeaderContext.
 * The actual rendering happens in MainLayout's AppBar.
 *
 * Props signature is unchanged so existing page code needs no modification.
 * The MoreVert refresh menu is also rendered by the AppBar via context.
 */

import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { usePageHeaderContext } from '@/contexts/PageHeaderContext';
import type { PageHeaderProps } from '@/contexts/PageHeaderContext';

const PageHeader: React.FC<PageHeaderProps> = (props) => {
  const { setHeaderProps } = usePageHeaderContext();
  const location = useLocation();

  // Use ref to avoid infinite re-render loops when props contain
  // inline objects/callbacks that change identity every render.
  // We serialize the "stable" scalar props to detect real changes,
  // but always push the latest props object so rendered nodes stay fresh.
  const propsRef = useRef(props);
  propsRef.current = props;

  // Push props into context on mount and when key scalar values change
  useEffect(() => {
    setHeaderProps(propsRef.current);
  }, [
    // Trigger on meaningful prop changes (scalars & presence of optional slots)
    props.subtitle,
    props.enableAutoBack,
    // title can be string or ReactNode — for string titles, track the value
    typeof props.title === 'string' ? props.title : undefined,
    // Track presence of slots (not identity) to avoid churn
    !!props.icon,
    !!props.tabs,
    !!props.actions,
    !!props.headerActions,
    !!props.menuItems,
    !!props.onRefresh,
    !!props.onBack,
    // Re-push on route change so the header updates for navigation
    location.pathname,
    setHeaderProps,
  ]);

  // Clear header on unmount
  useEffect(() => {
    return () => {
      setHeaderProps(null);
    };
  }, [setHeaderProps]);

  // No DOM rendering — the AppBar handles it
  return null;
};

export type { PageHeaderProps };
export default PageHeader;
