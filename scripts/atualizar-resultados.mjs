// Atualiza data/*.txt com os sorteios novos. Roda no GitHub Actions (Node 20, sem dependências).
import { readFileSync, writeFileSync } from "node:fs";

const JOGOS = {
  lf: { caixa: "lotofacil", alt: "lotofacil", n: 15 },
  ms: { caixa: "megasena", alt: "megasena", n: 6 },
  mm: { caixa: "maismilionaria", alt: "maismilionaria", n: 6 },
  tm: { caixa: "timemania", alt: "timemania", n: 7 },
  lm: { caixa: "lotomania", alt: "lotomania", n: 20 },
};
const ALIAS = { "BRASIL DE PELOTAS/RS": "BRASIL/RS", "SAORAIMUNDO/RR": "SAO RAIMUNDO/RR", "SAMP CORREA/MA": "SAMPAIO CORREA/MA", "CEILANDIA ESPORTE/DF": "CEILANDIA/DF", "ATLETICO-MG/MG": "ATLETICO/MG", "VIORIA/BA": "VITORIA/BA", "CONFIANCA SAF/SE": "CONFIANCA/SE", "ATLETICO/PR": "ATHLETICO/PR" };
const normTime = (t) => { const s = String(t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().replace(/\s+/g, " ").replace(/ \//g, "/").trim(); return ALIAS[s] || s; };
const pad = (x) => String(x).padStart(2, "0");

async function getJSON(url) {
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetch(url, { headers: { "user-agent": "Mozilla/5.0 (lotofacil-lab)", accept: "application/json" }, signal: AbortSignal.timeout(20000) });
      if (r.ok) return await r.json();
    } catch {}
    await new Promise((ok) => setTimeout(ok, 1500));
  }
  return null;
}
// Converte as respostas da Caixa ou da API alternativa para uma linha de texto do app
function linha(g, d) {
  const cfg = JOGOS[g];
  const conc = +(d.numero ?? d.concurso);
  const data = d.dataApuracao ?? d.data ?? "";
  const dez = (d.listaDezenas ?? d.dezenas ?? []).map(Number).sort((a, b) => a - b);
  if (!conc || dez.length !== cfg.n) return null;
  let l = `${conc};${data};${dez.map(pad).join(",")}`;
  if (g === "mm") {
    const tr = (d.trevosSorteados ?? d.listaTrevos ?? d.trevos ?? []).map(Number).sort((a, b) => a - b);
    if (tr.length !== 2) return null;
    l += `;${tr.join(",")}`;
  }
  if (g === "tm") l += `;${normTime(d.nomeTimeCoracaoMesSorte ?? d.timeCoracao ?? "")}`;
  return { conc, l };
}
async function sorteio(g, n) {
  const c = JOGOS[g];
  const urls = [
    `https://servicebus2.caixa.gov.br/portaldeloterias/api/${c.caixa}${n ? "/" + n : ""}`,
    `https://loteriascaixa-api.herokuapp.com/api/${c.alt}/${n || "latest"}`,
  ];
  for (const u of urls) { const d = await getJSON(u); const x = d && linha(g, d); if (x) return x; }
  return null;
}

let mudou = false;
for (const g of Object.keys(JOGOS)) {
  const arq = `data/${g}.txt`;
  const linhas = readFileSync(arq, "utf8").trim().split("\n");
  const ultimo = Math.max(...linhas.map((l) => parseInt(l, 10)));
  const atual = await sorteio(g, null);
  if (!atual) { console.log(`${g}: sem resposta das fontes`); continue; }
  const novos = [];
  for (let c = ultimo + 1; c <= atual.conc; c++) {
    const x = c === atual.conc ? atual : await sorteio(g, c);
    if (!x) { console.log(`${g}: não consegui o concurso ${c}`); break; }
    novos.push(x.l);
  }
  if (novos.length) {
    writeFileSync(arq, [...novos.reverse(), ...linhas].join("\n") + "\n");
    mudou = true;
  }
  console.log(`${g}: último ${ultimo}, fonte ${atual.conc}, ${novos.length} novos`);
}
console.log(mudou ? "Arquivos atualizados." : "Nada novo.");
