# HttpsOverProxy 測試套件

這個目錄包含了 HttpsOverProxy 節點的完整測試套件。

## 測試結構

```
tests/
├── README.md                    # 本文檔
├── setup.ts                     # Jest 測試設置
└── __tests__/
    └── nodes/
        └── HttpsOverProxy/
            ├── integration.test.ts         # 整合測試
            ├── utils.test.ts              # 工具函數測試
            ├── batch.test.ts              # 批次處理測試
            ├── node-reference.test.ts     # 節點引用功能測試
            ├── interval-expression.test.ts # 動態請求間隔測試
            └── max-pages-expression.test.ts # Max Pages 表達式測試
```

## 測試類別

### 1. 整合測試 (integration.test.ts)
測試節點的核心 HTTP 請求功能，包括：
- 基本 HTTP 請求
- 代理設置
- 錯誤處理
- 超時處理

### 2. 工具函數測試 (utils.test.ts)
測試輔助函數，包括：
- 參數處理
- URL 解析
- 數據轉換

### 3. 批次處理測試 (batch.test.ts)
測試批次請求功能，包括：
- 批次大小控制
- 批次間隔
- 結果聚合

### 4. 節點引用功能測試 (node-reference.test.ts)
測試 `$response` 變數和節點引用功能，包括：
- `$response` 變數支援
- `$pageCount` 變數支援
- 節點引用表達式：`$('節點名').item.json.屬性`
- 組合表達式和數學運算
- 分頁場景應用

### 5. 動態請求間隔測試 (interval-expression.test.ts) ⭐ 新增
測試動態請求間隔功能，包括：
- 隨機間隔表達式：`{{ Math.floor(Math.random() * 4501) + 10000 }}`
- 基於頁數的動態間隔：`{{ $pageCount * 1000 + 5000 }}`
- 複雜計算表達式：`{{ ($pageCount + 1) * 2000 }}`
- 固定數值間隔：`3000`
- 字串數字間隔：`"2500"`
- 間隔時間轉換邏輯
- 錯誤處理和性能測試

### 6. Max Pages 表達式測試 (max-pages-expression.test.ts) ⭐ 新增
測試 Max Pages 表達式評估功能，包括：
- 基於回應總數：`{{ $response.body.parseJson().totalsize }}`
- 總數減去固定值：`{{ $response.body.parseJson().totalsize - 1516 }}`
- 複雜計算：`{{ Math.ceil($response.body.parseJson().totalsize / 50) }}`
- 條件判斷：`{{ Math.max($response.body.parseJson().totalsize / 100, 5) }}`
- 組合 $pageCount 和 $response：`{{ $response.body.parseJson().totalPages - $pageCount }}`
- 固定數值和字串數字處理
- 錯誤處理和性能測試

## 運行測試

### 運行所有測試
```bash
npm test
```

### 運行特定測試套件
```bash
# 節點引用功能測試
npm run test:node-reference

# 動態請求間隔測試
npm run test:interval-expression

# Max Pages 表達式測試
npm run test:max-pages-expression

# 整合測試
npm test -- integration.test.ts

# 工具函數測試
npm test -- utils.test.ts

# 批次處理測試
npm test -- batch.test.ts
```

### 監視模式
```bash
npm run test:watch
```

### 測試覆蓋率
```bash
npm run test:coverage
```

## 測試重點功能

### $response 變數支援
- `$response.statusCode` - HTTP 狀態碼
- `$response.headers` - 回應標頭
- `$response.body` - 回應體內容
- `$response.body.parseJson()` - 解析 JSON 回應

### $pageCount 變數支援
- 從 0 開始計數（與 n8n 原生行為一致）
- 支援數學運算：`$pageCount * 1000 + 5000`
- 支援條件判斷：`$pageCount < 3 ? 2000 : 5000`

### 節點引用功能
- 基本引用：`$('變數').item.json.pageNum`
- 組合表達式：`$pageCount * $('變數').item.json.pageNum`
- 條件判斷：`$pageCount >= $('變數').item.json.maxPages`

### 動態請求間隔
- 隨機間隔：`{{ Math.floor(Math.random() * 4501) + 10000 }}`
- 動態計算：`{{ $pageCount * 1000 + 5000 }}`
- 複雜邏輯：`{{ Math.max($pageCount * 500, 1000) }}`
- 條件間隔：`{{ $pageCount < 3 ? 2000 : 5000 }}`

## 測試數據

### 測試覆蓋的場景
1. **基本功能測試**
   - HTTP 方法：GET, POST, PUT, DELETE
   - 查詢參數和請求體
   - 標頭設置

2. **代理功能測試**
   - HTTP 代理設置
   - 代理認證
   - 代理錯誤處理

3. **分頁功能測試**
   - 參數更新模式
   - 下一個 URL 模式
   - 完成條件判斷

4. **表達式評估測試**
   - 簡單表達式
   - 複雜數學運算
   - 條件邏輯
   - 節點引用

5. **錯誤處理測試**
   - 網路錯誤
   - 超時錯誤
   - 表達式錯誤
   - 代理錯誤

## 測試最佳實踐

1. **模擬外部依賴**
   - 使用 Jest mocks 模擬 HTTP 請求
   - 模擬 n8n 執行環境

2. **測試隔離**
   - 每個測試獨立運行
   - 清理測試狀態

3. **邊界條件測試**
   - 空值處理
   - 極值測試
   - 錯誤條件

4. **性能測試**
   - 大量數據處理
   - 並發請求
   - 記憶體使用

## 持續整合

測試會在以下情況自動運行：
- 每次 commit 前（pre-commit hook）
- 每次 push 到 repository
- 發布前（prepublishOnly script）

## 貢獻指南

添加新測試時請遵循：
1. 使用描述性的測試名稱
2. 包含正面和負面測試案例
3. 添加適當的註解
4. 更新本 README 文檔 