import React from 'react';
import {
  AlertTriangle,
  BadgeCheck,
  Ban,
  Banknote,
  BookOpen,
  Calendar,
  Camera,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleCheck,
  Clock,
  Crosshair,
  Flag,
  Heart,
  Home,
  Image as ImageIcon,
  ImagePlus,
  Info,
  Link,
  List,
  Lock,
  Map,
  MapPin,
  MessageCircle,
  Pencil,
  Percent,
  Plus,
  Search,
  Send,
  Settings,
  ShieldCheck,
  Sparkles,
  User,
  Users,
  X,
  XCircle,
  Zap,
  Dumbbell,
  Utensils,
  Trees,
  Palette,
  Bell,
  LogOut,
  UserPlus,
  UserCheck,
  CalendarPlus,
  SlidersHorizontal,
  Share2,
  MoreHorizontal,
  Clapperboard,
  Trash2,
} from 'lucide-react-native';

export type IconName =
  | 'alert-triangle'
  | 'badge-check'
  | 'ban'
  | 'banknote'
  | 'book-open'
  | 'calendar'
  | 'camera'
  | 'check'
  | 'chevron-left'
  | 'chevron-right'
  | 'circle-check'
  | 'clock'
  | 'crosshair'
  | 'flag'
  | 'heart'
  | 'home'
  | 'image'
  | 'image-plus'
  | 'info'
  | 'link'
  | 'list'
  | 'lock'
  | 'map'
  | 'map-pin'
  | 'message-circle'
  | 'pencil'
  | 'percent'
  | 'plus'
  | 'search'
  | 'send'
  | 'settings'
  | 'shield-check'
  | 'sparkles'
  | 'user'
  | 'users'
  | 'x'
  | 'x-circle'
  | 'zap'
  | 'dumbbell'
  | 'utensils'
  | 'trees'
  | 'palette'
  | 'bell'
  | 'log-out'
  | 'user-plus'
  | 'user-check'
  | 'calendar-plus'
  | 'sliders-horizontal'
  | 'share-2'
  | 'more-horizontal'
  | 'clapperboard'
  | 'trash-2';

const ICON_MAP: Record<IconName, React.ComponentType<any>> = {
  'alert-triangle': AlertTriangle,
  'badge-check': BadgeCheck,
  ban: Ban,
  banknote: Banknote,
  'book-open': BookOpen,
  calendar: Calendar,
  camera: Camera,
  check: Check,
  'chevron-left': ChevronLeft,
  'chevron-right': ChevronRight,
  'circle-check': CircleCheck,
  clock: Clock,
  crosshair: Crosshair,
  flag: Flag,
  heart: Heart,
  home: Home,
  image: ImageIcon,
  'image-plus': ImagePlus,
  info: Info,
  link: Link,
  list: List,
  lock: Lock,
  map: Map,
  'map-pin': MapPin,
  'message-circle': MessageCircle,
  pencil: Pencil,
  percent: Percent,
  plus: Plus,
  search: Search,
  send: Send,
  settings: Settings,
  'shield-check': ShieldCheck,
  sparkles: Sparkles,
  user: User,
  users: Users,
  x: X,
  'x-circle': XCircle,
  zap: Zap,
  dumbbell: Dumbbell,
  utensils: Utensils,
  trees: Trees,
  palette: Palette,
  bell: Bell,
  'log-out': LogOut,
  'user-plus': UserPlus,
  'user-check': UserCheck,
  'calendar-plus': CalendarPlus,
  'sliders-horizontal': SlidersHorizontal,
  'share-2': Share2,
  'more-horizontal': MoreHorizontal,
  clapperboard: Clapperboard,
  'trash-2': Trash2,
};

interface IconProps {
  name: IconName;
  size?: number;
  color?: string;
  strokeWidth?: number;
}

export function Icon({ name, size = 20, color = '#0A0A0A', strokeWidth = 1.75 }: IconProps) {
  const Component = ICON_MAP[name];
  if (!Component) return null;
  return <Component size={size} color={color} strokeWidth={strokeWidth} />;
}
