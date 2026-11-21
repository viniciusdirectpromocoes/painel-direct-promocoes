import type { Diarista } from "./types";
import { TURNOS, VALOR_DIARIA } from "./constants";

export type StatusDiarista = "Disponível" | "Trabalhando" | "Bloqueada";

/** Situação atual: bloqueada tem prioridade, depois trabalhando, senão disponível. */
export function statusDiarista(d: Diarista): StatusDiarista {
  if (d.bloqueada) return "Bloqueada";
  return d.trabalhando ? "Trabalhando" : "Disponível";
}

export const disponivel = (d: Diarista) => statusDiarista(d) === "Disponível";

/** Turnos em que a diarista pode trabalhar, ex.: "Manhã, Noite". */
export function resumoDisponibilidade(d: Diarista): string {
  const turnos = (d.turnos ?? []).map((t) => TURNOS.find((x) => x.valor === t)?.rotulo ?? t);
  return turnos.length > 0 ? turnos.join(", ") : "Não informado";
}

/** Resumo da locomoção: "Moto, Uber" ou "Não informado". */
export function resumoLocomocao(d: Diarista): string {
  return d.transportes.length > 0 ? d.transportes.join(", ") : "Não informado";
}

/** Quantidade de diárias a partir do valor pago, com base em R$ 90 por diária. */
export function quantidadeDiarias(valor: number) {
  return valor / VALOR_DIARIA;
}

/** Texto para mostrar a quantidade de diárias: "3", "2,5" ou vazio se o valor não é válido. */
export function textoDiarias(valor: number) {
  if (!Number.isFinite(valor) || valor <= 0) return "";
  const q = quantidadeDiarias(valor);
  return Number.isInteger(q) ? String(q) : q.toFixed(2).replace(".", ",");
}
