import {
	parseCurlCommand,
	parseCurlArguments,
	curlToNodeParameters,
	evaluateCondition,
	shouldApplyRedirectCondition,
} from '../../../../nodes/HttpsOverProxy/HttpsOverProxy.node';

describe('HttpsOverProxy 輔助函數測試', () => {
	describe('parseCurlArguments', () => {
		test('應該正確解析基本 cURL 參數', () => {
			const command = '-X POST -H "Content-Type: application/json" https://api.example.com';
			const result = parseCurlArguments(command);
			
			expect(result).toEqual([
				'-X', 'POST',
				'-H', 'Content-Type: application/json',
				'https://api.example.com'
			]);
		});

		test('應該正確處理引號和轉義字符', () => {
			const command = '-H "Authorization: Bearer \\"token123\\"" -d \'{"key": "value"}\'';
			const result = parseCurlArguments(command);
			
			expect(result).toEqual([
				'-H', 'Authorization: Bearer "token123"',
				'-d', '{"key": "value"}'
			]);
		});

		test('應該正確處理空格和特殊字符', () => {
			const command = '-H "User-Agent: My App 1.0" --data-raw "name=John Doe&age=30"';
			const result = parseCurlArguments(command);
			
			expect(result).toEqual([
				'-H', 'User-Agent: My App 1.0',
				'--data-raw', 'name=John Doe&age=30'
			]);
		});
	});

	describe('parseCurlCommand', () => {
		test('應該解析基本 GET 請求', () => {
			const curl = 'curl -X GET https://api.example.com/users';
			const result = parseCurlCommand(curl);
			
			expect(result).toMatchObject({
				method: 'GET',
				url: 'https://api.example.com/users',
				headers: {},
				queryParams: {},
				options: {}
			});
		});

		test('應該解析帶標頭的 POST 請求', () => {
			const curl = 'curl -X POST -H "Content-Type: application/json" -H "Authorization: Bearer token123" -d \'{"name": "test"}\' https://api.example.com/users';
			const result = parseCurlCommand(curl);
			
			expect(result).toMatchObject({
				method: 'POST',
				url: 'https://api.example.com/users',
				headers: {
					'Content-Type': 'application/json',
					'Authorization': 'Bearer token123'
				},
				body: '{"name": "test"}',
				authSettings: {
					type: 'bearer',
					token: 'token123'
				}
			});
		});

		test('應該解析 Basic Auth', () => {
			const curl = 'curl -u username:password https://api.example.com/data';
			const result = parseCurlCommand(curl);
			
			expect(result).toMatchObject({
				method: 'GET',
				url: 'https://api.example.com/data',
				authSettings: {
					type: 'basic',
					username: 'username',
					password: 'password'
				}
			});
		});

		test('應該解析代理設定', () => {
			const curl = 'curl --proxy http://proxy.example.com:8080 --proxy-user proxyuser:proxypass https://api.example.com';
			const result = parseCurlCommand(curl);
			
			expect(result).toMatchObject({
				method: 'GET',
				url: 'https://api.example.com/',
				proxySettings: {
					proxyUrl: 'http://proxy.example.com:8080',
					proxyAuth: true,
					proxyUsername: 'proxyuser',
					proxyPassword: 'proxypass'
				}
			});
		});

		test('應該解析重定向和超時選項', () => {
			const curl = 'curl -L --max-redirs 5 --max-time 30 -k https://api.example.com';
			const result = parseCurlCommand(curl);
			
			expect(result).toMatchObject({
				method: 'GET',
				url: 'https://api.example.com/',
				options: {
					followRedirects: true,
					maxRedirects: 5,
					timeout: 30000,
					allowUnauthorizedCerts: true
				}
			});
		});

		test('應該解析 URL 查詢參數', () => {
			const curl = 'curl "https://api.example.com/search?q=test&limit=10&sort=date"';
			const result = parseCurlCommand(curl);
			
			expect(result).toMatchObject({
				method: 'GET',
				url: 'https://api.example.com/search',
				queryParams: {
					q: 'test',
					limit: '10',
					sort: 'date'
				}
			});
		});

		test('應該自動推斷 POST 方法當有 -d 參數時', () => {
			const curl = 'curl -d "name=test" https://api.example.com/users';
			const result = parseCurlCommand(curl);
			
			expect(result).toMatchObject({
				method: 'POST',
				url: 'https://api.example.com/users',
				body: 'name=test'
			});
		});
	});

	describe('curlToNodeParameters', () => {
		test('應該轉換為正確的節點參數格式', () => {
			const curlData = {
				method: 'POST',
				url: 'https://api.example.com/users',
				headers: {
					'Content-Type': 'application/json',
					'X-API-Key': 'key123'
				},
				body: '{"name": "test"}',
				queryParams: {
					format: 'json'
				},
				authSettings: {
					type: 'bearer' as const,
					token: 'token123'
				},
				options: {
					followRedirects: true,
					maxRedirects: 5
				}
			};

			const result = curlToNodeParameters(curlData);
			
			expect(result).toMatchObject({
				method: 'POST',
				url: 'https://api.example.com/users',
				sendQuery: true,
				sendHeaders: true,
				sendBody: true,
				authentication: 'bearer',
				bearerTokenAuth: {
					token: 'token123'
				},
				specifyQuery: 'keypair',
				queryParameters: {
					parameters: [
						{ name: 'format', value: 'json' }
					]
				},
				specifyHeaders: 'keypair',
				headerParameters: {
					parameters: [
						{ name: 'Content-Type', value: 'application/json' },
						{ name: 'X-API-Key', value: 'key123' }
					]
				},
				contentType: 'raw',
				rawContentType: 'text',
				body: '{"name": "test"}',
				options: {
					followRedirects: true,
					maxRedirects: 5
				}
			});
		});

		test('應該正確處理 Basic Auth', () => {
			const curlData = {
				method: 'GET',
				url: 'https://api.example.com',
				headers: {},
				queryParams: {},
				authSettings: {
					type: 'basic' as const,
					username: 'user',
					password: 'pass'
				},
				options: {}
			};

			const result = curlToNodeParameters(curlData);
			
			expect(result).toMatchObject({
				authentication: 'basic',
				basicAuth: {
					user: 'user',
					password: 'pass'
				}
			});
		});
	});

	describe('evaluateCondition', () => {
		test('應該正確評估 equals 條件', () => {
			expect(evaluateCondition('200', 'equals', '200')).toBe(true);
			expect(evaluateCondition('404', 'equals', '200')).toBe(false);
		});

		test('應該正確評估 contains 條件', () => {
			expect(evaluateCondition('application/json', 'contains', 'json')).toBe(true);
			expect(evaluateCondition('text/html', 'contains', 'json')).toBe(false);
		});

		test('應該正確評估 startsWith 條件', () => {
			expect(evaluateCondition('https://api.example.com', 'startsWith', 'https://')).toBe(true);
			expect(evaluateCondition('http://api.example.com', 'startsWith', 'https://')).toBe(false);
		});

		test('應該正確評估 endsWith 條件', () => {
			expect(evaluateCondition('file.json', 'endsWith', '.json')).toBe(true);
			expect(evaluateCondition('file.xml', 'endsWith', '.json')).toBe(false);
		});

		test('應該正確評估 regex 條件', () => {
			expect(evaluateCondition('test123', 'regex', '\\d+')).toBe(true);
			expect(evaluateCondition('testABC', 'regex', '\\d+')).toBe(false);
		});

		test('應該處理無效的 regex 模式', () => {
			// 模擬 console.warn
			const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
			
			const result = evaluateCondition('test', 'regex', '[invalid');
			
			expect(result).toBe(false);
			expect(consoleSpy).toHaveBeenCalledWith('Invalid regex pattern: [invalid');
			
			consoleSpy.mockRestore();
		});

		test('應該處理未知操作符', () => {
			expect(evaluateCondition('test', 'unknown', 'value')).toBe(false);
		});
	});

	describe('shouldApplyRedirectCondition', () => {
		const mockResponse = {
			statusCode: 302,
			headers: {
				'content-type': 'application/json',
				'location': 'https://api.example.com/new-location'
			},
			url: 'https://api.example.com/original'
		};

		test('應該正確評估 statusCode 條件', () => {
			const condition = {
				type: 'statusCode' as const,
				operator: 'equals' as const,
				value: '302',
				action: 'follow' as const
			};

			const result = shouldApplyRedirectCondition(condition, mockResponse as any);
			expect(result).toBe(true);
		});

		test('應該正確評估 header 條件', () => {
			const condition = {
				type: 'header' as const,
				operator: 'contains' as const,
				value: 'content-type:json',
				action: 'follow' as const
			};

			const result = shouldApplyRedirectCondition(condition, mockResponse as any);
			expect(result).toBe(true);
		});

		test('應該正確評估 url 條件', () => {
			const condition = {
				type: 'url' as const,
				operator: 'startsWith' as const,
				value: 'https://api.example.com',
				action: 'follow' as const
			};

			const result = shouldApplyRedirectCondition(condition, mockResponse as any);
			expect(result).toBe(true);
		});

		test('應該處理缺失的標頭', () => {
			const condition = {
				type: 'header' as const,
				operator: 'equals' as const,
				value: 'missing-header:test',
				action: 'follow' as const
			};

			const result = shouldApplyRedirectCondition(condition, mockResponse as any);
			expect(result).toBe(false);
		});

		test('應該處理未知條件類型', () => {
			const condition = {
				type: 'unknown' as any,
				operator: 'equals' as const,
				value: 'test',
				action: 'follow' as const
			};

			const result = shouldApplyRedirectCondition(condition, mockResponse as any);
			expect(result).toBe(false);
		});
	});
}); 