/* Robô do Lotofácil Lab: monta o carrinho no Loterias Online da Caixa.
   Só seleciona números e clica em "Colocar no Carrinho". Nunca abre o pagamento. */
(function () {
  if (!/loteriasonline\.caixa\.gov\.br/.test(location.hostname)) {
    alert("Abra o Loterias Online da Caixa (loteriasonline.caixa.gov.br), entre na sua conta e clique de novo neste favorito.");
    return;
  }
  var old = document.getElementById("lflab-robo");
  if (old) { old.remove(); return; }

  var JOGOS = {
    lf: { nome: "Lotofácil", rota: "lotofacil", max: 25, min: 15, maxSel: 20 },
    ms: { nome: "Mega-Sena", rota: "mega-sena", max: 60, min: 6, maxSel: 20 },
    mm: { nome: "+Milionária", rota: "mais-milionaria", max: 50, min: 6, maxSel: 12 },
    tm: { nome: "Timemania", rota: "timemania", max: 80, min: 10, maxSel: 10 },
    lm: { nome: "Lotomania", rota: "lotomania", max: 100, min: 50, maxSel: 50 },
  };
  var wait = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
  var pad = function (n) { return n === 100 ? "00" : (n < 10 ? "0" : "") + n; }; // Lotomania: 00 = 100
  var norm = function (t) { return String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().replace(/[^A-Z0-9/]+/g, " ").replace(/\s*\/\s*/g, "/").trim(); };
  var txt = function () { return document.body.innerText || ""; };

  function jogoDaPagina() {
    var h = location.hash.toLowerCase();
    if (h.indexOf("lotofacil") >= 0) return "lf";
    if (h.indexOf("mega-sena") >= 0) return "ms";
    if (h.indexOf("milionaria") >= 0) return "mm";
    if (h.indexOf("timemania") >= 0) return "tm";
    if (h.indexOf("lotomania") >= 0) return "lm";
    return null;
  }
  function total() {
    var m = txt().match(/Total das? apostas?:\s*R\$\s*([\d.,]+)/i);
    return m ? parseFloat(m[1].replace(/\./g, "").replace(",", ".")) : NaN;
  }
  function valorAposta() {
    var m = txt().match(/Valor da Aposta:\s*R\$\s*([\d.,]+)/i);
    return m ? parseFloat(m[1].replace(/\./g, "").replace(",", ".")) : NaN;
  }
  function numEl(n) { return document.getElementById("n" + pad(n)) || (n === 100 ? document.getElementById("n100") : null); }
  function selecionados() {
    return Array.prototype.slice.call(document.querySelectorAll('a[id^="n"].selected'))
      .map(function (a) { var v = +a.id.slice(1); return v === 0 && jogoDaPagina() === "lm" ? 100 : v; }).filter(function (n) { return n > 0; }).sort(function (a, b) { return a - b; });
  }
  // Trevos da +Milionária: elementos clicáveis de 1 a 6 dentro de uma área que fala de "trevo"
  function trevoEls() {
    var achados = {};
    var cands = document.querySelectorAll('[id*="trevo" i] [ng-click], [class*="trevo" i] [ng-click], [id*="trevo" i][ng-click], [class*="trevo" i][ng-click], a[id^="t"][ng-click]');
    Array.prototype.forEach.call(cands, function (el) {
      var v = parseInt((el.innerText || el.textContent || "").trim(), 10);
      if (v >= 1 && v <= 6 && !achados[v]) achados[v] = el;
    });
    return achados;
  }
  function trevosSel(map) {
    return Object.keys(map).map(Number).filter(function (k) { return /selected|ativo|active/i.test(map[k].className); }).sort();
  }
  // Time do Coração da Timemania: select de times ou lista clicável
  function escolherTime(nome) {
    var alvo = norm(String(nome).replace(/\s*\((\w\w)\)\s*$/, "/$1")), base = alvo.split("/")[0];
    var sels = document.querySelectorAll("select");
    for (var i = 0; i < sels.length; i++) {
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
    var cl = document.querySelectorAll("[ng-click]");
    for (var k = 0; k < cl.length; k++) {
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

  /* ---------- Painel ---------- */
  var css = "#lflab-robo{position:fixed;z-index:2147483647;right:16px;bottom:16px;width:min(380px,calc(100vw - 32px));max-height:calc(100vh - 32px);overflow:auto;background:#fff;color:#1a1830;border-radius:14px;box-shadow:0 12px 40px rgba(0,0,0,.35);font:14px/1.45 system-ui,-apple-system,Segoe UI,sans-serif;padding:14px;display:grid;gap:10px}" +
    "#lflab-robo h3{margin:0;font-size:16px}#lflab-robo textarea{width:100%;box-sizing:border-box;min-height:120px;font:12px ui-monospace,Menlo,monospace;border:1px solid #ccc;border-radius:8px;padding:8px}" +
    "#lflab-robo button{border:0;border-radius:9px;padding:9px 12px;font-weight:600;cursor:pointer}#lflab-robo .go{background:#6a28c8;color:#fff}#lflab-robo .sec{background:#eee;color:#1a1830}" +
    "#lflab-robo .row{display:flex;gap:8px;flex-wrap:wrap;align-items:center}#lflab-robo .log{font-size:12.5px;background:#f5f4fa;border-radius:8px;padding:8px;white-space:pre-wrap;max-height:180px;overflow:auto}" +
    "#lflab-robo .x{position:absolute;right:10px;top:8px;background:none;font-size:18px;padding:2px 6px}#lflab-robo .bar{height:6px;background:#eee;border-radius:3px;overflow:hidden}#lflab-robo .bar i{display:block;height:100%;width:0;background:#19794a}";
  var box = document.createElement("div");
  box.id = "lflab-robo";
  box.innerHTML = "<style>" + css + "</style><button class='x' title='Fechar'>×</button>" +
    "<h3>Robô do Lotofácil Lab</h3><div class='jogo'></div>" +
    "<textarea placeholder='Cole aqui os jogos, um por linha.\nEx.: 01 02 05 07 09 10 13 14 16 18 20 22 23 24 25'></textarea>" +
    "<div class='row'><button class='sec colar'>Colar da área de transferência</button><button class='go ir'>Colocar no carrinho</button><button class='sec parar' hidden>Parar</button></div>" +
    "<div class='bar'><i></i></div><div class='log'>Entre na sua conta, abra a página da modalidade e cole os jogos. O robô só monta o carrinho: a conferência e o pagamento são seus.</div>";
  document.body.appendChild(box);
  var $ = function (s) { return box.querySelector(s); };
  var logEl = $(".log"), barra = $(".bar i");
  var log = function (m) { logEl.textContent += "\n" + m; logEl.scrollTop = logEl.scrollHeight; };
  var parar = false;
  $(".x").onclick = function () { parar = true; box.remove(); };
  $(".parar").onclick = function () { parar = true; };
  function mostrarJogo() {
    var g = jogoDaPagina();
    $(".jogo").textContent = g ? "Página: " + JOGOS[g].nome : "Abra a página de uma modalidade (Lotofácil, Mega-Sena, +Milionária, Timemania ou Lotomania).";
  }
  mostrarJogo();
  window.addEventListener("hashchange", mostrarJogo);
  $(".colar").onclick = function () {
    if (!navigator.clipboard || !navigator.clipboard.readText) { log("Este navegador não deixa colar por aqui. Use Ctrl+V (ou Cmd+V) na caixa."); return; }
    navigator.clipboard.readText().then(function (t) { $("textarea").value = t; }).catch(function () { log("Não consegui ler a área de transferência. Clique na caixa e use Ctrl+V (ou Cmd+V)."); });
  };

  $(".ir").onclick = async function () {
    var g = jogoDaPagina();
    if (!g) { log("Abra primeiro a página da modalidade no site da Caixa."); return; }
    if (!document.getElementById("colocarnocarrinho") || !numEl(1)) { log("Não encontrei o volante nesta página. Recarregue a página da modalidade e tente de novo."); return; }
    if (!/Ol[aá],/i.test(txt())) log("Atenção: não vi o seu nome no topo. Se a sessão expirou, entre de novo na conta.");
    var lido = lerJogos($("textarea").value, g);
    if (!lido.jogos.length) { log("Nenhum jogo válido para a " + JOGOS[g].nome + ". Confira se colou na página certa."); return; }
    if (lido.ruins.length) log("Ignorando linhas inválidas: " + lido.ruins.join(", "));
    if (g === "tm") {
      if (!lido.time) { log("Falta o Time do Coração. Inclua uma linha \"Time do Coração: Nome/UF\" (o app já copia assim)."); return; }
    }
    $(".ir").disabled = true; $(".parar").hidden = false; parar = false;
    log("Vou colocar " + lido.jogos.length + " jogos na " + JOGOS[g].nome + ".");
    var feitos = 0, inicio = total() || 0, somado = 0;
    for (var i = 0; i < lido.jogos.length && !parar; i++) {
      var j = lido.jogos[i], alvo = j.d.join(" ");
      if (!document.getElementById("colocarnocarrinho") || !numEl(1)) { log("O volante sumiu da página (sessão expirada?). Parei no jogo " + (i + 1) + "."); break; }
      var ok = false;
      for (var tent = 0; tent < 3 && !ok; tent++) {
        if (selecionados().length) { document.getElementById("limparvolante").click(); await wait(600); }
        for (var k = 0; k < j.d.length; k++) {
          var el = numEl(j.d[k]);
          if (!el) { log("Não achei o número " + pad(j.d[k]) + " no volante."); break; }
          if (selecionados().indexOf(j.d[k]) < 0) { el.click(); await wait(130); }
        }
        if (g === "mm") {
          var tmap = trevoEls();
          if (Object.keys(tmap).length < 6) { log("Não encontrei os trevos na página. Parei: faça este jogo à mão e me avise para eu ajustar o robô."); parar = true; break; }
          trevosSel(tmap).forEach(function (t) { if (j.t.indexOf(t) < 0) tmap[t].click(); });
          for (var q = 0; q < j.t.length; q++) if (trevosSel(tmap).indexOf(j.t[q]) < 0) { tmap[j.t[q]].click(); await wait(150); }
        }
        if (g === "tm") {
          var escolhido = escolherTime(lido.time);
          if (!escolhido) { log("Não encontrei o time \"" + lido.time + "\" na página. Parei: escolha o time à mão e me avise para eu ajustar o robô."); parar = true; break; }
          await wait(300);
        }
        for (var w = 0; w < 20; w++) { if (selecionados().join(" ") === alvo) { ok = true; break; } await wait(150); }
      }
      if (parar) break;
      if (!ok) { log("Não consegui marcar o jogo " + (i + 1) + " (" + alvo + "). Parei."); break; }
      var antes = total(), preco = valorAposta();
      document.getElementById("colocarnocarrinho").click();
      var entrou = false;
      for (var z = 0; z < 40; z++) { await wait(200); var t = total(); if (!isNaN(t) && t > (isNaN(antes) ? 0 : antes) + 0.001) { entrou = true; somado += isNaN(preco) ? 0 : preco; break; } }
      if (!entrou) { log("O site não confirmou a inclusão do jogo " + (i + 1) + ". Parei. Se pediu login, entre de novo e rode só os jogos que faltam."); break; }
      feitos++;
      barra.style.width = (feitos / lido.jogos.length) * 100 + "%";
      if (feitos === 1 || feitos % 5 === 0 || feitos === lido.jogos.length) log(feitos + " de " + lido.jogos.length + " no carrinho · total R$ " + total().toFixed(2).replace(".", ","));
      await wait(300);
    }
    $(".ir").disabled = false; $(".parar").hidden = true;
    if (parar && feitos < lido.jogos.length) log("Parado. " + feitos + " jogos foram para o carrinho.");
    if (feitos) {
      log("Pronto: " + feitos + " de " + lido.jogos.length + " jogos no carrinho. Total do carrinho: R$ " + total().toFixed(2).replace(".", ",") + ".\nAbra o carrinho, confira as dezenas e faça o pagamento você mesmo. O robô não mexe no pagamento.");
      if (feitos < lido.jogos.length) log("Para continuar depois, apague da caixa os " + feitos + " primeiros jogos e clique de novo.");
    }
  };
})();
