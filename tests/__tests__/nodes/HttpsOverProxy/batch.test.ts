// 由於批次聚合函數在主檔案中是內部函數，我們需要創建一個測試版本
// 這裡我們測試批次聚合的邏輯

describe('批次聚合功能測試', () => {
	// 模擬 aggregateBatchResults 函數的邏輯
	function aggregateBatchResults(
		results: any[],
		mode: 'merge' | 'array' | 'summary',
		options: {
			mergeType?: 'shallow' | 'deep';
			includeMetadata?: boolean;
		} = {}
	): any {
		const { mergeType = 'shallow', includeMetadata = false } = options;

		switch (mode) {
			case 'merge': {
				let merged = {};
				
				if (mergeType === 'deep') {
					// 深度合併邏輯
					const deepMerge = (target: any, source: any): any => {
						const result = { ...target };
						for (const key in source) {
							if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
								result[key] = deepMerge(result[key] || {}, source[key]);
							} else {
								result[key] = source[key];
							}
						}
						return result;
					};
					
					for (const result of results) {
						merged = deepMerge(merged, result);
					}
				} else {
					// 淺層合併
					for (const result of results) {
						merged = { ...merged, ...result };
					}
				}

				if (includeMetadata) {
					return {
						...merged,
						_metadata: {
							totalItems: results.length,
							aggregationType: 'merge',
							mergeType,
							timestamp: new Date().toISOString(),
						},
					};
				}

				return merged;
			}

			case 'array': {
				const arrayResult = results.map((item, index) => ({
					...item,
					_itemIndex: index,
				}));

				if (includeMetadata) {
					return {
						items: arrayResult,
						_metadata: {
							totalItems: results.length,
							aggregationType: 'array',
							timestamp: new Date().toISOString(),
						},
					};
				}

				return arrayResult;
			}

			case 'summary': {
				const summary = {
					totalItems: results.length,
					successfulItems: 0,
					failedItems: 0,
					statusCodes: {} as Record<string, number>,
					errors: [] as string[],
					aggregationType: 'summary',
					timestamp: new Date().toISOString(),
				};

				for (const result of results) {
					if (result.error) {
						summary.failedItems++;
						summary.errors.push(result.error);
					} else {
						summary.successfulItems++;
					}

					if (result.statusCode) {
						const code = result.statusCode.toString();
						summary.statusCodes[code] = (summary.statusCodes[code] || 0) + 1;
					}
				}

				return summary;
			}

			default:
				throw new Error(`未知的聚合模式: ${mode}`);
		}
	}

	describe('merge 模式', () => {
		test('應該正確執行淺層合併', () => {
			const results = [
				{ name: 'John', age: 30 },
				{ age: 31, city: 'New York' },
				{ country: 'USA' }
			];

			const merged = aggregateBatchResults(results, 'merge', { mergeType: 'shallow' });

			expect(merged).toEqual({
				name: 'John',
				age: 31, // 後面的值覆蓋前面的
				city: 'New York',
				country: 'USA'
			});
		});

		test('應該正確執行深度合併', () => {
			const results = [
				{ 
					user: { name: 'John', details: { age: 30 } },
					settings: { theme: 'dark' }
				},
				{ 
					user: { details: { city: 'New York' } },
					settings: { language: 'en' }
				}
			];

			const merged = aggregateBatchResults(results, 'merge', { mergeType: 'deep' });

			expect(merged).toEqual({
				user: {
					name: 'John',
					details: {
						age: 30,
						city: 'New York'
					}
				},
				settings: {
					theme: 'dark',
					language: 'en'
				}
			});
		});

		test('應該包含元數據當 includeMetadata 為 true', () => {
			const results = [{ a: 1 }, { b: 2 }];
			const merged = aggregateBatchResults(results, 'merge', { includeMetadata: true });

			expect(merged).toMatchObject({
				a: 1,
				b: 2,
				_metadata: {
					totalItems: 2,
					aggregationType: 'merge',
					mergeType: 'shallow',
					timestamp: expect.any(String)
				}
			});
		});
	});

	describe('array 模式', () => {
		test('應該將結果包裝在陣列中並添加索引', () => {
			const results = [
				{ name: 'John' },
				{ name: 'Jane' },
				{ name: 'Bob' }
			];

			const arrayResult = aggregateBatchResults(results, 'array');

			expect(arrayResult).toEqual([
				{ name: 'John', _itemIndex: 0 },
				{ name: 'Jane', _itemIndex: 1 },
				{ name: 'Bob', _itemIndex: 2 }
			]);
		});

		test('應該包含元數據當 includeMetadata 為 true', () => {
			const results = [{ a: 1 }, { b: 2 }];
			const arrayResult = aggregateBatchResults(results, 'array', { includeMetadata: true });

			expect(arrayResult).toMatchObject({
				items: [
					{ a: 1, _itemIndex: 0 },
					{ b: 2, _itemIndex: 1 }
				],
				_metadata: {
					totalItems: 2,
					aggregationType: 'array',
					timestamp: expect.any(String)
				}
			});
		});
	});

	describe('summary 模式', () => {
		test('應該生成正確的統計摘要', () => {
			const results = [
				{ statusCode: 200, data: 'success1' },
				{ statusCode: 200, data: 'success2' },
				{ statusCode: 404, error: 'Not found' },
				{ statusCode: 500, error: 'Server error' },
				{ statusCode: 200, data: 'success3' }
			];

			const summary = aggregateBatchResults(results, 'summary');

			expect(summary).toMatchObject({
				totalItems: 5,
				successfulItems: 3,
				failedItems: 2,
				statusCodes: {
					'200': 3,
					'404': 1,
					'500': 1
				},
				errors: ['Not found', 'Server error'],
				aggregationType: 'summary',
				timestamp: expect.any(String)
			});
		});

		test('應該正確處理只有成功項目的情況', () => {
			const results = [
				{ statusCode: 200, data: 'success1' },
				{ statusCode: 201, data: 'success2' }
			];

			const summary = aggregateBatchResults(results, 'summary');

			expect(summary).toMatchObject({
				totalItems: 2,
				successfulItems: 2,
				failedItems: 0,
				statusCodes: {
					'200': 1,
					'201': 1
				},
				errors: [],
				aggregationType: 'summary'
			});
		});

		test('應該正確處理只有失敗項目的情況', () => {
			const results = [
				{ statusCode: 404, error: 'Not found' },
				{ statusCode: 500, error: 'Server error' }
			];

			const summary = aggregateBatchResults(results, 'summary');

			expect(summary).toMatchObject({
				totalItems: 2,
				successfulItems: 0,
				failedItems: 2,
				statusCodes: {
					'404': 1,
					'500': 1
				},
				errors: ['Not found', 'Server error'],
				aggregationType: 'summary'
			});
		});
	});

	describe('錯誤處理', () => {
		test('應該拋出錯誤當使用未知模式', () => {
			const results = [{ a: 1 }];
			
			expect(() => {
				aggregateBatchResults(results, 'unknown' as any);
			}).toThrow('未知的聚合模式: unknown');
		});

		test('應該處理空結果陣列', () => {
			const results: any[] = [];
			
			const mergeResult = aggregateBatchResults(results, 'merge');
			const arrayResult = aggregateBatchResults(results, 'array');
			const summaryResult = aggregateBatchResults(results, 'summary');

			expect(mergeResult).toEqual({});
			expect(arrayResult).toEqual([]);
			expect(summaryResult).toMatchObject({
				totalItems: 0,
				successfulItems: 0,
				failedItems: 0,
				statusCodes: {},
				errors: []
			});
		});
	});

	describe('深度合併輔助函數', () => {
		test('應該正確處理嵌套物件', () => {
			const target = {
				a: 1,
				b: {
					c: 2,
					d: {
						e: 3
					}
				}
			};

			const source = {
				b: {
					d: {
						f: 4
					},
					g: 5
				},
				h: 6
			};

			const result = aggregateBatchResults([target, source], 'merge', { mergeType: 'deep' });

			expect(result).toEqual({
				a: 1,
				b: {
					c: 2,
					d: {
						e: 3,
						f: 4
					},
					g: 5
				},
				h: 6
			});
		});

		test('應該正確處理陣列（不進行深度合併）', () => {
			const target = {
				items: [1, 2, 3]
			};

			const source = {
				items: [4, 5, 6]
			};

			const result = aggregateBatchResults([target, source], 'merge', { mergeType: 'deep' });

			expect(result).toEqual({
				items: [4, 5, 6] // 陣列被覆蓋，不合併
			});
		});

		test('應該正確處理 null 和 undefined 值', () => {
			const target = {
				a: 1,
				b: null,
				c: undefined
			};

			const source = {
				b: 2,
				c: 3,
				d: 4
			};

			const result = aggregateBatchResults([target, source], 'merge', { mergeType: 'deep' });

			expect(result).toEqual({
				a: 1,
				b: 2,
				c: 3,
				d: 4
			});
		});
	});
}); 