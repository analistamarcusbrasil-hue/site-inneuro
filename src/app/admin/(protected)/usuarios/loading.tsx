export default function UsersLoading() {
  return (
    <div role="status" aria-label="Carregando usuários e acessos">
      <div className="animate-pulse">
        <div className="h-4 w-36 rounded bg-slate-200" />
        <div className="mt-3 h-9 w-72 max-w-full rounded bg-slate-200" />
        <div className="mt-2 h-4 w-[34rem] max-w-full rounded bg-slate-100" />
        <div className="mt-8 flex flex-col gap-3 lg:flex-row lg:justify-between">
          <div className="h-11 w-full max-w-xl rounded-xl bg-slate-200" />
          <div className="h-11 w-36 rounded-xl bg-slate-200" />
        </div>
        <div className="mt-5 flex gap-2 overflow-hidden">
          {Array.from({ length: 7 }, (_, index) => (
            <div
              key={index}
              className="h-9 w-24 shrink-0 rounded-full bg-slate-100"
            />
          ))}
        </div>
        <div className="border-border-light mt-5 overflow-hidden rounded-2xl border bg-white">
          <div className="bg-surface h-12" />
          {Array.from({ length: 6 }, (_, index) => (
            <div
              key={index}
              className="border-border-light grid min-h-20 grid-cols-[2fr_2fr_1fr] items-center gap-6 border-t px-5"
            >
              <div className="h-4 rounded bg-slate-200" />
              <div className="h-4 rounded bg-slate-100" />
              <div className="h-8 rounded bg-slate-100" />
            </div>
          ))}
        </div>
      </div>
      <span className="sr-only">Carregando...</span>
    </div>
  );
}
