import * as React from "react";
import { cn } from "@/lib/utils";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  leadingIcon?: React.ReactNode;
  trailingIcon?: React.ReactNode;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, leadingIcon, trailingIcon, ...props }, ref) => {
    return (
      <div className="relative w-full">
        {leadingIcon && (
          <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-[var(--color-muted-foreground)] [&_svg]:size-4">
            {leadingIcon}
          </span>
        )}
        <input
          type={type}
          ref={ref}
          className={cn(
            "flex h-10 w-full rounded-lg border border-[var(--color-input)] bg-[var(--color-card)] px-3.5 py-2 text-sm placeholder:text-[var(--color-muted-foreground)] transition-colors disabled:cursor-not-allowed disabled:opacity-50",
            "focus:border-[var(--color-primary)] focus:outline-none focus:ring-4 focus:ring-[var(--color-primary)]/15",
            leadingIcon && "pl-10",
            trailingIcon && "pr-10",
            className,
          )}
          {...props}
        />
        {trailingIcon && (
          <span className="absolute inset-y-0 right-0 flex items-center pr-3 text-[var(--color-muted-foreground)] [&_svg]:size-4">
            {trailingIcon}
          </span>
        )}
      </div>
    );
  },
);
Input.displayName = "Input";

const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(
        "flex min-h-20 w-full rounded-lg border border-[var(--color-input)] bg-[var(--color-card)] px-3.5 py-2.5 text-sm placeholder:text-[var(--color-muted-foreground)] transition-colors disabled:cursor-not-allowed disabled:opacity-50",
        "focus:border-[var(--color-primary)] focus:outline-none focus:ring-4 focus:ring-[var(--color-primary)]/15",
        className,
      )}
      {...props}
    />
  ),
);
Textarea.displayName = "Textarea";

const Label = React.forwardRef<HTMLLabelElement, React.LabelHTMLAttributes<HTMLLabelElement>>(
  ({ className, ...props }, ref) => (
    <label
      ref={ref}
      className={cn("text-sm font-medium text-[var(--color-foreground)] leading-none", className)}
      {...props}
    />
  ),
);
Label.displayName = "Label";

export { Input, Textarea, Label };
