export function CompanyHighlightsEmptyState() {
  return (
    <div
      role="img"
      aria-label="Composição visual da identidade INNEURO"
      className="bg-brand-dark relative aspect-[16/9] w-full overflow-hidden rounded-[1.75rem]"
    >
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,.045)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.045)_1px,transparent_1px)] bg-[size:56px_56px]"
      />
      <div
        aria-hidden="true"
        className="border-tech/25 absolute top-1/2 left-1/2 aspect-square w-[min(68%,560px)] -translate-x-1/2 -translate-y-1/2 rounded-full border"
      >
        <span className="border-mint/15 absolute inset-[12%] rounded-full border border-dashed" />
        <span className="border-tech/35 absolute inset-[28%] rounded-full border" />
        <span className="bg-tech absolute inset-[47%] rounded-full shadow-[0_0_42px_rgba(33,199,122,.45)]" />
      </div>
      <div
        aria-hidden="true"
        className="from-tech/70 absolute top-1/2 right-[8%] left-[8%] h-px bg-gradient-to-r via-white/15 to-transparent"
      />
      <span className="text-mint/55 absolute right-5 bottom-5 text-[0.65rem] font-bold tracking-[0.18em] uppercase sm:right-7 sm:bottom-7">
        INNEURO
      </span>
    </div>
  );
}
