// 節點引用功能測試 - 測試在分頁參數中使用其他節點引用的功能
import { getResolvedValue, createHttpNodeAdditionalKeys } from '../../../../nodes/HttpsOverProxy/HttpsOverProxy.node';
import { IExecuteFunctions } from 'n8n-workflow';

// 模擬工作流數據
const MOCK_WORKFLOW_DATA = {
	'變數': {
		json: {
			pageNum: 5,
			pageSize: 20,
			maxPages: 10,
			apiKey: 'test-key-123'
		}
	},
	'設定': {
		json: {
			baseUrl: 'https://api.example.com',
			timeout: 30000,
			retryCount: 3
		}
	},
	'API回應': {
		json: {
			totalCount: 1000,
			hasMore: true,
			nextPageToken: 'abc123'
		}
	}
};

// 創建模擬的 IExecuteFunctions
function createMockExecuteFunctions(): IExecuteFunctions {
	return {
		getNodeParameter: jest.fn((paramName: string, itemIndex: number, defaultValue?: any) => defaultValue),
		getInputData: jest.fn(() => [{ json: { test: 'data' } }]),
		getNode: jest.fn(() => ({
			name: 'HttpsOverProxy Test',
			type: 'httpsOverProxy',
			typeVersion: 1,
			position: [0, 0],
			parameters: {}
		})),
		
		evaluateExpression: jest.fn((expression: string, _itemIndex: number) => {
			// 模擬 n8n 的 evaluateExpression 行為
			// 當處理節點引用時，它會返回帶有 = 前綴的結果（這是實際的 n8n 行為）
			
			// 移除表達式包裝
			let processedExpression = expression;
			if (expression.match(/^=\{\{.*\}\}$/)) {
				processedExpression = expression.replace(/^=\{\{/, '').replace(/\}\}$/, '').trim();
			}
			
			// 處理節點引用
			for (const [nodeName, nodeData] of Object.entries(MOCK_WORKFLOW_DATA)) {
				const nodeRefPattern = new RegExp(`\\$\\("${nodeName}"\\)\\.item\\.json\\.(\\w+)`, 'g');
				if (processedExpression.includes(`$("${nodeName}").item.json.`)) {
					let match;
					
					while ((match = nodeRefPattern.exec(processedExpression)) !== null) {
						const propertyName = match[1];
						const value = (nodeData.json as any)[propertyName];
						if (value !== undefined) {
							// 對字串值加引號，數值和布林值直接替換
							const replacement = typeof value === 'string' ? `"${value}"` : String(value);
							processedExpression = processedExpression.replace(match[0], replacement);
						} else {
							// 屬性不存在時返回 undefined
							return undefined;
						}
					}
					
					// 重置 regex lastIndex
					nodeRefPattern.lastIndex = 0;
				}
			}
			
			// 評估表達式
			try {
				const result = eval(processedExpression);
				
				// 模擬 n8n 的行為：如果是簡單的節點引用，返回帶有 = 前綴的字串
				if (expression.match(/^=\{\{\s*\$\("[^"]+"\)\.item\.json\.\w+\s*\}\}$/)) {
					return `=${result}`;
				}
				
				return result;
			} catch (_error) {
				// 如果評估失敗，返回原始表達式
				return expression;
			}
		}),
		
		getExecuteData: jest.fn(() => ({
			data: { main: Object.values(MOCK_WORKFLOW_DATA).map(data => [data]) },
			node: { name: 'HttpsOverProxy Test', type: 'httpsOverProxy' },
			source: null
		}))
	} as any;
}

describe('HttpsOverProxy 節點引用功能測試', () => {
	let executeFunctions: IExecuteFunctions;
	let executeData: any;

	beforeEach(() => {
		executeFunctions = createMockExecuteFunctions();
		executeData = executeFunctions.getExecuteData();
	});

	describe('基本變數功能', () => {
		test('$pageCount 變數應該正確返回頁數', () => {
			const additionalKeys = createHttpNodeAdditionalKeys(null, 2);
			
			const result = getResolvedValue(
				executeFunctions,
				'={{ $pageCount }}',
				0,
				0,
				executeData,
				additionalKeys
			);
			
			expect(result).toBe(2);
			expect(typeof result).toBe('number');
		});

		test('$response 變數應該包含回應數據', () => {
			const mockResponse = {
				statusCode: 200,
				statusMessage: 'OK',
				headers: { 'content-type': 'application/json' },
				body: '{"test": "data"}'
			};
			
			const additionalKeys = createHttpNodeAdditionalKeys(mockResponse, 0);
			
			expect(additionalKeys.$response).toBeDefined();
			expect(additionalKeys.$response.statusCode).toBe(200);
			expect(additionalKeys.$response.body).toBe('{"test": "data"}');
		});

		test('createHttpNodeAdditionalKeys 應該創建正確的 additionalKeys', () => {
			const additionalKeys = createHttpNodeAdditionalKeys(null, 1);
			
			expect(additionalKeys).toHaveProperty('$pageCount', 1);
			expect(additionalKeys).toHaveProperty('$response');
			expect(additionalKeys).toHaveProperty('$request');
		});
	});

	describe('節點引用功能', () => {
		test('應該正確解析單一節點屬性引用', () => {
			const result = getResolvedValue(
				executeFunctions,
				'={{ $("變數").item.json.pageNum }}',
				0,
				0,
				executeData
			);
			
			expect(result).toBe('5'); // 修正後移除等號，但保持字串類型
		});

		test('應該正確解析字串類型的節點屬性', () => {
			const result = getResolvedValue(
				executeFunctions,
				'={{ $("設定").item.json.baseUrl }}',
				0,
				0,
				executeData
			);
			
			expect(result).toBe('https://api.example.com');
		});

		test('應該正確解析數值類型的節點屬性', () => {
			const result = getResolvedValue(
				executeFunctions,
				'={{ $("設定").item.json.timeout }}',
				0,
				0,
				executeData
			);
			
			expect(result).toBe('30000'); // 修正後移除等號，但保持字串類型
		});

		test('應該支援不同節點的屬性引用', () => {
			const result1 = getResolvedValue(
				executeFunctions,
				'={{ $("變數").item.json.pageSize }}',
				0,
				0,
				executeData
			);
			
			const result2 = getResolvedValue(
				executeFunctions,
				'={{ $("API回應").item.json.totalCount }}',
				0,
				0,
				executeData
			);
			
			expect(result1).toBe('20'); // 修正後移除等號，但保持字串類型
			expect(result2).toBe('1000'); // 修正後移除等號，但保持字串類型
		});
	});

	describe('組合表達式功能', () => {
		test('應該支援 $pageCount 與節點引用的數學運算', () => {
			const additionalKeys = createHttpNodeAdditionalKeys(null, 2);
			
			const result = getResolvedValue(
				executeFunctions,
				'={{ $pageCount * $("變數").item.json.pageNum }}',
				0,
				0,
				executeData,
				additionalKeys
			);
			
			expect(result).toBe(10); // 2 * 5
		});

		test('應該支援複雜的數學計算', () => {
			const additionalKeys = createHttpNodeAdditionalKeys(null, 1);
			
			const result = getResolvedValue(
				executeFunctions,
				'={{ ($pageCount + 1) * $("變數").item.json.pageSize }}',
				0,
				0,
				executeData,
				additionalKeys
			);
			
			expect(result).toBe(40); // (1 + 1) * 20
		});

		test('應該支援條件判斷表達式', () => {
			const additionalKeys = createHttpNodeAdditionalKeys(null, 2);
			
			const result = getResolvedValue(
				executeFunctions,
				'={{ $pageCount >= $("變數").item.json.maxPages }}',
				0,
				0,
				executeData,
				additionalKeys
			);
			
			expect(result).toBe(false); // 2 >= 10
		});

		test('應該支援複合邏輯條件', () => {
			const additionalKeys = createHttpNodeAdditionalKeys(null, 1);
			
			const result = getResolvedValue(
				executeFunctions,
				'={{ $pageCount > 0 && $("API回應").item.json.hasMore }}',
				0,
				0,
				executeData,
				additionalKeys
			);
			
			expect(result).toBe(true); // 1 > 0 && true
		});
	});

	describe('實際分頁場景測試', () => {
		test('應該正確計算分頁偏移量', () => {
			const testCases = [
				{ pageCount: 0, expected: 0 },
				{ pageCount: 1, expected: 20 },
				{ pageCount: 2, expected: 40 }
			];

			testCases.forEach(({ pageCount, expected }) => {
				const additionalKeys = createHttpNodeAdditionalKeys(null, pageCount);
				
				const result = getResolvedValue(
					executeFunctions,
					'={{ $pageCount * $("變數").item.json.pageSize }}',
					0,
					0,
					executeData,
					additionalKeys
				);
				
				expect(result).toBe(expected);
			});
		});

		test('應該正確判斷分頁完成條件', () => {
			const testCases = [
				{ pageCount: 0, expected: false },
				{ pageCount: 5, expected: false },
				{ pageCount: 10, expected: true },
				{ pageCount: 15, expected: true }
			];

			testCases.forEach(({ pageCount, expected }) => {
				const additionalKeys = createHttpNodeAdditionalKeys(null, pageCount);
				
				const result = getResolvedValue(
					executeFunctions,
					'={{ $pageCount >= $("變數").item.json.maxPages }}',
					0,
					0,
					executeData,
					additionalKeys
				);
				
				expect(result).toBe(expected);
			});
		});

		test('應該支援基於總數的分頁計算', () => {
			const additionalKeys = createHttpNodeAdditionalKeys(null, 50);
			
			const result = getResolvedValue(
				executeFunctions,
				'={{ $pageCount >= Math.ceil($("API回應").item.json.totalCount / $("變數").item.json.pageSize) }}',
				0,
				0,
				executeData,
				additionalKeys
			);
			
			expect(result).toBe(true); // 50 >= Math.ceil(1000 / 20) = 50
		});
	});

	describe('錯誤處理和邊界情況', () => {
		test('應該處理不存在的節點引用', () => {
			const result = getResolvedValue(
				executeFunctions,
				'={{ $("不存在的節點").item.json.someProperty }}',
				0,
				0,
				executeData
			);
			
			// 應該返回原始表達式或處理錯誤
			expect(typeof result).toBe('string');
		});

		test('應該處理不存在的屬性引用', () => {
			const result = getResolvedValue(
				executeFunctions,
				'={{ $("變數").item.json.不存在的屬性 }}',
				0,
				0,
				executeData
			);
			
			// 應該返回 undefined 或原始表達式
			expect(result === undefined || typeof result === 'string').toBe(true);
		});

		test('應該處理無效的表達式語法', () => {
			expect(() => {
				getResolvedValue(
					executeFunctions,
					'={{ $pageCount + }}', // 無效語法
					0,
					0,
					executeData,
					createHttpNodeAdditionalKeys(null, 1)
				);
			}).not.toThrow(); // 應該優雅地處理錯誤
		});

		test('應該處理空的 additionalKeys', () => {
			const result = getResolvedValue(
				executeFunctions,
				'={{ $("變數").item.json.pageNum }}',
				0,
				0,
				executeData,
				undefined // 沒有 additionalKeys
			);
			
			expect(result).toBe('5'); // 修正後移除等號，但保持字串類型
		});
	});

	describe('類型安全性測試', () => {
		test('數值運算應該返回正確的類型', () => {
			const additionalKeys = createHttpNodeAdditionalKeys(null, 2);
			
			const result = getResolvedValue(
				executeFunctions,
				'={{ $pageCount * 10 }}',
				0,
				0,
				executeData,
				additionalKeys
			);
			
			expect(typeof result).toBe('number');
			expect(result).toBe(20);
		});

		test('布林運算應該返回正確的類型', () => {
			const additionalKeys = createHttpNodeAdditionalKeys(null, 5);
			
			const result = getResolvedValue(
				executeFunctions,
				'={{ $pageCount > 3 }}',
				0,
				0,
				executeData,
				additionalKeys
			);
			
			expect(typeof result).toBe('boolean');
			expect(result).toBe(true);
		});

		test('字串運算應該返回正確的類型', () => {
			const result = getResolvedValue(
				executeFunctions,
				'={{ $("設定").item.json.baseUrl }}',
				0,
				0,
				executeData
			);
			
			expect(typeof result).toBe('string');
			expect(result).toBe('https://api.example.com');
		});
	});
}); 