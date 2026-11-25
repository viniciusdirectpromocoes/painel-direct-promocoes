import { centavos, alocarNasDiarias, aplicarAlocacoes, reverterAlocacoes, ehSaida, valorEmAberto } from "../../core/financeiro";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import type { Dados, CategoriaLancamento, Lancamento, SetDados, TipoAdiantamento } from "../../core/types";
import { upsert } from "../../core/store";
import { dataCurta, hoje, lerValor, moeda, uid } from "../../core/format";
import { FORMA_PAGAMENTO, SETORES, VALOR_DIARIA } from "../../core/constants";
import { textoDiarias, quantidadeDiarias, pendenteDaDiaria } from "../../core/regras";
import { AnimatedNumber } from "../../components/AnimatedNumber";
import { redesDasLojas } from "../../core/redes";
import { agruparDividas, DividasAgrupadas } from "./DividasAgrupadas";
import "../../styles/forms.css";

type Props = { dados: Dados; setDados: SetDados; notificar: (t: string) => void };

type Form = {
  categoria: CategoriaLancamento;
  diaristaId: string;
  nomeAvulso: string;
  lojaId: string;
  rede: string;
  setor: string;
  diasTrabalhados: string[];
  novoDia: string;
  valor: string;
  diaPagamento: string;
  data: string;
  tipoAdiantamento: "" | TipoAdiantamento;
};

const OPCOES: { valor: CategoriaLancamento; rotulo: string }[] = [
  { valor: "Diárias", rotulo: "Diárias" },
  { valor: "Recebimento", rotulo: "Recebimento da empresa" },
  { valor: "Pagamento", rotulo: "Pagamento a diarista" },
  { valor: "Adiantamento", rotulo: "Adiantamento" },
  { valor: "Dívida", rotulo: "Dívida a diarista" },
];

type Filtro = "todos" | CategoriaLancamento | "pendentes" | "pagos";

const FILTROS: { valor: Filtro; rotulo: string }[] = [
  { valor: "todos", rotulo: "Todos" },
  ...OPCOES.filter((opcao) => opcao.valor !== "Dívida"),
  { valor: "pendentes", rotulo: "Pendentes de pagamento" },
  { valor: "pagos", rotulo: "Já pagos" },
];

const TIPOS_ADIANTAMENTO: TipoAdiantamento[] = ["Passagem", "Diária"];

const vazio = (categoria: CategoriaLancamento = "Diárias"): Form => ({
  categoria,
  diaristaId: "",
  nomeAvulso: "",
  lojaId: "",
  rede: "",
  setor: "",
  diasTrabalhados: [],
  novoDia: "",
  valor: "",
  diaPagamento: "",
  data: hoje(),
  tipoAdiantamento: "",
});

const DIAS_DO_MES = Array.from({ length: 31 }, (_, i) => i + 1);

const dataSemAno = (iso: string) => {
  const [, m, d] = iso.split("-");
  return d && m ? `${d}/${m}` : iso;
};

/** Quanto uma diarista tem pendente, somando todas as suas diárias. */
function pendenteDaDiarista(lancamentos: Lancamento[], diaristaId: string) {
  return centavos(
    lancamentos
      .filter((l) => l.categoria === "Diárias" && l.diaristaId === diaristaId)
      .reduce((s, l) => s + pendenteDaDiaria(l), 0),
  );
}

export function Financeiro({ dados, setDados, notificar }: Props) {
  const [form, setForm] = useState<Form>(vazio);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [formAberto, setFormAberto] = useState(false);
  const [erro, setErro] = useState("");
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const [busca, setBusca] = useState("");

  const todosSetores = useMemo(() => [...SETORES, ...dados.setoresExtras], [dados.setoresExtras]);
  const coresDasRedes = useMemo(
    () => new Map(redesDasLojas(dados.lojas).map(({ nome, cor }) => [nome, cor])),
    [dados.lojas],
  );

  const recebido = useMemo(
    () => dados.lancamentos.filter((l) => l.categoria === "Recebimento").reduce((s, l) => s + l.valor, 0),
    [dados.lancamentos],
  );
  const pago = useMemo(
    () =>
      dados.lancamentos
        .filter(ehSaida)
        .reduce((s, l) => s + l.valor, 0),
    [dados.lancamentos],
  );
  const emAberto = useMemo(
    () =>
      dados.lancamentos.reduce((s, l) => s + valorEmAberto(l), 0),
    [dados.lancamentos],
  );

  const lista = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    const filtrados = dados.lancamentos
      .filter((l) => {
        if (filtro === "pendentes") return valorEmAberto(l) > 0;
        if (filtro === "pagos") return l.categoria === "Pagamento" || (l.categoria === "Dívida" && Boolean(l.pagoEm));
        return filtro === "todos" || l.categoria === filtro;
      })
      .filter((l) => [l.descricao, l.setor, l.rede].some((valor) => valor?.toLowerCase().includes(termo)))
      .sort((a, b) => (b.pagoEm || b.data || "").localeCompare(a.pagoEm || a.data || ""));
    return agruparDividas(filtrados, dados.diaristas);
  }, [dados.lancamentos, dados.diaristas, filtro, busca]);

  const valorNumerico = lerValor(form.valor);
  const diariasCalculadas = textoDiarias(valorNumerico);
  const naoMultiplo =
    Number.isFinite(valorNumerico) && valorNumerico > 0 && !Number.isInteger(quantidadeDiarias(valorNumerico));

  const pendenteDoForm = form.diaristaId ? pendenteDaDiarista(dados.lancamentos, form.diaristaId) : 0;

  const nomeLoja = (id?: string) => dados.lojas.find((l) => l.id === id)?.nome;
  const nomeDiarista = (id?: string) => dados.diaristas.find((d) => d.id === id)?.nome;

  // Fecha a janela com Esc.
  useEffect(() => {
    if (!formAberto) return;
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === "Escape") fecharForm();
    };
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, [formAberto]);

  function atualizar<K extends keyof Form>(campo: K, valor: Form[K]) {
    setForm((f) => ({ ...f, [campo]: valor }));
  }

  function trocarCategoria(c: CategoriaLancamento) {
    setErro("");
    setForm((f) => ({ ...vazio(c), data: f.data }));
  }

  function adicionarDia() {
    if (!form.novoDia) return;
    if (form.diasTrabalhados.includes(form.novoDia)) {
      setForm((f) => ({ ...f, novoDia: "" }));
      return;
    }
    setForm((f) => ({ ...f, diasTrabalhados: [...f.diasTrabalhados, f.novoDia].sort(), novoDia: "" }));
  }

  function removerDia(dia: string) {
    setForm((f) => ({ ...f, diasTrabalhados: f.diasTrabalhados.filter((d) => d !== dia) }));
  }

  function validar(): string {
    if (!Number.isFinite(valorNumerico) || valorNumerico <= 0) return "Informe o valor maior que zero.";
    if (form.categoria === "Dívida") {
      if (centavos(valorNumerico) < 0.01 || !Number.isFinite(centavos(valorNumerico))) return "Informe um valor válido em reais.";
      if (!form.nomeAvulso.trim()) return "Informe o nome do diarista.";
    }
    if (form.categoria === "Diárias") {
      if (!form.diaristaId) return "Escolha a diarista.";
      if (!form.lojaId) return "Escolha a loja.";
      if (!form.setor) return "Escolha o setor.";
      if (form.diasTrabalhados.length === 0) return "Adicione pelo menos um dia trabalhado.";
      const dia = Number(form.diaPagamento);
      if (!Number.isInteger(dia) || dia < 1 || dia > 31) return "Escolha o dia previsto para o pagamento (1 a 31).";
    }
    if (form.categoria === "Recebimento") {
      if (!form.data) return "Informe o dia em que recebeu.";
    }
    if (form.categoria === "Pagamento") {
      if (!form.diaristaId) return "Escolha a diarista que recebeu.";
      if (!form.data) return "Informe a data do pagamento.";
    }
    if (form.categoria === "Adiantamento") {
      if (!form.diaristaId) return "Escolha a diarista.";
      if (!form.tipoAdiantamento) return "Escolha se o adiantamento é de passagem ou de diária.";
      if (!form.data) return "Informe a data do adiantamento.";
    }
    return "";
  }

  function abrirCadastro() {
    setEditandoId(null);
    setForm(vazio());
    setErro("");
    setFormAberto(true);
  }

  function fecharForm() {
    setFormAberto(false);
    setEditandoId(null);
    setForm(vazio());
    setErro("");
  }

  function salvar(e: FormEvent) {
    e.preventDefault();
    const problema = validar();
    if (problema) {
      setErro(problema);
      return;
    }
    setErro("");

    if (form.categoria === "Dívida") {
      const id = editandoId ?? uid();
      const nomeDigitado = form.nomeAvulso.trim().replace(/\s+/g, " ");
      const nomeNormalizado = nomeDigitado.toLocaleLowerCase("pt-BR");
      const correspondencias = dados.diaristas.filter((d) => d.nome.trim().replace(/\s+/g, " ").toLocaleLowerCase("pt-BR") === nomeNormalizado);
      const diarista = correspondencias.find((d) => d.id === form.diaristaId) ??
        (correspondencias.length === 1 ? correspondencias[0] : undefined);
      setDados((estado) => {
        const original = estado.lancamentos.find((l) => l.id === id);
        const item: Lancamento = {
          id, categoria: "Dívida", descricao: diarista?.nome ?? nomeDigitado, diaristaId: diarista?.id,
          valor: centavos(valorNumerico), formaPagamento: FORMA_PAGAMENTO,
          setor: "", diasTrabalhados: [], diaPagamento: 0, rede: form.rede,
          data: original?.data ?? form.data, pagoEm: original?.pagoEm,
        };
        return { ...estado, lancamentos: upsert(estado.lancamentos, item) };
      });
      if (!editandoId) {
        setBusca("");
        setFiltro("pendentes");
      }
      notificar(editandoId ? "Dívida atualizada" : "Dívida cadastrada");
      fecharForm();
      return;
    }

    // Pagamento e adiantamento descontam das diárias pendentes da diarista.
    if (form.categoria === "Pagamento" || form.categoria === "Adiantamento") {
      const antigo = dados.lancamentos.find((l) => l.id === editandoId);
      // Ao editar, primeiro devolve o desconto antigo às diárias.
      const semAntigo = dados.lancamentos.filter((l) => l.id !== editandoId);
      const base = antigo?.alocacoes ? reverterAlocacoes(semAntigo, antigo.alocacoes) : semAntigo;

      const referenciaPagamento = antigo?.diaristaId === form.diaristaId ? antigo?.referenciaPagamento : undefined;
      const { alocacoes, descontado, restante } = alocarNasDiarias(base, form.diaristaId, valorNumerico, referenciaPagamento);
      const comDesconto = aplicarAlocacoes(base, alocacoes);
      const comum = {
        id: editandoId ?? uid(),
        categoria: form.categoria,
        valor: valorNumerico,
        formaPagamento: FORMA_PAGAMENTO,
        setor: "",
        diasTrabalhados: [],
        diaPagamento: 0,
        data: form.data,
        rede: "",
        diaristaId: form.diaristaId,
        alocacoes,
        referenciaPagamento,
      };

      let item: Lancamento;
      if (form.categoria === "Pagamento") {
        item = { ...comum, descricao: `Pago a ${nomeDiarista(form.diaristaId) ?? "diarista"}` };
      } else {
        const tipo: TipoAdiantamento = form.tipoAdiantamento === "Diária" ? "Diária" : "Passagem";
        item = { ...comum, descricao: `${tipo} · ${nomeDiarista(form.diaristaId) ?? "diarista"}`, tipoAdiantamento: tipo };
      }

      setDados((estado) => ({ ...estado, lancamentos: [item, ...comDesconto] }));

      const rotulo = form.categoria === "Pagamento" ? "Pagamento" : "Adiantamento";
      if (restante > 0 && descontado > 0) {
        notificar(`${rotulo} registrado: ${moeda(descontado)} descontados das diárias e ${moeda(restante)} de adiantamento`);
      } else if (descontado > 0) {
        notificar(`${rotulo} registrado: ${moeda(descontado)} descontados das diárias`);
      } else {
        notificar(`${rotulo} registrado como adiantamento de ${moeda(restante)}`);
      }
      fecharForm();
      return;
    }

    const base = {
      id: editandoId ?? uid(),
      categoria: form.categoria,
      valor: valorNumerico,
      formaPagamento: FORMA_PAGAMENTO,
    };

    let item: Lancamento;
    if (form.categoria === "Diárias") {
      const original = dados.lancamentos.find((l) => l.id === editandoId);
      item = {
        ...base,
        descricao: [nomeDiarista(form.diaristaId), nomeLoja(form.lojaId)].filter(Boolean).join(" · "),
        setor: form.setor,
        diasTrabalhados: form.diasTrabalhados,
        diaPagamento: Number(form.diaPagamento),
        lojaId: form.lojaId,
        diaristaId: form.diaristaId,
        data: "",
        rede: "",
        pagoValor: original?.pagoValor ?? 0,
      };
    } else {
      item = {
        ...base,
        descricao: "Recebido da Direct",
        setor: "",
        diasTrabalhados: [],
        diaPagamento: 0,
        data: form.data,
        rede: "",
      };
    }

    setDados((d) => ({ ...d, lancamentos: upsert(d.lancamentos, item) }));
    notificar(editandoId ? "Lançamento atualizado" : "Lançamento cadastrado");
    fecharForm();
  }

  function editar(l: Lancamento) {
    setEditandoId(l.id);
    setErro("");
    setForm({
      categoria: l.categoria,
      diaristaId: l.diaristaId ?? "",
      nomeAvulso: l.categoria === "Dívida" ? nomeDiarista(l.diaristaId) ?? l.descricao : "",
      lojaId: l.lojaId ?? "",
      rede: l.rede ?? "",
      setor: l.setor,
      diasTrabalhados: l.diasTrabalhados,
      novoDia: "",
      valor: String(l.valor).replace(".", ","),
      diaPagamento: l.diaPagamento ? String(l.diaPagamento) : "",
      data: l.data || hoje(),
      tipoAdiantamento: l.tipoAdiantamento ?? "",
    });
    setFormAberto(true);
  }

  function marcarComoPago(id: string) {
    const pagoEm = hoje();
    setDados((estado) => ({
      ...estado,
      lancamentos: estado.lancamentos.map((l) =>
        l.id === id && l.categoria === "Dívida" && !l.pagoEm ? { ...l, pagoEm } : l,
      ),
    }));
    notificar("Pagamento registrado em Já pagos");
  }

  function excluir(l: Lancamento) {
    if (!window.confirm(`Excluir o lançamento "${l.descricao}"?`)) return;
    setDados((estado) => {
      const semLancamento = estado.lancamentos.filter((x) => x.id !== l.id);
      // Pagamento e adiantamento devolvem o desconto às diárias.
      const lancamentos = l.alocacoes ? reverterAlocacoes(semLancamento, l.alocacoes) : semLancamento;
      return { ...estado, lancamentos };
    });
    if (editandoId === l.id) fecharForm();
    notificar("Lançamento excluído");
  }

  return (
    <section>
      <header className="cabeca rise">
        <h1>Financeiro</h1>
        <p className="muted">Acompanhe diárias, recebimentos, pagamentos e dívidas a diaristas.</p>
      </header>

      <div className="kpis kpis-3">
        <article className="kpi kpi-lime rise">
          <span className="kpi-rotulo">Entrada</span>
          <strong className="kpi-valor"><AnimatedNumber value={recebido} format={moeda} /></strong>
        </article>
        <article className="kpi kpi-red rise" style={{ animationDelay: "60ms" }}>
          <span className="kpi-rotulo">Saída</span>
          <strong className="kpi-valor"><AnimatedNumber value={pago} format={moeda} /></strong>
        </article>
        <article className="kpi kpi-orange rise" style={{ animationDelay: "120ms" }}>
          <span className="kpi-rotulo">Em aberto</span>
          <strong className="kpi-valor"><AnimatedNumber value={emAberto} format={moeda} /></strong>
        </article>
      </div>

      <section className="painel rise" style={{ animationDelay: "120ms" }}>
        <div className="painel-topo">
          <h2>Lançamentos ({dados.lancamentos.length})</h2>
          <button type="button" className="botao primario mini" onClick={abrirCadastro}>
            + Cadastrar
          </button>
        </div>

        <input
          className="busca"
          type="search"
          placeholder="Buscar por diarista, rede, loja ou setor"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          aria-label="Buscar lançamentos"
        />

        <div className="filtros">
          <div className="filtro-linha" role="tablist" aria-label="Filtrar por tipo">
            <span>Tipo</span>
            {FILTROS.map(({ valor: f, rotulo }) => (
              <button
                key={f}
                type="button"
                role="tab"
                aria-selected={filtro === f}
                className={`filtro-btn ${filtro === f ? "ativo" : ""}`}
                onClick={() => setFiltro(f)}
              >
                {rotulo}
              </button>
            ))}
          </div>
        </div>

        {dados.lancamentos.length === 0 ? (
          <p className="vazio">Nenhum lançamento ainda. Clique em "+ Cadastrar" para começar.</p>
        ) : lista.length === 0 ? (
          <p className="vazio">Nenhum lançamento com esses filtros.</p>
        ) : (
          <ul className="lista">
            {lista.map((linha) => {
              if ("grupo" in linha) {
                return (
                  <DividasAgrupadas key={linha.grupo.chave} grupo={linha.grupo} coresDasRedes={coresDasRedes} pagar={marcarComoPago} editar={editar} excluir={excluir} />
                );
              }
              const l = linha.lancamento;

              if (l.categoria === "Pagamento" || l.categoria === "Adiantamento") {
                const descontado = centavos((l.alocacoes ?? []).reduce((s, a) => s + a.valor, 0));
                const sobra = centavos(l.valor - descontado);
                const rotulo = l.categoria === "Pagamento" ? "Pagamento" : "Adiantamento";
                const referencia = l.referenciaPagamento;
                const lojaReferencia = dados.lojas.find((loja) => loja.id === referencia?.lojaId);
                const detalhes = [
                  lojaReferencia && `${lojaReferencia.rede} · ${lojaReferencia.nome}`,
                  referencia?.quantidade && `${referencia.quantidade} ${referencia.quantidade === 1 ? "diária" : "diárias"}`,
                  referencia?.dias.length && referencia.dias.map(dataCurta).join(", "),
                ].filter(Boolean).join(" · ");
                return (
                  <li key={l.id} className="linha">
                    <span className="bolinha amber" />
                    <div className="linha-texto">
                      <strong>
                        {rotulo}: {l.descricao}
                      </strong>
                      <span className="muted">{dataCurta(l.data)}</span>
                      {detalhes && <span className="muted">{detalhes}</span>}
                      <span className="muted">
                        Descontado das diárias: {moeda(descontado)}
                        {sobra > 0 ? ` · Sobra como adiantamento: ${moeda(sobra)}` : ""}
                      </span>
                      <span className="acoes-card">
                        <button type="button" className="link" onClick={() => editar(l)}>
                          Editar
                        </button>
                        <button type="button" className="link perigo" onClick={() => excluir(l)}>
                          Excluir
                        </button>
                      </span>
                    </div>
                    <span className="neg">− {moeda(l.valor)}</span>
                  </li>
                );
              }

              if (l.categoria === "Recebimento") {
                return (
                  <li key={l.id} className="linha">
                    <span className="bolinha lime" />
                    <div className="linha-texto">
                      <strong>Recebimento: {l.descricao}</strong>
                      <span className="muted">{dataCurta(l.data)}</span>
                      <span className="acoes-card">
                        <button type="button" className="link" onClick={() => editar(l)}>
                          Editar
                        </button>
                        <button type="button" className="link perigo" onClick={() => excluir(l)}>
                          Excluir
                        </button>
                      </span>
                    </div>
                    <span className="pos">+ {moeda(l.valor)}</span>
                  </li>
                );
              }

              const pendente = pendenteDaDiaria(l);
              return (
                <li key={l.id} className="linha">
                  <span className="bolinha cyan" />
                  <div className="linha-texto">
                    <strong>Diária: {l.descricao}</strong>
                    <span className="muted">
                      {[l.setor, nomeLoja(l.lojaId), `${textoDiarias(l.valor)} diária(s)`, `${l.diasTrabalhados.length} dia(s) trabalhado(s)`]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                    <span className="muted">
                      Pagar dia {l.diaPagamento}
                      {l.diasTrabalhados.length > 0 ? ` · ${l.diasTrabalhados.map(dataSemAno).join(", ")}` : ""}
                    </span>
                    <span className={`status ${pendente > 0 ? "pendente" : "pago"}`}>
                      {pendente > 0 ? `Pendente: ${moeda(pendente)}` : "Pago"}
                      {(l.pagoValor ?? 0) > 0 ? ` · Já pago: ${moeda(l.pagoValor ?? 0)}` : ""}
                    </span>
                    <span className="acoes-card">
                      <button type="button" className="link" onClick={() => editar(l)}>
                        Editar
                      </button>
                      <button type="button" className="link perigo" onClick={() => excluir(l)}>
                        Excluir
                      </button>
                    </span>
                  </div>
                  <span className="muted">{moeda(l.valor)}</span>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {formAberto && (
        <div className="modal-fundo" onClick={fecharForm}>
          <div
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="titulo-cadastro-lancamento"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-topo">
              <h2 id="titulo-cadastro-lancamento">{editandoId ? "Editar lançamento" : "Cadastrar lançamento"}</h2>
              <button type="button" className="modal-fechar" aria-label="Fechar" onClick={fecharForm}>
                ×
              </button>
            </div>

            <form className="form" onSubmit={salvar} noValidate>
              <fieldset className="secao">
                <legend>O que você quer registrar</legend>
                <div className="segmento" role="radiogroup" aria-label="Tipo de lançamento">
                  {OPCOES.map((o) => (
                    <button
                      key={o.valor}
                      type="button"
                      role="radio"
                      aria-checked={form.categoria === o.valor}
                      className={`segmento-btn ${o.valor === "Dívida" ? "financeiro-opcao-divida" : ""} ${form.categoria === o.valor ? "ativo entrada" : ""}`}
                      onClick={() => trocarCategoria(o.valor)}
                      disabled={!!editandoId && form.categoria !== o.valor}
                    >
                      {o.rotulo}
                    </button>
                  ))}
                </div>
              </fieldset>

              {form.categoria === "Dívida" && (
                <fieldset className="secao">
                  <legend>Dívida a diarista</legend>
                  <div className="grade-form">
                    <label className="campo">
                      <span>Nome do diarista</span>
                      <input
                        type="text"
                        list="nomes-diaristas-divida"
                        value={form.nomeAvulso}
                        onChange={(e) => atualizar("nomeAvulso", e.target.value)}
                        placeholder="Digite ou escolha um nome"
                        autoComplete="off"
                      />
                      <datalist id="nomes-diaristas-divida">
                        {dados.diaristas.map((d) => <option key={d.id} value={d.nome} />)}
                      </datalist>
                    </label>
                    <label className="campo">
                      <span>Valor devido (R$)</span>
                      <input inputMode="decimal" value={form.valor} onChange={(e) => atualizar("valor", e.target.value)} placeholder="0,00" />
                    </label>
                    <label className="campo span-2">
                      <span>Rede do supermercado (opcional)</span>
                      <select value={form.rede} onChange={(e) => atualizar("rede", e.target.value)}>
                        <option value="">Selecione a rede</option>
                        {form.rede && !coresDasRedes.has(form.rede) && <option>{form.rede}</option>}
                        {[...coresDasRedes.keys()].map((rede) => <option key={rede}>{rede}</option>)}
                      </select>
                    </label>
                  </div>
                </fieldset>
              )}

              {form.categoria === "Diárias" && (
                <>
                  <fieldset className="secao">
                    <legend>Diárias trabalhadas</legend>
                    <div className="grade-form">
                      <label className="campo">
                        <span>Diarista *</span>
                        <select value={form.diaristaId} onChange={(e) => atualizar("diaristaId", e.target.value)}>
                          <option value=""></option>
                          {dados.diaristas.map((d) => (
                            <option key={d.id} value={d.id}>
                              {d.nome}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="campo">
                        <span>Loja *</span>
                        <select value={form.lojaId} onChange={(e) => atualizar("lojaId", e.target.value)}>
                          <option value=""></option>
                          {dados.lojas.map((l) => (
                            <option key={l.id} value={l.id}>
                              {l.nome}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="campo span-2">
                        <span>Setor *</span>
                        <select value={form.setor} onChange={(e) => atualizar("setor", e.target.value)}>
                          <option value="">Escolha o setor</option>
                          {todosSetores.map((s) => (
                            <option key={s}>{s}</option>
                          ))}
                        </select>
                      </label>
                    </div>

                    <div className="campo dias-bloco">
                      <span>Dias trabalhados *</span>
                      <div className="dia-adicionar">
                        <input type="date" aria-label="Dia trabalhado" value={form.novoDia} onChange={(e) => atualizar("novoDia", e.target.value)} />
                        <button type="button" className="botao primario mini" onClick={adicionarDia}>
                          + Adicionar dia
                        </button>
                      </div>
                      {form.diasTrabalhados.length > 0 ? (
                        <div className="chips" role="list" aria-label="Dias trabalhados">
                          {form.diasTrabalhados.map((dia) => (
                            <span key={dia} role="listitem" className="chip ativo chip-dia">
                              {dataCurta(dia)}
                              <button type="button" className="chip-x" aria-label={`Remover ${dataCurta(dia)}`} onClick={() => removerDia(dia)}>
                                ×
                              </button>
                            </span>
                          ))}
                        </div>
                      ) : (
                        <p className="muted">Nenhum dia adicionado ainda.</p>
                      )}
                    </div>
                  </fieldset>

                  <fieldset className="secao">
                    <legend>Valor</legend>
                    <div className="grade-form">
                      <label className="campo">
                        <span>Valor total (R$) *</span>
                        <input inputMode="decimal" value={form.valor} onChange={(e) => atualizar("valor", e.target.value)} placeholder="0,00" />
                      </label>
                      <label className="campo">
                        <span>Quantidade de diárias (automático)</span>
                        <input readOnly className="campo-calculado" value={diariasCalculadas} aria-live="polite" />
                      </label>
                      <label className="campo">
                        <span>Dia previsto para o pagamento *</span>
                        <select value={form.diaPagamento} onChange={(e) => atualizar("diaPagamento", e.target.value)}>
                          <option value="">Escolha o dia</option>
                          {DIAS_DO_MES.map((d) => (
                            <option key={d} value={d}>
                              Dia {d}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                    {naoMultiplo && <p className="ajuda aviso-texto">O valor não é múltiplo de R$ {VALOR_DIARIA}. Confira o total.</p>}
                  </fieldset>
                </>
              )}

              {form.categoria === "Recebimento" && (
                <fieldset className="secao">
                  <legend>Recebimento da Direct</legend>
                  <div className="grade-form">
                    <label className="campo">
                      <span>Valor recebido (R$) *</span>
                      <input inputMode="decimal" value={form.valor} onChange={(e) => atualizar("valor", e.target.value)} placeholder="0,00" />
                    </label>
                    <label className="campo">
                      <span>Dia recebido *</span>
                      <input type="date" value={form.data} onChange={(e) => atualizar("data", e.target.value)} />
                    </label>
                  </div>
                </fieldset>
              )}

              {form.categoria === "Pagamento" && (
                <fieldset className="secao">
                  <legend>Pagamento a diarista</legend>
                  <div className="grade-form">
                    <label className="campo">
                      <span>Diarista *</span>
                      <select value={form.diaristaId} onChange={(e) => atualizar("diaristaId", e.target.value)}>
                        <option value=""></option>
                        {dados.diaristas.map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.nome}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="campo">
                      <span>Data do pagamento *</span>
                      <input type="date" value={form.data} onChange={(e) => atualizar("data", e.target.value)} />
                    </label>
                    <label className="campo">
                      <span>Valor pago (R$) *</span>
                      <input inputMode="decimal" value={form.valor} onChange={(e) => atualizar("valor", e.target.value)} placeholder="0,00" />
                    </label>
                  </div>
                  {form.diaristaId && (
                    <p className="ajuda">
                      {pendenteDoForm > 0
                        ? `Pendente de diárias: ${moeda(pendenteDoForm)}. O valor será descontado automaticamente, começando pela diária mais antiga. O que sobrar vira adiantamento.`
                        : "Não há diárias pendentes para essa diarista. O valor será registrado como adiantamento."}
                    </p>
                  )}
                </fieldset>
              )}

              {form.categoria === "Adiantamento" && (
                <fieldset className="secao">
                  <legend>Adiantamento</legend>
                  <span className="rotulo">Tipo</span>
                  <div className="segmento" role="radiogroup" aria-label="Tipo de adiantamento">
                    {TIPOS_ADIANTAMENTO.map((t) => (
                      <button
                        key={t}
                        type="button"
                        role="radio"
                        aria-checked={form.tipoAdiantamento === t}
                        className={`segmento-btn ${form.tipoAdiantamento === t ? "ativo entrada" : ""}`}
                        onClick={() => atualizar("tipoAdiantamento", t)}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                  <div className="grade-form">
                    <label className="campo">
                      <span>Diarista *</span>
                      <select value={form.diaristaId} onChange={(e) => atualizar("diaristaId", e.target.value)}>
                        <option value=""></option>
                        {dados.diaristas.map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.nome}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="campo">
                      <span>Data *</span>
                      <input type="date" value={form.data} onChange={(e) => atualizar("data", e.target.value)} />
                    </label>
                    <label className="campo span-2">
                      <span>Valor (R$) *</span>
                      <input inputMode="decimal" value={form.valor} onChange={(e) => atualizar("valor", e.target.value)} placeholder="0,00" />
                    </label>
                  </div>
                  {form.diaristaId && (
                    <p className="ajuda">
                      {pendenteDoForm > 0
                        ? `Pendente de diárias: ${moeda(pendenteDoForm)}. O adiantamento será descontado das diárias, começando pela mais antiga. O que sobrar fica como adiantamento.`
                        : "Não há diárias pendentes para essa diarista. O valor será registrado como adiantamento."}
                    </p>
                  )}
                </fieldset>
              )}

              {erro && (
                <p className="erro" role="alert" key={erro}>
                  {erro}
                </p>
              )}

              <div className="acoes">
                <button type="button" className="botao secundario" onClick={fecharForm}>
                  Cancelar
                </button>
                <button type="submit" className="botao primario">
                  {editandoId ? "Salvar alterações" : "Cadastrar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}
