"use client";

import {
  Badge,
  Button,
  Popover,
  PopoverTrigger,
  PopoverContent,
  ScrollShadow,
} from "@/heroui";
import { useNotifications, Notification } from "@/hooks/websocket/useNotifications";
import { BellIcon } from "@/lib/icons";
import { useMemo, useState } from "react";

type NotificationVisual = {
  border: string;
  badge: string;
  dot: string;
  text: string;
};

const notificationVisuals: Record<string, NotificationVisual> = {
  warning: {
    border: "border-amber-200 bg-amber-50",
    badge: "bg-amber-100 text-amber-700",
    dot: "bg-amber-500",
    text: "text-amber-700",
  },
  success: {
    border: "border-emerald-200 bg-emerald-50",
    badge: "bg-emerald-100 text-emerald-700",
    dot: "bg-emerald-500",
    text: "text-emerald-700",
  },
  info: {
    border: "border-sky-200 bg-sky-50",
    badge: "bg-sky-100 text-sky-700",
    dot: "bg-sky-500",
    text: "text-sky-700",
  },
  danger: {
    border: "border-rose-200 bg-rose-50",
    badge: "bg-rose-100 text-rose-700",
    dot: "bg-rose-500",
    text: "text-rose-700",
  },
  default: {
    border: "border-default-200 bg-default-50",
    badge: "bg-default-200 text-default-600",
    dot: "bg-default-400",
    text: "text-default-700",
  },
};

const formatRelativeTime = (dateString: string) => {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (diffMs < minute) return "há instantes";
  if (diffMs < hour) {
    const minutes = Math.floor(diffMs / minute);
    return minutes === 1 ? "há 1 minuto" : `há cerca de ${minutes} minutos`;
  }
  if (diffMs < day) {
    const hours = Math.floor(diffMs / hour);
    return hours === 1 ? "há 1 hora" : `há cerca de ${hours} horas`;
  }
  const days = Math.floor(diffMs / day);
  if (days === 1) return "há 1 dia";
  if (days <= 7) return `há cerca de ${days} dias`;

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "long",
  }).format(date);
};

export function NotificationCenter() {
  const {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    clearNotification,
    clearAll,
  } = useNotifications();
  const [isOpen, setIsOpen] = useState(false);

  const visualByType = (type: string): NotificationVisual => {
    return notificationVisuals[type] || notificationVisuals.default;
  };

  const sortedNotifications = useMemo(
    () =>
      [...notifications].sort((a, b) => {
        if (a.read === b.read) {
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        }
        return a.read ? 1 : -1;
      }),
    [notifications],
  );

  const handleNotificationClick = (notification: Notification) => {
    if (!notification.read) {
      markAsRead(notification.id);
    }
    setIsOpen(false);

    if (notification.data?.obligation_id) {
      window.location.href = `/obrigacoes?id=${notification.data.obligation_id}`;
    }
  };

  return (
    <Popover
      isOpen={isOpen}
      onOpenChange={setIsOpen}
      placement="bottom-end"
      offset={12}
      backdrop="blur"
    >
      <PopoverTrigger>
        <Button isIconOnly variant="light" className="relative" aria-label="Notificações">
          {unreadCount > 0 ? (
            <Badge content={unreadCount} color="danger" size="sm">
              <BellIcon className="h-5 w-5" />
            </Badge>
          ) : (
            <BellIcon className="h-5 w-5" />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-0 w-[22rem]">
        <div className="p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-foreground">Notificações</h3>
              <p className="text-xs text-default-500">Acompanhe eventos importantes em tempo real</p>
            </div>
            {notifications.length > 0 && (
              <div className="flex flex-col items-end gap-1">
                {unreadCount > 0 && (
                  <button
                    type="button"
                    onClick={markAllAsRead}
                    className="text-xs font-medium text-primary hover:underline"
                  >
                    Marcar todas como lidas
                  </button>
                )}
                <button
                  type="button"
                  onClick={clearAll}
                  className="text-xs text-default-400 hover:text-danger font-medium"
                >
                  Limpar
                </button>
              </div>
            )}
          </div>

          {notifications.length === 0 ? (
            <div className="py-12 text-center text-default-400 text-sm">
              Nenhuma notificação no momento.
            </div>
          ) : (
            <ScrollShadow className="max-h-[22rem] pr-1 space-y-3">
              {sortedNotifications.map((notification) => {
                const visual = visualByType(notification.type);
                return (
                  <div
                    key={notification.id}
                    className={`rounded-xl border px-4 py-3 transition-colors ${visual.border} ${
                      !notification.read ? "shadow-sm" : ""
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => handleNotificationClick(notification)}
                      className="w-full text-left"
                    >
                      <div className="flex items-start gap-3">
                        <span
                          aria-hidden
                          className={`mt-1 h-2.5 w-2.5 rounded-full ${visual.dot}`}
                        />
                        <div className="flex-1">
                          <div className="flex items-center justify-between gap-3">
                            <p className="text-sm font-semibold text-foreground">
                              {notification.title}
                            </p>
                            <span
                              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${visual.badge}`}
                            >
                              {notification.type}
                            </span>
                          </div>
                          <p className="mt-1 text-xs text-default-600">
                            {notification.message}
                          </p>
                          <p className="mt-2 text-[11px] text-default-400">
                            {formatRelativeTime(notification.created_at)}
                          </p>
                        </div>
                      </div>
                    </button>
                    <div className="mt-3 flex items-center justify-end">
                      <button
                        type="button"
                        onClick={() => clearNotification(notification.id)}
                        className="text-xs font-medium text-default-400 hover:text-danger transition-colors"
                      >
                        Remover
                      </button>
                    </div>
                  </div>
                );
              })}
            </ScrollShadow>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
