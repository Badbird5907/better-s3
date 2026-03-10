"use client";

import * as React from "react";
import { format } from "date-fns";
import { CalendarIcon, Clock } from "lucide-react";

import { Button } from "@silo/ui/components/button";
import { Calendar } from "@silo/ui/components/calendar";
import { Input } from "@silo/ui/components/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@silo/ui/components/popover";
import { cn } from "@silo/ui/lib/utils";

interface DateTimePickerProps {
  value?: Date;
  onChange?: (date: Date | undefined) => void;
  timePicker?: boolean;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export function DateTimePicker({
  value,
  onChange,
  timePicker = false,
  placeholder = "Pick a date",
  disabled = false,
  className,
}: DateTimePickerProps) {
  const [date, setDate] = React.useState<Date | undefined>(value);
  const [hour, setHour] = React.useState<string>(
    value ? format(value, "hh") : "12",
  );
  const [minute, setMinute] = React.useState<string>(
    value ? format(value, "mm") : "00",
  );
  const [period, setPeriod] = React.useState<"AM" | "PM">(
    value ? (value.getHours() >= 12 ? "PM" : "AM") : "AM",
  );

  // Sync internal state with external value
  React.useEffect(() => {
    if (value) {
      setDate(value);
      setHour(format(value, "hh"));
      setMinute(format(value, "mm"));
      setPeriod(value.getHours() >= 12 ? "PM" : "AM");
    }
  }, [value]);

  // Update the full datetime when any part changes
  const updateDateTime = React.useCallback(
    (
      newDate?: Date,
      newHour?: string,
      newMinute?: string,
      newPeriod?: "AM" | "PM",
    ) => {
      const currentDate = newDate ?? date;
      const currentHour = newHour ?? hour;
      const currentMinute = newMinute ?? minute;
      const currentPeriod = newPeriod ?? period;

      if (!currentDate) {
        onChange?.(undefined);
        return;
      }

      const updatedDate = new Date(currentDate);

      if (timePicker) {
        let hourNum = parseInt(currentHour, 10);
        if (currentPeriod === "PM" && hourNum !== 12) {
          hourNum += 12;
        } else if (currentPeriod === "AM" && hourNum === 12) {
          hourNum = 0;
        }
        updatedDate.setHours(hourNum, parseInt(currentMinute, 10), 0, 0);
      } else {
        updatedDate.setHours(0, 0, 0, 0);
      }

      onChange?.(updatedDate);
    },
    [date, hour, minute, period, timePicker, onChange],
  );

  const handleDateSelect = (selectedDate: Date | undefined) => {
    setDate(selectedDate);
    updateDateTime(selectedDate, hour, minute, period);
  };

  const handleHourChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Allow any input while typing, validate on blur
    const val = e.target.value.replace(/\D/g, "").slice(0, 2);
    setHour(val);
  };

  const handleHourBlur = () => {
    let num = parseInt(hour, 10);
    if (isNaN(num) || num < 1) {
      num = 12;
    } else if (num > 12) {
      num = 12;
    }
    const padded = String(num).padStart(2, "0");
    setHour(padded);
    updateDateTime(date, padded, minute, period);
  };

  const handleMinuteChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Allow any input while typing, validate on blur
    const val = e.target.value.replace(/\D/g, "").slice(0, 2);
    setMinute(val);
  };

  const handleMinuteBlur = () => {
    let num = parseInt(minute, 10);
    if (isNaN(num) || num < 0) {
      num = 0;
    } else if (num > 59) {
      num = 59;
    }
    const padded = String(num).padStart(2, "0");
    setMinute(padded);
    updateDateTime(date, hour, padded, period);
  };

  const handlePeriodChange = (newPeriod: "AM" | "PM") => {
    setPeriod(newPeriod);
    updateDateTime(date, hour, minute, newPeriod);
  };

  const formatDisplayValue = () => {
    if (!date) return placeholder;
    if (timePicker) {
      return `${format(date, "PPP")} at ${hour}:${minute} ${period}`;
    }
    return format(date, "PPP");
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          disabled={disabled}
          className={cn(
            "w-full justify-start text-left font-normal",
            !date && "text-muted-foreground",
            className,
          )}
        >
          <CalendarIcon className="mr-2 size-4" />
          {formatDisplayValue()}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={date}
          onSelect={handleDateSelect}
          autoFocus
        />
        {timePicker && (
          <div className="border-border border-t p-3">
            <div className="flex items-center gap-2">
              <Clock className="text-muted-foreground size-4" />
              <span className="text-sm font-medium">Time</span>
            </div>
            <div className="mt-2 flex items-center gap-2">
              <Input
                type="text"
                inputMode="numeric"
                value={hour}
                onChange={handleHourChange}
                onBlur={handleHourBlur}
                onFocus={(e) => e.target.select()}
                placeholder="12"
                className="w-14 text-center"
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
                className="w-14 text-center"
              />
              <button
                type="button"
                onClick={() =>
                  handlePeriodChange(period === "AM" ? "PM" : "AM")
                }
                className="border-input bg-background hover:bg-accent hover:text-accent-foreground focus-visible:ring-ring flex h-9 w-14 items-center justify-center rounded-md border text-sm font-medium transition-colors focus-visible:ring-1 focus-visible:outline-none"
              >
                {period}
              </button>
            </div>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
