import { calcularHoraFim } from "../core/operacao";

export function CamposJornada({ inicio, atualizar }: { inicio: string; atualizar: (inicio: string) => void }) {
  const fim = calcularHoraFim(inicio);
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
        7h20 de trabalho + 1h de intervalo
        {fim && fim < inicio ? " · Saída no dia seguinte" : ""}
      </p>
    </>
  );
}
