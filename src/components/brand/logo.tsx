"use client";

import Image from "next/image";
import { useState } from "react";
import { cn } from "@/lib/utils";

type LogoProps = { inverse?: boolean; className?: string };

export function Logo({ inverse = false, className }: LogoProps) {
  const [imageFailed, setImageFailed] = useState(false);

  return (
    <div
      className={cn("inline-flex min-h-12 items-center", className)}
      aria-label="INNEURO"
    >
      {imageFailed ? (
        <span
          className={cn(
            "font-heading text-xl font-bold tracking-[0.16em]",
            inverse ? "text-white" : "text-brand-dark",
          )}
        >
          INNEURO
        </span>
      ) : (
        <span className="relative block size-16 shrink-0 sm:size-18">
          <Image
            src="/brands/inneuro/logo-inneuro.png"
            alt="INNEURO — Instituto de Neurologia do Amapá"
            fill
            sizes="72px"
            className="object-contain"
            onError={() => setImageFailed(true)}
          />
        </span>
      )}
    </div>
  );
}
