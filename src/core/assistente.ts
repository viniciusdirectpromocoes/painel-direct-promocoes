import { lerValor } from "./format";
import { chaveOperacao, setoresDoPedido } from "./operacao";
import type { Dados, Loja } from "./types";

export type RascunhoPedido = {
  tipo: "pedido";
  lojaId: string;
  setor: string;
  inicioHora: string;
  fimHora: string;
  datas: string[];
  quantidadeDiaristas: number;
  diasInformados?: number;
};
export type RascunhoPagamento = {
  tipo: "pagamento";
  diaristaId: string;
  valor: string;
  data: string;
  lojaId: string;
  dias: string[];
  quantidade: string;
};
export type Rascunho = RascunhoPedido | RascunhoPagamento;
export type TipoRascunho = Rascunho["tipo"];

const textoChave = (valor: string) => chaveOperacao(valor).replace(/[^a-z0-9]+/g, " ").trim();
const contem = (texto: string, termo: string) => termo.length > 0 && (" " + texto + " ").includes(" " + termo + " ");
const dataPadrao = new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Sao_Paulo", dateStyle: "short" });
export const hojeAssistente = () => dataPadrao.format(new Date());
const iso = (data: Date) => data.toISOString().slice(0, 10);
const avancaDia = (data: Date) => new Date(data.getTime() + 86_400_000);

function dataValida(ano: number, mes: number, dia: number) {
  const data = new Date(Date.UTC(ano, mes - 1, dia));
  return data.getUTCFullYear() === ano && data.getUTCMonth() === mes - 1 && data.getUTCDate() === dia ? data : null;
}

function lerData(valor: string, referencia: Date, avancar = false) {
  const [dia, mes, ano] = valor.split("/").map(Number);
  const baseAno = referencia.getUTCFullYear();
  const baseMes = referencia.getUTCMonth() + 1;
  if (ano) return dataValida(ano < 100 ? 2000 + ano : ano, mes, dia);
  if (mes) return dataValida(avancar && mes < baseMes ? baseAno + 1 : baseAno, mes, dia);
  if (avancar && dia < referencia.getUTCDate()) {
    const proximo = new Date(Date.UTC(baseAno, baseMes, 1));
    return dataValida(proximo.getUTCFullYear(), proximo.getUTCMonth() + 1, dia);
  }
  return dataValida(baseAno, baseMes, dia);
}

function diasDoPeriodo(inicio: Date, fim: Date) {
  if (fim < inicio || (fim.getTime() - inicio.getTime()) / 86_400_000 >= 366) return [];
  const dias: string[] = [];
  for (let dia = inicio; dia <= fim; dia = avancaDia(dia)) dias.push(iso(dia));
  return dias;
}

function lojaEncontrada(texto: string, lojas: Loja[]) {
  const palavras = textoChave(texto);
  const candidatas = lojas.map((loja) => {
    const rede = textoChave(loja.rede);
    const nome = textoChave(loja.nome);
    const partesRede = rede.replace(/^super\s+/, "");
    const apelido = nome.replace(/^(loja|cidade|unidade)\s+/, "");
    const redeExata = contem(palavras, rede);
    const redeCurta = partesRede !== rede && contem(palavras, partesRede);
    const nomeExato = contem(palavras, nome);
    const apelidoExato = apelido !== nome && contem(palavras, apelido);
    const pontos = nomeExato ? 5 + (redeExata ? 6 : redeCurta ? 3 : 0) : apelidoExato && (redeExata || redeCurta) ? 8 : 0;
    return { loja, pontos };
  }).filter((c) => c.pontos > 0).sort((a, b) => b.pontos - a.pontos);
  return candidatas[0] && candidatas[0].pontos !== candidatas[1]?.pontos ? candidatas[0].loja.id : "";
}

function buscarSetor(texto: string, dados: Dados) {
  const chaves = textoChave(texto).replace(/\brepositores\b/g, "repositor").replace(/\bbalconistas\b/g, "balconista");
  const setor = [...setoresDoPedido(dados.setoresPedidosExtras)]
    .sort((a, b) => b.length - a.length)
    .find((nome) => contem(chaves, textoChave(nome)) ||
      (nome === "Hortifruti (FLV)" && /\b(flv|hortifruti|horti fruti)\b/.test(chaves)) ||
      (nome.startsWith("Balconista de ") && contem(chaves, textoChave(nome.replace("Balconista", "Balcão")))));
  return setor ?? "";
}

function lerHorario(texto: string) {
  const horas = [...texto.matchAll(/\b([01]?\d|2[0-3])\s*(?::([0-5]\d)|h(?:oras?)?\s*([0-5]\d)?)(?:\s*(?:da|de)\s+(manha|tarde|noite))?/g)];
  return horas.slice(0, 2).map((m) => {
    const hora = Number(m[1]);
    const h = (m[4] === "tarde" || m[4] === "noite") && hora < 12 ? hora + 12 : hora;
    return String(h).padStart(2, "0") + ":" + (m[2] ?? m[3] ?? "00");
  });
}

const DATA_LIVRE = "\\d{1,2}(?:\\s*\\/\\s*\\d{1,2}(?:\\s*\\/\\s*\\d{2,4})?)?";

export function interpretar(texto: string, tipo: TipoRascunho, dados: Dados, hoje = hojeAssistente()): Rascunho {
  const normal = chaveOperacao(texto).replace(/\*/g, "");
  const referencia = new Date(hoje + "T00:00:00Z");
  const lojaId = lojaEncontrada(texto, dados.lojas);
  if (tipo === "pedido") {
    const inicioComDuracao = normal.match(new RegExp("(?<![\\d/:])(" + DATA_LIVRE + ")\\s*[-–]\\s*(\\d{1,3})[ \\t]+dias\\b"));
    const diasDeclarados = normal.match(/\bquantidade\s+de\s+dias\s*:\s*(\d{1,3})\b/)?.[1];
    const duracao = inicioComDuracao?.[2] ?? normal.match(/(?<![\d/:h])(\d{1,3})[ \t]+dias\b/)?.[1];
    const diasInformados = diasDeclarados || duracao ? Number(diasDeclarados ?? duracao) : undefined;
    const periodo = inicioComDuracao ? null : normal.match(new RegExp("(?<![\\d/:])(" + DATA_LIVRE + ")\\s*(?:ate\\s+(?:o\\s+)?(?:dia\\s+)?|a\\s+|[-–]\\s*)(" + DATA_LIVRE + ")(?![\\d/:]|\\s*[:h]\\d|\\s+dias\\b)"));
    const inicioUnico = inicioComDuracao ??
      normal.match(new RegExp("(?:data(?:\\s+de)?\\s+inicio|dias?|inicio)\\s*:?\\s*(" + DATA_LIVRE + ")\\b"));
    const inicio = (periodo || inicioUnico) && lerData((periodo?.[1] ?? inicioUnico?.[1] ?? "").replace(/\s/g, ""), referencia);
    const fim = inicio && (periodo
      ? lerData(periodo[2].replace(/\s/g, ""), inicio, true)
      : new Date(inicio.getTime() + ((duracao ? Number(duracao) : diasInformados ?? 1) - 1) * 86_400_000));
    const [inicioHora = "", fimHora = ""] = lerHorario(normal);
    const pessoas = normal.match(/(?:funcao\s*:\s*)\b(\d{1,2})\s+[a-z]|\b(\d{1,2})\s+(?:diaristas?|repositores|balconistas)\b/);
    return { tipo, lojaId, setor: buscarSetor(texto, dados), inicioHora, fimHora, datas: inicio && fim ? diasDoPeriodo(inicio, fim) : [], quantidadeDiaristas: Number(pessoas?.[1] ?? pessoas?.[2] ?? 1), diasInformados };
  }
  const valor = normal.match(/(?:r\$\s*)?(\d{1,3}(?:\.\d{3})+,\d{2}|\d+[,.]\d{2})(?!\d)/)?.[1] ??
    normal.match(/(?:\br\$\s*|\bvalor\s*:\s*|-\s*)(\d+)(?![\d/])/)?.[1] ?? "";
  const chaves = textoChave(texto);
  const nomes = dados.diaristas.map((d) => {
    const nome = textoChave(d.nome);
    const partes = nome.split(" ");
    const abreviacoes = partes.length > 2 ? [partes.slice(0, 2).join(" "), partes[0] + " " + partes[partes.length - 1]] : [];
    const pontos = contem(chaves, nome) ? 10 + partes.length : abreviacoes.some((parte) => contem(chaves, parte)) ? 5 : 0;
    return { id: d.id, pontos };
  }).filter((d) => d.pontos > 0).sort((a, b) => b.pontos - a.pontos);
  const pagamentoEm = normal.match(/(?:data\s+(?:do\s+)?pagamento|pago\s+em)\s*:?\s*(\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)/);
  const data = pagamentoEm ? lerData(pagamentoEm[1], referencia) : referencia;
  const textoDias = pagamentoEm ? normal.replace(pagamentoEm[0], "") : normal;
  const dias = [...new Set([...textoDias.matchAll(/\b(\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)\b/g)]
    .map((m) => lerData(m[1], referencia)).filter((d): d is Date => d !== null).map(iso))].sort();
  const quantidade = normal.match(/\b(\d+)\s+diarias?\b/)?.[1] ?? "";
  return { tipo, diaristaId: nomes[0] && nomes[0].pontos !== nomes[1]?.pontos ? nomes[0].id : "", valor: valor && lerValor(valor) > 0 ? valor : "", data: data ? iso(data) : "", lojaId, dias, quantidade };
}
