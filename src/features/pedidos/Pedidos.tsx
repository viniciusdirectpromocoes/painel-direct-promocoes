import { useEffect, useRef, useState, type FormEvent } from "react";
import { copiarTexto } from "../../core/clipboard";
import { CamposJornada } from "../../components/CamposJornada";
import { dataCurta, moeda, uid } from "../../core/format";
import { chaveOperacao, erroDaJornada, jornadaVazia, setoresDaOperacao, tarifaDaOperacao } from "../../core/operacao";
import { upsert } from "../../core/store";
import type { Dados, Jornada, Loja, Pedido, SetDados } from "../../core/types";
import { CalendarioPedido } from "./CalendarioPedido";

type Props = { dados: Dados; setDados: SetDados; notificar: (texto: string) => void };
type Form = Jornada & {
  id?: string;
  lojaId: string;
  setor: string;
  datas: string[];
  diaristaId: string;
};

const vazio: Form = { ...jornadaVazia, lojaId: "", setor: "", datas: [], diaristaId: "" };

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
  const [buscaLoja, setBuscaLoja] = useState("");
  const [buscaSetor, setBuscaSetor] = useState("");
  const tituloForm = useRef<HTMLHeadingElement>(null);
  const tituloFormId = form ? form.id ?? "novo" : null;
  const setores = setoresDaOperacao(dados, form?.setor);
  const lojas = [...dados.lojas].sort((a, b) => a.rede.localeCompare(b.rede) || a.nome.localeCompare(b.nome));
  const diaristas = [...dados.diaristas].sort((a, b) => a.nome.localeCompare(b.nome));
  const lojasPorId = new Map(lojas.map((loja) => [loja.id, loja]));
  const diaristasPorId = new Map(diaristas.map((diarista) => [diarista.id, diarista]));
  const gruposLojas = new Map<string, Loja[]>();
  const termoLoja = chaveOperacao(buscaLoja);
  const termoSetor = chaveOperacao(buscaSetor);
  const lojasVisiveis = lojas.filter((loja) => loja.id === form?.lojaId || chaveOperacao(`${loja.rede} ${loja.nome} ${loja.endereco}`).includes(termoLoja));
  const setoresVisiveis = setores.filter((setor) => setor === form?.setor || chaveOperacao(setor).includes(termoSetor));
  for (const loja of lojasVisiveis) {
    const grupo = gruposLojas.get(loja.rede) ?? [];
    grupo.push(loja);
    gruposLojas.set(loja.rede, grupo);
  }
  const lojaSelecionada = form && lojasPorId.get(form.lojaId);
  const jornadaPadrao = lojaSelecionada ? dados.jornadas[chaveOperacao(lojaSelecionada.rede)] : undefined;
  const tarifa = lojaSelecionada ? tarifaDaOperacao(dados, lojaSelecionada.rede, form?.setor ?? "") : undefined;

  useEffect(() => {
    if (tituloFormId) tituloForm.current?.focus();
  }, [tituloFormId]);

  function abrirCadastro() {
    setErro("");
    setBuscaLoja("");
    setBuscaSetor("");
    setForm(vazio);
  }

  function atualizar<K extends keyof Form>(campo: K, valor: Form[K]) {
    setErro("");
    setForm((atual) => atual && { ...atual, [campo]: valor });
  }

  function editar(pedido: Pedido) {
    setErro("");
    setBuscaLoja("");
    setBuscaSetor("");
    setForm({
      id: pedido.id,
      lojaId: pedido.lojaId,
      setor: pedido.setor.trim(),
      datas: datasDoPedido(pedido),
      horaInicio: pedido.horaInicio ?? "",
      horaFim: pedido.horaFim ?? "",
      intervaloInicio: pedido.intervaloInicio ?? "",
      intervaloFim: pedido.intervaloFim ?? "",
      diaristaId: pedido.diaristaId ?? "",
    });
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
    const erroHorario = erroDaJornada(form);
    if (erroHorario) {
      setErro(erroHorario);
      return;
    }
    if (!form.datas.length) {
      setErro("Selecione ao menos uma data no calendário.");
      return;
    }
    const pedido: Pedido = {
      id: form.id ?? uid(),
      lojaId: form.lojaId,
      setor: form.setor,
      datas: form.datas,
      inicio: form.datas[0],
      fim: form.datas[form.datas.length - 1],
      horaInicio: form.horaInicio,
      horaFim: form.horaFim,
      intervaloInicio: form.intervaloInicio || undefined,
      intervaloFim: form.intervaloFim || undefined,
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
      `Setor: ${pedido.setor}`,
      `Horário: ${horarioPedido(pedido)}`,
      pedido.intervaloInicio && pedido.intervaloFim && `Intervalo: ${pedido.intervaloInicio} às ${pedido.intervaloFim}`,
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
                <input className="busca pedido-busca" type="search" aria-label="Buscar na lista de lojas" placeholder="Buscar loja ou rede" value={buscaLoja} onChange={(e) => setBuscaLoja(e.target.value)} />
                <label className="campo">
                  <span>Loja · {lojasVisiveis.length} de {lojas.length}</span>
                  <select value={form.lojaId} onChange={(e) => atualizar("lojaId", e.target.value)} required>
                    <option value="">Selecione uma loja</option>
                    {[...gruposLojas].map(([rede, grupo]) => (
                      <optgroup key={rede} label={rede}>
                        {grupo.map((loja) => <option key={loja.id} value={loja.id}>{loja.rede} · {loja.nome}</option>)}
                      </optgroup>
                    ))}
                  </select>
                </label>
                <input className="busca pedido-busca" type="search" aria-label="Buscar na lista de setores" placeholder="Buscar setor" value={buscaSetor} onChange={(e) => setBuscaSetor(e.target.value)} />
                <label className="campo">
                  <span>Setor · {setoresVisiveis.length} de {setores.length}</span>
                  <select value={form.setor} onChange={(e) => atualizar("setor", e.target.value)} required>
                    <option value="">Selecione um setor</option>
                    {setoresVisiveis.map((setor) => <option key={setor}>{setor}</option>)}
                  </select>
                </label>
                {jornadaPadrao && (
                  <button type="button" className="link pedido-aplicar" onClick={() => {
                    setErro("");
                    setForm((atual) => atual && { ...atual, ...jornadaPadrao });
                  }}>Usar horário padrão da rede</button>
                )}
                <CamposJornada jornada={form} atualizar={atualizar} />
                {form.horaInicio && form.horaFim && form.horaFim < form.horaInicio && <p className="muted">O turno termina no dia seguinte.</p>}
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
                    <span className="muted">{pedido.setor} · {horarioPedido(pedido)} · {rotuloDiarias(datas.length)}</span>
                    {pedido.intervaloInicio && pedido.intervaloFim && <span className="muted">Intervalo {pedido.intervaloInicio}–{pedido.intervaloFim}</span>}
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
