import { cn } from "@/lib/utils";

/**
 * Cabeçalho de página no padrão do site Medflow (§14.3/14.4/§15): eyebrow (traço 32×3 + CAPS)
 * → título 600 roxo com tracking negativo → lead cinza. Layout "split" opcional: ações à
 * direita, alinhadas pela base (como o `.cf-top` do site); empilha no mobile.
 */
export function PageHeader({
  eyebrow,
  titulo,
  descricao,
  acoes,
  className,
}: {
  eyebrow: string;
  titulo: React.ReactNode;
  descricao?: React.ReactNode;
  acoes?: React.ReactNode;
  className?: string;
}) {
  return (
    <header
      className={cn(
        "flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between lg:gap-12",
        className,
      )}
    >
      <div className="min-w-0">
        <p className="eyebrow mb-[18px] max-lg:mb-3.5">{eyebrow}</p>
        <h1 className="page-title">{titulo}</h1>
        {descricao ? (
          <p className="mt-4 max-w-[62ch] text-[17px] leading-[1.6] text-muted-foreground max-lg:text-base">
            {descricao}
          </p>
        ) : null}
      </div>
      {acoes ? <div className="flex shrink-0 flex-wrap items-center gap-3">{acoes}</div> : null}
    </header>
  );
}
