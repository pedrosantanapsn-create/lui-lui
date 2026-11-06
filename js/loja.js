/* =====================================================================
   LIU E LUI SEMIJOIAS
   Filtro por categoria no catálogo e pedido pelo WhatsApp.
   ===================================================================== */
(function () {
  "use strict";

  var WHATSAPP = "5519991703150";

  /* ---------------------------------------- filtro por categoria */
  function iniciarFiltros() {
    var botoes = document.querySelectorAll("#filtros .filtro");
    var grade = document.getElementById("gradeProdutos");
    var aviso = document.getElementById("semResultado");
    if (!botoes.length || !grade) return;

    var cards = grade.querySelectorAll(".pcard");

    botoes.forEach(function (botao) {
      botao.addEventListener("click", function () {
        var escolhida = botao.dataset.categoria;

        botoes.forEach(function (b) { b.classList.remove("ativo"); });
        botao.classList.add("ativo");

        var visiveis = 0;
        cards.forEach(function (card) {
          var mostrar = escolhida === "todos" || card.dataset.categoria === escolhida;
          card.hidden = !mostrar;
          if (mostrar) visiveis++;
        });

        if (aviso) aviso.hidden = visiveis > 0;
      });
    });
  }

  /* ---------------------------------------- pedido pelo WhatsApp */
  function iniciarPedidos() {
    document.querySelectorAll(".pedir").forEach(function (link) {
      var produto = link.dataset.produto || "";
      var preco = link.dataset.preco || "";

      var texto = preco
        ? 'Olá! Tenho interesse no produto "' + produto + '" (R$ ' + preco + ")."
        : 'Olá! Tenho interesse no produto "' + produto + '".';

      link.href = "https://wa.me/" + WHATSAPP + "?text=" + encodeURIComponent(texto);
      link.target = "_blank";
      link.rel = "noopener";
    });
  }

  function iniciar() {
    iniciarFiltros();
    iniciarPedidos();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", iniciar);
  } else {
    iniciar();
  }
})();
