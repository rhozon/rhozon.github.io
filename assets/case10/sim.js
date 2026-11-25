/* Case 10 simulator: customer recommendations, segment assortment and promotion targeting.
   Reads data.json next to this file. Labels follow the page language (pt-BR or English). */
(function () {
  var script = document.currentScript;
  var base = script ? script.src.replace(/[^\/]*$/, '') : '../assets/case10/';
  var root = document.getElementById('c10-sim');
  if (!root) return;
  var PT = (document.documentElement.lang || '').toLowerCase().indexOf('pt') === 0;

  var L = PT ? {
    tabs: ['Cliente', 'Segmento', 'Promoção'], orders: 'pedidos',
    pick: 'Escolha um cliente', seg: 'Segmento', country: 'País', inv: 'Pedidos antes do corte',
    last: 'Dias desde o último pedido', rev: 'Receita antes do corte', fav: 'Mais comprados',
    disc: 'Para descobrir: produtos que ele nunca comprou', reord: 'Para recompor: produtos que ele já compra',
    why: 'comprado junto com', hit: 'comprou nos 61 dias seguintes', none: 'nenhum',
    hitsum: function (h, n) { return h + ' de ' + n + ' recomendações foram compradas nos 61 dias seguintes.'; },
    pickseg: 'Escolha um segmento', cust: 'Clientes', shc: 'Parcela dos clientes', shr: 'Parcela da receita',
    medr: 'Recência mediana (dias)', medi: 'Pedidos (mediana)', medrev: 'Receita mediana',
    medl: 'Itens por pedido (mediana)', uk: 'Parcela no Reino Unido',
    plan: 'Vitrine de 30 produtos', plans: {'Optimised (family cap)': 'Otimizada (limite por família)',
      'Segment top sellers': 'Mais vendidos do segmento', 'Overall top sellers': 'Mais vendidos no geral'},
    cols: ['Vitrine', 'Receita do segmento coberta', 'Clientes alcançados', 'Famílias'],
    assort: 'Vitrine otimizada', fam: 'Família', exprev: 'Receita do segmento, 180 dias',
    budget: 'Orçamento: parcela dos clientes que recebem o voucher',
    pol: {x_learner: 'X-learner', dr_learner: 'DR-learner', t_learner: 'T-learner', x_learner_raw: 'X-learner sem escala', most_lapsed: 'Mais inativos primeiro',
      top_spenders: 'Maiores compradores primeiro', random: 'Aleatório', oracle: 'Oráculo (efeito verdadeiro)'},
    gain: 'Receita incremental verdadeira', at: 'Com', of: 'dos clientes',
    note: 'Experimento semi-sintético: o efeito do voucher é simulado sobre clientes reais, por isso o efeito verdadeiro é conhecido.',
    segnames: {'Top': 'Topo', 'Mid-value': 'Valor médio', 'Low-value': 'Baixo valor', 'Small': 'Pequeno',
      'active': 'ativo', 'cooling': 'esfriando', 'lapsed': 'inativo'}
  } : {
    tabs: ['Customer', 'Segment', 'Promotion'], orders: 'orders',
    pick: 'Pick a customer', seg: 'Segment', country: 'Country', inv: 'Orders before the cutoff',
    last: 'Days since last order', rev: 'Revenue before the cutoff', fav: 'Most bought',
    disc: 'To discover: products this customer never bought', reord: 'To reorder: products this customer already buys',
    why: 'bought with', hit: 'bought in the next 61 days', none: 'none',
    hitsum: function (h, n) { return h + ' of ' + n + ' recommendations were bought in the next 61 days.'; },
    pickseg: 'Pick a segment', cust: 'Customers', shc: 'Share of customers', shr: 'Share of revenue',
    medr: 'Median recency (days)', medi: 'Median orders', medrev: 'Median revenue',
    medl: 'Median lines per order', uk: 'Share in the UK',
    plan: '30-product shelf', plans: {'Optimised (family cap)': 'Optimised (family cap)',
      'Segment top sellers': 'Segment top sellers', 'Overall top sellers': 'Overall top sellers'},
    cols: ['Shelf', 'Segment revenue covered', 'Customers reached', 'Families'],
    assort: 'Optimised shelf', fam: 'Family', exprev: 'Segment revenue, 180 days',
    budget: 'Budget: share of customers who get the voucher',
    pol: {x_learner: 'X-learner', dr_learner: 'DR-learner', t_learner: 'T-learner', x_learner_raw: 'X-learner, unscaled', most_lapsed: 'Most lapsed first',
      top_spenders: 'Top spenders first', random: 'Random', oracle: 'Oracle (true effect)'},
    gain: 'True incremental revenue', at: 'At', of: 'of customers',
    note: 'Semi-synthetic experiment: the voucher effect is simulated on real customers, so the true effect is known.',
    segnames: {}
  };

  function segName(s) {
    if (!PT || !s) return s;
    return s.replace(/Top|Mid-value|Low-value|Small|active|cooling|lapsed/g, function (w) { return L.segnames[w] || w; });
  }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return {'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c]; }); }
  function dec(x) { return String(x).replace('.', PT ? ',' : '.'); }
  function pct(x) { return (x * 100).toFixed(1).replace('.', PT ? ',' : '.') + '%'; }
  function money(x) { return '£' + Math.round(x).toLocaleString(PT ? 'pt-BR' : 'en-GB'); }
  function el(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }

  var css = el('style', null,
    '#c10-sim{font-family:"Source Sans 3",sans-serif;color:#1c1b18;border:1px solid #d9d4c8;background:#fbfaf6;padding:1rem;border-radius:3px;max-width:100%;overflow:hidden}' +
    '#c10-sim .t{display:flex;gap:.4rem;flex-wrap:wrap;margin-bottom:1rem}' +
    '#c10-sim .t button{font-family:"IBM Plex Mono",monospace;font-size:.78rem;text-transform:uppercase;letter-spacing:.06em;border:1px solid #4a473f;background:transparent;padding:.45rem .9rem;cursor:pointer;border-radius:3px}' +
    '#c10-sim .t button.on{background:#1c1b18;color:#f7f5f0}' +
    '#c10-sim select,#c10-sim input[type=range]{width:100%;max-width:420px;margin:.3rem 0 .8rem}' +
    '#c10-sim select{padding:.35rem;font-size:.95rem}' +
    '#c10-sim .kv{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:.5rem;margin:.5rem 0 1rem}' +
    '#c10-sim .kv div{background:#efece4;padding:.5rem .6rem;border-radius:3px}' +
    '#c10-sim .kv b{display:block;font-family:"IBM Plex Mono",monospace;font-size:1rem;color:#1c1b18}' +
    '#c10-sim .kv span{font-size:.78rem;color:#4a473f}' +
    '#c10-sim ol{padding-left:1.3rem;margin:.3rem 0 1rem}#c10-sim li{margin:.25rem 0;line-height:1.35}' +
    '#c10-sim .why{color:#8a857a;font-size:.85rem}' +
    '#c10-sim .hit{font-family:"IBM Plex Mono",monospace;font-size:.7rem;color:#2f6b4f;border:1px solid #2f6b4f;padding:0 .3rem;margin-left:.3rem;border-radius:2px;white-space:nowrap}' +
    '#c10-sim h4{font-family:Newsreader,Georgia,serif;font-size:1.1rem;margin:.8rem 0 .3rem;color:#1c1b18}' +
    '#c10-sim table{border-collapse:collapse;width:100%;font-size:.88rem;margin:.4rem 0 1rem}' +
    '#c10-sim td,#c10-sim th{border-bottom:1px solid #d9d4c8;padding:.3rem .4rem;text-align:left}' +
    '#c10-sim td.n,#c10-sim th.n{text-align:right;font-family:"IBM Plex Mono",monospace}' +
    '#c10-sim .tw{overflow-x:auto}#c10-sim .note{font-size:.82rem;color:#8a857a;margin-top:.5rem}' +
    '#c10-sim .cv{position:relative;height:320px;max-width:100%}#c10-sim .read{font-size:.9rem}');
  root.appendChild(css);

  var D, chart, panes = [];
  fetch(base + 'data.json?v=1').then(function (r) { return r.json(); }).then(function (d) { D = d; build(); })
    .catch(function () { root.appendChild(el('p', null, 'Could not load the simulator data.')); });

  function build() {
    D.segments.sort(function (a, b) { return b.share_revenue - a.share_revenue; });
    var tabs = el('div', 't');
    root.appendChild(tabs);
    [customerPane, segmentPane, promoPane].forEach(function (fn, i) {
      var b = el('button', i === 0 ? 'on' : '', L.tabs[i]);
      b.type = 'button';
      var p = el('div');
      p.style.display = i === 0 ? '' : 'none';
      root.appendChild(p);
      panes.push(p);
      fn(p);
      b.addEventListener('click', function () {
        tabs.querySelectorAll('button').forEach(function (x) { x.classList.remove('on'); });
        b.classList.add('on');
        panes.forEach(function (q, j) { q.style.display = j === i ? '' : 'none'; });
        if (i === 2) drawChart();
      });
      tabs.appendChild(b);
    });
  }

  function customerPane(p) {
    var lab = el('label', null, L.pick);
    var sel = el('select');
    var groups = {};
    D.customers.forEach(function (c, i) { (groups[c.segment] = groups[c.segment] || []).push(i); });
    D.segments.map(function (s) { return s.name; }).filter(function (g) { return groups[g]; }).forEach(function (g) {
      var og = el('optgroup'); og.label = segName(g);
      groups[g].forEach(function (i) {
        var c = D.customers[i], o = el('option', null, c.id + ' · ' + esc(c.country) + ' · ' + c.invoices + ' ' + L.orders);
        o.value = i; og.appendChild(o);
      });
      sel.appendChild(og);
    });
    var out = el('div');
    p.appendChild(lab); p.appendChild(sel); p.appendChild(out);
    function show() {
      var c = D.customers[+sel.value], h = 0, n = 0;
      var kv = '<div class="kv">' +
        '<div><b>' + esc(segName(c.segment)) + '</b><span>' + L.seg + '</span></div>' +
        '<div><b>' + esc(c.country) + '</b><span>' + L.country + '</span></div>' +
        '<div><b>' + c.invoices + '</b><span>' + L.inv + '</span></div>' +
        '<div><b>' + c.days_since_last + '</b><span>' + L.last + '</span></div>' +
        '<div><b>' + money(c.revenue) + '</b><span>' + L.rev + '</span></div></div>';
      var fav = '<p><b>' + L.fav + ':</b> ' + c.favourites.map(esc).join('; ') + '</p>';
      var disc = '<h4>' + L.disc + '</h4><ol>' + c.discover.map(function (r) {
        n++; if (r.hit) h++;
        return '<li>' + esc(r.p) + (r.hit ? '<span class="hit">' + L.hit + '</span>' : '') +
          (r.why ? '<br><span class="why">' + L.why + ': ' + esc(r.why) + '</span>' : '') + '</li>';
      }).join('') + '</ol>';
      var ro = '<h4>' + L.reord + '</h4><ol>' + c.reorder.map(function (r) {
        n++; if (r.hit) h++;
        return '<li>' + esc(r.p) + (r.hit ? '<span class="hit">' + L.hit + '</span>' : '') + '</li>';
      }).join('') + '</ol>';
      out.innerHTML = kv + fav + disc + ro + '<p class="note">' + L.hitsum(h, n) + '</p>';
    }
    sel.addEventListener('change', show);
    show();
  }

  function segmentPane(p) {
    var lab = el('label', null, L.pickseg);
    var sel = el('select');
    D.segments.forEach(function (s, i) { var o = el('option', null, esc(segName(s.name))); o.value = i; sel.appendChild(o); });
    var out = el('div');
    p.appendChild(lab); p.appendChild(sel); p.appendChild(out);
    function show() {
      var s = D.segments[+sel.value];
      var kv = '<div class="kv">' +
        '<div><b>' + s.customers.toLocaleString(PT ? 'pt-BR' : 'en-GB') + '</b><span>' + L.cust + '</span></div>' +
        '<div><b>' + pct(s.share_customers) + '</b><span>' + L.shc + '</span></div>' +
        '<div><b>' + pct(s.share_revenue) + '</b><span>' + L.shr + '</span></div>' +
        '<div><b>' + s.median_recency_days + '</b><span>' + L.medr + '</span></div>' +
        '<div><b>' + dec(s.median_invoices) + '</b><span>' + L.medi + '</span></div>' +
        '<div><b>' + money(s.median_revenue) + '</b><span>' + L.medrev + '</span></div>' +
        '<div><b>' + dec(s.median_lines_per_invoice) + '</b><span>' + L.medl + '</span></div>' +
        '<div><b>' + pct(s.share_uk) + '</b><span>' + L.uk + '</span></div></div>';
      var rows = Object.keys(s.plans).map(function (k) {
        var v = s.plans[k];
        return '<tr><td>' + esc(L.plans[k] || k) + '</td><td class="n">' + pct(v.revenue_share) + '</td><td class="n">' +
          pct(v.customers_reached) + '</td><td class="n">' + v.families + '</td></tr>';
      }).join('');
      var tbl = '<h4>' + L.plan + '</h4><div class="tw"><table><tr>' + L.cols.map(function (c, i) {
        return '<th' + (i ? ' class="n"' : '') + '>' + c + '</th>'; }).join('') + '</tr>' + rows + '</table></div>';
      var items = '<h4>' + L.assort + '</h4><div class="tw"><table><tr><th>#</th><th></th><th>' + L.fam +
        '</th><th class="n">' + L.exprev + '</th></tr>' + s.assortment.map(function (a, i) {
          return '<tr><td>' + (i + 1) + '</td><td>' + esc(a.p) + '</td><td>' + esc(a.family) + '</td><td class="n">' + money(a.rev) + '</td></tr>';
        }).join('') + '</table></div>';
      out.innerHTML = kv + tbl + items;
    }
    sel.addEventListener('change', show);
    show();
  }

  var promo = {};
  function promoPane(p) {
    var lab = el('label', null, L.budget + ': <b class="bv"></b>');
    var rng = el('input'); rng.type = 'range'; rng.min = 0; rng.max = D.uplift.q.length - 1; rng.step = 1;
    rng.value = Math.round((D.uplift.q.length - 1) * 0.2);
    var read = el('div', 'read');
    var cv = el('div', 'cv'); var canvas = el('canvas'); cv.appendChild(canvas);
    p.appendChild(lab); p.appendChild(rng); p.appendChild(read); p.appendChild(cv);
    p.appendChild(el('p', 'note', L.note));
    promo = {rng: rng, read: read, canvas: canvas, bv: lab.querySelector('.bv')};
    rng.addEventListener('input', update);
    update();
  }

  var ORDER = ['oracle', 'x_learner', 'dr_learner', 't_learner', 'x_learner_raw', 'most_lapsed', 'top_spenders', 'random'];
  var COL = {oracle: '#8a857a', x_learner: '#7d2e2e', dr_learner: '#b0574f', t_learner: '#d49a8f', x_learner_raw: '#c9b8a6',
    most_lapsed: '#2f6b4f', top_spenders: '#3d5a80', random: '#1c1b18'};

  function update() {
    var i = +promo.rng.value, q = D.uplift.q[i];
    promo.bv.textContent = pct(q);
    var rows = ORDER.filter(function (k) { return D.uplift.curves[k]; }).map(function (k) {
      return '<tr><td>' + esc(L.pol[k]) + '</td><td class="n">' + money(D.uplift.curves[k][i]) + '</td></tr>';
    }).join('');
    promo.read.innerHTML = '<div class="tw"><table><tr><th>' + L.at + ' ' + pct(q) + ' ' + L.of + '</th><th class="n">' +
      L.gain + '</th></tr>' + rows + '</table></div>';
    if (chart) { chart.options.plugins.annotationX = i; chart.update('none'); }
  }

  function drawChart() {
    if (chart || !promo.canvas) return;
    loadChart(function () {
      var ds = ORDER.filter(function (k) { return D.uplift.curves[k]; }).map(function (k) {
        return {label: L.pol[k], data: D.uplift.curves[k], borderColor: COL[k], backgroundColor: COL[k],
          borderWidth: k === 'oracle' || k === 'random' ? 1.5 : 2, borderDash: k === 'oracle' || k === 'random' ? [5, 4] : [],
          pointRadius: 0, tension: 0.15};
      });
      var marker = {id: 'marker', afterDatasetsDraw: function (c) {
        var x = c.scales.x.getPixelForValue(+promo.rng.value), ctx = c.ctx;
        ctx.save(); ctx.strokeStyle = '#8a857a'; ctx.setLineDash([2, 3]); ctx.beginPath();
        ctx.moveTo(x, c.chartArea.top); ctx.lineTo(x, c.chartArea.bottom); ctx.stroke(); ctx.restore();
      }};
      chart = new Chart(promo.canvas, {type: 'line', plugins: [marker],
        data: {labels: D.uplift.q.map(function (q) { return Math.round(q * 100) + '%'; }), datasets: ds},
        options: {responsive: true, maintainAspectRatio: false, animation: false, locale: PT ? 'pt-BR' : 'en-GB',
          interaction: {mode: 'index', intersect: false},
          scales: {y: {title: {display: true, text: L.gain + ' (£)'}}, x: {ticks: {maxTicksLimit: 6}}},
          plugins: {legend: {position: 'bottom', labels: {boxWidth: 14, font: {size: 11}}}}}});
    });
  }

  function loadChart(cb) {
    if (window.Chart) return cb();
    var s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js';
    s.onload = cb;
    document.head.appendChild(s);
  }
})();
