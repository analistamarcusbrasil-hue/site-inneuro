export function AdminPageHeading({
  eyebrow = "Administração",
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="border-border-light mb-7 flex flex-col gap-5 border-b pb-6 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <p className="text-brand text-[0.68rem] font-extrabold tracking-[0.16em] uppercase">
          {eyebrow}
        </p>
        <h1 className="font-heading text-brand-dark mt-2 text-2xl font-semibold tracking-[-0.025em] sm:text-3xl">
          {title}
        </h1>
        <p className="text-muted mt-2 max-w-3xl text-sm leading-6 sm:text-[0.95rem]">
          {description}
        </p>
      </div>
      {actions ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {actions}
        </div>
      ) : null}
    </div>
  );
}
