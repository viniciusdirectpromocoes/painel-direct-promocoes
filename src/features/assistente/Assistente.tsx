import { useRef, useState, type FormEvent } from "react";
import { FORMA_PAGAMENTO } from "../../core/constants";
import { alocarNasDiarias, aplicarAlocacoes, centavos } from "../../core/financeiro";
import { dataCurta, lerValor, moeda, uid } from "../../core/format";
import { calcularHoraFim, setoresDoPedido } from "../../core/operacao";
import { interpretar, type Rascunho, type TipoRascunho } from "../../core/assistente";
import type { Dados, Lancamento, Pedido, ReferenciaPagamento, SetDados } from "../../core/types";
import { CalendarioPedido } from "../pedidos/CalendarioPedido";

type Props = { dados: Dados; setDados: SetDados; notificar: (texto: string) => void };
type Mensagem = { id: string; autor: "você" | "assistente"; texto: string };
const rotuloDias = (n: number) => `${n} ${n === 1 ? "diária" : "diárias"}`;
const horaValida = (valor: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(valor);

function problemaDoRascunho(rascunho: Rascunho, dados: Dados) {
  if (rascunho.tipo === "pedido") {
    if (!dados.lojas.some((loja) => loja.id === rascunho.lojaId)) return "Selecione a loja cadastrada.";
    if (!setoresDoPedido(dados.setoresPedidosExtras).includes(rascunho.setor)) return "Selecione o setor.";
    if (!horaValida(rascunho.inicioHora) || !horaValida(rascunho.fimHora || calcularHoraFim(rascunho.inicioHora))) return "Informe o horário de início e de fim.";
    if ((rascunho.fimHora || calcularHoraFim(rascunho.inicioHora)) === rascunho.inicioHora) return "Use horários diferentes de início e fim.";
    if (!rascunho.datas.length) return "Selecione os dias do pedido.";
    if (!Number.isInteger(rascunho.quantidadeDiaristas) || rascunho.quantidadeDiaristas < 1 || rascunho.quantidadeDiaristas > 99) return "Informe de 1 a 99 diaristas.";
    if (rascunho.diasInformados != null && rascunho.diasInformados !== rascunho.datas.length) return "A quantidade informada diverge das datas. Revise o calendário.";
  } else {
    if (!dados.diaristas.some((diarista) => diarista.id === rascunho.diaristaId)) return "Selecione o diarista cadastrado.";
    const valor = lerValor(rascunho.valor);
    if (!Number.isFinite(valor) || centavos(valor) <= 0) return "Informe um valor de pagamento maior que zero.";
    if (!rascunho.data) return "Informe a data em que o pagamento foi feito.";
    if (rascunho.quantidade && (!Number.isInteger(Number(rascunho.quantidade)) || Number(rascunho.quantidade) < 1)) return "A quantidade de diárias precisa ser um número inteiro positivo.";
    if (rascunho.quantidade && rascunho.dias.length && Number(rascunho.quantidade) !== rascunho.dias.length) return "A quantidade de diárias diverge dos dias marcados. Confira o calendário.";
  }
  return "";
}

function referenciaDoPagamento(rascunho: Extract<Rascunho, { tipo: "pagamento" }>): ReferenciaPagamento {
  return { dias: rascunho.dias, lojaId: rascunho.lojaId || undefined, quantidade: rascunho.quantidade ? Number(rascunho.quantidade) : undefined };
}

export function Assistente({ dados, setDados, notificar }: Props) {
  const [texto, setTexto] = useState("");
  const [modo, setModo] = useState<TipoRascunho | "auto">("auto");
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const [rascunho, setRascunho] = useState<Rascunho | null>(null);
  const [editando, setEditando] = useState(false);
  const [erro, setErro] = useState("");
  const registroAtual = useRef("");
  const lojas = [...dados.lojas].sort((a, b) => a.rede.localeCompare(b.rede, "pt-BR") || a.nome.localeCompare(b.nome, "pt-BR"));
  const diaristas = [...dados.diaristas].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  const setores = setoresDoPedido(dados.setoresPedidosExtras);
  const loja = rascunho && lojas.find((item) => item.id === rascunho.lojaId);
  const diarista = rascunho?.tipo === "pagamento" && diaristas.find((item) => item.id === rascunho.diaristaId);
  const problema = rascunho ? problemaDoRascunho(rascunho, dados) : "";
  const alocacao = rascunho?.tipo === "pagamento" && !problema
    ? alocarNasDiarias(dados.lancamentos, rascunho.diaristaId, centavos(lerValor(rascunho.valor)), referenciaDoPagamento(rascunho))
    : null;
  const detalhesAbate = alocacao?.alocacoes.map(({ diariaId, valor }) => {
    const diaria = dados.lancamentos.find((item) => item.id === diariaId);
    const datas = diaria?.diasTrabalhados.map(dataCurta).join(", ");
    return datas ? `${datas} (${moeda(valor)})` : moeda(valor);
  }).join(" · ");

  function adicionarMensagem(autor: Mensagem["autor"], conteudo: string) {
    const mensagem = { id: uid(), autor, texto: conteudo };
    setMensagens((atuais) => [...atuais.slice(-19), mensagem]);
  }

  function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const mensagem = texto.trim();
    if (!mensagem || rascunho) return;
    const tipo = modo === "auto"
      ? /\b(pagamento|paguei|pago\s+em)\b|\b\d+[,.]\d{2}\b/i.test(mensagem) ? "pagamento" : "pedido"
      : modo;
    adicionarMensagem("você", mensagem);
    setRascunho(interpretar(mensagem, tipo, dados));
    registroAtual.current = uid();
    setTexto("");
    setErro("");
    setEditando(false);
  }

  function confirmar() {
    const id = registroAtual.current;
    if (!rascunho || editando || problema || !id) return;
    registroAtual.current = "";
    if (rascunho.tipo === "pedido") {
      const pedido: Pedido = {
        id, lojaId: rascunho.lojaId, setor: rascunho.setor, datas: rascunho.datas,
        inicio: rascunho.datas[0], fim: rascunho.datas[rascunho.datas.length - 1],
        horaInicio: rascunho.inicioHora, horaFim: rascunho.fimHora || calcularHoraFim(rascunho.inicioHora),
        quantidadeDiaristas: rascunho.quantidadeDiaristas,
      };
      setDados((atual) => ({ ...atual, pedidos: [pedido, ...atual.pedidos] }));
      adicionarMensagem("assistente", "Pedido registrado. Você pode conferir na aba Pedidos.");
      notificar("Pedido registrado");
    } else {
      const valor = centavos(lerValor(rascunho.valor));
      const referenciaPagamento = referenciaDoPagamento(rascunho);
      setDados((atual) => {
        const { alocacoes } = alocarNasDiarias(atual.lancamentos, rascunho.diaristaId, valor, referenciaPagamento);
        const item: Lancamento = {
          id, categoria: "Pagamento", descricao: `Pago a ${diarista ? diarista.nome : "diarista"}`, valor,
          formaPagamento: FORMA_PAGAMENTO, setor: "", diasTrabalhados: [], diaPagamento: 0,
          data: rascunho.data, rede: "", diaristaId: rascunho.diaristaId, alocacoes, referenciaPagamento,
        };
        return { ...atual, lancamentos: [item, ...aplicarAlocacoes(atual.lancamentos, alocacoes)] };
      });
      adicionarMensagem("assistente", "Pagamento registrado. Você pode conferir na aba Financeiro.");
      notificar("Pagamento registrado");
    }
    setRascunho(null);
  }

  function revisar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setErro(problema);
    if (!problema) setEditando(false);
  }

  const atualizar = (valor: Rascunho) => { setRascunho(valor); setErro(""); };
  const lojaTexto = loja ? `${loja.rede} · ${loja.nome}` : "A definir";

  return (
    <section>
      <header className="cabeca rise">
        <h1>Assistente</h1>
        <p className="muted">Descreva um pedido ou pagamento e revise o rascunho antes de registrar.</p>
      </header>
      <section className="painel rise assistente-painel" aria-label="Conversa do assistente">
        {!mensagens.length && <p className="assistente-balao">Pode colar a mensagem do pedido ou digitar o nome e o valor do pagamento. Envie um registro por vez.</p>}
        {mensagens.length > 0 && (
          <ol className="assistente-conversa" aria-label="Mensagens desta conversa">
            {mensagens.map((m) => (
              <li className={`assistente-balao ${m.autor === "você" ? "assistente-usuario" : ""}`} key={m.id}>
                <strong>{m.autor === "você" ? "Você" : "Assistente"}</strong>
                <p>{m.texto}</p>
              </li>
            ))}
          </ol>
        )}
        {rascunho && (
          <section className="assistente-rascunho" aria-label="Rascunho para revisão">
            <h2>{rascunho.tipo === "pedido" ? "Rascunho do pedido" : "Rascunho do pagamento"}</h2>
            {editando ? (
              <form className="pedido-form" onSubmit={revisar} noValidate>
                <label className="campo">
                  <span>{rascunho.tipo === "pagamento" ? "Loja de referência (opcional)" : "Loja"}</span>
                  <select value={rascunho.lojaId} onChange={(e) => atualizar({ ...rascunho, lojaId: e.target.value })}>
                    <option value="">Selecione a loja</option>
                    {lojas.map((item) => <option key={item.id} value={item.id}>{item.rede} · {item.nome}</option>)}
                  </select>
                </label>
                {rascunho.tipo === "pedido" ? (
                  <>
                    <div className="campo-duplo">
                      <label className="campo"><span>Setor</span><select value={rascunho.setor} onChange={(e) => atualizar({ ...rascunho, setor: e.target.value })}>
                        <option value="">Selecione o setor</option>
                        {setores.map((setor) => <option key={setor}>{setor}</option>)}
                      </select></label>
                      <label className="campo"><span>Quantidade de diaristas</span><input type="number" min="1" max="99" value={rascunho.quantidadeDiaristas || ""} onChange={(e) => atualizar({ ...rascunho, quantidadeDiaristas: Number(e.target.value) })} /></label>
                    </div>
                    <div className="pedido-form-horario">
                      <label className="campo"><span>Horário de início</span><input type="time" value={rascunho.inicioHora} onChange={(e) => atualizar({ ...rascunho, inicioHora: e.target.value, fimHora: calcularHoraFim(e.target.value) })} /></label>
                      <label className="campo"><span>Horário de fim</span><input type="time" value={rascunho.fimHora || calcularHoraFim(rascunho.inicioHora)} onChange={(e) => atualizar({ ...rascunho, fimHora: e.target.value })} /></label>
                    </div>
                    <CalendarioPedido datas={rascunho.datas} onChange={(datas) => atualizar({ ...rascunho, datas, diasInformados: undefined })} />
                    {rascunho.diasInformados != null && rascunho.diasInformados !== rascunho.datas.length && (
                      <button type="button" className="link" onClick={() => atualizar({ ...rascunho, diasInformados: undefined })}>Usar a quantidade do calendário</button>
                    )}
                  </>
                ) : (
                  <>
                    <label className="campo"><span>Diarista</span><select value={rascunho.diaristaId} onChange={(e) => atualizar({ ...rascunho, diaristaId: e.target.value })}>
                      <option value="">Selecione o diarista</option>
                      {diaristas.map((item) => <option key={item.id} value={item.id}>{item.nome}</option>)}
                    </select></label>
                    <div className="campo-duplo">
                      <label className="campo"><span>Valor pago</span><input inputMode="decimal" value={rascunho.valor} onChange={(e) => atualizar({ ...rascunho, valor: e.target.value })} /></label>
                      <label className="campo"><span>Data do pagamento</span><input type="date" value={rascunho.data} onChange={(e) => atualizar({ ...rascunho, data: e.target.value })} /></label>
                    </div>
                    <label className="campo"><span>Quantidade de diárias (opcional)</span><input type="number" min="1" value={rascunho.quantidade} onChange={(e) => atualizar({ ...rascunho, quantidade: e.target.value })} /></label>
                    <CalendarioPedido datas={rascunho.dias} onChange={(dias) => atualizar({ ...rascunho, dias })} titulo="Dias trabalhados (opcional)" />
                  </>
                )}
                {erro && <p role="alert" className="aviso-texto">{erro}</p>}
                <div className="pedido-botoes"><button type="submit" className="botao primario">Revisar novamente</button></div>
              </form>
            ) : (
              <>
                <p>Confira se entendi corretamente.</p>
                <dl className="assistente-dados">
                  <dt>Loja</dt><dd>{lojaTexto}</dd>
                  {rascunho.tipo === "pedido" ? (
                    <>
                      <dt>Setor</dt><dd>{rascunho.setor || "A definir"}</dd>
                      <dt>Horário</dt><dd>{rascunho.inicioHora ? `${rascunho.inicioHora} às ${rascunho.fimHora || calcularHoraFim(rascunho.inicioHora)}` : "A definir"}</dd>
                      <dt>Diaristas</dt><dd>{rascunho.quantidadeDiaristas} por dia · a definir</dd>
                      <dt>Datas</dt><dd>{rascunho.datas.length ? rascunho.datas.map(dataCurta).join(", ") : "A definir"}</dd>
                      <dt>Total</dt><dd>{rotuloDias(rascunho.datas.length * rascunho.quantidadeDiaristas)} em {rascunho.datas.length} {rascunho.datas.length === 1 ? "dia" : "dias"}</dd>
                    </>
                  ) : (
                    <>
                      <dt>Diarista</dt><dd>{diarista ? diarista.nome : "A definir"}</dd>
                      <dt>Valor pago</dt><dd>{rascunho.valor ? moeda(lerValor(rascunho.valor)) : "A definir"}</dd>
                      <dt>Pago em</dt><dd>{rascunho.data ? dataCurta(rascunho.data) : "A definir"}</dd>
                      <dt>Dias trabalhados</dt><dd>{rascunho.dias.map(dataCurta).join(", ") || "Não informados"}</dd>
                      {rascunho.quantidade && <><dt>Quantidade</dt><dd>{rotuloDias(Number(rascunho.quantidade))}</dd></>}
                      {alocacao && <><dt>Abate previsto</dt><dd>{moeda(alocacao.descontado)} em diárias pendentes{alocacao.restante > 0 ? ` · ${moeda(alocacao.restante)} sem vínculo` : ""}</dd></>}
                      {detalhesAbate && <><dt>Diárias a abater</dt><dd>{detalhesAbate}</dd></>}
                    </>
                  )}
                </dl>
                {problema && <p role="status" className="aviso-texto">{problema} Clique em Editar para corrigir.</p>}
                <div className="pedido-botoes">
                  <button type="button" className="botao secundario" onClick={() => { setRascunho(null); registroAtual.current = ""; }}>Descartar</button>
                  <button type="button" className="botao secundario" onClick={() => setEditando(true)}>Editar</button>
                  <button type="button" className="botao primario" disabled={!!problema} onClick={confirmar}>Confirmar e salvar</button>
                </div>
              </>
            )}
          </section>
        )}
        <form className="assistente-compor" onSubmit={enviar}>
          <label className="campo">
            <span>Tipo de registro</span>
            <select value={modo} onChange={(e) => setModo(e.target.value as typeof modo)} disabled={!!rascunho}>
              <option value="auto">Detectar automaticamente</option><option value="pedido">Pedido de diária</option><option value="pagamento">Pagamento a diarista</option>
            </select>
          </label>
          <label className="campo">
            <span>Mensagem</span>
            <textarea value={texto} onChange={(e) => setTexto(e.target.value)} maxLength={4000} placeholder="Digite ou cole a solicitação..." disabled={!!rascunho} />
          </label>
          <button type="submit" className="botao primario" disabled={!texto.trim() || !!rascunho}>Enviar mensagem</button>
        </form>
      </section>
    </section>
  );
}
