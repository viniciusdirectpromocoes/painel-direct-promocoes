import type { Dados, Pagina } from "../../core/types";
import { AnimatedNumber } from "../../components/AnimatedNumber";
import { dataCurta, moeda } from "../../core/format";
import { disponivel, pendenteDaDiaria, quantidadeDiarias } from "../../core/regras";
import { VALOR_DIARIA } from "../../core/constants";

type Props = { dados: Dados; irPara: (p: Pagina) => void };

export function Painel({ dados, irPara }: Props) {
  const entradas = dados.lancamentos
    .filter((l) => l.categoria === "Recebimento")
    .reduce((s, l) => s + l.valor, 0);
  const saidas = dados.lancamentos
    .filter((l) => l.categoria === "Pagamento" || l.categoria === "Adiantamento")
    .reduce((s, l) => s + l.valor, 0);
  const disponiveis = dados.diaristas.filter(disponivel).length;
  const nomes = new Map(dados.diaristas.map((d) => [d.id, d.nome]));
  const porPessoa = new Map<string, { nome: string; valor: number; registros: number }>();
  let pagamentosPendentes = 0;
  let totalDiariasAPagar = 0;

  for (const diaria of dados.lancamentos) {
    if (diaria.categoria !== "Diárias") continue;
    totalDiariasAPagar += diaria.valor;
    const restante = pendenteDaDiaria(diaria);
    if (restante === 0) continue;
    pagamentosPendentes += restante;

    const chave = diaria.diaristaId ?? diaria.id;
    const pessoa = porPessoa.get(chave) ?? {
      nome: (diaria.diaristaId && nomes.get(diaria.diaristaId)) || diaria.descricao || "Diarista não identificada",
      valor: 0,
      registros: 0,
    };
    pessoa.valor += restante;
    pessoa.registros += 1;
    porPessoa.set(chave, pessoa);
  }
  const pendencias = [...porPessoa.entries()].sort((a, b) => b[1].valor - a[1].valor);
  const formatarQuantidade = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 }).format;
  const formatarDiarias = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 }).format;

  // Lançamentos novos entram no começo da lista (ver upsert em core/store.ts).
  const recentes = dados.lancamentos.slice(0, 5);

  const kpis = [
    { rotulo: "Entrada", valor: entradas, formatar: moeda, cor: "lime", detalhe: "Recebido da Direct" },
    { rotulo: "Saída", valor: saidas, formatar: moeda, cor: "red", detalhe: "Pagamentos e adiantamentos" },
    { rotulo: "Pagamentos pendentes", valor: pagamentosPendentes, formatar: moeda, cor: "orange", detalhe: "Valor de diárias a pagar" },
    { rotulo: "Saldo de caixa", valor: entradas - saidas, formatar: moeda, cor: "blue", detalhe: "Entradas menos saídas" },
    { rotulo: "Diárias atendidas", valor: quantidadeDiarias(totalDiariasAPagar), formatar: formatarDiarias, cor: "pink", detalhe: `Diárias registradas a ${moeda(VALOR_DIARIA)} cada` },
    { rotulo: "Diaristas disponíveis", valor: disponiveis, formatar: formatarQuantidade, cor: "cyan", detalhe: `De ${formatarQuantidade(dados.diaristas.length)} cadastrados` },
  ] as const;

  return (
    <section>
      <header className="cabeca rise">
        <h1>Painel</h1>
        <p className="muted">Resumo da operação e do caixa, com todos os lançamentos registrados.</p>
      </header>

      <div className="kpis kpis-3 painel-resumo">
        {kpis.map((k, i) => (
          <article key={k.rotulo} className={`kpi kpi-${k.cor} rise`} style={{ animationDelay: `${i * 70}ms` }}>
            <span className="kpi-rotulo">{k.rotulo}</span>
            <strong className="kpi-valor">
              <AnimatedNumber value={k.valor} format={k.formatar} />
            </strong>
            <span className="painel-kpi-detalhe">{k.detalhe}</span>
          </article>
        ))}
      </div>

      <div className="grade-2 painel-secoes">
        <section className="painel rise" style={{ animationDelay: "280ms" }}>
          <div className="painel-topo">
            <h2>Pendências por pessoa</h2>
          </div>
          {pendencias.length === 0 ? (
            <p className="vazio">Nenhuma diária com pagamento em aberto.</p>
          ) : (
            <>
              <ul className="lista">
                {pendencias.slice(0, 5).map(([chave, pessoa]) => (
                  <li key={chave} className="linha">
                    <div className="linha-texto">
                      <strong>{pessoa.nome}</strong>
                      <span className="muted">{pessoa.registros} {pessoa.registros === 1 ? "lançamento em aberto" : "lançamentos em aberto"}</span>
                    </div>
                    <strong className="nowrap">{moeda(pessoa.valor)}</strong>
                  </li>
                ))}
              </ul>
              {pendencias.length > 5 && (
                <button type="button" className="link" onClick={() => irPara("financeiro")}>
                  Ver mais no Financeiro
                </button>
              )}
            </>
          )}
        </section>
        <section className="painel rise" style={{ animationDelay: "360ms" }}>
          <div className="painel-topo">
            <h2>Últimos lançamentos</h2>
            <button type="button" className="link" onClick={() => irPara("financeiro")}>
              Ver todos
            </button>
          </div>
          {recentes.length === 0 ? (
            <p className="vazio">Nenhum lançamento ainda. Registre uma entrada ou saída no Financeiro.</p>
          ) : (
            <ul className="lista">
              {recentes.map((l) => (
                <li key={l.id} className="linha">
                  <span className={`bolinha ${l.categoria === "Recebimento" ? "lime" : l.categoria === "Pagamento" ? "amber" : "cyan"}`} />
                  <div className="linha-texto">
                    <strong>{l.descricao}</strong>
                    <span className="muted">
                      {l.categoria}
                      {l.categoria === "Diárias" ? ` · dia ${l.diaPagamento}` : ` · ${dataCurta(l.data)}`}
                    </span>
                  </div>
                  <span className={l.categoria === "Recebimento" ? "pos" : (l.categoria === "Pagamento" || l.categoria === "Adiantamento") ? "neg" : "muted"}>
                    {l.categoria === "Recebimento" ? "+" : (l.categoria === "Pagamento" || l.categoria === "Adiantamento") ? "−" : ""} {moeda(l.valor)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

      </div>
    </section>
  );
}
