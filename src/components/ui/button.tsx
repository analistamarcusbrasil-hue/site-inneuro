import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

const variants = {
  primary: "bg-brand text-white hover:bg-brand-dark",
  secondary: "bg-mint text-brand-dark hover:bg-border-light",
  outline:
    "border border-brand/30 bg-transparent text-brand-dark hover:bg-mint",
  ghost: "bg-transparent text-brand-dark hover:bg-mint",
};

const sizes = {
  sm: "min-h-10 px-4 text-sm",
  md: "min-h-11 px-5 text-sm",
  lg: "min-h-12 px-6 text-base",
};

type SharedProps = {
  children: ReactNode;
  variant?: keyof typeof variants;
  size?: keyof typeof sizes;
  className?: string;
};

type ButtonProps = SharedProps &
  ButtonHTMLAttributes<HTMLButtonElement> & { href?: never };
type LinkButtonProps = SharedProps & { href: string; "aria-label"?: string };

export function Button(props: ButtonProps | LinkButtonProps) {
  const { children, variant = "primary", size = "md", className } = props;
  const classes = cn(
    "inline-flex items-center justify-center gap-2 rounded-full font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tech focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
    variants[variant],
    sizes[size],
    className,
  );

  if ("href" in props && props.href) {
    return (
      <Link
        href={props.href}
        className={classes}
        aria-label={props["aria-label"]}
      >
        {children}
      </Link>
    );
  }

  const { type = "button", ...buttonProps } = props as ButtonProps;
  return (
    <button type={type} {...buttonProps} className={classes}>
      {children}
    </button>
  );
}
