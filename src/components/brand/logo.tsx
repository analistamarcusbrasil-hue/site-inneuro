"use client";

import Image from "next/image";
import { useState } from "react";
import { cn } from "@/lib/utils";

type LogoProps = { inverse?: boolean; className?: string };

export function Logo({ inverse = false, className }: LogoProps) {
  const [imageAvailable, setImageAvailable] = useState(false);
  const source = inverse
    ? "/brand/inneuro-logo-white.png"
    : "/brand/inneuro-logo.png";
  return (
    <div
      className={cn("inline-flex min-h-8 items-center", className)}
      aria-label="INNEURO"
    >
      <Image
        src={source}
        alt="INNEURO"
        width={154}
        height={42}
        className={cn("h-9 w-auto", imageAvailable ? "block" : "hidden")}
        onLoad={() => setImageAvailable(true)}
        onError={() => setImageAvailable(false)}
        unoptimized
      />
      <span
        hidden={imageAvailable}
        className={cn(
          "font-heading text-xl font-bold tracking-[0.16em]",
          inverse ? "text-white" : "text-brand-dark",
        )}
      >
        INNEURO
      </span>
    </div>
  );
}
