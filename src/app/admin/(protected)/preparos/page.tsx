import { notFound } from "next/navigation";
import { AdminModuleView } from "@/components/admin/admin-module-view";
import { getCmsModule } from "@/lib/cms/modules";

export default function AdminPreparationsPage({
  searchParams,
}: {
  searchParams: Promise<{
    edit?: string;
    success?: string;
    error?: string;
    q?: string;
    status?: string;
  }>;
}) {
  const cmsModule = getCmsModule("preparos");
  if (!cmsModule) notFound();
  return <AdminModuleView module={cmsModule} searchParams={searchParams} />;
}
