<div align="center">

# 📊 MSY ANALYTICS
### Sistema de Performance Semanal da Ordem Masayoshi

[![Demo ao Vivo](https://img.shields.io/badge/Demo%20ao%20Vivo-GitHub%20Pages-brightgreen?style=for-the-badge&logo=github)](https://t4msy.github.io/MSY-ANALYTICS/)
[![Automação n8n](https://img.shields.io/badge/Automação-n8n-orange?style=for-the-badge&logo=n8n)](https://n8n.io/)
[![IA](https://img.shields.io/badge/IA-Gemini%202.5%20Flash-blueviolet?style=for-the-badge&logo=google)](https://deepmind.google/technologies/gemini/)

**MSY Analytics** é uma ferramenta interna da Ordem Masayoshi que analisa exportações de chats do WhatsApp e transforma os dados de participação dos membros em tabelas de performance e relatórios institucionais — gerados manualmente ou com inteligência artificial.

[🚀 Acessar o projeto](https://t4msy.github.io/MSY-ANALYTICS/) · [🐛 Reportar Bug](https://github.com/T4Msy/MSY-ANALYTICS/issues) · [💡 Sugerir Melhoria](https://github.com/T4Msy/MSY-ANALYTICS/issues)

</div>

---

## ✨ Funcionalidades

- 📁 **Upload de chat exportado** — Aceita arquivos `.txt` exportados diretamente do WhatsApp (iOS e Android)
- 📅 **Filtro por período** — Define intervalo de datas para a análise (início e fim)
- 📊 **Tabela de performance** — Exibe mensagens por dia, total e média diária de cada membro, ordenados por participação
- 🔍 **Filtros interativos** — Busca por nome e chips clicáveis para incluir/excluir membros da análise
- 📄 **Relatório Base** — Relatório institucional gerado localmente, sem dependência de API
- 🤖 **Relatório com IA** — Relatório gerado pelo Gemini 2.5 Flash via n8n, com instrução personalizada opcional
- 🏆 **Destaque dos Top 3** — Membros mais ativos da semana com comentário automático
- 📈 **Total do grupo** — Rodapé com soma e média diária consolidada do grupo

---

## 🖼️ Como Funciona

> _Em menos de 30 segundos, uma exportação de chat vira um relatório institucional completo._

| Etapa | Ação |
|-------|------|
| 1 | Exporte o histórico do grupo no WhatsApp como `.txt` |
| 2 | Faça o upload do arquivo no MSY Analytics |
| 3 | Defina o período de análise (início e fim) |
| 4 | Clique em **Iniciar Análise** — a tabela é gerada automaticamente |
| 5 | Use os chips e a busca para filtrar membros |
| 6 | Gere o **Relatório Base** (local) ou o **Relatório com IA** (Gemini via n8n) |

---

## 🏗️ Arquitetura

```
Navegador (HTML/CSS/JS)
        │
        │  Upload .txt + período selecionado
        ▼
  Leitura local (FileReader API)
        │
        ▼
  POST para Webhook n8n (analisar-chat)
        │
        ▼
  Code Node (JavaScript)
    ├── Parse das linhas do chat (regex iOS + Android)
    ├── Contagem de mensagens por membro por dia
    ├── Geração da tabela HTML com totais e médias
    └── Retorno do HTML para o navegador
        │
        ▼
  Navegador renderiza tabela + inicializa filtros

        │ (opcional)
        ▼
  POST para Webhook n8n (gerar-relatorio)
        │
        ▼
  Gemini 2.5 Flash
    └── Recebe dados da tabela + instrução do usuário
    └── Gera relatório institucional formatado
        │
        ▼
  Navegador exibe relatório final
```

---

## 🛠️ Tecnologias

| Camada | Tecnologia |
|--------|-----------|
| Frontend | HTML5, CSS3, JavaScript Vanilla |
| Fontes | Inter (Google Fonts) |
| Automação | [n8n](https://n8n.io/) (self-hosted) |
| Túnel | Cloudflare Tunnel |
| IA | Gemini 2.5 Flash via Google API |
| Leitura de arquivo | FileReader API (nativa do navegador) |
| Hospedagem | GitHub Pages |

---

## 📁 Estrutura do Projeto

```
MSY-ANALYTICS/
├── index.html                    # Interface principal
├── styles.css                    # Design system — tema MSY (vermelho e preto)
├── script.js                     # Lógica de upload, análise, filtros e relatórios
└── MSY_-_ANALYTICS.json          # Workflow n8n (importável)
```

---

## ⚙️ Workflow n8n

O arquivo `MSY_-_ANALYTICS.json` contém dois fluxos independentes, exportáveis e importáveis diretamente no n8n.

### Fluxo 1 — `analisar-chat` (POST)

Recebe o conteúdo do chat `.txt` e o período, e devolve a tabela HTML de performance.

| Nó | Função |
|----|--------|
| Webhook | Recebe `chat`, `inicio` e `fim` via POST |
| Code in JavaScript | Faz o parse linha a linha, contabiliza mensagens por membro/dia e monta a tabela HTML |
| Respond to Webhook | Retorna `{ html }` para o navegador |

**Compatibilidade de formato:** o parser suporta exports do WhatsApp tanto no padrão **iOS** (`[DD/MM/AAAA, HH:MM] Nome:`) quanto **Android** (`DD/MM/AAAA HH:MM - Nome:`).

### Fluxo 2 — `gerar-relatorio` (POST)

Recebe os dados da tabela já processada e uma instrução opcional, e devolve o relatório gerado pelo Gemini.

| Nó | Função |
|----|--------|
| Webhook | Recebe `dados` (resumo da tabela) e `prompt` do usuário |
| Message a model | Envia para o Gemini 2.5 Flash com system prompt institucional fixo |
| Respond to Webhook | Retorna `{ output }` com o relatório em texto |

---

## 📄 Relatório Base vs. Relatório com IA

| | Relatório Base | Relatório com IA |
|---|---|---|
| **Geração** | Local (JavaScript puro) | Gemini 2.5 Flash via n8n |
| **Dependência** | Nenhuma | n8n ativo + chave Google API |
| **Customização** | Fixo | Instrução personalizada pelo usuário |
| **Seções** | Visão geral, Top 3, Análise, Metas, Mensagem final | Mesmo formato + tom ajustado pela instrução |
| **Velocidade** | Instantâneo | ~5–15 segundos |

---

## 🚀 Como Executar

### Frontend (sem configuração necessária)
O frontend é um site estático — basta hospedar no GitHub Pages ou abrir o `index.html` localmente.

### Backend (workflow n8n)

1. Instale o [n8n](https://docs.n8n.io/hosting/) (self-hosted ou cloud)
2. Importe o arquivo `MSY_-_ANALYTICS.json` na sua instância
3. Adicione sua credencial da Google API (para o Gemini)
4. Ative o workflow e copie as URLs dos dois webhooks
5. Substitua as URLs no `script.js`:

```javascript
// script.js — linhas 1 e 2
const URL_WEBHOOK_ANALISE  = 'https://sua-instancia.com/webhook/analisar-chat';
const URL_WEBHOOK_RELATORIO = 'https://sua-instancia.com/webhook/gerar-relatorio';
```

---

## 💡 Contexto do Projeto

> O MSY Analytics nasceu de uma necessidade real da coordenação da Ordem Masayoshi: acompanhar semanalmente a participação dos membros no grupo e gerar relatórios institucionais sem esforço manual. O que antes levava horas de contagem e formatação agora acontece em segundos — com dados precisos e relatório pronto para ser publicado.

---

## 🔮 Melhorias Futuras

- [ ] Suporte a múltiplos grupos simultâneos
- [ ] Gráficos de evolução semanal por membro
- [ ] Exportação do relatório em PDF
- [ ] Histórico de semanas anteriores salvo no Supabase
- [ ] Dashboard com ranking acumulado por mês

---

## 👤 Autor

**Tales — T4 MASAYOSHI**
Fundador da Ordem Masayoshi · Professor de informática · Estudante de Sistemas de Informação · Entusiasta de IA e automação

[![GitHub](https://img.shields.io/badge/GitHub-T4Msy-181717?style=flat-square&logo=github)](https://github.com/T4Msy)

---

<div align="center">
  <sub>Feito com ☕ e muito <code>n8n</code> · Dados que viram decisão · <strong>Ordem Masayoshi © 2026</strong></sub>
</div>
