import { useEffect, useMemo, useState, type FormEvent } from "react";
import type { Dados, Loja, SetDados } from "../../core/types";
import { upsert } from "../../core/store";
import { uid } from "../../core/format";
import { copiarTexto } from "../../core/clipboard";
import { AnimatedNumber } from "../../components/AnimatedNumber";
import "../../styles/forms.css";

type Props = { dados: Dados; setDados: SetDados; notificar: (t: string) => void };

type Form = Omit<Loja, "id" | "criadoEm">;

const vazio = (): Form => ({ rede: "", nome: "", endereco: "" });

/** Mensagem pronta para enviar ao diarista, com rede, loja e endereço. */
function mensagemDaLoja(l: Loja) {
  return `Olá! Segue o local da diária:\n\nRede: ${l.rede}\nLoja: ${l.nome}\nEndereço: ${l.endereco}`;
}

function validar(f: Form): string {
  if (!f.rede.trim()) return "Informe a rede.";
  if (!f.nome.trim()) return "Informe o nome da loja.";
  if (!f.endereco.trim()) return "Informe o endereço da loja.";
  return "";
}

export function Lojas({ dados, setDados, notificar }: Props) {
  const [form, setForm] = useState<Form>(vazio);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [formAberto, setFormAberto] = useState(false);
  const [erro, setErro] = useState("");
  const [busca, setBusca] = useState("");
  const [mensagemDe, setMensagemDe] = useState<Loja | null>(null);

  const lista = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return dados.lojas
      .filter((l) => `${l.rede} ${l.nome} ${l.endereco}`.toLowerCase().includes(termo))
      .sort((a, b) => a.rede.localeCompare(b.rede) || a.nome.localeCompare(b.nome));
  }, [dados.lojas, busca]);

  const totalLojas = dados.lojas.length;

  // Lojas agrupadas por rede, em ordem alfabética.
  const lojasPorRede = useMemo(() => {
    const mapa = new Map<string, number>();
    dados.lojas.forEach((l) => mapa.set(l.rede, (mapa.get(l.rede) ?? 0) + 1));
    return [...mapa.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [dados.lojas]);

  const totalRedes = lojasPorRede.length;

  // Fecha as janelas com Esc.
  useEffect(() => {
    if (!formAberto && !mensagemDe) return;
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        fecharForm();
        setMensagemDe(null);
      }
    };
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, [formAberto, mensagemDe]);

  function atualizar<K extends keyof Form>(campo: K, valor: Form[K]) {
    setForm((f) => ({ ...f, [campo]: valor }));
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
    const problema = validar(form);
    if (problema) {
      setErro(problema);
      return;
    }
    setErro("");
    const original = dados.lojas.find((l) => l.id === editandoId);
    const item: Loja = {
      id: editandoId ?? uid(),
      rede: form.rede.trim(),
      nome: form.nome.trim(),
      endereco: form.endereco.trim(),
      criadoEm: original?.criadoEm ?? new Date().toISOString(),
    };
    setDados((d) => ({ ...d, lojas: upsert(d.lojas, item) }));
    notificar(editandoId ? "Loja atualizada" : "Loja cadastrada");
    fecharForm();
  }

  function editar(l: Loja) {
    setEditandoId(l.id);
    setErro("");
    setForm({ rede: l.rede, nome: l.nome, endereco: l.endereco });
    setFormAberto(true);
  }

  function excluir(l: Loja) {
    if (!window.confirm(`Excluir a loja ${l.nome}? Essa ação não pode ser desfeita.`)) return;
    setDados((estado) => ({ ...estado, lojas: estado.lojas.filter((x) => x.id !== l.id) }));
    notificar("Loja excluída");
  }

  async function copiarMensagem(l: Loja) {
    const ok = await copiarTexto(mensagemDaLoja(l));
    notificar(ok ? "Mensagem copiada" : "Não foi possível copiar. Selecione o texto e copie.");
  }

  return (
    <section>
      <header className="cabeca rise">
        <h1>Lojas</h1>
        <p className="muted">Redes, lojas e endereços.</p>
      </header>

      <div className="kpis kpis-2">
        <article className="kpi kpi-blue rise">
          <span className="kpi-rotulo">Redes</span>
          <strong className="kpi-valor"><AnimatedNumber value={totalRedes} format={(n) => Math.round(n).toString()} /></strong>
        </article>
        <article className="kpi kpi-lime rise" style={{ animationDelay: "60ms" }}>
          <span className="kpi-rotulo">Lojas</span>
          <strong className="kpi-valor"><AnimatedNumber value={totalLojas} format={(n) => Math.round(n).toString()} /></strong>
          {lojasPorRede.length > 0 && (
            <ul className="kpi-lista">
              {lojasPorRede.map(([rede, qtd]) => (
                <li key={rede}>
                  {rede}: <strong>{qtd}</strong>
                </li>
              ))}
            </ul>
          )}
        </article>
      </div>

      <section className="painel rise" style={{ animationDelay: "120ms" }}>
        <div className="painel-topo">
          <h2>Lista ({totalLojas})</h2>
          <button type="button" className="botao primario mini" onClick={abrirCadastro}>
            + Cadastrar
          </button>
        </div>
        <input
          className="busca"
          type="search"
          placeholder="Buscar por rede, loja ou endereço"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          aria-label="Buscar lojas"
        />

        {totalLojas === 0 ? (
          <p className="vazio">Nenhuma loja cadastrada ainda. Clique em "+ Cadastrar" para começar.</p>
        ) : lista.length === 0 ? (
          <p className="vazio">Nada encontrado para "{busca}".</p>
        ) : (
          <div className="tabela-wrap">
            <table className="tabela">
              <thead>
                <tr>
                  <th scope="col">Rede</th>
                  <th scope="col">Loja</th>
                  <th scope="col">Endereço</th>
                  <th scope="col">
                    <span className="sr-only">Ações</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {lista.map((l) => (
                  <tr key={l.id}>
                    <td>{l.rede}</td>
                    <td>
                      <strong>{l.nome}</strong>
                    </td>
                    <td>
                      {l.endereco}
                      <br />
                      <button type="button" className="link" onClick={() => setMensagemDe(l)}>
                        Mensagem para o diarista
                      </button>
                    </td>
                    <td className="tabela-acoes">
                      <button type="button" className="link" onClick={() => editar(l)}>
                        Editar
                      </button>
                      <button type="button" className="link perigo" onClick={() => excluir(l)}>
                        Excluir
                      </button>
                    </td>
                  </tr>
                ))}
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
            aria-labelledby="titulo-cadastro-loja"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-topo">
              <h2 id="titulo-cadastro-loja">{editandoId ? "Editar loja" : "Cadastrar loja"}</h2>
              <button type="button" className="modal-fechar" aria-label="Fechar" onClick={fecharForm}>
                ×
              </button>
            </div>

            <form className="form" onSubmit={salvar} noValidate>
              <fieldset className="secao">
                <legend>Loja</legend>
                <label className="campo">
                  <span>Rede *</span>
                  <input
                    value={form.rede}
                    onChange={(e) => atualizar("rede", e.target.value)}
                    placeholder="Ex.: Pinheiro"
                    aria-invalid={!!erro && !form.rede.trim()}
                  />
                </label>
                <label className="campo">
                  <span>Nome da loja *</span>
                  <input value={form.nome} onChange={(e) => atualizar("nome", e.target.value)} placeholder="Ex.: Pinheiro Papicu" />
                </label>
                <label className="campo">
                  <span>Endereço *</span>
                  <input value={form.endereco} onChange={(e) => atualizar("endereco", e.target.value)} placeholder="Rua, número, bairro" />
                </label>
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
                  {editandoId ? "Salvar alterações" : "Cadastrar loja"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {mensagemDe && (
        <div className="modal-fundo" onClick={() => setMensagemDe(null)}>
          <div
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="titulo-mensagem-loja"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-topo">
              <h2 id="titulo-mensagem-loja">Mensagem para o diarista</h2>
              <button type="button" className="modal-fechar" aria-label="Fechar" onClick={() => setMensagemDe(null)}>
                ×
              </button>
            </div>
            <textarea className="mensagem-pronta" readOnly rows={6} value={mensagemDaLoja(mensagemDe)} aria-label="Mensagem pronta" />
            <div className="acoes">
              <button type="button" className="botao secundario" onClick={() => setMensagemDe(null)}>
                Fechar
              </button>
              <button
                type="button"
                className="botao primario"
                onClick={() => {
                  copiarMensagem(mensagemDe);
                  setMensagemDe(null);
                }}
              >
                Copiar mensagem
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
