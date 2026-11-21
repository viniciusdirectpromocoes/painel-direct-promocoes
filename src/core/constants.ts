import type { Turno } from "./types";

/** Listas usadas nos formulários, baseadas na estrutura do sistema Direct. */

export const CIDADE_PADRAO = "Fortaleza";
export const UF_PADRAO = "CE";

/** Valor de uma diária, em reais. */
export const VALOR_DIARIA = 90;

/** Pagamentos são sempre feitos por Pix. */
export const FORMA_PAGAMENTO = "Pix";

export const UFS = ["AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO"];

/** As 6 redes de lojas atendidas. */
export const REDES = ["Hipermarket", "Fazendinha", "Variedades", "Super do Povo", "Super Lagoa", "Pinheiro"];

/** Setores em que a diarista pode ter experiência, com valor de diária definido no Direct. */
export const SETORES = [
  "Açougueiro",
  "ASG",
  "Auxiliar de depósito",
  "Balconista de açougue",
  "Balconista de frios",
  "Balconista de padaria",
  "Repositor de mercearia",
  "Repositor de frios",
  "Repositor de FLV",
  "Operador de caixa",
];

/** Meios de locomoção. */
export const TRANSPORTES = ["Carro", "Moto", "Bike", "Ônibus", "Uber"];

export const DIAS = [
  { valor: "segunda", rotulo: "Segunda" },
  { valor: "terca", rotulo: "Terça" },
  { valor: "quarta", rotulo: "Quarta" },
  { valor: "quinta", rotulo: "Quinta" },
  { valor: "sexta", rotulo: "Sexta" },
  { valor: "sabado", rotulo: "Sábado" },
  { valor: "domingo", rotulo: "Domingo" },
];

/** Turnos em que a diarista pode trabalhar. */
export const TURNOS: { valor: Turno; rotulo: string }[] = [
  { valor: "manha", rotulo: "Manhã" },
  { valor: "tarde", rotulo: "Tarde" },
  { valor: "noite", rotulo: "Noite" },
  { valor: "integral", rotulo: "Integral" },
];

