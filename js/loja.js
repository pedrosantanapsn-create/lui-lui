/* =====================================================================
   LIU E LUI SEMIJOIAS
   O catálogo e as regras de frete vêm do banco (Supabase), alimentados
   pelo painel da loja. Aqui dentro: montagem dos cards, filtro por
   categoria, sacola, frete por CEP e envio do pedido pelo WhatsApp.

   A sacola fica só no navegador da cliente. Nada é cobrado pelo site:
   o pedido vira uma mensagem de WhatsApp e a loja confirma por lá.

   As chaves abaixo são públicas de propósito. Com elas só dá para LER
   o que está publicado — quem decide isso são as regras do banco.
   ===================================================================== */
(function () {
  "use strict";

  var WHATSAPP  = "5519991703150";
  var URL_BANCO = "https://usgguljynvqorgzmaokh.supabase.co";
  var CHAVE     = "sb_publishable_iX1zDJp44BpBbcFseJxztQ_KX8HWhU5";
  var CHAVE_ENTREGA = "liuelui-entrega";
  var CHAVE_SACOLA  = "liuelui-sacola";
  var MAX_POR_PECA  = 9;

  var ROTULOS = {
    brincos: "Brincos", colares: "Colares",
    aneis: "Anéis",     pulseiras: "Pulseiras"
  };

  var el = function (id) { return document.getElementById(id); };

  var grade   = el("gradeProdutos");
  var filtros = el("filtros");
  var aviso   = el("semResultado");
  var vitrine = el("bestScroller");
  var secaoVendidos = el("mais-vendidos");
  var blocoFrete = el("frete");

  var pecas  = [];
  var regras = [];
  var freteLigado = false;
  var gratisAcima = null;
  var entrega = null;   // { cep, cidade, uf, modo: "entrega" | "retirada" }
  var sacola  = [];     // [{ id, qtd }]
  var recadoCep = "";   // mensagem passageira da consulta de CEP

  /* ------------------------------------------------- utilidades */

  function emReais(v) {
    return Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  }

  function semAcento(s) {
    return String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
  }

  function elemento(tag, classe, texto) {
    var e = document.createElement(tag);
    if (classe) e.className = classe;
    if (texto !== undefined) e.textContent = texto;
    return e;
  }

  function guardar(chave, valor) {
    try {
      if (valor === null) localStorage.removeItem(chave);
      else localStorage.setItem(chave, JSON.stringify(valor));
    } catch (e) { /* navegação privada: segue sem lembrar */ }
  }

  function ler(chave) {
    try { return JSON.parse(localStorage.getItem(chave) || "null"); }
    catch (e) { return null; }
  }

  function pecaPorId(id) {
    for (var i = 0; i < pecas.length; i++) if (pecas[i].id === id) return pecas[i];
    return null;
  }

  /* ------------------------------------------------- sacola: contas */

  function itemDaSacola(id) {
    for (var i = 0; i < sacola.length; i++) if (sacola[i].id === id) return sacola[i];
    return null;
  }

  function quantidadeTotal() {
    return sacola.reduce(function (s, it) { return s + it.qtd; }, 0);
  }

  function subtotal() {
    return sacola.reduce(function (s, it) {
      var p = pecaPorId(it.id);
      return s + (p ? Number(p.preco) * it.qtd : 0);
    }, 0);
  }

  function regraDeRetirada() {
    return regras.filter(function (r) { return r.escopo === "retirada"; })[0] || null;
  }

  // A regra mais específica ganha: lista de cidades, depois estado,
  // depois a regra geral do Brasil.
  function regraParaDestino(cidade, uf) {
    var c = semAcento(cidade), i, r;
    for (i = 0; i < regras.length; i++) {
      r = regras[i];
      if (r.escopo === "cidades" && (!r.uf || r.uf === uf) &&
          (r.cidades || []).some(function (x) { return semAcento(x) === c; })) return r;
    }
    for (i = 0; i < regras.length; i++) {
      r = regras[i];
      if (r.escopo === "estado" && r.uf === uf) return r;
    }
    for (i = 0; i < regras.length; i++) {
      if (regras[i].escopo === "brasil") return regras[i];
    }
    return null;
  }

  // Frete do pedido inteiro: um valor só, não importa quantas peças.
  // Devolve null quando não há CEP informado ou a loja não entrega lá.
  function fretePedido() {
    if (!freteLigado || !entrega) return null;
    if (entrega.modo === "retirada") {
      var ret = regraDeRetirada();
      return ret ? { valor: 0, retirada: true, regra: ret } : null;
    }
    var regra = regraParaDestino(entrega.cidade, entrega.uf);
    if (!regra) return null;
    var gratis = gratisAcima !== null && subtotal() >= gratisAcima;
    return { valor: gratis ? 0 : Number(regra.valor), gratis: gratis, regra: regra };
  }

  function mensagemDoPedido() {
    var linhas = ["Olá! Quero fazer este pedido:", ""];
    sacola.forEach(function (it) {
      var p = pecaPorId(it.id);
      if (p) linhas.push(it.qtd + "x " + p.nome + " — " + emReais(Number(p.preco) * it.qtd));
    });
    linhas.push("");

    var f = fretePedido();
    if (f && f.retirada) {
      linhas.push("Total: " + emReais(subtotal()));
      linhas.push("Vou retirar na loja.");
    } else if (f) {
      linhas.push("Subtotal: " + emReais(subtotal()));
      linhas.push("Entrega para " + entrega.cidade + "/" + entrega.uf + " (CEP " + entrega.cep + "): " +
                  (f.valor === 0 ? "frete grátis" : "frete " + emReais(f.valor)));
      linhas.push("Total: " + emReais(subtotal() + f.valor));
    } else {
      linhas.push("Total: " + emReais(subtotal()));
    }
    return linhas.join("\n");
  }

  /* ------------------------------------------------- sacola: ações */

  function mudarQuantidade(id, qtd) {
    var it = itemDaSacola(id);
    if (qtd <= 0) {
      sacola = sacola.filter(function (x) { return x.id !== id; });
    } else if (it) {
      it.qtd = Math.min(qtd, MAX_POR_PECA);
    } else {
      sacola.push({ id: id, qtd: Math.min(qtd, MAX_POR_PECA) });
    }
    guardar(CHAVE_SACOLA, sacola.length ? sacola : null);
    atualizarTudo();
  }

  // Ao carregar: joga fora o que não está mais publicado. Preço e nome
  // sempre vêm do banco, nunca do que ficou guardado no navegador.
  function reconciliarSacola() {
    var salva = ler(CHAVE_SACOLA);
    sacola = [];
    if (Array.isArray(salva)) {
      salva.forEach(function (it) {
        var q = parseInt(it && it.qtd, 10);
        if (it && pecaPorId(it.id) && q > 0 && !itemDaSacola(it.id)) {
          sacola.push({ id: it.id, qtd: Math.min(q, MAX_POR_PECA) });
        }
      });
    }
    guardar(CHAVE_SACOLA, sacola.length ? sacola : null);
  }

  /* ------------------------------------------------- telas */

  function atualizarTudo() {
    atualizarBotoes();
    atualizarBarra();
    desenharSacola();
    mostrarFrete();
  }

  function atualizarBotoes() {
    document.querySelectorAll(".adicionar[data-id]").forEach(function (b) {
      var dentro = !!itemDaSacola(b.dataset.id);
      var grande = b.classList.contains("peca-adicionar");
      b.classList.toggle("na-sacola", dentro);
      b.textContent = dentro ? (grande ? "Na sacola · ver sacola" : "Na sacola")
                             : (grande ? "Adicionar à sacola" : "Adicionar");
      b.setAttribute("aria-pressed", dentro ? "true" : "false");
    });
  }

  function atualizarBarra() {
    var barra = el("sacolaBarra");
    if (!barra) return;
    var n = quantidadeTotal();
    barra.hidden = n === 0;
    document.body.classList.toggle("com-sacola", n > 0);
    if (n > 0) {
      el("sacolaResumo").textContent = (n === 1 ? "1 peça" : n + " peças") + " · " + emReais(subtotal());
    }
  }

  function desenharSacola() {
    var lista = el("sacolaItens");
    if (!lista) return;
    lista.textContent = "";

    if (!sacola.length) {
      lista.appendChild(elemento("p", "sacola-vazia", "Sua sacola está vazia. Toque em “Adicionar” nas peças que quiser."));
    }

    sacola.forEach(function (it) {
      var p = pecaPorId(it.id);
      if (!p) return;

      var linha = elemento("div", "sacola-item");
      var img = document.createElement("img");
      img.src = p.foto_url || "img/favicon.png";
      img.alt = "";
      linha.appendChild(img);

      var info = elemento("div", "sacola-info");
      info.appendChild(elemento("div", "sacola-nome", p.nome));
      info.appendChild(elemento("div", "sacola-preco", emReais(Number(p.preco) * it.qtd)));

      var qtd = elemento("div", "sacola-qtd");
      var menos = elemento("button", null, "−");
      menos.type = "button";
      menos.setAttribute("aria-label", "Diminuir quantidade de " + p.nome);
      menos.addEventListener("click", function () { mudarQuantidade(it.id, it.qtd - 1); });
      var num = elemento("span", null, String(it.qtd));
      var mais = elemento("button", null, "+");
      mais.type = "button";
      mais.disabled = it.qtd >= MAX_POR_PECA;
      mais.setAttribute("aria-label", "Aumentar quantidade de " + p.nome);
      mais.addEventListener("click", function () { mudarQuantidade(it.id, it.qtd + 1); });
      qtd.appendChild(menos); qtd.appendChild(num); qtd.appendChild(mais);
      info.appendChild(qtd);
      linha.appendChild(info);

      var tirar = elemento("button", "sacola-tirar", "Tirar");
      tirar.type = "button";
      tirar.addEventListener("click", function () { mudarQuantidade(it.id, 0); });
      linha.appendChild(tirar);

      lista.appendChild(linha);
    });

    // totais
    var tot = el("sacolaTotais");
    tot.textContent = "";
    var f = fretePedido();

    function linhaTotal(rotulo, valor, forte) {
      var d = elemento("div", "sacola-linha" + (forte ? " forte" : ""));
      d.appendChild(elemento("span", null, rotulo));
      d.appendChild(elemento("span", null, valor));
      tot.appendChild(d);
    }

    if (sacola.length) {
      if (f && !f.retirada) {
        linhaTotal("Subtotal", emReais(subtotal()));
        linhaTotal("Frete", f.valor === 0 ? "Grátis" : emReais(f.valor));
        linhaTotal("Total", emReais(subtotal() + f.valor), true);
      } else {
        linhaTotal("Total", emReais(subtotal()), true);
      }
    }

    var enviar = el("sacolaEnviar");
    enviar.hidden = !sacola.length;
    enviar.href = "https://wa.me/" + WHATSAPP + "?text=" + encodeURIComponent(mensagemDoPedido());

    var blocoCep = el("sacolaFrete");
    if (blocoCep) blocoCep.hidden = !freteLigado || !sacola.length;
  }

  /* ------------------------------------------------- frete: telas */

  // O resultado aparece em dois lugares (acima da vitrine e dentro da
  // sacola), sempre com o mesmo conteúdo.
  function mostrarFrete() {
    document.querySelectorAll(".frete-resultado").forEach(function (saida) {
      saida.textContent = "";
      if (!freteLigado) return;

      if (recadoCep) { saida.textContent = recadoCep; return; }
      if (!entrega) return;

      var ret = regraDeRetirada();

      if (entrega.modo === "retirada" && ret) {
        saida.appendChild(elemento("strong", null, "Retirada na loja: grátis"));
        if (ret.prazo) saida.appendChild(document.createTextNode(" · " + ret.prazo));
        saida.appendChild(botaoTroca("Prefiro receber em casa", "entrega"));
        return;
      }

      var regra = regraParaDestino(entrega.cidade, entrega.uf);
      if (!regra) {
        saida.appendChild(document.createTextNode(
          "Ainda não temos entrega para " + entrega.cidade + "/" + entrega.uf +
          ". Chame a gente no WhatsApp para combinar."));
      } else {
        var f = fretePedido();
        var gratisAgora = f && f.gratis && sacola.length > 0;
        saida.appendChild(elemento("strong", null,
          "Entrega para " + entrega.cidade + "/" + entrega.uf + ": " +
          (gratisAgora ? "frete grátis" : emReais(regra.valor))));
        if (regra.prazo) saida.appendChild(document.createTextNode(" · " + regra.prazo));

        if (gratisAcima !== null && !gratisAgora) {
          var falta = gratisAcima - subtotal();
          saida.appendChild(elemento("span", "frete-gratis",
            sacola.length && falta > 0
              ? "Faltam " + emReais(falta) + " para o frete grátis"
              : "Frete grátis em pedidos a partir de " + emReais(gratisAcima)));
        }
      }
      if (ret) saida.appendChild(botaoTroca("Prefiro retirar na loja (grátis)", "retirada"));
    });

    document.querySelectorAll(".cep-campo").forEach(function (c) {
      if (entrega && document.activeElement !== c) c.value = entrega.cep;
    });
  }

  function botaoTroca(texto, modo) {
    var b = elemento("button", "frete-troca", texto);
    b.type = "button";
    b.addEventListener("click", function () {
      entrega.modo = modo;
      guardar(CHAVE_ENTREGA, entrega);
      atualizarTudo();
    });
    return b;
  }

  function iniciarFrete() {
    document.querySelectorAll(".frete-form").forEach(function (form) {
      var campo = form.querySelector(".cep-campo");
      if (!campo) return;

      // máscara 00000-000 enquanto digita
      campo.addEventListener("input", function () {
        var d = campo.value.replace(/\D/g, "").slice(0, 8);
        campo.value = d.length > 5 ? d.slice(0, 5) + "-" + d.slice(5) : d;
      });

      form.addEventListener("submit", function (ev) {
        ev.preventDefault();
        var d = campo.value.replace(/\D/g, "");
        if (d.length !== 8) {
          recadoCep = "Digite o CEP com 8 números.";
          mostrarFrete();
          return;
        }
        recadoCep = "Consultando o CEP…";
        mostrarFrete();

        fetch("https://viacep.com.br/ws/" + d + "/json/")
          .then(function (r) { return r.json(); })
          .then(function (j) {
            if (!j || j.erro || !j.localidade) {
              entrega = null;
              guardar(CHAVE_ENTREGA, null);
              recadoCep = "Não encontrei esse CEP. Confira os números.";
            } else {
              entrega = { cep: d.slice(0, 5) + "-" + d.slice(5), cidade: j.localidade, uf: j.uf, modo: "entrega" };
              guardar(CHAVE_ENTREGA, entrega);
              recadoCep = "";
            }
            atualizarTudo();
          })
          .catch(function () {
            recadoCep = "Não consegui consultar o CEP agora. Envie o pedido que combinamos o frete pelo WhatsApp.";
            atualizarTudo();
          });
      });
    });
  }

  function ativarFrete(config, lista) {
    regras = lista || [];
    gratisAcima = config && config.frete_gratis_acima !== null && config.frete_gratis_acima !== undefined
      ? Number(config.frete_gratis_acima) : null;
    freteLigado = !!(config && config.frete_ativo) && regras.length > 0;

    if (blocoFrete) blocoFrete.hidden = !freteLigado;

    // retoma o CEP da última visita; o valor é recalculado com as regras de hoje
    entrega = null;
    if (freteLigado) {
      var salvo = ler(CHAVE_ENTREGA);
      if (salvo && salvo.cep && salvo.cidade && salvo.uf) entrega = salvo;
    }
    atualizarTudo();
  }

  /* ------------------------------------------------- um card */

  function cartao(p) {
    var art = elemento("article", "pcard");
    art.dataset.categoria = p.categoria;

    // a foto e o nome levam à página da peça
    var moldura = elemento("a", "frame");
    moldura.href = "#peca=" + p.id;
    moldura.setAttribute("aria-label", "Ver " + p.nome);
    var img = document.createElement("img");
    img.src = p.foto_url || "img/favicon.png";
    img.alt = p.nome;
    img.loading = "lazy";
    moldura.appendChild(img);
    art.appendChild(moldura);

    var meta = elemento("div", "meta");
    meta.appendChild(elemento("span", "cat", ROTULOS[p.categoria] || p.categoria));
    var titulo = elemento("h3");
    var linkNome = elemento("a", null, p.nome);
    linkNome.href = "#peca=" + p.id;
    titulo.appendChild(linkNome);
    meta.appendChild(titulo);

    var linha = elemento("div", "row");
    linha.appendChild(elemento("span", "price", emReais(p.preco)));

    var botao = elemento("button", "adicionar", "Adicionar");
    botao.type = "button";
    botao.dataset.id = p.id;
    botao.addEventListener("click", function () {
      // já está na sacola: o toque abre a sacola em vez de somar sem querer
      if (itemDaSacola(p.id)) abrirSacola();
      else mudarQuantidade(p.id, 1);
    });
    linha.appendChild(botao);

    meta.appendChild(linha);
    art.appendChild(meta);
    return art;
  }

  /* ------------------------------------------------- página de uma peça */

  var estadoCatalogo = "carregando";   // "carregando" | "pronto" | "falhou"

  function idDaPeca() {
    var m = /^#peca=(.+)$/.exec(location.hash);
    return m ? decodeURIComponent(m[1]) : null;
  }

  function linkDaPeca(id) {
    return location.origin + location.pathname + "#peca=" + id;
  }

  function trocarFotoDaPeca(url, miniatura) {
    el("pecaFoto").src = url;
    el("pecaMiniaturas").querySelectorAll("button").forEach(function (b) {
      var escolhida = b === miniatura;
      b.classList.toggle("ativa", escolhida);
      b.setAttribute("aria-pressed", escolhida ? "true" : "false");
    });
  }

  function desenharPeca() {
    var id = idDaPeca();
    if (!id || !el("peca")) return;

    var espera = el("pecaEspera"), corpo = el("pecaCorpo"),
        sumiu = el("pecaSumiu"), parecidas = el("pecaParecidas");

    if (estadoCatalogo === "carregando") {
      espera.hidden = false; corpo.hidden = true; sumiu.hidden = true; parecidas.hidden = true;
      return;
    }

    var p = estadoCatalogo === "pronto" ? pecaPorId(id) : null;
    espera.hidden = true;
    corpo.hidden = !p;
    sumiu.hidden = !!p;
    parecidas.hidden = true;
    if (!p) return;

    document.title = p.nome + " | Liu e Lui Semijoias";

    el("pecaCat").textContent = ROTULOS[p.categoria] || p.categoria;
    el("pecaNome").textContent = p.nome;
    el("pecaPreco").textContent = emReais(p.preco);

    var desc = el("pecaDescricao");
    desc.textContent = p.descricao || "";
    desc.hidden = !p.descricao;

    // fotos: a principal primeiro, depois as extras
    var fotos = [p.foto_url || "img/favicon.png"].concat(p.fotos_extras || []);
    var foto = el("pecaFoto");
    foto.alt = p.nome;
    var minis = el("pecaMiniaturas");
    minis.textContent = "";
    minis.hidden = fotos.length < 2;
    fotos.forEach(function (url, i) {
      var b = elemento("button");
      b.type = "button";
      b.setAttribute("aria-label", "Foto " + (i + 1) + " de " + fotos.length);
      var im = document.createElement("img");
      im.src = url; im.alt = ""; im.loading = "lazy";
      b.appendChild(im);
      b.addEventListener("click", function () { trocarFotoDaPeca(url, b); });
      minis.appendChild(b);
    });
    trocarFotoDaPeca(fotos[0], minis.firstChild);

    var botao = el("pecaAdicionar");
    botao.dataset.id = p.id;

    el("pecaDuvida").href = "https://wa.me/" + WHATSAPP + "?text=" + encodeURIComponent(
      "Olá! Tenho uma dúvida sobre esta peça: " + p.nome + " (" + emReais(p.preco) + ")\n" + linkDaPeca(p.id));
    el("pecaCopiado").textContent = "";

    // até 4 peças da mesma categoria
    var outras = pecas.filter(function (x) { return x.categoria === p.categoria && x.id !== p.id; }).slice(0, 4);
    var gradeOutras = el("pecaParecidasGrade");
    gradeOutras.textContent = "";
    outras.forEach(function (x) { gradeOutras.appendChild(cartao(x)); });
    gradeOutras.style.gridTemplateColumns =
      outras.length < 4 ? "repeat(" + outras.length + ", minmax(0, 300px))" : "";
    parecidas.hidden = outras.length === 0;

    atualizarBotoes();
  }

  function iniciarPeca() {
    if (!el("peca")) return;

    el("pecaAdicionar").addEventListener("click", function () {
      var id = this.dataset.id;
      if (!id) return;
      if (itemDaSacola(id)) abrirSacola();
      else mudarQuantidade(id, 1);
    });

    el("pecaCompartilhar").addEventListener("click", function () {
      var id = idDaPeca(), p = id && pecaPorId(id);
      if (!p) return;
      var link = linkDaPeca(id), aviso = el("pecaCopiado");
      // no celular abre o menu de compartilhar; no computador copia
      if (navigator.share && window.matchMedia("(pointer: coarse)").matches) {
        navigator.share({ title: p.nome + " | Liu e Lui", url: link }).catch(function () {});
        return;
      }
      var copiar = navigator.clipboard && navigator.clipboard.writeText
        ? navigator.clipboard.writeText(link)
        : Promise.reject();
      copiar.then(function () { aviso.textContent = "Link copiado."; },
                  function () { aviso.textContent = link; });
    });

    window.addEventListener("hashchange", desenharPeca);
    desenharPeca();
  }

  /* ------------------------------------------------- sacola: abrir/fechar */

  function abrirSacola() {
    var d = el("sacola");
    if (d && !d.open) d.showModal();
  }

  function iniciarSacola() {
    var d = el("sacola");
    if (!d) return;
    el("sacolaAbrir").addEventListener("click", abrirSacola);
    el("sacolaFechar").addEventListener("click", function () { d.close(); });
    el("sacolaContinuar").addEventListener("click", function () {
      d.close();
      // "continuar escolhendo" leva de volta às peças, esteja onde estiver
      if (document.body.dataset.abaAtual !== "catalogo") location.hash = "#catalogo";
    });
    // toque fora da caixa fecha
    d.addEventListener("click", function (ev) { if (ev.target === d) d.close(); });
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
    grade.style.gridTemplateColumns = "";
    grade.style.justifyContent = "";
    grade.appendChild(caixa);
    if (filtros) filtros.hidden = true;
    if (blocoFrete) blocoFrete.hidden = true;
    if (aviso) aviso.hidden = true;
    if (secaoVendidos) secaoVendidos.hidden = true;
  }

  /* ------------------------------------------------- desenhar vitrine */

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
      estadoCatalogo = "falhou";
      desenharPeca();
      recado("Não foi possível carregar o catálogo",
             "Atualize a página. Se continuar assim, fale com a gente que mostramos as peças por lá.");
      return;
    }

    var sb = window.supabase.createClient(URL_BANCO, CHAVE);

    sb.from("produtos")
      .select("id,nome,categoria,preco,foto_url,fotos_extras,descricao,destaque,ordem,criado_em")
      .eq("publicado", true)
      .order("ordem", { ascending: true })
      .order("criado_em", { ascending: false })
      .then(function (r) {
        if (r.error) throw r.error;
        pecas = r.data || [];

        estadoCatalogo = "pronto";

        if (!pecas.length) {
          desenharPeca();
          recado("Estamos atualizando o catálogo",
                 "As peças voltam para cá em breve. Enquanto isso, chame a gente no WhatsApp que mostramos tudo por lá.");
          return;
        }
        desenhar();
        reconciliarSacola();
        atualizarTudo();
        desenharPeca();
        carregarFrete(sb);
      })
      .catch(function () {
        estadoCatalogo = "falhou";
        desenharPeca();
        recado("O catálogo não carregou agora",
               "Pode ser a conexão. Tente de novo em alguns minutos ou fale com a gente pelo WhatsApp.");
      });
  }

  // O frete é um extra: se ele falhar, o catálogo e a sacola continuam
  // funcionando e o pedido segue pelo WhatsApp sem o valor do frete.
  function carregarFrete(sb) {
    Promise.all([
      sb.from("config_loja").select("frete_ativo,frete_gratis_acima").limit(1),
      sb.from("frete_regras").select("rotulo,escopo,cidades,uf,valor,prazo,ordem").eq("ativo", true).order("ordem")
    ]).then(function (rs) {
      if (rs[0].error || rs[1].error) return;
      ativarFrete((rs[0].data || [])[0], rs[1].data);
    }).catch(function () { /* fica sem frete */ });
  }

  function iniciar() {
    iniciarFiltros();
    iniciarFrete();
    iniciarSacola();
    iniciarPeca();
    carregar();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", iniciar);
  } else {
    iniciar();
  }
})();
