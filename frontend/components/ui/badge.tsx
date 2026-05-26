import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors [&_svg]:size-3 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-[var(--color-primary-50)] text-[var(--color-primary-700)]",
        outline:
          "border-[var(--color-border)] bg-transparent text-[var(--color-foreground)]",
        success:
          "border-transparent bg-[var(--color-success-soft)] text-[oklch(0.4_0.12_158)] dark:text-[oklch(0.85_0.12_158)]",
        warning:
          "border-transparent bg-[var(--color-warning-soft)] text-[oklch(0.4_0.12_75)] dark:text-[oklch(0.88_0.13_80)]",
        danger:
          "border-transparent bg-[var(--color-danger-soft)] text-[oklch(0.4_0.18_22)] dark:text-[oklch(0.85_0.15_22)]",
        info:
          "border-transparent bg-[var(--color-info-soft)] text-[oklch(0.4_0.13_235)] dark:text-[oklch(0.85_0.13_235)]",
        muted:
          "border-transparent bg-[var(--color-muted)] text-[var(--color-muted-foreground)]",
      },
      size: {
        default: "h-6",
        sm: "h-5 px-2 text-[10px]",
        lg: "h-7 px-3 text-xs",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {
  dot?: boolean;
}

function Badge({ className, variant, size, dot, children, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant, size }), className)} {...props}>
      {dot && <span className="size-1.5 rounded-full bg-current opacity-80" />}
      {children}
    </span>
  );
}

export { Badge, badgeVariants };
