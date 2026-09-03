"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, type ReactNode } from "react";
import { cn } from "@/lib/utils";

const focusableSelector =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function AdminDrawer({
  children,
  closeHref,
  onClose,
  labelledBy,
  describedBy,
  className,
}: {
  children: ReactNode;
  closeHref?: string;
  onClose?: () => void;
  labelledBy: string;
  describedBy?: string;
  className?: string;
}) {
  const router = useRouter();
  const panelRef = useRef<HTMLElement>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);
  const close = useCallback(() => {
    if (onCloseRef.current) onCloseRef.current();
    else if (closeHref) router.push(closeHref);
  }, [closeHref, router]);

  useEffect(() => {
    const returnFocus = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const panel = panelRef.current;
    const firstFocusable = panel?.querySelector<HTMLElement>(focusableSelector);
    (firstFocusable ?? panel)?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        close();
        return;
      }
      if (event.key !== "Tab" || !panel) return;
      const focusable = Array.from(
        panel.querySelectorAll<HTMLElement>(focusableSelector),
      );
      if (!focusable.length) {
        event.preventDefault();
        panel.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable.at(-1)!;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      returnFocus?.focus();
    };
  }, [close]);

  return (
    <div
      className="fixed inset-0 z-[80] flex justify-end bg-black/40"
      role="dialog"
      aria-modal="true"
      aria-labelledby={labelledBy}
      aria-describedby={describedBy}
      onMouseDown={(event) => {
        if (event.currentTarget === event.target) close();
      }}
    >
      <aside
        ref={panelRef}
        tabIndex={-1}
        className={cn(
          "h-full w-[96vw] max-w-[760px] overflow-y-auto bg-white shadow-2xl outline-none",
          className,
        )}
      >
        {children}
      </aside>
    </div>
  );
}
