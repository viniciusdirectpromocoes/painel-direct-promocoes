import { useId, useState } from "react";
import { centavos, valorEmAberto, valorPagoDaDivida } from "../../core/financeiro";
import { dataCurta, moeda } from "../../core/format";
import type { CorRede } from "../../core/redes";
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
  pagar: (item: Lancamento) => void;
  editar: (item: Lancamento) => void;
  excluir: (item: Lancamento) => void;
};

function AcoesDivida({ item, pagar, editar, excluir }: Acoes & { item: Lancamento }) {
  return (
    <div className="acoes-card financeiro-acoes-divida">
      {valorEmAberto(item) > 0 && (
        <button type="button" className="botao primario mini" onClick={() => pagar(item)}>Já paguei</button>
      )}
      <button type="button" className="link" onClick={() => editar(item)}>Editar</button>
      <button type="button" className="link perigo" onClick={() => excluir(item)}>Excluir</button>
    </div>
  );
}

export function DividasAgrupadas({ grupo, coresDasRedes, visao, ...acoes }: Acoes & {
  grupo: GrupoDividas;
  coresDasRedes: ReadonlyMap<string, CorRede>;
  visao: "todos" | "pendentes" | "pagos";
}) {
  const [aberto, setAberto] = useState(false);
  const detalhesId = useId();
  const porRede = new Map<string, { nome: string; valor: number; cor?: CorRede }>();
  let total = 0;
  let pendente = 0;
  const valorExibido = (item: Lancamento) => visao === "pendentes" ? valorEmAberto(item) :
    visao === "pagos" ? valorPagoDaDivida(item) : item.valor;
  for (const item of grupo.itens) {
    const redeCadastrada = item.rede?.trim();
    const nome = redeCadastrada || "Sem rede";
    const chave = normalizar(nome);
    const soma = porRede.get(chave);
    const cor = redeCadastrada ? coresDasRedes.get(redeCadastrada) : undefined;
    porRede.set(chave, {
      nome: soma?.nome ?? nome,
      valor: centavos((soma?.valor ?? 0) + valorExibido(item)),
      cor: soma?.cor ?? cor,
    });
    total = centavos(total + item.valor);
    pendente = centavos(pendente + valorEmAberto(item));
  }
  const item = grupo.itens[0];
  const grupoUnico = grupo.itens.length === 1;
  const situacao = pendente === 0 ? "pago" : pendente === total ? "pendente" : "parcial";
  const pago = centavos(total - pendente);
  const totalExibido = visao === "pendentes" ? pendente : visao === "pagos" ? pago : total;
  const rotuloTotal = visao === "pendentes" || situacao === "pendente" ? "A pagar" :
    visao === "pagos" || situacao === "pago" ? "Total pago" : "Total";
  const rotulo = { pago: "Pago", pendente: "Em aberto", parcial: "Parcialmente pago" }[situacao];
  const cabecalho = (
    <>
      <span className="financeiro-divida-identidade">
        <strong>{grupo.nome}</strong>
        <span className={`financeiro-divida-status ${situacao}`}>{rotulo}</span>
      </span>
      <span className="financeiro-divida-total">
        <span>{rotuloTotal}</span>
        <strong>{moeda(totalExibido)}</strong>
      </span>
    </>
  );

  return (
    <li className="financeiro-grupo-dividas" data-open={aberto}>
      {grupoUnico ? (
        <div className="financeiro-divida-cabecalho">{cabecalho}</div>
      ) : (
        <button
          type="button"
          className="financeiro-divida-cabecalho"
          aria-expanded={aberto}
          aria-controls={detalhesId}
          onClick={() => setAberto(!aberto)}
        >
          {cabecalho}
          <span className="financeiro-divida-seta" aria-hidden="true" />
        </button>
      )}
      {situacao === "parcial" && (
        <p className="financeiro-divida-rodape">{moeda(pendente)} em aberto · {moeda(pago)} pagos</p>
      )}
      <dl className="financeiro-redes-divida" aria-label="Valores por rede">
        {[...porRede.entries()].map(([chave, rede]) => (
          <div key={chave} data-cor-rede={rede.cor}>
            <dt title={rede.nome}>{rede.nome}</dt>
            <dd>{moeda(rede.valor)}</dd>
          </div>
        ))}
      </dl>
      {grupoUnico ? (
        <div className="financeiro-divida-rodape">
          {item.pagoEm && <span>Pago em {dataCurta(item.pagoEm)}</span>}
          <AcoesDivida item={item} {...acoes} />
        </div>
      ) : (
        <div className="financeiro-detalhes-divida" id={detalhesId} aria-hidden={!aberto}>
          <div className="financeiro-detalhes-conteudo">
            <ul className="lista financeiro-detalhes-lista" aria-label="Lançamentos individuais">
              {grupo.itens.map((divida) => (
                <li key={divida.id}>
                  <div className="financeiro-detalhes-identidade">
                    <div>
                      <strong>{divida.rede || "Sem rede"}</strong>
                      <span className="muted">
                        {divida.pagoEm ? `Pago em ${dataCurta(divida.pagoEm)}` :
                          valorPagoDaDivida(divida) > 0 ? `${moeda(valorPagoDaDivida(divida))} pagos · ${moeda(valorEmAberto(divida))} em aberto` :
                          `Em aberto · ${dataCurta(divida.data)}`}
                      </span>
                    </div>
                    <strong>{moeda(valorExibido(divida))}</strong>
                  </div>
                  <AcoesDivida item={divida} {...acoes} />
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </li>
  );
}
