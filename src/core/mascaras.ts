const digitos = (s: string) => s.replace(/\D/g, "");

/** Máscara progressiva: 000.000.000-00 */
export function formataCpf(valor: string) {
  const d = digitos(valor).slice(0, 11);
  let r = d.slice(0, 3);
  if (d.length > 3) r += "." + d.slice(3, 6);
  if (d.length > 6) r += "." + d.slice(6, 9);
  if (d.length > 9) r += "-" + d.slice(9, 11);
  return r;
}

/** Valida CPF pelos dígitos verificadores. */
export function cpfValido(valor: string) {
  const d = digitos(valor);
  if (d.length !== 11 || /^(\d)\1+$/.test(d)) return false;
  const verificador = (n: number) => {
    let soma = 0;
    for (let i = 0; i < n; i++) soma += Number(d[i]) * (n + 1 - i);
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };
  return verificador(9) === Number(d[9]) && verificador(10) === Number(d[10]);
}

/** Máscara: 00000-000 */
export function formataCep(valor: string) {
  const d = digitos(valor).slice(0, 8);
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
}

/** Remove o código do país apenas de números completos em formato internacional. */
export function telefoneNacional(valor: string) {
  const d = digitos(valor);
  return d.startsWith("55") && (d.length === 12 || d.length === 13) ? d.slice(2) : d;
}

/** Máscara: (85) 90000-0000 */
export function formataTelefone(valor: string) {
  const d = telefoneNacional(valor).slice(0, 11);
  if (d.length === 0) return "";
  if (d.length <= 2) return `(${d}`;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

export function telefoneValido(valor: string) {
  const n = telefoneNacional(valor).length;
  return n === 10 || n === 11;
}

export function cepValido(valor: string) {
  return digitos(valor).length === 8;
}
