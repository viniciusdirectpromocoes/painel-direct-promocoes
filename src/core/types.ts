import type { Dispatch, SetStateAction } from "react";

export type Turno = "manha" | "tarde" | "noite" | "integral";

/** Região de trabalho: qualquer uma ou só perto do endereço onde mora. */
export type Regiao = "qualquer" | "proximo";

export type Diarista = {
  id: string;
  nome: string;
  cpf: string;
  dataNascimento: string;
  telefone: string;
  cep: string;
  logradouro: string;
  numero: string;
  bairro: string;
  cidade: string;
  uf: string;
  setores: string[]; // setores em que tem experiência
  trabalhando: boolean; // trabalha hoje em alguma empresa
  empresaAtual: string;
  bloqueada: boolean; // marcada pela lista, fora do formulário
  turnos: Turno[]; // turnos em que pode trabalhar
  transportes: string[];
  regiao: Regiao;
  criadoEm: string;
};

export type Loja = {
  id: string;
  rede: string;
  nome: string;
  endereco: string;
  criadoEm: string;
};

export type Pedido = {
  id: string;
  lojaId: string;
  setor: string;
  inicio: string;
  fim: string;
  datas?: string[];
  horaInicio?: string;
  horaFim?: string;
  diaristaId?: string;
};

/**
 * Diárias: o que a diarista trabalhou e o quanto deve receber.
 * Recebimento: o que a empresa (rede) mandou para a Direct.
 * Pagamento: o que já foi pago a uma diarista.
 */
export type CategoriaLancamento = "Diárias" | "Recebimento" | "Pagamento" | "Adiantamento";

export type TipoAdiantamento = "Passagem" | "Diária";

export type Lancamento = {
  id: string;
  categoria: CategoriaLancamento;
  descricao: string;
  valor: number; // em reais
  formaPagamento: string; // sempre Pix
  // Diárias
  setor: string;
  diasTrabalhados: string[]; // yyyy-mm-dd
  diaPagamento: number; // dia do mês para pagar, 1 a 31 (0 se não se aplica)
  lojaId?: string;
  // Recebimento e Pagamento
  data: string; // yyyy-mm-dd
  rede: string; // rede que mandou o dinheiro (Recebimento)
  // Diárias e Pagamento
  diaristaId?: string;
  // Diárias: quanto já foi pago, descontado pelos pagamentos
  pagoValor?: number;
  // Pagamento: em quais diárias o valor foi descontado (o que sobrar é adiantamento)
  alocacoes?: { diariaId: string; valor: number }[];
  // Adiantamento: se é de passagem ou de diária
  tipoAdiantamento?: TipoAdiantamento;
};

export type Dados = {
  diaristas: Diarista[];
  lojas: Loja[];
  pedidos: Pedido[];
  lancamentos: Lancamento[];
  setoresExtras: string[]; // setores cadastrados pelo usuário, além dos padrões
};

export type Pagina = "painel" | "diaristas" | "lojas" | "pedidos" | "financeiro";

export type SetDados = Dispatch<SetStateAction<Dados>>;
