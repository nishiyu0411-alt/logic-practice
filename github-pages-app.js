(function () {
  "use strict";

  const QUESTIONS = window.LOGIC_QUESTIONS || [];
  const STORE_KEY = "logic_practice_word_layout_v2";
  const OLD_STORE_KEY = "logic-practice-progress-v1";
  const SUPABASE_URL = "https://awvmsvxzsphxfzluunwh.supabase.co";
  const SUPABASE_KEY = "sb_publishable_dYerJoJGAsbb-k0zvbLQSA__2kPW0HH";

  const defaults = {
    answers: {},
    favorites: {},
    wrongBook: {},
    wrongSession: [],
    order: [],
    index: 0,
    mode: "all",
    category: "ALL",
    elapsed: 0,
    timerRunning: true,
    lastTick: Date.now(),
    lastSaved: null,
    syncCode: "",
  };

  const $ = (selector) => document.querySelector(selector);
  const quiz = $("#quiz");
  const mode = $("#mode");
  const category = $("#category");
  const palette = $("#palette");
  const questionById = new Map(QUESTIONS.map((q) => [q.id, q]));

  function esc(value) {
    return String(value ?? "").replace(/[&<>"']/g, (char) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    })[char]);
  }

  function sameAnswers(left, right) {
    return [...left].sort().join("") === [...right].sort().join("");
  }

  function sourceName(source) {
    if (source.startsWith("第一部分")) return "主文档逻辑题";
    if (source.startsWith("第二部分")) return "综合测试补充题";
    return "2025年新增题";
  }

  function cleanSyncCode(value) {
    return String(value || "").trim();
  }

  function cloudSyncCode(value) {
    return "logic:" + cleanSyncCode(value);
  }

  function newRecord() {
    return { selected: [], openText: "", submitted: false, isCorrect: null };
  }

  function migrateOldState() {
    try {
      const old = JSON.parse(localStorage.getItem(OLD_STORE_KEY) || "null");
      if (!old || typeof old !== "object") return null;
      const favorites = {};
      (old.starred || []).forEach((id) => { favorites[id] = true; });
      const answers = {};
      const wrongBook = {};
      Object.entries(old.answers || {}).forEach(([id, rec]) => {
        if (!rec || !rec.submitted) return;
        answers[id] = {
          selected: Array.isArray(rec.selected) ? rec.selected : [],
          openText: rec.openText || "",
          submitted: true,
          isCorrect: rec.isCorrect ?? null,
          at: rec.at || new Date().toISOString(),
        };
        if (rec.isCorrect === false) wrongBook[id] = true;
      });
      const index = Math.max(0, QUESTIONS.findIndex((q) => q.id === old.currentId));
      return {
        ...defaults,
        answers,
        favorites,
        wrongBook,
        order: QUESTIONS.map((q) => q.id),
        index,
        mode: old.mode === "wrong" ? "wrong" : old.mode === "starred" ? "favorite" : "all",
        lastTick: Date.now(),
      };
    } catch (_) {
      return null;
    }
  }

  function normalizeState(input) {
    const next = { ...defaults, ...(input || {}) };
    next.answers = next.answers && typeof next.answers === "object" ? next.answers : {};
    next.favorites = next.favorites && typeof next.favorites === "object" ? next.favorites : {};
    next.wrongBook = next.wrongBook && typeof next.wrongBook === "object" ? next.wrongBook : {};
    next.wrongSession = Array.isArray(next.wrongSession) ? next.wrongSession.filter((id) => questionById.has(Number(id))).map(Number) : [];
    next.order = Array.isArray(next.order) && next.order.length === QUESTIONS.length
      ? next.order.filter((id) => questionById.has(Number(id))).map(Number)
      : QUESTIONS.map((q) => q.id);
    if (next.order.length !== QUESTIONS.length) next.order = QUESTIONS.map((q) => q.id);
    next.index = Number.isFinite(Number(next.index)) ? Number(next.index) : 0;
    next.elapsed = Number.isFinite(Number(next.elapsed)) ? Number(next.elapsed) : 0;
    next.lastTick = Date.now();
    return next;
  }

  let state = { ...defaults };
  try {
    const saved = JSON.parse(localStorage.getItem(STORE_KEY) || "null");
    state = normalizeState(saved || migrateOldState());
  } catch (_) {
    state = normalizeState(migrateOldState());
  }

  if (state.mode === "wrong" && !state.wrongSession.length) {
    state.wrongSession = Object.keys(state.wrongBook).filter((id) => state.wrongBook[id]).map(Number);
    state.wrongSession.forEach((id) => { delete state.answers[id]; });
  }

  const categories = [...new Set(QUESTIONS.map((q) => sourceName(q.source)))];
  category.innerHTML = '<option value="ALL">全部分区</option>' + categories
    .map((name) => `<option value="${esc(name)}">${esc(name)}</option>`)
    .join("");
  mode.value = state.mode || "all";
  category.value = categories.includes(state.category) ? state.category : "ALL";
  state.category = category.value;

  let cloudTimer = null;
  let toastTimer = null;

  function cloudHeaders() {
    return {
      apikey: SUPABASE_KEY,
      Authorization: "Bearer " + SUPABASE_KEY,
      "Content-Type": "application/json",
    };
  }

  async function pushCloud() {
    const code = cleanSyncCode(state.syncCode);
    if (code.length < 8) return false;
    const payload = { ...state, lastTick: Date.now() };
    try {
      const response = await fetch(SUPABASE_URL + "/rest/v1/quiz_sync?on_conflict=sync_code", {
        method: "POST",
        headers: { ...cloudHeaders(), Prefer: "resolution=merge-duplicates,return=minimal" },
        body: JSON.stringify({
          sync_code: cloudSyncCode(code),
          state: payload,
          updated_at: new Date().toISOString(),
        }),
      });
      if (!response.ok) throw new Error(await response.text());
      const status = $("#syncStatus");
      if (status) status.textContent = "☁️ 已同步到云端 · " + new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
      return true;
    } catch (_) {
      const status = $("#syncStatus");
      if (status) status.textContent = "云同步暂时失败，本机进度仍已保存。";
      return false;
    }
  }

  function queueCloud() {
    clearTimeout(cloudTimer);
    cloudTimer = setTimeout(pushCloud, 500);
  }

  async function pullCloud(showMessage = true) {
    const code = cleanSyncCode(state.syncCode);
    if (code.length < 8) {
      if (showMessage) toast("同步码至少需要8位");
      return false;
    }
    try {
      const url = SUPABASE_URL + "/rest/v1/quiz_sync?sync_code=eq." + encodeURIComponent(cloudSyncCode(code)) + "&select=state,updated_at";
      const response = await fetch(url, { headers: cloudHeaders() });
      if (!response.ok) throw new Error(await response.text());
      const rows = await response.json();
      if (rows.length) {
        state = normalizeState({ ...rows[0].state, syncCode: code });
        localStorage.setItem(STORE_KEY, JSON.stringify(state));
        mode.value = state.mode || "all";
        category.value = categories.includes(state.category) ? state.category : "ALL";
        state.category = category.value;
        $("#syncCode").value = code;
        if (showMessage) toast("已从云端恢复逻辑题进度");
        return true;
      }
      await pushCloud();
      if (showMessage) toast("已创建逻辑题云端进度");
      return false;
    } catch (_) {
      if (showMessage) toast("云同步失败，请稍后再试");
      return false;
    }
  }

  function save(options = {}) {
    state.lastSaved = new Date().toISOString();
    localStorage.setItem(STORE_KEY, JSON.stringify(state));
    updateStats();
    if (options.cloud !== false) queueCloud();
  }

  function toast(message) {
    const node = $("#toast");
    clearTimeout(toastTimer);
    node.textContent = message;
    node.classList.add("show");
    toastTimer = setTimeout(() => node.classList.remove("show"), 1800);
  }

  function effectiveElapsed() {
    if (!state.timerRunning) return state.elapsed;
    return state.elapsed + Math.max(0, Math.floor((Date.now() - state.lastTick) / 1000));
  }

  function syncTimer() {
    if (!state.timerRunning) return;
    const now = Date.now();
    state.elapsed += Math.max(0, Math.floor((now - state.lastTick) / 1000));
    state.lastTick = now;
  }

  function formatTime(seconds) {
    const value = Math.max(0, Number(seconds) | 0);
    const hours = Math.floor(value / 3600);
    const minutes = Math.floor((value % 3600) / 60);
    const secs = value % 60;
    return [hours, minutes, secs].map((item) => String(item).padStart(2, "0")).join(":");
  }

  setInterval(() => { $("#timer").textContent = formatTime(effectiveElapsed()); }, 500);

  function filtered() {
    const wrongIds = state.wrongSession.length ? new Set(state.wrongSession) : new Set(
      Object.keys(state.wrongBook).filter((id) => state.wrongBook[id]).map(Number)
    );
    return state.order.map((id) => questionById.get(Number(id))).filter((question) => {
      if (!question) return false;
      if (state.category !== "ALL" && sourceName(question.source) !== state.category) return false;
      const answer = state.answers[question.id];
      if (state.mode === "unanswered" && answer?.submitted) return false;
      if (state.mode === "wrong" && !wrongIds.has(question.id)) return false;
      if (state.mode === "favorite" && !state.favorites[question.id]) return false;
      return true;
    });
  }

  function ensureIndex(list) {
    if (!list.length) state.index = 0;
    else state.index = Math.max(0, Math.min(state.index, list.length - 1));
  }

  function submittedAnswers() {
    return Object.values(state.answers).filter((record) => record?.submitted);
  }

  function updateStats() {
    const answers = submittedAnswers();
    const judged = answers.filter((record) => record.isCorrect !== null);
    const correct = judged.filter((record) => record.isCorrect === true).length;
    $("#statDone").textContent = answers.length;
    $("#statWrong").textContent = Object.keys(state.wrongBook).filter((id) => state.wrongBook[id]).length;
    $("#statFav").textContent = Object.keys(state.favorites).filter((id) => state.favorites[id]).length;
    $("#statAcc").textContent = judged.length ? Math.round(correct / judged.length * 100) + "%" : "—";
    const list = filtered();
    ensureIndex(list);
    $("#progressText").textContent = list.length ? (state.index + 1) + " / " + list.length : "0 / 0";
    $("#progressbar").style.width = (list.length ? ((state.index + 1) / list.length * 100) : 0) + "%";
    $("#saveTime").textContent = state.lastSaved
      ? "已保存 " + new Date(state.lastSaved).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })
      : "尚未作答";
  }

  function renderPalette(list) {
    const currentId = list[state.index]?.id;
    palette.innerHTML = list.map((question, position) => {
      const answer = state.answers[question.id];
      const classes = [
        "pal",
        answer?.submitted ? "done" : "",
        state.wrongBook[question.id] ? "wrong" : "",
        question.id === currentId ? "current" : "",
        state.favorites[question.id] ? "starred" : "",
      ].filter(Boolean).join(" ");
      return `<button class="${classes}" data-position="${position}" title="题库第${question.id}题">${position + 1}</button>`;
    }).join("");
    palette.querySelectorAll("button").forEach((button) => {
      button.onclick = () => {
        state.index = Number(button.dataset.position);
        save();
        render();
        if (window.innerWidth <= 840) quiz.scrollIntoView({ behavior: "smooth", block: "start" });
      };
    });
  }

  function renderOptions(question, record) {
    return `<div class="options">${question.options.map((option) => {
      const selected = record.selected.includes(option.label);
      const correct = record.submitted && question.correctOptions.includes(option.label);
      const wrong = record.submitted && selected && !question.correctOptions.includes(option.label);
      const classes = ["option", selected ? "selected" : "", correct ? "correct" : "", wrong ? "wrong" : "", record.submitted ? "locked" : ""].filter(Boolean).join(" ");
      return `<button class="${classes}" data-option="${esc(option.label)}" ${record.submitted ? "disabled" : ""}>
        <span class="key">${esc(option.label)}</span><span>${esc(option.text)}</span>
      </button>`;
    }).join("")}</div>`;
  }

  function renderOpenAnswer(question, record) {
    const scanNote = question.options.length
      ? `<div class="scan-note"><strong>原资料可辨认信息：</strong>${question.options.map((item) => `${esc(item.label)}. ${esc(item.text)}`).join("；")}</div>`
      : "";
    return `<div class="open-answer">${scanNote}<label for="openAnswer">先写下你的推理结果</label>
      <textarea id="openAnswer" ${record.submitted ? "disabled" : ""} placeholder="在这里输入答案，提交后再与标准答案对照…">${esc(record.openText)}</textarea>
    </div>`;
  }

  function renderExplanation(question, record) {
    const isOpen = question.kind === "open";
    const resultClass = isOpen ? "" : record.isCorrect ? "correct-result" : "wrong-result";
    const resultTitle = isOpen ? "↔ 已提交，请对照标准答案" : record.isCorrect ? "✓ 回答正确" : "✗ 回答错误";
    const mine = isOpen ? record.openText : record.selected.join("、");
    return `<div class="explain ${resultClass}">
      <div class="result-title">${resultTitle}</div>
      <div class="answerline">你的答案：${esc(mine || "未填写")}　<strong>标准答案：${esc(question.answer)}</strong></div>
      <div class="analysis"><strong>答案解析：</strong>${esc(question.analysis)}</div>
      <details class="source"><summary>查看题目来源</summary><div>${esc(question.source)} · ${esc(question.sourceNumber)}</div></details>
    </div>`;
  }

  function render() {
    const list = filtered();
    ensureIndex(list);
    updateStats();
    renderPalette(list);
    if (!list.length) {
      const message = state.mode === "wrong"
        ? "错题本已经空啦，继续去做新题吧。"
        : "可以切换练习模式或题库分区。";
      quiz.innerHTML = `<div class="empty"><div><div class="empty-icon">🎉</div><h3>这里暂时没有题目</h3><p>${message}</p></div></div>`;
      return;
    }

    const question = list[state.index];
    const record = { ...newRecord(), ...(state.answers[question.id] || {}) };
    record.selected = Array.isArray(record.selected) ? record.selected : [];
    const favorite = Boolean(state.favorites[question.id]);
    const questionBody = question.kind === "choice"
      ? renderOptions(question, record)
      : renderOpenAnswer(question, record);

    quiz.innerHTML = `
      <div class="qtop">
        <div class="badges">
          <span class="badge">${esc(sourceName(question.source))}</span>
          <span class="badge pink">${question.kind === "open" ? "开放作答" : "选择题"}</span>
        </div>
        <div class="qnum">题库第 ${question.id} 题 · 当前 ${state.index + 1}/${list.length}</div>
      </div>
      <div class="stem">${esc(question.prompt)}</div>
      ${questionBody}
      ${record.submitted ? renderExplanation(question, record) : `<div class="submitrow"><span>提交后，无论对错都会显示标准答案和解析。</span><button id="submitBtn" class="primary">提交答案</button></div>`}
      <div class="nav">
        <button id="prevBtn" class="secondary">← 上一题</button>
        <button id="favBtn" class="secondary">${favorite ? "★ 已收藏" : "☆ 收藏"}</button>
        <button id="clearOne" class="secondary">${record.submitted ? "重做本题" : "跳过"}</button>
        <span class="spacer"></span>
        <button id="nextBtn" class="primary">${state.index === list.length - 1 ? "到最后了" : "下一题 →"}</button>
      </div>
      <div class="saveNote">快捷键：<span class="kbd">1-4</span> 选 A-D　<span class="kbd">Enter</span> 提交　<span class="kbd">←</span><span class="kbd">→</span> 切题　<span class="kbd">F</span> 收藏</div>
    `;

    quiz.querySelectorAll("[data-option]").forEach((button) => {
      button.onclick = () => {
        if (record.submitted) return;
        const selected = button.dataset.option;
        const nextSelected = question.correctOptions.length > 1
          ? (record.selected.includes(selected) ? record.selected.filter((item) => item !== selected) : [...record.selected, selected])
          : [selected];
        state.answers[question.id] = { ...record, selected: nextSelected };
        save();
        render();
      };
    });

    const textarea = $("#openAnswer");
    if (textarea && !record.submitted) {
      textarea.oninput = () => {
        state.answers[question.id] = { ...record, openText: textarea.value };
        save();
      };
    }

    const submit = $("#submitBtn");
    if (submit) submit.onclick = () => submitCurrent();
    $("#prevBtn").onclick = () => move(-1);
    $("#nextBtn").onclick = () => move(1);
    $("#favBtn").onclick = () => {
      state.favorites[question.id] = !favorite;
      save();
      render();
    };
    $("#clearOne").onclick = () => {
      if (record.submitted) {
        delete state.answers[question.id];
        save();
        render();
      } else {
        move(1);
      }
    };
  }

  function submitCurrent() {
    const list = filtered();
    const question = list[state.index];
    if (!question) return;
    const record = { ...newRecord(), ...(state.answers[question.id] || {}) };
    record.selected = Array.isArray(record.selected) ? record.selected : [];
    if (question.kind === "choice" && !record.selected.length) {
      toast("请先选择一个答案");
      return;
    }
    if (question.kind === "open" && !String(record.openText || "").trim()) {
      toast("请先写下你的答案");
      return;
    }
    const isCorrect = question.kind === "choice"
      ? sameAnswers(record.selected, question.correctOptions)
      : null;
    state.answers[question.id] = {
      ...record,
      submitted: true,
      isCorrect,
      at: new Date().toISOString(),
    };
    if (isCorrect === false) state.wrongBook[question.id] = true;
    if (isCorrect === true && state.mode === "wrong") delete state.wrongBook[question.id];
    save();
    render();
  }

  function move(offset) {
    const list = filtered();
    if (!list.length) return;
    state.index = Math.max(0, Math.min(list.length - 1, state.index + offset));
    save();
    render();
    if (window.innerWidth <= 840) quiz.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  mode.onchange = () => {
    state.mode = mode.value;
    state.index = 0;
    if (state.mode === "wrong") {
      state.wrongSession = Object.keys(state.wrongBook).filter((id) => state.wrongBook[id]).map(Number);
      state.wrongSession.forEach((id) => { delete state.answers[id]; });
      toast(state.wrongSession.length ? "错题答案已清空，请重新作答" : "目前还没有错题");
    } else {
      state.wrongSession = [];
    }
    save();
    render();
  };

  category.onchange = () => {
    state.category = category.value;
    state.index = 0;
    save();
    render();
  };

  $("#shuffleBtn").onclick = () => {
    const order = QUESTIONS.map((q) => q.id);
    for (let index = order.length - 1; index > 0; index -= 1) {
      const random = Math.floor(Math.random() * (index + 1));
      [order[index], order[random]] = [order[random], order[index]];
    }
    state.order = order;
    state.index = 0;
    save();
    render();
    toast("已随机打乱题目");
  };

  $("#resetOrderBtn").onclick = () => {
    state.order = QUESTIONS.map((q) => q.id);
    state.index = 0;
    save();
    render();
    toast("已恢复文档顺序");
  };

  $("#timerToggle").onclick = () => {
    if (state.timerRunning) {
      syncTimer();
      state.timerRunning = false;
    } else {
      state.timerRunning = true;
      state.lastTick = Date.now();
    }
    $("#timerToggle").textContent = state.timerRunning ? "暂停" : "继续";
    save();
  };

  $("#timerReset").onclick = () => {
    if (!confirm("重置本次计时？")) return;
    state.elapsed = 0;
    state.lastTick = Date.now();
    save();
  };
  $("#timerToggle").textContent = state.timerRunning ? "暂停" : "继续";

  $("#saveExit").onclick = () => {
    syncTimer();
    save();
    pushCloud();
    toast("进度已保存，可以放心退出");
  };

  $("#exportBtn").onclick = () => {
    syncTimer();
    save();
    const blob = new Blob([JSON.stringify({ version: 2, exportedAt: new Date().toISOString(), state }, null, 2)], { type: "application/json" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "逻辑推理刷题存档_" + new Date().toISOString().slice(0, 10) + ".json";
    link.click();
    URL.revokeObjectURL(link.href);
  };

  $("#importBtn").onclick = () => $("#importFile").click();
  $("#importFile").onchange = async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    try {
      const object = JSON.parse(await file.text());
      state = normalizeState(object.state || object);
      save();
      mode.value = state.mode;
      category.value = categories.includes(state.category) ? state.category : "ALL";
      state.category = category.value;
      $("#syncCode").value = state.syncCode || "";
      render();
      toast("存档导入成功");
    } catch (_) {
      alert("存档格式无法识别");
    }
    event.target.value = "";
  };

  $("#clearBtn").onclick = () => {
    if (!confirm("确定清空所有作答、错题、收藏和计时吗？此操作不可撤销。")) return;
    const syncCode = state.syncCode;
    state = normalizeState({ ...defaults, syncCode, order: QUESTIONS.map((q) => q.id) });
    mode.value = "all";
    category.value = "ALL";
    save();
    render();
  };

  const syncInput = $("#syncCode");
  syncInput.value = state.syncCode || "";
  $("#syncBtn").onclick = async () => {
    const code = cleanSyncCode(syncInput.value);
    if (code.length < 8) {
      toast("请设置至少8位同步码");
      return;
    }
    state.syncCode = code;
    localStorage.setItem(STORE_KEY, JSON.stringify(state));
    const restored = await pullCloud(true);
    render();
    if (!restored) save();
  };
  syncInput.onchange = () => { syncInput.value = cleanSyncCode(syncInput.value); };

  window.addEventListener("beforeunload", () => {
    syncTimer();
    localStorage.setItem(STORE_KEY, JSON.stringify(state));
  });

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      syncTimer();
      save();
      pushCloud();
    } else {
      if (state.timerRunning) state.lastTick = Date.now();
      if (cleanSyncCode(state.syncCode).length >= 8) pullCloud(false).then(() => render());
    }
  });

  document.addEventListener("keydown", (event) => {
    if (["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement.tagName)) return;
    const list = filtered();
    const question = list[state.index];
    if (!question) return;
    const record = { ...newRecord(), ...(state.answers[question.id] || {}) };
    if (["1", "2", "3", "4"].includes(event.key) && question.kind === "choice" && !record.submitted) {
      const option = "ABCD"[Number(event.key) - 1];
      state.answers[question.id] = { ...record, selected: [option] };
      save();
      render();
    } else if (event.key === "Enter" && !record.submitted) {
      submitCurrent();
    } else if (event.key === "ArrowRight") {
      move(1);
    } else if (event.key === "ArrowLeft") {
      move(-1);
    } else if (event.key.toLowerCase() === "f") {
      state.favorites[question.id] = !state.favorites[question.id];
      save();
      render();
    }
  });

  localStorage.setItem(STORE_KEY, JSON.stringify(state));
  render();
  if (cleanSyncCode(state.syncCode).length >= 8) pullCloud(false).then(() => render());
})();
