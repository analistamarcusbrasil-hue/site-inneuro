export function AdminPageHeading({
  eyebrow = "Conteúdo",
  title,
  description,
}: {
  eyebrow?: string;
  title: string;
  description: string;
}) {
  return (
    <div className="mb-8">
      <p className="text-brand text-xs font-bold tracking-[0.14em] uppercase">
        {eyebrow}
      </p>
      <h1 className="font-heading text-brand-dark mt-2 text-3xl font-semibold sm:text-4xl">
        {title}
      </h1>
      <p className="text-muted mt-3 max-w-3xl leading-relaxed">{description}</p>
    </div>
  );
}
