(function () {
  "use strict";

  const questions = window.LOGIC_QUESTIONS || [];
  const root = document.getElementById("app");
  const STORAGE_KEY = "logic-practice-progress-v1";
  const modeNames = {
    all: "顺序刷题",
    wrong: "错题重练",
    starred: "我的收藏",
    random: "随机 10 题",
  };

  const emptyRecord = () => ({
    selected: [],
    openText: "",
    submitted: false,
    isCorrect: null,
  });

  let state = {
    currentId: 1,
    answers: {},
    starred: [],
    mode: "all",
    randomIds: [],
  };
  let view = "home";
  let navigatorOpen = false;

  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    if (saved && typeof saved === "object") {
      state = {
        ...state,
        ...saved,
        answers: saved.answers || {},
        starred: saved.starred || [],
        randomIds: saved.randomIds || [],
      };
    }
  } catch (_) {
    // Ignore a damaged local save and open the complete question bank.
  }

  function esc(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function save() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function recordFor(id) {
    return state.answers[id] || emptyRecord();
  }

  function updateRecord(id, patch) {
    state.answers[id] = { ...recordFor(id), ...patch };
    save();
  }

  function sameAnswers(a, b) {
    return [...a].sort().join("") === [...b].sort().join("");
  }

  function shortSource(source) {
    if (source.startsWith("第一部分")) return "主文档";
    if (source.startsWith("第二部分")) return "综合补充";
    return "2025 年新增";
  }

  function activeQuestions() {
    if (state.mode === "wrong") {
      return questions.filter((q) => recordFor(q.id).isCorrect === false);
    }
    if (state.mode === "starred") {
      return questions.filter((q) => state.starred.includes(q.id));
    }
    if (state.mode === "random") {
      return state.randomIds
        .map((id) => questions.find((q) => q.id === id))
        .filter(Boolean);
    }
    return questions;
  }

  function stats() {
    const submitted = questions.filter((q) => recordFor(q.id).submitted);
    const correct = submitted.filter((q) => recordFor(q.id).isCorrect === true).length;
    const wrong = submitted.filter((q) => recordFor(q.id).isCorrect === false).length;
    const judged = correct + wrong;
    return {
      completed: submitted.length,
      correct,
      wrong,
      accuracy: judged ? Math.round((correct / judged) * 100) : 0,
      overall: questions.length ? Math.round((submitted.length / questions.length) * 100) : 0,
    };
  }

  function progressRing(percent, large) {
    return `<div class="progress-ring${large ? " large" : ""}" style="--progress:${percent * 3.6}deg"><div><strong>${percent}%</strong><span>总进度</span></div></div>`;
  }

  function renderHome() {
    const s = stats();
    root.className = "app-bg";
    root.innerHTML = `
      <div class="home-shell">
        <header class="home-header">
          <div class="brand-lockup"><span class="brand-mark">✦</span><div><p class="eyebrow">LOGIC PRACTICE</p><h1>逻辑充电站</h1></div></div>
          <span class="save-status"><i></i> 进度自动保存在本机</span>
        </header>
        <section class="welcome-card">
          <div class="welcome-copy">
            <span class="soft-label">粉蓝专属题库 · 共 ${questions.length} 题</span>
            <h2>${s.completed ? "接着上次，继续变厉害吧" : "每天刷一点，逻辑更清晰"}</h2>
            <p>题目来自《逻辑推理题汇总》。每题提交后都会立即显示标准答案和完整解析，答错也不用怕。</p>
            <div class="hero-actions">
              <button class="primary-button" data-action="start" data-mode="all">${s.completed ? "继续上次进度" : "开始刷题"}<span>→</span></button>
              <button class="ghost-button" data-action="start" data-mode="random">随机练 10 题</button>
            </div>
          </div>
          <div class="progress-hero">${progressRing(s.overall, true)}<div class="mini-cloud cloud-one"></div><div class="mini-cloud cloud-two"></div></div>
        </section>
        <section class="stats-grid">
          <article class="stat-card blue"><span class="stat-icon">✓</span><div><strong>${s.completed}</strong><span>已完成</span></div><small>/ ${questions.length} 题</small></article>
          <article class="stat-card pink"><span class="stat-icon">◎</span><div><strong>${s.accuracy}%</strong><span>选择题正确率</span></div><small>${s.correct + s.wrong ? `${s.correct} 对 · ${s.wrong} 错` : "完成后显示"}</small></article>
          <article class="stat-card lilac"><span class="stat-icon">☆</span><div><strong>${state.starred.length}</strong><span>已收藏</span></div><small>重点反复看</small></article>
        </section>
        <section class="mode-section">
          <div class="section-heading"><div><p class="eyebrow">PRACTICE MODE</p><h2>选择刷题方式</h2></div>${s.completed ? '<button class="text-button danger" data-action="reset">清空全部进度</button>' : ""}</div>
          <div class="mode-grid">
            <button class="mode-card" data-action="start" data-mode="all"><span class="mode-art book">01</span><div><strong>顺序刷题</strong><p>按照文档顺序完成全部 ${questions.length} 题</p></div><b>→</b></button>
            <button class="mode-card" data-action="start" data-mode="wrong"><span class="mode-art wrong">!</span><div><strong>错题重练</strong><p>${s.wrong ? `还有 ${s.wrong} 道错题等你攻克` : "答错的题会自动收进这里"}</p></div><b>→</b></button>
            <button class="mode-card" data-action="start" data-mode="starred"><span class="mode-art star">★</span><div><strong>我的收藏</strong><p>${state.starred.length ? `已收藏 ${state.starred.length} 道重点题` : "遇到重点题就点亮小星星"}</p></div><b>→</b></button>
          </div>
        </section>
      </div>`;
  }

  function questionGrid(list, currentId) {
    return `<div class="question-grid">${list.map((q, index) => {
      const answer = recordFor(q.id);
      const status = answer.submitted ? (answer.isCorrect === false ? "wrong" : "done") : "";
      return `<button class="${status} ${q.id === currentId ? "current" : ""}" data-action="goto" data-id="${q.id}" aria-label="第 ${index + 1} 题">${index + 1}${state.starred.includes(q.id) ? "<i>★</i>" : ""}</button>`;
    }).join("")}</div>`;
  }

  function optionList(question, record) {
    return `<div class="options-list">${question.options.map((option) => {
      const selected = record.selected.includes(option.label);
      const correct = record.submitted && question.correctOptions.includes(option.label);
      const incorrect = record.submitted && selected && !question.correctOptions.includes(option.label);
      return `<button class="option-button ${selected ? "selected" : ""} ${correct ? "correct" : ""} ${incorrect ? "incorrect" : ""}" data-action="option" data-label="${option.label}" ${record.submitted ? "disabled" : ""}>
        <span class="option-label">${option.label}</span><span class="option-text">${esc(option.text)}</span>${correct ? '<span class="option-result">✓</span>' : incorrect ? '<span class="option-result">×</span>' : ""}
      </button>`;
    }).join("")}</div>`;
  }

  function openAnswer(question, record) {
    const scanNote = question.options.length
      ? `<div class="scan-note"><strong>原扫描件仅保留：</strong>${question.options.map((o) => `${o.label}. ${esc(o.text)}`).join("；")}</div>`
      : "";
    return `<div class="open-answer-area">${scanNote}<label for="open-answer">先写下你的推理结果</label><textarea id="open-answer" data-open-answer ${record.submitted ? "disabled" : ""} placeholder="在这里输入答案，提交后再和标准答案对照…">${esc(record.openText)}</textarea></div>`;
  }

  function answerPanel(question, record) {
    const status = record.isCorrect === true
      ? { cls: "correct", icon: "✓", title: "答对啦！思路很稳" }
      : record.isCorrect === false
        ? { cls: "incorrect", icon: "×", title: "这题没选对，看看解析就会啦" }
        : { cls: "compare", icon: "↔", title: "已提交，请对照标准答案" };
    return `<section class="answer-panel ${status.cls}">
      <div class="answer-status"><span>${status.icon}</span><strong>${status.title}</strong><button data-action="retry">重新作答</button></div>
      <div class="standard-answer"><span>标准答案</span><strong>${esc(question.answer)}</strong></div>
      <div class="analysis-box"><div class="analysis-title"><span>✦</span><strong>答案解析</strong></div><p>${esc(question.analysis)}</p></div>
    </section>`;
  }

  function renderPractice() {
    const list = activeQuestions();
    if (!list.length) {
      view = "home";
      renderHome();
      notify("这里暂时没有题目哦");
      return;
    }
    let question = list.find((q) => q.id === state.currentId) || list[0];
    state.currentId = question.id;
    const index = list.findIndex((q) => q.id === question.id);
    const record = recordFor(question.id);
    const s = stats();
    const questionPercent = Math.round(((index + 1) / list.length) * 100);
    const starred = state.starred.includes(question.id);
    const grid = questionGrid(list, question.id);

    root.className = "app-bg practice-page";
    root.innerHTML = `
      <header class="practice-header">
        <button class="compact-brand" data-action="exit"><span class="brand-mark small">✦</span><span>逻辑充电站</span></button>
        <div class="header-progress"><span>${modeNames[state.mode]}</span><div class="progress-track"><i style="width:${questionPercent}%"></i></div><b>${index + 1} / ${list.length}</b></div>
        <div class="header-actions"><button class="mobile-nav-button" data-action="open-nav">题目列表</button><button class="save-exit-button" data-action="exit"><i></i> 保存并退出</button></div>
      </header>
      <div class="practice-layout">
        <aside class="practice-sidebar">
          <div class="sidebar-progress-card">${progressRing(s.overall, false)}<div class="sidebar-numbers"><strong>${s.completed}<small> / ${questions.length}</small></strong><span>题目已完成</span></div></div>
          <div class="sidebar-card"><div class="sidebar-title"><strong>题目列表</strong><span>点击跳转</span></div>${grid}<div class="legend"><span><i class="done"></i> 已完成</span><span><i class="wrong"></i> 答错</span><span><i class="current"></i> 当前</span></div></div>
          <div class="mode-switcher"><button class="${state.mode === "all" ? "active" : ""}" data-action="start" data-mode="all">全部题</button><button class="${state.mode === "wrong" ? "active" : ""}" data-action="start" data-mode="wrong">错题</button><button class="${state.mode === "starred" ? "active" : ""}" data-action="start" data-mode="starred">收藏</button></div>
        </aside>
        <section class="question-area">
          <article class="question-card">
            <div class="question-meta"><div class="meta-labels"><span class="source-pill">${shortSource(question.source)}</span><span>${esc(question.sourceNumber)}</span>${question.kind === "open" ? '<span class="open-pill">开放题</span>' : ""}</div><button class="star-button ${starred ? "active" : ""}" data-action="star">${starred ? "★" : "☆"}<span>${starred ? "已收藏" : "收藏"}</span></button></div>
            <h1 class="question-title"><span>${index + 1}</span>${esc(question.prompt)}</h1>
            ${question.kind === "choice" ? optionList(question, record) : openAnswer(question, record)}
            ${record.submitted ? answerPanel(question, record) : '<div class="submit-row"><span>提交后会立即显示答案和解析</span><button class="submit-button" data-action="submit">提交答案</button></div>'}
          </article>
          <nav class="question-navigation"><button data-action="relative" data-offset="-1" ${index === 0 ? "disabled" : ""}>← 上一题</button><span>本题进度已自动保存</span><button class="next-button" data-action="relative" data-offset="1" ${index === list.length - 1 ? "disabled" : ""}>下一题 →</button></nav>
        </section>
      </div>
      ${navigatorOpen ? `<div class="drawer-backdrop" data-action="close-nav"><div class="drawer" data-drawer><div class="drawer-header"><div><strong>题目列表</strong><span>${modeNames[state.mode]}</span></div><button data-action="close-nav">×</button></div>${grid}</div></div>` : ""}`;
  }

  function render() {
    if (view === "practice") renderPractice();
    else renderHome();
  }

  function notify(message) {
    document.querySelector(".toast")?.remove();
    const toast = document.createElement("div");
    toast.className = "toast";
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 1900);
  }

  function startMode(mode) {
    let ids = [];
    if (mode === "wrong") ids = questions.filter((q) => recordFor(q.id).isCorrect === false).map((q) => q.id);
    else if (mode === "starred") ids = [...state.starred];
    else if (mode === "random") {
      state.randomIds = [...questions].sort(() => Math.random() - 0.5).slice(0, 10).map((q) => q.id);
      ids = state.randomIds;
    } else ids = questions.map((q) => q.id);

    if (!ids.length) {
      notify(mode === "wrong" ? "目前还没有错题哦" : "还没有收藏题目哦");
      return;
    }
    state.mode = mode;
    if (!ids.includes(state.currentId)) state.currentId = ids[0];
    view = "practice";
    navigatorOpen = false;
    save();
    render();
    scrollTo({ top: 0 });
  }

  root.addEventListener("click", (event) => {
    const button = event.target.closest("[data-action]");
    if (!button) return;
    const action = button.dataset.action;
    const list = activeQuestions();
    const question = list.find((q) => q.id === state.currentId) || list[0];
    if (action === "start") return startMode(button.dataset.mode);
    if (action === "exit") { view = "home"; navigatorOpen = false; save(); render(); notify("进度已保存，可以放心退出啦"); return; }
    if (action === "goto") { state.currentId = Number(button.dataset.id); navigatorOpen = false; save(); render(); scrollTo({ top: 0 }); return; }
    if (action === "relative") {
      const index = list.findIndex((q) => q.id === question.id);
      const next = list[index + Number(button.dataset.offset)];
      if (next) { state.currentId = next.id; save(); render(); scrollTo({ top: 0 }); }
      return;
    }
    if (action === "option") {
      const record = recordFor(question.id);
      if (record.submitted) return;
      const label = button.dataset.label;
      const selected = question.correctOptions.length > 1
        ? (record.selected.includes(label) ? record.selected.filter((x) => x !== label) : [...record.selected, label])
        : [label];
      updateRecord(question.id, { selected }); render(); return;
    }
    if (action === "submit") {
      const record = recordFor(question.id);
      if (question.kind === "choice" && !record.selected.length) return notify("先选择一个答案吧");
      if (question.kind === "open" && !record.openText.trim()) return notify("先写下你的答案吧");
      updateRecord(question.id, { submitted: true, isCorrect: question.kind === "choice" ? sameAnswers(record.selected, question.correctOptions) : null });
      render(); return;
    }
    if (action === "retry") { updateRecord(question.id, emptyRecord()); render(); return; }
    if (action === "star") {
      state.starred = state.starred.includes(question.id) ? state.starred.filter((id) => id !== question.id) : [...state.starred, question.id];
      save(); render(); return;
    }
    if (action === "open-nav") { navigatorOpen = true; render(); return; }
    if (action === "close-nav") {
      if (event.target.closest("[data-drawer]") && !event.target.closest("button")) return;
      navigatorOpen = false; render(); return;
    }
    if (action === "reset") {
      if (!confirm("确定要清空全部答题进度、错题和收藏吗？")) return;
      state = { currentId: 1, answers: {}, starred: [], mode: "all", randomIds: [] };
      save(); render(); notify("已清空全部进度");
    }
  });

  root.addEventListener("input", (event) => {
    if (!event.target.matches("[data-open-answer]")) return;
    updateRecord(state.currentId, { openText: event.target.value });
  });

  render();
})();
