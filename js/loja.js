/* =====================================================================
   LIU E LUI SEMIJOIAS
   O catálogo e as regras de frete vêm do banco (Supabase), alimentados
   pelo painel da loja. Aqui dentro: montagem dos cards, filtro por
   categoria, cálculo de frete por CEP e pedido pelo WhatsApp.

   As chaves abaixo são públicas de propósito. Com elas só dá para LER
   o que está publicado — quem decide isso são as regras do banco.
   ===================================================================== */
(function () {
  "use strict";

  var WHATSAPP  = "5519991703150";
  var URL_BANCO = "https://usgguljynvqorgzmaokh.supabase.co";
  var CHAVE     = "sb_publishable_iX1zDJp44BpBbcFseJxztQ_KX8HWhU5";
  var GUARDADO  = "liuelui-entrega";

  var ROTULOS = {
    brincos: "Brincos", colares: "Colares",
    aneis: "Anéis",     pulseiras: "Pulseiras"
  };

  var grade   = document.getElementById("gradeProdutos");
  var filtros = document.getElementById("filtros");
  var aviso   = document.getElementById("semResultado");
  var vitrine = document.getElementById("bestScroller");
  var secaoVendidos = document.getElementById("mais-vendidos");
  var blocoFrete = document.getElementById("frete");
  var formFrete  = document.getElementById("formFrete");
  var campoCep   = document.getElementById("cep");
  var saidaFrete = document.getElementById("freteResultado");

  var pecas  = [];
  var regras = [];
  var gratisAcima = null;
  var entrega = null;   // { cep, cidade, uf, modo: "entrega" | "retirada" }

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

  /* ------------------------------------------------- frete */

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

  // Quanto custa mandar ESTA peça para o destino escolhido.
  // Devolve null quando não há frete calculado ou a loja não entrega lá.
  function freteDaPeca(preco) {
    if (!entrega) return null;
    if (entrega.modo === "retirada") {
      var ret = regraDeRetirada();
      return ret ? { valor: 0, retirada: true, regra: ret } : null;
    }
    var regra = regraParaDestino(entrega.cidade, entrega.uf);
    if (!regra) return null;
    var gratis = gratisAcima !== null && Number(preco) >= gratisAcima;
    return { valor: gratis ? 0 : Number(regra.valor), gratis: gratis, regra: regra };
  }

  function linkDoPedido(nome, preco) {
    var linhas = ['Olá! Tenho interesse no produto "' + nome + '" (' + emReais(preco) + ")."];
    var f = freteDaPeca(preco);
    if (f && f.retirada) {
      linhas.push("Vou retirar na loja.");
    } else if (f) {
      linhas.push("Entrega para " + entrega.cidade + "/" + entrega.uf + " (CEP " + entrega.cep + "): " +
                  (f.valor === 0 ? "frete grátis" : "frete " + emReais(f.valor)) + ".");
      linhas.push("Total: " + emReais(Number(preco) + f.valor) + ".");
    }
    return "https://wa.me/" + WHATSAPP + "?text=" + encodeURIComponent(linhas.join("\n"));
  }

  function atualizarLinks() {
    document.querySelectorAll(".pedir[data-nome]").forEach(function (a) {
      a.href = linkDoPedido(a.dataset.nome, a.dataset.preco);
    });
  }

  function lembrar() {
    try {
      if (entrega) localStorage.setItem(GUARDADO, JSON.stringify(entrega));
      else localStorage.removeItem(GUARDADO);
    } catch (e) { /* navegação privada: segue sem lembrar */ }
  }

  function mostrarFrete() {
    if (!saidaFrete) return;
    saidaFrete.textContent = "";
    if (!entrega) return;

    var ret = regraDeRetirada();

    if (entrega.modo === "retirada" && ret) {
      saidaFrete.appendChild(elemento("strong", null, "Retirada na loja: grátis"));
      if (ret.prazo) saidaFrete.appendChild(document.createTextNode(" · " + ret.prazo));
      saidaFrete.appendChild(botaoTroca("Prefiro receber em casa", "entrega"));
      return;
    }

    var regra = regraParaDestino(entrega.cidade, entrega.uf);
    if (!regra) {
      saidaFrete.appendChild(document.createTextNode(
        "Ainda não temos entrega para " + entrega.cidade + "/" + entrega.uf +
        ". Chame a gente no WhatsApp para combinar."));
    } else {
      saidaFrete.appendChild(elemento("strong", null,
        "Entrega para " + entrega.cidade + "/" + entrega.uf + ": " + emReais(regra.valor)));
      if (regra.prazo) saidaFrete.appendChild(document.createTextNode(" · " + regra.prazo));
      if (gratisAcima !== null) {
        saidaFrete.appendChild(elemento("span", "frete-gratis",
          "Frete grátis em peças a partir de " + emReais(gratisAcima)));
      }
    }
    if (ret) saidaFrete.appendChild(botaoTroca("Prefiro retirar na loja (grátis)", "retirada"));
  }

  function botaoTroca(texto, modo) {
    var b = elemento("button", "frete-troca", texto);
    b.type = "button";
    b.addEventListener("click", function () {
      entrega.modo = modo;
      lembrar(); mostrarFrete(); atualizarLinks();
    });
    return b;
  }

  function iniciarFrete() {
    if (!formFrete || !campoCep) return;

    // máscara 00000-000 enquanto digita
    campoCep.addEventListener("input", function () {
      var d = campoCep.value.replace(/\D/g, "").slice(0, 8);
      campoCep.value = d.length > 5 ? d.slice(0, 5) + "-" + d.slice(5) : d;
    });

    formFrete.addEventListener("submit", function (ev) {
      ev.preventDefault();
      var d = campoCep.value.replace(/\D/g, "");
      if (d.length !== 8) {
        saidaFrete.textContent = "Digite o CEP com 8 números.";
        return;
      }
      saidaFrete.textContent = "Consultando o CEP…";

      fetch("https://viacep.com.br/ws/" + d + "/json/")
        .then(function (r) { return r.json(); })
        .then(function (j) {
          if (!j || j.erro || !j.localidade) {
            entrega = null; lembrar(); atualizarLinks();
            saidaFrete.textContent = "Não encontrei esse CEP. Confira os números.";
            return;
          }
          entrega = { cep: d.slice(0, 5) + "-" + d.slice(5), cidade: j.localidade, uf: j.uf, modo: "entrega" };
          lembrar(); mostrarFrete(); atualizarLinks();
        })
        .catch(function () {
          saidaFrete.textContent = "Não consegui consultar o CEP agora. Peça normalmente que combinamos o frete pelo WhatsApp.";
        });
    });
  }

  function ativarFrete(config, lista) {
    regras = lista || [];
    gratisAcima = config && config.frete_gratis_acima !== null && config.frete_gratis_acima !== undefined
      ? Number(config.frete_gratis_acima) : null;

    var ligado = !!(config && config.frete_ativo) && regras.length > 0;
    if (blocoFrete) blocoFrete.hidden = !ligado;
    if (!ligado) { entrega = null; atualizarLinks(); return; }

    // retoma o CEP da última visita, recalculando com as regras de hoje
    try {
      var salvo = JSON.parse(localStorage.getItem(GUARDADO) || "null");
      if (salvo && salvo.cep && salvo.cidade && salvo.uf) {
        entrega = salvo;
        if (campoCep) campoCep.value = salvo.cep;
      }
    } catch (e) { entrega = null; }

    mostrarFrete();
    atualizarLinks();
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
    pedir.dataset.nome = p.nome;
    pedir.dataset.preco = p.preco;
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
    grade.style.gridTemplateColumns = "";
    grade.style.justifyContent = "";
    grade.appendChild(caixa);
    if (filtros) filtros.hidden = true;
    if (blocoFrete) blocoFrete.hidden = true;
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
        carregarFrete(sb);
      })
      .catch(function () {
        recado("O catálogo não carregou agora",
               "Pode ser a conexão. Tente de novo em alguns minutos ou fale com a gente pelo WhatsApp.");
      });
  }

  // O frete é um extra: se ele falhar, o catálogo continua funcionando
  // e o pedido segue pelo WhatsApp sem o valor do frete.
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
    carregar();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", iniciar);
  } else {
    iniciar();
  }
})();
