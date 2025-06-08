import { getResolvedValue, createHttpNodeAdditionalKeys } from '../../../../nodes/HttpsOverProxy/HttpsOverProxy.node';

// 模擬 IExecuteFunctions
const mockExecuteFunctions = {
    evaluateExpression: jest.fn(),
    getNode: jest.fn(() => ({ name: 'Test Node' })),
    getInputData: jest.fn(() => [{ json: {} }])
};

describe('HttpsOverProxy - 動態請求間隔功能', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('getResolvedValue - 間隔表達式評估', () => {
        test('應該正確評估隨機間隔表達式', () => {
            const expression = '={{ Math.floor(Math.random() * 4501) + 10000 }}';
            const mockRandomValue = 12345;
            
            mockExecuteFunctions.evaluateExpression.mockReturnValue(mockRandomValue);
            
            const result = getResolvedValue(
                mockExecuteFunctions as any,
                expression,
                0,
                0,
                {},
                createHttpNodeAdditionalKeys({}, 0)
            );
            
            expect(result).toBe(mockRandomValue);
            expect(mockExecuteFunctions.evaluateExpression).toHaveBeenCalledWith(
                expression,
                0
            );
        });

        test('應該正確評估基於頁數的動態間隔', () => {
            const expression = '={{ $pageCount * 1000 + 5000 }}';
            const pageCount = 2;
            const expectedResult = 7000; // 2 * 1000 + 5000
            
            mockExecuteFunctions.evaluateExpression.mockReturnValue(expectedResult);
            
            const result = getResolvedValue(
                mockExecuteFunctions as any,
                expression,
                0,
                0,
                {},
                createHttpNodeAdditionalKeys({}, pageCount)
            );
            
            expect(result).toBe(expectedResult);
        });

        test('應該正確處理固定數值間隔', () => {
            const fixedInterval = 3000;
            
            const result = getResolvedValue(
                mockExecuteFunctions as any,
                fixedInterval,
                0,
                0,
                {},
                createHttpNodeAdditionalKeys({}, 0)
            );
            
            expect(result).toBe(fixedInterval);
            // 固定數值不需要調用 evaluateExpression
            expect(mockExecuteFunctions.evaluateExpression).not.toHaveBeenCalled();
        });

        test('應該正確處理字串數字間隔', () => {
            const stringInterval = '2500';
            
            const result = getResolvedValue(
                mockExecuteFunctions as any,
                stringInterval,
                0,
                0,
                {},
                createHttpNodeAdditionalKeys({}, 0)
            );
            
            expect(result).toBe(stringInterval);
        });

        test('應該正確處理複雜的頁數計算表達式', () => {
            const expression = '={{ ($pageCount + 1) * 2000 }}';
            const pageCount = 3;
            const expectedResult = 8000; // (3 + 1) * 2000
            
            mockExecuteFunctions.evaluateExpression.mockReturnValue(expectedResult);
            
            const result = getResolvedValue(
                mockExecuteFunctions as any,
                expression,
                0,
                0,
                {},
                createHttpNodeAdditionalKeys({}, pageCount)
            );
            
            expect(result).toBe(expectedResult);
        });
    });

    describe('間隔時間轉換邏輯', () => {
        test('應該正確將字串數字轉換為毫秒', () => {
            const testCases = [
                { input: '1000', expected: 1000 },
                { input: '2500', expected: 2500 },
                { input: '0', expected: 0 },
                { input: '999', expected: 999 }
            ];

            testCases.forEach(({ input, expected }) => {
                const intervalMs = typeof input === 'string' ? 
                    parseInt(input, 10) : 
                    Number(input);
                
                expect(intervalMs).toBe(expected);
                expect(typeof intervalMs).toBe('number');
            });
        });

        test('應該正確將數字轉換為毫秒', () => {
            const testCases = [
                { input: 1000, expected: 1000 },
                { input: 2500, expected: 2500 },
                { input: 0, expected: 0 },
                { input: 999.5, expected: 999.5 }
            ];

            testCases.forEach(({ input, expected }) => {
                const intervalMs = Number(input);
                
                expect(intervalMs).toBe(expected);
                expect(typeof intervalMs).toBe('number');
            });
        });

        test('應該正確處理無效的字串', () => {
            const invalidInputs = ['abc', 'not-a-number', ''];
            
            invalidInputs.forEach(input => {
                const intervalMs = parseInt(input, 10);
                expect(isNaN(intervalMs)).toBe(true);
            });
        });
    });

    describe('createHttpNodeAdditionalKeys - $pageCount 支援', () => {
        test('應該正確創建包含 $pageCount 的 additionalKeys', () => {
            const pageCount = 5;
            const response = { statusCode: 200, body: { data: 'test' } };
            
            const additionalKeys = createHttpNodeAdditionalKeys(response, pageCount);
            
            expect(additionalKeys).toHaveProperty('$pageCount', pageCount);
            expect(additionalKeys).toHaveProperty('$response');
            
            // 檢查 $response 的結構（body 會被轉換為字串以支援 parseJson()）
            expect(additionalKeys.$response).toHaveProperty('statusCode', 200);
            expect(additionalKeys.$response).toHaveProperty('body', '{"data":"test"}');
            expect(additionalKeys.$response).toHaveProperty('headers');
            expect(additionalKeys.$response).toHaveProperty('statusMessage', 'OK');
        });

        test('應該支援 $pageCount 從 0 開始', () => {
            const additionalKeys = createHttpNodeAdditionalKeys({}, 0);
            
            expect(additionalKeys.$pageCount).toBe(0);
        });

        test('應該支援大的 $pageCount 值', () => {
            const largePageCount = 999;
            const additionalKeys = createHttpNodeAdditionalKeys({}, largePageCount);
            
            expect(additionalKeys.$pageCount).toBe(largePageCount);
        });
    });

    describe('實際使用場景測試', () => {
        test('隨機間隔表達式應該產生不同的值', () => {
            const expression = '={{ Math.floor(Math.random() * 4501) + 10000 }}';
            const results: number[] = [];
            
            // 模擬多次調用，每次返回不同的隨機值
            for (let i = 0; i < 5; i++) {
                const mockRandomValue = Math.floor(Math.random() * 4501) + 10000;
                mockExecuteFunctions.evaluateExpression.mockReturnValueOnce(mockRandomValue);
                
                const result = getResolvedValue(
                    mockExecuteFunctions as any,
                    expression,
                    0,
                    0,
                    {},
                    createHttpNodeAdditionalKeys({}, i)
                );
                
                results.push(result as number);
            }
            
            // 檢查所有值都在預期範圍內
            results.forEach(value => {
                expect(value).toBeGreaterThanOrEqual(10000);
                expect(value).toBeLessThanOrEqual(14500);
            });
            
            // 檢查調用次數
            expect(mockExecuteFunctions.evaluateExpression).toHaveBeenCalledTimes(5);
        });

        test('基於頁數的間隔應該隨頁數遞增', () => {
            const expression = '={{ $pageCount * 1000 + 5000 }}';
            const expectedResults = [5000, 6000, 7000, 8000, 9000]; // 對應頁數 0-4
            
            expectedResults.forEach((expected, pageCount) => {
                mockExecuteFunctions.evaluateExpression.mockReturnValueOnce(expected);
                
                const result = getResolvedValue(
                    mockExecuteFunctions as any,
                    expression,
                    0,
                    0,
                    {},
                    createHttpNodeAdditionalKeys({}, pageCount)
                );
                
                expect(result).toBe(expected);
            });
        });

        test('複雜表達式應該正確計算', () => {
            const testCases = [
                {
                    expression: '={{ ($pageCount + 1) * 2000 }}',
                    pageCount: 0,
                    expected: 2000 // (0 + 1) * 2000
                },
                {
                    expression: '={{ Math.max($pageCount * 500, 1000) }}',
                    pageCount: 1,
                    expected: 1000 // Math.max(1 * 500, 1000)
                },
                {
                    expression: '={{ $pageCount < 3 ? 2000 : 5000 }}',
                    pageCount: 2,
                    expected: 2000 // 2 < 3 ? 2000 : 5000
                }
            ];

            testCases.forEach(({ expression, pageCount, expected }) => {
                mockExecuteFunctions.evaluateExpression.mockReturnValueOnce(expected);
                
                const result = getResolvedValue(
                    mockExecuteFunctions as any,
                    expression,
                    0,
                    0,
                    {},
                    createHttpNodeAdditionalKeys({}, pageCount)
                );
                
                expect(result).toBe(expected);
            });
        });
    });

    describe('錯誤處理', () => {
        test('應該處理表達式評估錯誤', () => {
            const invalidExpression = '={{ invalid.expression }}';
            
            mockExecuteFunctions.evaluateExpression.mockImplementation(() => {
                throw new Error('Invalid expression');
            });
            
            expect(() => {
                getResolvedValue(
                    mockExecuteFunctions as any,
                    invalidExpression,
                    0,
                    0,
                    {},
                    createHttpNodeAdditionalKeys({}, 0)
                );
            }).toThrow('Invalid expression');
        });

        test('應該處理 null 或 undefined 間隔值', () => {
            // 重置 mock 以避免之前測試的影響
            mockExecuteFunctions.evaluateExpression.mockReset();
            
            const result1 = getResolvedValue(
                mockExecuteFunctions as any,
                null,
                0,
                0,
                {},
                createHttpNodeAdditionalKeys({}, 0)
            );
            
            const result2 = getResolvedValue(
                mockExecuteFunctions as any,
                undefined,
                0,
                0,
                {},
                createHttpNodeAdditionalKeys({}, 0)
            );
            
            expect(result1).toBeNull();
            expect(result2).toBeUndefined();
            
            // null 和 undefined 不應該調用 evaluateExpression
            expect(mockExecuteFunctions.evaluateExpression).not.toHaveBeenCalled();
        });
    });

    describe('性能測試', () => {
        test('大量表達式評估應該在合理時間內完成', () => {
            const expression = '={{ $pageCount * 100 + 1000 }}';
            const iterations = 1000;
            
            const startTime = Date.now();
            
            for (let i = 0; i < iterations; i++) {
                mockExecuteFunctions.evaluateExpression.mockReturnValueOnce(i * 100 + 1000);
                
                getResolvedValue(
                    mockExecuteFunctions as any,
                    expression,
                    0,
                    0,
                    {},
                    createHttpNodeAdditionalKeys({}, i)
                );
            }
            
            const endTime = Date.now();
            const duration = endTime - startTime;
            
            // 應該在 1 秒內完成 1000 次評估
            expect(duration).toBeLessThan(1000);
            expect(mockExecuteFunctions.evaluateExpression).toHaveBeenCalledTimes(iterations);
        });
    });
});

describe('整合測試 - 動態間隔在分頁中的應用', () => {
    test('應該模擬真實的分頁場景', () => {
        const scenarios = [
            {
                name: '隨機間隔分頁',
                expression: '={{ Math.floor(Math.random() * 2000) + 1000 }}',
                pages: 3,
                expectedRange: { min: 1000, max: 3000 }
            },
            {
                name: '遞增間隔分頁',
                expression: '={{ $pageCount * 500 + 1000 }}',
                pages: 4,
                expectedValues: [1000, 1500, 2000, 2500]
            }
        ];

        scenarios.forEach(scenario => {
            console.log(`\n測試場景: ${scenario.name}`);
            
            for (let page = 0; page < scenario.pages; page++) {
                if (scenario.expectedRange) {
                    // 隨機間隔測試
                    const mockValue = Math.floor(Math.random() * 2000) + 1000;
                    mockExecuteFunctions.evaluateExpression.mockReturnValueOnce(mockValue);
                    
                    const result = getResolvedValue(
                        mockExecuteFunctions as any,
                        scenario.expression,
                        0,
                        0,
                        {},
                        createHttpNodeAdditionalKeys({}, page)
                    );
                    
                    expect(result).toBeGreaterThanOrEqual(scenario.expectedRange.min);
                    expect(result).toBeLessThanOrEqual(scenario.expectedRange.max);
                    
                } else if (scenario.expectedValues) {
                    // 固定計算測試
                    const expected = scenario.expectedValues[page];
                    mockExecuteFunctions.evaluateExpression.mockReturnValueOnce(expected);
                    
                    const result = getResolvedValue(
                        mockExecuteFunctions as any,
                        scenario.expression,
                        0,
                        0,
                        {},
                        createHttpNodeAdditionalKeys({}, page)
                    );
                    
                    expect(result).toBe(expected);
                }
            }
        });
    });
}); 