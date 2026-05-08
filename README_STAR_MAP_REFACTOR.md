# A7-13｜Knowledge Star Map Refactor

本版只改 `app.js` 與 `css/style.css`；`index.html` 保留不動。

## 核心變更

- Graph 改成「單一宇宙」語意，不再用 term layer / phrase layer 的 UI 概念。
- Overlay 結束後才顯示星圖。
- 進場順序：中心星塵 → Topic 錨定 → Concept 浮現 → Edges 淡入。
- 初始可見節點：Topic + Concept，Concept 上限 250。
- Term / Sentence / Source / Tag 不在初始主圖顯示。
- 點擊 Concept 後，最多 20 個 Terms 以小衛星方式圍繞該 Concept。
- Home 回到 Universe，全數收回 Terms。
- Center 只移動目前 selected node 到視窗中心。
- Fit 只 fit 目前可見節點。
- Clear 取消 focus 並收回 Terms，但不強制 fit。
- Tag 只做橫向高亮，不新增大量節點。
- Seed 只改 Info Panel / highlight，不改正式 graph data。

## 覆蓋方式

請將以下兩個檔案覆蓋到你的前端資料夾：

```text
app.js
css/style.css
```

`index.html` 不需要覆蓋，除非你想保持同一包內版本一致。
