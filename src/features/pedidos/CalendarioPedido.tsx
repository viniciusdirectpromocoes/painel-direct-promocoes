import { useState } from "react";
import { hoje } from "../../core/format";

const diaCompleto = new Intl.DateTimeFormat("pt-BR", { dateStyle: "full", timeZone: "UTC" });
const mesCompleto = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" });
const semana = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export function CalendarioPedido({ datas, onChange }: { datas: string[]; onChange: (datas: string[]) => void }) {
  const [mes, setMes] = useState(() => new Date(`${(datas[0] ?? hoje()).slice(0, 7)}-01T00:00:00Z`));
  const ano = mes.getUTCFullYear();
  const numeroMes = mes.getUTCMonth();
  const totalDias = new Date(Date.UTC(ano, numeroMes + 1, 0)).getUTCDate();
  const selecionadas = new Set(datas);
  const dataHoje = hoje();

  function mudarMes(delta: number) {
    setMes(new Date(Date.UTC(ano, numeroMes + delta, 1)));
  }

  function alternar(data: string) {
    onChange(selecionadas.has(data) ? datas.filter((dia) => dia !== data) : [...datas, data].sort());
  }

  return (
    <fieldset className="calendario-pedido">
      <legend>Datas do pedido</legend>
      <div className="calendario-mes">
        <button type="button" onClick={() => mudarMes(-1)} aria-label="Mês anterior">‹</button>
        <strong aria-live="polite">{mesCompleto.format(mes)}</strong>
        <button type="button" onClick={() => mudarMes(1)} aria-label="Próximo mês">›</button>
      </div>
      <div className="calendario-dias">
        {semana.map((dia) => <span key={dia} className="calendario-semana" aria-hidden="true">{dia}</span>)}
        {Array.from({ length: mes.getUTCDay() }, (_, i) => <span key={`vazio-${i}`} aria-hidden="true" />)}
        {Array.from({ length: totalDias }, (_, i) => {
          const dia = i + 1;
          const data = new Date(Date.UTC(ano, numeroMes, dia));
          const iso = data.toISOString().slice(0, 10);
          return (
            <button key={iso} type="button" onClick={() => alternar(iso)} aria-label={diaCompleto.format(data)} aria-pressed={selecionadas.has(iso)} aria-current={iso === dataHoje ? "date" : undefined}>
              {dia}
            </button>
          );
        })}
      </div>
      <p className="calendario-total" role="status">
        <strong>{datas.length} {datas.length === 1 ? "diária" : "diárias"}</strong>
        {datas.length === 0 && <span className="muted">Selecione os dias no calendário.</span>}
      </p>
    </fieldset>
  );
}
