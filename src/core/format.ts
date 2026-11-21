const moedaFmt = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export const moeda = (v: number) => moedaFmt.format(v);

export function dataCurta(iso: string) {
  const [a, m, d] = iso.split("-");
  return a && m && d ? `${d}/${m}/${a}` : iso;
}

export function hoje() {
  const d = new Date();
  const mes = String(d.getMonth() + 1).padStart(2, "0");
  const dia = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mes}-${dia}`;
}

export function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

/** Converte "1.234,56" ou "1234.56" em número; NaN se inválido. */
export function lerValor(texto: string) {
  const limpo = texto.trim().replace(/\s/g, "");
  const normalizado = limpo.includes(",") ? limpo.replace(/\./g, "").replace(",", ".") : limpo;
  return Number(normalizado);
}
