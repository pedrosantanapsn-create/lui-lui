/* =====================================================================
   VELLUM — main.js
   Vanilla JS only. Each feature is a guard-claused init.
   ===================================================================== */
(function () {
  "use strict";

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* -------------------------------------------------- header solidify */
  function initHeader() {
    var header = document.getElementById("siteHeader");
    if (!header) return;
    var onScroll = function () {
      header.classList.toggle("solid", window.scrollY > 40);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
  }

  /* -------------------------------------------------- mobile overlay */
  function initMobileNav() {
    var toggle = document.getElementById("navToggle");
    var nav = document.getElementById("mobileNav");
    var close = document.getElementById("navClose");
    if (!toggle || !nav) return;

    var open = function () {
      nav.classList.add("open");
      toggle.setAttribute("aria-expanded", "true");
      document.body.style.overflow = "hidden";
      if (close) close.focus();
    };
    var shut = function () {
      nav.classList.remove("open");
      toggle.setAttribute("aria-expanded", "false");
      document.body.style.overflow = "";
      toggle.focus();
    };

    toggle.addEventListener("click", open);
    if (close) close.addEventListener("click", shut);
    nav.querySelectorAll("a").forEach(function (a) {
      a.addEventListener("click", shut);
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && nav.classList.contains("open")) shut();
    });
  }

  /* -------------------------------------------------- add-to-bag */
  function initBag() {
    var bag = document.getElementById("bagBtn");
    var count = document.getElementById("bagCount");
    if (!bag || !count) return;
    var n = 0;

    document.querySelectorAll(".add").forEach(function (btn) {
      btn.addEventListener("click", function () {
        n += 1;
        count.textContent = String(n);
        count.classList.remove("pulse");
        void count.offsetWidth; /* restart animation */
        count.classList.add("pulse");
        bag.setAttribute("aria-label", "Shopping bag, " + n + (n === 1 ? " item" : " items"));

        var label = btn.getAttribute("data-name") || "Item";
        btn.classList.add("added");
        var original = btn.innerHTML;
        btn.innerHTML =
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg> Added';
        window.setTimeout(function () {
          btn.classList.remove("added");
          btn.innerHTML = original;
        }, 1400);
      });
    });
  }

  /* -------------------------------------------------- bestsellers row */
  function initBestScroller() {
    var scroller = document.getElementById("bestScroller");
    var prev = document.getElementById("bestPrev");
    var next = document.getElementById("bestNext");
    if (!scroller || !prev || !next) return;

    var amount = function () {
      var card = scroller.querySelector(".pcard");
      return card ? card.getBoundingClientRect().width + 24 : 260;
    };
    var update = function () {
      var max = scroller.scrollWidth - scroller.clientWidth - 2;
      prev.disabled = scroller.scrollLeft <= 2;
      next.disabled = scroller.scrollLeft >= max;
    };

    prev.addEventListener("click", function () { scroller.scrollBy({ left: -amount(), behavior: reduceMotion ? "auto" : "smooth" }); });
    next.addEventListener("click", function () { scroller.scrollBy({ left: amount(), behavior: reduceMotion ? "auto" : "smooth" }); });
    scroller.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    update();
  }

  /* -------------------------------------------------- press rotator */
  function initPress() {
    var wrap = document.getElementById("pressQuotes");
    var dotsWrap = document.getElementById("pressDots");
    if (!wrap || !dotsWrap) return;
    var quotes = Array.prototype.slice.call(wrap.querySelectorAll(".press-quote"));
    var dots = Array.prototype.slice.call(dotsWrap.querySelectorAll("button"));
    if (quotes.length < 2) return;
    var i = 0;
    var timer = null;

    var show = function (idx) {
      i = (idx + quotes.length) % quotes.length;
      quotes.forEach(function (q, k) { q.classList.toggle("active", k === i); });
      dots.forEach(function (d, k) { d.setAttribute("aria-selected", k === i ? "true" : "false"); });
    };
    var start = function () {
      if (reduceMotion) return;
      stop();
      timer = window.setInterval(function () { show(i + 1); }, 5500);
    };
    var stop = function () { if (timer) window.clearInterval(timer); };

    dots.forEach(function (d, k) {
      d.addEventListener("click", function () { show(k); start(); });
    });
    wrap.addEventListener("mouseenter", stop);
    wrap.addEventListener("mouseleave", start);
    show(0);
    start();
  }

  /* -------------------------------------------------- gift tabs */
  function initGiftTabs() {
    var tabs = document.querySelectorAll(".gift-tab");
    var cards = document.querySelectorAll(".gift-card");
    if (!tabs.length || !cards.length) return;

    tabs.forEach(function (tab) {
      tab.addEventListener("click", function () {
        var tier = tab.getAttribute("data-tier");
        tabs.forEach(function (t) { t.setAttribute("aria-selected", t === tab ? "true" : "false"); });
        cards.forEach(function (card) {
          var show = tier === "all" || card.getAttribute("data-tier") === tier;
          card.classList.toggle("hide", !show);
        });
      });
    });
  }

  /* -------------------------------------------------- newsletter */
  function initNewsletter() {
    var form = document.getElementById("newsForm");
    var input = document.getElementById("newsEmail");
    var status = document.getElementById("newsStatus");
    if (!form || !input || !status) return;
    var re = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var val = input.value.trim();
      if (!re.test(val)) {
        status.textContent = "Please enter a valid email address.";
        status.className = "news-status err";
        input.focus();
        return;
      }
      status.textContent = "Merci — check your inbox to confirm and claim 10% off.";
      status.className = "news-status ok";
      form.reset();
    });
  }

  /* -------------------------------------------------- scroll reveal */
  function initReveal() {
    var els = document.querySelectorAll(".reveal");
    if (!els.length) return;
    if (reduceMotion || !("IntersectionObserver" in window)) {
      els.forEach(function (el) { el.classList.add("in"); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("in");
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.15, rootMargin: "0px 0px -8% 0px" });
    els.forEach(function (el) { io.observe(el); });
  }

  /* -------------------------------------------------- boot */
  document.addEventListener("DOMContentLoaded", function () {
    initHeader();
    initMobileNav();
    initBag();
    initBestScroller();
    initPress();
    initGiftTabs();
    initNewsletter();
    initReveal();
  });
})();
