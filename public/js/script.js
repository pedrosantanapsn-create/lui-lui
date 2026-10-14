// ===== Liu e Lui — catálogo e painel de cadastro =====

const WHATSAPP = "5519991703150";
const ROTULOS = { brincos: "Brincos", colares: "Colares", aneis: "Anéis", pulseiras: "Pulseiras" };
const INICIAIS = { brincos: "B", colares: "C", aneis: "A", pulseiras: "P" };

let produtos = [];
let filtro = "todos";
let senha = "";          // guardada só no navegador de quem administra
let editandoId = null;
let fotoNova = null;     // imagem já reduzida, em base64

const $ = (id) => document.getElementById(id);
const reais = (v) => Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const limpar = (t) => String(t).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

/* ---------- Catálogo ---------- */
function desenhar() {
  const lista = filtro === "todos" ? produtos : produtos.filter((p) => p.categoria === filtro);
  const grade = $("produtos");

  if (!lista.length) {
    grade.innerHTML = `<p class="vazio">${produtos.length ? "Nenhum produto nesta categoria." : "Nenhum produto cadastrado ainda."}</p>`;
    return;
  }

  grade.innerHTML = lista.map((p) => {
    const msg = encodeURIComponent(`Olá! Tenho interesse no produto "${p.nome}" (${reais(p.preco)}).`);
    const foto = p.foto
      ? `<img src="${p.foto}" alt="${limpar(p.nome)}" loading="lazy">`
      : `<span class="sem-foto">${INICIAIS[p.categoria] || "LL"}</span>`;
    const ferramentas = senha
      ? `<div class="produto-ferramentas">
           <button type="button" data-editar="${p.id}">Editar</button>
           <button type="button" data-excluir="${p.id}">Excluir</button>
         </div>`
      : "";
    return `<article class="produto">
      <div class="produto-foto">${foto}</div>
      <div class="produto-dados">
        <span class="produto-cat">${ROTULOS[p.categoria] || limpar(p.categoria)}</span>
        <span class="produto-nome">${limpar(p.nome)}</span>
        <span class="produto-preco">${reais(p.preco)}</span>
        <a class="botao botao-ouro" target="_blank" rel="noopener" href="https://wa.me/${WHATSAPP}?text=${msg}">Pedir</a>
        ${ferramentas}
      </div>
    </article>`;
  }).join("");
}

async function carregar() {
  try {
    const r = await fetch("/api/produtos");
    produtos = await r.json();
  } catch {
    produtos = [];
    $("produtos").innerHTML = '<p class="vazio">Não foi possível carregar os produtos.</p>';
    return;
  }
  desenhar();
}

/* ---------- Filtros e menu ---------- */
document.querySelectorAll("#filtros .chip").forEach((b) => {
  b.addEventListener("click", () => {
    document.querySelectorAll("#filtros .chip").forEach((x) => x.classList.remove("ativo"));
    b.classList.add("ativo");
    filtro = b.dataset.filtro;
    desenhar();
  });
});

$("menu-botao").addEventListener("click", () => $("menu-lista").classList.toggle("aberto"));
document.querySelectorAll("#menu-lista a").forEach((a) =>
  a.addEventListener("click", () => $("menu-lista").classList.remove("aberto"))
);

$("ano").textContent = new Date().getFullYear();

/* ---------- Login do painel ---------- */
$("painel-abrir").addEventListener("click", () => {
  $("painel-abrir").hidden = true;
  $("form-login").hidden = false;
  $("login-senha").focus();
});

$("login-cancelar").addEventListener("click", () => {
  $("form-login").hidden = true;
  $("painel-abrir").hidden = false;
  $("login-aviso").textContent = "";
});

$("form-login").addEventListener("submit", async (e) => {
  e.preventDefault();
  const tentativa = $("login-senha").value;
  $("login-aviso").textContent = "Verificando…";
  $("login-aviso").classList.remove("erro");
  try {
    const r = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ senha: tentativa }),
    });
    if (!r.ok) throw new Error("Senha incorreta.");
    senha = tentativa;
    try { sessionStorage.setItem("liuelui_senha", senha); } catch {}
    abrirPainel();
  } catch (err) {
    $("login-aviso").textContent = err.message;
    $("login-aviso").classList.add("erro");
  }
});

function abrirPainel() {
  $("form-login").hidden = true;
  $("painel-abrir").hidden = true;
  $("painel-admin").hidden = false;
  $("login-senha").value = "";
  $("login-aviso").textContent = "";
  desenhar();
}

$("sair").addEventListener("click", () => {
  senha = "";
  try { sessionStorage.removeItem("liuelui_senha"); } catch {}
  $("painel-admin").hidden = true;
  $("painel-abrir").hidden = false;
  limparFormulario();
  desenhar();
});

/* ---------- Foto: reduz para no máximo 800px ---------- */
$("f-foto").addEventListener("change", () => {
  const arquivo = $("f-foto").files[0];
  if (!arquivo) return;
  const img = new Image();
  img.onload = () => {
    const max = 800;
    const escala = Math.min(1, max / Math.max(img.width, img.height));
    const tela = document.createElement("canvas");
    tela.width = Math.round(img.width * escala);
    tela.height = Math.round(img.height * escala);
    tela.getContext("2d").drawImage(img, 0, 0, tela.width, tela.height);
    fotoNova = tela.toDataURL("image/jpeg", 0.85);
    mostrarPrevia(fotoNova);
  };
  img.src = URL.createObjectURL(arquivo);
});

function mostrarPrevia(src) {
  const img = $("f-previa");
  if (src) { img.src = src; img.hidden = false; }
  else { img.removeAttribute("src"); img.hidden = true; }
}

function avisar(texto, erro) {
  const a = $("f-aviso");
  a.textContent = texto;
  a.classList.toggle("erro", !!erro);
}

function limparFormulario() {
  editandoId = null;
  fotoNova = null;
  $("form-produto").reset();
  mostrarPrevia(null);
  $("form-titulo").textContent = "Cadastrar produto";
  $("f-salvar").textContent = "Salvar";
  $("f-cancelar").hidden = true;
}

$("f-cancelar").addEventListener("click", () => { limparFormulario(); avisar(""); });

/* ---------- Salvar (cadastrar ou editar) ---------- */
$("form-produto").addEventListener("submit", async (e) => {
  e.preventDefault();
  const atual = editandoId ? produtos.find((p) => String(p.id) === String(editandoId)) : null;
  const corpo = {
    nome: $("f-nome").value.trim(),
    categoria: $("f-categoria").value,
    preco: parseFloat($("f-preco").value),
    foto: fotoNova || (atual ? atual.foto || "" : ""),
  };
  if (!corpo.nome || isNaN(corpo.preco)) { avisar("Preencha nome e preço.", true); return; }

  $("f-salvar").disabled = true;
  avisar("Salvando…");
  try {
    const r = await fetch(editandoId ? `/api/produtos/${editandoId}` : "/api/produtos", {
      method: editandoId ? "PUT" : "POST",
      headers: { "Content-Type": "application/json", "x-senha": senha },
      body: JSON.stringify(corpo),
    });
    const dados = await r.json();
    if (!r.ok) throw new Error(dados.erro || "Erro ao salvar.");
    const editou = !!editandoId;
    limparFormulario();
    await carregar();
    avisar(editou ? "Alterações salvas." : "Produto cadastrado!");
  } catch (err) {
    avisar(err.message, true);
  }
  $("f-salvar").disabled = false;
});

/* ---------- Editar e excluir ---------- */
$("produtos").addEventListener("click", async (e) => {
  const btnEditar = e.target.closest("[data-editar]");
  const btnExcluir = e.target.closest("[data-excluir]");

  if (btnEditar) {
    const p = produtos.find((x) => String(x.id) === btnEditar.dataset.editar);
    if (!p) return;
    editandoId = p.id;
    fotoNova = null;
    $("f-nome").value = p.nome;
    $("f-categoria").value = p.categoria;
    $("f-preco").value = p.preco;
    $("f-foto").value = "";
    mostrarPrevia(p.foto || null);
    $("form-titulo").textContent = "Editar produto";
    $("f-salvar").textContent = "Salvar alterações";
    $("f-cancelar").hidden = false;
    avisar("");
    $("painel").scrollIntoView({ behavior: "smooth", block: "center" });
  }

  if (btnExcluir) {
    if (btnExcluir.dataset.confirmar !== "1") {
      btnExcluir.dataset.confirmar = "1";
      btnExcluir.textContent = "Confirmar?";
      setTimeout(() => { btnExcluir.dataset.confirmar = ""; btnExcluir.textContent = "Excluir"; }, 4000);
      return;
    }
    try {
      const r = await fetch(`/api/produtos/${btnExcluir.dataset.excluir}`, {
        method: "DELETE",
        headers: { "x-senha": senha },
      });
      if (!r.ok) throw new Error("Não foi possível excluir.");
      await carregar();
      avisar("Produto excluído.");
    } catch (err) {
      avisar(err.message, true);
    }
  }
});

/* ---------- Início ---------- */
try {
  const guardada = sessionStorage.getItem("liuelui_senha");
  if (guardada) { senha = guardada; abrirPainel(); }
} catch {}
carregar();
