import type { Dados, Pagina } from "../../core/types";
import { AnimatedNumber } from "../../components/AnimatedNumber";
import { dataCurta, moeda } from "../../core/format";
import { disponivel } from "../../core/regras";

type Props = { dados: Dados; irPara: (p: Pagina) => void };

export function Painel({ dados, irPara }: Props) {
  const entradas = dados.lancamentos
    .filter((l) => l.categoria === "Recebimento")
    .reduce((s, l) => s + l.valor, 0);
  const saidas = dados.lancamentos
    .filter((l) => l.categoria === "Pagamento" || l.categoria === "Adiantamento")
    .reduce((s, l) => s + l.valor, 0);
  const saldo = entradas - saidas;
  const disponiveis = dados.diaristas.filter(disponivel).length;

  // Lançamentos novos entram no começo da lista (ver upsert em core/store.ts).
  const recentes = dados.lancamentos.slice(0, 5);

  const kpis = [
    { rotulo: "Saldo", valor: saldo, tipo: "moeda", cor: "pink" },
    { rotulo: "Entradas", valor: entradas, tipo: "moeda", cor: "lime" },
    { rotulo: "Saídas", valor: saidas, tipo: "moeda", cor: "amber" },
    { rotulo: "Diaristas disponíveis", valor: disponiveis, tipo: "numero", cor: "cyan" },
  ] as const;

  return (
    <section>
      <header className="cabeca rise">
        <h1>Painel</h1>
        <p className="muted">Visão geral do seu negócio.</p>
      </header>

      <div className="kpis">
        {kpis.map((k, i) => (
          <article key={k.rotulo} className={`kpi kpi-${k.cor} rise`} style={{ animationDelay: `${i * 70}ms` }}>
            <span className="kpi-rotulo">{k.rotulo}</span>
            <strong className="kpi-valor">
              <AnimatedNumber
                value={k.valor}
                format={k.tipo === "moeda" ? moeda : (n) => Math.round(n).toString()}
              />
            </strong>
          </article>
        ))}
      </div>

      <div className="grade-2">
        <section className="painel rise" style={{ animationDelay: "280ms" }}>
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

        <section className="painel rise" style={{ animationDelay: "360ms" }}>
          <div className="painel-topo">
            <h2>Cadastros</h2>
          </div>
          <div className="atalhos">
            <button type="button" className="atalho pink" onClick={() => irPara("diaristas")}>
              <strong>{dados.diaristas.length}</strong>
              <span>diaristas</span>
            </button>
            <button type="button" className="atalho cyan" onClick={() => irPara("lojas")}>
              <strong>{dados.lojas.length}</strong>
              <span>lojas</span>
            </button>
          </div>
        </section>
      </div>
    </section>
  );
}
