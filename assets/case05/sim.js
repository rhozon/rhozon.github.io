/* Interactive part of the framework-or-by-hand case. Plain JavaScript, from data.json (written by
   scripts/exportar_site.py: each engine run for real on the frozen cache, with the R core, in
   demonstration mode). The graph's steps are the nodes LangGraph actually executed. */
(function () {
  var root = document.getElementById('lgp-app');
  if (!root) return;
  var PT = (document.documentElement.lang || '').toLowerCase().indexOf('pt') === 0;
  var T = PT ? {
    commodity: 'Commodity', milho: 'Milho', soja: 'Soja', manual: 'Laço escrito à mão', graph: 'StateGraph do LangGraph',
    step: 'Próximo passo', play: 'Rodar tudo', reset: 'Recomeçar', reads: 'lê a série do disco',
    secs: 'Tempo total', readsN: 'Leituras da série', tries: 'Tentativas de ajuste', fam: 'Modelo final', sha: 'SHA-256 do relatório',
    same: 'Os dois relatórios são idênticos, caractere por caractere', diff: 'Os relatórios diferem', chars: 'caracteres',
    note: 'Medido numa execução de cada motor, com o cache congelado e o núcleo em R. O laço lê a série uma vez e a guarda numa variável; o grafo, para poder salvar o estado a cada nó, relê a série em cada nó que a usa. Neste exemplo o primeiro modelo é reprovado e o laço dá duas voltas, então são cinco leituras.',
    S: {coletar: 'Coletor escolhe a janela e carrega os dados', serie: 'Guarda a série numa variável', ajustar: 'Econometrista escolhe a família; o R ajusta', julgar: 'Crítico julga o ajuste',
      consolidar: 'Backtest, gráfico e resultado', redigir: 'Redator escreve; a trava confere os números', loop: 'volta do laço'},
    rej: 'reprovado', ok: 'aprovado', loading: 'Carregando...'
  } : {
    commodity: 'Commodity', milho: 'Corn', soja: 'Soybeans', manual: 'Hand-written loop', graph: 'LangGraph StateGraph',
    step: 'Next step', play: 'Run all', reset: 'Start over', reads: 'reads the series from disk',
    secs: 'Total time', readsN: 'Reads of the series', tries: 'Model attempts', fam: 'Final model', sha: 'SHA-256 of the report',
    same: 'The two reports are identical, character for character', diff: 'The reports differ', chars: 'characters',
    note: 'Measured on one run of each engine, from the frozen cache with the R core. The loop reads the series once and keeps it in a variable; the graph, so that it can save the state at every node, reads the series again in every node that uses it. In this example the first model is rejected and the loop goes round twice, so that makes five reads.',
    S: {coletar: 'Collector picks the window and loads the data', serie: 'Keeps the series in a variable', ajustar: 'Econometrician picks the family; R fits it', julgar: 'Critic judges the fit',
      consolidar: 'Backtest, chart and result', redigir: 'Writer writes; the guard checks the numbers', loop: 'round of the loop'},
    rej: 'rejected', ok: 'approved', loading: 'Loading...'
  };
  var READS_GRAPH = {ajustar: 1, julgar: 1, consolidar: 1};
  function fmt(x, d) { return Number(x).toLocaleString(PT ? 'pt-BR' : 'en-US', {minimumFractionDigits: d || 0, maximumFractionDigits: d || 0}); }
  function el(tag, attrs, html) { var e = document.createElement(tag); for (var k in (attrs || {})) e.setAttribute(k, attrs[k]); if (html != null) e.innerHTML = html; return e; }

  root.appendChild(el('p', {}, T.loading));
  fetch(root.getAttribute('data-src')).then(function (r) { return r.json(); }).then(build).catch(function (e) { root.innerHTML = '<p>data.json: ' + e + '</p>'; });

  function steps(E, graph) {
    // Family tried at each attempt: the rejected ones in order, then the final one.
    var fams = E.reprovacoes.concat([E.familia]), out = [], a = 0, j = 0;
    if (graph) {
      E.nos.forEach(function (n) {
        var s = {txt: T.S[n] || n, node: n, read: !!READS_GRAPH[n]};
        if (n === 'ajustar') { s.txt += ' (' + fams[a] + ')'; }
        if (n === 'julgar') { var ok = a === fams.length - 1; s.txt += ': ' + (ok ? T.ok : T.rej); s.cls = ok ? 'good' : 'bad'; a++; }
        out.push(s);
      });
      return out;
    }
    out.push({txt: T.S.coletar, node: 'coletar'});
    out.push({txt: T.S.serie, node: 'serie', read: true});
    for (j = 0; j < fams.length; j++) {
      out.push({txt: T.S.ajustar + ' (' + fams[j] + ')', node: 'ajustar', loop: j + 1});
      var ok2 = j === fams.length - 1;
      out.push({txt: T.S.julgar + ': ' + (ok2 ? T.ok : T.rej), node: 'julgar', cls: ok2 ? 'good' : 'bad'});
    }
    out.push({txt: T.S.consolidar, node: 'consolidar'});
    out.push({txt: T.S.redigir, node: 'redigir'});
    return out;
  }

  function build(D) {
    root.innerHTML = '';
    var top = el('div', {class: 'lgp-ctls'}); root.appendChild(top);
    var lab = el('label', {class: 'lgp-ctl'}); lab.appendChild(el('span', {}, T.commodity));
    var sC = el('select'); [['milho', T.milho], ['soja', T.soja]].forEach(function (o) { sC.appendChild(el('option', {value: o[0]}, o[1])); }); sC.value = 'milho';
    lab.appendChild(sC); top.appendChild(lab);
    var bStep = el('button', {type: 'button'}, T.step), bPlay = el('button', {type: 'button'}, T.play), bReset = el('button', {type: 'button'}, T.reset);
    var btns = el('div', {class: 'lgp-btns'}); [bStep, bPlay, bReset].forEach(function (b) { btns.appendChild(b); }); top.appendChild(btns);
    var cols = el('div', {class: 'lgp-cols'}); root.appendChild(cols);
    var side = ['manual', 'langgraph'].map(function (m) {
      var c = el('div', {class: 'lgp-col'}); c.appendChild(el('h4', {}, m === 'manual' ? T.manual : T.graph));
      var ol = el('ol', {class: 'lgp-steps'}); c.appendChild(ol);
      var st = el('dl', {class: 'lgp-stats'}); c.appendChild(st); cols.appendChild(c);
      return {m: m, ol: ol, st: st};
    });
    var parity = el('p', {class: 'lgp-parity'}); root.appendChild(parity);
    root.appendChild(el('p', {class: 'lgp-note'}, T.note));
    var cur = 0, total = 0, timer = null, S = {};
    function render() {
      var C = D.commodities[sC.value];
      side.forEach(function (s) {
        var E = C[s.m], list = steps(E, s.m === 'langgraph'); S[s.m] = list;
        s.ol.innerHTML = list.map(function (x, i) {
          return '<li class="' + (x.cls || '') + (i < cur ? ' done' : '') + (i === cur - 1 ? ' now' : '') + '" style="' + (i < cur ? '' : 'opacity:.35') + '">' +
            (x.loop ? '<span class="lgp-loop">' + T.S.loop + ' ' + x.loop + '</span> ' : '') + x.txt + (x.read ? ' <span class="lgp-read">' + T.reads + '</span>' : '') + '</li>';
        }).join('');
        var readsSoFar = list.slice(0, cur).filter(function (x) { return x.read; }).length;
        s.st.innerHTML = '<dt>' + T.readsN + '</dt><dd>' + readsSoFar + ' / ' + E.leituras_serie + '</dd>' +
          '<dt>' + T.tries + '</dt><dd>' + E.tentativas + '</dd><dt>' + T.fam + '</dt><dd>' + E.familia.toUpperCase() + '</dd>' +
          '<dt>' + T.secs + '</dt><dd>' + fmt(E.segundos, 2) + ' s</dd><dt>' + T.sha + '</dt><dd><code>' + E.sha256.slice(0, 16) + '…</code></dd>';
      });
      total = Math.max(S.manual.length, S.langgraph.length);
      var a = C.manual.relatorio, b = C.langgraph.relatorio;
      parity.textContent = (a === b ? T.same : T.diff) + ' (' + fmt(a.length) + ' ' + T.chars + '). SHA-256: ' + C.manual.sha256.slice(0, 16) + '… / ' + C.langgraph.sha256.slice(0, 16) + '…';
      parity.className = 'lgp-parity ' + (a === b && C.manual.sha256 === C.langgraph.sha256 ? 'good' : 'bad');
    }
    function stop() { if (timer) { clearInterval(timer); timer = null; } }
    bStep.addEventListener('click', function () { stop(); if (cur < total) cur++; render(); });
    bPlay.addEventListener('click', function () { stop(); if (cur >= total) cur = 0; timer = setInterval(function () { cur++; render(); if (cur >= total) stop(); }, 450); });
    bReset.addEventListener('click', function () { stop(); cur = 0; render(); });
    sC.addEventListener('change', function () { stop(); cur = 0; render(); });
    render();
  }
})();
