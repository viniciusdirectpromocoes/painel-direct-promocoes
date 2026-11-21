type Props = {
  opcoes: string[];
  valor: string[];
  onChange: (v: string[]) => void;
  rotulo: string;
};

/** Seleção múltipla em botões tipo chip. */
export function Chips({ opcoes, valor, onChange, rotulo }: Props) {
  return (
    <div className="chips" role="group" aria-label={rotulo}>
      {opcoes.map((o) => {
        const ativo = valor.includes(o);
        return (
          <button
            key={o}
            type="button"
            aria-pressed={ativo}
            className={`chip ${ativo ? "ativo" : ""}`}
            onClick={() => onChange(ativo ? valor.filter((x) => x !== o) : [...valor, o])}
          >
            {o}
          </button>
        );
      })}
    </div>
  );
}
