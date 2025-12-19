"use client"

import { useMemo, useState } from "react"
import { motion } from "framer-motion"
import { Card, CardBody, CardHeader, Button, Spinner } from "@/heroui"
import { ChevronLeft, ChevronRight, Calendar } from "lucide-react"
import { fadeIn, staggerItem } from "@/lib/animations"
import { ActivityPriority, type Activity } from "@/types/activity"

type AtividadesCalendarProps = {
  activities: Activity[]
  isLoading?: boolean
}

export function AtividadesCalendar({ activities, isLoading = false }: AtividadesCalendarProps) {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [view, setView] = useState<"month" | "week" | "day">("month")
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
    return activitiesByDate[dateStr] ?? []
  }

  const navigateMonth = (direction: number) => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + direction, 1))
  }

  const days = getDaysInMonth(currentDate)

  return (
    <motion.div initial="hidden" animate="visible" variants={fadeIn}>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              <h3 className="text-lg font-semibold">
                {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
              </h3>
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
                  onPress={() => navigateMonth(-1)}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  isIconOnly
                  size="sm"
                  variant="bordered"
                  onPress={() => navigateMonth(1)}
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
          <div className="grid grid-cols-7 gap-2">
            {dayNames.map((day) => (
              <div
                key={day}
                className="text-center font-semibold text-sm text-default-500 py-2"
              >
                {day}
              </div>
            ))}
            {days.map((day, index) => {
              const activities = getActivitiesForDate(day)
              const isToday = day && day.toDateString() === new Date().toDateString()
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
                          <div
                            key={activity.id}
                            className={`text-xs p-1 rounded truncate ${
                              activity.priority === ActivityPriority.HIGH
                                ? "bg-danger-100 text-danger-700 dark:bg-danger-900/30 dark:text-danger-400"
                                : activity.priority === ActivityPriority.MEDIUM
                                  ? "bg-warning-100 text-warning-700 dark:bg-warning-900/30 dark:text-warning-400"
                                  : "bg-success-100 text-success-700 dark:bg-success-900/30 dark:text-success-400"
                            }`}
                          >
                            {activity.title}
                          </div>
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
