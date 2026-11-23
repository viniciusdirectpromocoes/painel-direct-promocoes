import { useState, type FormEvent } from "react";
import { SETORES } from "../../core/constants";
import { dataCurta, uid } from "../../core/format";
import type { Dados, Pedido, SetDados } from "../../core/types";

type Props = { dados: Dados; setDados: SetDados; notificar: (texto: string) => void };
type Form = Omit<Pedido, "id">;

const vazio: Form = { lojaId: "", setor: "", inicio: "", fim: "" };

export function Pedidos({ dados, setDados, notificar }: Props) {
  const [form, setForm] = useState<Form | null>(null);
  const [erro, setErro] = useState("");
  const setores = [...new Set([...SETORES, ...dados.setoresExtras])];
  const lojas = [...dados.lojas].sort((a, b) => a.rede.localeCompare(b.rede) || a.nome.localeCompare(b.nome));
  const nomes = new Map(lojas.map((loja) => [loja.id, `${loja.rede} · ${loja.nome}`]));

  function salvar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (!form) return;
    if (!nomes.has(form.lojaId) || !form.setor || !form.inicio || !form.fim) {
      setErro("Preencha a loja, o setor e as datas do pedido.");
      return;
    }
    if (form.fim < form.inicio) {
      setErro("O último dia previsto precisa ser igual ou posterior ao primeiro.");
      return;
    }
    const pedido: Pedido = { ...form, id: uid() };
    setDados((atual) => ({ ...atual, pedidos: [pedido, ...atual.pedidos] }));
    setForm(null);
    notificar("Pedido registrado");
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
            <button
              type="button"
              className="botao mais verde mini"
              onClick={() => { setErro(""); setForm(vazio); }}
            >
              + Registrar pedido
            </button>
          )}
        </div>

        {form && (
          <form className="secao pedido-form" onSubmit={salvar} aria-label="Registro de pedido">
            {lojas.length === 0 && <p className="muted">Cadastre uma loja antes de registrar um pedido.</p>}
            <label className="campo">
              <span>Loja</span>
              <select value={form.lojaId} onChange={(e) => setForm({ ...form, lojaId: e.target.value })} required>
                <option value="" />
                {lojas.map((loja) => <option key={loja.id} value={loja.id}>{nomes.get(loja.id)}</option>)}
              </select>
            </label>
            <label className="campo">
              <span>Setor</span>
              <select value={form.setor} onChange={(e) => setForm({ ...form, setor: e.target.value })} required>
                <option value="" />
                {setores.map((setor) => <option key={setor}>{setor}</option>)}
              </select>
            </label>
            <div className="campo-duplo">
              <label className="campo">
                <span>Primeiro dia previsto</span>
                <input type="date" value={form.inicio} onChange={(e) => {
                  const inicio = e.target.value;
                  setForm({ ...form, inicio, fim: !form.fim || form.fim < inicio ? inicio : form.fim });
                }} required />
              </label>
              <label className="campo">
                <span>Último dia previsto</span>
                <input type="date" min={form.inicio || undefined} value={form.fim} onChange={(e) => setForm({ ...form, fim: e.target.value })} required />
              </label>
            </div>
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
            {dados.pedidos.map((pedido) => (
              <li key={pedido.id} className="linha">
                <div className="linha-texto">
                  <strong>{nomes.get(pedido.lojaId) ?? "Loja não cadastrada"}</strong>
                  <span className="muted">
                    {pedido.setor} · {dataCurta(pedido.inicio)}
                    {pedido.inicio !== pedido.fim && ` a ${dataCurta(pedido.fim)}`}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </section>
  );
}
