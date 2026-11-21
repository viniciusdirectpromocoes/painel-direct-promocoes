export type EnderecoCep = {
  logradouro: string;
  bairro: string;
  cidade: string;
  uf: string;
};

/**
 * Busca o endereço pelo CEP no ViaCEP (serviço público, sem chave).
 * Envia somente o CEP. Retorna null se o CEP não existir.
 */
export async function buscarCep(cep: string): Promise<EnderecoCep | null> {
  const numeros = cep.replace(/\D/g, "");
  const resposta = await fetch(`https://viacep.com.br/ws/${numeros}/json/`);
  if (!resposta.ok) throw new Error("Falha na consulta do CEP");
  const dados = (await resposta.json()) as {
    erro?: boolean;
    logradouro?: string;
    bairro?: string;
    localidade?: string;
    uf?: string;
  };
  if (dados.erro) return null;
  return {
    logradouro: dados.logradouro ?? "",
    bairro: dados.bairro ?? "",
    cidade: dados.localidade ?? "",
    uf: dados.uf ?? "",
  };
}
