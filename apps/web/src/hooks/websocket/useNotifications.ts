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

// Mock notifications for development
const MOCK_NOTIFICATIONS: Notification[] = [
  {
    id: "mock-1",
    type: "warning",
    title: "Obrigação vencendo",
    message: "DCTFWeb da Tech Solutions vence em 2 dias",
    read: false,
    created_at: new Date(Date.now() - 60 * 60 * 1000).toISOString(), // 1 hora atrás
    data: {
      obligation_id: "1",
      client_name: "Tech Solutions Ltda",
    },
  },
  {
    id: "mock-2",
    type: "success",
    title: "Pagamento recebido",
    message: "Honorários de R$ 2.500,00 recebidos de Tech Solutions",
    read: false,
    created_at: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(), // 3 horas atrás
    data: {
      amount: 2500.0,
      client_name: "Tech Solutions Ltda",
    },
  },
  {
    id: "mock-3",
    type: "info",
    title: "Novo cliente cadastrado",
    message: "Comércio ABC foi adicionado ao sistema",
    read: true,
    created_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // 1 dia atrás
    data: {
      client_name: "Comércio ABC Ltda",
    },
  },
  {
    id: "mock-4",
    type: "danger",
    title: "Licença expirada",
    message: "Auto de Vistoria do Corpo de Bombeiros de Comércio ABC expirou",
    read: false,
    created_at: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(), // 6 horas atrás
    data: {
      license_type: "AVCB",
      client_name: "Comércio ABC Ltda",
    },
  },
];

export function useNotifications(): UseNotificationsReturn {
  const [notifications, setNotifications] = useState<Notification[]>(MOCK_NOTIFICATIONS);

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
