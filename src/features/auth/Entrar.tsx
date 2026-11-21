import { useState, type FormEvent } from "react";
import { cadastrar, entrar, type Usuario } from "../../core/auth";
import "../../styles/auth.css";

type Props = { aoEntrar: (usuario: Usuario) => void };

export function Entrar({ aoEntrar }: Props) {
  const [modo, setModo] = useState<"entrar" | "cadastrar">("entrar");
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState("");
  const [aviso, setAviso] = useState("");
  const [enviando, setEnviando] = useState(false);

  function trocarModo(m: "entrar" | "cadastrar") {
    setModo(m);
    setErro("");
    setAviso("");
  }

  async function enviar(e: FormEvent) {
    e.preventDefault();
    if (modo === "cadastrar" && !nome.trim()) return setErro("Informe seu nome.");
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setErro("Informe um e-mail válido.");
    if (senha.length < 6) return setErro("A senha precisa ter pelo menos 6 caracteres.");

    setErro("");
    setAviso("");
    setEnviando(true);
    try {
      if (modo === "cadastrar") {
        const resultado = await cadastrar(nome, email, senha);
        if (resultado.precisaConfirmar) {
          setAviso("Conta criada. Confirme o e-mail que enviamos e depois entre com sua senha.");
          setModo("entrar");
        } else if (resultado.usuario) {
          aoEntrar(resultado.usuario);
        }
      } else {
        aoEntrar(await entrar(email, senha));
      }
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Algo deu errado. Tente de novo.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <main className="auth">
      <section className="auth-cartao rise">
        <div className="auth-marca">
          <img src="/logo-direct.png" alt="Direct Promoções" className="auth-logo" />
          <h1>Painel Direct Promoções</h1>
          <p className="muted">Diaristas, lojas e financeiro num só lugar.</p>
        </div>

        <div className="segmento" role="radiogroup" aria-label="Como você quer continuar">
          {(["entrar", "cadastrar"] as const).map((m) => (
            <button
              key={m}
              type="button"
              role="radio"
              aria-checked={modo === m}
              className={`segmento-btn ${modo === m ? `ativo ${m === "entrar" ? "entrada" : "saida"}` : ""}`}
              onClick={() => trocarModo(m)}
            >
              {m === "entrar" ? "Entrar" : "Criar conta"}
            </button>
          ))}
        </div>

        <form className="auth-form" onSubmit={enviar} noValidate>
          {modo === "cadastrar" && (
            <label className="campo">
              <span>Seu nome</span>
              <input value={nome} onChange={(e) => setNome(e.target.value)} autoComplete="name" />
            </label>
          )}

          <label className="campo">
            <span>E-mail</span>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" inputMode="email" />
          </label>

          <label className="campo">
            <span>Senha</span>
            <input
              type="password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              autoComplete={modo === "cadastrar" ? "new-password" : "current-password"}
              placeholder="Mínimo de 6 caracteres"
            />
          </label>

          {erro && (
            <p className="erro" role="alert" key={erro}>
              {erro}
            </p>
          )}
          {aviso && <p className="ajuda" role="status">{aviso}</p>}

          <button type="submit" className="botao primario auth-enviar" disabled={enviando}>
            {enviando ? "Aguarde…" : modo === "cadastrar" ? "Criar conta" : "Entrar"}
          </button>
        </form>

        <p className="auth-nota muted">Seus dados ficam salvos com segurança na sua conta.</p>
      </section>
    </main>
  );
}
