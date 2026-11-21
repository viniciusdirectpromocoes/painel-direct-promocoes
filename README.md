# MVP Direct

SaaS MVP construído do zero, passo a passo (uma funcionalidade e um botão por vez).

## Como rodar

Pré-requisito: Node.js LTS instalado (inclui o npm).

```powershell
cd "C:\Users\Vinicius\Documents\Claude Saas novo\MVP Direct"
npm install
npm run dev
```

## Roteiro

- [x] Passo 1 — Projeto base (Vite + React + TypeScript)
- [x] Passo 2 — Painel com KPIs animados (saldo, entradas, saídas, diaristas disponíveis)
- [x] Passo 3 — Cadastro, edição, busca e exclusão de diaristas
- [x] Passo 4 — Cadastro, edição, busca e exclusão de lojas
- [x] Passo 5 — Financeiro: entradas e saídas ligadas a loja e diarista
- [x] Passo 6 — Login e cadastro local (contas salvas neste PC)
- [ ] Passo 7 — Banco de dados na nuvem (Supabase), quando for para vários aparelhos
- [ ] Passo 8 — Assinatura/planos

## Estrutura

```
src/
  core/          regras e dados compartilhados (tipos, armazenamento, formatação)
  components/    componentes reutilizáveis (ex.: número animado)
  features/      uma pasta por funcionalidade
    auth/        entrar e criar conta
    painel/
    diaristas/
    lojas/
    financeiro/
  styles/        estilos globais (index.css)
  App.tsx        casca do app e navegação
  main.tsx       ponto de entrada
```

## Armazenamento

Modo local: as contas e os dados ficam no `localStorage` deste navegador, um conjunto de dados por usuário (`src/core/store.ts`). A senha é guardada como hash SHA-256 com sal (`src/core/auth.ts`). Isso vale só neste PC e neste navegador; para vários aparelhos, use o Supabase depois.
