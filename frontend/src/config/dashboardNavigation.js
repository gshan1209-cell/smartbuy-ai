import {
  BarChart3,
  Bell,
  Bot,
  Boxes,
  CalendarDays,
  CloudSun,
  Database,
  LayoutDashboard,
  MessageSquareMore,
  Settings,
  Users,
} from 'lucide-react';

import { PERMISSIONS } from './permissions';

export const dashboardNavigation = [
  {
    to: '/dashboard/overview',
    label: '總覽',
    permission: PERMISSIONS.DASHBOARD_VIEW,
    icon: LayoutDashboard,
  },
  {
    to: '/dashboard/prices',
    label: '行情管理',
    permission: PERMISSIONS.PRICES_VIEW,
    icon: BarChart3,
  },
  {
    to: '/dashboard/products',
    label: '商品管理',
    permission: PERMISSIONS.PRODUCTS_VIEW,
    icon: Boxes,
  },
  {
    to: '/dashboard/predictions',
    label: 'AI 預測',
    permission: PERMISSIONS.PREDICTIONS_VIEW,
    icon: Bot,
  },
  {
    to: '/dashboard/weather',
    label: '天氣風險',
    permission: PERMISSIONS.WEATHER_VIEW,
    icon: CloudSun,
  },
  {
    to: '/dashboard/seasonal',
    label: '節氣推薦',
    permission: PERMISSIONS.SEASONAL_VIEW,
    icon: CalendarDays,
  },
  {
    to: '/dashboard/content',
    label: '內容管理',
    permission: PERMISSIONS.CONTENT_MANAGE,
    icon: Database,
  },
  {
    to: '/dashboard/mutual-aid',
    label: '互助網管理',
    permission: PERMISSIONS.MUTUAL_AID_MANAGE,
    icon: MessageSquareMore,
  },
  {
    to: '/dashboard/members',
    label: '會員管理',
    permission: PERMISSIONS.MEMBERS_MANAGE,
    icon: Users,
  },
  {
    to: '/dashboard/notifications',
    label: '通知管理',
    permission: PERMISSIONS.NOTIFICATIONS_MANAGE,
    icon: Bell,
  },
  {
    to: '/dashboard/data-jobs',
    label: '資料任務',
    permission: PERMISSIONS.DATA_JOBS_VIEW,
    icon: Database,
  },
  {
    to: '/dashboard/settings',
    label: '系統設定',
    permission: PERMISSIONS.SYSTEM_MANAGE,
    icon: Settings,
  },
];
