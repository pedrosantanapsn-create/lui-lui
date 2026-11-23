/* =====================================================================
   ABAS DO SITE
   O site é um arquivo só, mas mostra uma parte por vez: Início,
   Catálogo, Sobre ou Contato. Cada bloco da página diz a que aba
   pertence com data-aba="...". O endereço muda junto (#catalogo,
   #sobre...), então o botão Voltar do navegador funciona e dá para
   mandar o link direto de uma aba.
   ===================================================================== */
(function () {
  "use strict";

  // endereço -> aba. Os dois últimos são trechos dentro de uma aba.
  var ROTAS = {
    "": "inicio", "inicio": "inicio", "top": "inicio",
    "catalogo": "catalogo",
    "sobre": "sobre",
    "contato": "contato",
    "mais-vendidos": "inicio",
    "diferenciais": "sobre"
  };

  var TITULOS = {
    inicio:   "Liu e Lui | Semijoias",
    catalogo: "Catálogo | Liu e Lui Semijoias",
    sobre:    "Sobre a loja | Liu e Lui Semijoias",
    contato:  "Contato | Liu e Lui Semijoias"
  };

  var atual = null;

  function mostrar() {
    var chave = decodeURIComponent(location.hash.replace(/^#/, ""));
    // âncora que não é aba (ex.: "#main", do link de pular para o conteúdo)
    if (!(chave in ROTAS)) { if (atual) return; chave = ""; }

    var aba = ROTAS[chave];
    var mudou = aba !== atual;
    atual = aba;

    document.querySelectorAll("[data-aba]").forEach(function (bloco) {
      bloco.classList.toggle("fora-da-aba", bloco.dataset.aba !== aba);
    });

    document.body.classList.toggle("sem-banner", aba !== "inicio");
    document.body.dataset.abaAtual = aba;
    document.title = TITULOS[aba];

    document.querySelectorAll('.main-nav a, .mobile-nav a, .rodape-nav a').forEach(function (a) {
      var destino = ROTAS[(a.getAttribute("href") || "").replace(/^#/, "")];
      var ativo = destino === aba;
      a.classList.toggle("aba-ativa", ativo);
      if (ativo) a.setAttribute("aria-current", "page");
      else a.removeAttribute("aria-current");
    });

    // trecho dentro da aba (ex.: #diferenciais) rola até ele; aba nova
    // começa do topo
    var trecho = chave && chave !== aba ? document.getElementById(chave) : null;
    if (trecho && !trecho.hidden) {
      trecho.scrollIntoView({ block: "start" });
    } else if (mudou) {
      window.scrollTo(0, 0);
    }

    // avisa o cabeçalho (sólido ou transparente) e as animações de entrada
    window.dispatchEvent(new Event("scroll"));
  }

  window.addEventListener("hashchange", mostrar);
  mostrar();
})();
