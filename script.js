// ========================
// 1. Variáveis Globais
// ========================
let mapa = document.getElementById("mapa");
let cards = document.getElementById("cards");
let personagens = JSON.parse(localStorage.getItem("personagens")) || [];
let tamanho = 10;
let selecionado = null;
let ocultarVidaInimigos = false;
let ultimosDanoIds = []; 
let ultimosCuraIds = []; 
let morrendoIds = []; 

function obterInfoVida(p) {
  let vidaAtual = p.vida - (p.danoTomado || 0);
  let porcentagem = p.vida > 0 ? (vidaAtual / p.vida) * 100 : 0;
  if (porcentagem < 0) porcentagem = 0;
  
  let classeCor = "";
  if (porcentagem <= 25) classeCor = "health-critical";
  else if (porcentagem <= 50) classeCor = "health-low";
  
  return { vidaAtual, porcentagem, classeCor };
}

// ========================
// Interpretador de Fórmulas D&D
// ========================
function calcularExpressaoRPG(expressao) {
  let expText = expressao.replace(/\s+/g, '').toLowerCase();
  let regexDados = /(?:(\d+))?d(\d+)/g;

  let expComValores = expText.replace(regexDados, function(match, qtd, faces) {
      let numDados = qtd ? parseInt(qtd) : 1;
      let numFaces = parseInt(faces);
      let totalRolagem = 0;
      for(let i = 0; i < numDados; i++) {
          totalRolagem += Math.floor(Math.random() * numFaces) + 1;
      }
      return totalRolagem;
  });

  if (!/^[0-9+\-*/().]+$/.test(expComValores)) {
      throw new Error("Expressão inválida. Use apenas números, 'd', e operadores (+, -, *, /, ()).");
  }
  return Math.floor(eval(expComValores));
}

function atualizarSelectOrigem() {
  let select = document.getElementById("origemAcao");
  let valorAtual = select.value;
  select.innerHTML = '<option value="ambiente">Mestre / Ambiente</option>';
  
  personagens.forEach(p => {
      let opt = document.createElement("option");
      opt.value = p.id;
      opt.textContent = `${p.nome} (${p.tipo === 'aliado' ? 'A' : 'I'})`;
      select.appendChild(opt);
  });
  if (Array.from(select.options).some(o => o.value == valorAtual)) {
      select.value = valorAtual;
  }
}

// ========================
// 2. Criar grid do mapa
// ========================
function criarMapa() {
  mapa.innerHTML = "";
  for (let y = 0; y < tamanho; y++) {
    for (let x = 0; x < tamanho; x++) {
      let celula = document.createElement("div");
      celula.className = "celula";
      celula.dataset.x = x;
      celula.dataset.y = y;
      celula.ondragover = (e) => e.preventDefault();
      celula.ondrop = soltar;
      celula.onclick = () => clicarCelula(celula);
      let nomeCelula = document.createElement("div");
      nomeCelula.className = "nome-celula";
      nomeCelula.textContent = `${String.fromCharCode(65 + x)}${y + 1}`;
      celula.appendChild(nomeCelula);
      mapa.appendChild(celula);
    }
  }
  renderizarPersonagens();
}

function clicarCelula(celula) {
  let x = parseInt(celula.dataset.x);
  let y = parseInt(celula.dataset.y);
  let alvo = personagens.find((p) => p.x === x && p.y === y);
  
  if (alvo) {
    let modo = document.querySelector('input[name="modoClique"]:checked').value;
    let textoValor = document.getElementById("valorAcao").value;
    
    if (!textoValor) return alert("Informe um valor ou fórmula primeiro! (Ex: 15 ou 1d8+2)");
    
    let valorFinal;
    try {
      valorFinal = calcularExpressaoRPG(textoValor);
      if (valorFinal < 0) valorFinal = 0; 
    } catch (e) { return alert(e.message); }
    
    if (modo === "dano") aplicarDanoCelula(celula, valorFinal);
    else if (modo === "cura") aplicarCuraCelula(celula, valorFinal);
  }
}

// ADICIONAR RÁPIDO PELA BARRA
function adicionarPersonagem() {
  let nome = document.getElementById("nome").value.trim();
  let vida = parseInt(document.getElementById("vida").value);
  let iniciativa = parseInt(document.getElementById("iniciativa").value);
  let tipo = document.getElementById("tipo").value;

  if (!nome || isNaN(vida) || isNaN(iniciativa))
    return alert("Preencha todos os campos corretamente!");

  let p = {
    id: Date.now(), nome, vida, iniciativa, tipo,
    x: Math.floor(Math.random() * tamanho), y: Math.floor(Math.random() * tamanho),
    danoTomado: 0, totalDano: 0, totalCura: 0, danoDado: 0, curaDada: 0   
  };

  personagens.push(p);
  salvar(); atualizarSelectOrigem(); renderizarPersonagens(); atualizarCards();
}

function salvar() { localStorage.setItem("personagens", JSON.stringify(personagens)); }

function renderizarPersonagens() {
  document.querySelectorAll(".celula").forEach((c) => {
    let nomeC = c.querySelector(".nome-celula").outerHTML;
    c.innerHTML = nomeC;
  });

  let grupos = {};
  personagens.forEach((p) => {
    let key = `${p.x},${p.y}`;
    if (!grupos[key]) grupos[key] = [];
    grupos[key].push(p);
  });

  for (const key in grupos) {
    let [x, y] = key.split(",").map(Number);
    let celula = document.querySelector(`[data-x='${x}'][data-y='${y}']`);
    if (!celula) continue;

    let container = document.createElement("div");
    container.className = "container-personagens";

    grupos[key].forEach((p) => {
      let div = document.createElement("div");
      div.className = `personagem ${p.tipo}`;
      div.draggable = true;
      div.ondragstart = (e) => (selecionado = p.id);
      
      const info = obterInfoVida(p);
      let nomeAbrev = p.nome.substring(0, 3);
      div.innerHTML = `<span>${nomeAbrev}</span>`;
      
      if (!(ocultarVidaInimigos && p.tipo === "inimigo")) {
          let barContainer = document.createElement("div");
          barContainer.className = "health-bar-container";
          let barFill = document.createElement("div");
          barFill.className = "health-bar-fill";
          barFill.style.width = `${info.porcentagem}%`;
          barContainer.appendChild(barFill);
          div.appendChild(barContainer);
          div.title = `${p.nome} (${info.vidaAtual}/${p.vida})`;
      } else {
          div.title = `${p.nome} (Vida Oculta)`;
      }
      container.appendChild(div);
    });
    celula.appendChild(container);
  }
}

function soltar(e) {
  let id = selecionado;
  let p = personagens.find((p) => p.id == id);
  if (p) {
    p.x = parseInt(e.currentTarget.dataset.x);
    p.y = parseInt(e.currentTarget.dataset.y);
    salvar(); renderizarPersonagens();
  }
}

function atualizarCards() {
  cards.innerHTML = "";
  personagens
    .sort((a, b) => b.iniciativa - a.iniciativa)
    .forEach((p) => {
      const info = obterInfoVida(p);
      let vidaVisivel = (ocultarVidaInimigos && p.tipo === "inimigo") ? "???" : `${info.vidaAtual} / ${p.vida}`;
      
      let tDano = p.totalDano || 0; let tCura = p.totalCura || 0; 
      let dDado = p.danoDado || 0;  let cDada = p.curaDada || 0;  
      let historicoVisivel = (ocultarVidaInimigos && p.tipo === "inimigo") 
        ? "???" 
        : `⚔️(Deu:${dDado} Tomou:${tDano}) | 💚(Deu:${cDada} Tomou:${tCura})`;

      let destaque = "";
      if (ultimosDanoIds.includes(p.id)) destaque = "card-dano";
      else if (ultimosCuraIds.includes(p.id)) destaque = "card-cura";

      let card = document.createElement("div");
      card.className = `card ${p.tipo} ${destaque}`;

      let html = `
        <div class="card-header">
            <div style="display: flex; align-items: center; gap: 10px;">
                <span class="card-nome">${p.nome}</span>
                <span class="card-tipo">${p.tipo}</span>
            </div>
            <div>
              <button class="btn-remover" title="Abrir Ficha" onclick="abrirFicha(${p.id})" style="color:#00ffd5; margin-right: 5px; font-size: 14px;">📖</button>
              <button class="btn-remover" title="Remover" onclick="remover(${p.id})" style="color: #ccc; font-size: 14px;">✕</button>
            </div>
        </div>
        <div class="card-details">
            <span style="display:block; width:100%; font-size: 10px;">
               <b>Init:</b> ${p.iniciativa} <br>
               <b>Histórico:</b> ${historicoVisivel}
            </span>
        </div>
      `;
      
      if (!(ocultarVidaInimigos && p.tipo === "inimigo")) {
          html += `
            <div class="health-bar-container" title="Vida: ${vidaVisivel}">
                <div class="health-bar-fill ${info.classeCor}" style="width: ${info.porcentagem}%;"></div>
            </div>
            <div style="font-size: 10px; text-align: center; color: #aaa; margin-top: -2px;">${vidaVisivel}</div>
          `;
      } else {
          html += `<div style="font-size: 12px; text-align: center; color: #aaa; font-style: italic;">Vida Oculta</div>`;
      }
      card.innerHTML = html;

      if (morrendoIds.includes(p.id)) card.classList.add("card-morrendo");
      else if (p.tipo === "inimigo" && info.vidaAtual <= 0 && !morrendoIds.includes(p.id)) {
        morrendoIds.push(p.id); card.classList.add("card-morrendo");
        setTimeout(() => {
          personagens = personagens.filter((pers) => pers.id !== p.id);
          morrendoIds = morrendoIds.filter((id) => id !== p.id);
          salvar(); atualizarSelectOrigem(); renderizarPersonagens(); atualizarCards();
        }, 1000);
      }
      cards.appendChild(card);
    });
}

function remover(id) {
  personagens = personagens.filter((p) => p.id !== id);
  salvar(); atualizarSelectOrigem(); renderizarPersonagens(); atualizarCards();
}

function aplicarDanoCelula(celula, danoValor) {
  let x = parseInt(celula.dataset.x); let y = parseInt(celula.dataset.y);
  let alvo = personagens.find((p) => p.x === x && p.y === y);
  if (!alvo) return;
  
  alvo.danoTomado = (alvo.danoTomado || 0) + danoValor;
  alvo.totalDano = (alvo.totalDano || 0) + danoValor;

  let idOrigem = document.getElementById("origemAcao").value;
  if (idOrigem !== "ambiente") {
      let atacante = personagens.find(p => p.id == idOrigem);
      if (atacante) atacante.danoDado = (atacante.danoDado || 0) + danoValor;
  }
  if (!ultimosDanoIds.includes(alvo.id)) ultimosDanoIds.push(alvo.id);

  mostrarDano(celula, danoValor, false);
  salvar(); renderizarPersonagens(); atualizarCards();
  setTimeout(() => { ultimosDanoIds = ultimosDanoIds.filter((id) => id !== alvo.id); atualizarCards(); }, 800); 
}

function aplicarCuraCelula(celula, curaValor) {
  let x = parseInt(celula.dataset.x); let y = parseInt(celula.dataset.y);
  let alvo = personagens.find((p) => p.x === x && p.y === y);
  if (!alvo) return;
  
  alvo.danoTomado = (alvo.danoTomado || 0) - curaValor;
  if (alvo.danoTomado < 0) alvo.danoTomado = 0;
  alvo.totalCura = (alvo.totalCura || 0) + curaValor;

  let idOrigem = document.getElementById("origemAcao").value;
  if (idOrigem !== "ambiente") {
      let curandeiro = personagens.find(p => p.id == idOrigem);
      if (curandeiro) curandeiro.curaDada = (curandeiro.curaDada || 0) + curaValor;
  }
  if (!ultimosCuraIds.includes(alvo.id)) ultimosCuraIds.push(alvo.id);

  mostrarDano(celula, curaValor, true);
  salvar(); renderizarPersonagens(); atualizarCards();
  setTimeout(() => { ultimosCuraIds = ultimosCuraIds.filter((id) => id !== alvo.id); atualizarCards(); }, 800);
}

function resetMapa() {
  if (confirm("Tem certeza que deseja apagar todos os personagens?")) {
    personagens = []; salvar(); atualizarSelectOrigem(); renderizarPersonagens(); atualizarCards();
  }
}

function toggleOcultarVida() {
  ocultarVidaInimigos = !ocultarVidaInimigos; renderizarPersonagens(); atualizarCards();
}

function mostrarDano(celula, valor, isCura) {
  let span = document.createElement("span");
  span.className = isCura ? "cura" : "dano"; span.textContent = isCura ? `+${valor}` : `-${valor}`;
  celula.appendChild(span); setTimeout(() => span.remove(), 1000);
}

// ==========================================
// 14. SISTEMA DE FICHA DE PERSONAGEM
// ==========================================
let personagemFichaAtual = null;

function abrirNovaFicha() {
    personagemFichaAtual = null;
    document.getElementById("fichaNomeCabecalho").textContent = "Criar Novo Personagem";

    document.getElementById("fichaNome").value = "";
    document.getElementById("fichaRaca").value = "";
    document.getElementById("fichaClasse").value = "";
    document.getElementById("fichaNivel").value = "";
    document.getElementById("fichaTipo").value = "aliado";

    document.getElementById("fichaFor").value = "";
    document.getElementById("fichaDes").value = "";
    document.getElementById("fichaCon").value = "";
    document.getElementById("fichaInt").value = "";
    document.getElementById("fichaSab").value = "";
    document.getElementById("fichaCar").value = "";

    document.getElementById("fichaCA").value = "";
    document.getElementById("fichaPV").value = "";
    document.getElementById("fichaInit").value = "";
    document.getElementById("fichaDesloc").value = "";

    document.getElementById("fichaPericias").value = "";
    document.getElementById("ataque").value = "";
    document.getElementById("fichaEquipamentos").value = "";
    document.getElementById("fichaHabilidades").value = "";

    document.getElementById("ataque").dispatchEvent(new Event("input"));
    document.getElementById("modalFicha").style.display = "flex";
}

function abrirFicha(id) {
    let p = personagens.find(pers => pers.id === id);
    if (!p) return;
    personagemFichaAtual = p;

    document.getElementById("fichaNomeCabecalho").textContent = `Ficha: ${p.nome}`;
    document.getElementById("fichaNome").value = p.nome || "";
    document.getElementById("fichaRaca").value = p.raca || "";
    document.getElementById("fichaClasse").value = p.classe || "";
    document.getElementById("fichaNivel").value = p.nivel || "";
    document.getElementById("fichaTipo").value = p.tipo || "aliado";

    document.getElementById("fichaFor").value = p.forca || "";
    document.getElementById("fichaDes").value = p.destreza || "";
    document.getElementById("fichaCon").value = p.constituicao || "";
    document.getElementById("fichaInt").value = p.inteligencia || "";
    document.getElementById("fichaSab").value = p.sabedoria || "";
    document.getElementById("fichaCar").value = p.carisma || "";

    document.getElementById("fichaCA").value = p.ca || "";
    document.getElementById("fichaPV").value = p.vida || "";
    document.getElementById("fichaInit").value = p.iniciativa || "";
    document.getElementById("fichaDesloc").value = p.deslocamento || "";

    document.getElementById("fichaPericias").value = p.pericias || "";
    document.getElementById("ataque").value = p.ataqueFormula || "";
    document.getElementById("fichaEquipamentos").value = p.equipamentos || "";
    document.getElementById("fichaHabilidades").value = p.habilidades || "";

    document.getElementById("ataque").dispatchEvent(new Event("input"));
    document.getElementById("modalFicha").style.display = "flex";
}

function fecharFicha() {
    let ehNovo = false;
    let p = personagemFichaAtual;

    if (!p) {
        let nomeFicha = document.getElementById("fichaNome").value.trim() || "Desconhecido";
        let vidaFicha = parseInt(document.getElementById("fichaPV").value) || 10;
        let initFicha = parseInt(document.getElementById("fichaInit").value) || 0;
        let tipoFicha = document.getElementById("fichaTipo").value;
        
        p = {
            id: Date.now(),
            nome: nomeFicha,
            vida: vidaFicha,
            iniciativa: initFicha,
            tipo: tipoFicha,
            x: Math.floor(Math.random() * tamanho),
            y: Math.floor(Math.random() * tamanho),
            danoTomado: 0, totalDano: 0, totalCura: 0, danoDado: 0, curaDada: 0
        };
        ehNovo = true;
    }

    p.nome = document.getElementById("fichaNome").value || p.nome;
    p.raca = document.getElementById("fichaRaca").value;
    p.classe = document.getElementById("fichaClasse").value;
    p.nivel = document.getElementById("fichaNivel").value;
    p.tipo = document.getElementById("fichaTipo").value;

    p.forca = document.getElementById("fichaFor").value;
    p.destreza = document.getElementById("fichaDes").value;
    p.constituicao = document.getElementById("fichaCon").value;
    p.inteligencia = document.getElementById("fichaInt").value;
    p.sabedoria = document.getElementById("fichaSab").value;
    p.carisma = document.getElementById("fichaCar").value;

    p.ca = document.getElementById("fichaCA").value;
    p.deslocamento = document.getElementById("fichaDesloc").value;
    p.pericias = document.getElementById("fichaPericias").value;
    p.ataqueFormula = document.getElementById("ataque").value;
    p.equipamentos = document.getElementById("fichaEquipamentos").value;
    p.habilidades = document.getElementById("fichaHabilidades").value;

    let novaVida = parseInt(document.getElementById("fichaPV").value);
    if(!isNaN(novaVida)) p.vida = novaVida;

    let novaInit = parseInt(document.getElementById("fichaInit").value);
    if(!isNaN(novaInit)) p.iniciativa = novaInit;

    if (ehNovo) {
        personagens.push(p);
    }

    salvar(); 
    atualizarSelectOrigem(); 
    renderizarPersonagens(); 
    atualizarCards();
    
    document.getElementById("modalFicha").style.display = "none";
    personagemFichaAtual = null;
}

function enviarParaCombate() {
    let ataqueValor = document.getElementById("ataque").value;
    if (!ataqueValor) return alert("Preencha a fórmula de ataque primeiro (Ex: 1d8+3)!");

    let idDoPersonagem = personagemFichaAtual ? personagemFichaAtual.id : null;

    fecharFicha();

    if (!idDoPersonagem) {
        idDoPersonagem = personagens[personagens.length - 1].id;
    }

    document.getElementById("origemAcao").value = idDoPersonagem;
    document.getElementById("valorAcao").value = ataqueValor;
    document.querySelector('input[name="modoClique"][value="dano"]').checked = true;
    
    let inputValorAcao = document.getElementById("valorAcao");
    inputValorAcao.style.border = "2px solid #00ffd5";
    inputValorAcao.style.boxShadow = "0 0 10px #00ffd5";
    setTimeout(() => {
        inputValorAcao.style.border = "1px solid #444";
        inputValorAcao.style.boxShadow = "none";
    }, 1000);
}

document.getElementById("ataque").addEventListener("input", (e) => {
    const ataqueInput = e.target;
    const danoMinSpan = document.getElementById("danoMin");
    const danoMedioSpan = document.getElementById("danoMedio");
    const danoMaxSpan = document.getElementById("danoMax");

    const input = ataqueInput.value.replace(/\s+/g, ""); 
    if (!input) {
      danoMinSpan.textContent = "-"; danoMedioSpan.textContent = "-"; danoMaxSpan.textContent = "-"; return;
    }

    const regex = /([+-]?)(\d*)d(\d+)|([+-]\d+)/gi;
    let minTotal = 0; let maxTotal = 0; let bonusTotal = 0; let encontrou = false;
    let match;

    while ((match = regex.exec(input)) !== null) {
      encontrou = true;
      if (match[3]) {
        const sinal = match[1] === "-" ? -1 : 1;
        const qtd = parseInt(match[2]) || 1;
        const faces = parseInt(match[3]);
        const min = qtd * 1 * sinal;
        const max = qtd * faces * sinal;
        minTotal += min; maxTotal += max;
      } else if (match[4]) {
        bonusTotal += parseInt(match[4]);
      }
    }

    if (encontrou) {
      minTotal += bonusTotal; maxTotal += bonusTotal;
      danoMinSpan.textContent = minTotal;
      danoMedioSpan.textContent = ((minTotal + maxTotal) / 2).toFixed(1);
      danoMaxSpan.textContent = maxTotal;
    } else {
      danoMinSpan.textContent = "-"; danoMedioSpan.textContent = "-"; danoMaxSpan.textContent = "-";
    }
});


// ==========================================
// 15. SISTEMA DE BOT E AUTO-BATTLE
// ==========================================

const monstrosDisponiveis = [
    { nome: "Goblin Furioso", hpMin: 15, hpMax: 25, ataque: "1d6+2", alcance: 1 },
    { nome: "Orc Brutal", hpMin: 30, hpMax: 45, ataque: "1d12+4", alcance: 1 },
    { nome: "Dragão Vermelho", hpMin: 100, hpMax: 150, ataque: "2d10+8", alcance: 2 }
];

let loopDaIA = null;
let iaLigada = false;

let loopAutoBattle = null;
let autoBattleLigado = false;

function invocarBotAleatorio() {
    let monstroSorteado = monstrosDisponiveis[Math.floor(Math.random() * monstrosDisponiveis.length)];
    let vidaAleatoria = Math.floor(Math.random() * (monstroSorteado.hpMax - monstroSorteado.hpMin + 1)) + monstroSorteado.hpMin;

    let p = {
        id: Date.now(),
        nome: `[BOT] ${monstroSorteado.nome}`,
        vida: vidaAleatoria,
        iniciativa: Math.floor(Math.random() * 20) + 1,
        tipo: "inimigo",
        isBot: true, 
        ataqueBot: monstroSorteado.ataque,
        alcanceBot: monstroSorteado.alcance,
        x: Math.floor(Math.random() * tamanho),
        y: Math.floor(Math.random() * tamanho),
        danoTomado: 0, totalDano: 0, totalCura: 0, danoDado: 0, curaDada: 0
    };

    personagens.push(p);
    if (!ocultarVidaInimigos) toggleOcultarVida(); 
    salvar(); atualizarSelectOrigem(); renderizarPersonagens(); atualizarCards();
}

// IA SÓ PARA INIMIGOS
function toggleIA() {
    if (autoBattleLigado) return alert("Desligue a Luta Automática primeiro!");
    
    let btn = document.getElementById("btnIaBot");
    iaLigada = !iaLigada;

    if (iaLigada) {
        btn.style.background = "#00ffd5"; btn.style.color = "#000"; btn.textContent = "IA Inimiga (ON)";
        loopDaIA = setInterval(() => executarTurnos(true), 2000);
    } else {
        btn.style.background = "#333"; btn.style.color = "#aaa"; btn.textContent = "Despertar IA Inimiga";
        clearInterval(loopDaIA);
    }
}

// IA PARA TODOS (AUTO-BATTLE)
function toggleAutoBattle() {
    if (iaLigada) return alert("Desligue a IA Inimiga primeiro!");
    
    let btn = document.getElementById("btnAutoBattle");
    autoBattleLigado = !autoBattleLigado;

    if (autoBattleLigado) {
        btn.style.background = "#ea80fc"; btn.style.color = "#000"; btn.textContent = "⚔️ Porrada Comendo! (ON)";
        loopAutoBattle = setInterval(() => executarTurnos(false), 1500); 
    } else {
        btn.style.background = "#4a148c"; btn.style.color = "#fff"; btn.textContent = "⚔️ Luta 100% Automática";
        clearInterval(loopAutoBattle);
    }
}

// CÉREBRO PRINCIPAL PARA TODOS OS BONECOS
function executarTurnos(apenasInimigos) {
    let vivos = personagens.filter(p => p.vida - (p.danoTomado || 0) > 0);
    let aliados = vivos.filter(p => p.tipo === "aliado");
    let inimigos = vivos.filter(p => p.tipo === "inimigo");

    if (aliados.length === 0 || inimigos.length === 0) {
        if (autoBattleLigado) toggleAutoBattle();
        return;
    }

    let agentes = vivos;
    if (apenasInimigos) agentes = inimigos.filter(i => i.isBot);

    agentes.forEach(atacante => {
        let alvos = atacante.tipo === "aliado" ? inimigos : aliados;
        if (alvos.length === 0) return;

        let alvo = alvos.reduce((maisProximo, atual) => {
            let distMaisProximo = Math.max(Math.abs(atacante.x - maisProximo.x), Math.abs(atacante.y - maisProximo.y));
            let distAtual = Math.max(Math.abs(atacante.x - atual.x), Math.abs(atacante.y - atual.y));
            return distAtual < distMaisProximo ? atual : maisProximo;
        });

        let distanciaX = alvo.x - atacante.x;
        let distanciaY = alvo.y - atacante.y;
        let distanciaTotal = Math.max(Math.abs(distanciaX), Math.abs(distanciaY));

        let alcance = atacante.alcanceBot || 1;
        let ataqueFormula = atacante.ataqueBot || atacante.ataqueFormula || "1d4+1"; 

        if (distanciaTotal > alcance) {
            if (Math.abs(distanciaX) > Math.abs(distanciaY)) {
                atacante.x += distanciaX > 0 ? 1 : -1;
            } else {
                atacante.y += distanciaY > 0 ? 1 : -1;
            }
        } else {
            let danoCausado = calcularExpressaoRPG(ataqueFormula);
            let celulaAlvo = document.querySelector(`[data-x='${alvo.x}'][data-y='${alvo.y}']`);
            
            document.getElementById("origemAcao").value = atacante.id;
            
            if (celulaAlvo) aplicarDanoCelula(celulaAlvo, danoCausado);
        }
    });
    
    salvar();
    renderizarPersonagens();
}

// Inicialização
atualizarSelectOrigem();
criarMapa();
atualizarCards();

// =======================================================================
// SUPORTE PARA ARRASTAR E SOLTAR NO CELULAR (TOUCH EVENTS)
// =======================================================================
let tokenSendoArrastadoMobile = null;
let touchStartX = 0;
let touchStartY = 0;
let isDraggingMobile = false;

// 1. Quando o dedo TOCA no personagem
document.addEventListener("touchstart", function(e) {
    let tokenDiv = e.target.closest('.personagem');
    if (tokenDiv) {
        let celulaPai = tokenDiv.closest('.celula');
        if (celulaPai) {
            let xStr = celulaPai.getAttribute('data-x');
            let yStr = celulaPai.getAttribute('data-y');
            
            tokenSendoArrastadoMobile = personagens.find(p => p.x == xStr && p.y == yStr);
            
            if (tokenSendoArrastadoMobile) {
                let touch = e.touches[0];
                touchStartX = touch.clientX;
                touchStartY = touch.clientY;
                isDraggingMobile = false; // Começa assumindo que é só um "toque/clique" normal
                tokenDiv.id = "token-movendo-mobile"; 
            }
        }
    }
}, { passive: false });

// 2. Quando o dedo COMEÇA A MOVER pela tela
document.addEventListener("touchmove", function(e) {
    if (!tokenSendoArrastadoMobile) return;

    let touch = e.touches[0];
    let diffX = Math.abs(touch.clientX - touchStartX);
    let diffY = Math.abs(touch.clientY - touchStartY);

    // Se o dedo deslizou mais de 10 pixels, aí sim ativamos o "modo arrasto"
    if (diffX > 10 || diffY > 10) {
        isDraggingMobile = true;
        
        if (e.target.closest('#mapa')) {
            e.preventDefault(); // Só trava a tela de rolar se estiver realmente arrastando
        }
        
        let tokenDiv = document.getElementById("token-movendo-mobile");
        if (tokenDiv) {
            tokenDiv.style.opacity = "0.5"; // Fica transparente para mostrar que pegou
        }
    }
}, { passive: false });

// 3. Quando o dedo SOLTA a tela
document.addEventListener("touchend", function(e) {
    if (!tokenSendoArrastadoMobile) return;

    let tokenDiv = document.getElementById("token-movendo-mobile");
    if (tokenDiv) {
        tokenDiv.style.opacity = "1";
        tokenDiv.removeAttribute("id");
    }

    // Só teleporta o boneco se for um ARRASTO de verdade
    if (isDraggingMobile) {
        e.preventDefault(); // Impede o clique fantasma no final do arrasto

        let touch = e.changedTouches[0];
        
        let todosTokens = document.querySelectorAll('.personagem');
        todosTokens.forEach(t => t.style.pointerEvents = 'none');
        
        let elementoAbaixo = document.elementFromPoint(touch.clientX, touch.clientY);
        
        todosTokens.forEach(t => t.style.pointerEvents = 'auto'); 

        if (elementoAbaixo) {
            let celulaDestino = elementoAbaixo.closest('.celula');
            if (celulaDestino) {
                tokenSendoArrastadoMobile.x = parseInt(celulaDestino.getAttribute("data-x"));
                tokenSendoArrastadoMobile.y = parseInt(celulaDestino.getAttribute("data-y"));
                
                salvar();
                renderizarPersonagens();
            }
        }
    }
    // SE NÃO FOI ARRASTO (isDraggingMobile == false), não fazemos nada aqui.
    // O próprio navegador vai disparar o evento de CLIQUE na sequência, deixando você dar o dano!

    // Limpa a memória
    tokenSendoArrastadoMobile = null;
    isDraggingMobile = false;
});