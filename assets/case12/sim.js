/* Interactive part of the basket case. Plain JavaScript + Chart.js, from data.json
   (written by python -m bmx.cli export). */
(function () {
  var root = document.getElementById('bmx-app');
  if (!root) return;
  var PT = (document.documentElement.lang || '').toLowerCase().indexOf('pt') === 0;
  var T = PT ? {
    tabs: ['Parceiros', 'Teste de promoção', 'Montar a cesta'],
    cat: 'Categoria', lift: 'Lift (bruto)', size: 'Lift sem o tamanho da compra', taste: 'Associação sem gosto e tamanho',
    partnersNote: 'As três colunas ordenam os parceiros da categoria. O lift bruto mistura complementaridade, compras grandes que levam de tudo e domicílios que gostam das duas coisas; as outras duas tiram o tamanho da compra e, depois, o gosto de cada domicílio.',
    promo: 'Desconto 10 pontos maior em', effect: 'Efeito na chance de comprar (pontos percentuais)', ci: 'intervalo de 95%',
    promoNote: 'Efeito estimado de um desconto 10 pontos percentuais mais profundo na categoria escolhida sobre a chance de cada outra categoria entrar na cesta, com efeitos fixos de domicílio. Mostra a própria categoria e as 14 de maior efeito em módulo. Nenhum dos 2.070 efeitos cruzados sobrevive à correção para testes múltiplos.',
    own: '(própria)', pick: 'Marque o que já está na cesta', byLift: 'Sugestões pelo lift', byTaste: 'Sugestões pela associação ajustada',
    recNote: 'Fora da amostra (semanas 40 a 53), o hábito do domicílio acerta a AUC de', recNote2: 'somar o lift leva a', recNote3: 'e a associação ajustada, a',
    recNote4: 'Para prever o que está na cesta o lift funciona, porque carrega o tamanho da compra; para decidir o que promover, não.',
    loading: 'Carregando...'
  } : {
    tabs: ['Partners', 'Promotion test', 'Build a basket'],
    cat: 'Category', lift: 'Lift (raw)', size: 'Lift net of trip size', taste: 'Association net of taste and size',
    partnersNote: 'The three columns rank the category’s partners. Raw lift mixes complementarity, big trips that contain everything and households that like both; the other two remove trip size and then each household’s tastes.',
    promo: '10-point deeper discount on', effect: 'Effect on the chance of buying (percentage points)', ci: '95% interval',
    promoNote: 'Estimated effect of a 10-percentage-point deeper discount on the chosen category on the chance that each other category is in the basket, with household fixed effects. Shows the category itself and the 14 largest effects in absolute value. None of the 2,070 cross effects survives the correction for multiple testing.',
    own: '(own)', pick: 'Tick what is already in the basket', byLift: 'Suggestions by lift', byTaste: 'Suggestions by adjusted association',
    recNote: 'Out of sample (weeks 40 to 53), household habit alone reaches an AUC of', recNote2: 'adding lift takes it to', recNote3: 'and the adjusted association to',
    recNote4: 'To predict what is in a basket, lift works, because it carries trip size; to decide what to promote, it does not.',
    loading: 'Loading...'
  };
  function nice(c) { var s = c.toLowerCase().replace(/\//g, ' / '); return s.charAt(0).toUpperCase() + s.slice(1); }
  function fmt(x, d) { return Number(x).toLocaleString(PT ? 'pt-BR' : 'en-US', {minimumFractionDigits: d || 0, maximumFractionDigits: d || 0}); }
  function el(tag, attrs, html) { var e = document.createElement(tag); for (var k in (attrs || {})) e.setAttribute(k, attrs[k]); if (html != null) e.innerHTML = html; return e; }
  function control(parent, label, input) { var w = el('label', {class: 'bmx-ctl'}); w.appendChild(el('span', {}, label)); w.appendChild(input); parent.appendChild(w); return input; }
  function select(opts, val) { var s = el('select'); opts.forEach(function (o) { var op = el('option', {value: o[0]}, o[1]); if (String(o[0]) === String(val)) op.selected = true; s.appendChild(op); }); return s; }

  root.appendChild(el('p', {}, T.loading));
  fetch(root.getAttribute('data-src')).then(function (r) { return r.json(); }).then(build).catch(function (e) { root.innerHTML = '<p>data.json: ' + e + '</p>'; });

  function build(D) {
    root.innerHTML = '';
    var cats = D.categories.map(function (c) { return c.category; });
    var nav = el('div', {class: 'bmx-tabs'}); root.appendChild(nav);
    var panes = T.tabs.map(function (t, i) { var b = el('button', {type: 'button'}, t); nav.appendChild(b); var p = el('div', {class: 'bmx-pane'}); root.appendChild(p); b.addEventListener('click', function () { show(i); }); return {b: b, p: p}; });
    function show(i) { panes.forEach(function (x, j) { x.p.style.display = i === j ? 'block' : 'none'; x.b.classList.toggle('on', i === j); }); }
    var P = {}; D.pairs.forEach(function (r) { P[r.j + '|' + r.k] = r; P[r.k + '|' + r.j] = r; });
    partners(panes[0].p, cats, P); promo(panes[1].p, cats, D.effects); basket(panes[2].p, cats, P, D.recommender);
    show(0);
  }

  function partners(p, cats, P) {
    var ctl = el('div', {class: 'bmx-ctls'}); p.appendChild(ctl);
    var s = control(ctl, T.cat, select(cats.map(function (c) { return [c, nice(c)]; }), 'DRY NOODLES/PASTA'));
    var grid = el('div', {class: 'bmx-grid'}); p.appendChild(grid);
    p.appendChild(el('p', {class: 'bmx-note'}, T.partnersNote));
    function list(title, key, c, d) {
      var rows = cats.filter(function (k) { return k !== c; }).map(function (k) { return [k, P[c + '|' + k][key]]; })
        .sort(function (a, b) { return b[1] - a[1]; }).slice(0, 8);
      return '<div class="bmx-col"><h4>' + title + '</h4><ol>' + rows.map(function (r) { return '<li>' + nice(r[0]) + ' <span>' + fmt(r[1], d) + '</span></li>'; }).join('') + '</ol></div>';
    }
    function upd() { var c = s.value; grid.innerHTML = list(T.lift, 'lift', c, 2) + list(T.size, 'lift_size_adj', c, 2) + list(T.taste, 'resid_corr', c, 3); }
    s.addEventListener('input', upd); upd();
  }

  function promo(p, cats, E) {
    var ctl = el('div', {class: 'bmx-ctls'}); p.appendChild(ctl);
    var s = control(ctl, T.promo, select(cats.map(function (c) { return [c, nice(c)]; }), 'PASTA SAUCE'));
    var box = el('div', {class: 'bmx-chart'}); var cv = el('canvas'); box.appendChild(cv); p.appendChild(box);
    p.appendChild(el('p', {class: 'bmx-note'}, T.promoNote));
    var ch = new Chart(cv, {type: 'bar', data: {labels: [], datasets: [
      {label: T.ci, data: [], backgroundColor: 'rgba(15,118,110,.18)', borderColor: 'rgba(15,118,110,.5)', borderWidth: 1, barPercentage: 0.9},
      {label: T.effect, data: [], backgroundColor: '#0f766e', barPercentage: 0.35}]},
      options: {indexAxis: 'y', responsive: true, maintainAspectRatio: false, animation: false,
        scales: {x: {title: {display: true, text: T.effect}}, y: {stacked: true, ticks: {autoSkip: false, font: {size: 10}}}},
        plugins: {legend: {position: 'bottom'}}}});
    function upd() {
      var k = s.value, rows = E.filter(function (r) { return r.k === k; });
      var own = rows.filter(function (r) { return r.own; }), rest = rows.filter(function (r) { return !r.own; })
        .sort(function (a, b) { return Math.abs(b.coef) - Math.abs(a.coef); }).slice(0, 14);
      var all = own.concat(rest);
      ch.data.labels = all.map(function (r) { return nice(r.j) + (r.own ? ' ' + T.own : ''); });
      ch.data.datasets[0].data = all.map(function (r) { return [10 * (r.coef - 1.96 * r.se), 10 * (r.coef + 1.96 * r.se)]; });
      ch.data.datasets[1].data = all.map(function (r) { return 10 * r.coef; });
      ch.update();
    }
    s.addEventListener('input', upd); upd();
  }

  function basket(p, cats, P, R) {
    p.appendChild(el('p', {class: 'bmx-note'}, T.pick));
    var picks = el('div', {class: 'bmx-picks'}); p.appendChild(picks);
    var start = {'DRY NOODLES/PASTA': 1, 'FLUID MILK PRODUCTS': 1};
    var boxes = cats.map(function (c) { var l = el('label'); var i = el('input', {type: 'checkbox', value: c}); if (start[c]) i.checked = true; l.appendChild(i); l.appendChild(document.createTextNode(' ' + nice(c))); picks.appendChild(l); return i; });
    var grid = el('div', {class: 'bmx-grid'}); p.appendChild(grid);
    var g = function (m) { return R.find(function (r) { return r.model === m; }); };
    p.appendChild(el('p', {class: 'bmx-note'}, T.recNote + ' ' + fmt(g('household habit').auc_test, 3) + '; ' + T.recNote2 + ' ' + fmt(g('habit + lift').auc_test, 3) + ', ' + T.recNote3 + ' ' + fmt(g('habit + taste-adjusted association').auc_test, 3) + '. ' + T.recNote4));
    function rank(sel, key, tr) {
      return cats.filter(function (c) { return sel.indexOf(c) < 0; }).map(function (c) {
        var v = sel.reduce(function (a, k) { return a + tr(P[c + '|' + k][key]); }, 0) / sel.length; return [c, v];
      }).sort(function (a, b) { return b[1] - a[1]; }).slice(0, 8);
    }
    function upd() {
      var sel = boxes.filter(function (b) { return b.checked; }).map(function (b) { return b.value; });
      if (!sel.length) { grid.innerHTML = ''; return; }
      var a = rank(sel, 'lift', Math.log), b = rank(sel, 'resid_corr', function (x) { return x; });
      var li = function (r) { return '<li>' + nice(r[0]) + '</li>'; };
      grid.innerHTML = '<div class="bmx-col"><h4>' + T.byLift + '</h4><ol>' + a.map(li).join('') + '</ol></div><div class="bmx-col"><h4>' + T.byTaste + '</h4><ol>' + b.map(li).join('') + '</ol></div>';
    }
    boxes.forEach(function (b) { b.addEventListener('change', upd); }); upd();
  }
})();
