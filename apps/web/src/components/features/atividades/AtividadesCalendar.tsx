"use client"

import { useEffect, useMemo, useState } from "react"
import { motion } from "framer-motion"
import { Card, CardBody, CardHeader, Button, Spinner } from "@/heroui"
import { ChevronLeft, ChevronRight, Calendar } from "lucide-react"
import { fadeIn, staggerItem } from "@/lib/animations"
import { ActivityPriority, type Activity } from "@/types/activity"

type AtividadesCalendarProps = {
  activities: Activity[]
  isLoading?: boolean
  onSelectActivity?: (activity: Activity) => void
}

export function AtividadesCalendar({
  activities,
  isLoading = false,
  onSelectActivity,
}: AtividadesCalendarProps) {
  const [currentDate, setCurrentDate] = useState<Date | null>(null)
  const [today, setToday] = useState<Date | null>(null)
  const [view, setView] = useState<"month" | "week" | "day">("month")

  useEffect(() => {
    const now = new Date()
    setCurrentDate(now)
    setToday(now)
  }, [])

  const activitiesByDate = useMemo(() => {
    const map: Record<string, Activity[]> = {}
    activities.forEach((activity) => {
      if (!activity.due_date) return
      map[activity.due_date] = [...(map[activity.due_date] ?? []), activity]
    })
    return map
  }, [activities])

  const monthNames = [
    "Janeiro",
    "Fevereiro",
    "Março",
    "Abril",
    "Maio",
    "Junho",
    "Julho",
    "Agosto",
    "Setembro",
    "Outubro",
    "Novembro",
    "Dezembro",
  ]
  const dayNames = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"]

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear()
    const month = date.getMonth()
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const daysInMonth = lastDay.getDate()
    const startingDayOfWeek = firstDay.getDay()

    const days = []
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null)
    }
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(new Date(year, month, i))
    }
    return days
  }

  const getActivitiesForDate = (date: Date | null) => {
    if (!date) return []
    const dateStr = date.toISOString().split("T")[0]
    if (!dateStr) return []
    return activitiesByDate[dateStr] ?? []
  }

  const getDaysInWeek = (date: Date) => {
    const start = new Date(date)
    start.setDate(date.getDate() - date.getDay())
    return Array.from({ length: 7 }, (_, index) => {
      const day = new Date(start)
      day.setDate(start.getDate() + index)
      return day
    })
  }

  const getDaysForView = () => {
    if (!currentDate) return []
    if (view === "month") return getDaysInMonth(currentDate)
    if (view === "week") return getDaysInWeek(currentDate)
    return [currentDate]
  }

  const navigateDate = (direction: number) => {
    if (!currentDate) return
    if (view === "month") {
      setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + direction, 1))
      return
    }
    const next = new Date(currentDate)
    next.setDate(currentDate.getDate() + (view === "week" ? 7 * direction : direction))
    setCurrentDate(next)
  }

  const days = getDaysForView()
  const dayHeaders = view === "day" && currentDate ? [dayNames[currentDate.getDay()]] : dayNames
  const gridColsClass = view === "day" ? "grid-cols-1" : "grid-cols-7"

  const headerLabel = useMemo(() => {
    if (!currentDate) return ""
    if (view === "day") {
      return currentDate.toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      })
    }
    if (view === "week") {
      const weekDays = getDaysInWeek(currentDate)
      const firstDay = weekDays[0]
      const lastDay = weekDays[6]
      if (!firstDay || !lastDay) return ""
      return `${firstDay.toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "short",
      })} - ${lastDay.toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })}`
    }
    return `${monthNames[currentDate.getMonth()]} ${currentDate.getFullYear()}`
  }, [currentDate, view])

  return (
    <motion.div initial="hidden" animate="visible" variants={fadeIn}>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              <h3 className="text-lg font-semibold">{headerLabel}</h3>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex gap-1">
                <Button
                  size="sm"
                  variant={view === "month" ? "solid" : "bordered"}
                  color={view === "month" ? "primary" : "default"}
                  onPress={() => setView("month")}
                >
                  Mês
                </Button>
                <Button
                  size="sm"
                  variant={view === "week" ? "solid" : "bordered"}
                  color={view === "week" ? "primary" : "default"}
                  onPress={() => setView("week")}
                >
                  Semana
                </Button>
                <Button
                  size="sm"
                  variant={view === "day" ? "solid" : "bordered"}
                  color={view === "day" ? "primary" : "default"}
                  onPress={() => setView("day")}
                >
                  Dia
                </Button>
              </div>
              <div className="flex gap-1">
                <Button
                  isIconOnly
                  size="sm"
                  variant="bordered"
                  onPress={() => navigateDate(-1)}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  isIconOnly
                  size="sm"
                  variant="bordered"
                  onPress={() => navigateDate(1)}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardBody>
          {isLoading && (
            <div className="flex justify-center py-4">
              <Spinner size="sm" color="primary" />
            </div>
          )}
          <div className={`grid ${gridColsClass} gap-2`}>
            {dayHeaders.map((day) => (
              <div
                key={day}
                className="text-center font-semibold text-sm text-default-500 py-2"
              >
                {day}
              </div>
            ))}
            {days.map((day, index) => {
              const activities = getActivitiesForDate(day)
              const isToday = day && today && day.toDateString() === today.toDateString()
              return (
                <motion.div
                  key={index}
                  variants={staggerItem}
                  className={`min-h-[100px] p-2 border border-default-200 rounded-lg ${
                    day ? "bg-background" : "bg-default-50 dark:bg-default-100/10"
                  } ${isToday ? "ring-2 ring-primary" : ""}`}
                >
                  {day && (
                    <>
                      <div
                        className={`text-sm font-medium mb-2 ${
                          isToday ? "text-primary" : "text-foreground"
                        }`}
                      >
                        {day.getDate()}
                      </div>
                      <div className="space-y-1">
                        {activities.slice(0, 2).map((activity) => (
                          <button
                            type="button"
                            key={activity.id}
                            className={`text-xs p-1 rounded truncate ${
                              activity.priority === ActivityPriority.HIGH
                                ? "bg-danger-100 text-danger-700 dark:bg-danger-900/30 dark:text-danger-400"
                                : activity.priority === ActivityPriority.MEDIUM
                                  ? "bg-warning-100 text-warning-700 dark:bg-warning-900/30 dark:text-warning-400"
                                  : "bg-success-100 text-success-700 dark:bg-success-900/30 dark:text-success-400"
                            }`}
                            onClick={() => onSelectActivity?.(activity)}
                          >
                            {activity.title}
                          </button>
                        ))}
                        {activities.length > 2 && (
                          <div className="text-xs text-default-500">
                            +{activities.length - 2} mais
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </motion.div>
              )
            })}
          </div>
        </CardBody>
      </Card>
    </motion.div>
  )
}
