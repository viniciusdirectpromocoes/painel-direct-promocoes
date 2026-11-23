import { pendenteDaDiaria } from './regras';
import type { Lancamento, ReferenciaPagamento } from './types';

type Alocacao = { diariaId: string; valor: number };

/** Arredonda para centavos, evitando erros de ponto flutuante. */
export const centavos = (n: number) => Math.round(n * 100) / 100;

/**
 * Desconta um valor das diárias pendentes da diarista, começando pela mais antiga.
 * Devolve as alocações feitas, quanto foi descontado e quanto sobrou.
 */
export function alocarNasDiarias(lancamentos: Lancamento[], diaristaId: string, valor: number, referencia?: ReferenciaPagamento) {
  const dias = new Set(referencia?.dias);
  const pendentes = lancamentos
    .filter((l) => l.categoria === "Diárias" && l.diaristaId === diaristaId && pendenteDaDiaria(l) > 0)
    .filter((l) => !referencia?.lojaId || l.lojaId === referencia.lojaId)
    .filter((l) => dias.size === 0 || (l.diasTrabalhados.length > 0 && l.diasTrabalhados.every((dia) => dias.has(dia))))
    .sort((a, b) => (a.diasTrabalhados[0] ?? "").localeCompare(b.diasTrabalhados[0] ?? ""));

  let restante = centavos(valor);
  const alocacoes: Alocacao[] = [];
  for (const d of pendentes) {
    if (restante <= 0) break;
    const tirar = centavos(Math.min(pendenteDaDiaria(d), restante));
    alocacoes.push({ diariaId: d.id, valor: tirar });
    restante = centavos(restante - tirar);
  }
  return { alocacoes, descontado: centavos(valor - restante), restante };
}

/** Soma uma alocação de volta nas diárias. */
export function aplicarAlocacoes(lancamentos: Lancamento[], alocacoes: Alocacao[]) {
  return lancamentos.map((x) => {
    const a = alocacoes.find((y) => y.diariaId === x.id);
    return a ? { ...x, pagoValor: centavos((x.pagoValor ?? 0) + a.valor) } : x;
  });
}

/** Tira uma alocação das diárias (usado ao excluir ou editar). */
export function reverterAlocacoes(lancamentos: Lancamento[], alocacoes: Alocacao[]) {
  return lancamentos.map((x) => {
    const a = alocacoes.find((y) => y.diariaId === x.id);
    return a ? { ...x, pagoValor: centavos(Math.max(0, (x.pagoValor ?? 0) - a.valor)) } : x;
  });
}

