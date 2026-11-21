type Props = {
  rotulo: string;
  checked: boolean;
  onChange: (v: boolean) => void;
};

/** Chave liga/desliga acessível (checkbox nativo por baixo). */
export function Interruptor({ rotulo, checked, onChange }: Props) {
  return (
    <label className="chave">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="chave-trilho" aria-hidden="true" />
      <span>{rotulo}</span>
    </label>
  );
}
