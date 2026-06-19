/* ======================================
   MSY ORACLE — script.js
   Unified Weekly + Monthly System
====================================== */

'use strict';

// =====================================
// CONFIG
// =====================================
const WEBHOOKS = {
  monthly:  'https://warm-polls-treasury-gay.trycloudflare.com/webhook/relatorio-mensal',
  weekly:   'https://warm-polls-treasury-gay.trycloudflare.com/webhook/analisar-chat',
  iaReport: 'https://warm-polls-treasury-gay.trycloudflare.com/webhook/gerar-relatorio',
};

// Limite de upload (precisa bater com N8N_PAYLOAD_SIZE_MAX no servidor n8n)
const MAX_FILE_MB    = 35;
const MAX_FILE_BYTES = MAX_FILE_MB * 1024 * 1024;

const LOADING_MESSAGES = [
  'Analisando dados da Masayoshi...',
  'Processando na central Oracle...',
  'Computando rankings de performance...',
  'Calibrando métricas do grupo...',
  'Validando dados de presença...',
  'Consolidando inteligência semanal...',
];

// =====================================
// STATE
// =====================================
let currentMode = 'weekly'; // 'weekly' | 'monthly'
let dadosParaRelatorio = '';
let flatpickrInicio = null;
let flatpickrFim = null;
let loadingTimer = null;
let progressTimer = null;

// =====================================
// INIT
// =====================================
document.addEventListener('DOMContentLoaded', () => {
  initFlatpickr();
  initFileInput();
  initAnalyzeButton();
});

function initFlatpickr() {
  // disableMobile: true => usa o calendário próprio do flatpickr em TODOS os
  // dispositivos. Sem isso, no Android/iOS o flatpickr cai pro seletor nativo,
  // que devolve a data como "AAAA-MM-DD" e quebra o split('/') do buildPayload,
  // impedindo a criação da tabela.
  const opts = { dateFormat: 'd/m/Y', locale: 'pt', disableMobile: true };
  flatpickrInicio = flatpickr('#dataInicio', opts);
  flatpickrFim    = flatpickr('#dataFim', opts);
}

function initFileInput() {
  const fileInput = document.getElementById('chatFile');
  fileInput.addEventListener('change', function () {
    const labelEl = document.getElementById('fileLabel');

    if (!this.files.length) {
      labelEl.textContent = 'Selecionar arquivo...';
      return;
    }

    const file = this.files[0];

    if (file.size > MAX_FILE_BYTES) {
      const mb = (file.size / 1024 / 1024).toFixed(1);
      labelEl.textContent = `Arquivo muito grande (${mb} MB)`;
      this.value = ''; // limpa a seleção inválida
      showError(`⚠ &nbsp; O arquivo tem ${mb} MB. O limite é de ${MAX_FILE_MB} MB. Reduza o arquivo e tente novamente.`);
      return;
    }

    const mb = (file.size / 1024 / 1024).toFixed(1);
    labelEl.textContent = `${file.name} (${mb} MB)`;
  });
}

function initAnalyzeButton() {
  document.getElementById('analisarBtn').addEventListener('click', runAnalysis);
}

// =====================================
// MODE SWITCH
// =====================================
function switchMode(mode) {
  if (mode === currentMode) return;
  currentMode = mode;

  const btnWeekly  = document.getElementById('modeWeekly');
  const btnMonthly = document.getElementById('modeMonthly');
  const sectionLabel = document.getElementById('sectionLabel');
  const resultLabel  = document.getElementById('resultLabel');
  const areaIA = document.getElementById('areaIA');

  btnWeekly.classList.toggle('active', mode === 'weekly');
  btnMonthly.classList.toggle('active', mode === 'monthly');

  if (mode === 'weekly') {
    sectionLabel.textContent = 'Parâmetros de Análise — Semanal';
    resultLabel.textContent  = 'Resultado da Análise — Semanal';
  } else {
    sectionLabel.textContent = 'Parâmetros de Análise — Mensal';
    resultLabel.textContent  = 'Resultado da Análise — Mensal';
    areaIA.style.display = 'none';
  }

  // Reset results
  resetResultados();

  // Panel animation
  const panel = document.getElementById('inputPanel');
  panel.classList.remove('mode-transition');
  void panel.offsetWidth;
  panel.classList.add('mode-transition');
}

// =====================================
// ANALYSIS
// =====================================
async function runAnalysis() {
  const fileInput  = document.getElementById('chatFile');
  const dataInicio = document.getElementById('dataInicio').value;
  const dataFim    = document.getElementById('dataFim').value;
  const btn        = document.getElementById('analisarBtn');

  if (!fileInput.files.length || !dataInicio || !dataFim) {
    showError('⚠ &nbsp; Envie o arquivo e selecione as datas para continuar.');
    return;
  }

  const file = fileInput.files[0];

  if (file.size > MAX_FILE_BYTES) {
    const mb = (file.size / 1024 / 1024).toFixed(1);
    showError(`⚠ &nbsp; O arquivo tem ${mb} MB. O limite é de ${MAX_FILE_MB} MB.`);
    return;
  }

  btn.disabled = true;
  showLoadingOverlay();
  hideFilterSection();
  resetResultados();

  try {
    // Lê o arquivo de forma compatível com Android antigo / WebViews
    // (Instagram, WhatsApp, Facebook) onde File.text() não existe.
    const text = await readFileText(file);

    const webhook = currentMode === 'weekly' ? WEBHOOKS.weekly : WEBHOOKS.monthly;
    const payload = buildPayload(text, dataInicio, dataFim);

    const response = await fetch(webhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const data = await response.json();
    hideLoadingOverlay();

    if (data.html) {
      renderResults(data.html);
    } else {
      showError('⚠ &nbsp; Nenhum dado retornado pelo servidor.');
    }
  } catch (err) {
    hideLoadingOverlay();
    const sizeMb = (file.size / 1024 / 1024).toFixed(1);
    const isReadError = err && /ler o arquivo|read|NotReadable|FileReader/i.test(String(err.message || err));
    if (isReadError) {
      showError(
        `⚠ &nbsp; Não foi possível ler o arquivo no seu aparelho.<br>` +
        `Tente abrir esta página no <strong>Chrome</strong> (não pelo navegador interno do WhatsApp/Instagram) ` +
        `e selecione novamente o arquivo .txt do chat.`
      );
    } else {
      showError(
        `⚠ &nbsp; Não foi possível conectar ao servidor (n8n).<br>` +
        `Se o arquivo é grande (${sizeMb} MB), verifique se o n8n aceita esse tamanho ` +
        `(N8N_PAYLOAD_SIZE_MAX) e se o CORS está liberado para t4msy.github.io.`
      );
    }
    console.error('[MSY Oracle] Error:', err);
  } finally {
    btn.disabled = false;
  }
}

// Leitura de arquivo compatível com Android antigo / navegadores embutidos.
function readFileText(file) {
  return new Promise((resolve, reject) => {
    try {
      const reader = new FileReader();
      reader.onload  = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(reader.error || new Error('Falha ao ler o arquivo'));
      reader.readAsText(file, 'UTF-8');
    } catch (e) {
      // Fallback para navegadores onde FileReader não está disponível
      if (file && typeof file.text === 'function') {
        file.text().then(resolve, reject);
      } else {
        reject(e);
      }
    }
  });
}

function buildPayload(text, inicio, fim) {
  // Aceita tanto "DD/MM/AAAA" quanto o nativo "AAAA-MM-DD" (Android/iOS) e
  // normaliza nos dois formatos que os fluxos n8n esperam.
  return {
    chat:  text,
    inicio: currentMode === 'weekly' ? toIso(inicio) : toBr(inicio),
    fim:    currentMode === 'weekly' ? toIso(fim)    : toBr(fim),
  };
}

// "DD/MM/AAAA" ou "AAAA-MM-DD" -> "AAAA-MM-DD"
function toIso(str) {
  if (!str) return str;
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) return str.slice(0, 10);
  const p = str.split('/');
  return p.length === 3 ? `${p[2]}-${p[1].padStart(2, '0')}-${p[0].padStart(2, '0')}` : str;
}

// "DD/MM/AAAA" ou "AAAA-MM-DD" -> "DD/MM/AAAA"
function toBr(str) {
  if (!str) return str;
  const m = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[3]}/${m[2]}/${m[1]}`;
  return str;
}

// =====================================
// NAME NORMALIZATION
// =====================================
// Aliases → canonical name (sem taça, ela é adicionada depois)
const NAME_MAP = [
  { canonical: 'Xitter',  aliases: ['marlon'] },
  { canonical: 'Tales',   aliases: ['t4les', 'tales'] },
  { canonical: 'Marcos',  aliases: ['marcos flausino', 'mfl4', 'marcos'] },
  { canonical: 'Mariana', aliases: ['mariana msy', 'missmoon', 'mariana'] },
  { canonical: 'Hariany', aliases: ['hariany msy', 'hariany'] },
  { canonical: 'Felipe',  aliases: ['felipe flausino', 'felipe msy', 'felipe', '𝕱𝖊𝕷𝕴𝖎𝕻𝖊'] },
  { canonical: 'Matheus', aliases: ['matheus lucas', 'matheus'] },
  { canonical: 'Naíra',   aliases: ['nana msy', 'naíra', 'naira'] },
  { canonical: 'Ph',      aliases: ['pedro (ph)', 'pedro ph', 'ph'] },
  { canonical: 'Pepeu',   aliases: ['pepeu msy', 'pepeu'] },
];

// Nomes a ignorar (sistema/grupo)
const IGNORE_NAMES = ['você', 'masayoshi', '𝓜𝓪𝓼𝓪𝔂𝓸𝓼𝓱𝓲'];

function normalizeName(raw) {
  // Strip emojis, special chars, trim
  const clean = raw.replace(/🍷/g, '').replace(/[~\u200b-\u200d\ufeff]/g, '').trim();

  // Ignore system names
  const cleanLower = clean.toLowerCase();
  if (IGNORE_NAMES.some(ig => cleanLower.includes(ig.toLowerCase()))) return null;

  // Try to find canonical match
  for (const entry of NAME_MAP) {
    for (const alias of entry.aliases) {
      if (cleanLower.includes(alias.toLowerCase())) {
        return entry.canonical + ' 🍷';
      }
    }
  }

  // Not in map — return original with 🍷 appended (strip existing 🍷 first)
  return clean + ' 🍷';
}

function normalizeNamesInTable() {
  const table = document.querySelector('.resultado-box .table-scroll table');
  if (!table) return;

  // Body rows — first cell is name
  table.querySelectorAll('tbody tr').forEach(row => {
    const cell = row.cells[0];
    if (!cell) return;

    // Preserve medal emoji if present
    const rawHTML = cell.innerHTML;
    const medalMatch = rawHTML.match(/^(🥇|🥈|🥉)/);
    const medal = medalMatch ? medalMatch[1] : '';

    const rawText = cell.innerText.replace(/🥇|🥈|🥉/g, '').trim();
    const normalized = normalizeName(rawText);

    if (normalized === null) {
      // Hide system/ignored rows
      row.style.display = 'none';
      return;
    }

    // Rebuild cell keeping medal prefix
    cell.innerHTML = medal
      ? `${medal} ${normalized}`
      : normalized;
  });
}

function renderResults(html) {
  const box = document.getElementById('resultadoHTML');
  box.innerHTML = `<div class="table-scroll">${html}</div>`;

  document.getElementById('copyBtn').style.display = 'flex';

  setTimeout(() => {
    normalizeNamesInTable();
    if (currentMode === 'weekly') {
      injectWeekdays();
    }
    setupFilters();

    if (currentMode === 'weekly') {
      extractWeeklyData();
      showIASection();
    }
  }, 80);
}

// =====================================
// INJECT WEEKDAY NAMES (SEMANAL)
// =====================================
const WEEKDAYS_PT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const WEEKEND_IDX = [0, 6]; // domingo e sábado

function injectWeekdays() {
  const table = document.querySelector('.resultado-box .table-scroll table');
  if (!table) return;

  const headers = Array.from(table.querySelectorAll('thead th'));
  if (headers.length < 3) return;

  // Date columns: between first (name) and last two (total + avg)
  const dateColHeaders = headers.slice(1, headers.length - 2);

  const dataInicio = document.getElementById('dataInicio').value; // DD/MM/AAAA
  let startDate = parseDateInput(dataInicio);

  dateColHeaders.forEach((th, i) => {
    let date = null;

    const txt = th.innerText.trim();
    date = parseDateFromHeader(txt);

    // Fallback: start date + column index
    if (!date && startDate) {
      date = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate() + i);
    }

    if (!date) return;

    const dayIdx    = date.getDay(); // 0=Dom, 1=Seg ... 6=Sáb
    const dayName   = WEEKDAYS_PT[dayIdx];
    const isWeekend = WEEKEND_IDX.includes(dayIdx);
    const cls       = isWeekend ? 'day-of-week weekend' : 'day-of-week';

    // Header: substitui o conteúdo pelo nome do dia (sem números de data)
    th.innerHTML = `<span class="${cls}">${dayName}</span>`;
  });
}

function parseDateInput(str) {
  // Aceita "DD/MM/AAAA" e "AAAA-MM-DD" (nativo) — local time, no UTC shift
  if (!str) return null;
  const iso = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return new Date(parseInt(iso[1],10), parseInt(iso[2],10) - 1, parseInt(iso[3],10));
  const p = str.split('/');
  if (p.length !== 3) return null;
  return new Date(parseInt(p[2],10), parseInt(p[1],10) - 1, parseInt(p[0],10));
}

function parseDateFromHeader(txt) {
  // "DD/MM" or "DD/MM/YYYY"
  let m = txt.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?/);
  if (m) {
    const y = m[3] ? parseInt(m[3],10) : new Date().getFullYear();
    return new Date(y, parseInt(m[2],10) - 1, parseInt(m[1],10));
  }
  // "YYYY-MM-DD"
  m = txt.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return new Date(parseInt(m[1],10), parseInt(m[2],10) - 1, parseInt(m[3],10));
  return null;
}

// =====================================
// LOADING OVERLAY
// =====================================
function showLoadingOverlay() {
  const overlay   = document.getElementById('loadingOverlay');
  const msgEl     = document.getElementById('loadingMessage');
  const progressEl= document.getElementById('wineFillProgress');

  overlay.style.display = 'flex';

  // Randomize message
  let msgIdx = 0;
  msgEl.textContent = LOADING_MESSAGES[msgIdx];

  clearInterval(loadingTimer);
  loadingTimer = setInterval(() => {
    msgIdx = (msgIdx + 1) % LOADING_MESSAGES.length;
    msgEl.textContent = LOADING_MESSAGES[msgIdx];
  }, 1800);

  // Progress bar animation (simulate)
  let progress = 0;
  progressEl.style.width = '0%';

  clearInterval(progressTimer);
  progressTimer = setInterval(() => {
    if (progress < 85) {
      progress += Math.random() * 8;
      progressEl.style.width = Math.min(progress, 85) + '%';
    }
  }, 400);
}

function hideLoadingOverlay() {
  clearInterval(loadingTimer);
  clearInterval(progressTimer);

  const progressEl = document.getElementById('wineFillProgress');
  progressEl.style.width = '100%';

  setTimeout(() => {
    const overlay = document.getElementById('loadingOverlay');
    overlay.style.display = 'none';
    progressEl.style.width = '0%';
  }, 300);
}

// =====================================
// FILTERS
// =====================================
function setupFilters() {
  const container   = document.getElementById('tagsContainer');
  const searchInput = document.getElementById('searchMembro');
  const table       = document.querySelector('.resultado-box .table-scroll table');

  if (!table) return;

  document.getElementById('filterSection').style.display = 'block';
  container.innerHTML = '';

  const rows   = Array.from(table.querySelectorAll('tbody tr'));
  const members = rows
    .map(r => r.cells[0].innerText.replace(/🥇|🥈|🥉/g, '').trim())
    .filter(n => n && !n.toLowerCase().includes('total'));

  members.forEach(name => {
    const tag = document.createElement('div');
    tag.className = 'member-tag active';
    tag.textContent = name;
    tag.onclick = () => {
      tag.classList.toggle('active');
      applyFilters();
    };
    container.appendChild(tag);
  });

  searchInput.oninput = applyFilters;
}

function applyFilters() {
  const term       = document.getElementById('searchMembro').value.toLowerCase();
  const activeTags = Array.from(document.querySelectorAll('.member-tag.active')).map(t => t.textContent);
  const table      = document.querySelector('.resultado-box .table-scroll table');
  if (!table) return;

  const rows = Array.from(table.querySelectorAll('tbody tr'));

  rows.forEach(row => {
    const memberName = row.cells[0].innerText.replace(/🥇|🥈|🥉/g, '').trim();
    if (memberName.toLowerCase().includes('total')) return;
    const visible = activeTags.includes(memberName) && memberName.toLowerCase().includes(term);
    row.style.display = visible ? '' : 'none';
  });

  recalcularRodape(table, rows);

  if (currentMode === 'weekly') {
    extractWeeklyData();
  }
}

function recalcularRodape(table, rows) {
  const footerCells = table.querySelectorAll('tfoot td');
  const numCols     = table.querySelectorAll('thead th').length;
  const visibleRows = rows.filter(r => r.style.display !== 'none' && !r.cells[0].innerText.includes('total'));

  for (let col = 1; col < numCols; col++) {
    let sum = 0;
    visibleRows.forEach(row => {
      const val = parseFloat(row.cells[col]?.innerText.replace(',', '.')) || 0;
      sum += val;
    });

    if (col === numCols - 1) {
      const numPeriods = numCols - 3;
      const avg = numPeriods > 0 ? (sum / numPeriods).toFixed(1) : sum.toFixed(1);
      if (footerCells[col]) footerCells[col].innerHTML = `<strong>${avg}</strong>`;
    } else {
      if (footerCells[col]) footerCells[col].innerHTML = `<strong>${Math.floor(sum)}</strong>`;
    }
  }
}

// =====================================
// WEEKLY — AI REPORT
// =====================================
function extractWeeklyData() {
  const rows = document.querySelectorAll('.resultado-box tbody tr');
  let resumo = '--- DADOS DA SEMANA ---\n';

  rows.forEach(row => {
    if (row.style.display === 'none') return;
    const cells = row.cells;
    const nome  = cells[0]?.innerText?.replace(/🥇|🥈|🥉/g, '').trim();
    if (!nome || nome.toLowerCase().includes('total')) return;
    const total = cells[cells.length - 2]?.innerText || '';
    const media = cells[cells.length - 1]?.innerText || '';
    resumo += `Membro: ${nome} | Total: ${total} | Média: ${media}/dia\n`;
  });

  dadosParaRelatorio = resumo;
}

function showIASection() {
  const area = document.getElementById('areaIA');
  area.style.display = 'block';
  area.classList.remove('mode-transition');
  void area.offsetWidth;
  area.classList.add('mode-transition');
}

async function gerarRelatorioIA() {
  const promptUsuario = document.getElementById('promptIA').value;
  const divRelatorio  = document.getElementById('relatorioFinal');

  if (!dadosParaRelatorio || dadosParaRelatorio.length < 10) {
    divRelatorio.innerHTML = '<p style="color:var(--crimson-mid); font-family:\'JetBrains Mono\', monospace; font-size:11px;">⚠ Analise o chat primeiro para gerar o relatório com IA.</p>';
    return;
  }

  divRelatorio.innerHTML = `
    <div style="display:flex; align-items:center; gap:12px; padding:20px 0;">
      <div class="loading-ring" style="width:20px;height:20px;border:1px solid #222;border-top-color:var(--crimson);border-radius:50%;animation:spin 1s linear infinite;"></div>
      <span style="font-family:'JetBrains Mono',monospace;font-size:10px;color:var(--crimson-mid);letter-spacing:3px;">PROCESSANDO IA...</span>
    </div>`;

  try {
    const response = await fetch(WEBHOOKS.iaReport, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        dados: dadosParaRelatorio,
        prompt: promptUsuario || 'Faça uma análise geral de performance da semana.',
      }),
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const data = await response.json();
    const texto = data.output || data.text || data.content || data.message;

    if (texto) {
      divRelatorio.innerHTML = texto;
    } else {
      divRelatorio.innerHTML = '<p style="color:var(--text-muted);">Resposta recebida, mas campo de texto vazio. Verifique o fluxo n8n.</p>';
    }
  } catch (err) {
    divRelatorio.innerHTML = `
      <p style="font-family:'JetBrains Mono',monospace;font-size:11px;color:var(--crimson-mid);">
        ⚠ Não foi possível conectar ao n8n.<br>
        Ative o fluxo <strong>gerar-relatorio</strong> no modo Test.
      </p>`;
    console.error('[MSY Oracle] IA error:', err);
  }
}

function gerarRelatorioBase() {
  const divRelatorio = document.getElementById('relatorioFinal');

  if (!dadosParaRelatorio || dadosParaRelatorio.length < 10) {
    divRelatorio.innerHTML = '<p style="color:var(--crimson-mid); font-family:\'JetBrains Mono\',monospace; font-size:11px;">⚠ Analise o chat primeiro.</p>';
    return;
  }

  const linhas = dadosParaRelatorio
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.startsWith('Membro:'));

  if (!linhas.length) {
    divRelatorio.innerHTML = '<p style="color:var(--crimson-mid); font-family:\'JetBrains Mono\',monospace; font-size:11px;">⚠ Não foi possível ler os dados.</p>';
    return;
  }

  let membros = [];
  linhas.forEach(linha => {
    const mMatch   = linha.match(/^Membro:\s*(.*?)\s*\|/);
    const tMatch   = linha.match(/Total:\s*([0-9]+)/);
    const medMatch = linha.match(/Média:\s*([0-9.]+)/);
    if (mMatch && tMatch && medMatch) {
      membros.push({ nome: mMatch[1], total: +tMatch[1], media: +medMatch[1] });
    }
  });

  if (!membros.length) {
    divRelatorio.innerHTML = '<p style="color:var(--crimson-mid);">Não foi possível interpretar os dados.</p>';
    return;
  }

  membros.sort((a, b) => b.total - a.total);
  const top3       = membros.slice(0, 3);
  const totalGrupo = membros.reduce((acc, m) => acc + m.total, 0);
  const mediaGrupo = totalGrupo / membros.length;

  // Média diária: total / 30 dias (mensal)
  const mediaDiaria = (totalGrupo / 30).toFixed(1);

  const inicio  = document.getElementById('dataInicio').value || '---';
  const fim     = document.getElementById('dataFim').value   || '---';
  const periodo = inicio && fim ? `${inicio} até ${fim}` : inicio || fim || '---';

  // Instrução personalizada
  const instrucao = (document.getElementById('promptIA')?.value || '').trim();

  // Textos dinâmicos por desempenho
  const qualidade = mediaGrupo >= 120 ? 'consistente' : mediaGrupo >= 60 ? 'estável' : 'irregular';
  const evolucao  = mediaGrupo >= 100 ? 'evolução' : mediaGrupo >= 50 ? 'manutenção' : 'necessidade de ajustes';

  const visaoGeral1 = mediaGrupo >= 100
    ? 'O grupo manteve presença contínua, alternando momentos de maior intensidade com períodos de menor ritmo, sem interrupções críticas na comunicação.'
    : mediaGrupo >= 50
    ? 'O grupo manteve presença razoável, com oscilações ao longo das semanas. Houve momentos de bom ritmo, mas também períodos de menor engajamento coletivo.'
    : 'O grupo apresentou atividade irregular, com longos intervalos de menor movimento e engajamento abaixo do esperado para os padrões da MSY.';

  const visaoGeral2 = mediaGrupo >= 100
    ? 'De forma geral, o mês foi marcado por evolução em comparação ao padrão esperado. A constância coletiva se manteve dentro do esperado para a estrutura atual da MSY, demonstrando capacidade de sustentação ao longo do tempo, não apenas em picos pontuais.'
    : mediaGrupo >= 50
    ? 'De forma geral, o mês foi marcado por manutenção do ritmo. A constância coletiva se manteve dentro de um nível aceitável, mas há espaço claro para elevação de padrão e maior regularidade.'
    : 'De forma geral, o mês exigiu atenção. A constância coletiva ficou abaixo do ideal para a estrutura da MSY, indicando necessidade de reajuste de presença e engajamento.';

  const analiseGeral = mediaGrupo >= 100
    ? 'O desempenho coletivo mensal foi positivo.'
    : mediaGrupo >= 50
    ? 'O desempenho coletivo mensal foi mediano.'
    : 'O desempenho coletivo mensal ficou abaixo do esperado.';

  const pontosFortes = mediaGrupo >= 70
    ? 'O grupo demonstrou capacidade de se manter ativo de forma prolongada, sem depender exclusivamente de momentos isolados ou de um único membro para sustentar a comunicação.'
    : 'Mesmo com oscilação, parte dos membros manteve presença firme, garantindo que o grupo não ficasse completamente inativo ao longo do período.';

  const pontosAtencao = mediaGrupo >= 70
    ? 'Foram observadas diferenças consistentes de intensidade entre os membros. Parte do grupo manteve presença regular durante todo o mês, enquanto outros ficaram abaixo da média mensal esperada. Isso não comprometeu a estrutura da MSY, mas indica pontos de atenção que precisam ser acompanhados.'
    : 'A maioria dos membros apresentou presença irregular ao longo do mês. Esse padrão precisa ser acompanhado de perto para evitar que se torne recorrente.';

  // Top 3 blocos
  const medalhas  = ['🥇', '🥈', '🥉'];
  const descTop3  = [
    'Foi o membro com maior constância ao longo do mês, mantendo presença frequente e participação distribuída entre as semanas. Demonstrou disciplina e compromisso contínuo com a movimentação do grupo.',
    'Apresentou desempenho sólido durante o mês, com boa regularidade e participação consistente. Contribuiu de forma relevante para a estabilidade do grupo ao longo do período.',
    'Mostrou evolução clara ao longo do mês, mantendo maior presença e engajamento entre as semanas. Um progresso positivo e digno de reconhecimento.',
  ];

  const blocoTop3 = top3.map((m, i) => `
<h3>${medalhas[i]} ${m.nome}</h3>
<p>${descTop3[i]}</p>`).join('\n');

  // Instrução personalizada (se existir, adiciona como nota final)
  const blocoInstrucao = instrucao
    ? `\n<h3>📝 Observação Adicional</h3>\n<p>${instrucao}</p>`
    : '';

  divRelatorio.innerHTML = `
<h3>𓂀 𝓜𝓢𝓨 — 𝓓𝓘𝓡𝓔𝓣𝓞𝓡𝓘𝓐 𓂀</h3>
<p><b>Relatório Mensal — Masayoshi</b></p>
<p><b>Período analisado:</b> ${periodo}</p>
<p><b>Total de mensagens no mês:</b> ${totalGrupo.toLocaleString('pt-BR')}</p>
<p><b>Média diária do grupo:</b> ${mediaDiaria}</p>

<h3>⸻</h3>

<h3>🩸 Visão Geral do Mês</h3>
<p>Durante o período analisado, a Masayoshi apresentou um mês <b>${qualidade}</b>, com atividade distribuída ao longo das semanas. ${visaoGeral1}</p>
<p>${visaoGeral2}</p>
<p>O desempenho mensal indica amadurecimento gradual do grupo, ainda com espaço claro para elevação de padrão e maior regularidade.</p>

<h3>⸻</h3>

<h3>🔺 Destaques do Mês</h3>
${blocoTop3}

<h3>⸻</h3>

<h3>⚖ Análise Geral do Grupo</h3>
<p>${analiseGeral} ${pontosFortes}</p>
<p>${pontosAtencao}</p>
<p>No geral, a Masayoshi manteve estabilidade, boa comunicação interna e ausência de conflitos relevantes ao longo do mês.</p>

<h3>⸻</h3>

<h3>🎯 Metas e Direcionamento</h3>
<ul>
  <li>Manter ou elevar a média diária mensal do grupo.</li>
  <li>Buscar maior constância semanal, evitando quedas prolongadas de atividade.</li>
  <li>Acompanhar membros que permaneceram abaixo da média mensal.</li>
  <li>Transformar períodos de bom desempenho em padrão contínuo.</li>
  <li>Fortalecer disciplina e presença ao longo de todo o mês, não apenas em momentos específicos.</li>
</ul>

<h3>⸻</h3>
${blocoInstrucao}

<h3>🍷 Mensagem Final</h3>
<p>Constância ao longo do tempo é o que transforma um bom grupo em uma ordem sólida.</p>
<p>A Masayoshi encerra este mês com sinais claros de construção, amadurecimento e estabilidade. O próximo ciclo exige mais disciplina, mais regularidade e menos dependência de picos isolados.</p>
<p>Aqui, o tempo revela quem permanece.</p>
<p style="margin-top:16px; font-style:italic; color:var(--crimson-mid);">Vida longa à Masayoshi. 🍷</p>`.trim();

  document.getElementById('areaIA').scrollIntoView({ behavior: 'smooth' });
}

// =====================================
// COPY TO EXCEL
// =====================================
function copiarTabela() {
  const table = document.querySelector('.resultado-box .table-scroll table');
  if (!table) return;

  let tsv = '';
  tsv += Array.from(table.querySelectorAll('thead th')).map(th => th.innerText.trim()).join('\t') + '\n';

  table.querySelectorAll('tbody tr').forEach(row => {
    if (row.style.display === 'none') return;
    tsv += Array.from(row.cells).map(td =>
      td.innerText.trim().replace(/🥇|🥈|🥉/g, '').trim()
    ).join('\t') + '\n';
  });

  tsv += Array.from(table.querySelectorAll('tfoot td')).map(td => td.innerText.trim()).join('\t') + '\n';

  navigator.clipboard.writeText(tsv).then(() => {
    const btn = document.getElementById('copyBtn');
    btn.classList.add('copiado');
    btn.querySelector('span').textContent = '✓ Copiado!';
    setTimeout(() => {
      btn.classList.remove('copiado');
      btn.querySelector('span').textContent = '⎘  Copiar para Excel';
    }, 2500);
  });
}

// =====================================
// HELPERS
// =====================================
function showError(msg) {
  document.getElementById('resultadoHTML').innerHTML = `
    <div class="error-state">
      <p>${msg}</p>
    </div>`;
}

function resetResultados() {
  document.getElementById('resultadoHTML').innerHTML = `
    <div class="empty-state">
      <div class="empty-wine">
        <svg viewBox="0 0 60 90" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 3h36l-6 33a18 18 0 01-18 15A18 18 0 016 36L0 3z" stroke="#1a1a1a" stroke-width="2" fill="none" transform="translate(6,0)"/>
          <path d="M12 3h36l-6 33a18 18 0 01-18 15A18 18 0 016 36L0 3z" fill="url(#emptyWine2)" opacity="0.15" transform="translate(6,0)"/>
          <line x1="30" y1="52" x2="30" y2="78" stroke="#1a1a1a" stroke-width="2"/>
          <line x1="18" y1="78" x2="42" y2="78" stroke="#1a1a1a" stroke-width="2" stroke-linecap="round"/>
          <defs>
            <linearGradient id="emptyWine2" x1="30" y1="3" x2="30" y2="52" gradientUnits="userSpaceOnUse">
              <stop stop-color="#8b0000"/>
              <stop offset="1" stop-color="#2a0000"/>
            </linearGradient>
          </defs>
        </svg>
      </div>
      <p class="empty-state-text">Aguardando análise da Masayoshi...</p>
    </div>`;
  document.getElementById('copyBtn').style.display = 'none';
  document.getElementById('relatorioFinal').innerHTML = '';
  dadosParaRelatorio = '';
}

function hideFilterSection() {
  document.getElementById('filterSection').style.display = 'none';
  document.getElementById('tagsContainer').innerHTML = '';
  document.getElementById('searchMembro').value = '';
}

// CSS keyframes needed in JS (spin)
const styleTag = document.createElement('style');
styleTag.textContent = `
  @keyframes spin { to { transform: rotate(360deg); } }
`;
document.head.appendChild(styleTag);
