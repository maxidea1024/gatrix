/**
 * PageHeaderContext
 *
 * Portal pattern: pages set header props via context,
 * MainLayout's AppBar reads and renders them.
 */
import React, { createContext, useContext, useState, useCallback } from 'react';

export interface PageHeaderProps {
  icon?: React.ReactNode;
  title: React.ReactNode;
  subtitle?: string;
  tabs?: React.ReactNode;
  actions?: React.ReactNode;
  headerActions?: React.ReactNode;
  menuItems?: React.ReactNode;
  onRefresh?: () => void;
  enableAutoBack?: boolean;
  onBack?: () => void;
}

interface PageHeaderContextValue {
  headerProps: PageHeaderProps | null;
  setHeaderProps: (props: PageHeaderProps | null) => void;
}

const PageHeaderContext = createContext<PageHeaderContextValue>({
  headerProps: null,
  setHeaderProps: () => {},
});

export const usePageHeaderContext = () => useContext(PageHeaderContext);

export const PageHeaderProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [headerProps, setHeaderPropsRaw] = useState<PageHeaderProps | null>(
    null
  );

  const setHeaderProps = useCallback(
    (props: PageHeaderProps | null) => {
      setHeaderPropsRaw(props);
    },
    []
  );

  return (
    <PageHeaderContext.Provider value={{ headerProps, setHeaderProps }}>
      {children}
    </PageHeaderContext.Provider>
  );
};

export default PageHeaderContext;
