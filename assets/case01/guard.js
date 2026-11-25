/* The anti-hallucination guard of the multi-agent analyst (src/agro/guard.py), ported rule for
   rule to JavaScript. Returns a verdict for every number in a text: "ok", "inventado",
   "ambiguo" or "mascara". The page checks it against the verdicts recorded from Python. */
(function (g) {
  var W = '[\\p{L}\\p{N}_]';
  var NUM = new RegExp('(?<![\\p{L}\\p{N}_.,])-?(?:' +
    '[1-9]\\d{0,2}(?:\\.\\d{3})+,\\d+' +
    '|[1-9]\\d{0,2}(?:,\\d{3})+\\.\\d+' +
    '|[1-9]\\d{0,2}(?:\\.\\d{3})+(?![.,]?\\d)' +
    '|[1-9]\\d{0,2}(?:,\\d{3})+(?![.,]?\\d)' +
    '|\\d+(?:[.,]\\d+)?)', 'gu');
  var MILHAR_UM = /^[1-9]\d{0,2}([.,])\d{3}$/;
  var MODELO = '(?<!' + W + ')(?:msgarch|garch|arima)\\(\\s*\\d{1,2}(?:\\s*,\\s*\\d{1,2})*\\s*\\)';
  var MASCARAS = [
    '(?<!\\d)(?:19|20)\\d{2}[-/](?:0[1-9]|1[0-2])[-/](?:0[1-9]|[12]\\d|3[01])(?!\\d)',
    '(?<!\\d)(?:0[1-9]|[12]\\d|3[01])[-/](?:0[1-9]|1[0-2])[-/](?:19|20)\\d{2}(?!\\d)',
    '(?<!\\d)(?:0[1-9]|1[0-2])[-/](?:19|20)\\d{2}(?!\\d)',
    '(?<!\\d)(?:19|20)\\d{2}\\s*[-–/]\\s*(?:19|20)\\d{2}(?!\\d)',
    '(?<!\\d)(?:19|20)\\d{2}\\s*/\\s*\\d{2}(?!\\d)',
    MODELO
  ].map(function (p, i) { return new RegExp(p, i === 5 ? 'giu' : 'gu'); });
  var RETORICOS = [0, 50, 100], PEQUENOS = [1, 2, 3];
  var PREP = new RegExp('(?:(?<!' + W + ')(?:em|desde|de|do|da|at[eé]|ao\\s+longo\\s+de|entre|para|no|na|ao|a|e|ano|anos|safra|in[ií]cio|inicio|fim|dezembro|janeiro)\\s+|\\(\\s*)$', 'iu');
  var MOEDA = /(?:R\$|US\$|USD|BRL|\$)\s*$/i;
  var CONTADO = new RegExp('^\\s*(?:observ' + W + '*|obs|dias?|meses|mes|semanas?|pontos?|amostras?|dados|registros|reais|d[oó]lares|toneladas|sacas|contratos|vezes|unidades?|passos?|defasagens?|regimes?)(?!' + W + ')', 'iu');
  var POR_CENTO = new RegExp('\\s+por\\s+cento(?!' + W + ')', 'iuy');
  var FRACAO = {'backtest.cobertura_ic': 1, 'nivel_ic': 1};

  // Python's pattern.search(text, pos, endpos) for a pattern anchored at the end: the match must
  // start at or after pos and end exactly at endpos; text after endpos is invisible.
  function searchEndAnchored(re, text, pos, end) {
    var s = text.slice(0, end);
    for (var p = Math.max(0, pos); p <= end; p++) {
      var sticky = new RegExp(re.source, re.flags.replace('g', '') + 'y'); sticky.lastIndex = p;
      if (sticky.test(s)) return true;
    }
    return false;
  }
  function seguidoDePercentual(fim, t) {
    var r = t.slice(fim, fim + 2);
    if (r.indexOf('%') === 0 || r.indexOf(' %') === 0) return true;
    POR_CENTO.lastIndex = fim; return POR_CENTO.test(t);
  }
  function contado(fim, t) { return CONTADO.test(t.slice(fim, fim + 24)); }
  function moedaAntes(ini, t) { return searchEndAnchored(MOEDA, t, ini - 8, ini); }
  function inicioDeLinha(ini, t) { var q = t.lastIndexOf('\n', ini - 1); return t.slice(q + 1, ini).trim() === ''; }
  function ehAno(v, ini, fim, t) {
    if (!(Number.isInteger(v) && v >= 1900 && v <= 2100)) return false;
    if (seguidoDePercentual(fim, t) || contado(fim, t)) return false;
    if (inicioDeLinha(ini, t)) return true;
    return searchEndAnchored(PREP, t, ini - 12, ini);
  }
  function leituras(tok) {
    var sinal = tok[0] === '-' ? -1 : 1, c = tok.replace(/^-+/, ''), p = c.indexOf('.') >= 0, v = c.indexOf(',') >= 0;
    if (p && v) {
      var dec = c.lastIndexOf('.') > c.lastIndexOf(',') ? '.' : ',', mil = dec === '.' ? ',' : '.';
      var limpo = c.split(mil).join('');
      return [[[sinal * parseFloat(limpo.replace(',', '.')), limpo.split(dec)[1].length]], false];
    }
    var m = MILHAR_UM.exec(c);
    if (m) return [[[sinal * parseFloat(c.replace(m[1], '')), 0], [sinal * parseFloat(c.replace(m[1], '.')), 3]], true];
    if (p || v) {
      var sep = p ? '.' : ',', partes = c.split(sep);
      if (partes.length > 2) return [[[sinal * parseFloat(partes.join('')), 0]], false];
      return [[[sinal * parseFloat(c.replace(',', '.')), partes[1].length]], false];
    }
    return [[[sinal * parseFloat(c), 0]], false];
  }
  function casa(v, casas, perm) {
    var f = 0.5 * Math.pow(10, -casas); f += f * 1e-9 + 1e-12;
    for (var i = 0; i < perm.length; i++) if (Math.abs(v - perm[i]) <= f) return true;
    return false;
  }
  function autorizada(v, k, ini, fim, t, perm, frac) {
    if (!moedaAntes(ini, t)) {
      if (ehAno(v, ini, fim, t)) return true;
      if (RETORICOS.indexOf(v) >= 0 && seguidoDePercentual(fim, t)) return true;
      if (PEQUENOS.indexOf(v) >= 0 && !seguidoDePercentual(fim, t)) return true;
    }
    if (casa(v, k, perm)) return true;
    if (seguidoDePercentual(fim, t)) return casa(v / 100, k + 2, frac);
    return false;
  }
  function spans(t) {
    var out = [];
    MASCARAS.forEach(function (re) {
      re.lastIndex = 0; var m;
      while ((m = re.exec(t)) !== null) {
        var a = m.index, b = a + m[0].length;
        if (m[0].length === 0) { re.lastIndex++; continue; }
        if (moedaAntes(a, t) || seguidoDePercentual(b, t) || contado(b, t)) continue;
        out.push([a, b]);
      }
    });
    return out;
  }
  function verificar(t, rotulados) {
    var perm = rotulados.map(function (r) { return r[1]; }), frac = rotulados.filter(function (r) { return FRACAO[r[0]]; }).map(function (r) { return r[1]; });
    var sp = spans(t), out = [], m;
    NUM.lastIndex = 0;
    while ((m = NUM.exec(t)) !== null) {
      var ini = m.index, fim = ini + m[0].length;
      if (sp.some(function (s) { return s[0] <= ini && fim <= s[1]; })) { out.push({token: m[0], inicio: ini, veredito: 'mascara'}); continue; }
      var L = leituras(m[0]), ok = L[0].filter(function (x) { return autorizada(x[0], x[1], ini, fim, t, perm, frac); });
      var match = ok.length ? rotulados.filter(function (r) { return ok.some(function (x) { return casa(x[0], x[1], [r[1]]) || (FRACAO[r[0]] && casa(x[0] / 100, x[1] + 2, [r[1]])); }); }).map(function (r) { return r[0]; }) : [];
      out.push({token: m[0], inicio: ini, veredito: ok.length > 1 && L[1] ? 'ambiguo' : (ok.length ? 'ok' : 'inventado'), rotulos: match});
    }
    return out;
  }
  g.agroGuard = {verificar: verificar};
  if (typeof module !== 'undefined' && module.exports) module.exports = g.agroGuard;
})(typeof window !== 'undefined' ? window : globalThis);
