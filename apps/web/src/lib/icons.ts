/**
 * Centralized icon exports using lucide-react.
 *
 * IMPORTANT: Always import icons from this file, not directly from lucide-react.
 * This ensures consistency and makes it easy to swap icons if needed.
 *
 * Usage:
 * import { CheckIcon, CopyIcon } from '@/lib/icons';
 */

// Re-export commonly used icons
export {
  // Actions
  Check as CheckIcon,
  Copy as CopyIcon,
  Download as DownloadIcon,
  Upload as UploadIcon,
  Save as SaveIcon,
  Edit as EditIcon,
  Trash2 as TrashIcon,
  Plus as PlusIcon,
  Minus as MinusIcon,
  X as XIcon,
  MoreVertical as MoreVerticalIcon,
  MoreHorizontal as MoreHorizontalIcon,

  // Navigation
  ChevronLeft as ChevronLeftIcon,
  ChevronRight as ChevronRightIcon,
  ChevronDown as ChevronDownIcon,
  ChevronUp as ChevronUpIcon,
  ArrowLeft as ArrowLeftIcon,
  ArrowRight as ArrowRightIcon,
  Menu as MenuIcon,
  Home as HomeIcon,
  PanelRightClose as PanelRightCloseIcon,
  PanelRightOpen as PanelRightOpenIcon,

  // Status
  AlertCircle as AlertCircleIcon,
  AlertTriangle as AlertTriangleIcon,
  CheckCircle as CheckCircleIcon,
  XCircle as XCircleIcon,
  Info as InfoIcon,

  // Files & Documents
  File as FileIcon,
  FileText as FileTextIcon,
  FilePlus as FilePlusIcon,
  Folder as FolderIcon,
  FolderOpen as FolderOpenIcon,
  Paperclip as PaperclipIcon,

  // Business
  Users as UsersIcon,
  User as UserIcon,
  UserPlus as UserPlusIcon,
  Building as BuildingIcon,
  Building2 as Building2Icon,
  Briefcase as BriefcaseIcon,
  Calendar as CalendarIcon,
  Clock as ClockIcon,

  // Finance
  DollarSign as DollarSignIcon,
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  CreditCard as CreditCardIcon,
  Receipt as ReceiptIcon,
  Wallet as WalletIcon,

  // Communication
  Mail as MailIcon,
  Send as SendIcon,
  MessageSquare as MessageSquareIcon,
  Bell as BellIcon,
  BellRing as BellRingIcon,

  // Data & Reports
  BarChart as BarChartIcon,
  LineChart as LineChartIcon,
  PieChart as PieChartIcon,
  Table as TableIcon,
  FileSpreadsheet as FileSpreadsheetIcon,
  Filter as FilterIcon,
  Search as SearchIcon,

  // Settings
  Settings as SettingsIcon,
  Sliders as SlidersIcon,
  Eye as EyeIcon,
  EyeOff as EyeOffIcon,
  Lock as LockIcon,
  Unlock as UnlockIcon,

  // Theme
  Sun as SunIcon,
  Moon as MoonIcon,

  // Interface
  Loader2 as LoaderIcon,
  RefreshCw as RefreshIcon,
  ExternalLink as ExternalLinkIcon,
  Link as LinkIcon,
  Maximize2 as MaximizeIcon,
  Minimize2 as MinimizeIcon,

  // Specific to domain
  FileCheck as ObligationIcon,
  ShieldCheck as LicenseIcon,
  Receipt as TransactionIcon,
  FileBarChart as ReportIcon,
} from 'lucide-react';

/**
 * Common icon sizes (in pixels)
 */
export const IconSizes = {
  xs: 12,
  sm: 16,
  md: 20,
  lg: 24,
  xl: 32,
} as const;

/**
 * Default icon size
 */
export const DEFAULT_ICON_SIZE = IconSizes.md;

/**
 * Helper type for icon components
 */
export type { LucideIcon as IconType } from 'lucide-react';
