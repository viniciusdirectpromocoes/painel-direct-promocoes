import { SETORES } from "./constants";
import type { Dados } from "./types";

export const chaveOperacao = (nome: string) => nome.trim().normalize("NFD").replace(/\p{Diacritic}/gu, "").toLocaleLowerCase("pt-BR");
export function chaveSetor(nome: string) {
  const chave = chaveOperacao(nome);
  return /\b(flv|hortifruti|horti\s*fruti|hortifrut[íi]colas?)\b/.test(chave) ? "flv" : chave;
}

export const SETORES_PEDIDO = SETORES
  .filter((setor) => chaveOperacao(setor) !== "auxiliar de deposito")
  .map((setor) => chaveSetor(setor) === "flv" ? "Hortifruti (FLV)" : setor)
  .sort((a, b) => a.localeCompare(b, "pt-BR"));

export function setoresDoPedido(extras: string[]) {
  const setores = new Map(SETORES_PEDIDO.map((setor) => [chaveSetor(setor), setor]));
  for (const setor of extras) {
    const chave = chaveSetor(setor);
    if (chave && !setores.has(chave)) setores.set(chave, setor);
  }
  return [...setores.values()].sort((a, b) => a.localeCompare(b, "pt-BR"));
}

export function setorPadraoDoPedido(setor: string, opcoes = SETORES_PEDIDO) {
  return opcoes.find((opcao) => chaveSetor(opcao) === chaveSetor(setor)) ?? "";
}

export function tarifaDaOperacao(dados: Dados, rede: string, setor: string) {
  const redeNormalizada = chaveOperacao(rede);
  const daRede = dados.tarifasRedes.find((tarifa) => chaveOperacao(tarifa.rede) === redeNormalizada);
  const setores = dados.tarifasSetores.filter((tarifa) => chaveSetor(tarifa.setor) === chaveSetor(setor));
  const especifica = setores.find((tarifa) => tarifa.rede && chaveOperacao(tarifa.rede) === redeNormalizada);
  const geral = setores.find((tarifa) => !tarifa.rede);
  return { recebe: daRede?.recebe, paga: especifica?.paga ?? geral?.paga ?? daRede?.paga };
}

const DURACAO_JORNADA_MINUTOS = 7 * 60 + 20 + 60;

export function calcularHoraFim(inicio: string) {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(inicio)) return "";
  const [hora, minuto] = inicio.split(":").map(Number);
  const total = (hora * 60 + minuto + DURACAO_JORNADA_MINUTOS) % 1440;
  return [Math.floor(total / 60), total % 60].map((n) => String(n).padStart(2, "0")).join(":");
}
