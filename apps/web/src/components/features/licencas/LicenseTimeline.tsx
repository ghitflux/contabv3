"use client";

import { useEffect, useState } from "react";
import { Card, CardBody, Spinner } from "@/heroui";
import type { LicenseEvent } from "@/types/license";
import { licensesApi } from "@/lib/api/licenses";
import { LICENSE_EVENT_TYPE_LABELS, LicenseEventType } from "@/types/license";

interface LicenseTimelineProps {
  licenseId: string;
}

export function LicenseTimeline({ licenseId }: LicenseTimelineProps) {
  const [events, setEvents] = useState<LicenseEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        setLoading(true);
        const data = await licensesApi.getEvents(licenseId);
        setEvents(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erro ao carregar eventos");
      } finally {
        setLoading(false);
      }
    };

    if (licenseId) {
      fetchEvents();
    }
  }, [licenseId]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  };

  const getEventIcon = (eventType: LicenseEventType) => {
    switch (eventType) {
      case LicenseEventType.CREATED:
        return "📝";
      case LicenseEventType.RENEWED:
        return "🔄";
      case LicenseEventType.EXPIRED:
        return "⏰";
      case LicenseEventType.CANCELLED:
        return "❌";
      case LicenseEventType.UPDATED:
        return "✏️";
      case LicenseEventType.DOCUMENT_UPLOADED:
        return "📎";
      default:
        return "📌";
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center p-4">
        <Spinner size="sm" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center p-4 text-danger">
        <p>{error}</p>
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="text-center p-4 text-default-400">
        <p>Nenhum evento registrado</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {events.map((event, index) => (
        <div key={event.id} className="flex gap-3">
          <div className="flex flex-col items-center">
            <div className="w-8 h-8 rounded-full bg-default-200 flex items-center justify-center text-sm">
              {getEventIcon(event.event_type)}
            </div>
            {index < events.length - 1 && (
              <div className="w-0.5 h-full bg-default-200 mt-2" />
            )}
          </div>
          <div className="flex-1 pb-4">
            <Card>
              <CardBody className="p-3">
                <div className="flex justify-between items-start mb-1">
                  <p className="font-semibold text-sm">
                    {LICENSE_EVENT_TYPE_LABELS[event.event_type]}
                  </p>
                  <p className="text-xs text-default-400">
                    {formatDate(event.created_at)}
                  </p>
                </div>
                <p className="text-sm text-default-600">{event.description}</p>
                {event.user_name && (
                  <p className="text-xs text-default-400 mt-1">
                    Por: {event.user_name}
                  </p>
                )}
              </CardBody>
            </Card>
          </div>
        </div>
      ))}
    </div>
  );
}

