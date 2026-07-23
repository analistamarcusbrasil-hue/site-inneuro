import { notFound } from "next/navigation";
import { AdminModuleView } from "@/components/admin/admin-module-view";
import { getCmsModule } from "@/lib/cms/modules";

export default function Page({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string; success?: string; error?: string }>;
}) {
  const cmsModule = getCmsModule("carrossel");
  if (!cmsModule) notFound();
  return <AdminModuleView module={cmsModule} searchParams={searchParams} />;
}
