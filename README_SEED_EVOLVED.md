# A7-13 Seed 2.0｜Context / Contrast / Path / AI

本版把 Seed 從 Link / Extend / Associate / AI 升級為：

1. Context｜脈絡：找出問題背後的相關概念群。
2. Contrast｜對照：找出概念之間的張力與矛盾。
3. Path｜路徑：建立從問題到核心概念的推理鏈。
4. AI｜AI：產生可討論的新問題，優先本機 Ollama，失敗時 fallback 到本地規則。

Seed 結果固定顯示在 Info Panel：

- Idea｜使用者問題
- 模式
- 找到的卡片
- 推理
- 可以討論
- Source / 提示

安全邊界：

- Seed 不新增 graph node。
- Seed 不改 graph_edges / graph_cards。
- AI mode 不宣稱代表原始書籍或影音直接結論。
- 不送完整逐字稿、私人路徑、API key、cookie 或 token。
