import { moeda } from "../../core/format";
import { setorPadraoDoPedido } from "../../core/operacao";
import type { Dados } from "../../core/types";

const percentual = new Intl.NumberFormat("pt-BR", { style: "percent", maximumFractionDigits: 1 });

function ValoresTarifa({ recebe, paga }: { recebe: number; paga: number }) {
  const lucro = recebe - paga;
  return (
    <dl className="operacao-valores">
      <div className="operacao-valor receber"><dt>A receber</dt><dd>{moeda(recebe / 100)}</dd></div>
      <div className="operacao-valor repasse"><dt>Repasse</dt><dd>{moeda(paga / 100)}</dd></div>
      <div className="operacao-valor lucro"><dt>Lucro bruto</dt><dd>{moeda(lucro / 100)}</dd></div>
      <div className="operacao-valor margem"><dt>Margem</dt><dd>{recebe > 0 ? percentual.format(lucro / recebe) : "—"}</dd></div>
    </dl>
  );
}

export function Operacao({ dados }: { dados: Dados }) {
  const redes = [...dados.tarifasRedes].sort((a, b) => a.rede.localeCompare(b.rede, "pt-BR"));
  const setores = [...dados.tarifasSetores].sort((a, b) => a.setor.localeCompare(b.setor, "pt-BR"));
  const totais = redes.reduce((total, tarifa) => ({
    recebe: total.recebe + tarifa.recebe,
    paga: total.paga + tarifa.paga,
  }), { recebe: 0, paga: 0 });

  return (
    <section>
      <header className="cabeca rise">
        <h1>Operação</h1>
        <p className="muted">Tarifas e margem bruta por diária.</p>
      </header>
      <div className="operacao-grade">
        <section className="painel rise">
          <h2>Tarifas por rede</h2>
          {redes.length === 0 ? <p className="vazio">Nenhuma tarifa de rede disponível nesta conta.</p> : (
            <>
              <div className="operacao-total">
                <div>
                  <strong>Total das tarifas</strong>
                  <p className="muted">Soma de uma diária padrão por rede.</p>
                </div>
                <ValoresTarifa {...totais} />
              </div>
              <ul className="lista operacao-redes">
                {redes.map((tarifa) => (
                  <li className="operacao-linha" key={tarifa.rede}>
                    <strong>{tarifa.rede}</strong>
                    <ValoresTarifa recebe={tarifa.recebe} paga={tarifa.paga} />
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
        <section className="painel rise">
          <h2>Repasse por setor</h2>
          <p className="muted">Valores por diária. Quando houver um valor por setor, ele tem prioridade sobre o padrão da rede.</p>
          {setores.length === 0 ? <p className="vazio">Nenhum repasse por setor disponível nesta conta.</p> : (
            <ul className="operacao-setores">
              {setores.map((tarifa) => (
                <li className="operacao-setor" key={`${tarifa.rede ?? ""}:${tarifa.setor}`}>
                  <strong>{setorPadraoDoPedido(tarifa.setor) || tarifa.setor}{tarifa.rede ? ` · ${tarifa.rede}` : ""}</strong>
                  <span className="operacao-valor repasse">{moeda(tarifa.paga / 100)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </section>
  );
}
