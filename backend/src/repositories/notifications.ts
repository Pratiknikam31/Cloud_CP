import { notificationRepo } from './index';
import type { INotification, NotificationType } from '../types/entities';

// Replacement for Notification.create({...}) used as a side effect in several modules.
export const createNotification = (data: {
  recipient: string;
  title: string;
  message: string;
  type?: NotificationType;
  link?: string;
}): Promise<INotification> =>
  notificationRepo.create({
    recipient: data.recipient,
    title: data.title,
    message: data.message,
    type: data.type ?? 'system',
    read: false,
    link: data.link ?? '',
  });
