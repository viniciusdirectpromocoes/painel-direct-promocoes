import { calcularHoraFim } from "../core/operacao";

export function CamposJornada({ inicio, fimInformado, atualizar }: { inicio: string; fimInformado?: string; atualizar: (inicio: string) => void }) {
  const fimPadrao = calcularHoraFim(inicio);
  const fim = fimInformado || fimPadrao;
  return (
    <>
      <div className="pedido-form-horario">
        <label className="campo">
          <span>Horário de início</span>
          <input type="time" value={inicio} onChange={(e) => atualizar(e.target.value)} required />
        </label>
        <label className="campo">
          <span>Horário de fim</span>
          <input type="time" value={fim} readOnly />
        </label>
      </div>
      <p className="muted jornada-nota">
        {fim === fimPadrao ? "7h20 de trabalho + 1h de intervalo" : "Horário informado no pedido"}
        {fim && fim < inicio ? " · Saída no dia seguinte" : ""}
      </p>
    </>
  );
}
