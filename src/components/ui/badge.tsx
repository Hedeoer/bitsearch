import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.12em]",
  {
    variants: {
      variant: {
        default: "border-cyan-300/20 bg-cyan-400/10 text-[color:var(--primary-strong)]",
        neutral: "border-white/10 bg-white/5 text-[color:var(--text-soft)]",
        success: "border-emerald-400/20 bg-emerald-400/10 text-[color:var(--success)]",
        warning: "border-amber-300/20 bg-amber-300/10 text-[color:var(--warning)]",
        danger: "border-rose-300/20 bg-rose-300/10 text-[color:var(--danger)]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
