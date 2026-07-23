"use client";

import { usePathname } from "next/navigation";
import { Footer } from "@/components/layout/footer";
import { Header } from "@/components/layout/header";
import { SkipLink } from "@/components/layout/skip-link";

export function SiteChrome({ children }: { children: React.ReactNode }) {
  const isAdmin = usePathname().startsWith("/admin");
  if (isAdmin) return children;
  return (
    <>
      <SkipLink />
      <Header />
      {children}
      <Footer />
    </>
  );
}
