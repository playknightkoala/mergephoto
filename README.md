# 合併相片 — A4 列印拼貼與證件照工具

一個純前端（無後端、無上傳）的瀏覽器工具，提供兩大功能：

1. **拼貼 A4**：把多張照片自由排版在 A4 畫布上，匯出成可直接列印的 PDF。
2. **證件照**：依台灣證件照規格裁切，自動排版到 4×6 相紙上，匯出 JPG / PNG。

所有影像處理都在瀏覽器本機透過 Canvas 完成，照片不會離開使用者的電腦。

---

## 功能特色

### 拼貼 A4 模式
- **多檔上傳 + 逐張裁切**：上傳後逐一進入裁切視窗，可裁切、跳過裁切（原圖匯入）、丟棄或一次匯入剩餘全部。
- **多張 A4 畫布**：可同時建立多張直式 / 橫式 A4 畫布，每張即為 PDF 的一頁。
- **自由排版**：以 [Konva](https://konvajs.org/) 拖曳、縮放、旋轉照片；新照片會自動縮放置中並錯位堆疊。
- **圖層順序**：可將照片移到最上 / 最下 / 上一層 / 下一層。
- **浮水印**：對單張或全部素材套用平鋪、可旋轉的文字浮水印（文字、字級、間距、透明度、角度、顏色可調），可移除還原。
- **匯出色調調整**：匯出時可微調亮度 / 對比 / 飽和度，預設略為提亮以補償 iPhone P3 照片經 Canvas → JPEG 後偏暗的問題。
- **復原 / 重做**：支援 `Ctrl/Cmd+Z`、`Ctrl/Cmd+Shift+Z`（或 `Ctrl+Y`）。
- **匯出 PDF**：每張畫布以 `pixelRatio=4`（約 300 DPI）轉出，輸出多頁 A4 PDF。

### 證件照模式
- **台灣規格**：內建 1吋（2.8×3.5 cm）、2吋大頭照（3.5×4.5 cm）、2吋大（4.2×4.7 cm）三種尺寸，並標示各自用途。
- **臉部參考線**：2吋大頭照提供頭頂 / 下顎參考帶，協助符合「頭頂到下顎 3.2–3.6 cm、臉部佔 70–80%」的規定。
- **自動排版**：依所選尺寸計算 4×6 相紙（10.16×15.24 cm，300 DPI = 1800×1200 px）能放最多張的格狀排列，並嘗試旋轉照片 90° 以塞入更多張。
- **多種照片混排**：加入多張不同照片時，自動將格子平均分配（例：2 種放 8 格 → 4+4；3 種 → 3+3+2）。
- **裁切線**：可切換是否在相紙上顯示裁切輔助線。
- **匯出**：輸出 JPG 或 PNG。

---

## 技術架構

- **框架**：React 18 + [Vite](https://vitejs.dev/)
- **畫布 / 影像**：[Konva](https://konvajs.org/) + react-konva、[react-image-crop](https://github.com/DominicTobias/react-image-crop)、use-image
- **PDF**：[jsPDF](https://github.com/parallax/jsPDF)
- **部署**：多階段 Dockerfile（Node 建置 → Nginx 提供靜態檔）

### 專案結構

```
src/
├── main.jsx                  進入點
├── App.jsx                   模式切換（拼貼 A4 / 證件照）
├── CollageApp.jsx            拼貼模式主畫面與狀態管理
├── styles.css
├── components/
│   ├── UploadZone.jsx        拖放 / 選檔上傳
│   ├── WorkList.jsx          素材清單（拼貼模式）
│   ├── CropModal.jsx         自由裁切視窗
│   ├── WatermarkModal.jsx    浮水印設定
│   ├── ExportSettingsModal.jsx  匯出色調設定
│   ├── CanvasBoard.jsx       多張 A4 畫布容器
│   ├── A4Canvas.jsx          單張 A4 Konva 畫布
│   ├── CanvasImage.jsx       畫布上單張可操作照片
│   ├── LayerPanel.jsx        圖層順序操作
│   ├── IdPhotoStudio.jsx     證件照模式主畫面
│   ├── IdPhotoCropModal.jsx  證件照固定比例裁切（含臉部參考線）
│   └── IdPhotoSheet.jsx      4×6 相紙預覽
└── lib/
    ├── useUndoableState.js   復原 / 重做的狀態 hook
    ├── canvasDimensions.js   A4 尺寸（pt → px）
    ├── snapping.js           畫布吸附輔助
    ├── imageAdjustments.js   亮度 / 對比 / 飽和度處理
    ├── watermark.js          平鋪文字浮水印渲染
    ├── exportPdf.js          Konva → 多頁 A4 PDF
    ├── idPhotoSpecs.js       台灣證件照規格與臉部參考線
    ├── idPhotoLayout.js      4×6 相紙排版計算
    ├── composeSheet.js       合成證件照相紙影像
    └── download.js           觸發檔案下載
```

---

## 開始使用

### 需求
- Node.js 20+

### 本機開發

```bash
npm install
npm run dev
```

預設於 `http://localhost:5173` 啟動。

### 建置與預覽

```bash
npm run build     # 輸出到 dist/
npm run preview   # 本機預覽建置結果
```

### 以 Docker 部署

```bash
docker compose up -d --build
```

啟動後於 `http://localhost:8080` 取用（Nginx 提供靜態檔，已開啟 gzip 與靜態資源快取）。

---

## 使用說明

### 拼貼 A4
1. 在左側上傳一張或多張照片，於裁切視窗逐張裁切或跳過。
2. 點「+ 新增畫布」建立 A4 頁面（直式或橫式）。
3. 從素材清單點選照片加入目前選取的畫布，或直接拖放到畫布上。
4. 在畫布上拖曳、縮放、旋轉、調整圖層；需要時為素材加上浮水印。
5. （選用）開啟「輸出設定」微調亮度 / 對比 / 飽和度。
6. 按「匯出 PDF」下載多頁 A4 檔案。

### 證件照
1. 選擇證件照尺寸（切換尺寸會清除已加入的照片，因裁切比例不同）。
2. 上傳照片，於裁切視窗依規格比例裁切（2吋大頭照會顯示臉部參考線）。
3. 加入多張不同照片時，系統自動平均分配到相紙格子；可勾選是否顯示裁切線。
4. 按「匯出 JPG」或「匯出 PNG」下載 4×6 相紙。

---

## 隱私

所有照片皆在瀏覽器本機處理，**不會上傳到任何伺服器**。
