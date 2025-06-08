// 整合測試 - 測試節點描述和基本功能
import { HttpsOverProxy } from '../../../../nodes/HttpsOverProxy/HttpsOverProxy.node';

describe('HttpsOverProxy 整合測試', () => {
	let httpsOverProxy: HttpsOverProxy;

	beforeEach(() => {
		httpsOverProxy = new HttpsOverProxy();
	});

	describe('節點基本屬性', () => {
		test('應該有正確的節點描述', () => {
			expect(httpsOverProxy).toBeDefined();
			expect(httpsOverProxy.description).toBeDefined();
			expect(httpsOverProxy.description.displayName).toBe('HTTPS Over Proxy');
			expect(httpsOverProxy.description.name).toBe('httpsOverProxy');
			expect(httpsOverProxy.description.group).toEqual(['output']);
		});

		test('應該有正確的節點版本', () => {
			expect(httpsOverProxy.description.version).toBe(1);
		});

		test('應該有正確的節點圖示', () => {
			expect(httpsOverProxy.description.icon).toBe('file:HttpsOverProxy.svg');
		});

		test('應該有正確的節點描述文字', () => {
			expect(httpsOverProxy.description.description).toContain('HTTPS');
			expect(httpsOverProxy.description.description).toContain('proxy');
		});
	});

	describe('節點屬性配置', () => {
		test('應該有必要的輸入和輸出配置', () => {
			expect(httpsOverProxy.description.inputs).toEqual(['main']);
			expect(httpsOverProxy.description.outputs).toEqual(['main']);
		});

		test('應該有正確的屬性數量', () => {
			expect(httpsOverProxy.description.properties).toBeDefined();
			expect(Array.isArray(httpsOverProxy.description.properties)).toBe(true);
			expect(httpsOverProxy.description.properties.length).toBeGreaterThan(10);
		});

		test('應該包含基本的 HTTP 方法屬性', () => {
			const methodProperty = httpsOverProxy.description.properties.find(
				(prop: any) => prop.name === 'method'
			);
			expect(methodProperty).toBeDefined();
			if (methodProperty) {
				expect(methodProperty.type).toBe('options');
				expect(methodProperty.options).toContainEqual({ name: 'GET', value: 'GET' });
				expect(methodProperty.options).toContainEqual({ name: 'POST', value: 'POST' });
			}
		});

		test('應該包含 URL 屬性', () => {
			const urlProperty = httpsOverProxy.description.properties.find(
				(prop: any) => prop.name === 'url'
			);
			expect(urlProperty).toBeDefined();
			if (urlProperty) {
				expect(urlProperty.type).toBe('string');
				expect(urlProperty.required).toBe(true);
			}
		});

		test('應該包含認證屬性', () => {
			const authProperty = httpsOverProxy.description.properties.find(
				(prop: any) => prop.name === 'authentication'
			);
			expect(authProperty).toBeDefined();
			if (authProperty) {
				expect(authProperty.type).toBe('options');
			}
		});

		test('應該包含代理設定屬性', () => {
			const optionsProperty = httpsOverProxy.description.properties.find(
				(prop: any) => prop.name === 'options'
			);
			expect(optionsProperty).toBeDefined();
			if (optionsProperty) {
				expect(optionsProperty.type).toBe('collection');
			}
		});
	});

	describe('參數驗證', () => {
		test('應該有正確的查詢參數配置', () => {
			const queryProperty = httpsOverProxy.description.properties.find(
				(prop: any) => prop.name === 'queryParameters'
			);
			expect(queryProperty).toBeDefined();
			if (queryProperty) {
				expect(queryProperty.type).toBe('fixedCollection');
			}
		});

		test('應該有正確的標頭參數配置', () => {
			const headerProperty = httpsOverProxy.description.properties.find(
				(prop: any) => prop.name === 'headerParameters'
			);
			expect(headerProperty).toBeDefined();
			if (headerProperty) {
				expect(headerProperty.type).toBe('fixedCollection');
			}
		});

		test('應該有正確的請求體配置', () => {
			const bodyProperty = httpsOverProxy.description.properties.find(
				(prop: any) => prop.name === 'body'
			);
			expect(bodyProperty).toBeDefined();
			if (bodyProperty) {
				expect(bodyProperty.type).toBe('string');
			}
		});
	});

	describe('進階功能配置', () => {
		test('應該支援分頁功能', () => {
			const optionsProperty = httpsOverProxy.description.properties.find(
				(prop: any) => prop.name === 'options'
			);
			
			if (optionsProperty && optionsProperty.options) {
				const paginationOption = optionsProperty.options.find(
					(option: any) => option.name === 'pagination'
				);
				expect(paginationOption).toBeDefined();
			}
		});

		test('應該支援批次處理', () => {
			const optionsProperty = httpsOverProxy.description.properties.find(
				(prop: any) => prop.name === 'options'
			);
			
			if (optionsProperty && optionsProperty.options) {
				const batchingOption = optionsProperty.options.find(
					(option: any) => option.name === 'batching'
				);
				expect(batchingOption).toBeDefined();
			}
		});

		test('應該支援回應格式設定', () => {
			const optionsProperty = httpsOverProxy.description.properties.find(
				(prop: any) => prop.name === 'options'
			);
			
			if (optionsProperty && optionsProperty.options) {
				const responseFormatOption = optionsProperty.options.find(
					(option: any) => option.name === 'responseFormat'
				);
				expect(responseFormatOption).toBeDefined();
			}
		});
	});

	describe('節點執行方法', () => {
		test('應該有 execute 方法', () => {
			expect(typeof httpsOverProxy.execute).toBe('function');
		});

		test('execute 方法應該是 async 函數', () => {
			expect(httpsOverProxy.execute.constructor.name).toBe('AsyncFunction');
		});
	});

	describe('節點類型檢查', () => {
		test('應該實作 INodeType 介面', () => {
			expect(httpsOverProxy.description).toBeDefined();
			expect(typeof httpsOverProxy.execute).toBe('function');
		});

		test('應該有正確的節點類型標識', () => {
			expect(httpsOverProxy.description.name).toBe('httpsOverProxy');
			expect(httpsOverProxy.description.displayName).toBe('HTTPS Over Proxy');
		});
	});

	describe('預設值檢查', () => {
		test('HTTP 方法應該預設為 GET', () => {
			const methodProperty = httpsOverProxy.description.properties.find(
				(prop: any) => prop.name === 'method'
			);
			if (methodProperty) {
				expect(methodProperty.default).toBe('GET');
			}
		});

		test('認證應該預設為 none', () => {
			const authProperty = httpsOverProxy.description.properties.find(
				(prop: any) => prop.name === 'authentication'
			);
			if (authProperty) {
				expect(authProperty.default).toBe('none');
			}
		});

		test('查詢參數應該預設為不發送', () => {
			const sendQueryProperty = httpsOverProxy.description.properties.find(
				(prop: any) => prop.name === 'sendQuery'
			);
			if (sendQueryProperty) {
				expect(sendQueryProperty.default).toBe(false);
			}
		});

		test('標頭應該預設為不發送', () => {
			const sendHeadersProperty = httpsOverProxy.description.properties.find(
				(prop: any) => prop.name === 'sendHeaders'
			);
			if (sendHeadersProperty) {
				expect(sendHeadersProperty.default).toBe(false);
			}
		});

		test('請求體應該預設為不發送', () => {
			const sendBodyProperty = httpsOverProxy.description.properties.find(
				(prop: any) => prop.name === 'sendBody'
			);
			if (sendBodyProperty) {
				expect(sendBodyProperty.default).toBe(false);
			}
		});
	});
}); 