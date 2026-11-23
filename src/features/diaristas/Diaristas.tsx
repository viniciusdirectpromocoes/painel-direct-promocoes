import { useEffect, useMemo, useState, type FormEvent } from "react";
import type { Dados, Diarista, Regiao, SetDados, Turno } from "../../core/types";
import { upsert } from "../../core/store";
import { uid } from "../../core/format";
import { CIDADE_PADRAO, SETORES, TRANSPORTES, TURNOS, UF_PADRAO, UFS } from "../../core/constants";
import { cepValido, cpfValido, formataCep, formataCpf, formataTelefone, telefoneNacional, telefoneValido } from "../../core/mascaras";
import { buscarCep } from "../../core/cep";
import { disponivel, resumoDisponibilidade, resumoLocomocao, statusDiarista } from "../../core/regras";
import { AnimatedNumber } from "../../components/AnimatedNumber";
import { Chips } from "../../components/Chips";
import "../../styles/forms.css";

type Props = { dados: Dados; setDados: SetDados; notificar: (t: string) => void };

type Form = Omit<Diarista, "id" | "criadoEm">;

const SITUACOES_TRABALHO: { valor: boolean; rotulo: string }[] = [
  { valor: true, rotulo: "Está trabalhando" },
  { valor: false, rotulo: "Está desempregado" },
];

const REGIOES: { valor: Regiao; rotulo: string }[] = [
  { valor: "qualquer", rotulo: "Qualquer região" },
  { valor: "proximo", rotulo: "Só perto do meu endereço" },
];

const vazio = (): Form => ({
  nome: "",
  cpf: "",
  dataNascimento: "",
  telefone: "",
  cep: "",
  logradouro: "",
  numero: "",
  bairro: "",
  cidade: CIDADE_PADRAO,
  uf: UF_PADRAO,
  setores: [],
  trabalhando: false,
  empresaAtual: "",
  bloqueada: false,
  turnos: [],
  transportes: [],
  regiao: "qualquer",
});

function validar(f: Form): string {
  if (!f.nome.trim()) return "Informe o nome completo.";
  if (!cpfValido(f.cpf)) return "CPF inválido. Confira os 11 números.";
  if (!telefoneValido(f.telefone)) return "Telefone inválido. Use DDD + número.";
  if (!cepValido(f.cep)) return "Informe um CEP com 8 números.";
  if (!f.numero.trim()) return "Informe o número da casa.";
  if (f.trabalhando && !f.empresaAtual.trim()) return "Informe em qual empresa ela trabalha hoje.";
  return "";
}

export function Diaristas({ dados, setDados, notificar }: Props) {
  const [form, setForm] = useState<Form>(vazio);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [formAberto, setFormAberto] = useState(false);
  const [erro, setErro] = useState("");
  const [busca, setBusca] = useState("");
  const [buscandoCep, setBuscandoCep] = useState(false);
  const [cepAviso, setCepAviso] = useState("");
  const [novoSetor, setNovoSetor] = useState<string | null>(null);

  const todosSetores = useMemo(() => [...SETORES, ...dados.setoresExtras], [dados.setoresExtras]);

  const lista = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    const buscaTelefone = /^[\d()+\s-]+$/.test(termo) ? telefoneNacional(termo) : "";
    return dados.diaristas
      .filter((d) =>
        `${d.nome} ${d.cpf} ${d.telefone} ${formataTelefone(d.telefone)} ${d.bairro} ${d.cidade} ${d.setores.join(" ")} ${d.transportes.join(" ")}`
          .toLowerCase()
          .includes(termo) || (buscaTelefone !== "" && telefoneNacional(d.telefone).includes(buscaTelefone)),
      )
      .sort((a, b) => a.nome.localeCompare(b.nome));
  }, [dados.diaristas, busca]);

  const total = dados.diaristas.length;
  const totalDisponiveis = dados.diaristas.filter(disponivel).length;
  const totalBloqueadas = dados.diaristas.filter((d) => d.bloqueada).length;

  // Fecha a janela com Esc.
  useEffect(() => {
    if (!formAberto) return;
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === "Escape") fecharForm();
    };
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, [formAberto]);

  // CEP automático: ao digitar 8 números, preenche bairro, rua, cidade e UF.
  useEffect(() => {
    if (!cepValido(form.cep)) return;
    let ativo = true;
    setBuscandoCep(true);
    setCepAviso("");
    buscarCep(form.cep)
      .then((end) => {
        if (!ativo) return;
        if (!end) {
          setCepAviso("CEP não encontrado. Preencha o endereço manualmente.");
          return;
        }
        setForm((f) => ({ ...f, logradouro: end.logradouro, bairro: end.bairro, cidade: end.cidade, uf: end.uf }));
      })
      .catch(() => {
        if (ativo) setCepAviso("Sem conexão para buscar o CEP. Preencha o endereço manualmente.");
      })
      .finally(() => {
        if (ativo) setBuscandoCep(false);
      });
    return () => {
      ativo = false;
    };
  }, [form.cep]);

  function atualizar<K extends keyof Form>(campo: K, valor: Form[K]) {
    setForm((f) => ({ ...f, [campo]: valor }));
  }

  function alternarTurno(turno: Turno) {
    setForm((f) => ({
      ...f,
      turnos: f.turnos.includes(turno) ? f.turnos.filter((t) => t !== turno) : [...f.turnos, turno],
    }));
  }

  function adicionarSetor() {
    const nome = (novoSetor ?? "").trim();
    if (!nome) return;
    const existente = todosSetores.find((s) => s.toLowerCase() === nome.toLowerCase());
    const valorFinal = existente ?? nome;
    if (!existente) {
      setDados((d) => ({ ...d, setoresExtras: [...d.setoresExtras, nome] }));
    }
    setForm((f) => (f.setores.includes(valorFinal) ? f : { ...f, setores: [...f.setores, valorFinal] }));
    setNovoSetor(null);
    notificar("Setor cadastrado");
  }

  function abrirCadastro() {
    setEditandoId(null);
    setForm(vazio());
    setErro("");
    setCepAviso("");
    setNovoSetor(null);
    setFormAberto(true);
  }

  function fecharForm() {
    setFormAberto(false);
    setEditandoId(null);
    setForm(vazio());
    setErro("");
    setCepAviso("");
    setNovoSetor(null);
  }

  function salvar(e: FormEvent) {
    e.preventDefault();
    const problema = validar(form);
    if (problema) {
      setErro(problema);
      return;
    }
    setErro("");
    const original = dados.diaristas.find((d) => d.id === editandoId);
    const item: Diarista = {
      ...form,
      nome: form.nome.trim(),
      empresaAtual: form.trabalhando ? form.empresaAtual.trim() : "",
      id: editandoId ?? uid(),
      criadoEm: original?.criadoEm ?? new Date().toISOString(),
    };
    setDados((d) => ({ ...d, diaristas: upsert(d.diaristas, item) }));
    notificar(editandoId ? "Diarista atualizada" : "Diarista cadastrada");
    fecharForm();
  }

  function editar(d: Diarista) {
    setEditandoId(d.id);
    setErro("");
    setCepAviso("");
    setNovoSetor(null);
    const { id: _id, criadoEm: _criado, ...resto } = d;
    void _id;
    void _criado;
    setForm({
      ...resto,
      telefone: telefoneValido(resto.telefone) ? formataTelefone(resto.telefone) : resto.telefone,
      turnos: resto.turnos ?? [],
    });
    setFormAberto(true);
  }

  function alternarBloqueio(d: Diarista) {
    setDados((estado) => ({
      ...estado,
      diaristas: estado.diaristas.map((x) => (x.id === d.id ? { ...x, bloqueada: !x.bloqueada } : x)),
    }));
    notificar(d.bloqueada ? "Diarista desbloqueada" : "Diarista bloqueada");
  }

  function excluir(d: Diarista) {
    if (!window.confirm(`Excluir ${d.nome}? Essa ação não pode ser desfeita.`)) return;
    setDados((estado) => ({ ...estado, diaristas: estado.diaristas.filter((x) => x.id !== d.id) }));
    notificar("Diarista excluída");
  }

  return (
    <section>
      <header className="cabeca rise">
        <h1>Diaristas</h1>
        <p className="muted">Lista de diaristas para encontrar a pessoa certa para cada diária.</p>
      </header>

      <div className="kpis kpis-3">
        <article className="kpi kpi-blue rise">
          <span className="kpi-rotulo">Diaristas cadastrados</span>
          <strong className="kpi-valor"><AnimatedNumber value={total} format={(n) => Math.round(n).toString()} /></strong>
        </article>
        <article className="kpi kpi-lime rise" style={{ animationDelay: "60ms" }}>
          <span className="kpi-rotulo">Disponíveis</span>
          <strong className="kpi-valor"><AnimatedNumber value={totalDisponiveis} format={(n) => Math.round(n).toString()} /></strong>
        </article>
        <article className="kpi kpi-red rise" style={{ animationDelay: "120ms" }}>
          <span className="kpi-rotulo">Bloqueados</span>
          <strong className="kpi-valor"><AnimatedNumber value={totalBloqueadas} format={(n) => Math.round(n).toString()} /></strong>
        </article>
      </div>

      <section className="painel rise" style={{ animationDelay: "120ms" }}>
        <div className="painel-topo">
          <h2>Lista ({total})</h2>
          <button type="button" className="botao primario mini" onClick={abrirCadastro}>
            + Cadastrar
          </button>
        </div>
        <input
          className="busca"
          type="search"
          placeholder="Buscar por nome, CPF, telefone, bairro, setor ou locomoção"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          aria-label="Buscar diaristas"
        />

        {total === 0 ? (
          <p className="vazio">Nenhuma diarista cadastrada ainda. Clique em "+ Cadastrar" para começar.</p>
        ) : lista.length === 0 ? (
          <p className="vazio">Nada encontrado para "{busca}".</p>
        ) : (
          <div className="tabela-wrap">
            <table className="tabela tabela-diaristas">
              <thead>
                <tr>
                  <th scope="col">Nome</th>
                  <th scope="col">CPF</th>
                  <th scope="col">Telefone</th>
                  <th scope="col">Status</th>
                  <th scope="col">WhatsApp</th>
                  <th scope="col">Bairro</th>
                  <th scope="col">Disponibilidade</th>
                  <th scope="col">Locomoção</th>
                  <th scope="col">
                    <span className="sr-only">Ações</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {lista.map((d) => {
                  const status = statusDiarista(d);
                  const cor = status === "Disponível" ? "lime" : status === "Bloqueada" ? "vermelho" : "pink";
                  const whatsapp = telefoneValido(d.telefone)
                    ? `https://web.whatsapp.com/send?phone=55${telefoneNacional(d.telefone)}`
                    : null;
                  const mensagem = "Olá, sou supervisor da Direct Promoções e estou entrando em contato com você para salvar o meu contato e receber as oportunidades de diárias que acontecem conosco";
                  return (
                    <tr key={d.id}>
                      <td>
                        <strong>{d.nome}</strong>
                      </td>
                      <td className="nowrap">{d.cpf}</td>
                      <td className="nowrap">{whatsapp ? formataTelefone(d.telefone) : d.telefone || "—"}</td>
                      <td className="nowrap"><span className={`selo ${cor} selo-pequeno`}>{status}</span></td>
                      <td>
                        {whatsapp ? (
                          <div className="atalhos-whatsapp">
                            <a className="atalho-whatsapp" href={whatsapp} target="_blank" rel="noopener noreferrer" title="Abrir conversa sem mensagem" aria-label={`Abrir conversa com ${d.nome} no WhatsApp`}>
                              <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M20 11.5a8 8 0 0 1-8 8 8 8 0 0 1-3.6-.9L4 20l1.4-4.4A8 8 0 1 1 20 11.5Z" />
                                <path d="M9 11.5h6" />
                              </svg>
                            </a>
                            <a className="atalho-whatsapp atalho-whatsapp-mensagem" href={`${whatsapp}&text=${encodeURIComponent(mensagem)}`} target="_blank" rel="noopener noreferrer" title="Abrir conversa com mensagem pronta" aria-label={`Abrir mensagem pronta para ${d.nome} no WhatsApp`}>
                              <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                                <path d="m21 3-7 18-3.5-7.5L3 10l18-7ZM21 3 10.5 13.5" />
                              </svg>
                            </a>
                          </div>
                        ) : "—"}
                      </td>
                      <td>{d.bairro || "—"}</td>
                      <td>{resumoDisponibilidade(d)}</td>
                      <td>{resumoLocomocao(d)}</td>
                      <td className="tabela-acoes">
                        <button type="button" className="link" onClick={() => editar(d)}>
                          Editar
                        </button>
                        <button type="button" className="link" onClick={() => alternarBloqueio(d)}>
                          {d.bloqueada ? "Desbloquear" : "Bloquear"}
                        </button>
                        <button type="button" className="link perigo" onClick={() => excluir(d)}>
                          Excluir
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {formAberto && (
        <div className="modal-fundo" onClick={fecharForm}>
          <div
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="titulo-cadastro-diarista"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-topo">
              <h2 id="titulo-cadastro-diarista">{editandoId ? "Editar diarista" : "Cadastrar diarista"}</h2>
              <button type="button" className="modal-fechar" aria-label="Fechar" onClick={fecharForm}>
                ×
              </button>
            </div>

            <form className="form" onSubmit={salvar} noValidate>
              <fieldset className="secao">
                <legend>Dados pessoais</legend>
                <label className="campo">
                  <span>Nome completo *</span>
                  <input value={form.nome} onChange={(e) => atualizar("nome", e.target.value)} autoComplete="off" />
                </label>
                <div className="grade-3">
                  <label className="campo">
                    <span>CPF *</span>
                    <input inputMode="numeric" value={form.cpf} onChange={(e) => atualizar("cpf", formataCpf(e.target.value))} placeholder="000.000.000-00" />
                  </label>
                  <label className="campo">
                    <span>Data de nascimento</span>
                    <input type="date" value={form.dataNascimento} onChange={(e) => atualizar("dataNascimento", e.target.value)} />
                  </label>
                  <label className="campo">
                    <span>Telefone *</span>
                    <input inputMode="tel" value={form.telefone} onChange={(e) => atualizar("telefone", formataTelefone(e.target.value))} placeholder="(85) 90000-0000" />
                  </label>
                </div>
              </fieldset>

              <fieldset className="secao">
                <legend>Endereço</legend>
                <div className="grade-3">
                  <label className="campo">
                    <span>CEP *</span>
                    <input inputMode="numeric" value={form.cep} onChange={(e) => atualizar("cep", formataCep(e.target.value))} placeholder="00000-000" />
                  </label>
                  <label className="campo">
                    <span>Bairro</span>
                    <input value={form.bairro} onChange={(e) => atualizar("bairro", e.target.value)} />
                  </label>
                  <label className="campo">
                    <span>Número da casa *</span>
                    <input
                      inputMode="numeric"
                      value={form.numero}
                      onChange={(e) => atualizar("numero", e.target.value)}
                      placeholder="Ex.: 123"
                      aria-invalid={!!erro && !form.numero.trim()}
                    />
                  </label>
                  <label className="campo span-3">
                    <span>Rua</span>
                    <input value={form.logradouro} onChange={(e) => atualizar("logradouro", e.target.value)} />
                  </label>
                  <label className="campo span-2">
                    <span>Cidade</span>
                    <input value={form.cidade} onChange={(e) => atualizar("cidade", e.target.value)} />
                  </label>
                  <label className="campo">
                    <span>UF</span>
                    <select value={form.uf} onChange={(e) => atualizar("uf", e.target.value)}>
                      {UFS.map((u) => (
                        <option key={u}>{u}</option>
                      ))}
                    </select>
                  </label>
                </div>
                {buscandoCep && <p className="ajuda">Buscando endereço pelo CEP…</p>}
                {cepAviso && <p className="ajuda aviso-texto">{cepAviso}</p>}
              </fieldset>

              <fieldset className="secao">
                <legend>Experiência</legend>
                <div className="linha-topo">
                  <span className="rotulo">Em quais setores ela tem experiência</span>
                  <button
                    type="button"
                    className="botao primario mais verde"
                    aria-label="Cadastrar novo setor"
                    onClick={() => setNovoSetor("")}
                  >
                    +
                  </button>
                </div>
                <Chips rotulo="Setores com experiência" opcoes={todosSetores} valor={form.setores} onChange={(v) => atualizar("setores", v)} />
                {novoSetor !== null && (
                  <div className="dia-adicionar">
                    <input
                      aria-label="Nome do novo setor"
                      value={novoSetor}
                      onChange={(e) => setNovoSetor(e.target.value)}
                      placeholder="Nome do setor"
                      autoFocus
                    />
                    <button type="button" className="botao primario mini" onClick={adicionarSetor}>
                      Adicionar setor
                    </button>
                    <button type="button" className="botao secundario mini" onClick={() => setNovoSetor(null)}>
                      Cancelar
                    </button>
                  </div>
                )}
              </fieldset>

              <fieldset className="secao">
                <legend>Trabalho atual e situação</legend>
                <div className="segmento" role="radiogroup" aria-label="Situação atual">
                  {SITUACOES_TRABALHO.map((o) => (
                    <button
                      key={o.rotulo}
                      type="button"
                      role="radio"
                      aria-checked={form.trabalhando === o.valor}
                      className={`segmento-btn ${form.trabalhando === o.valor ? "ativo entrada" : ""}`}
                      onClick={() => atualizar("trabalhando", o.valor)}
                    >
                      {o.rotulo}
                    </button>
                  ))}
                </div>
                {form.trabalhando && (
                  <label className="campo">
                    <span>Qual empresa *</span>
                    <input
                      value={form.empresaAtual}
                      onChange={(e) => atualizar("empresaAtual", e.target.value)}
                      placeholder="Nome da empresa"
                      aria-invalid={!!erro && !form.empresaAtual.trim()}
                    />
                  </label>
                )}
              </fieldset>

              <fieldset className="secao">
                <legend>Disponibilidade</legend>
                <div className="chips" role="group" aria-label="Turnos disponíveis">
                  {TURNOS.map((t) => {
                    const ativo = form.turnos.includes(t.valor);
                    return (
                      <button
                        key={t.valor}
                        type="button"
                        aria-pressed={ativo}
                        className={`chip ${ativo ? "ativo" : ""}`}
                        onClick={() => alternarTurno(t.valor as Turno)}
                      >
                        {t.rotulo}
                      </button>
                    );
                  })}
                </div>
              </fieldset>

              <fieldset className="secao">
                <legend>Locomoção</legend>
                <span className="rotulo">Meios de locomoção</span>
                <Chips rotulo="Meios de locomoção" opcoes={TRANSPORTES} valor={form.transportes} onChange={(v) => atualizar("transportes", v)} />
                <span className="rotulo">Onde pode trabalhar</span>
                <div className="segmento" role="radiogroup" aria-label="Região de trabalho">
                  {REGIOES.map((o) => (
                    <button
                      key={o.valor}
                      type="button"
                      role="radio"
                      aria-checked={form.regiao === o.valor}
                      className={`segmento-btn ${form.regiao === o.valor ? "ativo entrada" : ""}`}
                      onClick={() => atualizar("regiao", o.valor)}
                    >
                      {o.rotulo}
                    </button>
                  ))}
                </div>
              </fieldset>

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
                  {editandoId ? "Salvar alterações" : "Cadastrar diarista"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}
