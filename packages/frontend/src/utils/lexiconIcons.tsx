import React from 'react';
import {
  Cursor,
  CursorClick,
  MouseSimple,
  UserCircle,
  Users,
  UserPlus,
  SignIn,
  SignOut,
  ShoppingCart,
  ShoppingBag,
  CreditCard,
  Money,
  Wallet,
  Receipt,
  MagnifyingGlass,
  Eye,
  FileText,
  Files,
  Download,
  Upload,
  Share,
  Link,
  EnvelopeSimple,
  ChatCircle,
  Bell,
  BellSlash,
  Gear,
  Wrench,
  Sliders,
  Play,
  Pause,
  Stop,
  SkipForward,
  Heart,
  Star,
  ThumbsUp,
  ThumbsDown,
  Flag,
  Bookmark,
  Tag,
  MapPin,
  Globe,
  House,
  Buildings,
  DeviceMobile,
  Desktop,
  Bug,
  Warning,
  CheckCircle,
  XCircle,
  Lightning,
  Rocket,
  Target,
  CalendarBlank,
  Clock,
  Timer,
  ArrowRight,
  ArrowsClockwise,
  Funnel,
  ChartLine,
  ChartBar,
  Trophy,
  Key,
  Lock,
  LockOpen,
  Shield,
  Trash,
  PencilSimple,
  Plus,
  Minus,
  Power,
  Heartbeat,
  Pulse,
  Vibrate,
  Fingerprint,
  type IconProps,
} from '@phosphor-icons/react';

// ── Curated Phosphor icon catalog for analytics events ──
export const ICON_CATALOG: {
  name: string;
  component: React.FC<IconProps>;
  label: string;
}[] = [
  // Interaction
  { name: 'CursorClick', component: CursorClick, label: 'Click' },
  { name: 'Cursor', component: Cursor, label: 'Cursor' },
  { name: 'MouseSimple', component: MouseSimple, label: 'Mouse' },
  // Users
  { name: 'UserCircle', component: UserCircle, label: 'User' },
  { name: 'Users', component: Users, label: 'Users' },
  { name: 'UserPlus', component: UserPlus, label: 'Sign Up' },
  { name: 'SignIn', component: SignIn, label: 'Sign In' },
  { name: 'SignOut', component: SignOut, label: 'Sign Out' },
  // Commerce
  { name: 'ShoppingCart', component: ShoppingCart, label: 'Cart' },
  { name: 'ShoppingBag', component: ShoppingBag, label: 'Purchase' },
  { name: 'CreditCard', component: CreditCard, label: 'Payment' },
  { name: 'Money', component: Money, label: 'Money' },
  { name: 'Wallet', component: Wallet, label: 'Wallet' },
  { name: 'Receipt', component: Receipt, label: 'Receipt' },
  // Navigation
  { name: 'MagnifyingGlass', component: MagnifyingGlass, label: 'Search' },
  { name: 'Eye', component: Eye, label: 'View' },
  { name: 'FileText', component: FileText, label: 'Page' },
  { name: 'Files', component: Files, label: 'Files' },
  { name: 'Download', component: Download, label: 'Download' },
  { name: 'Upload', component: Upload, label: 'Upload' },
  { name: 'Share', component: Share, label: 'Share' },
  { name: 'Link', component: Link, label: 'Link' },
  // Communication
  { name: 'EnvelopeSimple', component: EnvelopeSimple, label: 'Email' },
  { name: 'ChatCircle', component: ChatCircle, label: 'Chat' },
  { name: 'Bell', component: Bell, label: 'Notification' },
  { name: 'BellSlash', component: BellSlash, label: 'Mute' },
  // Settings
  { name: 'Gear', component: Gear, label: 'Settings' },
  { name: 'Wrench', component: Wrench, label: 'Tool' },
  { name: 'Sliders', component: Sliders, label: 'Config' },
  // Media
  { name: 'Play', component: Play, label: 'Play' },
  { name: 'Pause', component: Pause, label: 'Pause' },
  { name: 'Stop', component: Stop, label: 'Stop' },
  { name: 'SkipForward', component: SkipForward, label: 'Skip' },
  // Feedback
  { name: 'Heart', component: Heart, label: 'Like' },
  { name: 'Star', component: Star, label: 'Favorite' },
  { name: 'ThumbsUp', component: ThumbsUp, label: 'Thumbs Up' },
  { name: 'ThumbsDown', component: ThumbsDown, label: 'Thumbs Down' },
  { name: 'Flag', component: Flag, label: 'Flag' },
  { name: 'Bookmark', component: Bookmark, label: 'Bookmark' },
  { name: 'Tag', component: Tag, label: 'Tag' },
  // Location
  { name: 'MapPin', component: MapPin, label: 'Location' },
  { name: 'Globe', component: Globe, label: 'Global' },
  { name: 'House', component: House, label: 'Home' },
  { name: 'Buildings', component: Buildings, label: 'Business' },
  // Device
  { name: 'DeviceMobile', component: DeviceMobile, label: 'Mobile' },
  { name: 'Desktop', component: Desktop, label: 'Desktop' },
  // Status
  { name: 'Bug', component: Bug, label: 'Bug' },
  { name: 'Warning', component: Warning, label: 'Warning' },
  { name: 'CheckCircle', component: CheckCircle, label: 'Success' },
  { name: 'XCircle', component: XCircle, label: 'Error' },
  // Action
  { name: 'Lightning', component: Lightning, label: 'Fast' },
  { name: 'Rocket', component: Rocket, label: 'Launch' },
  { name: 'Target', component: Target, label: 'Target' },
  // Time
  { name: 'CalendarBlank', component: CalendarBlank, label: 'Calendar' },
  { name: 'Clock', component: Clock, label: 'Clock' },
  { name: 'Timer', component: Timer, label: 'Timer' },
  // Flow
  { name: 'ArrowRight', component: ArrowRight, label: 'Next' },
  { name: 'ArrowsClockwise', component: ArrowsClockwise, label: 'Refresh' },
  { name: 'Funnel', component: Funnel, label: 'Funnel' },
  // Analytics
  { name: 'ChartLine', component: ChartLine, label: 'Trend' },
  { name: 'ChartBar', component: ChartBar, label: 'Chart' },
  { name: 'Trophy', component: Trophy, label: 'Achievement' },
  // Security
  { name: 'Key', component: Key, label: 'Key' },
  { name: 'Lock', component: Lock, label: 'Lock' },
  { name: 'LockOpen', component: LockOpen, label: 'Unlock' },
  { name: 'Shield', component: Shield, label: 'Shield' },
  { name: 'Fingerprint', component: Fingerprint, label: 'Biometric' },
  // Misc
  { name: 'Trash', component: Trash, label: 'Delete' },
  { name: 'PencilSimple', component: PencilSimple, label: 'Edit' },
  { name: 'Plus', component: Plus, label: 'Add' },
  { name: 'Minus', component: Minus, label: 'Remove' },
  { name: 'Power', component: Power, label: 'Power' },
  { name: 'Heartbeat', component: Heartbeat, label: 'Activity' },
  { name: 'Pulse', component: Pulse, label: 'Health' },
  { name: 'Vibrate', component: Vibrate, label: 'Alert' },
];

// Build name → component lookup for rendering
const ICON_MAP = new Map(ICON_CATALOG.map((i) => [i.name, i.component]));

/** Render a lexicon icon by its stored name string. Shows a default icon when iconName is null. */
export function renderLexiconIcon(
  iconName: string | null | undefined,
  size = 20,
  color?: string
) {
  if (!iconName) {
    // Default icon for layout consistency
    return (
      <Heartbeat
        size={size}
        weight="regular"
        color={color}
        style={{ opacity: 0.35 }}
      />
    );
  }
  const IconComp = ICON_MAP.get(iconName);
  if (!IconComp)
    return (
      <Heartbeat
        size={size}
        weight="regular"
        color={color}
        style={{ opacity: 0.35 }}
      />
    );
  return <IconComp size={size} weight="regular" color={color} />;
}

/** Preset color palette for icon backgrounds */
export const COLOR_PRESETS = [
  '#6366f1',
  '#8b5cf6',
  '#a855f7',
  '#d946ef',
  '#ec4899',
  '#f43f5e',
  '#ef4444',
  '#f97316',
  '#f59e0b',
  '#eab308',
  '#84cc16',
  '#22c55e',
  '#10b981',
  '#14b8a6',
  '#06b6d4',
  '#0ea5e9',
  '#3b82f6',
  '#2563eb',
  '#6b7280',
  '#374151',
];
