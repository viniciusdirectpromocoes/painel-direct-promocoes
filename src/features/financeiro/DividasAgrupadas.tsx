import { centavos } from "../../core/financeiro";
import { dataCurta, moeda } from "../../core/format";
import type { Diarista, Lancamento } from "../../core/types";

type GrupoDividas = { chave: string; nome: string; itens: Lancamento[] };
type LinhaFinanceira = { lancamento: Lancamento } | { grupo: GrupoDividas };

const normalizar = (texto: string) => texto.trim().replace(/\s+/g, " ").normalize("NFD")
  .replace(/\p{Diacritic}/gu, "").toLocaleLowerCase("pt-BR");

export function agruparDividas(lista: Lancamento[], diaristas: Diarista[]): LinhaFinanceira[] {
  const porId = new Map(diaristas.map((diarista) => [diarista.id, diarista.nome]));
  const porNome = new Map<string, string | null>();
  for (const { id, nome } of diaristas) {
    const chave = normalizar(nome);
    porNome.set(chave, porNome.has(chave) ? null : id);
  }

  const linhas: LinhaFinanceira[] = [];
  const grupos = new Map<string, GrupoDividas>();
  for (const lancamento of lista) {
    if (lancamento.categoria !== "Dívida") {
      linhas.push({ lancamento });
      continue;
    }
    const nomeInformado = normalizar(lancamento.descricao);
    const id = lancamento.diaristaId || porNome.get(nomeInformado);
    const chave = id ? `diarista:${id}` : `nome:${nomeInformado || lancamento.id}`;
    const existente = grupos.get(chave);
    if (existente) {
      existente.itens.push(lancamento);
    } else {
      const nome = (id && porId.get(id)) || lancamento.descricao;
      const grupo = { chave, nome, itens: [lancamento] };
      grupos.set(chave, grupo);
      linhas.push({ grupo });
    }
  }
  return linhas;
}

type Acoes = {
  pagar: (id: string) => void;
  editar: (item: Lancamento) => void;
  excluir: (item: Lancamento) => void;
};

function AcoesDivida({ item, pagar, editar, excluir }: Acoes & { item: Lancamento }) {
  return (
    <div className="acoes-card financeiro-acoes-divida">
      {!item.pagoEm && (
        <button type="button" className="botao primario mini" onClick={() => pagar(item.id)}>Já paguei</button>
      )}
      <button type="button" className="link" onClick={() => editar(item)}>Editar</button>
      <button type="button" className="link perigo" onClick={() => excluir(item)}>Excluir</button>
    </div>
  );
}

export function DividasAgrupadas({ grupo, ...acoes }: Acoes & { grupo: GrupoDividas }) {
  const porRede = new Map<string, { nome: string; valor: number }>();
  let total = 0;
  let pendente = 0;
  for (const item of grupo.itens) {
    const nome = item.rede?.trim() || "Sem rede";
    const chave = normalizar(nome);
    const soma = porRede.get(chave);
    porRede.set(chave, { nome: soma?.nome ?? nome, valor: centavos((soma?.valor ?? 0) + item.valor) });
    total = centavos(total + item.valor);
    if (!item.pagoEm) pendente = centavos(pendente + item.valor);
  }
  const item = grupo.itens[0];
  const grupoUnico = grupo.itens.length === 1;

  return (
    <li className="linha financeiro-grupo-dividas">
      <span className={`bolinha ${pendente > 0 ? "amber" : "lime"}`} />
      <div className="linha-texto">
        <div className="financeiro-total-divida">
          <strong>{grupo.nome}</strong>
          <strong className="nowrap">Total {moeda(total)}</strong>
        </div>
        <dl className="financeiro-redes-divida" aria-label="Valores por rede">
          {[...porRede.entries()].map(([chave, rede]) => (
            <div key={chave}>
              <dt>{rede.nome}</dt>
              <dd className="nowrap">{moeda(rede.valor)}</dd>
            </div>
          ))}
        </dl>
        <span className={`status ${pendente > 0 ? "pendente" : "pago"}`}>
          {pendente === 0
            ? grupoUnico ? `Pago em ${dataCurta(item.pagoEm ?? "")}` : "Pago"
            : pendente === total ? "Pendente de pagamento" : `${moeda(pendente)} em aberto · ${moeda(centavos(total - pendente))} pagos`}
        </span>
        {grupoUnico ? <AcoesDivida item={item} {...acoes} /> : (
          <details className="financeiro-detalhes-divida">
            <summary>Ver {grupo.itens.length} lançamentos</summary>
            <ul className="lista">
              {grupo.itens.map((divida) => (
                <li key={divida.id}>
                  <div className="financeiro-total-divida">
                    <strong>{divida.rede || "Sem rede"}</strong>
                    <span className="nowrap">{moeda(divida.valor)}</span>
                  </div>
                  <span className="muted">
                    {divida.pagoEm ? `Pago em ${dataCurta(divida.pagoEm)}` : `Em aberto · ${dataCurta(divida.data)}`}
                  </span>
                  <AcoesDivida item={divida} {...acoes} />
                </li>
              ))}
            </ul>
          </details>
        )}
      </div>
    </li>
  );
}
