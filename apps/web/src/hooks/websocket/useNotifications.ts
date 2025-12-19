"use client";

import { useEffect, useState, useCallback } from "react";
import { useWebSocket, WebSocketMessage } from "./useWebSocket";

export interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  data?: any;
  read: boolean;
  created_at: string;
}

interface UseNotificationsReturn {
  notifications: Notification[];
  unreadCount: number;
  addNotification: (notification: Notification) => void;
  markAsRead: (notificationId: string) => void;
  markAllAsRead: () => void;
  clearNotification: (notificationId: string) => void;
  clearAll: () => void;
}

export function useNotifications(): UseNotificationsReturn {
  // Start with empty notifications - will be populated via WebSocket in real-time
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const handleWebSocketMessage = useCallback((message: WebSocketMessage) => {
    console.log("Received WebSocket message:", message.type);

    // Convert WebSocket messages to notifications
    let notification: Notification | null = null;

    switch (message.type) {
      case "obligation.completed":
        notification = {
          id: crypto.randomUUID(),
          type: "obligation",
          title: "Obrigação Concluída",
          message: `Uma obrigação foi concluída.`,
          data: message.data,
          read: false,
          created_at: new Date().toISOString(),
        };
        break;

      case "obligation.created":
        notification = {
          id: crypto.randomUUID(),
          type: "obligation",
          title: "Nova Obrigação",
          message: `Uma nova obrigação foi criada.`,
          data: message.data,
          read: false,
          created_at: new Date().toISOString(),
        };
        break;

      case "obligation.due_soon":
        notification = {
          id: crypto.randomUUID(),
          type: "warning",
          title: "Obrigação Vencendo",
          message: `Uma obrigação está próxima do vencimento.`,
          data: message.data,
          read: false,
          created_at: new Date().toISOString(),
        };
        break;

      case "obligation.overdue":
        notification = {
          id: crypto.randomUUID(),
          type: "danger",
          title: "Obrigação Vencida",
          message: `Uma obrigação está vencida.`,
          data: message.data,
          read: false,
          created_at: new Date().toISOString(),
        };
        break;

      case "notification":
        notification = {
          id: message.data.id || crypto.randomUUID(),
          type: message.data.type || "info",
          title: message.data.title || "Notificação",
          message: message.data.message || "",
          data: message.data,
          read: false,
          created_at: message.data.created_at || new Date().toISOString(),
        };
        break;

      default:
        console.log("Unhandled message type:", message.type);
        return;
    }

    if (notification) {
      setNotifications((prev) => [notification!, ...prev]);

      // Show browser notification if supported
      if ("Notification" in window && Notification.permission === "granted") {
        new Notification(notification.title, {
          body: notification.message,
          icon: "/icon-192.png",
        });
      }
    }
  }, []);

  useWebSocket({
    onMessage: handleWebSocketMessage,
    autoConnect: true,
  });

  // Request notification permission on mount
  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

  const addNotification = useCallback((notification: Notification) => {
    setNotifications((prev) => [notification, ...prev]);
  }, []);

  const markAsRead = useCallback((notificationId: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === notificationId ? { ...n, read: true } : n))
    );
  }, []);

  const markAllAsRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }, []);

  const clearNotification = useCallback((notificationId: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== notificationId));
  }, []);

  const clearAll = useCallback(() => {
    setNotifications([]);
  }, []);

  const unreadCount = notifications.filter((n) => !n.read).length;

  return {
    notifications,
    unreadCount,
    addNotification,
    markAsRead,
    markAllAsRead,
    clearNotification,
    clearAll,
  };
}
