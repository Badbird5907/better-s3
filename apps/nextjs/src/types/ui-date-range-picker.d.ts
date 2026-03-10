declare module "@app/ui/components/date-range-picker" {
  import type { JSX } from "react";

  interface DateRangePickerProps {
    value?: { from?: Date; to?: Date };
    onChange?: (range: { from?: Date; to?: Date } | undefined) => void;
    timePicker?: boolean;
    placeholder?: string;
    disabled?: boolean;
    className?: string;
  }

  export function DateRangePicker(props: DateRangePickerProps): JSX.Element;
}
