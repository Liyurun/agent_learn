// assets/charts.js — Agent 学习与面试宝典
(function () {
  if (!window.echarts) return;

  var cjk = 'Noto Sans CJK SC, PingFang SC, Microsoft YaHei, sans-serif';
  var starsChart = null, posChart = null;

  function palette() {
    var style = getComputedStyle(document.documentElement);
    function v(name, fb) { return (style.getPropertyValue(name) || '').trim() || fb; }
    return {
      accent: v('--accent', '#0d7d72'),
      accent2: v('--accent2', '#c2820a'),
      ink: v('--ink', '#1e2329'),
      muted: v('--muted', '#6f6a60'),
      rule: v('--rule', '#e2ddd0'),
      bg2: v('--bg2', '#f2efe8')
    };
  }

  // --- Chart: framework stars ---
  function renderStars() {
    var el = document.getElementById('chart-stars');
    if (!el) return;
    var p = palette();
    if (!starsChart) starsChart = echarts.init(el, null, { renderer: 'svg' });
    var data = [
      ['LangChain', 145], ['AutoGen', 61], ['CrewAI', 57], ['Agno', 42],
      ['LangGraph', 40], ['smolagents', 29], ['OpenAI Agents SDK', 29],
      ['Mastra', 27], ['Google ADK', 21], ['PydanticAI', 19]
    ].sort(function (a, b) { return a[1] - b[1]; });
    starsChart.setOption({
      animation: false,
      grid: { left: 140, right: 50, top: 20, bottom: 30 },
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, appendToBody: true,
        textStyle: { fontFamily: cjk }, formatter: function (pp) { return pp[0].name + '：' + pp[0].value + 'k stars'; } },
      xAxis: { type: 'value', axisLabel: { color: p.muted, fontFamily: cjk, formatter: '{value}k' },
        splitLine: { lineStyle: { color: p.rule } }, axisLine: { lineStyle: { color: p.rule } } },
      yAxis: { type: 'category', data: data.map(function (d) { return d[0]; }),
        axisLabel: { color: p.ink, fontFamily: cjk }, axisLine: { lineStyle: { color: p.rule } }, axisTick: { show: false } },
      series: [{
        type: 'bar', data: data.map(function (d) {
          var light = ['smolagents', 'PydanticAI', 'OpenAI Agents SDK'].indexOf(d[0]) >= 0;
          return { value: d[1], itemStyle: { color: light ? p.accent : p.accent + '88', borderRadius: [0, 4, 4, 0] } };
        }),
        barWidth: '62%',
        label: { show: true, position: 'right', color: p.ink, fontFamily: cjk, fontSize: 11, formatter: '{c}k' }
      }]
    });
  }

  // --- Chart: framework positioning (scatter: weight vs control) ---
  function renderPosition() {
    var el = document.getElementById('chart-position');
    if (!el) return;
    var p = palette();
    if (!posChart) posChart = echarts.init(el, null, { renderer: 'svg' });
    var pts = [
      [9, 5, 34, 'smolagents'],
      [8, 6, 24, 'PydanticAI'],
      [7, 6, 34, 'OpenAI Agents SDK'],
      [4, 9, 46, 'LangGraph'],
      [5, 6, 62, 'CrewAI'],
      [4, 7, 66, 'AutoGen'],
      [6, 7, 47, 'Agno']
    ];
    posChart.setOption({
      animation: false,
      grid: { left: 60, right: 40, top: 30, bottom: 55 },
      tooltip: { appendToBody: true, textStyle: { fontFamily: cjk },
        formatter: function (pp) { return pp.data[3] + '<br/>轻量度：' + pp.data[0] + ' / 控制力：' + pp.data[1]; } },
      xAxis: { name: '← 更重  轻量度  更轻 →', nameLocation: 'middle', nameGap: 32, min: 2, max: 10,
        nameTextStyle: { color: p.muted, fontFamily: cjk, fontSize: 12 },
        axisLabel: { show: false }, splitLine: { lineStyle: { color: p.rule } }, axisLine: { lineStyle: { color: p.rule } } },
      yAxis: { name: '控制力 / 生产力 →', nameLocation: 'middle', nameGap: 30, min: 3, max: 10,
        nameTextStyle: { color: p.muted, fontFamily: cjk, fontSize: 12 },
        axisLabel: { show: false }, splitLine: { lineStyle: { color: p.rule } }, axisLine: { lineStyle: { color: p.rule } } },
      series: [{
        type: 'scatter',
        data: pts.map(function (d) {
          var main = ['smolagents', 'PydanticAI'].indexOf(d[3]) >= 0;
          return { value: d, symbolSize: d[2], itemStyle: { color: main ? p.accent : p.accent2 + 'cc' },
            label: { show: true, formatter: d[3], position: 'top', color: p.ink, fontFamily: cjk, fontSize: 11, fontWeight: main ? 700 : 400 } };
        })
      }]
    });
  }

  function renderAll() { renderStars(); renderPosition(); }

  renderAll();

  window.addEventListener('resize', function () {
    if (starsChart) starsChart.resize();
    if (posChart) posChart.resize();
  });

  // Re-read CSS variables and repaint when theme changes.
  window.__ah_recolorCharts = function () { renderAll(); };
})();
