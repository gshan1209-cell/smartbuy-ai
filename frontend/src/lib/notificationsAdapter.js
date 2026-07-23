import { fetchNotifications, fetchUnreadCount, markAllNotificationsRead, markNotificationRead } from './notificationsApi';

export function loadNotificationPage(options) { return fetchNotifications(options); }
export { fetchUnreadCount, markAllNotificationsRead, markNotificationRead };

export function normalizeNotification(item) {
  return { ...item, category: '互助網', isRead: Boolean(item.isRead), target: item.postId ? `/mutual-aid?post=${item.postId}` : '/mutual-aid' };
}
