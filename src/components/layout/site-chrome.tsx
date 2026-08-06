"use client";

import { usePathname } from "next/navigation";
import { Footer } from "@/components/layout/footer";
import { Header } from "@/components/layout/header";
import { SkipLink } from "@/components/layout/skip-link";
import type { SiteConfig } from "@/config/site";

export function SiteChrome({
  children,
  config,
}: {
  children: React.ReactNode;
  config: SiteConfig;
}) {
  const isAdmin = usePathname().startsWith("/admin");
  if (isAdmin) return children;
  return (
    <>
      <SkipLink />
      <Header config={config} />
      {children}
      <Footer config={config} />
    </>
  );
}
