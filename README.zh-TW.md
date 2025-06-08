# HTTPS Over Proxy 節點 (適用於 n8n)

這個節點解決了 n8n 內建 HTTP Request 節點的關鍵限制：**無法透過 HTTP 代理存取 HTTPS 網站**。

## 問題描述

n8n 標準的 HTTP Request 節點在嘗試透過 HTTP 代理存取 HTTPS 網站時會失敗，這在有防火牆限制的企業環境中是常見需求。

## 解決方案

HTTPS Over Proxy 節點提供專業的代理處理功能，同時保持與 n8n 工作流程生態系統的相容性。

## 獨特功能 (內建 HTTP Request 節點沒有的功能)

### 🌍 進階代理支援
- **HTTPS over HTTP Proxy**: 解決主要限制的核心功能
- **代理認證**: 完整的代理伺服器用戶名/密碼認證
- **連線池管理**: 專門的代理連線池，提供最佳效能
- **代理錯誤診斷**: 詳細的代理專用錯誤訊息和故障排除指南

### 🔧 增強的連線管理
- **自訂連線池**: HTTP/HTTPS/代理代理程式管理，可配置設定：
  - `maxSockets`: 每個主機的最大並發連線數 (預設: 50)
  - `maxFreeSockets`: 每個主機的最大閒置連線數 (預設: 10)
  - `keepAlive`: 連線重用優化
  - `timeout`: 每個連線的超時控制
- **代理程式清理**: 自動清理未使用的連線代理程式

### 🛠️ 進階錯誤處理與診斷
- **代理專用錯誤訊息**: 詳細的代理連線問題錯誤報告
- **故障排除建議**: 內建常見代理問題的指導
- **連線狀態除錯**: 詳細的連線池狀態記錄
- **智能錯誤分類**: 區分代理、網路和應用程式錯誤

### 📊 增強的回應處理
- **HTML 內容提取**: 使用 CSS 選擇器進行進階 HTML 解析
- **Mozilla Readability 整合**: 從網頁中清理文章提取
- **JSDOM 處理**: 完整的 DOM 操作功能
- **文字內容優化**: 智能文字提取和格式化

### 🔍 開發與除錯功能
- **全面記錄**: 詳細的請求/回應記錄，用於除錯
- **cURL 命令解析**: 支援代理設定的進階 cURL 匯入
- **請求狀態追蹤**: 監控連線狀態和效能指標
- **代理配置驗證**: 自動驗證代理設定

## 安裝

```bash
npm install n8n-nodes-httpsoverproxy
```

## 基本代理配置

1. 將 HTTPS Over Proxy 節點加入您的工作流程
2. 設定目標 HTTPS URL
3. 在選項 → 代理設定中：
   - 啟用「使用代理」
   - 輸入代理主機 (例如：`proxy.company.com`)
   - 輸入代理埠 (例如：`8080`)
   - 如需要，加入代理認證

## 進階配置

### 連線池優化
```javascript
// 在選項 → 連線池中配置
{
  "keepAlive": true,
  "maxSockets": 100,        // 高吞吐量情境下增加
  "maxFreeSockets": 20,     // 增加以提高連線重用
  "timeout": 30000          // 30 秒超時
}
```

### 代理認證
```javascript
// 自動代理認證處理
{
  "proxyHost": "proxy.company.com",
  "proxyPort": 8080,
  "proxyUsername": "user",
  "proxyPassword": "pass"
}
```

## 何時使用此節點

### ✅ 使用 HTTPS Over Proxy 的情況：
- 需要透過 HTTP 代理存取 HTTPS 網站
- 在有代理需求的企業環境中工作
- 需要進階連線池管理
- 需要詳細的代理錯誤診斷
- 透過代理處理大量請求

### ❌ 使用內建 HTTP Request 的情況：
- 直接網路存取 (不需要代理)
- 簡單的 HTTP/HTTPS 請求
- 優先考慮最大 n8n 相容性
- 偏好最少依賴

## 常見代理問題故障排除

### 連線被拒絕
- 驗證代理伺服器正在運行
- 檢查代理主機和埠配置
- 確保代理允許 HTTPS 隧道

### 認證失敗
- 驗證代理用戶名/密碼
- 檢查代理是否需要網域認證
- 在 n8n 外測試代理認證

### SSL 憑證錯誤
- 啟用「允許未授權憑證」進行測試
- 驗證目標網站 SSL 配置
- 檢查代理是否修改 SSL 憑證

## 效能優化

### 高流量請求
```javascript
{
  "batchSize": 10,           // 同時處理 10 個請求
  "batchInterval": 100,      // 批次間隔 100 毫秒
  "connectionPool": {
    "maxSockets": 200,       // 增加連線限制
    "keepAlive": true        // 重用連線
  }
}
```

### 企業環境
```javascript
{
  "timeout": 60000,          // 慢速網路的較長超時
  "allowUnauthorizedCerts": false,  // 嚴格 SSL 驗證
  "allowInternalNetworkAccess": false  // 安全限制
}
```

## 授權

[MIT](LICENSE) 