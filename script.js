// ========================
// 1. Variáveis Globais
// ========================
let mapa = document.getElementById("mapa");
let cards = document.getElementById("cards");
let personagens = JSON.parse(localStorage.getItem("personagens")) || [];
let tamanho = 10;
let selecionado = null;
let modoArea = true; // para dano em área
let modoCuraArea = false; // para cura em área
let ocultarVidaInimigos = false;
let ultimosDanoIds = []; // array para múltiplos danificados
let ultimosCuraIds = []; // array para múltiplos curados
let morrendoIds = []; // array para personagens animando a morte

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

// Função para clicar numa célula do mapa
function clicarCelula(celula) {
  if (modoArea || modoCuraArea) {
    celula.classList.toggle("afetado");
  } else {
    let x = parseInt(celula.dataset.x);
    let y = parseInt(celula.dataset.y);
    let alvo = personagens.find((p) => p.x === x && p.y === y);
    if (alvo) {
      aplicarDanoCelula(celula);
    } else {
      alert("Não há personagem nessa célula para aplicar dano.");
    }
  }
}

// ========================
// 3. Adicionar novo personagem
// ========================
function adicionarPersonagem() {
  let nome = document.getElementById("nome").value.trim();
  let vida = parseInt(document.getElementById("vida").value);
  let iniciativa = parseInt(document.getElementById("iniciativa").value);
  let tipo = document.getElementById("tipo").value;

  if (!nome || isNaN(vida) || isNaN(iniciativa))
    return alert("Preencha todos os campos corretamente!");

  let p = {
    id: Date.now(),
    nome,
    vida,
    iniciativa,
    tipo,
    x: Math.floor(Math.random() * tamanho),
    y: Math.floor(Math.random() * tamanho),
    danoTomado: 0,
  };

  personagens.push(p);
  salvar();
  renderizarPersonagens();
  atualizarCards();
}

// ========================
// 4. Salvar no localStorage
// ========================
function salvar() {
  localStorage.setItem("personagens", JSON.stringify(personagens));
}

// ========================
// 5. Renderizar personagens no mapa
// ========================
function renderizarPersonagens() {
  document.querySelectorAll(".celula").forEach((c) => {
    c.innerHTML = c.querySelector(".nome-celula").outerHTML;
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
      let vidaVisivel =
        ocultarVidaInimigos && p.tipo === "inimigo"
          ? "???"
          : p.vida - p.danoTomado;
      div.innerHTML = `${p.nome}<br>(${vidaVisivel})`;
      container.appendChild(div);
    });

    celula.appendChild(container);
  }
}

// ========================
// 6. Soltar personagem no mapa
// ========================
function soltar(e) {
  let id = selecionado;
  let p = personagens.find((p) => p.id == id);
  if (p) {
    p.x = parseInt(e.currentTarget.dataset.x);
    p.y = parseInt(e.currentTarget.dataset.y);
    salvar();
    renderizarPersonagens();
  }
}

// ========================
// 7. Atualizar painel de cards (com animações de dano, cura e morte)
// ========================
function atualizarCards() {
  cards.innerHTML = "";
  personagens
    .sort((a, b) => b.iniciativa - a.iniciativa)
    .forEach((p) => {
      let vidaVisivel =
        ocultarVidaInimigos && p.tipo === "inimigo"
          ? "???"
          : p.vida - p.danoTomado;

      let destaque = "";
      if (ultimosDanoIds.includes(p.id)) destaque = "card-dano";
      else if (ultimosCuraIds.includes(p.id)) destaque = "card-cura";

      let card = document.createElement("div");
      card.className = `card ${destaque}`;

      card.innerHTML = `
        <span><strong>${p.nome}</strong></span>
        <span>${p.tipo}</span>
        <span>Vida: ${vidaVisivel}</span>
        <span>Init: ${p.iniciativa}</span>
        <button onclick="remover(${p.id})">✕</button>
      `;

      // Se o personagem está na lista de morrendo, adiciona a animação
      if (morrendoIds.includes(p.id)) {
        card.classList.add("card-morrendo");
      } else if (
        p.tipo === "inimigo" &&
        p.vida - p.danoTomado <= 0 &&
        !morrendoIds.includes(p.id)
      ) {
        morrendoIds.push(p.id);
        card.classList.add("card-morrendo");

        setTimeout(() => {
          personagens = personagens.filter((pers) => pers.id !== p.id);
          morrendoIds = morrendoIds.filter((id) => id !== p.id);
          salvar();
          renderizarPersonagens();
          atualizarCards();
        }, 1000);
      }

      cards.appendChild(card);
    });
}

// ========================
// 8. Remover personagem
// ========================
function remover(id) {
  personagens = personagens.filter((p) => p.id !== id);
  salvar();
  renderizarPersonagens();
  atualizarCards();
}

// ========================
// 9. Aplicar dano (normal ou área)
// ========================
function aplicarDano() {
  let dano = parseInt(document.getElementById("dano").value);
  if (isNaN(dano)) return alert("Informe o dano!");

  if (modoArea) {
    let afetadas = document.querySelectorAll(".celula.afetado");
    if (afetadas.length === 0)
      return alert(
        "Selecione pelo menos uma célula para aplicar dano em área!"
      );
    afetadas.forEach((celula) => {
      aplicarDanoCelula(celula, dano);
      celula.classList.remove("afetado");
    });
  } else {
    alert("Clique em uma célula para aplicar dano individualmente.");
  }
}

// ========================
// 10. Aplicar cura (normal ou área)
// ========================
function aplicarCura() {
  let cura = parseInt(document.getElementById("cura").value);
  if (isNaN(cura)) return alert("Informe o valor da cura!");

  if (modoCuraArea) {
    let afetadas = document.querySelectorAll(".celula.afetado");
    if (afetadas.length === 0)
      return alert(
        "Selecione pelo menos uma célula para aplicar cura em área!"
      );
    afetadas.forEach((celula) => {
      aplicarCuraCelula(celula, cura);
      celula.classList.remove("afetado");
    });
  } else {
    alert("Clique em uma célula para aplicar cura individualmente.");
  }
}

// ========================
// 11. Aplicar dano em célula (um personagem)
// ========================
function aplicarDanoCelula(celula, danoOverride = null) {
  let x = parseInt(celula.dataset.x);
  let y = parseInt(celula.dataset.y);
  let alvo = personagens.find((p) => p.x === x && p.y === y);
  if (!alvo) return;
  let dano =
    danoOverride !== null
      ? danoOverride
      : parseInt(document.getElementById("dano").value);
  if (isNaN(dano)) return;
  alvo.danoTomado += dano;
  if (alvo.danoTomado > alvo.vida) alvo.danoTomado = alvo.vida;

  if (!ultimosDanoIds.includes(alvo.id)) {
    ultimosDanoIds.push(alvo.id);
  }

  mostrarDano(celula, dano, false);
  salvar();
  renderizarPersonagens();
  atualizarCards();

  setTimeout(() => {
    ultimosDanoIds = ultimosDanoIds.filter((id) => id !== alvo.id);
    atualizarCards();
  }, 2000);
}

// ========================
// 12. Aplicar cura em célula
// ========================
function aplicarCuraCelula(celula, curaOverride = null) {
  let x = parseInt(celula.dataset.x);
  let y = parseInt(celula.dataset.y);
  let alvo = personagens.find((p) => p.x === x && p.y === y);
  if (!alvo) return;
  let cura =
    curaOverride !== null
      ? curaOverride
      : parseInt(document.getElementById("cura").value);
  if (isNaN(cura)) return;

  alvo.danoTomado -= cura;
  if (alvo.danoTomado < 0) alvo.danoTomado = 0;

  if (!ultimosCuraIds.includes(alvo.id)) {
    ultimosCuraIds.push(alvo.id);
  }

  mostrarDano(celula, cura, true);
  salvar();
  renderizarPersonagens();
  atualizarCards();

  setTimeout(() => {
    ultimosCuraIds = ultimosCuraIds.filter((id) => id !== alvo.id);
    atualizarCards();
  }, 2000);
}

// ========================
// 13. Mostrar dano ou cura visual
// ========================
function mostrarDano(celula, valor, isCura) {
  let dmg = document.createElement("div");
  dmg.className = isCura ? "cura" : "dano";
  dmg.textContent = isCura ? `+${valor}` : `-${valor}`;
  celula.appendChild(dmg);
  setTimeout(() => dmg.remove(), 1000);
}

// ========================
// 14. Resetar mapa e personagens
// ========================
function resetMapa() {
  personagens = [];
  salvar();
  criarMapa();
  atualizarCards();
}

// ========================
// 15. Toggle modo área (dano)
// ========================
function toggleAreaInput() {
  modoArea = document.getElementById("emArea").checked;
  if (modoArea) {
    document.getElementById("curaEmArea").checked = false;
    modoCuraArea = false;
  }
  limparSelecaoAfetados();
}

// ========================
// 16. Toggle modo área (cura)
// ========================
function toggleCuraAreaInput() {
  modoCuraArea = document.getElementById("curaEmArea").checked;
  if (modoCuraArea) {
    document.getElementById("emArea").checked = false;
    modoArea = false;
  }
  limparSelecaoAfetados();
}

// ========================
// 17. Limpar seleção células afetadas
// ========================
function limparSelecaoAfetados() {
  document.querySelectorAll(".celula.afetado").forEach((c) => {
    c.classList.remove("afetado");
  });
}

// ========================
// 18. Toggle ocultar vida inimigos
// ========================
function toggleOcultarVida() {
  ocultarVidaInimigos = !ocultarVidaInimigos;

  const btn = document.querySelector('button[onclick="toggleOcultarVida()"]');
  btn.textContent = ocultarVidaInimigos
    ? "Mostrar Vida Inimigos"
    : "Ocultar Vida Inimigos";

  renderizarPersonagens();
  atualizarCards();
}

// ========================
// 19. Listeners dos toggles de área
// ========================
// document.getElementById("emArea").addEventListener("change", toggleAreaInput);
// document.getElementById("curaEmArea").addEventListener("change", toggleCuraAreaInput);

// ========================
// 20. Inicialização
// ========================
criarMapa();
atualizarCards();
