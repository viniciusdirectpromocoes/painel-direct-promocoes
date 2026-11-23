import { useState, type FormEvent } from "react";
import { CamposJornada } from "../../components/CamposJornada";
import { moeda } from "../../core/format";
import { calcularHoraFim, chaveOperacao } from "../../core/operacao";
import type { Dados, SetDados } from "../../core/types";

export function Operacao({ dados, setDados, notificar }: {
  dados: Dados;
  setDados: SetDados;
  notificar: (texto: string) => void;
}) {
  const [rede, setRede] = useState("");
  const [inicio, setInicio] = useState("");
  const [erro, setErro] = useState("");
  const redes = [...new Set([...dados.lojas.map((loja) => loja.rede), ...dados.tarifasRedes.map((tarifa) => tarifa.rede)])]
    .filter(Boolean).sort((a, b) => a.localeCompare(b, "pt-BR"));

  function selecionarRede(nome: string) {
    setRede(nome);
    setInicio(dados.jornadas[chaveOperacao(nome)]?.horaInicio ?? "");
    setErro("");
  }

  function salvar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const horaFim = calcularHoraFim(inicio);
    const mensagem = !rede ? "Selecione uma rede." : !horaFim ? "Informe o horário de início." : "";
    setErro(mensagem);
    if (mensagem) return;
    const chave = chaveOperacao(rede);
    setDados((atual) => ({
      ...atual,
      jornadas: { ...atual.jornadas, [chave]: { ...atual.jornadas[chave], horaInicio: inicio, horaFim } },
    }));
    notificar("Horário padrão salvo");
  }

  return (
    <section>
      <header className="cabeca rise">
        <h1>Operação</h1>
        <p className="muted">Consulte tarifas por diária e configure os horários usados nos pedidos.</p>
      </header>
      <div className="operacao-grade">
        <section className="painel rise operacao-tarifas">
          <h2>Tarifas por rede</h2>
          {dados.tarifasRedes.length === 0 ? <p className="vazio">Nenhuma tarifa de rede disponível nesta conta.</p> : (
            <ul className="lista">
              {dados.tarifasRedes.map((tarifa) => (
                <li className="operacao-linha" key={tarifa.rede}>
                  <strong>{tarifa.rede}</strong>
                  <span className="operacao-valor entrada">A receber <b>{moeda(tarifa.recebe / 100)}</b></span>
                  <span className="operacao-valor saida">Repasse padrão <b>{moeda(tarifa.paga / 100)}</b></span>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="painel rise">
          <h2>Horário padrão por rede</h2>
          <form className="pedido-form" onSubmit={salvar} noValidate>
            <label className="campo">
              <span>Rede</span>
              <select value={rede} onChange={(e) => selecionarRede(e.target.value)}>
                <option value="">Selecione uma rede</option>
                {redes.map((nome) => <option key={nome}>{nome}</option>)}
              </select>
            </label>
            <CamposJornada inicio={inicio} atualizar={(valor) => {
              setErro("");
              setInicio(valor);
            }} />
            {erro && <p className="aviso-texto" role="alert">{erro}</p>}
            <div className="pedido-botoes">
              <button type="submit" className="botao primario">Salvar horário padrão</button>
            </div>
          </form>
        </section>
        <section className="painel rise operacao-tarifas">
          <h2>Repasse por setor</h2>
          <p className="muted">Quando há um valor para o setor, ele tem prioridade sobre o repasse padrão da rede.</p>
          {dados.tarifasSetores.length === 0 ? <p className="vazio">Nenhum repasse por setor disponível nesta conta.</p> : (
            <ul className="lista">
              {dados.tarifasSetores.map((tarifa) => (
                <li className="operacao-linha" key={`${tarifa.rede ?? ""}:${tarifa.setor}`}>
                  <strong>{tarifa.setor}{tarifa.rede ? ` · ${tarifa.rede}` : ""}</strong>
                  <span className="operacao-valor saida"><b>{moeda(tarifa.paga / 100)}</b> por diária</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </section>
  );
}
