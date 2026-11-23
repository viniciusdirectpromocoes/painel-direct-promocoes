import { SETORES } from "./constants";
import type { Dados, Jornada } from "./types";

export const chaveOperacao = (nome: string) => nome.trim().normalize("NFD").replace(/\p{Diacritic}/gu, "").toLocaleLowerCase("pt-BR");
const ordenar = (a: string, b: string) => a.localeCompare(b, "pt-BR");

export function setoresDaOperacao(dados: Dados, atual = "") {
  const setores = new Map<string, string>();
  for (const valor of [
    ...SETORES, ...dados.tarifasSetores.map((tarifa) => tarifa.setor), ...dados.setoresExtras,
    ...dados.diaristas.flatMap((diarista) => diarista.setores ?? []), atual,
  ]) {
    const chave = chaveOperacao(valor);
    if (chave && (!setores.has(chave) || valor === atual)) setores.set(chave, valor.trim());
  }
  return [...setores.values()].sort(ordenar);
}

export function tarifaDaOperacao(dados: Dados, rede: string, setor: string) {
  const redeNormalizada = chaveOperacao(rede);
  const daRede = dados.tarifasRedes.find((tarifa) => chaveOperacao(tarifa.rede) === redeNormalizada);
  const setores = dados.tarifasSetores.filter((tarifa) => chaveOperacao(tarifa.setor) === chaveOperacao(setor));
  const especifica = setores.find((tarifa) => tarifa.rede && chaveOperacao(tarifa.rede) === redeNormalizada);
  const geral = setores.find((tarifa) => !tarifa.rede);
  return { recebe: daRede?.recebe, paga: especifica?.paga ?? geral?.paga ?? daRede?.paga };
}

export const jornadaVazia: Jornada = { horaInicio: "", horaFim: "", intervaloInicio: "", intervaloFim: "" };

const minutos = (hora: string) => {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(hora)) return NaN;
  const [h, m] = hora.split(":").map(Number);
  return h * 60 + m;
};

export function erroDaJornada(jornada: Jornada) {
  const inicio = minutos(jornada.horaInicio);
  const fim = minutos(jornada.horaFim);
  if (!Number.isFinite(inicio + fim)) return "Informe os horários de início e fim.";
  if (inicio === fim) return "Escolha horários diferentes para início e fim.";
  if (!jornada.intervaloInicio && !jornada.intervaloFim) return "";
  const relativo = (hora: string) => (minutos(hora) - inicio + 1440) % 1440;
  const de = relativo(jornada.intervaloInicio);
  const ate = relativo(jornada.intervaloFim);
  const duracao = (fim - inicio + 1440) % 1440;
  if (!Number.isFinite(de + ate)) return "Preencha o início e o fim do intervalo.";
  return de < ate && ate <= duracao ? "" : "O intervalo precisa estar dentro do horário de trabalho.";
}
