(function () {
  'use strict';

  // Shared cross-widget focus bridge: 观点墙 <-> 进阶章节 双向锚点
  var insightBridge = { focus: null };
  var pageContext = window.HANDBOOK_PAGE || {};

  function $(selector, root) {
    return (root || document).querySelector(selector);
  }

  function resolveInternalHref(href) {
    if (!href || href.charAt(0) !== '#') return href;
    var target = href.slice(1);
    var route = pageContext.anchorRoutes && pageContext.anchorRoutes[target];
    if (!route) return href;
    if (/^part\d+$/.test(target)) {
      return route === pageContext.route ? './' : '../' + route + '/';
    }
    if (route === pageContext.route) return href;
    return '../' + route + '/#' + encodeURIComponent(target);
  }

  function rewriteInternalLinks() {
    Array.prototype.slice.call(document.querySelectorAll('a[href^="#"]')).forEach(function (link) {
      var resolved = resolveInternalHref(link.getAttribute('href'));
      if (resolved !== link.getAttribute('href')) link.setAttribute('href', resolved);
    });
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function renderList(items) {
    if (!items || !items.length) return '';
    return '<ul class="hub-list">' + items.map(function (item) {
      return '<li>' + escapeHtml(item) + '</li>';
    }).join('') + '</ul>';
  }

  function renderPills(items) {
    if (!items || !items.length) return '';
    return '<div class="meta-row">' + items.map(function (item) {
      return '<span class="meta-pill">' + escapeHtml(item) + '</span>';
    }).join('') + '</div>';
  }

  function renderParagraph(text, className) {
    if (!text) return '';
    return '<p' + (className ? ' class="' + escapeHtml(className) + '"' : '') + '>' + escapeHtml(text) + '</p>';
  }

  function renderCaseSection(title, body, extra) {
    var content = '';

    if (Array.isArray(body)) content += renderList(body);
    else if (body) content += renderParagraph(body, 'hub-fit');

    if (extra) content += extra;
    if (!content) return '';

    return [
      '<section class="card case-section">',
      '<h5>' + escapeHtml(title) + '</h5>',
      content,
      '</section>'
    ].join('');
  }

  function bindQuiz(quiz) {
    if (!quiz || quiz.getAttribute('data-quiz-bound') === '1') return;

    var qs = Array.prototype.slice.call(quiz.querySelectorAll('.quiz-q'));
    if (!qs.length) return;

    var total = qs.length;
    var answered = 0;
    var correct = 0;
    var scoreBox = $('.quiz-score', quiz);

    quiz.setAttribute('data-quiz-bound', '1');

    qs.forEach(function (q) {
      var right = parseInt(q.getAttribute('data-correct'), 10);
      var opts = Array.prototype.slice.call(q.querySelectorAll('.quiz-opt'));
      var exp = $('.quiz-exp', q);
      var locked = false;

      opts.forEach(function (opt, index) {
        opt.addEventListener('click', function () {
          if (locked) return;

          locked = true;
          answered += 1;
          opts.forEach(function (item) { item.disabled = true; });

          if (index === right) {
            opt.classList.add('correct');
            correct += 1;
          } else {
            opt.classList.add('wrong');
            if (opts[right]) opts[right].classList.add('correct');
          }

          if (exp) exp.classList.add('show');

          if (answered === total && scoreBox) {
            var pct = Math.round(correct / total * 100);
            var msg = pct === 100
              ? '满分，工程判断很稳。'
              : (pct >= 60 ? '不错，建议回看解析再补薄弱环节。' : '先回到对应章节，把诊断链路再走一遍。');
            scoreBox.innerHTML = '得分 <span class="big">' + correct + '/' + total + '</span>（' + pct + '%）· ' + msg;
            scoreBox.classList.add('show');
          }
        });
      });
    });
  }

  function bindAllQuizzes(root) {
    Array.prototype.slice.call((root || document).querySelectorAll('.quiz')).forEach(function (quiz) {
      bindQuiz(quiz);
    });
  }

  function renderModeHub(data) {
    var panel = $('#modeHub');
    if (!panel || !data.learningModes || !data.learningModes.length) return;

    panel.innerHTML = [
      '<div class="ix-title">学习模式导航<span class="live-tag">mode hub</span></div>',
      '<div class="ix-sub">先选目标，再进入对应阅读方式。每张卡片都直接跳到最适合的入口。</div>',
      '<div class="hub-grid">',
      data.learningModes.map(function (mode, index) {
        return [
          '<article class="card hub-card">',
          '<div class="hub-eyebrow">Mode 0' + (index + 1) + '</div>',
          '<h4>' + escapeHtml(mode.title) + '</h4>',
          '<p>' + escapeHtml(mode.summary) + '</p>',
          '<div class="hub-action">',
          '<a class="hub-link" href="' + escapeHtml(mode.target) + '">进入模式 →</a>',
          '</div>',
          '</article>'
        ].join('');
      }).join(''),
      '</div>'
    ].join('');
  }

  function renderModuleAtlas(data) {
    var panel = $('#moduleAtlasGrid');
    if (!panel || !data.modules || !data.modules.length) return;

    panel.innerHTML = [
      '<div class="ix-title">模块 Atlas<span class="live-tag">atlas</span></div>',
      '<div class="ix-sub">按模块看全书结构。先看导学信息，再跳到正文、练习和资料区。</div>',
      '<div class="hub-grid">',
      data.modules.map(function (module) {
        return [
          '<article class="card hub-card">',
          '<div class="hub-eyebrow">' + escapeHtml(module.id) + '</div>',
          '<h4>' + escapeHtml(module.title) + '</h4>',
          renderPills([(module.chapters || []).length + ' 个章节锚点']),
          renderList(module.chapters || []),
          '<div class="hub-action">',
          '<a class="hub-link" href="' + escapeHtml(module.anchor) + '">跳到模块 →</a>',
          '</div>',
          '</article>'
        ].join('');
      }).join(''),
      '</div>'
    ].join('');
  }

  function renderModuleQuizHub(data) {
    var panel = $('#moduleQuizPanel');
    var quizzes = data.moduleQuizzes || [];
    var moduleMap = {};

    if (!panel || !quizzes.length) return;

    (data.modules || []).forEach(function (module) {
      moduleMap[module.id] = module;
    });

    panel.classList.add('quiz');
    panel.innerHTML = [
      '<div class="ix-title">模块复盘站<span class="live-tag">module quiz</span></div>',
      '<div class="ix-sub">按模块做最小闭环复盘：先判断这道题属于哪类工程决策，再回看对应章节补强你的理由链。</div>',
      quizzes.map(function (quiz, index) {
        var moduleTitle = quiz.moduleTitle || (moduleMap[quiz.moduleId] && moduleMap[quiz.moduleId].title) || '模块复盘';

        return [
          '<div class="quiz-q" data-correct="' + escapeHtml(quiz.correct) + '">',
          '<div class="stem"><span class="qn">M' + (index + 1) + '</span>' + escapeHtml(quiz.stem) + '</div>',
          renderPills([moduleTitle, quiz.focus, quiz.level].filter(Boolean)),
          (quiz.options || []).map(function (option, optionIndex) {
            var marker = String.fromCharCode(65 + optionIndex);
            return '<button class="quiz-opt"><span class="mk">' + marker + '</span>' + escapeHtml(option) + '</button>';
          }).join(''),
          '<div class="quiz-exp"><b>复盘要点：</b>' + escapeHtml(quiz.explanation) + (quiz.target ? ' <a class="hub-link" href="' + escapeHtml(quiz.target) + '">回看章节 →</a>' : '') + '</div>',
          '</div>'
        ].join('');
      }).join(''),
      '<div class="quiz-score"></div>'
    ].join('');
  }

  function renderEvalFrameworks(data) {
    var panel = $('#evalFrameworkPanel');
    if (!panel || !data.evalFrameworks || !data.evalFrameworks.length) return;

    panel.innerHTML = [
      '<div class="ix-title">🔭 评估 / 可观测平台速查<span class="live-tag">tooling</span></div>',
      '<div class="ix-sub">按生态选型：LangChain 栈优先 LangSmith，要自托管看 Langfuse，重 RAG 看 Phoenix / Ragas，PydanticAI 直接用 Logfire。</div>',
      '<div class="hub-grid">',
      data.evalFrameworks.map(function (item) {
        return [
          '<article class="card hub-card">',
          '<div class="hub-eyebrow">' + escapeHtml(item.type) + '</div>',
          '<h4>' + escapeHtml(item.name) + '</h4>',
          renderPills([item.openSource].filter(Boolean)),
          renderList(item.features || []),
          '<div class="hub-action">',
          '<a class="hub-link" href="' + escapeHtml(item.url) + '" target="_blank" rel="noopener">官方文档 ↗</a>',
          item.bestFor ? '<span class="hub-fit">最适合：' + escapeHtml(item.bestFor) + '</span>' : '',
          '</div>',
          '</article>'
        ].join('');
      }).join(''),
      '</div>'
    ].join('');
  }

  function renderGuardrailLayers(data) {
    var panel = $('#guardrailPanel');
    if (!panel || !data.guardrailLayers || !data.guardrailLayers.length) return;

    panel.innerHTML = [
      '<div class="ix-title">🛡️ 四层护栏纵深防御<span class="live-tag">defense in depth</span></div>',
      '<div class="ix-sub">任何单层都会被绕过。按输入 → 指令层级 → 工具/动作 → 输出四层组合，才是生产级安全姿态。</div>',
      '<div class="hub-grid">',
      data.guardrailLayers.map(function (layer, index) {
        return [
          '<article class="card hub-card">',
          '<div class="hub-eyebrow">Layer 0' + (index + 1) + '</div>',
          '<h4>' + escapeHtml(layer.stage) + '</h4>',
          '<p>' + escapeHtml(layer.goal) + '</p>',
          renderList(layer.tactics || []),
          layer.failIfMissing ? '<div class="hub-action"><span class="hub-fit">缺了会怎样：' + escapeHtml(layer.failIfMissing) + '</span></div>' : '',
          '</article>'
        ].join('');
      }).join(''),
      '</div>'
    ].join('');
  }

  function renderDebugPlaybook(data) {
    var panel = $('#debugPlaybook');
    var plays = (data && data.debugPlaybook) || [];
    if (!panel || !plays.length) return;

    var activeIndex = 0;

    function renderDetail(play) {
      return [
        '<div class="hub-grid">',
        renderCaseSection('症状', play.symptoms),
        renderCaseSection('如何定位', play.detection),
        renderCaseSection('怎么修', play.fixes),
        '</div>'
      ].join('');
    }

    function paint() {
      panel.innerHTML = [
        '<div class="ix-title">🩹 故障排查手册<span class="live-tag">playbook</span></div>',
        '<div class="ix-sub">点标签切换故障类型，按 症状 → 定位 → 修复 三段式记忆，面试排障题直接套用。</div>',
        '<div class="case-tab-group" role="tablist">',
        plays.map(function (play, index) {
          return [
            '<button class="case-tab' + (index === activeIndex ? ' active' : '') + '" type="button" data-play="' + index + '" aria-selected="' + (index === activeIndex) + '">',
            '<span class="case-tab-label">Case 0' + (index + 1) + '</span>',
            '<span class="case-tab-title">' + escapeHtml(play.name) + '</span>',
            '</button>'
          ].join('');
        }).join(''),
        '</div>',
        '<div class="case-detail-shell">' + renderDetail(plays[activeIndex]) + '</div>'
      ].join('');
    }

    panel.addEventListener('click', function (event) {
      var btn = event.target.closest ? event.target.closest('[data-play]') : null;
      if (!btn) return;
      var index = parseInt(btn.getAttribute('data-play'), 10);
      if (isNaN(index) || index === activeIndex) return;
      activeIndex = index;
      paint();
    });

    paint();
  }

  function renderInsightWall(data) {
    var panel = $('#insightWall');
    var insights = (data && data.insights) || [];
    if (!panel || !insights.length) return;

    var themes = [];
    insights.forEach(function (item) {
      if (item.theme && themes.indexOf(item.theme) === -1) themes.push(item.theme);
    });
    var activeTheme = 'all';

    function cardHtml(item) {
      return [
        '<article class="insight-card" id="insight-' + escapeHtml(item.id) + '" data-insight-id="' + escapeHtml(item.id) + '" data-theme="' + escapeHtml(item.theme || '') + '">',
        item.theme ? '<span class="insight-theme">' + escapeHtml(item.theme) + '</span>' : '',
        '<div class="insight-punch">' + escapeHtml(item.punch) + '</div>',
        '<p class="insight-detail">' + escapeHtml(item.detail) + '</p>',
        item.takeaway ? '<div class="insight-takeaway"><b>面试化表达：</b>' + escapeHtml(item.takeaway) + '</div>' : '',
        '<div class="insight-foot">',
        '<span><span class="insight-author">' + escapeHtml(item.author) + '</span>' + (item.role ? ' <span class="insight-role">· ' + escapeHtml(item.role) + '</span>' : '') + '</span>',
        item.url ? '<a class="hub-link" href="' + escapeHtml(item.url) + '" target="_blank" rel="noopener">出处 ↗</a>' : '',
        '</div>',
        item.chapter ? '<a class="insight-jump" href="#' + escapeHtml(item.chapter.id) + '" data-chapter-jump="' + escapeHtml(item.chapter.id) + '">📖 延伸阅读：' + escapeHtml(item.chapter.label) + ' →</a>' : '',
        '</article>'
      ].join('');
    }

    function paint() {
      var visible = insights.filter(function (item) {
        return activeTheme === 'all' || item.theme === activeTheme;
      });
      panel.innerHTML = [
        '<div class="ix-title">💬 Agent 金句墙<span class="live-tag">' + insights.length + ' 条观点</span></div>',
        '<div class="ix-sub">来自一线研究者与工程团队的凝练判断，按主题筛选，重在体会思路而非背诵结论。带「延伸阅读」的观点可一键跳到进阶篇对应章节。</div>',
        '<div class="insight-filter">',
        '<button class="insight-chip' + (activeTheme === 'all' ? ' active' : '') + '" data-theme="all" type="button">全部 (' + insights.length + ')</button>',
        themes.map(function (theme) {
          return '<button class="insight-chip' + (activeTheme === theme ? ' active' : '') + '" data-theme="' + escapeHtml(theme) + '" type="button">' + escapeHtml(theme) + '</button>';
        }).join(''),
        '</div>',
        '<div class="insight-grid">',
        visible.map(cardHtml).join(''),
        '</div>'
      ].join('');
    }

    panel.addEventListener('click', function (event) {
      var chip = event.target.closest ? event.target.closest('.insight-chip') : null;
      if (!chip) return;
      var theme = chip.getAttribute('data-theme');
      if (theme === activeTheme) return;
      activeTheme = theme;
      paint();
    });

    // Expose a focus bridge so 进阶章节 的反向链接可以精确定位并高亮某条观点。
    insightBridge.focus = function (insightId) {
      var target = insights.filter(function (it) { return it.id === insightId; })[0];
      if (!target) return;
      // 若当前筛选把目标卡片藏起来了，先切回“全部”再重绘。
      if (activeTheme !== 'all' && target.theme !== activeTheme) {
        activeTheme = 'all';
        paint();
      }
      var card = document.getElementById('insight-' + insightId);
      if (!card) return;
      try { card.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
      catch (e) { card.scrollIntoView(); }
      card.classList.remove('insight-flash');
      // 强制重排以便动画可重复触发
      void card.offsetWidth;
      card.classList.add('insight-flash');
      window.setTimeout(function () { card.classList.remove('insight-flash'); }, 2200);
    };

    paint();
    var requested = decodeURIComponent(window.location.hash.slice(1));
    if (requested.indexOf('insight-') === 0) {
      window.requestAnimationFrame(function () {
        insightBridge.focus(requested.slice('insight-'.length));
      });
    }
  }

  // 反向链接：在进阶章节顶部渲染“相关大牛观点”跳转条。
  function renderChapterInsightLinks(data) {
    var insights = (data && data.insights) || [];
    if (!insights.length) return;

    // 按章节 id 聚合观点
    var byChapter = {};
    insights.forEach(function (item) {
      if (!item.chapter || !item.chapter.id) return;
      (byChapter[item.chapter.id] = byChapter[item.chapter.id] || []).push(item);
    });

    Object.keys(byChapter).forEach(function (chId) {
      var mount = document.getElementById('insightBacklink-' + chId);
      if (!mount) return;
      var items = byChapter[chId];
      mount.innerHTML = [
        '<div class="insight-backlink">',
        '<span class="backlink-label">💬 相关大牛观点</span>',
        items.map(function (item) {
          var href = pageContext.route
            ? '../insights/#insight-' + encodeURIComponent(item.id)
            : '#insight-' + encodeURIComponent(item.id);
          return '<a class="backlink-chip" href="' + escapeHtml(href) + '" data-insight-focus="' + escapeHtml(item.id) + '">' +
            escapeHtml(item.author) + '：' + escapeHtml(item.punch) + '</a>';
        }).join(''),
        '</div>'
      ].join('');
    });

    // 事件委托：点击任一反向链接 -> 跳到观点墙并高亮对应卡片
    document.addEventListener('click', function (event) {
      var btn = event.target.closest ? event.target.closest('[data-insight-focus]') : null;
      if (!btn) return;
      var id = btn.getAttribute('data-insight-focus');
      if (insightBridge.focus) {
        event.preventDefault();
        insightBridge.focus(id);
      }
    });
  }

  function renderTutorialMap(data) {
    var panel = $('#tutorialMapPanel');
    if (!panel || !data.tutorials || !data.tutorials.length) return;

    panel.innerHTML = [
      '<div class="ix-title">教程地图<span class="live-tag">curated</span></div>',
      '<div class="ix-sub">四类高信噪比起点：先建立判断框架，再选一个文档或课程真正跑通。</div>',
      '<div class="hub-grid">',
      data.tutorials.map(function (tutorial) {
        return [
          '<article class="card hub-card">',
          '<div class="hub-eyebrow">' + escapeHtml(tutorial.provider) + '</div>',
          '<h4>' + escapeHtml(tutorial.title) + '</h4>',
          '<p>' + escapeHtml(tutorial.summary) + '</p>',
          renderPills([tutorial.format, tutorial.level, tutorial.effort].filter(Boolean)),
          renderList(tutorial.takeaways || []),
          '<div class="hub-action">',
          '<a class="hub-link" href="' + escapeHtml(tutorial.url) + '" target="_blank" rel="noopener">打开教程 ↗</a>',
          tutorial.fit ? '<span class="hub-fit">适合：' + escapeHtml(tutorial.fit) + '</span>' : '',
          '</div>',
          '</article>'
        ].join('');
      }).join(''),
      '</div>'
    ].join('');
  }

  function renderPatternLibrary(data) {
    var panel = $('#patternLibrary');
    if (!panel || !data.patterns || !data.patterns.length) return;

    panel.innerHTML = [
      '<div class="ix-title">🗂️ 模式卡片库<span class="live-tag">pattern cards</span></div>',
      '<div class="ix-sub">把“知道模式名”升级为“知道何时用、为何用、代价是什么”的工程表达。先看卡片，再回看上文表格与后面的框架选型。</div>',
      '<div class="hub-grid">',
      data.patterns.map(function (pattern, index) {
        return [
          '<article class="card hub-card">',
          '<div class="hub-eyebrow">' + escapeHtml(pattern.label || ('Pattern 0' + (index + 1))) + '</div>',
          '<h4>' + escapeHtml(pattern.title) + '</h4>',
          pattern.summary ? '<p>' + escapeHtml(pattern.summary) + '</p>' : '',
          renderPills([pattern.trigger, pattern.cost].filter(Boolean)),
          renderList(pattern.bullets || []),
          '<div class="hub-action">',
          pattern.target ? '<a class="hub-link" href="' + escapeHtml(pattern.target) + '">回看正文 →</a>' : '',
          pattern.interviewCue ? '<span class="hub-fit">面试表述：' + escapeHtml(pattern.interviewCue) + '</span>' : '',
          '</div>',
          '</article>'
        ].join('');
      }).join(''),
      '</div>'
    ].join('');
  }

  function renderEngineeringDiagnostics(data) {
    var panel = $('#engineeringDiagnostics');
    if (!panel || !data.diagnostics || !data.diagnostics.length) return;

    panel.classList.add('quiz');
    panel.innerHTML = [
      '<div class="ix-title">🩺 工程诊断练习<span class="live-tag">diagnostics</span></div>',
      '<div class="ix-sub">把自己放到 reviewer / oncall 的位置：先看症状，再判断最小且有效的工程动作。题目聚焦 Eval、Tracing、Guardrails 与部署兜底。</div>',
      data.diagnostics.map(function (diagnostic, index) {
        return [
          '<div class="quiz-q" data-correct="' + escapeHtml(diagnostic.correct) + '">',
          '<div class="stem"><span class="qn">D' + (index + 1) + '</span>' + escapeHtml(diagnostic.stem) + '</div>',
          renderPills([diagnostic.focus, diagnostic.level].filter(Boolean)),
          (diagnostic.options || []).map(function (option, optionIndex) {
            var marker = String.fromCharCode(65 + optionIndex);
            return '<button class="quiz-opt"><span class="mk">' + marker + '</span>' + escapeHtml(option) + '</button>';
          }).join(''),
          '<div class="quiz-exp"><b>参考判断：</b>' + escapeHtml(diagnostic.explanation) + (diagnostic.target ? ' <a class="hub-link" href="' + escapeHtml(diagnostic.target) + '">回看章节 →</a>' : '') + '</div>',
          '</div>'
        ].join('');
      }).join(''),
      '<div class="quiz-score"></div>'
    ].join('');
  }

  function renderCaseDetail(caseItem) {
    if (!caseItem) return '';

    return [
      '<article class="case-detail-shell">',
      '<div class="case-hero">',
      '<div class="case-hero-copy">',
      '<div class="hub-eyebrow">' + escapeHtml(caseItem.label || 'Case Study') + '</div>',
      '<h4>' + escapeHtml(caseItem.title) + '</h4>',
      '<p>' + escapeHtml(caseItem.summary) + '</p>',
      renderPills([caseItem.domain, caseItem.pattern, caseItem.stack].filter(Boolean)),
      '</div>',
      caseItem.antiPattern ? '<div class="case-callout"><strong>别踩这个坑：</strong>' + escapeHtml(caseItem.antiPattern) + '</div>' : '',
      '</div>',
      '<div class="hub-grid case-detail-grid">',
      renderCaseSection('场景与目标', [
        '场景：' + caseItem.situation,
        '目标：' + caseItem.goal
      ]),
      renderCaseSection('为什么这里值得用 Agent', caseItem.whyAgent),
      renderCaseSection('推荐架构', caseItem.architecture),
      renderCaseSection('执行流程', caseItem.flow),
      renderCaseSection('工具与记忆', caseItem.tools, renderList(caseItem.memory || [])),
      renderCaseSection('Guardrails / Eval', caseItem.guardrails, renderList(caseItem.eval || [])),
      renderCaseSection('面试可讲点', caseItem.interviewAngles),
      '</div>',
      '</article>'
    ].join('');
  }

  function renderCaseLibrary(data) {
    var tabWrap = $('#caseLibraryTabs');
    var detail = $('#caseLibraryDetail');
    var cases = data.caseStudies || [];

    if (!tabWrap || !detail || !cases.length) return;

    var buttons = Array.prototype.slice.call(tabWrap.querySelectorAll('[data-case]'));
    var caseMap = {};
    var activeId = null;

    cases.forEach(function (caseItem) {
      caseMap[caseItem.id] = caseItem;
    });

    function paintTabs() {
      buttons.forEach(function (button, index) {
        var caseId = button.getAttribute('data-case');
        var caseItem = caseMap[caseId];

        if (!caseItem) {
          button.disabled = true;
          return;
        }

        button.innerHTML = [
          '<span class="case-tab-label">' + escapeHtml(caseItem.label || ('Case 0' + (index + 1))) + '</span>',
          '<span class="case-tab-title">' + escapeHtml(caseItem.title) + '</span>',
          '<span class="case-tab-summary">' + escapeHtml(caseItem.summary) + '</span>'
        ].join('');
        button.classList.toggle('active', caseId === activeId);
        button.setAttribute('aria-selected', caseId === activeId ? 'true' : 'false');
        button.setAttribute('tabindex', caseId === activeId ? '0' : '-1');
      });
    }

    function activateCase(caseId) {
      if (!caseMap[caseId]) return;
      activeId = caseId;
      paintTabs();
      detail.innerHTML = renderCaseDetail(caseMap[caseId]);
    }

    buttons.forEach(function (button) {
      button.addEventListener('click', function () {
        activateCase(button.getAttribute('data-case'));
      });
    });

    activeId = buttons.length ? buttons[0].getAttribute('data-case') : cases[0].id;
    activateCase(activeId);

    window.__handbookOpenCase = function (caseId) {
      if (!caseMap[caseId]) return;
      activateCase(caseId);
      var section = $('#caseLibrary');
      if (section && section.scrollIntoView) {
        section.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    };
  }

  function renderScenarioBuilder(data) {
    var panel = $('#scenarioBuilderPanel');
    var options = data.scenarioOptions || [];
    var rules = data.scenarioRules || [];
    var cases = data.caseStudies || [];

    if (!panel || !options.length || !rules.length) return;

    var selected = {};
    var optionMap = {};
    var caseMap = {};

    options.forEach(function (option) {
      optionMap[option.id] = option;
    });

    cases.forEach(function (caseItem) {
      caseMap[caseItem.id] = caseItem;
    });

    function getActiveIds() {
      return options.filter(function (option) {
        return !!selected[option.id];
      }).map(function (option) {
        return option.id;
      });
    }

    function matchRule(activeIds) {
      var matches = rules.filter(function (rule) {
        var requiresAll = rule.requiresAll || [];
        var excludes = rule.excludes || [];

        return requiresAll.every(function (id) {
          return activeIds.indexOf(id) !== -1;
        }) && excludes.every(function (id) {
          return activeIds.indexOf(id) === -1;
        });
      }).map(function (rule) {
        return {
          rule: rule,
          score: ((rule.requiresAll || []).length * 100) + (rule.priority || 0)
        };
      }).sort(function (a, b) {
        return b.score - a.score;
      });

      return matches.length ? matches[0].rule : null;
    }

    function renderRecommendation(activeIds) {
      var matchedRule = matchRule(activeIds);
      var activeLabels = activeIds.map(function (id) {
        return optionMap[id] ? optionMap[id].label : id;
      });

      if (!activeIds.length) {
        return '<div class="scenario-empty">先选择几个场景特征，例如“动态决策 + 类型安全”，系统会给出一条更像工程建议而不是概念口号的推荐文案。</div>';
      }

      if (!matchedRule) {
        return [
          '<div class="scenario-result-box">',
          '<div class="hub-eyebrow">需要你再拆一下问题</div>',
          '<h4>当前组合没有现成模板</h4>',
          '<p>建议先确认哪些步骤其实可以固化成 workflow，哪些部分真的需要运行时判断，再决定是否引入 Agent 或多角色。</p>',
          renderPills(activeLabels),
          '</div>'
        ].join('');
      }

      return [
        '<div class="scenario-result-box">',
        '<div class="hub-eyebrow">推荐策略</div>',
        '<h4>' + escapeHtml(matchedRule.title) + '</h4>',
        '<p>' + escapeHtml(matchedRule.recommendation) + '</p>',
        renderPills(activeLabels),
        matchedRule.rationale ? '<div class="scenario-rationale"><strong>为什么：</strong>' + escapeHtml(matchedRule.rationale) + '</div>' : '',
        renderList(matchedRule.nextActions || []),
        matchedRule.caseId && caseMap[matchedRule.caseId]
          ? '<div class="hub-action"><button class="btn ghost" type="button" data-open-case="' + escapeHtml(matchedRule.caseId) + '">查看对应案例</button><span class="hub-fit">推荐案例：' + escapeHtml(caseMap[matchedRule.caseId].title) + '</span></div>'
          : '',
        '</div>'
      ].join('');
    }

    function paint() {
      var activeIds = getActiveIds();

      panel.innerHTML = [
        '<div class="ix-title">场景模拟器<span class="live-tag">scenario builder</span></div>',
        '<div class="ix-sub">把你的需求粗粒度映射成系统形态。这里不直接给框架名，而是先给你一条更稳的架构建议。</div>',
        '<div class="scenario-option-grid">',
        options.map(function (option) {
          var active = !!selected[option.id];
          return [
            '<button class="scenario-option' + (active ? ' active' : '') + '" type="button" data-scenario-option="' + escapeHtml(option.id) + '" aria-pressed="' + (active ? 'true' : 'false') + '">',
            '<span class="scenario-option-title">' + escapeHtml(option.label) + '</span>',
            '<span class="scenario-option-hint">' + escapeHtml(option.hint) + '</span>',
            '</button>'
          ].join('');
        }).join(''),
        '</div>',
        '<div class="hub-action">',
        '<button class="btn ghost" type="button" data-scenario-reset="1">清空选择</button>',
        activeIds.length ? '<span class="hub-fit">已选 ' + activeIds.length + ' 项：' + escapeHtml(activeIds.map(function (id) { return optionMap[id].label; }).join(' / ')) + '</span>' : '<span class="hub-fit">至少选择 1 项即可得到建议。</span>',
        '</div>',
        renderRecommendation(activeIds)
      ].join('');
    }

    panel.addEventListener('click', function (event) {
      var optionButton = event.target.closest('[data-scenario-option]');
      var resetButton = event.target.closest('[data-scenario-reset]');
      var caseButton = event.target.closest('[data-open-case]');

      if (optionButton) {
        var optionId = optionButton.getAttribute('data-scenario-option');
        selected[optionId] = !selected[optionId];
        paint();
        return;
      }

      if (resetButton) {
        selected = {};
        paint();
        return;
      }

      if (caseButton && typeof window.__handbookOpenCase === 'function') {
        window.__handbookOpenCase(caseButton.getAttribute('data-open-case'));
      }
    });

    paint();
  }

  function renderInlineQuiz(panel, items, heading, sub) {
    if (!panel || !items || !items.length) return;
    panel.classList.add('quiz');
    panel.innerHTML = [
      '<div class="ix-title">' + escapeHtml(heading) + '<span class="live-tag">self-check</span></div>',
      '<div class="ix-sub">' + escapeHtml(sub) + '</div>',
      items.map(function (quiz, index) {
        return [
          '<div class="quiz-q" data-correct="' + escapeHtml(quiz.correct) + '">',
          '<div class="stem"><span class="qn">Q' + (index + 1) + '</span>' + escapeHtml(quiz.stem) + '</div>',
          renderPills([quiz.focus, quiz.level].filter(Boolean)),
          (quiz.options || []).map(function (option, optionIndex) {
            var marker = String.fromCharCode(65 + optionIndex);
            return '<button class="quiz-opt"><span class="mk">' + marker + '</span>' + escapeHtml(option) + '</button>';
          }).join(''),
          '<div class="quiz-exp"><b>参考判断：</b>' + escapeHtml(quiz.explanation) + (quiz.target ? ' <a class="hub-link" href="' + escapeHtml(quiz.target) + '">回看章节 →</a>' : '') + '</div>',
          '</div>'
        ].join('');
      }).join(''),
      '<div class="quiz-score"></div>'
    ].join('');
  }

  function renderPostTraining(data) {
    var panel = $('#postTrainingPanel');
    if (!panel || !data.postTraining || !data.postTraining.length) return;

    panel.innerHTML = [
      '<div class="ix-title">🏋️ 后训练四阶对比<span class="live-tag">SFT · RLHF · DPO · GRPO</span></div>',
      '<div class="ix-sub">从模仿示范到偏好对齐，四种方法在『复杂度 / 数据 / 适用场景』上各有取舍。看清何时用哪一种，比记住名字更重要。</div>',
      '<div class="hub-grid">',
      data.postTraining.map(function (item, index) {
        return [
          '<article class="card hub-card">',
          '<div class="hub-eyebrow">Stage 0' + (index + 1) + ' · ' + escapeHtml(item.role) + '</div>',
          '<h4>' + escapeHtml(item.stage) + '</h4>',
          '<p>' + escapeHtml(item.idea) + '</p>',
          '<div class="mini-h">✅ 优势</div>',
          renderList(item.pros || []),
          '<div class="mini-h">⚠️ 代价</div>',
          renderList(item.cons || []),
          item.when ? '<div class="hub-action"><span class="hub-fit">何时用：' + escapeHtml(item.when) + '</span></div>' : '',
          '</article>'
        ].join('');
      }).join(''),
      '</div>'
    ].join('');
  }

  function renderFinetuneDecision(data) {
    var panel = $('#finetuneDecision');
    var dec = data && data.finetuneDecision;
    if (!panel || !dec || !dec.steps || !dec.steps.length) return;

    panel.innerHTML = [
      '<div class="ix-title">🧭 要不要微调？决策链<span class="live-tag">decision tree</span></div>',
      '<div class="ix-sub">' + escapeHtml(dec.intro) + '</div>',
      '<ol class="decision-list">',
      dec.steps.map(function (step) {
        return [
          '<li class="decision-step">',
          '<div class="decision-q">' + escapeHtml(step.q) + '</div>',
          '<div class="decision-branch decision-yes"><span class="branch-tag">是 →</span>' + escapeHtml(step.yes) + '</div>',
          '<div class="decision-branch decision-no"><span class="branch-tag">否 ↓</span>' + escapeHtml(step.no) + '</div>',
          '</li>'
        ].join('');
      }).join(''),
      '</ol>'
    ].join('');
  }

  function renderCodingAgentTrace(data) {
    var panel = $('#codingAgentTrace');
    var trace = data && data.codingAgentTrace;
    if (!panel || !trace || !trace.steps || !trace.steps.length) return;

    var activeIndex = 0;
    var steps = trace.steps;

    function paint() {
      panel.innerHTML = [
        '<div class="ix-title">🛠️ Coding Agent 执行轨迹<span class="live-tag">SWE-bench 式修 bug</span></div>',
        '<div class="ix-sub">' + escapeHtml(trace.intro) + '</div>',
        '<div class="trace-shell">',
        '<div class="trace-rail" role="tablist">',
        steps.map(function (step, index) {
          return [
            '<button class="trace-node' + (index === activeIndex ? ' active' : '') + '" type="button" data-step="' + index + '" aria-selected="' + (index === activeIndex) + '">',
            '<span class="trace-dot"></span>',
            '<span class="trace-node-title">' + escapeHtml(step.title) + '</span>',
            '</button>'
          ].join('');
        }).join(''),
        '</div>',
        '<div class="trace-detail card">',
        '<h4>' + escapeHtml(steps[activeIndex].title) + '</h4>',
        '<p><b>做什么：</b>' + escapeHtml(steps[activeIndex].action) + '</p>',
        '<div class="callout tip" style="margin:0.6rem 0 0;"><span class="label">工程要点</span><span class="cjk">' + escapeHtml(steps[activeIndex].note) + '</span></div>',
        '</div>',
        '</div>'
      ].join('');
    }

    panel.addEventListener('click', function (event) {
      var btn = event.target.closest ? event.target.closest('[data-step]') : null;
      if (!btn) return;
      var index = parseInt(btn.getAttribute('data-step'), 10);
      if (isNaN(index) || index === activeIndex) return;
      activeIndex = index;
      paint();
    });

    paint();
  }

  function renderBenchmarks(data) {
    var panel = $('#benchmarkPanel');
    if (!panel || !data.benchmarks || !data.benchmarks.length) return;

    var focuses = [];
    data.benchmarks.forEach(function (item) {
      if (item.focus && focuses.indexOf(item.focus) === -1) focuses.push(item.focus);
    });
    var activeFocus = 'all';

    function cardHtml(item) {
      return [
        '<article class="card hub-card" data-focus="' + escapeHtml(item.focus || '') + '">',
        '<div class="hub-eyebrow">' + escapeHtml(item.env) + ' · ' + escapeHtml(item.by) + '</div>',
        '<h4>' + escapeHtml(item.name) + '</h4>',
        renderPills([item.focus, item.tasks].filter(Boolean)),
        '<p>' + escapeHtml(item.measures) + '</p>',
        '<div class="hub-action">',
        '<span class="hub-fit">榜单信号：' + escapeHtml(item.signal) + '</span>',
        item.url ? '<a class="hub-link" href="' + escapeHtml(item.url) + '" target="_blank" rel="noopener">基准主页 ↗</a>' : '',
        '</div>',
        '</article>'
      ].join('');
    }

    function paint() {
      var visible = data.benchmarks.filter(function (item) {
        return activeFocus === 'all' || item.focus === activeFocus;
      });
      panel.innerHTML = [
        '<div class="ix-title">📊 评估基准全景<span class="live-tag">benchmarks</span></div>',
        '<div class="ix-sub">不同基准考查不同能力维度。按维度筛选，理解每个基准『到底在测什么、榜单意味着什么』。</div>',
        '<div class="insight-filter">',
        '<button class="insight-chip' + (activeFocus === 'all' ? ' active' : '') + '" data-focus="all" type="button">全部 (' + data.benchmarks.length + ')</button>',
        focuses.map(function (focus) {
          return '<button class="insight-chip' + (activeFocus === focus ? ' active' : '') + '" data-focus="' + escapeHtml(focus) + '" type="button">' + escapeHtml(focus) + '</button>';
        }).join(''),
        '</div>',
        '<div class="hub-grid">',
        visible.map(cardHtml).join(''),
        '</div>'
      ].join('');
    }

    panel.addEventListener('click', function (event) {
      var chip = event.target.closest ? event.target.closest('.insight-chip') : null;
      if (!chip) return;
      var focus = chip.getAttribute('data-focus');
      if (focus === activeFocus) return;
      activeFocus = focus;
      paint();
    });

    paint();
  }

  function renderMultimodal(data) {
    var panel = $('#multimodalPanel');
    if (!panel || !data.multimodalCapabilities || !data.multimodalCapabilities.length) return;

    panel.innerHTML = [
      '<div class="ix-title">👁️ 多模态 Agent 能力拼图<span class="live-tag">LMM · Computer Use</span></div>',
      '<div class="ix-sub">从『看得懂』到『点得准』再到『撑得住长程操作』，多模态 Agent 的难点层层递进。</div>',
      '<div class="hub-grid">',
      data.multimodalCapabilities.map(function (item, index) {
        return [
          '<article class="card hub-card">',
          '<div class="hub-eyebrow">Cap 0' + (index + 1) + '</div>',
          '<h4>' + escapeHtml(item.axis) + '</h4>',
          '<p>' + escapeHtml(item.desc) + '</p>',
          '</article>'
        ].join('');
      }).join(''),
      '</div>'
    ].join('');
  }

  function renderCostLatency(data) {
    var panel = $('#costLatencyPanel');
    if (!panel || !data.costLatencyTactics || !data.costLatencyTactics.length) return;

    panel.innerHTML = [
      '<div class="ix-title">⚡ 成本 / 延迟优化四杠杆<span class="live-tag">cost · latency</span></div>',
      '<div class="ix-sub">从『能跑』到『跑得起、跑得快』：路由分流、缓存复用、并行流式、上下文瘦身，四个方向对症下药。</div>',
      '<div class="hub-grid">',
      data.costLatencyTactics.map(function (item, index) {
        return [
          '<article class="card hub-card">',
          '<div class="hub-eyebrow">Lever 0' + (index + 1) + '</div>',
          '<h4>' + escapeHtml(item.lever) + '</h4>',
          '<p>' + escapeHtml(item.idea) + '</p>',
          renderList(item.tactics || []),
          item.metric ? '<div class="hub-action"><span class="hub-fit">看什么指标：' + escapeHtml(item.metric) + '</span></div>' : '',
          '</article>'
        ].join('');
      }).join(''),
      '</div>'
    ].join('');
  }

  function renderProductionPrinciples(data) {
    var panel = $('#productionPrinciples');
    if (!panel || !data.productionPrinciples || !data.productionPrinciples.length) return;

    var STORAGE_KEY = 'ah-prod-principles';
    var checked = {};
    try {
      checked = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') || {};
    } catch (e) { checked = {}; }

    var principles = data.productionPrinciples;

    function paint() {
      var done = principles.filter(function (p) { return checked[p.id]; }).length;
      var pct = Math.round(done / principles.length * 100);
      panel.innerHTML = [
        '<div class="ix-title">🏭 生产可靠性原则自测<span class="live-tag">saved locally</span></div>',
        '<div class="ix-sub">脱胎自 12-Factor Agents 的工程经验清单。勾选你已在项目里做到的，进度存在本机。全绿意味着你的 Agent 已具备生产级骨架。</div>',
        '<div class="progress-ring-wrap"><div class="progress-track"><div class="progress-fill" style="width:' + pct + '%"></div></div><div class="progress-pct">' + pct + '%</div></div>',
        '<ul class="checklist">',
        principles.map(function (p) {
          return [
            '<li><label><input type="checkbox" data-pid="' + escapeHtml(p.id) + '"' + (checked[p.id] ? ' checked' : '') + '><span class="box"></span>',
            '<span class="ct"><b>' + escapeHtml(p.title) + '</b> — ' + escapeHtml(p.desc) + '</span></label></li>'
          ].join('');
        }).join(''),
        '</ul>'
      ].join('');
    }

    panel.addEventListener('change', function (event) {
      var box = event.target;
      if (!box || box.getAttribute('data-pid') == null) return;
      var pid = box.getAttribute('data-pid');
      checked[pid] = box.checked;
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(checked)); } catch (e) {}
      paint();
    });

    paint();
  }

  function init() {
    var data = window.HANDBOOK_DATA || {};
    renderModeHub(data);
    renderModuleAtlas(data);
    renderModuleQuizHub(data);
    renderTutorialMap(data);
    renderPatternLibrary(data);
    renderEngineeringDiagnostics(data);
    renderEvalFrameworks(data);
    renderGuardrailLayers(data);
    renderDebugPlaybook(data);
    renderCaseLibrary(data);
    renderScenarioBuilder(data);
    renderInsightWall(data);
    renderPostTraining(data);
    renderFinetuneDecision(data);
    renderCodingAgentTrace(data);
    renderBenchmarks(data);
    renderMultimodal(data);
    renderCostLatency(data);
    renderProductionPrinciples(data);
    renderChapterInsightLinks(data);
    renderInlineQuiz($('#postTrainingQuiz'), data.postTrainingQuizzes, '🧪 后训练小测', '判断该用哪种后训练/替代方案，点选项看解析。');
    renderInlineQuiz($('#benchmarkQuiz'), data.benchmarkQuizzes, '🧪 评估基准小测', '选对基准、选对指标，才能做出可信评估。');
    bindAllQuizzes(document);
    rewriteInternalLinks();
    if ('MutationObserver' in window) {
      new MutationObserver(rewriteInternalLinks).observe(document.body, {
        childList: true,
        subtree: true
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
}());
