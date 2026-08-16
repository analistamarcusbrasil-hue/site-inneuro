import { requireAdminPermission } from "@/lib/cms/auth";

export default async function HrLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAdminPermission("hr.view");
  return children;
}
