import type { Loja } from "./types";

const CORES_REDE = ["azul", "verde", "laranja", "roxo", "rosa", "ciano"] as const;
export type CorRede = (typeof CORES_REDE)[number];

export function redesDasLojas(lojas: Loja[]) {
  const porRede = new Map<string, number>();
  for (const loja of lojas) {
    const nome = loja.rede.trim();
    if (nome) porRede.set(nome, (porRede.get(nome) ?? 0) + 1);
  }
  return [...porRede.entries()]
    .sort(([a], [b]) => a.localeCompare(b, "pt-BR"))
    .map(([nome, quantidade], indice) => ({
      nome,
      quantidade,
      cor: CORES_REDE[indice % CORES_REDE.length],
    }));
}
