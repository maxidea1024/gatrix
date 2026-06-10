import { ArgusLogEntry } from '@/services/argusService';

export interface LogSidePanelProps {
  log: ArgusLogEntry | null;
  loading?: boolean;
  open: boolean;
  onClose: () => void;
  onPrev?: () => void;
  onNext?: () => void;
  onFilter: (key: string, value: string, exclude: boolean) => void;
  hasPrev: boolean;
  hasNext: boolean;
  width?: number;
}

export interface AttrTreeNode {
  key: string;
  fullKey: string;
  value?: string;
  children: AttrTreeNode[];
}
