import { AdminSkeleton } from "@/components/admin/ui";

export default function AdminLoading() {
  return (
    <div role="status" aria-label="Carregando conteúdo administrativo">
      <span className="sr-only">Carregando conteúdo administrativo…</span>
      <div className="border-border-light mb-6 border-b pb-6">
        <AdminSkeleton className="h-3 w-28" />
        <AdminSkeleton className="mt-3 h-9 w-64 max-w-full" />
        <AdminSkeleton className="mt-3 h-4 w-[34rem] max-w-full" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <div
            key={index}
            className="border-border-light rounded-2xl border bg-white p-5"
          >
            <AdminSkeleton className="size-10" />
            <AdminSkeleton className="mt-5 h-3 w-24" />
            <AdminSkeleton className="mt-3 h-8 w-20" />
          </div>
        ))}
      </div>
      <div className="border-border-light mt-6 rounded-2xl border bg-white p-5">
        <AdminSkeleton className="h-5 w-40" />
        <div className="mt-5 space-y-3">
          {Array.from({ length: 5 }, (_, index) => (
            <AdminSkeleton key={index} className="h-12 w-full" />
          ))}
        </div>
      </div>
    </div>
  );
}
