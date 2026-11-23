/* =====================================================================
   LIU E LUI SEMIJOIAS
   O catálogo vem do banco (Supabase), alimentado pelo painel da loja.
   Aqui dentro: montagem dos cards, filtro por categoria e pedido
   pelo WhatsApp.

   As chaves abaixo são públicas de propósito. Com elas só dá para LER
   as peças marcadas como publicadas — quem decide isso são as regras
   do banco, não este arquivo.
   ===================================================================== */
(function () {
  "use strict";

  var WHATSAPP  = "5519991703150";
  var URL_BANCO = "https://usgguljynvqorgzmaokh.supabase.co";
  var CHAVE     = "sb_publishable_iX1zDJp44BpBbcFseJxztQ_KX8HWhU5";

  var ROTULOS = {
    brincos: "Brincos", colares: "Colares",
    aneis: "Anéis",     pulseiras: "Pulseiras"
  };

  var grade   = document.getElementById("gradeProdutos");
  var filtros = document.getElementById("filtros");
  var aviso   = document.getElementById("semResultado");
  var vitrine = document.getElementById("bestScroller");
  var secaoVendidos = document.getElementById("mais-vendidos");

  var pecas = [];

  /* ------------------------------------------------- utilidades */

  function emReais(v) {
    return Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  }

  function soNumero(v) {
    return Number(v).toFixed(2).replace(".", ",");
  }

  function linkDoPedido(nome, preco) {
    var texto = 'Olá! Tenho interesse no produto "' + nome + '" (R$ ' + soNumero(preco) + ").";
    return "https://wa.me/" + WHATSAPP + "?text=" + encodeURIComponent(texto);
  }

  function elemento(tag, classe, texto) {
    var e = document.createElement(tag);
    if (classe) e.className = classe;
    if (texto !== undefined) e.textContent = texto;
    return e;
  }

  /* ------------------------------------------------- um card */

  function cartao(p) {
    var art = elemento("article", "pcard");
    art.dataset.categoria = p.categoria;

    var moldura = elemento("div", "frame");
    var img = document.createElement("img");
    img.src = p.foto_url || "img/favicon.png";
    img.alt = p.nome;
    img.loading = "lazy";
    moldura.appendChild(img);
    art.appendChild(moldura);

    var meta = elemento("div", "meta");
    meta.appendChild(elemento("span", "cat", ROTULOS[p.categoria] || p.categoria));
    meta.appendChild(elemento("h3", null, p.nome));

    var linha = elemento("div", "row");
    linha.appendChild(elemento("span", "price", emReais(p.preco)));

    var pedir = elemento("a", "pedir", "Pedir");
    pedir.href = linkDoPedido(p.nome, p.preco);
    pedir.target = "_blank";
    pedir.rel = "noopener";
    linha.appendChild(pedir);

    meta.appendChild(linha);
    art.appendChild(meta);
    return art;
  }

  /* ------------------------------------------------- recados na grade */

  function recado(titulo, texto) {
    var caixa = elemento("div", "recado-catalogo");
    caixa.appendChild(elemento("p", "recado-titulo", titulo));
    caixa.appendChild(elemento("p", null, texto));

    var a = elemento("a", "btn-v", "Falar pelo WhatsApp");
    a.href = "https://wa.me/" + WHATSAPP;
    a.target = "_blank";
    a.rel = "noopener";
    caixa.appendChild(a);

    grade.textContent = "";
    grade.appendChild(caixa);
    if (filtros) filtros.hidden = true;
    if (aviso) aviso.hidden = true;
  }

  /* ------------------------------------------------- desenhar tudo */

  function desenhar() {
    grade.textContent = "";
    pecas.forEach(function (p) { grade.appendChild(cartao(p)); });

    // A grade é de 4 colunas. Com uma ou duas peças isso deixaria um vão
    // enorme à direita, como se o site estivesse quebrado; então a grade
    // encolhe e centraliza enquanto o catálogo for pequeno.
    if (pecas.length < 4) {
      grade.style.gridTemplateColumns = "repeat(" + pecas.length + ", minmax(0, 300px))";
      grade.style.justifyContent = "center";
    } else {
      grade.style.gridTemplateColumns = "";
      grade.style.justifyContent = "";
    }

    // Só mostra o filtro de uma categoria que realmente tem peça. Assim
    // ninguém clica em "Anéis" e encontra a vitrine vazia.
    var existentes = {};
    pecas.forEach(function (p) { existentes[p.categoria] = true; });

    if (filtros) {
      filtros.hidden = false;
      filtros.querySelectorAll(".filtro").forEach(function (b) {
        var c = b.dataset.categoria;
        b.hidden = c !== "todos" && !existentes[c];
      });
    }

    var destaques = pecas.filter(function (p) { return p.destaque; });
    if (vitrine) {
      vitrine.textContent = "";
      destaques.slice(0, 8).forEach(function (p) { vitrine.appendChild(cartao(p)); });
    }
    // sem nenhuma peça marcada, a seção inteira sai do ar em vez de
    // ficar um trilho vazio
    if (secaoVendidos) secaoVendidos.hidden = destaques.length === 0;
    var linkMenu = document.querySelector('a[href="#mais-vendidos"]');
    if (linkMenu && linkMenu.parentElement) {
      linkMenu.parentElement.hidden = destaques.length === 0;
    }
  }

  /* ------------------------------------------------- filtro */

  function iniciarFiltros() {
    if (!filtros) return;
    filtros.addEventListener("click", function (ev) {
      var botao = ev.target.closest(".filtro");
      if (!botao) return;

      var escolhida = botao.dataset.categoria;
      filtros.querySelectorAll(".filtro").forEach(function (b) { b.classList.remove("ativo"); });
      botao.classList.add("ativo");

      var visiveis = 0;
      grade.querySelectorAll(".pcard").forEach(function (card) {
        var mostrar = escolhida === "todos" || card.dataset.categoria === escolhida;
        card.hidden = !mostrar;
        if (mostrar) visiveis++;
      });
      if (aviso) aviso.hidden = visiveis > 0;
    });
  }

  /* ------------------------------------------------- carregar do banco */

  function carregar() {
    if (!grade) return;

    if (!window.supabase) {
      recado("Não foi possível carregar o catálogo",
             "Atualize a página. Se continuar assim, fale com a gente que mostramos as peças por lá.");
      return;
    }

    var sb = window.supabase.createClient(URL_BANCO, CHAVE);

    sb.from("produtos")
      .select("nome,categoria,preco,foto_url,destaque,ordem,criado_em")
      .eq("publicado", true)
      .order("ordem", { ascending: true })
      .order("criado_em", { ascending: false })
      .then(function (r) {
        if (r.error) throw r.error;
        pecas = r.data || [];

        if (!pecas.length) {
          recado("Estamos atualizando o catálogo",
                 "As peças voltam para cá em breve. Enquanto isso, chame a gente no WhatsApp que mostramos tudo por lá.");
          return;
        }
        desenhar();
      })
      .catch(function () {
        recado("O catálogo não carregou agora",
               "Pode ser a conexão. Tente de novo em alguns minutos ou fale com a gente pelo WhatsApp.");
      });
  }

  function iniciar() {
    iniciarFiltros();
    carregar();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", iniciar);
  } else {
    iniciar();
  }
})();
