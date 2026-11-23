import { useEffect, useRef, useState, type FormEvent } from "react";
import { copiarTexto } from "../../core/clipboard";
import { SETORES } from "../../core/constants";
import { dataCurta, uid } from "../../core/format";
import { upsert } from "../../core/store";
import type { Dados, Pedido, SetDados } from "../../core/types";
import { CalendarioPedido } from "./CalendarioPedido";

type Props = { dados: Dados; setDados: SetDados; notificar: (texto: string) => void };
type Form = {
  id?: string;
  lojaId: string;
  setor: string;
  datas: string[];
  horaInicio: string;
  horaFim: string;
  diaristaId: string;
};

const vazio: Form = { lojaId: "", setor: "", datas: [], horaInicio: "", horaFim: "", diaristaId: "" };

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
  const tituloForm = useRef<HTMLHeadingElement>(null);
  const tituloFormId = form ? form.id ?? "novo" : null;
  const setores = [...new Set([...SETORES, ...dados.setoresExtras, ...(form?.setor ? [form.setor] : [])])];
  const lojas = [...dados.lojas].sort((a, b) => a.rede.localeCompare(b.rede) || a.nome.localeCompare(b.nome));
  const diaristas = [...dados.diaristas].sort((a, b) => a.nome.localeCompare(b.nome));
  const lojasPorId = new Map(lojas.map((loja) => [loja.id, loja]));
  const diaristasPorId = new Map(diaristas.map((diarista) => [diarista.id, diarista]));

  useEffect(() => {
    if (tituloFormId) tituloForm.current?.focus();
  }, [tituloFormId]);

  function editar(pedido: Pedido) {
    setErro("");
    setForm({
      id: pedido.id,
      lojaId: pedido.lojaId,
      setor: pedido.setor,
      datas: datasDoPedido(pedido),
      horaInicio: pedido.horaInicio ?? "",
      horaFim: pedido.horaFim ?? "",
      diaristaId: pedido.diaristaId ?? "",
    });
  }

  function salvar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (!form) return;
    if (!lojasPorId.has(form.lojaId) || !form.setor || !form.horaInicio || !form.horaFim) {
      setErro("Preencha a loja, o setor e os horários.");
      return;
    }
    if (form.horaInicio === form.horaFim) {
      setErro("Escolha horários diferentes para início e fim.");
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
            <button type="button" className="botao mais verde mini" onClick={() => { setErro(""); setForm(vazio); }}>
              + Registrar pedido
            </button>
          )}
        </div>

        {form && (
          <form className="secao pedido-form" onSubmit={salvar} aria-labelledby="titulo-pedido">
            <h3 id="titulo-pedido" ref={tituloForm} tabIndex={-1}>{form.id ? "Editar pedido" : "Novo pedido"}</h3>
            {lojas.length === 0 && <p className="muted">Cadastre uma loja antes de registrar um pedido.</p>}
            <div className="campo-duplo">
              <label className="campo">
                <span>Loja</span>
                <select value={form.lojaId} onChange={(e) => setForm({ ...form, lojaId: e.target.value })} required>
                  <option value="">Selecione uma loja</option>
                  {lojas.map((loja) => <option key={loja.id} value={loja.id}>{loja.rede} · {loja.nome}</option>)}
                </select>
              </label>
              <label className="campo">
                <span>Setor</span>
                <select value={form.setor} onChange={(e) => setForm({ ...form, setor: e.target.value })} required>
                  <option value="">Selecione um setor</option>
                  {setores.map((setor) => <option key={setor}>{setor}</option>)}
                </select>
              </label>
            </div>
            <div className="campo-duplo">
              <label className="campo">
                <span>Horário de início</span>
                <input type="time" value={form.horaInicio} onChange={(e) => setForm({ ...form, horaInicio: e.target.value })} required />
              </label>
              <label className="campo">
                <span>Horário de fim</span>
                <input type="time" value={form.horaFim} onChange={(e) => setForm({ ...form, horaFim: e.target.value })} required />
              </label>
            </div>
            {form.horaInicio && form.horaFim && form.horaFim < form.horaInicio && <p className="muted">O turno termina no dia seguinte.</p>}
            <CalendarioPedido key={tituloFormId} datas={form.datas} onChange={(datas) => setForm({ ...form, datas })} />
            <label className="campo">
              <span>Diarista (opcional)</span>
              <select value={form.diaristaId} onChange={(e) => setForm({ ...form, diaristaId: e.target.value })}>
                <option value="">A definir</option>
                {diaristas.map((diarista) => (
                  <option key={diarista.id} value={diarista.id}>{diarista.nome}{diarista.bloqueada ? " (bloqueado)" : ""}</option>
                ))}
              </select>
            </label>
            {erro && <p role="alert" className="aviso-texto">{erro}</p>}
            <div className="pedido-botoes">
              <button type="button" className="botao secundario" onClick={() => setForm(null)}>Cancelar</button>
              <button type="submit" className="botao mais verde" disabled={lojas.length === 0}>Salvar pedido</button>
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
