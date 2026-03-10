import type { VariantProps } from "class-variance-authority";
import * as React from "react";
import { cva } from "class-variance-authority";

import { cn } from "../lib/utils";

export const inputVariants = cva(
  "placeholder:text-muted-foreground aria-invalid:ring-destructive aria-invalid:focus-within:ring-destructive flex h-10 w-full items-center border border-transparent bg-transparent px-3 py-2 text-sm file:border-0 file:text-sm file:font-medium focus-within:outline-none disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:ring-1 aria-invalid:focus-within:ring-2",
  {
    variants: {
      rounded: {
        none: "rounded-none",
        md: "rounded-md",
      },
      variant: {
        outline:
          "border-borde focus-within:border-primary focus-within:shadow-[0_0px_0px_1px_hsl(var(--primary))] aria-invalid:border-transparent",
        filled:
          "bg-background focus-within:border-primary border-2 focus-within:bg-transparent",
        underlined:
          "border-b-border focus-within:border-b-primary rounded-none focus-within:shadow-[0_1px_0px_0px_hsl(var(--primary))]",
        unstyled: "",
      },
    },
    defaultVariants: {
      rounded: "md",
      variant: "outline",
    },
  },
);

export interface InputProps
  extends
    React.InputHTMLAttributes<HTMLInputElement>,
    VariantProps<typeof inputVariants> {
  startContent?: React.ReactNode;
  endContent?: React.ReactNode;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    { className, rounded, variant, startContent, endContent, ...props },
    ref,
  ) => {
    return (
      <div
        className={cn(
          inputVariants({ variant, rounded, className }),
          className,
        )}
      >
        {startContent && (
          <span className="text-muted-foreground pointer-events-none flex items-center">
            {startContent}
          </span>
        )}
        <input
          ref={ref}
          {...props}
          className={cn(
            "w-full bg-transparent outline-none [-moz-appearance:textfield] focus-visible:outline-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none",
            {
              "pl-1.5": !!startContent,
              "pr-1.5": !!endContent,
            },
          )}
        />
        {endContent && (
          <span className="text-muted-foreground pointer-events-none flex items-center">
            {endContent}
          </span>
        )}
      </div>
    );
  },
);
Input.displayName = "Input";

export { Input };
