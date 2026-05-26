import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-background)]",
  {
    variants: {
      variant: {
        default:
          "bg-[var(--color-primary)] text-[var(--color-primary-foreground)] shadow-[var(--shadow-soft)] hover:bg-[oklch(0.46_0.12_200)] active:scale-[0.98]",
        outline:
          "border border-[var(--color-border)] bg-transparent hover:bg-[var(--color-muted)] active:scale-[0.98]",
        ghost:
          "hover:bg-[var(--color-muted)] hover:text-[var(--color-foreground)]",
        soft:
          "bg-[var(--color-primary-50)] text-[var(--color-primary-700)] hover:bg-[var(--color-primary-100)]",
        secondary:
          "bg-[var(--color-muted)] text-[var(--color-foreground)] hover:bg-[oklch(0.93_0.008_240)] dark:hover:bg-[oklch(0.3_0.02_250)]",
        destructive:
          "bg-[var(--color-danger)] text-[var(--color-danger-foreground)] shadow-[var(--shadow-soft)] hover:bg-[oklch(0.54_0.21_22)]",
        link:
          "text-[var(--color-primary)] underline-offset-4 hover:underline p-0 h-auto",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-8 px-3 text-xs rounded-md",
        lg: "h-12 px-6 text-base rounded-xl",
        xl: "h-14 px-8 text-base rounded-xl",
        icon: "h-10 w-10",
        "icon-sm": "h-8 w-8 rounded-md",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
