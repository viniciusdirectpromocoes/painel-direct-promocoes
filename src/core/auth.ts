import type { User } from "@supabase/supabase-js";
import { supabase } from "./supabase";

export type Usuario = {
  id: string;
  nome: string;
  email: string;
};

function paraUsuario(u: User): Usuario {
  const nome = typeof u.user_metadata?.nome === "string" ? u.user_metadata.nome : "";
  return {
    id: u.id,
    nome: nome || u.email?.split("@")[0] || "Usuário",
    email: u.email ?? "",
  };
}

function traduzirErro(mensagem: string) {
  if (/already (been )?registered/i.test(mensagem)) return "Já existe uma conta com este e-mail.";
  if (/at least \d+ characters|password/i.test(mensagem)) return "A senha precisa ter pelo menos 6 caracteres.";
  if (/invalid login|invalid credentials/i.test(mensagem)) return "E-mail ou senha incorretos.";
  return "Não foi possível concluir. Tente de novo.";
}

/** Cria a conta. Se o Supabase exigir confirmação por e-mail, devolve precisaConfirmar. */
export async function cadastrar(nome: string, email: string, senha: string) {
  const { data, error } = await supabase.auth.signUp({
    email: email.trim(),
    password: senha,
    options: { data: { nome: nome.trim() } },
  });
  if (error) throw new Error(traduzirErro(error.message));
  if (!data.session || !data.user) return { usuario: null, precisaConfirmar: true };
  return { usuario: paraUsuario(data.user), precisaConfirmar: false };
}

export async function entrar(email: string, senha: string): Promise<Usuario> {
  const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: senha });
  if (error || !data.user) throw new Error(traduzirErro(error?.message ?? "invalid login"));
  return paraUsuario(data.user);
}

export async function sessaoAtual(): Promise<Usuario | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.user ? paraUsuario(data.session.user) : null;
}

export async function encerrarSessao() {
  await supabase.auth.signOut();
}
