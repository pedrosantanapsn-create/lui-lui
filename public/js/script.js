// ===== Liu e Lui — catálogo e painel de cadastro =====

const WHATSAPP = "5519991703150";
const ROTULOS = { brincos: "Brincos", colares: "Colares", aneis: "Anéis", pulseiras: "Pulseiras" };
const INICIAIS = { brincos: "B", colares: "C", aneis: "A", pulseiras: "P" };

let produtos = [];
let filtro = "todos";

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
    return `<article class="produto">
      <div class="produto-foto">${foto}</div>
      <div class="produto-dados">
        <span class="produto-cat">${ROTULOS[p.categoria] || limpar(p.categoria)}</span>
        <span class="produto-nome">${limpar(p.nome)}</span>
        <span class="produto-preco">${reais(p.preco)}</span>
        <a class="botao botao-ouro" target="_blank" rel="noopener" href="https://wa.me/${WHATSAPP}?text=${msg}">Pedir</a>
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

carregar();
