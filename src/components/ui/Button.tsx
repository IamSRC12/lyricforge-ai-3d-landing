import { motion, HTMLMotionProps } from "framer-motion";
import { cn } from "@/lib/cn";

export type ButtonProps = HTMLMotionProps<"button"> & {
  variant?: "primary" | "secondary" | "ghost" | "outline" | "danger";
  size?: "sm" | "md" | "lg" | "icon";
  loading?: boolean;
};

export function Button({
  variant = "primary",
  size = "md",
  className,
  children,
  loading = false,
  disabled,
  type = "button",
  whileTap,
  whileHover,
  ...props
}: ButtonProps) {
  const base = "inline-flex items-center justify-center rounded-xl font-medium transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[#0A0A0F] disabled:opacity-50 disabled:pointer-events-none select-none cursor-pointer";

  const variants = {
    primary: "bg-white text-black hover:bg-zinc-200 focus:ring-white shadow-[0_0_30px_rgba(255,255,255,0.15)]",
    secondary: "bg-zinc-800 text-white hover:bg-zinc-700 border border-zinc-700",
    ghost: "bg-transparent text-zinc-400 hover:text-white hover:bg-zinc-900",
    outline: "border border-zinc-700 text-white hover:bg-zinc-800",
    danger: "bg-red-600 text-white hover:bg-red-700",
  };

  const sizes = {
    sm: "h-8 px-3 text-xs",
    md: "h-10 px-5 text-sm",
    lg: "h-12 px-8 text-base",
    icon: "h-10 w-10 p-0",
  };

  const isDisabled = disabled || loading;

  return (
    <motion.button
      type={type}
      disabled={isDisabled}
      aria-busy={loading}
      whileTap={isDisabled ? undefined : (whileTap ?? { scale: 0.97 })}
      whileHover={isDisabled ? undefined : (whileHover ?? { scale: 1.01 })}
      className={cn(base, variants[variant], sizes[size], className)}
      {...props}
    >
      {loading ? (
        <span className="flex items-center gap-2">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
          {children as React.ReactNode}
        </span>
      ) : (
        (children as React.ReactNode)
      )}
    </motion.button>
  );
}
