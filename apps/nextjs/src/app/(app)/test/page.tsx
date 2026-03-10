"use client"

import React from "react";
import { DateTimePicker } from "@silo/ui/components/date-time-picker";

export default function TestPage() {
  const [date, setDate] = React.useState<Date | undefined>(undefined);
  return (
    <div className="flex flex-col gap-4 p-4">
      <DateTimePicker value={date} onChange={setDate} timePicker={true} />

      <span className="text-sm text-gray-500">{date?.toLocaleString()}</span>
    </div>
  )
}
