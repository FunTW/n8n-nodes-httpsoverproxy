// Jest 測試環境設置
import { jest } from '@jest/globals';

// 設置測試超時
jest.setTimeout(30000);

// 模擬 n8n 環境變數
process.env.NODE_ENV = 'test';

// 全域測試設置
beforeAll(() => {
	// 設置測試前的全域配置
});

afterAll(() => {
	// 清理測試後的資源
});

// 每個測試前的設置
beforeEach(() => {
	// 重置模擬
	jest.clearAllMocks();
});

// 每個測試後的清理
afterEach(() => {
	// 清理測試資源
}); 