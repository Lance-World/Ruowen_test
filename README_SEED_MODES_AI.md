# A7-13 Seed Modes + Local AI

## Seed 模式

1. `Tag 橫向橋接`：使用本地 node metadata / tags / category，找可橫向呼應的既有 Concept / Term。
2. `鄰近概念`：使用 graph edges，推薦目前 Concept 附近的既有 Concept / Topic。
3. `詞彙聯想`：使用既有 Term / aliases / neighbor terms，讓詞彙與知識網絡呼應。
4. `AI 腦洞提問`：右側 🤖 icon 可直接啟動 Mode 4。優先呼叫本機 Ollama；失敗時 fallback 到本地保守模板。

## UI 行為

- Seed input 左側 🌱：依目前選取的 Seed mode 產生結果。
- Seed input 右側 🤖：直接切到 Mode 4 並產生 AI 腦洞提問。
- 右側 ×：只有有輸入文字時才出現。
- Seed result 共用 Info Panel 的「相關詞彙 / 相關句子 / 相關出處」。
- Seed 不新增主圖節點，也不改 graph data；只高亮目前可見的既有 Topic / Concept / Term。

## Local AI：Ollama

預設設定在 `app.js`：

```js
const SEED_AI_CONFIG = {
  localOllamaEnabled: true,
  localOllamaEndpoint: "http://127.0.0.1:11434/api/generate",
  localOllamaModel: "qwen2.5:3b",
  backendEnabled: false,
  backendEndpoint: "./api/seed-idea",
  timeoutMs: 12000,
  fallbackToLocal: true,
};
```

建議測試：

```powershell
ollama pull qwen2.5:3b
ollama run qwen2.5:3b
```

若本機網站使用 `http://localhost:8000`，遇到 CORS 可設定：

```powershell
setx OLLAMA_ORIGINS "http://localhost:8000,http://127.0.0.1:8000"
```

然後重啟 Ollama。

## 資安與侵權邊界

送給 AI 的內容只應包含：selected node 名稱、少量 tags、少量 related terms、少量 topic/concept/term 名稱。

不要送：完整逐字稿、完整書籍段落、私人路徑、API key、cookie、token。

Info Panel 的 source 區固定提示：

> 以下為探索性推演，不代表原始書籍或影音的直接結論。
