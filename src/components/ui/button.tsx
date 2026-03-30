import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-medium transition-all outline-none ring-offset-transparent disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 focus-visible:ring-2 focus-visible:ring-[color:var(--ui-ring)]",
  {
    variants: {
      variant: {
        default:
          "border border-cyan-300/30 bg-[linear-gradient(135deg,var(--primary-strong),var(--primary))] text-slate-950 shadow-[0_14px_30px_rgba(0,229,255,0.18)] hover:-translate-y-0.5 hover:shadow-[0_20px_36px_rgba(0,229,255,0.24)]",
        secondary:
          "border border-white/10 bg-white/5 text-[color:var(--text)] hover:border-cyan-300/30 hover:bg-cyan-400/10",
        outline:
          "border border-white/12 bg-transparent text-[color:var(--text-soft)] hover:border-white/20 hover:bg-white/5 hover:text-[color:var(--text)]",
        ghost:
          "border border-transparent bg-transparent text-[color:var(--text-soft)] hover:bg-white/5 hover:text-[color:var(--text)]",
        destructive:
          "border border-[color:rgba(255,142,125,0.24)] bg-[color:rgba(255,142,125,0.12)] text-[color:var(--danger)] hover:bg-[color:rgba(255,142,125,0.18)]",
      },
      size: {
        default: "min-h-10 px-4 py-2",
        sm: "min-h-9 px-3.5 py-2 text-xs",
        lg: "min-h-11 px-5 py-2.5",
        icon: "size-10",
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
    VariantProps<typeof buttonVariants> {}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, size, variant, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  ),
);
Button.displayName = "Button";

export { Button, buttonVariants };
