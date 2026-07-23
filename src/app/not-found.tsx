import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="bg-brand-dark grid min-h-screen place-items-center px-5 text-center text-white"
    >
      <div>
        <p className="text-tech text-sm font-bold tracking-[.12em] uppercase">
          Erro 404
        </p>
        <h1 className="font-heading mt-4 text-4xl font-semibold">
          Página não encontrada.
        </h1>
        <p className="mt-4 text-white/65">
          O conteúdo que você procura ainda não está disponível.
        </p>
        <Button href="/" className="mt-8">
          Voltar ao início
        </Button>
      </div>
    </main>
  );
}
