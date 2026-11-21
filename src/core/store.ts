import { useEffect, useRef, useState } from "react";
import type { Dados } from "./types";
import { supabase } from "./supabase";

const VAZIO: Dados = { diaristas: [], lojas: [], lancamentos: [], setoresExtras: [] };

/**
 * Dados de um usuário, guardados no Supabase (tabela painel_dados).
 * Carrega ao entrar e salva sozinho, com uma pequena pausa para não gravar a cada tecla.
 */
export function useDados(usuarioId: string) {
  const [dados, setDados] = useState<Dados>(VAZIO);
  const [carregado, setCarregado] = useState(false);
  const [erroSync, setErroSync] = useState("");
  const prontoParaSalvar = useRef(false);

  useEffect(() => {
    let ativo = true;
    prontoParaSalvar.current = false;
    setCarregado(false);

    (async () => {
      const { data, error } = await supabase
        .from("painel_dados")
        .select("conteudo")
        .eq("user_id", usuarioId)
        .maybeSingle();
      if (!ativo) return;
      if (error) {
        setErroSync("Não foi possível carregar seus dados. Verifique a conexão.");
      } else {
        setDados({ ...VAZIO, ...((data?.conteudo as Partial<Dados> | undefined) ?? {}) });
      }
      prontoParaSalvar.current = !error;
      setCarregado(true);
    })();

    return () => {
      ativo = false;
    };
  }, [usuarioId]);

  useEffect(() => {
    if (!prontoParaSalvar.current) return;
    const t = window.setTimeout(async () => {
      const { error } = await supabase
        .from("painel_dados")
        .upsert({ user_id: usuarioId, conteudo: dados, atualizado_em: new Date().toISOString() });
      setErroSync(error ? "Não foi possível salvar. Verifique a conexão." : "");
    }, 600);
    return () => window.clearTimeout(t);
  }, [dados, usuarioId]);

  return { dados, setDados, carregado, erroSync };
}

type ComId = { id: string };

/** Insere ou substitui um item pelo id, mantendo a ordem. */
export function upsert<T extends ComId>(lista: T[], item: T): T[] {
  const i = lista.findIndex((x) => x.id === item.id);
  if (i === -1) return [item, ...lista];
  return lista.map((x, j) => (j === i ? item : x));
}
