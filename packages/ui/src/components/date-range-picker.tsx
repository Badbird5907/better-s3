"use client"

import * as React from "react"
import { format } from "date-fns"
import { CalendarIcon, Clock } from "lucide-react"
import type { DateRange } from "react-day-picker"

import { cn } from "@app/ui/lib/utils"
import { Button } from "@app/ui/components/button"
import { Calendar } from "@app/ui/components/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@app/ui/components/popover"
import { Input } from "@app/ui/components/input"

interface TimeState {
  hour: string
  minute: string
  period: "AM" | "PM"
}

interface DateRangePickerProps {
  value?: DateRange
  onChange?: (range: DateRange | undefined) => void
  defaultMonth?: Date
  timePicker?: boolean
  placeholder?: string
  disabled?: boolean
  className?: string
}

function TimeInput({
  label,
  time,
  onTimeChange,
}: {
  label: string
  time: TimeState
  onTimeChange: (time: TimeState) => void
}) {
  const [hour, setHour] = React.useState(time.hour)
  const [minute, setMinute] = React.useState(time.minute)

  const handleHourChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\D/g, "").slice(0, 2)
    setHour(val)
  }

  const handleHourBlur = () => {
    let num = parseInt(hour, 10)
    if (isNaN(num) || num < 1) {
      num = 12
    } else if (num > 12) {
      num = 12
    }
    const padded = String(num).padStart(2, "0")
    setHour(padded)
    onTimeChange({ ...time, hour: padded })
  }

  const handleMinuteChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\D/g, "").slice(0, 2)
    setMinute(val)
  }

  const handleMinuteBlur = () => {
    let num = parseInt(minute, 10)
    if (isNaN(num) || num < 0) {
      num = 0
    } else if (num > 59) {
      num = 59
    }
    const padded = String(num).padStart(2, "0")
    setMinute(padded)
    onTimeChange({ ...time, minute: padded })
  }

  const handlePeriodChange = () => {
    const newPeriod = time.period === "AM" ? "PM" : "AM"
    onTimeChange({ ...time, period: newPeriod })
  }

  React.useEffect(() => {
    setHour(time.hour)
    setMinute(time.minute)
  }, [time.hour, time.minute])

  return (
    <div className="space-y-2">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <div className="flex items-center gap-1.5">
        <Input
          type="text"
          inputMode="numeric"
          value={hour}
          onChange={handleHourChange}
          onBlur={handleHourBlur}
          onFocus={(e) => e.target.select()}
          placeholder="12"
          className="w-12 text-center text-sm"
        />
        <span className="text-muted-foreground">:</span>
        <Input
          type="text"
          inputMode="numeric"
          value={minute}
          onChange={handleMinuteChange}
          onBlur={handleMinuteBlur}
          onFocus={(e) => e.target.select()}
          placeholder="00"
          className="w-12 text-center text-sm"
        />
        <button
          type="button"
          onClick={handlePeriodChange}
          className="flex h-9 w-12 items-center justify-center rounded-md border border-input bg-background text-xs font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          {time.period}
        </button>
      </div>
    </div>
  )
}

export function DateRangePicker({
  value,
  onChange,
  defaultMonth,
  timePicker = false,
  placeholder = "Pick a date range",
  disabled = false,
  className,
}: DateRangePickerProps) {
  const [range, setRange] = React.useState<DateRange | undefined>(value)
  const [startTime, setStartTime] = React.useState<TimeState>(() => {
    if (value?.from) {
      const hours = value.from.getHours()
      return {
        hour: format(value.from, "hh"),
        minute: format(value.from, "mm"),
        period: hours >= 12 ? "PM" : "AM",
      }
    }
    return { hour: "12", minute: "00", period: "AM" }
  })
  const [endTime, setEndTime] = React.useState<TimeState>(() => {
    if (value?.to) {
      const hours = value.to.getHours()
      return {
        hour: format(value.to, "hh"),
        minute: format(value.to, "mm"),
        period: hours >= 12 ? "PM" : "AM",
      }
    }
    return { hour: "11", minute: "59", period: "PM" }
  })

  React.useEffect(() => {
    if (value) {
      setRange(value)
      if (value.from) {
        const hours = value.from.getHours()
        setStartTime({
          hour: format(value.from, "hh"),
          minute: format(value.from, "mm"),
          period: hours >= 12 ? "PM" : "AM",
        })
      }
      if (value.to) {
        const hours = value.to.getHours()
        setEndTime({
          hour: format(value.to, "hh"),
          minute: format(value.to, "mm"),
          period: hours >= 12 ? "PM" : "AM",
        })
      }
    }
  }, [value])

  const applyTimeToDate = (
    date: Date | undefined,
    time: TimeState
  ): Date | undefined => {
    if (!date) return undefined
    const result = new Date(date)
    let hourNum = parseInt(time.hour, 10)
    if (time.period === "PM" && hourNum !== 12) {
      hourNum += 12
    } else if (time.period === "AM" && hourNum === 12) {
      hourNum = 0
    }
    result.setHours(hourNum, parseInt(time.minute, 10), 0, 0)
    return result
  }

  const updateRange = React.useCallback(
    (
      newRange: DateRange | undefined,
      newStartTime?: TimeState,
      newEndTime?: TimeState
    ) => {
      const st = newStartTime ?? startTime
      const et = newEndTime ?? endTime

      if (!newRange) {
        onChange?.(undefined)
        return
      }

      if (timePicker) {
        const updatedRange: DateRange = {
          from: applyTimeToDate(newRange.from, st),
          to: applyTimeToDate(newRange.to, et),
        }
        onChange?.(updatedRange)
      } else {
        onChange?.(newRange)
      }
    },
    [startTime, endTime, timePicker, onChange]
  )

  const handleRangeSelect = (selectedRange: DateRange | undefined) => {
    setRange(selectedRange)
    updateRange(selectedRange)
  }

  const handleStartTimeChange = (newTime: TimeState) => {
    setStartTime(newTime)
    updateRange(range, newTime, endTime)
  }

  const handleEndTimeChange = (newTime: TimeState) => {
    setEndTime(newTime)
    updateRange(range, startTime, newTime)
  }

  const formatDisplayValue = () => {
    if (!range?.from) return placeholder

    const formatDateTime = (date: Date, time: TimeState) => {
      if (timePicker) {
        return `${format(date, "MMM d, yyyy")} ${time.hour}:${time.minute} ${time.period}`
      }
      return format(date, "MMM d, yyyy")
    }

    if (!range.to) {
      return formatDateTime(range.from, startTime)
    }

    return `${formatDateTime(range.from, startTime)} - ${formatDateTime(range.to, endTime)}`
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          disabled={disabled}
          className={cn(
            "w-full justify-start text-left font-normal",
            !range && "text-muted-foreground",
            className
          )}
        >
          <CalendarIcon className="mr-2 size-4" />
          <span className="truncate">{formatDisplayValue()}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="range"
          selected={range}
          onSelect={handleRangeSelect}
          defaultMonth={defaultMonth}
          numberOfMonths={2}
          autoFocus
        />
        {timePicker && (
          <div className="border-t border-border p-3">
            <div className="flex items-center gap-2 mb-3">
              <Clock className="size-4 text-muted-foreground" />
              <span className="text-sm font-medium">Time</span>
            </div>
            <div className="flex gap-6">
              <TimeInput
                label="Start time"
                time={startTime}
                onTimeChange={handleStartTimeChange}
              />
              <TimeInput
                label="End time"
                time={endTime}
                onTimeChange={handleEndTimeChange}
              />
            </div>
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}
