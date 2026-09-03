import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

type SharedProps = {
  children: ReactNode;
  label: string;
  className?: string;
};

type IconButtonProps = SharedProps &
  ButtonHTMLAttributes<HTMLButtonElement> & { href?: never };

type IconLinkProps = SharedProps & { href: string };

export function AdminIconButton(props: IconButtonProps | IconLinkProps) {
  const { children, label, className, ...elementProps } = props;
  const classes = cn(
    "border-border-light text-muted hover:border-brand/30 hover:bg-mint/70 hover:text-brand-dark inline-grid size-10 shrink-0 place-items-center rounded-xl border bg-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
    className,
  );

  if ("href" in elementProps && elementProps.href) {
    return (
      <Link
        href={elementProps.href}
        aria-label={label}
        title={label}
        className={classes}
      >
        {children}
      </Link>
    );
  }

  const { type = "button", ...buttonProps } =
    elementProps as ButtonHTMLAttributes<HTMLButtonElement>;

  return (
    <button
      type={type}
      {...buttonProps}
      aria-label={label}
      title={label}
      className={classes}
    >
      {children}
    </button>
  );
}
