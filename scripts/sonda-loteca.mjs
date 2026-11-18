// Sonda temporária: imprime o formato da Loteca nas fontes (não grava nada)
async function get(u) { try { const r = await fetch(u, { headers: { "user-agent": "Mozilla/5.0 (lotofacil-lab)", accept: "application/json" }, signal: AbortSignal.timeout(20000) }); return r.ok ? await r.json() : "HTTP " + r.status; } catch (e) { return "ERRO " + e.message; } }
const a = await get("https://servicebus2.caixa.gov.br/portaldeloterias/api/loteca");
console.log("CAIXA LATEST:", JSON.stringify(a).slice(0, 6000));
const n = a && a.numero;
if (n) { const b = await get(`https://servicebus2.caixa.gov.br/portaldeloterias/api/loteca/${n + 1}`); console.log("CAIXA NEXT:", JSON.stringify(b).slice(0, 4000)); }
const c = await get("https://loteriascaixa-api.herokuapp.com/api/loteca/latest");
console.log("ALT LATEST:", JSON.stringify(c).slice(0, 4000));
