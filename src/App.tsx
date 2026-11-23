import { useEffect, useState, type ReactNode } from "react";
import type { Pagina } from "./core/types";
import { useDados } from "./core/store";
import { encerrarSessao, sessaoAtual, type Usuario } from "./core/auth";
import { supabase } from "./core/supabase";
import { Entrar } from "./features/auth/Entrar";
import { Painel } from "./features/painel/Painel";
import { Diaristas } from "./features/diaristas/Diaristas";
import { Lojas } from "./features/lojas/Lojas";
import { Financeiro } from "./features/financeiro/Financeiro";

const ICONE_BASE = { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };

const PAGINAS: { id: Pagina; rotulo: string; icone: ReactNode }[] = [
  {
    id: "painel",
    rotulo: "Painel",
    icone: (
      <svg {...ICONE_BASE}>
        <rect x="3" y="3" width="7" height="9" rx="2" />
        <rect x="14" y="3" width="7" height="5" rx="2" />
        <rect x="14" y="12" width="7" height="9" rx="2" />
        <rect x="3" y="16" width="7" height="5" rx="2" />
      </svg>
    ),
  },
  {
    id: "diaristas",
    rotulo: "Diaristas",
    icone: (
      <svg {...ICONE_BASE}>
        <circle cx="9" cy="8" r="4" />
        <path d="M2 21c0-3.5 3-6 7-6s7 2.5 7 6" />
        <path d="M16 4.5a4 4 0 0 1 0 7" />
        <path d="M22 21c0-2.8-1.7-5-4.5-5.7" />
      </svg>
    ),
  },
  {
    id: "lojas",
    rotulo: "Lojas",
    icone: (
      <svg {...ICONE_BASE}>
        <path d="M3 9l1.5-5h15L21 9" />
        <path d="M3 9a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0" />
        <path d="M4.5 12v8h15v-8" />
        <path d="M10 20v-4h4v4" />
      </svg>
    ),
  },
  {
    id: "financeiro",
    rotulo: "Financeiro",
    icone: (
      <svg {...ICONE_BASE}>
        <rect x="2.5" y="6" width="19" height="13" rx="3" />
        <path d="M16 12.5h2.5" />
        <path d="M6 6V5a2 2 0 0 1 2-2h8.5" />
      </svg>
    ),
  },
];

export function App() {
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [iniciando, setIniciando] = useState(true);

  useEffect(() => {
    let ativo = true;
    sessaoAtual().then((u) => {
      if (!ativo) return;
      setUsuario(u);
      setIniciando(false);
    });
    const { data } = supabase.auth.onAuthStateChange(() => {
      sessaoAtual().then((u) => {
        if (ativo) setUsuario(u);
      });
    });
    return () => {
      ativo = false;
      data.subscription.unsubscribe();
    };
  }, []);

  const [tema, setTema] = useState<"claro" | "escuro">(() => {
    try {
      return localStorage.getItem("mvp-direct-tema") === "escuro" ? "escuro" : "claro";
    } catch {
      return "claro";
    }
  });

  useEffect(() => {
    document.documentElement.dataset.theme = tema === "escuro" ? "dark" : "light";
    try {
      localStorage.setItem("mvp-direct-tema", tema);
    } catch {
      /* sem armazenamento: o tema vale só nesta aba */
    }
  }, [tema]);

  function alternarTema() {
    setTema((t) => (t === "escuro" ? "claro" : "escuro"));
  }

  if (iniciando) {
    return <div className="carregando">Carregando…</div>;
  }

  if (!usuario) {
    return <Entrar aoEntrar={setUsuario} />;
  }

  return (
    <AreaLogada
      key={usuario.id}
      usuario={usuario}
      tema={tema}
      alternarTema={alternarTema}
      sair={async () => {
        await encerrarSessao();
        setUsuario(null);
      }}
    />
  );
}

type AreaProps = { usuario: Usuario; sair: () => void; tema: "claro" | "escuro"; alternarTema: () => void };

function AreaLogada({ usuario, sair, tema, alternarTema }: AreaProps) {
  const { dados, setDados, carregado, erroSync } = useDados(usuario.id);
  const [pagina, setPagina] = useState<Pagina>("painel");
  const [recolhida, setRecolhida] = useState(false);
  const [aviso, setAviso] = useState<{ texto: string; id: number } | null>(null);

  const indice = PAGINAS.findIndex((p) => p.id === pagina);

  function notificar(texto: string) {
    setAviso({ texto, id: Date.now() });
  }

  useEffect(() => {
    if (!aviso) return;
    const t = window.setTimeout(() => setAviso(null), 2600);
    return () => window.clearTimeout(t);
  }, [aviso]);

  if (!carregado) {
    return <div className="carregando">Carregando seus dados…</div>;
  }

  return (
    <div className={`shell ${recolhida ? "shell-recolhida" : ""}`}>
      <aside className="side">
        <div className="marca">
          <img src={tema === "escuro" ? "/logo-direct.png" : "/logo-direct-original.png"} alt="Direct Promoções" className="marca-logo" />
          <span className="marca-nome">Painel Direct Promoções</span>
          <button
            type="button"
            className="side-toggle"
            aria-expanded={!recolhida}
            aria-label={recolhida ? "Expandir menu" : "Recolher menu"}
            title={recolhida ? "Expandir menu" : "Recolher menu"}
            onClick={() => setRecolhida((v) => !v)}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              {recolhida ? <path d="M9 6l6 6-6 6" /> : <path d="M15 6l-6 6 6 6" />}
            </svg>
          </button>
        </div>

        <nav className="nav" aria-label="Principal">
          <span
            className="nav-ind"
            aria-hidden="true"
            style={{ transform: `translateY(${indice * 56}px)` }}
          />
          {PAGINAS.map((p) => (
            <button
              key={p.id}
              type="button"
              className={`nav-btn ${pagina === p.id ? "ativo" : ""}`}
              aria-current={pagina === p.id ? "page" : undefined}
              onClick={() => setPagina(p.id)}
            >
              <span className="nav-marca">{p.icone}</span>
              <span>{p.rotulo}</span>
            </button>
          ))}
        </nav>

        <div className="usuario-bloco">
          <button
            type="button"
            className="side-acao"
            onClick={alternarTema}
            aria-label={tema === "escuro" ? "Usar tema claro" : "Usar tema escuro"}
            title={tema === "escuro" ? "Usar tema claro" : "Usar tema escuro"}
          >
            {tema === "escuro" ? (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="4" />
                <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
              </svg>
            )}
            <span className="btn-rotulo">{tema === "escuro" ? "Tema claro" : "Tema escuro"}</span>
          </button>
          <button type="button" className="side-acao perigo" onClick={sair} aria-label="Sair">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <path d="M16 17l5-5-5-5" />
              <path d="M21 12H9" />
            </svg>
            <span className="btn-rotulo">Sair</span>
          </button>
        </div>
      </aside>

      <main className="conteudo" key={pagina}>
        {pagina === "painel" && <Painel dados={dados} irPara={setPagina} />}
        {pagina === "diaristas" && <Diaristas dados={dados} setDados={setDados} notificar={notificar} />}
        {pagina === "lojas" && <Lojas dados={dados} setDados={setDados} notificar={notificar} />}
        {pagina === "financeiro" && <Financeiro dados={dados} setDados={setDados} notificar={notificar} />}
      </main>

      {erroSync && (
        <div className="aviso aviso-erro" role="alert">
          {erroSync}
        </div>
      )}

      {aviso && (
        <div className="aviso" key={aviso.id} role="status" aria-live="polite">
          {aviso.texto}
        </div>
      )}
    </div>
  );
}
