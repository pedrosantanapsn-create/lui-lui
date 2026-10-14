// ===== Painel administrativo — Liu e Lui =====

const ROTULOS = { brincos: "Brincos", colares: "Colares", aneis: "Anéis", pulseiras: "Pulseiras" };
const INICIAIS = { brincos: "B", colares: "C", aneis: "A", pulseiras: "P" };

let produtos = [];
let senha = "";
let editandoId = null;
let fotoNova = null;

const $ = (id) => document.getElementById(id);
const reais = (v) => Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const limpar = (t) => String(t).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

/* ---------- Login ---------- */
$("form-login").addEventListener("submit", async (e) => {
  e.preventDefault();
  const tentativa = $("login-senha").value;
  $("login-botao").disabled = true;
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
  $("login-botao").disabled = false;
});

function abrirPainel() {
  $("tela-login").hidden = true;
  $("tela-painel").hidden = false;
  $("sair").hidden = false;
  $("login-senha").value = "";
  $("login-aviso").textContent = "";
  carregar();
}

$("sair").addEventListener("click", () => {
  senha = "";
  try { sessionStorage.removeItem("liuelui_senha"); } catch {}
  $("tela-painel").hidden = true;
  $("tela-login").hidden = false;
  $("sair").hidden = true;
  limparFormulario();
});

/* ---------- Lista ---------- */
async function carregar() {
  try {
    const r = await fetch("/api/produtos");
    produtos = await r.json();
  } catch {
    $("linhas").innerHTML = '<tr><td colspan="5" class="vazio-linha">Não foi possível carregar os produtos.</td></tr>';
    return;
  }
  desenharResumo();
  desenharTabela();
}

function desenharResumo() {
  const porCategoria = {};
  produtos.forEach((p) => { porCategoria[p.categoria] = (porCategoria[p.categoria] || 0) + 1; });
  const comFoto = produtos.filter((p) => p.foto).length;
  const itens = [
    { valor: produtos.length, texto: "produtos no site" },
    { valor: comFoto, texto: "com foto" },
    { valor: Object.keys(porCategoria).length, texto: "categorias usadas" },
  ];
  $("resumo").innerHTML = itens
    .map((i) => `<div class="resumo-item"><strong>${i.valor}</strong><span>${i.texto}</span></div>`)
    .join("");
}

function desenharTabela() {
  if (!produtos.length) {
    $("linhas").innerHTML = '<tr><td colspan="5" class="vazio-linha">Nenhum produto cadastrado ainda. Use o formulário acima.</td></tr>';
    return;
  }
  $("linhas").innerHTML = produtos.map((p) => {
    const foto = p.foto
      ? `<img class="tabela-foto" src="${p.foto}" alt="${limpar(p.nome)}">`
      : `<span class="tabela-sem-foto">${INICIAIS[p.categoria] || "LL"}</span>`;
    return `<tr>
      <td>${foto}</td>
      <td class="tabela-nome">${limpar(p.nome)}</td>
      <td><span class="etiqueta">${ROTULOS[p.categoria] || limpar(p.categoria)}</span></td>
      <td class="tabela-preco">${reais(p.preco)}</td>
      <td>
        <div class="acoes">
          <button type="button" data-editar="${p.id}">Editar</button>
          <button type="button" class="perigo" data-excluir="${p.id}">Excluir</button>
        </div>
      </td>
    </tr>`;
  }).join("");
}

$("recarregar").addEventListener("click", carregar);

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

/* ---------- Salvar ---------- */
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
$("linhas").addEventListener("click", async (e) => {
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
    $("form-produto").scrollIntoView({ behavior: "smooth", block: "center" });
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
