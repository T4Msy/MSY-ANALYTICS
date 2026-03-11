const URL_WEBHOOK_ANALISE = 'https://warm-polls-treasury-gay.trycloudflare.com/webhook/analisar-chat'; 
const URL_WEBHOOK_RELATORIO = 'https://warm-polls-treasury-gay.trycloudflare.com/webhook/gerar-relatorio';

let dadosParaRelatorio = ""; 

async function enviarParaAnalise() {
    const fileInput = document.getElementById('arquivoInput');
    if (!fileInput.files[0]) { alert("Selecione um arquivo!"); return; }

    document.getElementById('loadingAnalise').style.display = 'block';
    document.getElementById('resultado').innerHTML = '';
    document.getElementById('area-ia').style.display = 'none';

    const reader = new FileReader();
    reader.onload = async function(e) {
        try {
            const response = await fetch(URL_WEBHOOK_ANALISE, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chat: e.target.result,
                    inicio: document.getElementById('dataInicio').value,
                    fim: document.getElementById('dataFim').value
                })
            });

            const data = await response.json();
            document.getElementById('loadingAnalise').style.display = 'none';
            
            if(data.html) {
                document.getElementById('resultado').innerHTML = data.html;
                
                setTimeout(() => {
                    inicializarFiltros(); 
                    extrairDadosDaTabela();
                    document.getElementById('area-ia').style.display = 'block';
                }, 100);
            }
        } catch (error) {
            console.error(error);
            alert("Erro na conexão da análise.");
        }
    };
    reader.readAsText(fileInput.files[0]);
}

async function gerarRelatorioIA() {
    const promptUsuario = document.getElementById('promptIA').value;
    const divRelatorio = document.getElementById('relatorio-final');
    const loadingIA = document.getElementById('loadingIA');

    console.log("Enviando dados para IA:", dadosParaRelatorio);

    if (!dadosParaRelatorio || dadosParaRelatorio.length < 10) {
        alert("Erro: Os dados da tabela não foram carregados. Tente analisar novamente.");
        return;
    }

    loadingIA.style.display = 'block';
    divRelatorio.innerHTML = '';

    try {
        const response = await fetch(URL_WEBHOOK_RELATORIO, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                dados: dadosParaRelatorio,
                prompt: promptUsuario || "Faça uma análise geral."
            })
        });

        if (!response.ok) {
            loadingIA.style.display = 'none';
            divRelatorio.innerHTML = `
                <p><b>⚠️ Atenção:</b> o relatório automático está em modo de teste.</p>
                <p>Acesse o n8n e ative o fluxo <b>gerar-relatorio</b> no modo Test para utilizar este botão.</p>
            `;
            return;
        }

        const data = await response.json();
        loadingIA.style.display = 'none';
        
        const textoFinal = data.output || data.text || data.content || data.message;

        if (textoFinal) {
            divRelatorio.innerHTML = textoFinal;
        } else {
            divRelatorio.innerText =
                "Recebi resposta do n8n, mas o campo de texto estava vazio. Verifique o JSON: " +
                JSON.stringify(data);
        }

    } catch (error) {
        console.error(error);
        loadingIA.style.display = 'none';
        divRelatorio.innerHTML = `
            <p><b>⚠️ Atenção:</b> não foi possível se conectar ao n8n agora.</p>
            <p>Ative o fluxo <b>gerar-relatorio</b> no n8n (modo Test) para usar o relatório com IA.</p>
        `;
    }
}

function gerarRelatorioBase() {
    const divRelatorio = document.getElementById('relatorio-final');

    if (!dadosParaRelatorio || dadosParaRelatorio.length < 10) {
        alert("Analise o chat primeiro para gerar o relatório base.");
        return;
    }

    const linhas = dadosParaRelatorio
        .split('\n')
        .map(l => l.trim())
        .filter(l => l.startsWith('Membro:'));

    if (linhas.length === 0) {
        alert("Não foi possível ler os dados da semana.");
        return;
    }

    let membros = [];

    linhas.forEach(linha => {
        // Membro: Nome | Total: 1327 | Média: 663.5/dia
        const mMatch = linha.match(/^Membro:\s*(.*?)\s*\|/);
        const tMatch = linha.match(/Total:\s*([0-9]+)/);
        const medMatch = linha.match(/Média:\s*([0-9.]+)/);

        if (mMatch && tMatch && medMatch) {
            membros.push({
                nome: mMatch[1],
                total: Number(tMatch[1]),
                media: Number(medMatch[1])
            });
        }
    });

    if (membros.length === 0) {
        alert("Não foi possível interpretar os dados da semana.");
        return;
    }

    membros.sort((a, b) => b.total - a.total);
    const top3 = membros.slice(0, 3);
    const totalGrupo = membros.reduce((acc, m) => acc + m.total, 0);
    const mediaGrupo = totalGrupo / membros.length;

    const inicio = document.getElementById('dataInicio').value || '---';
    const fim = document.getElementById('dataFim').value || '---';

    // Cabeçalho
    const cabecalho = `
<p><b>Período analisado:</b> ${inicio} até ${fim}</p>
<p><b>Total de mensagens do grupo:</b> ${totalGrupo}</p>
<p><b>Média aproximada por membro:</b> ${mediaGrupo.toFixed(1)}</p>
`.trim();

    // Visão geral (sem nomes)
    const visaoGeral =
        mediaGrupo >= 100
            ? "A unidade operou em ritmo forte ao longo da semana. Houve presença constante nos principais horários e a produção geral ficou em um patamar sólido para os padrões da MSY."
            : mediaGrupo >= 40
            ? "A unidade manteve uma semana estável, com picos de atividade em determinados momentos e períodos de silêncio acima do ideal. A produção é aceitável, mas há margem clara para subida."
            : "A semana foi marcada por baixa atividade. Houve longos intervalos sem movimento relevante e a tropa permaneceu aquém do padrão de presença esperado pela MSY.";

    // Top 3
    const listaTop3 = top3
        .map((m, i) => {
            const pos = i + 1;
            const tag =
                pos === 1
                    ? "constância e liderança"
                    : pos === 2
                    ? "compromisso e presença estáveis"
                    : "regularidade e apoio constante ao fluxo do grupo";
            return `<p><b>${pos}º - ${m.nome}</b> — ${m.total} mensagens na semana. Demonstra ${tag} ao longo do período.</p>`;
        })
        .join('\n');

    // Análise geral (pontos fortes e atenção)
    const pontosFortes =
        mediaGrupo >= 70
            ? "Há um núcleo consistente de membros que puxam o ritmo, sustentando o fluxo de mensagens e mantendo o grupo vivo nos momentos decisivos."
            : "Mesmo com oscilação, alguns membros mantêm participação firme, garantindo que o grupo não fique completamente inativo.";

    const pontosAtencao =
        mediaGrupo >= 70
            ? "Parte da base ainda aparece de forma pontual ou quase inexistente. Essa distância entre núcleo ativo e restante da unidade precisa ser reduzida."
            : "A maioria dos membros está abaixo do nível desejado de participação. Se a tendência continuar, decisões mais duras sobre permanência na linha de frente podem ser necessárias.";

    // Metas (3 a 5 metas claras)
    const metas = `
<ul>
    <li>Aumentar a presença diária média por membro em relação à semana atual.</li>
    <li>Reduzir períodos longos de silêncio, mantendo o grupo em operação nos horários de maior movimento.</li>
    <li>Trazer pelo menos parte dos membros menos ativos para um nível mínimo de participação visível.</li>
    <li>Manter o padrão dos destaques da semana como referência de disciplina para o restante da unidade.</li>
</ul>
`.trim();

    // Mensagem final (curta, firme e inspiradora)
    const mensagemFinal =
        "A MSY não trabalha com acaso ou improviso. Quem está na unidade é porque escolheu estar em movimento. A próxima semana é oportunidade para ajustar rota, corrigir postura e mostrar, em números, quem realmente está alinhado com a ordem.";

    const html = `
<h3>🛡️ Cabeçalho Oficial</h3>
${cabecalho}

<h3>📈 Visão Geral da Semana</h3>
<p>${visaoGeral}</p>

<h3>🏅 Top 3 da Semana</h3>
${listaTop3}

<h3>📊 Análise Geral do Grupo</h3>
<p><b>Pontos fortes:</b> ${pontosFortes}</p>
<p><b>Pontos de atenção:</b> ${pontosAtencao}</p>

<h3>🎯 Metas e Direcionamento</h3>
${metas}

<h3>📜 Mensagem Final</h3>
<p>${mensagemFinal}</p>
    `.trim();

    divRelatorio.innerHTML = html;
    document.getElementById('area-ia').scrollIntoView({ behavior: 'smooth' });
}


function extrairDadosDaTabela() {
    const rows = document.querySelectorAll('#resultado tbody tr');
    let resumo = "--- DADOS DA SEMANA ---\n";
    
    rows.forEach(row => {
        if (row.style.display !== 'none') {
            const cells = row.cells;
            const nome = cells[0].innerText;
            const total = cells[cells.length - 2].innerText;
            const media = cells[cells.length - 1].innerText;
            
            resumo += `Membro: ${nome} | Total: ${total} | Média: ${media}/dia\n`;
        }
    });
    
    dadosParaRelatorio = resumo;
    console.log("Dados extraídos com sucesso!");
}

function inicializarFiltros() {
    const table = document.querySelector('#resultado table');
    const lista = document.getElementById('listaMembros');
    const area = document.getElementById('filtros-area');
    if(!table) return;
    
    lista.innerHTML = '';
    area.style.display = 'block';
    
    const rows = table.querySelectorAll('tbody tr');
    const linhasParaFiltrar = Array.from(rows).filter(r => !r.cells[0].innerText.includes("TOTAL DO GRUPO"));

    linhasParaFiltrar.forEach(row => {
        const nome = row.cells[0].innerText;
        row.setAttribute('data-nome', nome.toLowerCase());
        
        const chip = document.createElement('div');
        chip.className = 'chip active';
        chip.innerText = nome;
        chip.onclick = () => {
            chip.classList.toggle('active');
            row.style.display = chip.classList.contains('active') ? '' : 'none';
            extrairDadosDaTabela();
        };
        lista.appendChild(chip);
    });
}

function filtrarPorTexto() {
    const termo = document.getElementById('searchBar').value.toLowerCase();
    document.querySelectorAll('#resultado tbody tr').forEach(row => {
        if(row.cells[0].innerText.includes("TOTAL DO GRUPO")) return;
        const nome = row.getAttribute('data-nome') || "";
        row.style.display = nome.includes(termo) ? '' : 'none';
    });
    extrairDadosDaTabela();
}
