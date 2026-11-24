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
    var rb = b.getBoundingClientRect(), topo = para ? para.getBoundingClientRect().bottom - 2 : rb.top - 160;
    return { top: topo, bottom: rb.top + 2 };
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
    if (grupos.length !== 6) return null;
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
  // clica como uma pessoa: no ponto central do trevo
  function clicarTrevo(el) {
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
  function escolherTime(nome) {
    var alvo = norm(String(nome).replace(/\s*\((\w\w)\)\s*$/, "/$1")), base = alvo.split("/")[0];
    var sels = document.querySelectorAll("select");
    for (var i = 0; i < sels.length; i++) {
      if (box.contains(sels[i])) continue;
      var opts = sels[i].options;
      for (var j = 0; j < opts.length; j++) {
        var o = norm(opts[j].text);
        if (o === alvo || o.indexOf(alvo) === 0 || (base.length > 3 && o.indexOf(base) === 0)) {
          sels[i].value = opts[j].value;
          sels[i].dispatchEvent(new Event("change", { bubbles: true }));
          return opts[j].text;
        }
      }
    }
    var cl = document.querySelectorAll("[ng-click], li, a, button");
    for (var k = 0; k < cl.length; k++) {
      if (!vis(cl[k])) continue;
      var t = norm(cl[k].innerText || cl[k].textContent);
      if (t && (t === alvo || t === base || t.indexOf(alvo) === 0)) { cl[k].click(); return cl[k].innerText.trim(); }
    }
    return null;
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
  function diagnostico() {
    var g = jogoDaPagina(), d = { robo: "v3", rota: location.hash || location.pathname, titulo: document.title, detectado: detectar(), escolhido: g };
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
      var f = faixaTrevos();
      if (f) d.trevosFaixa = Array.prototype.filter.call(document.body.querySelectorAll("*"), function (e) { if (box.contains(e)) return false; var r = e.getBoundingClientRect(); return r.width && r.top >= f.top - 1 && r.bottom <= f.bottom + 1; }).slice(0, 40).map(function (e) { var r = e.getBoundingClientRect(); return desc(e) + " " + Math.round(r.width) + "x" + Math.round(r.height) + "@" + Math.round(r.left); });
    }
    if (g === "tm") d.selects = document.querySelectorAll("select").length;
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
  var estado = null; // guarda o que já foi conferido, para continuar de onde parou
  function irPara(pg, n) {
    if (clicarPagina(pg, n)) return true;
    var seta = Array.prototype.filter.call(document.querySelectorAll("a, li, button"), function (e) { return vis(e) && /^(»|›)$/.test((e.innerText || "").trim()); })[0];
    if (seta && n === (pg.atual || 0) + 1) { seta.click(); return true; }
    return false;
  }
  async function conferirPremios() {
    if (!naApostas()) { log("Abra \"Minha Conta\" → \"Minhas Apostas\" (a lista com a coluna Situação) e toque de novo em Conferir prêmios."); return; }
    if (!tabelaApostas()) { log("Não achei a tabela de apostas. Toque em Aplicar nos filtros para a lista aparecer e tente de novo."); return; }
    $(".premios").disabled = true; $(".parar").hidden = false; parar = false;
    log("Conferindo as apostas… (só leitura: não clico em resgatar nem em nada de pagamento)");
    var pg = paginacao(), continuar = estado && estado.hash === location.hash && estado.parou;
    var todas = continuar ? estado.todas : [], vistas = continuar ? estado.vistas : {}, pagina = 1;
    var alvoIni = continuar ? estado.parou : 1;
    if (continuar) log("Continuando da página " + alvoIni + " (já tenho " + todas.length + " apostas conferidas).");
    if (pg && pg.atual !== alvoIni && pg.map[alvoIni]) { var a0 = assinatura(); clicarPagina(pg, alvoIni); await esperarMudar(a0, pg.atual === null && alvoIni === 1 ? 15 : 150); pg = paginacao(); }
    else if (continuar && !(pg && pg.atual === alvoIni)) { log("Não achei o botão da página " + alvoIni + ". Vou recomeçar da página 1."); todas = []; vistas = {}; alvoIni = 1; }
    pagina = alvoIni;
    var totalPg = pg ? pg.total : 1;
    estado = { hash: location.hash, todas: todas, vistas: vistas, parou: null };
    while (true) {
      if (parar) { estado.parou = pagina; break; }
      var linhas = lerLinhas() || [];
      linhas.forEach(function (r) { var k = JSON.stringify(r); if (!vistas[k]) { vistas[k] = 1; r.pagina = pagina; todas.push(r); } });
      barra.style.width = (pagina / totalPg) * 100 + "%";
      if (pagina % 10 === 0) log("Página " + pagina + " de " + totalPg + "…");
      pg = paginacao();
      if (!pg || pagina >= pg.total) break;
      var antes = assinatura(), foi = false;
      for (var tent = 0; tent < 3 && !foi && !parar; tent++) {
        pg = paginacao();
        if (!pg || !irPara(pg, pagina + 1)) { await wait(1500); continue; }
        foi = await esperarMudar(antes, tent === 0 ? 75 : 100); // até 15 s e depois 20 s por tentativa
        if (!foi && tent < 2) log("A página " + (pagina + 1) + " está demorando… tentando de novo.");
      }
      if (parar) { estado.parou = pagina + 1; break; }
      if (!foi) {
        estado.parou = pagina + 1;
        log("A página " + (pagina + 1) + " não carregou (conferi " + pagina + " de " + totalPg + "). O site da Caixa pode estar lento. Espere um pouco e toque de novo em Conferir prêmios: eu continuo da página " + (pagina + 1) + " sem perder o que já vi.");
        break;
      }
      pagina++;
    }
    $(".premios").disabled = false; $(".parar").hidden = true;
    if (estado.parou) $(".premios").textContent = "Continuar conferência (da página " + estado.parou + ")";
    else $(".premios").textContent = "Conferir prêmios não resgatados";
    var grupos = { premio: [], resgatado: [], aguardando: [], nao: [], cancelada: [], outra: [] };
    todas.forEach(function (r) { grupos[classificar(r.sit)].push(r); });
    var linha = function (r) { return "• " + r.data + " · " + r.mod + " · conc. " + r.concurso + " · " + r.aposta + "\n   Situação: " + r.sit + " (pág. " + r.pagina + ")"; };
    var rel = (estado.parou ? "RESULTADO PARCIAL (faltam páginas a partir da " + estado.parou + "). " : "") + "Conferi " + todas.length + " apostas" + (estado.parou ? "" : " em " + pagina + " página(s)") + ".\n" +
      "Não premiadas: " + grupos.nao.length + " · aguardando sorteio: " + grupos.aguardando.length + " · já resgatadas/pagas: " + grupos.resgatado.length + (grupos.cancelada.length ? " · canceladas: " + grupos.cancelada.length : "");
    if (grupos.premio.length) rel += "\n\n⚠️ PREMIADAS SEM RESGATE CONFIRMADO (" + grupos.premio.length + "):\n" + grupos.premio.map(linha).join("\n");
    else rel += estado.parou ? "\n\nAté aqui, nenhuma premiada pendente. Faltam páginas: toque em Continuar." : "\n\n✅ Nenhuma aposta premiada pendente de resgate nesta lista.";
    if (grupos.outra.length) rel += "\n\nSituação que não reconheci (" + grupos.outra.length + "), confira:\n" + grupos.outra.slice(0, 15).map(linha).join("\n");
    rel += "\n\nAtenção: só confiro o período escolhido no filtro da Caixa. Para ver mais tempo, troque o período, toque em Aplicar e confira de novo. O resgate é feito por você.";
    log(rel);
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(rel).catch(function () {});
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
    "<h3>Robô do Lotofácil Lab <small style='font-weight:400;color:#888'>v3</small></h3><div class='row'><span>Modalidade:</span><select class='modal'>" + opts + "</select><span class='jogo small'></span></div>" +
    "<textarea placeholder='Cole aqui os jogos, um por linha.\nEx.: 01 02 05 07 09 10 13 14 16 18 20 22 23 24 25'></textarea>" +
    "<div class='row'><button class='sec colar'>Colar</button><button class='go ir'>Colocar no carrinho</button><button class='sec parar' hidden>Parar</button><button class='sec diag'>Diagnóstico</button></div><div class='row'><button class='go premios' style='background:#19794a'>Conferir prêmios não resgatados</button></div>" +
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
          var escolhido = escolherTime(lido.time);
          if (!escolhido) { log("Não encontrei o time \"" + lido.time + "\" na página. Parei: escolha o time à mão e toque em Diagnóstico para eu ajustar o robô."); parar = true; break; }
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
