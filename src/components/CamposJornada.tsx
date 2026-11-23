import type { Jornada } from "../core/types";

const campos = [
  ["horaInicio", "Horário de início"],
  ["horaFim", "Horário de fim"],
  ["intervaloInicio", "Início do intervalo"],
  ["intervaloFim", "Fim do intervalo"],
] as const;

export function CamposJornada({ jornada, atualizar }: {
  jornada: Jornada;
  atualizar: (campo: keyof Jornada, valor: string) => void;
}) {
  return (
    <div className="pedido-form-horario">
      {campos.map(([campo, rotulo], i) => (
        <label className="campo" key={campo}>
          <span>{rotulo}</span>
          <input type="time" value={jornada[campo]} onChange={(e) => atualizar(campo, e.target.value)} required={i < 2} />
        </label>
      ))}
    </div>
  );
}
