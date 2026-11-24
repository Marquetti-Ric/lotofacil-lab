/* Robô do Lotofácil Lab: monta o carrinho no Loterias Online da Caixa.
   Só seleciona números e clica em "Colocar no Carrinho". Nunca abre o pagamento.
   v2: reconhece a modalidade pelo endereço OU pelo título (ex.: "Quina Friday"),
   acha números e botões pelo texto quando os ids mudam, tem seletor manual e diagnóstico. */
(function () {
  if (!/loteriasonline\.caixa\.gov\.br/.test(location.hostname)) {
    alert("Abra o Loterias Online da Caixa (loteriasonline.caixa.gov.br), entre na sua conta e clique de novo neste favorito.");
    return;
  }
  var old = document.getElementById("lflab-robo");
  if (old) { old.remove(); return; }

  var JOGOS = {
    lf: { nome: "Lotofácil", max: 25, min: 15, maxSel: 20 },
    ms: { nome: "Mega-Sena", max: 60, min: 6, maxSel: 20 },
    qn: { nome: "Quina", max: 80, min: 5, maxSel: 15 },
    mm: { nome: "+Milionária", max: 50, min: 6, maxSel: 12 },
    tm: { nome: "Timemania", max: 80, min: 10, maxSel: 10 },
    lm: { nome: "Lotomania", max: 100, min: 50, maxSel: 50 }
  };
  var wait = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
  var pad = function (n) { return n === 100 ? "00" : (n < 10 ? "0" : "") + n; }; // Lotomania: 00 = 100
  var norm = function (t) { return String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().replace(/[^A-Z0-9/+]+/g, " ").replace(/\s*\/\s*/g, "/").trim(); };
  var txt = function () { return document.body.innerText || ""; };
  var vis = function (el) { return !!(el && el.isConnected && (el.offsetWidth || el.offsetHeight || el.getClientRects().length)) && !(box && box.contains(el)); };
  var box = null;

  /* ---------- Qual modalidade ---------- */
  function porTexto(s) {
    s = norm(s);
    if (!s) return null;
    if (/MILIONARIA/.test(s)) return "mm";
    if (/LOTOFACIL/.test(s)) return "lf";
    if (/LOTOMANIA/.test(s)) return "lm";
    if (/TIMEMANIA/.test(s)) return "tm";
    if (/DUPLA ?SENA|DIA DE SORTE|SUPER ?SETE|LOTECA|FEDERAL/.test(s)) return null;
    if (/MEGA ?SENA|MEGA DA VIRADA/.test(s)) return "ms";
    if (/QUINA/.test(s)) return "qn"; // Quina, Quina Friday, Quina de São João...
    return null;
  }
  function detectar() {
    var u = decodeURIComponent(location.hash + " " + location.pathname).toLowerCase().replace(/[-_]/g, " ");
    var g = porTexto(u);
    if (g) return g;
    var hs = document.querySelectorAll("h1, h2, h3, .titulo, [class*='titulo'], [class*='title']");
    for (var i = 0; i < hs.length && i < 40; i++) if (vis(hs[i])) { g = porTexto(hs[i].innerText); if (g) return g; }
    return porTexto(document.title);
  }
  function jogoDaPagina() { var s = box && box.querySelector(".modal").value; return s && s !== "auto" ? s : detectar(); }

  /* ---------- Volante: números ---------- */
  var SEL_RE = /(^|[\s_-])(selected|selecionad\w*|ativo|active|marcad\w*|checked)($|[\s_-])/i;
  function cls(el) { var c = el && el.className; return typeof c === "string" ? c : (c && c.baseVal) || ""; }
  function marcado1(el) {
    if (SEL_RE.test(cls(el))) return true;
    var a = el.getAttribute("aria-pressed") || el.getAttribute("aria-checked") || el.getAttribute("aria-selected");
    if (el.tagName === "IMG" && /(^|[_\-\/.])(on|sel\w*|ativo|ativ\w*|marcad\w*|active|checked)([_\-.]|$)/i.test((el.getAttribute("src") || "").split("/").pop())) return true;
    return a === "true" || (el.type === "checkbox" && el.checked);
  }
  function marcado(el) {
    if (!el) return false;
    if (marcado1(el)) return true;
    var filhos = el.querySelectorAll ? el.querySelectorAll("*") : [];
    for (var i = 0; i < filhos.length && i < 6; i++) if (marcado1(filhos[i])) return true;
    var p = el.parentElement; // às vezes a classe fica no <li> em volta
    return !!(p && p.children.length === 1 && marcado1(p));
  }
  var mapa = null;
  function mapear(g) {
    var cfg = JOGOS[g], m = {}, n, el, achados = 0;
    // 1) jeito antigo: ids n01, n02... (n00 = 100 na Lotomania)
    for (n = 1; n <= cfg.max; n++) { el = document.getElementById("n" + pad(n)) || (n === 100 ? document.getElementById("n100") : null); if (el && vis(el)) { m[n] = el; achados++; } }
    if (achados >= cfg.max) return m;
    // 2) pelo texto: elementos clicáveis cujo texto é só o número, agrupados pelo mesmo "volante"
    var cands = document.querySelectorAll("a, button, li, span, div, td, label, [ng-click], [role=button], [role=checkbox]");
    var grupos = new Map();
    Array.prototype.forEach.call(cands, function (e) {
      if (!vis(e)) return;
      var t = (e.innerText || e.textContent || "").trim();
      if (!/^\d{1,3}$/.test(t)) return;
      var v = +t; if (g === "lm" && v === 0) v = 100;
      if (v < 1 || v > cfg.max) return;
      // fica com o elemento mais externo que ainda é só o número
      var up = e; while (up.parentElement && (up.parentElement.innerText || "").trim() === t) up = up.parentElement;
      var cont = up.parentElement; for (var k = 0; k < 3 && cont && cont.parentElement; k++) { if (cont.querySelectorAll("*").length > 30) break; cont = cont.parentElement; }
      var key = cont || document.body;
      if (!grupos.has(key)) grupos.set(key, {});
      var gg = grupos.get(key); if (!gg[v]) gg[v] = up;
    });
    var melhor = null, mc = 0;
    grupos.forEach(function (gg) { var c = Object.keys(gg).length; if (c > mc) { mc = c; melhor = gg; } });
    if (melhor && mc >= cfg.max * 0.9) {
      // um volante pode estar dividido em vários blocos: junta os grupos que completam o 1..max
      grupos.forEach(function (gg) { Object.keys(gg).forEach(function (k) { if (!melhor[k] && Object.keys(gg).length >= 5) melhor[k] = gg[k]; }); });
      for (n = 1; n <= cfg.max; n++) if (!m[n] && melhor[n]) m[n] = melhor[n];
    }
    return m;
  }
  function numEl(g, n) { if (!mapa || !mapa[n] || !mapa[n].isConnected) mapa = mapear(g); return mapa[n] || null; }
  function volantePronto(g) { mapa = mapear(g); return Object.keys(mapa).length >= JOGOS[g].max; }
  function selecionados(g) {
    if (!mapa) mapa = mapear(g);
    return Object.keys(mapa).map(Number).filter(function (n) { return marcado(mapa[n]); }).sort(function (a, b) { return a - b; });
  }
  function clicar(el) {
    var alvo = el.querySelector && el.querySelector("[ng-click], a, button, input") || el;
    alvo.click();
  }

  /* ---------- Botões ---------- */
  function botao(id, re) {
    var el = document.getElementById(id);
    if (el && vis(el)) return el;
    var bs = document.querySelectorAll("button, a, [ng-click], [role=button], input[type=button], input[type=submit]");
    for (var i = 0; i < bs.length; i++) { var b = bs[i]; if (vis(b) && re.test(norm(b.innerText || b.value || b.title || b.getAttribute("aria-label")))) return b; }
    return null;
  }
  var btCarrinho = function () { return botao("colocarnocarrinho", /^(COLOCAR|ADICIONAR|INCLUIR) (NO |AO )?CARRINHO/); };
  var btLimpar = function () { return botao("limparvolante", /^LIMPAR( VOLANTE| APOSTA| TUDO)?$/); };

  function dinheiro(re) { var m = txt().match(re); return m ? parseFloat(m[1].replace(/\./g, "").replace(",", ".")) : NaN; }
  var total = function () { return dinheiro(/Total (?:das? apostas?|do carrinho)\s*:?\s*R\$\s*([\d.,]+)/i); };
  var valorAposta = function () { return dinheiro(/Valor da aposta\s*:?\s*R\$\s*([\d.,]+)/i); };
  function contadorCarrinho() {
    var els = document.querySelectorAll("[id*='carrinho' i], [class*='carrinho' i], [class*='cart' i]");
    for (var i = 0; i < els.length; i++) { var t = (els[i].innerText || "").trim(); if (/^\d{1,4}$/.test(t)) return +t; }
    return NaN;
  }

  /* ---------- Trevos (+Milionária) e Time do Coração (Timemania) ---------- */
  // Os trevos podem ser só imagens (o número desenhado, sem texto). Acha a área pelos botões
  // "Complete os Trevos" / "Limpar os Trevos" e o texto "Trevos da Sorte".
  var btTrevoLimpar = function () { return botao("limpartrevos", /^LIMPAR (OS )?TREVOS$/); };
  var btTrevoComplete = function () { return botao("completetrevos", /^COMPLETE (OS )?TREVOS$/); };
  function areaTrevos() {
    var b = btTrevoComplete() || btTrevoLimpar();
    var a = b;
    while (a && a.parentElement) { a = a.parentElement; if (/TREVOS? DA SORTE/.test(norm(a.innerText)) && a.querySelectorAll("*").length > 12) return a; }
    var ps = document.querySelectorAll("p, span, div, label, h3, h4");
    for (var i = 0; i < ps.length; i++) if (vis(ps[i]) && /^ESCOLHA .*TREVOS/.test(norm(ps[i].innerText)) && ps[i].children.length < 3) { var c = ps[i].parentElement; for (var k = 0; k < 3 && c; k++) { if (c.querySelectorAll("*").length > 12) return c; c = c.parentElement; } }
    return null;
  }
  function numeroDe(el, idx) {
    var cand = [(el.innerText || "").trim(), el.getAttribute("alt"), el.getAttribute("title"), el.getAttribute("aria-label"), el.getAttribute("data-trevo"), el.getAttribute("value"), el.id];
    var im = el.querySelector && el.querySelector("img, [alt], [title], [aria-label]");
    if (im) cand.push(im.getAttribute("alt"), im.getAttribute("title"), im.getAttribute("aria-label"), (im.getAttribute("src") || "").split("/").pop());
    if (el.tagName === "IMG") cand.push((el.getAttribute("src") || "").split("/").pop());
    for (var i = 0; i < cand.length; i++) { var m = String(cand[i] || "").match(/(?:^|\D)0?([1-6])(?:\D|$)/); if (m) return +m[1]; }
    return idx + 1; // pela ordem, da esquerda para a direita
  }
  function trevoEls() {
    var achados = {};
    // 1) jeito antigo: elementos com o número escrito
    var cands = document.querySelectorAll('[id*="trevo" i] *, [class*="trevo" i] *, [id*="trevo" i], [class*="trevo" i], a[id^="t"][ng-click]');
    Array.prototype.forEach.call(cands, function (el) {
      if (!vis(el)) return;
      var t = (el.innerText || el.textContent || "").trim();
      if (!/^\d$/.test(t)) return;
      var v = +t; if (v >= 1 && v <= 6 && !achados[v]) achados[v] = el;
    });
    if (Object.keys(achados).length >= 6) return achados;
    // 2) pela área: um bloco com 6 itens parecidos (as imagens dos trevos)
    var area = areaTrevos(); if (!area) return achados;
    var pais = area.querySelectorAll("*"), melhor = null;
    for (var i = 0; i < pais.length && !melhor; i++) {
      var filhos = Array.prototype.filter.call(pais[i].children, function (c) { return vis(c) && !/COMPLETE|LIMPAR|SURPRESINHA/.test(norm(c.innerText)) && !c.querySelector("button"); });
      if (filhos.length < 6 || filhos.length > 7) continue;
      var tag = filhos[0].tagName, iguais = filhos.filter(function (c) { return c.tagName === tag; });
      if (iguais.length !== 6) continue;
      var r0 = iguais[0].getBoundingClientRect();
      if (r0.width < 12 || r0.width > 140 || r0.height < 12 || r0.height > 140) continue;
      melhor = iguais;
    }
    if (!melhor) return trevosPorPosicao() || achados;
    var res = {};
    melhor.forEach(function (el, ix) { var n = numeroDe(el, ix); if (!res[n]) res[n] = el; });
    if (Object.keys(res).length < 6) { res = {}; melhor.forEach(function (el, ix) { res[ix + 1] = el; }); }
    return res;
  }
  // 3) pela posição na tela: 6 desenhos quadrados entre "Escolha ... Trevos" e o botão "Complete os Trevos"
  function faixaTrevos() {
    var b = btTrevoComplete() || btTrevoLimpar(); if (!b) return null;
    var para = null, ps = document.querySelectorAll("p, span, div, label, h3, h4, h5, strong");
    for (var i = 0; i < ps.length; i++) if (vis(ps[i]) && /^ESCOLHA .*TREVOS/.test(norm(ps[i].innerText)) && norm(ps[i].innerText).length < 90) para = ps[i];
    var rb = b.getBoundingClientRect(), rp = para && para.getBoundingClientRect();
    var topo = rp && rp.top < rb.top - 20 && rb.top - rp.top < 400 ? rp.top - 2 : rb.top - 180;
    var area = areaTrevos(), ra = area ? area.getBoundingClientRect() : { left: 0, right: innerWidth };
    return { top: topo, bottom: rb.top + 2, left: Math.max(0, ra.left), right: Math.min(innerWidth, Math.max(ra.right, rb.right)) };
  }
  function trevosPorPosicao() {
    var f = faixaTrevos(); if (!f || f.bottom - f.top < 15) return null;
    var els = Array.prototype.filter.call(document.body.querySelectorAll("*"), function (e) {
      if (box.contains(e)) return false;
      var r = e.getBoundingClientRect();
      if (!r.width || r.top < f.top - 1 || r.bottom > f.bottom + 1) return false;
      return r.width >= 18 && r.width <= 130 && r.height >= 18 && r.height <= 130 && Math.abs(r.width - r.height) <= 0.45 * Math.max(r.width, r.height);
    });
    var grupos = [];
    els.forEach(function (e) {
      var r = e.getBoundingClientRect(), cx = r.left + r.width / 2;
      var g = grupos.filter(function (x) { return Math.abs(x.cx - cx) < 10; })[0];
      if (!g) { g = { cx: cx, els: [] }; grupos.push(g); }
      g.els.push(e);
    });
    if (grupos.length > 6) {
      var tam = grupos.map(function (g) { return Math.round(Math.max.apply(null, g.els.map(function (e) { return e.getBoundingClientRect().width; })) / 6); });
      var cnt = function (v) { return tam.filter(function (x) { return x === v; }).length; };
      var moda = tam.slice().sort(function (a, b) { return cnt(b) - cnt(a); })[0];
      grupos = grupos.filter(function (g, i) { return Math.abs(tam[i] - moda) <= 1; });
    }
    if (grupos.length !== 6) return trevosPorPontos();
    grupos.sort(function (a, b) { return a.cx - b.cx; });
    var res = {};
    grupos.forEach(function (g, ix) {
      var pref = function (re) { return g.els.filter(function (e) { return re(e); })[0]; };
      var el = pref(function (e) { return e.hasAttribute("ng-click") || e.hasAttribute("onclick"); }) || pref(function (e) { return e.tagName === "LABEL"; }) ||
        pref(function (e) { return /^(A|BUTTON)$/.test(e.tagName); }) || pref(function (e) { return e.tagName === "INPUT"; }) || g.els[0];
      el.__lfGrupo = g.els;
      var n = numeroDe(el, ix); res[res[n] ? ix + 1 : n] = el;
    });
    if (Object.keys(res).length < 6) { res = {}; grupos.forEach(function (g, ix) { res[ix + 1] = g.els[0]; res[ix + 1].__lfGrupo = g.els; }); }
    return res;
  }
  // 4) varre a faixa ponto a ponto (pega imagem com áreas clicáveis, desenho por CSS, etc.)
  function quadrado(r) { return r.width >= 20 && r.width <= 130 && r.height >= 20 && r.height <= 130 && Math.abs(r.width - r.height) <= 0.45 * Math.max(r.width, r.height); }
  function trevosPorPontos() {
    var f = faixaTrevos(); if (!f) return null;
    var vistos = [], areas = null;
    for (var y = Math.max(0, f.top); y < Math.min(innerHeight, f.bottom); y += 6) {
      for (var x = f.left; x < f.right; x += 6) {
        var h = document.elementFromPoint(x, y);
        if (!h || box.contains(h)) continue;
        for (var sd = 0; sd < 5 && h && h.shadowRoot; sd++) { var inn = h.shadowRoot.elementFromPoint(x, y); if (!inn || inn === h) break; h = inn; }
        if (h.tagName === "AREA" || h.tagName === "IMG" && h.useMap) {
          var mp = h.tagName === "AREA" ? h.parentElement : document.querySelector("map[name='" + h.useMap.replace("#", "") + "']");
          if (mp && mp.querySelectorAll("area").length >= 6) areas = mp;
          continue;
        }
        var e = h;
        for (var k = 0; k < 4 && e && e !== document.body; k++, e = e.parentElement) if (quadrado(e.getBoundingClientRect())) { if (vistos.indexOf(e) < 0) vistos.push(e); break; }
      }
    }
    if (areas) {
      var img = document.querySelector("img[usemap='#" + areas.name + "']"), ri = img ? img.getBoundingClientRect() : null;
      var lst = Array.prototype.slice.call(areas.querySelectorAll("area")).map(function (a) { var c = (a.coords || "").split(",").map(Number); return { a: a, x: c.length >= 2 ? c[0] : 0 }; }).sort(function (u, v) { return u.x - v.x; });
      var ra = {}; lst.slice(0, 6).forEach(function (o, ix) { var n = numeroDe(o.a, ix); ra[ra[n] ? ix + 1 : n] = o.a; o.a.__lfImg = img; });
      return Object.keys(ra).length >= 6 ? ra : null;
    }
    var gr = [];
    vistos.forEach(function (e) { var r = e.getBoundingClientRect(), cx = r.left + r.width / 2; var g = gr.filter(function (x) { return Math.abs(x.cx - cx) < 12; })[0]; if (!g) { g = { cx: cx, els: [] }; gr.push(g); } g.els.push(e); });
    if (gr.length < 6) return null;
    if (gr.length > 6) { var w0 = gr.map(function (g) { return Math.round(g.els[0].getBoundingClientRect().width / 6); }); var c0 = function (v) { return w0.filter(function (x) { return x === v; }).length; }; var md = w0.slice().sort(function (a, b) { return c0(b) - c0(a); })[0]; gr = gr.filter(function (g, i) { return Math.abs(w0[i] - md) <= 1; }); }
    if (gr.length !== 6) return null;
    gr.sort(function (a, b) { return a.cx - b.cx; });
    var res = {};
    gr.forEach(function (g, ix) { var el = g.els[0]; el.__lfGrupo = g.els; var n = numeroDe(el, ix); res[res[n] ? ix + 1 : n] = el; });
    if (Object.keys(res).length < 6) { res = {}; gr.forEach(function (g, ix) { res[ix + 1] = g.els[0]; }); }
    return res;
  }
  // clica como uma pessoa: no ponto central do trevo
  function clicarTrevo(el) {
    if (el.tagName === "AREA") { el.click(); return; }
    try { el.scrollIntoView({ block: "center" }); } catch (e) {}
    var r = el.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2, alvo = document.elementFromPoint(x, y);
    if (alvo && !box.contains(alvo) && (el.contains(alvo) || alvo.contains(el) || (el.__lfGrupo || []).indexOf(alvo) >= 0)) {
      ["pointerdown", "mousedown", "pointerup", "mouseup"].forEach(function (t) { alvo.dispatchEvent(new MouseEvent(t, { bubbles: true, cancelable: true, view: window, clientX: x, clientY: y })); });
      alvo.click();
    } else clicar(el);
  }
  function trevoMarcado(el) { if (marcado(el)) return true; var g = el.__lfGrupo || []; for (var i = 0; i < g.length; i++) if (marcado1(g[i])) return true; return false; }
  // Linha que mostra os trevos escolhidos (ao lado de "Complete os Trevos"); se não houver, usa a classe do item
  function linhaTrevos() {
    var b = btTrevoComplete() || btTrevoLimpar(); if (!b) return null;
    var row = b.parentElement;
    for (var k = 0; k < 3 && row; k++, row = row.parentElement) {
      var els = row.querySelectorAll("input, span, div, p, label");
      for (var i = 0; i < els.length; i++) {
        var e = els[i]; if (e.contains(b) || e.querySelector("button") || /BUTTON|A/.test(e.tagName)) continue;
        if (e.tagName === "INPUT") return e;
        if (!e.children.length && (e.innerText || "").trim() === "" || /^[\d\s,]+$/.test((e.innerText || "").trim())) { if (e.getBoundingClientRect().width > 60) return e; }
      }
    }
    return null;
  }
  function trevosSel(map) {
    var l = linhaTrevos();
    if (l) { var t = l.tagName === "INPUT" ? l.value : l.innerText; var ns = (String(t || "").match(/\d+/g) || []).map(Number).filter(function (n, ix, a) { return n >= 1 && n <= 6 && a.indexOf(n) === ix; }).sort(); if (ns.length || !Object.keys(map).some(function (k) { return trevoMarcado(map[k]); })) return ns; }
    return Object.keys(map).map(Number).filter(function (k) { return trevoMarcado(map[k]); }).sort();
  }
  // Time do Coração da Timemania: lista de seleção, escudos (imagens), lista que abre ao clicar ou campo de busca
  function rotulos(el) {
    var out = [], add = function (v) { if (v) out.push(String(v)); };
    add(el.innerText || el.textContent); ["alt", "title", "aria-label", "data-original-title", "data-nome", "data-time", "value", "name"].forEach(function (a) { add(el.getAttribute && el.getAttribute(a)); });
    var imgs = el.tagName === "IMG" ? [el] : Array.prototype.slice.call(el.querySelectorAll ? el.querySelectorAll("img, [alt], [title]") : [], 0, 3);
    imgs.forEach(function (im) { add(im.getAttribute("alt")); add(im.getAttribute("title")); var src = (im.getAttribute("src") || "").split("/").pop().split("?")[0].replace(/\.\w+$/, "").replace(/[_\-.]+/g, " "); add(src); });
    return out.map(function (t) { return norm(t).replace(/\//g, " ").replace(/\s+/g, " ").trim(); }).filter(Boolean);
  }
  function pontuar(labels, base, uf) {
    var best = 0;
    labels.forEach(function (t) {
      if (t.length > 60) return;
      var sc = 0;
      if (t === base + " " + uf || t === base + uf) sc = 4;
      else if (t.indexOf(base) === 0 && new RegExp("(^|\\s)" + uf + "($|\\s)").test(t.slice(base.length))) sc = 3;
      else if (t === base) sc = 2;
      else if (t.indexOf(base + " ") === 0 && t.length - base.length <= 4) sc = 1;
      if (sc > best) best = sc;
    });
    return best;
  }
  function areaTime() {
    var ls = document.querySelectorAll("h1, h2, h3, h4, h5, p, span, label, div, strong, legend");
    for (var i = 0; i < ls.length; i++) {
      var t = norm(ls[i].innerText);
      if (vis(ls[i]) && /TIME DO CORACAO/.test(t) && t.length < 80) { var c = ls[i]; for (var k = 0; k < 4 && c.parentElement; k++) { c = c.parentElement; if (c.querySelectorAll("img, li, option, [role=option], [ng-click], button, input").length >= 2) return c; } return c; }
    }
    return null;
  }
  function acharTime(base, uf, raiz) {
    var cands = (raiz || document).querySelectorAll("img, a, button, li, label, [ng-click], [role=option], [role=button], mat-option, .ng-option, div[onclick], span[onclick], td");
    var melhor = null, mp = 0, ma = 1e9;
    Array.prototype.forEach.call(cands, function (el) {
      if (!vis(el) || box.contains(el)) return;
      var sc = pontuar(rotulos(el), base, uf); if (!sc) return;
      var r = el.getBoundingClientRect(), area = r.width * r.height;
      if (sc > mp || (sc === mp && area < ma)) { mp = sc; ma = area; melhor = el; }
    });
    return melhor ? { el: melhor, score: mp } : null;
  }
  function timeConfirmado(base, area, el) {
    var sels = document.querySelectorAll("select");
    for (var i = 0; i < sels.length; i++) { if (box.contains(sels[i])) continue; var o = sels[i].options[sels[i].selectedIndex]; if (o && norm(o.text).replace(/\//g, " ").indexOf(base) === 0) return true; }
    if (el && (marcado(el) || (el.parentElement && marcado1(el.parentElement)))) return true;
    var ins = (area || document).querySelectorAll("input[type=text], input:not([type])");
    for (var j = 0; j < ins.length; j++) if (norm(ins[j].value).indexOf(base) === 0) return true;
    if (area) { var t = norm(area.innerText).replace(/\//g, " "); if (/SELECIONAD|ESCOLHID|SEU TIME/.test(t) && t.indexOf(base) >= 0) return true; }
    return null; // não deu para confirmar (mas também não deu erro)
  }
  async function escolherTime(nome) {
    var alvo = norm(String(nome).replace(/\s*\((\w\w)\)\s*$/, "/$1")), partes = alvo.split("/"), base = partes[0].replace(/-/g, " ").trim(), uf = (partes[1] || "").trim();
    // 1) lista de seleção (select)
    var sels = document.querySelectorAll("select");
    for (var i = 0; i < sels.length; i++) {
      if (box.contains(sels[i]) || sels[i].options.length < 10) continue;
      var opts = sels[i].options, bo = null, bs = 0;
      for (var j = 0; j < opts.length; j++) { var sc = pontuar([norm(opts[j].text).replace(/\//g, " ")], base, uf); if (sc > bs) { bs = sc; bo = opts[j]; } }
      if (bo) {
        sels[i].value = bo.value;
        sels[i].dispatchEvent(new Event("input", { bubbles: true })); sels[i].dispatchEvent(new Event("change", { bubbles: true }));
        return bo.text.trim();
      }
    }
    var area = areaTime();
    // 2) escudos/itens já visíveis (primeiro perto de "Time do Coração", depois na página toda)
    var ach = (area && acharTime(base, uf, area)) || acharTime(base, uf);
    // 3) lista que abre ao clicar, ou campo de busca
    if (!ach && area) {
      var inp = area.querySelector("input[type=text], input[type=search], input:not([type])");
      if (inp && vis(inp)) {
        inp.focus(); inp.value = base.charAt(0) + base.slice(1).toLowerCase();
        inp.dispatchEvent(new Event("input", { bubbles: true })); inp.dispatchEvent(new KeyboardEvent("keyup", { bubbles: true }));
        await wait(700); ach = acharTime(base, uf);
      }
      if (!ach) {
        var trig = area.querySelector("[role=combobox], .ng-select-container, mat-select, .dropdown-toggle, [data-toggle=dropdown], button, [ng-click]");
        if (trig && vis(trig)) { clicarCentro(trig); await wait(700); ach = acharTime(base, uf); }
      }
    }
    if (!ach) return null;
    try { ach.el.scrollIntoView({ block: "center" }); } catch (e) {}
    await wait(150);
    clicarCentro(ach.el);
    await wait(500);
    var ok = timeConfirmado(base, area, ach.el);
    if (ok === false) return null;
    return (rotulos(ach.el)[0] || base) + (ok ? "" : " (não consegui confirmar na tela; confira)");
  }
  // clica como uma pessoa, no centro do elemento
  function clicarCentro(el) {
    var r = el.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2, alvo = document.elementFromPoint(x, y);
    if (!alvo || box.contains(alvo) || !(el.contains(alvo) || alvo.contains(el))) alvo = el;
    ["pointerdown", "mousedown", "pointerup", "mouseup"].forEach(function (t) { alvo.dispatchEvent(new MouseEvent(t, { bubbles: true, cancelable: true, view: window, clientX: x, clientY: y })); });
    alvo.click();
  }

  function lerJogos(texto, g) {
    var cfg = JOGOS[g], jogos = [], ruins = [], time = null;
    texto.split(/\r?\n/).forEach(function (linha, i) {
      if (!linha.trim()) return;
      var mt = linha.match(/time do cora[cç][aã]o\s*:\s*(.+)$/i);
      if (mt) { time = mt[1].trim(); return; }
      var limpa = linha.replace(/^\s*\d{1,3}\s*[:.)\-]\s+/, "");
      var partes = limpa.split(/\s*(?:\||\+|trevos?:?)\s*/i);
      var dez = (partes[0].match(/\d{1,2}/g) || []).map(function (x) { return g === "lm" && +x === 0 ? 100 : +x; }).filter(function (n) { return n >= 1 && n <= cfg.max; });
      dez = dez.filter(function (n, ix) { return dez.indexOf(n) === ix; }).sort(function (a, b) { return a - b; });
      var tre = [];
      if (g === "mm") {
        if (partes.length > 1) tre = (partes.slice(1).join(" ").match(/\d/g) || []).map(Number);
        else { tre = dez.slice(-2); dez = dez.slice(0, -2); }
        tre = tre.filter(function (n, ix) { return n >= 1 && n <= 6 && tre.indexOf(n) === ix; }).sort();
      }
      var ok = dez.length >= cfg.min && dez.length <= cfg.maxSel && (g !== "mm" || (tre.length >= 2 && tre.length <= 6));
      if (ok) jogos.push({ d: dez, t: tre }); else ruins.push(i + 1);
    });
    return { jogos: jogos, ruins: ruins, time: time };
  }

  /* ---------- Diagnóstico (sem dados pessoais: só a estrutura da página) ---------- */
  function desc(el) {
    if (!el) return null;
    var s = el.tagName.toLowerCase();
    if (el.id) s += "#" + el.id;
    var c = (typeof el.className === "string" ? el.className : "").trim().split(/\s+/).slice(0, 4).join(".");
    if (c) s += "." + c;
    ["ng-click", "role", "data-numero", "aria-pressed"].forEach(function (a) { if (el.getAttribute(a)) s += "[" + a + "=" + String(el.getAttribute(a)).slice(0, 40) + "]"; });
    return s;
  }
  // estrutura do bloco sem textos (só tags, ids, classes e tamanhos), para eu ver como a Caixa montou
  function esqueleto(el, nv) {
    if (nv > 9 || box.contains(el)) return "";
    var r = el.getBoundingClientRect(), at = "";
    ["id", "class", "ng-click", "ng-class", "ng-repeat", "role", "type", "src", "usemap", "alt", "for", "name", "style"].forEach(function (a) { var v = el.getAttribute && el.getAttribute(a); if (v) at += " " + a + "=\"" + String(v).split("/").pop().slice(0, 50) + "\""; });
    var filhos = Array.prototype.map.call(el.children, function (c) { return esqueleto(c, nv + 1); }).join("");
    var t = el.children.length ? "" : (el.textContent || "").trim().replace(/\s+/g, " ").slice(0, 3).replace(/[^\d\s]/g, "");
    return "<" + el.tagName.toLowerCase() + at + (r.width ? " [" + Math.round(r.width) + "x" + Math.round(r.height) + "]" : "") + ">" + t + filhos + "</" + el.tagName.toLowerCase() + ">";
  }
  function diagnostico() {
    var g = jogoDaPagina(), d = { robo: "v6", rota: location.hash || location.pathname, titulo: document.title, detectado: detectar(), escolhido: g };
    d.titulos = Array.prototype.slice.call(document.querySelectorAll("h1, h2, h3")).filter(vis).slice(0, 6).map(function (h) { return h.innerText.trim().slice(0, 60); });
    if (g) {
      mapa = mapear(g);
      var ks = Object.keys(mapa);
      d.numeros = ks.length + " de " + JOGOS[g].max;
      d.exemplo = [1, 2, JOGOS[g].max].map(function (n) { return n + ": " + (desc(mapa[n]) || "não achei"); });
      d.marcados = selecionados(g);
    }
    d.carrinho = desc(btCarrinho()); d.limpar = desc(btLimpar());
    d.total = total(); d.valor = valorAposta(); d.contador = contadorCarrinho();
    d.botoes = Array.prototype.slice.call(document.querySelectorAll("button, a.btn, [role=button]")).filter(vis).slice(0, 25).map(function (b) { return norm(b.innerText).slice(0, 30); }).filter(Boolean);
    if (g === "mm") { var tm = trevoEls(); d.trevos = Object.keys(tm).map(function (k) { return k + ": " + desc(tm[k]); }); d.trevosArea = desc(areaTrevos()); d.trevosLinha = desc(linhaTrevos()); d.trevosMarcados = trevosSel(tm);
      var ar = areaTrevos();
      if (ar) d.trevosHtml = esqueleto(ar, 0).slice(0, 3500);
      var f = faixaTrevos(); d.faixa = f && [Math.round(f.top), Math.round(f.bottom), Math.round(f.left), Math.round(f.right)];
      d.trevosPontos = Object.keys(trevosPorPontos() || {}).length;
      if (f) d.trevosFaixa = Array.prototype.filter.call(document.body.querySelectorAll("*"), function (e) { if (box.contains(e)) return false; var r = e.getBoundingClientRect(); return r.width && r.top >= f.top - 1 && r.bottom <= f.bottom + 1; }).slice(0, 40).map(function (e) { var r = e.getBoundingClientRect(); return desc(e) + " " + Math.round(r.width) + "x" + Math.round(r.height) + "@" + Math.round(r.left); });
    }
    if (g === "tm") { d.selects = document.querySelectorAll("select").length; var at = areaTime(); d.timeArea = desc(at); if (at) d.timeHtml = esqueleto(at, 0).slice(0, 3500); }
    return d;
  }


  /* ---------- Conferir prêmios em "Minhas apostas" (só leitura: nunca clica em resgatar) ---------- */
  function naApostas() { return /#\/apostas\b/i.test(location.hash) || /Para visualizar os n[uú]meros acertados/i.test(txt()); }
  function tabelaApostas() {
    var tabs = document.querySelectorAll("table");
    for (var i = 0; i < tabs.length; i++) {
      var th = norm(tabs[i].innerText.slice(0, 400));
      if (/SITUACAO/.test(th) && /MODALIDADE/.test(th)) return tabs[i];
    }
    return null;
  }
  function lerLinhas() {
    var t = tabelaApostas(); if (!t) return null;
    var heads = Array.prototype.map.call(t.querySelectorAll("tr:first-child th, thead th"), function (h) { return norm(h.innerText); });
    var col = function (re, d) { for (var i = 0; i < heads.length; i++) if (re.test(heads[i])) return i; return d; };
    var cData = col(/DATA/, 0), cMod = col(/MODALIDADE/, 1), cAp = col(/APOSTA/, 2), cCon = col(/CONCURSO/, 3), cSit = col(/SITUACAO/, 4);
    var out = [];
    Array.prototype.forEach.call(t.querySelectorAll("tr"), function (tr) {
      var td = tr.querySelectorAll("td"); if (td.length < 4) return;
      var g = function (k) { return td[k] ? td[k].innerText.replace(/\s+/g, " ").trim() : ""; };
      out.push({ data: g(cData), mod: g(cMod), aposta: (g(cAp).match(/\d{1,2}/g) || []).join(" "), concurso: g(cCon), sit: g(cSit) });
    });
    return out;
  }
  function classificar(sit) {
    var n = norm(sit);
    if (!n) return "outra";
    if (/NAO PREMIAD/.test(n)) return "nao";
    if (/AGUARD|PENDENTE|EM PROCESS|A SORTEAR|NAO SORTEAD|EM ANDAMENTO/.test(n)) return "aguardando";
    if (/CANCELAD|ESTORNAD|DEVOLVID/.test(n)) return "cancelada";
    if (/RESGATAD|PAGO|CREDITAD|TRANSFERID|RECEBID/.test(n)) return "resgatado";
    if (/PREMIAD|PREMIO|RESGAT|R\$/.test(n)) return "premio";
    return "outra";
  }
  function paginacao() {
    var setas = Array.prototype.filter.call(document.querySelectorAll("a, li, button, span"), function (e) { return vis(e) && /^(»|›|>>|Próxima)$/i.test((e.innerText || "").trim()); });
    var cont = null;
    for (var i = 0; i < setas.length && !cont; i++) {
      var c = setas[i].parentElement;
      for (var k = 0; k < 4 && c; k++, c = c.parentElement) {
        var nums = Array.prototype.filter.call(c.querySelectorAll("a, li, button, span"), function (e) { return /^\d+$/.test((e.innerText || "").trim()); });
        if (nums.length >= 2) { cont = c; break; }
      }
    }
    if (!cont) return null;
    var map = {};
    Array.prototype.forEach.call(cont.querySelectorAll("a, button, li, span"), function (e) {
      var t = (e.innerText || "").trim(); if (!/^\d+$/.test(t)) return;
      var up = e; while (up.parentElement && up.parentElement !== cont && (up.parentElement.innerText || "").trim() === t) up = up.parentElement;
      if (!map[t]) map[t] = up;
    });
    var ks = Object.keys(map).map(Number);
    var atual = null;
    ks.forEach(function (n) { var el = map[n]; if (atual === null && (/(^|\s)(active|ativo|current|selected|atual)(\s|$)/i.test(cls(el) + " " + Array.prototype.map.call(el.querySelectorAll("*"), cls).join(" ")) || el.getAttribute("aria-current"))) atual = n; });
    if (atual === null) {
      var pesos = {}; ks.forEach(function (n) { pesos[n] = parseInt(getComputedStyle(map[n].querySelector("a, button") || map[n]).fontWeight, 10) || 400; });
      var mx = Math.max.apply(null, ks.map(function (n) { return pesos[n]; })), mn = Math.min.apply(null, ks.map(function (n) { return pesos[n]; }));
      if (mx > mn) ks.forEach(function (n) { if (atual === null && pesos[n] === mx) atual = n; });
    }
    return { map: map, total: Math.max.apply(null, ks), atual: atual };
  }
  function clicarPagina(pg, n) { var el = pg.map[n]; if (!el) return false; (el.querySelector("a, button") || el).click(); return true; }
  async function esperarMudar(antes, max) {
    for (var z = 0; z < (max || 50); z++) { await wait(200); var k = assinatura(); if (k && k !== antes) { await wait(400); return true; } }
    return false;
  }
  var assinatura = function () { var l = lerLinhas(); return l && l.length ? JSON.stringify(l) : ""; };
  /* Progresso guardado no navegador (no próprio site da Caixa), para sobreviver a um F5 */
  var CHAVE = "lflab-premios";
  function filtrosAtuais() { return Array.prototype.filter.call(document.querySelectorAll("select"), function (x) { return !box || !box.contains(x); }).map(function (x) { return x.options[x.selectedIndex] ? x.options[x.selectedIndex].text.trim() : ""; }); }
  function lerEstado() { try { var e = JSON.parse(localStorage.getItem(CHAVE) || "null"); return e && Date.now() - e.ts < 12 * 3600e3 ? e : null; } catch (x) { return null; } }
  function gravarEstado(e) { try { e.ts = Date.now(); localStorage.setItem(CHAVE, JSON.stringify(e)); } catch (x) {} }
  function apagarEstado() { try { localStorage.removeItem(CHAVE); } catch (x) {} }
  var estado = lerEstado();
  function irPara(pg, n) {
    if (clicarPagina(pg, n)) return true;
    var seta = Array.prototype.filter.call(document.querySelectorAll("a, li, button"), function (e) { return vis(e) && /^(»|›)$/.test((e.innerText || "").trim()); })[0];
    if (seta && n === (pg.atual || 0) + 1) { seta.click(); return true; }
    return false;
  }
  // vai até a página n mesmo que a paginação só mostre algumas de cada vez
  async function saltarPara(n) {
    for (var g = 0; g < 40; g++) {
      var pg = paginacao(); if (!pg) return false;
      if (pg.atual === n) return true;
      var alvo = pg.map[n] ? n : Math.max.apply(null, Object.keys(pg.map).map(Number).filter(function (k) { return k < n && k !== pg.atual; }).concat([0]));
      if (!alvo) return false;
      var a0 = assinatura(); clicarPagina(pg, alvo);
      if (!(await esperarMudar(a0, 100))) return false;
      if (alvo === n) return true;
    }
    return false;
  }
  // Atalho: se a Caixa tiver um filtro de situação com "Premiadas", usa (a lista fica com poucas páginas)
  async function filtroPremiadas() {
    var sels = Array.prototype.filter.call(document.querySelectorAll("select"), function (x) { return vis(x) && !box.contains(x); });
    for (var i = 0; i < sels.length; i++) {
      var op = Array.prototype.filter.call(sels[i].options, function (o) { var t = norm(o.text); return /PREMIAD|COM PREMIO|A RESGATAR/.test(t) && !/NAO PREMIAD|SEM PREMIO/.test(t); })[0];
      if (!op) continue;
      if (sels[i].value !== op.value) {
        sels[i].value = op.value; sels[i].dispatchEvent(new Event("input", { bubbles: true })); sels[i].dispatchEvent(new Event("change", { bubbles: true }));
        var ap = botao("aplicar", /^APLICAR$/); var a0 = assinatura();
        if (ap) { ap.click(); await esperarMudar(a0, 75); }
      }
      return op.text.trim();
    }
    return null;
  }
  async function conferirPremios() {
    if (!naApostas()) { log("Abra \"Minha Conta\" → \"Minhas Apostas\" (a lista com a coluna Situação) e toque de novo em Conferir prêmios."); return; }
    $(".premios").disabled = true; $(".parar").hidden = false; parar = false;
    estado = lerEstado();
    var continuar = !!(estado && estado.parou);
    if (!continuar && $(".atalho").checked) {
      var f = await filtroPremiadas();
      if (f) log("Usei o filtro da Caixa \"" + f + "\": só as premiadas aparecem, a conferência fica bem mais rápida.");
    }
    if (!tabelaApostas()) {
      $(".premios").disabled = false; $(".parar").hidden = true;
      log(/nenhum|nao (ha|foram|existem)|sem apostas/i.test(norm(txt())) ? "A Caixa não mostrou nenhuma aposta com esses filtros." : "Não achei a tabela de apostas. Toque em Aplicar nos filtros para a lista aparecer e tente de novo.");
      return;
    }
    log("Conferindo as apostas… (só leitura: não clico em resgatar nem em nada de pagamento)");
    var todas = continuar ? estado.todas : [], vistas = continuar ? estado.vistas : {}, alvoIni = continuar ? estado.parou : 1;
    if (continuar) {
      var fa = filtrosAtuais();
      if (estado.filtros && fa.join("|") !== estado.filtros.join("|")) log("Atenção: os filtros estão diferentes de quando comecei (" + estado.filtros.filter(Boolean).join(", ") + "). Se a lista mudou, toque em Recomeçar.");
      log("Continuando da página " + alvoIni + " (já tenho " + todas.length + " apostas conferidas)…");
    }
    var pg = paginacao();
    if (pg && pg.atual !== alvoIni) {
      if (!(await saltarPara(alvoIni))) {
        if (continuar) { log("Não consegui ir para a página " + alvoIni + ". Atualize a página (F5), abra o robô e toque em Continuar."); $(".premios").disabled = false; $(".parar").hidden = true; return; }
      }
    }
    var pagina = alvoIni; pg = paginacao();
    var totalPg = pg ? pg.total : 1;
    estado = { todas: todas, vistas: vistas, parou: null, total: totalPg, filtros: filtrosAtuais() };
    var lentas = 0;
    while (true) {
      if (parar) { estado.parou = pagina; break; }
      var linhas = lerLinhas() || [];
      linhas.forEach(function (r) { var k = JSON.stringify(r); if (!vistas[k]) { vistas[k] = 1; r.pagina = pagina; todas.push(r); } });
      estado.parou = pagina + 1; gravarEstado(estado); // se cair agora, continua da próxima
      barra.style.width = (pagina / totalPg) * 100 + "%";
      if (pagina % 10 === 0) log("Página " + pagina + " de " + totalPg + "…");
      pg = paginacao();
      if (!pg || pagina >= pg.total) { estado.parou = null; break; }
      var antes = assinatura(), foi = false, t0 = Date.now();
      for (var tent = 0; tent < 2 && !foi && !parar; tent++) {
        pg = paginacao();
        if (!pg || !irPara(pg, pagina + 1)) { await wait(1500); continue; }
        foi = await esperarMudar(antes, 75);
        if (!foi && tent === 0) log("A página " + (pagina + 1) + " está demorando… tentando de novo.");
      }
      if (parar) { estado.parou = pagina + 1; break; }
      if (!foi) {
        estado.parou = pagina + 1;
        log("O site da Caixa ficou lento (conferi " + pagina + " de " + totalPg + " páginas; o progresso está guardado).\n👉 Atualize a página (F5 ou Cmd+R), clique no favorito do robô e toque em \"Continuar\": eu vou direto para a página " + (pagina + 1) + ".");
        break;
      }
      lentas = Date.now() - t0 > 6000 ? lentas + 1 : 0;
      if (lentas >= 3) { // ficou lento de vez: melhor atualizar do que esperar página por página
        estado.parou = pagina + 2; pagina++;
        linhas = lerLinhas() || []; linhas.forEach(function (r) { var k = JSON.stringify(r); if (!vistas[k]) { vistas[k] = 1; r.pagina = pagina; todas.push(r); } });
        log("As páginas estão demorando cada vez mais (conferi " + pagina + " de " + totalPg + "; progresso guardado).\n👉 Atualize a página (F5 ou Cmd+R), clique no favorito do robô e toque em \"Continuar\": eu sigo da página " + (pagina + 1) + ".");
        if (pagina >= totalPg) estado.parou = null;
        break;
      }
      pagina++;
    }
    if (estado.parou) gravarEstado(estado); else apagarEstado();
    $(".premios").disabled = false; $(".parar").hidden = true;
    atualizarBotaoPremios();
    var grupos = { premio: [], resgatado: [], aguardando: [], nao: [], cancelada: [], outra: [] };
    todas.forEach(function (r) { grupos[classificar(r.sit)].push(r); });
    var linha = function (r) { return "• " + r.data + " · " + r.mod + " · conc. " + r.concurso + " · " + r.aposta + "\n   Situação: " + r.sit + " (pág. " + r.pagina + ")"; };
    var rel = (estado.parou ? "RESULTADO PARCIAL (faltam páginas a partir da " + estado.parou + "). " : "") + "Conferi " + todas.length + " apostas" + (estado.parou ? "" : " em " + pagina + " página(s)") + ".\n" +
      "Não premiadas: " + grupos.nao.length + " · aguardando sorteio: " + grupos.aguardando.length + " · já resgatadas/pagas: " + grupos.resgatado.length + (grupos.cancelada.length ? " · canceladas: " + grupos.cancelada.length : "");
    if (grupos.premio.length) rel += "\n\n⚠️ PREMIADAS SEM RESGATE CONFIRMADO (" + grupos.premio.length + "):\n" + grupos.premio.map(linha).join("\n");
    else rel += estado.parou ? "\n\nAté aqui, nenhuma premiada pendente. Faltam páginas: atualize e toque em Continuar." : "\n\n✅ Nenhuma aposta premiada pendente de resgate nesta lista.";
    if (grupos.outra.length) rel += "\n\nSituação que não reconheci (" + grupos.outra.length + "), confira:\n" + grupos.outra.slice(0, 15).map(linha).join("\n");
    rel += "\n\nAtenção: só confiro o período escolhido no filtro da Caixa. Para ver mais tempo, troque o período, toque em Aplicar e confira de novo. O resgate é feito por você.";
    log(rel);
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(rel).catch(function () {});
  }
  function atualizarBotaoPremios() {
    var e = lerEstado();
    $(".premios").textContent = e && e.parou ? "Continuar conferência (da página " + e.parou + (e.total ? " de " + e.total : "") + ")" : "Conferir prêmios não resgatados";
    $(".recomecar").hidden = !(e && e.parou);
  }

  /* ---------- Painel ---------- */
  var css = "#lflab-robo{position:fixed;z-index:2147483647;right:16px;bottom:16px;width:min(390px,calc(100vw - 32px));max-height:calc(100vh - 32px);overflow:auto;background:#fff;color:#1a1830;border-radius:14px;box-shadow:0 12px 40px rgba(0,0,0,.35);font:14px/1.45 system-ui,-apple-system,Segoe UI,sans-serif;padding:14px;display:grid;gap:10px}" +
    "#lflab-robo h3{margin:0;font-size:16px}#lflab-robo textarea{width:100%;box-sizing:border-box;min-height:120px;font:12px ui-monospace,Menlo,monospace;border:1px solid #ccc;border-radius:8px;padding:8px}" +
    "#lflab-robo select{font:inherit;padding:6px;border-radius:8px;border:1px solid #ccc}" +
    "#lflab-robo button{border:0;border-radius:9px;padding:9px 12px;font-weight:600;cursor:pointer}#lflab-robo .go{background:#6a28c8;color:#fff}#lflab-robo .sec{background:#eee;color:#1a1830}" +
    "#lflab-robo .row{display:flex;gap:8px;flex-wrap:wrap;align-items:center}#lflab-robo .log{font-size:12.5px;background:#f5f4fa;border-radius:8px;padding:8px;white-space:pre-wrap;max-height:200px;overflow:auto}" +
    "#lflab-robo .x{position:absolute;right:10px;top:8px;background:none;font-size:18px;padding:2px 6px}#lflab-robo .bar{height:6px;background:#eee;border-radius:3px;overflow:hidden}#lflab-robo .bar i{display:block;height:100%;width:0;background:#19794a}";
  box = document.createElement("div");
  box.id = "lflab-robo";
  var opts = "<option value='auto'>Automático</option>" + Object.keys(JOGOS).map(function (k) { return "<option value='" + k + "'>" + JOGOS[k].nome + "</option>"; }).join("");
  box.innerHTML = "<style>" + css + "</style><button class='x' title='Fechar'>×</button>" +
    "<h3>Robô do Lotofácil Lab <small style='font-weight:400;color:#888'>v6</small></h3><div class='row'><span>Modalidade:</span><select class='modal'>" + opts + "</select><span class='jogo small'></span></div>" +
    "<textarea placeholder='Cole aqui os jogos, um por linha.\nEx.: 01 02 05 07 09 10 13 14 16 18 20 22 23 24 25'></textarea>" +
    "<div class='row'><button class='sec colar'>Colar</button><button class='go ir'>Colocar no carrinho</button><button class='sec parar' hidden>Parar</button><button class='sec diag'>Diagnóstico</button></div><div class='row'><button class='go premios' style='background:#19794a'>Conferir prêmios não resgatados</button><button class='sec recomecar' hidden>Recomeçar</button><label style='font-size:12.5px'><input type='checkbox' class='atalho' checked> usar o filtro “Premiadas” da Caixa, se houver</label></div>" +
    "<div class='bar'><i></i></div><div class='log'>Entre na sua conta, abra a página da modalidade e cole os jogos. O robô só monta o carrinho: a conferência e o pagamento são seus.</div>";
  document.body.appendChild(box);
  var $ = function (s) { return box.querySelector(s); };
  var logEl = $(".log"), barra = $(".bar i");
  var log = function (m) { logEl.textContent += "\n" + m; logEl.scrollTop = logEl.scrollHeight; };
  var parar = false;
  $(".x").onclick = function () { parar = true; box.remove(); };
  $(".parar").onclick = function () { parar = true; };
  function mostrarJogo() {
    var d = detectar();
    $(".jogo").textContent = d ? "(detectado: " + JOGOS[d].nome + ")" : "(não reconheci: escolha ao lado)";
    mapa = null;
  }
  mostrarJogo();
  window.addEventListener("hashchange", mostrarJogo);
  $(".modal").onchange = function () { mapa = null; };
  $(".colar").onclick = function () {
    if (!navigator.clipboard || !navigator.clipboard.readText) { log("Este navegador não deixa colar por aqui. Use Ctrl+V (ou Cmd+V) na caixa."); return; }
    navigator.clipboard.readText().then(function (t) { $("textarea").value = t; }).catch(function () { log("Não consegui ler a área de transferência. Clique na caixa e use Ctrl+V (ou Cmd+V)."); });
  };
  $(".premios").onclick = function () { conferirPremios(); };
  $(".recomecar").onclick = function () { apagarEstado(); atualizarBotaoPremios(); log("Progresso apagado: a próxima conferência começa da página 1."); };
  atualizarBotaoPremios();
  if (naApostas() && lerEstado()) log("Tenho uma conferência guardada. Toque em “Continuar” para seguir de onde parou (ou em Recomeçar).");
  $(".diag").onclick = function () {
    var s = JSON.stringify(diagnostico(), null, 1);
    log("Diagnóstico (copiado; cole na conversa do Claude):\n" + s);
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(s).catch(function () {});
  };

  $(".ir").onclick = async function () {
    var g = jogoDaPagina();
    if (!g) { log("Não reconheci a modalidade desta página. Escolha no seletor \"Modalidade\" e clique de novo."); return; }
    if (!volantePronto(g)) { log("Não encontrei os " + JOGOS[g].max + " números da " + JOGOS[g].nome + " nesta página (achei " + Object.keys(mapa).length + "). Confira a modalidade no seletor ou toque em Diagnóstico e me mande o resultado."); return; }
    if (!btCarrinho()) { log("Não encontrei o botão \"Colocar no carrinho\". Toque em Diagnóstico e me mande o resultado."); return; }
    if (!/Ol[aá],/i.test(txt())) log("Atenção: não vi o seu nome no topo. Se a sessão expirou, entre de novo na conta.");
    var lido = lerJogos($("textarea").value, g);
    if (!lido.jogos.length) { log("Nenhum jogo válido para a " + JOGOS[g].nome + ". Confira se colou na página certa."); return; }
    if (lido.ruins.length) log("Ignorando linhas inválidas: " + lido.ruins.join(", "));
    if (g === "tm" && !lido.time) { log("Falta o Time do Coração. Inclua uma linha \"Time do Coração: Nome/UF\" (o app já copia assim)."); return; }
    $(".ir").disabled = true; $(".parar").hidden = false; parar = false;
    log("Vou colocar " + lido.jogos.length + " jogos na " + JOGOS[g].nome + ".");
    var feitos = 0;
    for (var i = 0; i < lido.jogos.length && !parar; i++) {
      var j = lido.jogos[i], alvo = j.d.join(" ");
      if (!btCarrinho() || !numEl(g, 1)) { log("O volante sumiu da página (sessão expirada?). Parei no jogo " + (i + 1) + "."); break; }
      var ok = false;
      for (var tent = 0; tent < 3 && !ok && !parar; tent++) {
        if (selecionados(g).length) {
          var lp = btLimpar();
          if (lp) { lp.click(); await wait(600); }
          else selecionados(g).forEach(function (n) { if (j.d.indexOf(n) < 0) clicar(mapa[n]); });
          await wait(200);
        }
        for (var k = 0; k < j.d.length; k++) {
          var el = numEl(g, j.d[k]);
          if (!el) { log("Não achei o número " + pad(j.d[k]) + " no volante."); break; }
          if (selecionados(g).indexOf(j.d[k]) < 0) { clicar(el); await wait(130); }
        }
        if (g === "mm") {
          var bct = btTrevoComplete(); if (bct) { try { bct.scrollIntoView({ block: "center" }); } catch (e) {} await wait(200); }
          var tmap = trevoEls();
          if (Object.keys(tmap).length < 6) { tmap = trevosPorPontos() || tmap; }
          if (Object.keys(tmap).length < 6) { log("Não encontrei os trevos na página. Parei: faça este jogo à mão e toque em Diagnóstico para eu ajustar o robô."); parar = true; break; }
          var alvoT = j.t.join(" ");
          if (trevosSel(tmap).join(" ") !== alvoT) {
            var lt = btTrevoLimpar();
            if (trevosSel(tmap).length && lt) { lt.click(); await wait(500); }
            trevosSel(tmap).forEach(function (t) { if (j.t.indexOf(t) < 0) clicarTrevo(tmap[t]); });
            for (var q = 0; q < j.t.length; q++) if (trevosSel(tmap).indexOf(j.t[q]) < 0) { clicarTrevo(tmap[j.t[q]]); await wait(300); }
          }
          var okT = false;
          for (var wt = 0; wt < 15; wt++) { if (trevosSel(tmap).join(" ") === alvoT) { okT = true; break; } await wait(150); }
          if (!okT) { log("Marquei os trevos " + alvoT + ", mas a página mostra: " + (trevosSel(tmap).join(" ") || "nenhum") + ". Tentando de novo…"); continue; }
        }
        if (g === "tm") {
          var escolhido = await escolherTime(lido.time);
          if (!escolhido) { log("Não encontrei o time \"" + lido.time + "\" na página. Parei: escolha o time à mão e toque em Diagnóstico para eu ajustar o robô."); parar = true; break; }
          if (i === 0 && tent === 0) log("Time do Coração: " + escolhido);
          await wait(300);
        }
        for (var w = 0; w < 20; w++) { if (selecionados(g).join(" ") === alvo) { ok = true; break; } await wait(150); }
      }
      if (parar) break;
      if (!ok) {
        var vistos = selecionados(g);
        log("Não consegui confirmar o jogo " + (i + 1) + " (" + alvo + "). Vejo marcados: " + (vistos.join(" ") || "nenhum") + ". Parei. Toque em Diagnóstico e me mande o resultado.");
        break;
      }
      var antes = total(), cAntes = contadorCarrinho();
      btCarrinho().click();
      var entrou = false;
      for (var z = 0; z < 40; z++) {
        await wait(200);
        var t = total(), c = contadorCarrinho();
        if (!isNaN(t) && t > (isNaN(antes) ? 0 : antes) + 0.001) { entrou = true; break; }
        if (!isNaN(c) && c > (isNaN(cAntes) ? 0 : cAntes)) { entrou = true; break; }
        if (isNaN(antes) && isNaN(cAntes) && z > 4 && !selecionados(g).length) { entrou = true; break; } // site limpou o volante após incluir
      }
      if (!entrou) { log("O site não confirmou a inclusão do jogo " + (i + 1) + ". Parei. Se apareceu alguma mensagem na tela, leia; se pediu login, entre de novo e rode só os jogos que faltam."); break; }
      feitos++;
      barra.style.width = (feitos / lido.jogos.length) * 100 + "%";
      var tt = total();
      if (feitos === 1 || feitos % 5 === 0 || feitos === lido.jogos.length) log(feitos + " de " + lido.jogos.length + " no carrinho" + (isNaN(tt) ? "" : " · total R$ " + tt.toFixed(2).replace(".", ",")));
      await wait(400);
      mapa = null; // a página pode redesenhar o volante
    }
    $(".ir").disabled = false; $(".parar").hidden = true;
    if (parar && feitos < lido.jogos.length) log("Parado. " + feitos + " jogos foram para o carrinho.");
    if (feitos) {
      var tf = total();
      log("Pronto: " + feitos + " de " + lido.jogos.length + " jogos no carrinho." + (isNaN(tf) ? "" : " Total do carrinho: R$ " + tf.toFixed(2).replace(".", ",") + ".") + "\nAbra o carrinho, confira as dezenas e faça o pagamento você mesmo. O robô não mexe no pagamento.");
      if (feitos < lido.jogos.length) log("Para continuar depois, apague da caixa os " + feitos + " primeiros jogos e clique de novo.");
    }
  };
})();
