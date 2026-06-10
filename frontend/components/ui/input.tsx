import * as React from "react";
import { Eye, EyeOff } from "lucide-react";
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

/**
 * Password field with a built-in show/hide eye toggle. Drop-in replacement for
 * `<Input type="password" />` — it owns the `type` and `trailingIcon`, so don't
 * pass those. The toggle is `tabIndex={-1}` so it doesn't interrupt tabbing
 * from the field to the submit button, and `::-ms-reveal` is hidden so Edge
 * doesn't render a second native eye next to ours.
 */
export type PasswordInputProps = Omit<InputProps, "type" | "trailingIcon">;

const PasswordInput = React.forwardRef<HTMLInputElement, PasswordInputProps>(
  ({ className, ...props }, ref) => {
    const [show, setShow] = React.useState(false);
    return (
      <Input
        {...props}
        ref={ref}
        type={show ? "text" : "password"}
        className={cn("[&::-ms-reveal]:hidden [&::-ms-clear]:hidden", className)}
        trailingIcon={
          <button
            type="button"
            tabIndex={-1}
            onClick={() => setShow((v) => !v)}
            aria-label={show ? "Hide password" : "Show password"}
            aria-pressed={show}
            className="flex items-center rounded p-0.5 text-[var(--color-muted-foreground)] transition-colors hover:text-[var(--color-foreground)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]/40"
          >
            {show ? <EyeOff /> : <Eye />}
          </button>
        }
      />
    );
  },
);
PasswordInput.displayName = "PasswordInput";

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

export { Input, PasswordInput, Textarea, Label };
