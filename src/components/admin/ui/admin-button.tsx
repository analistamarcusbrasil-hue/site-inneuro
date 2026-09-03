import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

const buttonVariants = {
  primary: "bg-brand text-white hover:bg-brand-dark",
  secondary: "bg-mint text-brand-dark hover:bg-border-light",
  outline:
    "border border-border-light bg-white text-brand-dark hover:border-brand/30 hover:bg-mint/60",
  danger: "bg-error text-white hover:bg-red-800",
  ghost: "bg-transparent text-brand-dark hover:bg-mint/70",
} as const;

const buttonSizes = {
  sm: "min-h-9 px-3 text-xs",
  md: "min-h-11 px-4 text-sm",
  lg: "min-h-12 px-5 text-base",
} as const;

type SharedProps = {
  children: ReactNode;
  variant?: keyof typeof buttonVariants;
  size?: keyof typeof buttonSizes;
  className?: string;
};

type AdminButtonElementProps = SharedProps &
  ButtonHTMLAttributes<HTMLButtonElement> & { href?: never };

type AdminButtonLinkProps = SharedProps & {
  href: string;
  "aria-label"?: string;
};

export function AdminButton(
  props: AdminButtonElementProps | AdminButtonLinkProps,
) {
  const {
    children,
    variant = "primary",
    size = "md",
    className,
    ...elementProps
  } = props;
  const classes = cn(
    "inline-flex shrink-0 items-center justify-center gap-2 rounded-xl font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
    buttonVariants[variant],
    buttonSizes[size],
    className,
  );

  if ("href" in elementProps && elementProps.href) {
    return (
      <Link
        href={elementProps.href}
        className={classes}
        aria-label={elementProps["aria-label"]}
      >
        {children}
      </Link>
    );
  }

  const { type = "button", ...buttonProps } =
    elementProps as ButtonHTMLAttributes<HTMLButtonElement>;

  return (
    <button type={type} {...buttonProps} className={classes}>
      {children}
    </button>
  );
}
