import type { Metadata } from "next";
import { requireCareersPortalEnabled } from "@/lib/careers/guards";

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
    nocache: true,
  },
};

export default function CareersPortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  requireCareersPortalEnabled();
  return children;
}
