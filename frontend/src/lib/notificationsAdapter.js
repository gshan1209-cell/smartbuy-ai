import {
  fetchNotifications,
  fetchUnreadCount,
  markAllNotificationsRead,
  markNotificationRead,
} from './notificationsApi';

export function normalizeNotification(item) {
  const actorName = item.actorName || '有人';
  const isReply = item.type === 'mutual_aid_reply';

  return {
    ...item,
    actorName,
    category: '互助網',
    isRead: Boolean(item.isRead),
    target: item.postId ? `/mutual-aid?post=${item.postId}` : '/mutual-aid',
    title: isReply
      ? `${actorName} 回覆了你的貼文`
      : `${actorName} 按讚了你的貼文`,
  };
}

export async function loadNotificationPage(options) {
  const data = await fetchNotifications(options);
  return {
    ...data,
    items: (data.items || []).map(normalizeNotification),
  };
}

export {
  fetchUnreadCount,
  markAllNotificationsRead,
  markNotificationRead,
};
