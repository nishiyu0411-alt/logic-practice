"use client";

import { CSSProperties, useEffect, useMemo, useState } from "react";
import { LogicQuestion, questions } from "./questions";

type AnswerRecord = {
  selected: string[];
  openText: string;
  submitted: boolean;
  isCorrect: boolean | null;
};

type PracticeMode = "all" | "wrong" | "starred" | "random";

type ProgressState = {
  currentId: number;
  answers: Record<number, AnswerRecord>;
  starred: number[];
  mode: PracticeMode;
  randomIds: number[];
};

const STORAGE_KEY = "logic-practice-progress-v1";

const initialProgress: ProgressState = {
  currentId: 1,
  answers: {},
  starred: [],
  mode: "all",
  randomIds: [],
};

const emptyRecord: AnswerRecord = {
  selected: [],
  openText: "",
  submitted: false,
  isCorrect: null,
};

const modeNames: Record<PracticeMode, string> = {
  all: "顺序刷题",
  wrong: "错题重练",
  starred: "我的收藏",
  random: "随机 10 题",
};

function shortSource(source: string) {
  if (source.startsWith("第一部分")) return "主文档";
  if (source.startsWith("第二部分")) return "综合补充";
  return "2025 年新增";
}

function sameAnswers(a: string[], b: string[]) {
  return [...a].sort().join("") === [...b].sort().join("");
}

function shuffledTen() {
  return [...questions]
    .sort(() => Math.random() - 0.5)
    .slice(0, 10)
    .map((question) => question.id);
}

export default function Home() {
  const [progress, setProgress] = useState<ProgressState>(initialProgress);
  const [ready, setReady] = useState(false);
  const [view, setView] = useState<"home" | "practice">("home");
  const [navigatorOpen, setNavigatorOpen] = useState(false);
  const [toast, setToast] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const saved = window.localStorage.getItem(STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved) as Partial<ProgressState>;
          setProgress({
            ...initialProgress,
            ...parsed,
            answers: parsed.answers ?? {},
            starred: parsed.starred ?? [],
            randomIds: parsed.randomIds ?? [],
          });
        }
      } catch {
        // A damaged local save should never prevent the question bank from opening.
      } finally {
        setReady(true);
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!ready) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
  }, [progress, ready]);

  const notify = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 1800);
  };

  const submittedQuestions = questions.filter(
    (question) => progress.answers[question.id]?.submitted,
  );
  const completed = submittedQuestions.length;
  const correct = submittedQuestions.filter(
    (question) => progress.answers[question.id]?.isCorrect === true,
  ).length;
  const wrong = submittedQuestions.filter(
    (question) => progress.answers[question.id]?.isCorrect === false,
  ).length;
  const judged = correct + wrong;
  const accuracy = judged ? Math.round((correct / judged) * 100) : 0;
  const overallPercent = Math.round((completed / questions.length) * 100);

  const activeQuestions = useMemo(() => {
    if (progress.mode === "wrong") {
      return questions.filter(
        (question) => progress.answers[question.id]?.isCorrect === false,
      );
    }
    if (progress.mode === "starred") {
      return questions.filter((question) =>
        progress.starred.includes(question.id),
      );
    }
    if (progress.mode === "random") {
      return progress.randomIds
        .map((id) => questions.find((question) => question.id === id))
        .filter((question): question is LogicQuestion => Boolean(question));
    }
    return questions;
  }, [progress.mode, progress.answers, progress.starred, progress.randomIds]);

  const currentQuestion =
    activeQuestions.find((question) => question.id === progress.currentId) ??
    activeQuestions[0];
  const activeIndex = currentQuestion
    ? activeQuestions.findIndex((question) => question.id === currentQuestion.id)
    : 0;
  const record = currentQuestion
    ? progress.answers[currentQuestion.id] ?? emptyRecord
    : emptyRecord;

  const startMode = (mode: PracticeMode) => {
    let candidateIds: number[];
    let randomIds = progress.randomIds;
    if (mode === "wrong") {
      candidateIds = questions
        .filter((question) => progress.answers[question.id]?.isCorrect === false)
        .map((question) => question.id);
    } else if (mode === "starred") {
      candidateIds = [...progress.starred];
    } else if (mode === "random") {
      randomIds = shuffledTen();
      candidateIds = randomIds;
    } else {
      candidateIds = questions.map((question) => question.id);
    }
    if (!candidateIds.length) {
      notify(mode === "wrong" ? "目前还没有错题哦" : "还没有收藏题目哦");
      return;
    }
    const currentId = candidateIds.includes(progress.currentId)
      ? progress.currentId
      : candidateIds[0];
    setProgress((previous) => ({
      ...previous,
      mode,
      randomIds,
      currentId,
    }));
    setView("practice");
  };

  const updateRecord = (patch: Partial<AnswerRecord>) => {
    if (!currentQuestion) return;
    setProgress((previous) => ({
      ...previous,
      answers: {
        ...previous.answers,
        [currentQuestion.id]: {
          ...(previous.answers[currentQuestion.id] ?? emptyRecord),
          ...patch,
        },
      },
    }));
  };

  const chooseOption = (label: string) => {
    if (!currentQuestion || record.submitted) return;
    const isMultiple = currentQuestion.correctOptions.length > 1;
    const selected = isMultiple
      ? record.selected.includes(label)
        ? record.selected.filter((item) => item !== label)
        : [...record.selected, label]
      : [label];
    updateRecord({ selected });
  };

  const submitAnswer = () => {
    if (!currentQuestion) return;
    if (currentQuestion.kind === "choice" && !record.selected.length) {
      notify("先选择一个答案吧");
      return;
    }
    if (currentQuestion.kind === "open" && !record.openText.trim()) {
      notify("先写下你的答案吧");
      return;
    }
    const isCorrect =
      currentQuestion.kind === "choice"
        ? sameAnswers(record.selected, currentQuestion.correctOptions)
        : null;
    updateRecord({ submitted: true, isCorrect });
  };

  const retryQuestion = () => {
    updateRecord({
      selected: [],
      openText: "",
      submitted: false,
      isCorrect: null,
    });
  };

  const goToQuestion = (questionId: number) => {
    setProgress((previous) => ({ ...previous, currentId: questionId }));
    setNavigatorOpen(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const goRelative = (offset: number) => {
    const next = activeQuestions[activeIndex + offset];
    if (next) goToQuestion(next.id);
  };

  const toggleStar = () => {
    if (!currentQuestion) return;
    setProgress((previous) => ({
      ...previous,
      starred: previous.starred.includes(currentQuestion.id)
        ? previous.starred.filter((id) => id !== currentQuestion.id)
        : [...previous.starred, currentQuestion.id],
    }));
  };

  const saveAndExit = () => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
    setView("home");
    setNavigatorOpen(false);
    notify("进度已保存，可以放心退出啦");
  };

  const resetProgress = () => {
    if (!window.confirm("确定要清空全部答题进度、错题和收藏吗？")) return;
    setProgress(initialProgress);
    window.localStorage.removeItem(STORAGE_KEY);
    notify("已清空全部进度");
  };

  if (!ready) {
    return (
      <main className="loading-screen">
        <div className="loading-bubble">正在打开题库…</div>
      </main>
    );
  }

  if (view === "home") {
    return (
      <main className="app-bg">
        <div className="home-shell">
          <header className="home-header">
            <div className="brand-lockup">
              <span className="brand-mark" aria-hidden="true">✦</span>
              <div>
                <p className="eyebrow">LOGIC PRACTICE</p>
                <h1>逻辑充电站</h1>
              </div>
            </div>
            <span className="save-status"><i /> 进度自动保存在本机</span>
          </header>

          <section className="welcome-card">
            <div className="welcome-copy">
              <span className="soft-label">粉蓝专属题库 · 共 {questions.length} 题</span>
              <h2>{completed ? "接着上次，继续变厉害吧" : "每天刷一点，逻辑更清晰"}</h2>
              <p>
                题目来自《逻辑推理题汇总》。每题提交后都会立即显示标准答案和完整解析，答错也不用怕。
              </p>
              <div className="hero-actions">
                <button className="primary-button" onClick={() => startMode("all")}>
                  {completed ? "继续上次进度" : "开始刷题"}
                  <span aria-hidden="true">→</span>
                </button>
                <button className="ghost-button" onClick={() => startMode("random")}>随机练 10 题</button>
              </div>
            </div>
            <div className="progress-hero">
              <div
                className="progress-ring large"
                style={{ "--progress": `${overallPercent * 3.6}deg` } as CSSProperties}
              >
                <div><strong>{overallPercent}%</strong><span>总进度</span></div>
              </div>
              <div className="mini-cloud cloud-one" aria-hidden="true" />
              <div className="mini-cloud cloud-two" aria-hidden="true" />
            </div>
          </section>

          <section className="stats-grid" aria-label="学习统计">
            <article className="stat-card blue">
              <span className="stat-icon">✓</span>
              <div><strong>{completed}</strong><span>已完成</span></div>
              <small>/ {questions.length} 题</small>
            </article>
            <article className="stat-card pink">
              <span className="stat-icon">◎</span>
              <div><strong>{accuracy}%</strong><span>选择题正确率</span></div>
              <small>{judged ? `${correct} 对 · ${wrong} 错` : "完成后显示"}</small>
            </article>
            <article className="stat-card lilac">
              <span className="stat-icon">☆</span>
              <div><strong>{progress.starred.length}</strong><span>已收藏</span></div>
              <small>重点反复看</small>
            </article>
          </section>

          <section className="mode-section">
            <div className="section-heading">
              <div><p className="eyebrow">PRACTICE MODE</p><h2>选择刷题方式</h2></div>
              {completed > 0 && <button className="text-button danger" onClick={resetProgress}>清空全部进度</button>}
            </div>
            <div className="mode-grid">
              <button className="mode-card" onClick={() => startMode("all")}>
                <span className="mode-art book" aria-hidden="true">01</span>
                <div><strong>顺序刷题</strong><p>按照文档顺序完成全部 {questions.length} 题</p></div><b aria-hidden="true">→</b>
              </button>
              <button className="mode-card" onClick={() => startMode("wrong")}>
                <span className="mode-art wrong" aria-hidden="true">!</span>
                <div><strong>错题重练</strong><p>{wrong ? `还有 ${wrong} 道错题等你攻克` : "答错的题会自动收进这里"}</p></div><b aria-hidden="true">→</b>
              </button>
              <button className="mode-card" onClick={() => startMode("starred")}>
                <span className="mode-art star" aria-hidden="true">★</span>
                <div><strong>我的收藏</strong><p>{progress.starred.length ? `已收藏 ${progress.starred.length} 道重点题` : "遇到重点题就点亮小星星"}</p></div><b aria-hidden="true">→</b>
              </button>
            </div>
          </section>
        </div>
        {toast && <div className="toast" role="status">{toast}</div>}
      </main>
    );
  }

  if (!currentQuestion) {
    return (
      <main className="empty-screen app-bg">
        <div className="empty-card"><span>☁</span><h1>这里暂时没有题目</h1><p>先去做几道新题或收藏重点题吧。</p><button className="primary-button" onClick={() => setView("home")}>返回首页</button></div>
      </main>
    );
  }

  const isStarred = progress.starred.includes(currentQuestion.id);
  const questionPercent = Math.round(((activeIndex + 1) / activeQuestions.length) * 100);

  return (
    <main className="app-bg practice-page">
      <header className="practice-header">
        <button className="compact-brand" onClick={saveAndExit} aria-label="保存并返回首页">
          <span className="brand-mark small">✦</span><span>逻辑充电站</span>
        </button>
        <div className="header-progress">
          <span>{modeNames[progress.mode]}</span><div className="progress-track"><i style={{ width: `${questionPercent}%` }} /></div><b>{activeIndex + 1} / {activeQuestions.length}</b>
        </div>
        <div className="header-actions">
          <button className="mobile-nav-button" onClick={() => setNavigatorOpen(true)}>题目列表</button>
          <button className="save-exit-button" onClick={saveAndExit}><i /> 保存并退出</button>
        </div>
      </header>

      <div className="practice-layout">
        <aside className="practice-sidebar">
          <div className="sidebar-progress-card">
            <div className="progress-ring" style={{ "--progress": `${overallPercent * 3.6}deg` } as CSSProperties}>
              <div><strong>{overallPercent}%</strong><span>总进度</span></div>
            </div>
            <div className="sidebar-numbers"><strong>{completed}<small> / {questions.length}</small></strong><span>题目已完成</span></div>
          </div>
          <div className="sidebar-card">
            <div className="sidebar-title"><strong>题目列表</strong><span>点击跳转</span></div>
            <QuestionGrid list={activeQuestions} currentId={currentQuestion.id} answers={progress.answers} starred={progress.starred} onSelect={goToQuestion} />
            <div className="legend"><span><i className="done" /> 已完成</span><span><i className="wrong" /> 答错</span><span><i className="current" /> 当前</span></div>
          </div>
          <div className="mode-switcher">
            <button className={progress.mode === "all" ? "active" : ""} onClick={() => startMode("all")}>全部题</button>
            <button className={progress.mode === "wrong" ? "active" : ""} onClick={() => startMode("wrong")}>错题</button>
            <button className={progress.mode === "starred" ? "active" : ""} onClick={() => startMode("starred")}>收藏</button>
          </div>
        </aside>

        <section className="question-area">
          <article className="question-card">
            <div className="question-meta">
              <div className="meta-labels">
                <span className="source-pill">{shortSource(currentQuestion.source)}</span><span>{currentQuestion.sourceNumber}</span>
                {currentQuestion.kind === "open" && <span className="open-pill">开放题</span>}
              </div>
              <button className={`star-button ${isStarred ? "active" : ""}`} onClick={toggleStar} aria-label={isStarred ? "取消收藏" : "收藏本题"}>
                {isStarred ? "★" : "☆"}<span>{isStarred ? "已收藏" : "收藏"}</span>
              </button>
            </div>
            <h1 className="question-title"><span>{activeIndex + 1}</span>{currentQuestion.prompt}</h1>

            {currentQuestion.kind === "choice" ? (
              <div className="options-list" role="group" aria-label="答案选项">
                {currentQuestion.options.map((option) => {
                  const selected = record.selected.includes(option.label);
                  const correctOption = currentQuestion.correctOptions.includes(option.label);
                  const showCorrect = record.submitted && correctOption;
                  const showWrong = record.submitted && selected && !correctOption;
                  return (
                    <button key={option.label} className={`option-button ${selected ? "selected" : ""} ${showCorrect ? "correct" : ""} ${showWrong ? "incorrect" : ""}`} onClick={() => chooseOption(option.label)} disabled={record.submitted} aria-pressed={selected}>
                      <span className="option-label">{option.label}</span><span className="option-text">{option.text}</span>
                      {showCorrect && <span className="option-result">✓</span>}{showWrong && <span className="option-result">×</span>}
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="open-answer-area">
                {currentQuestion.options.length > 0 && <div className="scan-note"><strong>原扫描件仅保留：</strong>{currentQuestion.options.map((option) => `${option.label}. ${option.text}`).join("；")}</div>}
                <label htmlFor="open-answer">先写下你的推理结果</label>
                <textarea id="open-answer" value={record.openText} onChange={(event) => updateRecord({ openText: event.target.value })} disabled={record.submitted} placeholder="在这里输入答案，提交后再和标准答案对照…" />
              </div>
            )}

            {!record.submitted ? (
              <div className="submit-row"><span>提交后会立即显示答案和解析</span><button className="submit-button" onClick={submitAnswer}>提交答案</button></div>
            ) : (
              <AnswerPanel question={currentQuestion} record={record} onRetry={retryQuestion} />
            )}
          </article>

          <nav className="question-navigation" aria-label="题目翻页">
            <button onClick={() => goRelative(-1)} disabled={activeIndex === 0}>← 上一题</button><span>本题进度已自动保存</span><button className="next-button" onClick={() => goRelative(1)} disabled={activeIndex === activeQuestions.length - 1}>下一题 →</button>
          </nav>
        </section>
      </div>

      {navigatorOpen && (
        <div className="drawer-backdrop" onClick={() => setNavigatorOpen(false)}>
          <div className="drawer" onClick={(event) => event.stopPropagation()}>
            <div className="drawer-header"><div><strong>题目列表</strong><span>{modeNames[progress.mode]}</span></div><button onClick={() => setNavigatorOpen(false)}>×</button></div>
            <QuestionGrid list={activeQuestions} currentId={currentQuestion.id} answers={progress.answers} starred={progress.starred} onSelect={goToQuestion} />
          </div>
        </div>
      )}
      {toast && <div className="toast" role="status">{toast}</div>}
    </main>
  );
}

function QuestionGrid({ list, currentId, answers, starred, onSelect }: { list: LogicQuestion[]; currentId: number; answers: Record<number, AnswerRecord>; starred: number[]; onSelect: (id: number) => void; }) {
  return (
    <div className="question-grid">
      {list.map((question, index) => {
        const answer = answers[question.id];
        const status = answer?.submitted ? answer.isCorrect === false ? "wrong" : "done" : "";
        return (
          <button key={question.id} className={`${status} ${question.id === currentId ? "current" : ""}`} onClick={() => onSelect(question.id)} aria-label={`第 ${index + 1} 题${answer?.submitted ? "，已完成" : ""}`}>
            {index + 1}{starred.includes(question.id) && <i aria-hidden="true">★</i>}
          </button>
        );
      })}
    </div>
  );
}

function AnswerPanel({ question, record, onRetry }: { question: LogicQuestion; record: AnswerRecord; onRetry: () => void; }) {
  const status = record.isCorrect === true
    ? { className: "correct", icon: "✓", title: "答对啦！思路很稳" }
    : record.isCorrect === false
      ? { className: "incorrect", icon: "×", title: "这题没选对，看看解析就会啦" }
      : { className: "compare", icon: "↔", title: "已提交，请对照标准答案" };
  return (
    <section className={`answer-panel ${status.className}`} aria-live="polite">
      <div className="answer-status"><span>{status.icon}</span><strong>{status.title}</strong><button onClick={onRetry}>重新作答</button></div>
      <div className="standard-answer"><span>标准答案</span><strong>{question.answer}</strong></div>
      <div className="analysis-box"><div className="analysis-title"><span>✦</span><strong>答案解析</strong></div><p>{question.analysis}</p></div>
    </section>
  );
}
