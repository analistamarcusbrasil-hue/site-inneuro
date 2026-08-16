import { AdminShell } from "@/components/admin/admin-shell";
import { ConfigurationPending } from "@/components/admin/configuration-pending";
import { isCmsConfigured } from "@/lib/cms/config";
import { requireAdmin } from "@/lib/cms/auth";

export default async function ProtectedAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!isCmsConfigured) return <ConfigurationPending />;
  const { profile } = await requireAdmin();
  return <AdminShell profile={profile}>{children}</AdminShell>;
}
