# HTTPS Over Proxy 節點 (適用於 n8n)

這個節點允許您在 n8n 工作流程中通過 HTTP 代理發送 HTTPS 請求。

## 功能特點

- 通過 HTTP 代理發送 HTTPS 請求
- 支援代理伺服器認證
- 可配置的超時設定
- 可選擇忽略 SSL 憑證驗證問題
- 支援各種請求方法 (GET, POST, PUT, DELETE 等)
- 支援查詢參數、標頭和主體資料
- 批次處理功能
- 分頁支援
- 內部網路存取控制以確保安全

## 安裝

### 本地安裝

1. 進入您的 n8n 安裝目錄
2. 安裝節點套件:
```bash
npm install n8n-nodes-httpsoverproxy
```

### 全局安裝

如果您全局安裝了 n8n，您也可以全局安裝此節點:

```bash
npm install -g n8n-nodes-httpsoverproxy
```

## 使用方法

安裝後，您可以在 n8n 節點面板的「網路」類別中找到「HTTPS Over Proxy」節點。

### 基本配置

1. 將 HTTPS Over Proxy 節點添加到您的工作流程中
2. 設定請求方法 (GET, POST 等)
3. 輸入目標 URL
4. 在選項部分配置代理設定:
   - 啟用「使用代理」
   - 輸入代理主機 (不含 http:// 或 https:// 前綴)
   - 輸入代理埠
   - 如需要，配置代理認證

### 進階選項

- **超時**: 如果您的代理或目標網站較慢，請增加此值
- **允許未授權憑證**: 啟用以忽略 SSL 憑證驗證問題
- **批次處理**: 配置批次大小和處理多個請求的間隔
- **允許內部網路存取**: 啟用以允許請求內部網路地址 (預設為安全考量而禁用)
- **完整回應**: 返回完整的回應資料，包括標頭和狀態碼
- **回應格式**: 選擇自動檢測、JSON、文字或檔案

## 安全功能

- 防止 SSRF 攻擊
- 預設限制內部網路存取 (localhost, 127.0.0.1 等)
- 安全的代理認證處理

## 範例

### 通過代理的基本 GET 請求

```json
{
  "parameters": {
    "method": "GET",
    "url": "https://example.com",
    "options": {
      "proxy": {
        "settings": {
          "useProxy": true,
          "proxyHost": "proxy.example.com",
          "proxyPort": 8080
        }
      }
    }
  }
}
```

### 帶認證的 POST 請求

```json
{
  "parameters": {
    "method": "POST",
    "url": "https://api.example.com/data",
    "sendBody": true,
    "contentType": "json",
    "bodyParameters": {
      "parameters": [
        {
          "name": "username",
          "value": "user123"
        },
        {
          "name": "action",
          "value": "login"
        }
      ]
    },
    "options": {
      "proxy": {
        "settings": {
          "useProxy": true,
          "proxyHost": "proxy.example.com",
          "proxyPort": 8080,
          "proxyAuth": true,
          "proxyUsername": "proxyuser",
          "proxyPassword": "proxypass"
        }
      }
    }
  }
}
```

## 疑難排解

### 常見問題

1. **連線被拒絕**: 確認代理伺服器正在運行且埠號正確
2. **超時錯誤**: 在選項中增加超時值
3. **SSL 憑證錯誤**: 如果您信任目標網站，請啟用「允許未授權憑證」
4. **代理格式錯誤**: 確保在代理主機欄位中不包含 http:// 或 https:// 前綴

## 授權

[MIT](LICENSE) 