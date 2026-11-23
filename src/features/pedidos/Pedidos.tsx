import { useEffect, useRef, useState, type FormEvent } from "react";
import { copiarTexto } from "../../core/clipboard";
import { CamposJornada } from "../../components/CamposJornada";
import { dataCurta, moeda, uid } from "../../core/format";
import { calcularHoraFim, chaveSetor, setorPadraoDoPedido, setoresDoPedido, tarifaDaOperacao } from "../../core/operacao";
import { upsert } from "../../core/store";
import type { Dados, Loja, Pedido, SetDados } from "../../core/types";
import { CalendarioPedido } from "./CalendarioPedido";

type Props = { dados: Dados; setDados: SetDados; notificar: (texto: string) => void };
type Form = {
  id?: string;
  lojaId: string;
  setor: string;
  datas: string[];
  horaInicio: string;
  diaristaId: string;
};

const vazio: Form = { lojaId: "", setor: "", datas: [], horaInicio: "", diaristaId: "" };

function datasDoPedido(pedido: Pedido): string[] {
  if (pedido.datas) return pedido.datas;
  // Pedidos da primeira versão guardavam apenas o início e o fim.
  const dia = new Date(`${pedido.inicio}T00:00:00Z`);
  const fim = new Date(`${pedido.fim}T00:00:00Z`);
  const datas: string[] = [];
  while (dia <= fim) {
    datas.push(dia.toISOString().slice(0, 10));
    dia.setUTCDate(dia.getUTCDate() + 1);
  }
  return datas;
}

const rotuloDiarias = (total: number) => `${total} ${total === 1 ? "diária" : "diárias"}`;

function horarioPedido(pedido: Pedido) {
  const { horaInicio, horaFim } = pedido;
  if (!horaInicio || !horaFim) return "Horário não informado";
  return `${horaInicio} às ${horaFim}${horaFim < horaInicio ? " do dia seguinte" : ""}`;
}

export function Pedidos({ dados, setDados, notificar }: Props) {
  const [form, setForm] = useState<Form | null>(null);
  const [erro, setErro] = useState("");
  const [novoSetor, setNovoSetor] = useState<string | null>(null);
  const [erroSetor, setErroSetor] = useState("");
  const tituloForm = useRef<HTMLHeadingElement>(null);
  const tituloFormId = form ? form.id ?? "novo" : null;
  const setores = setoresDoPedido(dados.setoresPedidosExtras);
  const lojas = [...dados.lojas].sort((a, b) => a.rede.localeCompare(b.rede) || a.nome.localeCompare(b.nome));
  const diaristas = [...dados.diaristas].sort((a, b) => a.nome.localeCompare(b.nome));
  const lojasPorId = new Map(lojas.map((loja) => [loja.id, loja]));
  const diaristasPorId = new Map(diaristas.map((diarista) => [diarista.id, diarista]));
  const gruposLojas = new Map<string, Loja[]>();
  for (const loja of lojas) {
    const grupo = gruposLojas.get(loja.rede) ?? [];
    grupo.push(loja);
    gruposLojas.set(loja.rede, grupo);
  }
  const lojaSelecionada = form && lojasPorId.get(form.lojaId);
  const tarifa = lojaSelecionada ? tarifaDaOperacao(dados, lojaSelecionada.rede, form?.setor ?? "") : undefined;

  useEffect(() => {
    if (tituloFormId) tituloForm.current?.focus();
  }, [tituloFormId]);

  function abrirCadastro() {
    setErro("");
    setNovoSetor(null);
    setErroSetor("");
    setForm(vazio);
  }

  function atualizar<K extends keyof Form>(campo: K, valor: Form[K]) {
    setErro("");
    setForm((atual) => atual && { ...atual, [campo]: valor });
  }

  function editar(pedido: Pedido) {
    setErro("");
    setNovoSetor(null);
    setErroSetor("");
    setForm({
      id: pedido.id,
      lojaId: pedido.lojaId,
      setor: setorPadraoDoPedido(pedido.setor, setores),
      datas: datasDoPedido(pedido),
      horaInicio: pedido.horaInicio ?? "",
      diaristaId: pedido.diaristaId ?? "",
    });
  }

  function adicionarSetor() {
    const setor = (novoSetor ?? "").trim().replace(/\s+/g, " ");
    if (!setor) {
      setErroSetor("Informe o nome do setor.");
      return;
    }
    const existente = setorPadraoDoPedido(setor, setores);
    if (!existente) {
      setDados((atual) => ({
        ...atual,
        setoresPedidosExtras: atual.setoresPedidosExtras.some((item) => chaveSetor(item) === chaveSetor(setor))
          ? atual.setoresPedidosExtras
          : [...atual.setoresPedidosExtras, setor],
      }));
      notificar("Setor adicionado");
    }
    atualizar("setor", existente || setor);
    setNovoSetor(null);
    setErroSetor("");
  }

  function salvar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (!form) return;
    if (!lojasPorId.has(form.lojaId)) {
      setErro(lojas.length ? "Selecione uma loja." : "Cadastre uma loja antes de registrar um pedido.");
      return;
    }
    if (!form.setor) {
      setErro("Selecione um setor.");
      return;
    }
    const horaFim = calcularHoraFim(form.horaInicio);
    if (!horaFim) {
      setErro("Informe o horário de início.");
      return;
    }
    if (!form.datas.length) {
      setErro("Selecione ao menos uma data no calendário.");
      return;
    }
    const pedido: Pedido = {
      ...dados.pedidos.find((item) => item.id === form.id),
      id: form.id ?? uid(),
      lojaId: form.lojaId,
      setor: form.setor,
      datas: form.datas,
      inicio: form.datas[0],
      fim: form.datas[form.datas.length - 1],
      horaInicio: form.horaInicio,
      horaFim,
      diaristaId: diaristasPorId.has(form.diaristaId) ? form.diaristaId : undefined,
    };
    setDados((atual) => ({ ...atual, pedidos: upsert(atual.pedidos, pedido) }));
    setForm(null);
    notificar(form.id ? "Pedido atualizado" : "Pedido registrado");
  }

  async function copiar(pedido: Pedido) {
    const loja = lojasPorId.get(pedido.lojaId);
    const diarista = pedido.diaristaId && diaristasPorId.get(pedido.diaristaId);
    const datas = datasDoPedido(pedido);
    const texto = [
      loja ? `Loja: ${loja.rede} · ${loja.nome}` : "Loja não cadastrada",
      loja?.endereco && `Endereço: ${loja.endereco}`,
      `Setor: ${setorPadraoDoPedido(pedido.setor, setores) || pedido.setor}`,
      `Horário: ${horarioPedido(pedido)}`,
      `Datas: ${datas.map(dataCurta).join(", ")}`,
      rotuloDiarias(datas.length),
      diarista ? `Diarista: ${diarista.nome}` : "Diarista a definir",
    ].filter(Boolean).join("\n");
    notificar(await copiarTexto(texto) ? "Pedido copiado" : "Não foi possível copiar o pedido.");
  }

  function excluir(pedido: Pedido) {
    if (!window.confirm("Excluir este pedido? Essa ação não pode ser desfeita.")) return;
    setDados((atual) => ({ ...atual, pedidos: atual.pedidos.filter(({ id }) => id !== pedido.id) }));
    if (form?.id === pedido.id) setForm(null);
    notificar("Pedido excluído");
  }

  return (
    <section>
      <header className="cabeca rise">
        <h1>Pedidos</h1>
        <p className="muted">Registre as solicitações de diárias por loja e setor.</p>
      </header>

      <section className="painel rise">
        <div className="painel-topo">
          <h2>Pedidos registrados</h2>
          {!form && (
            <button type="button" className="botao primario mini pedido-registrar" onClick={abrirCadastro}>
              + Registrar pedido
            </button>
          )}
        </div>

        {form && (
          <form className="secao pedido-form" onSubmit={salvar} aria-labelledby="titulo-pedido" noValidate>
            <h3 id="titulo-pedido" ref={tituloForm} tabIndex={-1}>{form.id ? "Editar pedido" : "Novo pedido"}</h3>
            {lojas.length === 0 && <p className="muted">Cadastre uma loja antes de registrar um pedido.</p>}
            <div className="pedido-form-grade">
              <CalendarioPedido key={tituloFormId} datas={form.datas} onChange={(datas) => atualizar("datas", datas)} />
              <div className="pedido-form-campos">
                <label className="campo">
                  <span>Loja</span>
                  <select value={form.lojaId} onChange={(e) => atualizar("lojaId", e.target.value)} required>
                    <option value="">Selecione uma loja</option>
                    {[...gruposLojas].map(([rede, grupo]) => (
                      <optgroup key={rede} label={rede}>
                        {grupo.map((loja) => <option key={loja.id} value={loja.id}>{loja.rede} · {loja.nome}</option>)}
                      </optgroup>
                    ))}
                  </select>
                </label>
                <label className="campo">
                  <span>Setor</span>
                  <select value={form.setor} onChange={(e) => atualizar("setor", e.target.value)} required>
                    <option value="">Selecione um setor</option>
                    {setores.map((setor) => <option key={setor}>{setor}</option>)}
                  </select>
                </label>
                {novoSetor === null ? (
                  <button type="button" className="link pedido-novo-setor" onClick={() => setNovoSetor("")}>+ Novo setor</button>
                ) : (
                  <div className="pedido-setor-extra">
                    <label className="campo">
                      <span>Nome do novo setor</span>
                      <input value={novoSetor} maxLength={64} onChange={(evento) => {
                        setNovoSetor(evento.target.value);
                        setErroSetor("");
                      }} onKeyDown={(evento) => {
                        if (evento.key !== "Enter") return;
                        evento.preventDefault();
                        adicionarSetor();
                      }} />
                    </label>
                    {erroSetor && <p role="alert" className="aviso-texto">{erroSetor}</p>}
                    <div className="pedido-botoes">
                      <button type="button" className="link" onClick={() => {
                        setNovoSetor(null);
                        setErroSetor("");
                      }}>Cancelar novo setor</button>
                      <button type="button" className="botao primario mini" onClick={adicionarSetor}>Adicionar setor</button>
                    </div>
                  </div>
                )}
                <CamposJornada inicio={form.horaInicio} atualizar={(inicio) => atualizar("horaInicio", inicio)} />
                <label className="campo">
                  <span>Diarista (opcional)</span>
                  <select value={form.diaristaId} onChange={(e) => atualizar("diaristaId", e.target.value)}>
                    <option value="">A definir</option>
                    {diaristas.map((diarista) => (
                      <option key={diarista.id} value={diarista.id}>{diarista.nome}{diarista.bloqueada ? " (bloqueado)" : ""}</option>
                    ))}
                  </select>
                </label>
                {tarifa && (tarifa.recebe != null || tarifa.paga != null) && (
                  <p className="pedido-referencia muted">
                    Referência por diária
                    {tarifa.recebe != null && ` · A receber ${moeda(tarifa.recebe / 100)}`}
                    {tarifa.paga != null && ` · Repasse ${moeda(tarifa.paga / 100)}`}
                  </p>
                )}
              </div>
            </div>
            {erro && <p role="alert" className="aviso-texto">{erro}</p>}
            <div className="pedido-botoes">
              <button type="button" className="botao secundario" onClick={() => setForm(null)}>Cancelar</button>
              <button type="submit" className="botao primario">Salvar pedido</button>
            </div>
          </form>
        )}

        {dados.pedidos.length === 0 ? (
          <p className="vazio">Nenhum pedido registrado.</p>
        ) : (
          <ul className="lista">
            {dados.pedidos.map((pedido) => {
              const loja = lojasPorId.get(pedido.lojaId);
              const diarista = pedido.diaristaId && diaristasPorId.get(pedido.diaristaId);
              const datas = datasDoPedido(pedido);
              return (
                <li key={pedido.id} className="linha pedido-linha">
                  <div className="linha-texto">
                    <strong>{loja ? `${loja.rede} · ${loja.nome}` : "Loja não cadastrada"}</strong>
                    <span className="muted">{setorPadraoDoPedido(pedido.setor, setores) || pedido.setor} · {horarioPedido(pedido)} · {rotuloDiarias(datas.length)}</span>
                    <span className="muted">{datas.map(dataCurta).join(", ")}</span>
                    <span className="muted">{diarista ? diarista.nome : "Diarista a definir"}</span>
                  </div>
                  <div className="pedido-botoes">
                    <button type="button" className="link" onClick={() => void copiar(pedido)}>Copiar</button>
                    <button type="button" className="link" onClick={() => editar(pedido)}>Editar</button>
                    <button type="button" className="link perigo" onClick={() => excluir(pedido)}>Excluir</button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </section>
  );
}
