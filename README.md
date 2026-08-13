# Logic Practice

粉蓝色逻辑推理刷题 App，共收录 170 道题。

## 功能

- 提交答案后，无论对错都显示标准答案和解析
- 页面排版与 `word` 刷题网站保持一致，保留粉蓝主题
- 本机自动保存；输入同步码后，手机与电脑共享进度
- 错题回练会清空上一次答案，以空白状态重新作答
- 支持未做题、错题、收藏、题库分区和随机顺序筛选
- 带计时器、题号导航、存档导入与导出
- 同时支持选择题和开放作答题
- 适配电脑和手机

## 跨设备同步

在电脑和手机上输入同一个至少 8 位的同步码并点击“同步”。逻辑题进度
会单独保存，不会覆盖 `word` 网站中使用相同同步码保存的进度。

## 在线使用

- GitHub Pages：<https://nishiyu0411-alt.github.io/logic-practice/>
- 备用网址：<https://logical-practice.nishiyu0411.chatgpt.site>

## 开启 GitHub Pages

1. 进入仓库的 `Settings`。
2. 点击左侧的 `Pages`。
3. 在 `Build and deployment` 下选择 `Deploy from a branch`。
4. Branch 选择 `main`，文件夹选择 `/(root)`。
5. 点击 `Save`，等待几分钟即可打开 GitHub Pages 地址。

GitHub Pages 使用仓库根目录的 `index.html`、`github-pages-app.js`、
`github-pages-questions.js` 和 `github-pages-styles.css`。`app/` 中保留了
原始 Vinext/React 版本源码。
