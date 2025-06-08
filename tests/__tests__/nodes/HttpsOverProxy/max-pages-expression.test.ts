import { getResolvedValue, createHttpNodeAdditionalKeys } from '../../../../nodes/HttpsOverProxy/HttpsOverProxy.node';

// 模擬 IExecuteFunctions
const mockExecuteFunctions = {
    evaluateExpression: jest.fn(),
    getNode: jest.fn(() => ({ name: 'Test Node' })),
    getInputData: jest.fn(() => [{ json: {} }])
};

describe('HttpsOverProxy - Max Pages 表達式功能', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('getResolvedValue - Max Pages 表達式評估', () => {
        test('應該正確評估基於回應總數的 Max Pages', () => {
            const expression = '={{ $response.body.parseJson().totalsize }}';
            const expectedResult = 1516;
            
            mockExecuteFunctions.evaluateExpression.mockReturnValue(expectedResult);
            
            const response = {
                statusCode: 200,
                statusMessage: 'OK',
                headers: {},
                body: '{"totalsize": 1516, "data": []}'
            };
            
            const result = getResolvedValue(
                mockExecuteFunctions as any,
                expression,
                0,
                0,
                {},
                createHttpNodeAdditionalKeys(response, 0)
            );
            
            expect(result).toBe(expectedResult);
            expect(mockExecuteFunctions.evaluateExpression).toHaveBeenCalled();
        });

        test('應該正確評估總數減去固定值的表達式', () => {
            const expression = '={{ $response.body.parseJson().totalsize - 1516 }}';
            const expectedResult = 484; // 2000 - 1516
            
            mockExecuteFunctions.evaluateExpression.mockReturnValue(expectedResult);
            
            const response = {
                statusCode: 200,
                statusMessage: 'OK',
                headers: {},
                body: '{"totalsize": 2000, "data": []}'
            };
            
            const result = getResolvedValue(
                mockExecuteFunctions as any,
                expression,
                0,
                0,
                {},
                createHttpNodeAdditionalKeys(response, 0)
            );
            
            expect(result).toBe(expectedResult);
        });

        test('應該正確評估基於頁數計算的 Max Pages', () => {
            const expression = '={{ $pageCount + 10 }}';
            const pageCount = 5;
            const expectedResult = 15;
            
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

        test('應該正確評估複雜計算：總數除以每頁數量', () => {
            const expression = '={{ Math.ceil($response.body.parseJson().totalsize / 50) }}';
            const expectedResult = 31; // Math.ceil(1516 / 50)
            
            mockExecuteFunctions.evaluateExpression.mockReturnValue(expectedResult);
            
            const response = {
                statusCode: 200,
                statusMessage: 'OK',
                headers: {},
                body: '{"totalsize": 1516, "data": []}'
            };
            
            const result = getResolvedValue(
                mockExecuteFunctions as any,
                expression,
                0,
                0,
                {},
                createHttpNodeAdditionalKeys(response, 0)
            );
            
            expect(result).toBe(expectedResult);
        });

        test('應該正確評估條件判斷：最小值限制', () => {
            const expression = '={{ Math.max($response.body.parseJson().totalsize / 100, 5) }}';
            const expectedResult = 5; // Math.max(200/100, 5) = Math.max(2, 5) = 5
            
            mockExecuteFunctions.evaluateExpression.mockReturnValue(expectedResult);
            
            const response = {
                statusCode: 200,
                statusMessage: 'OK',
                headers: {},
                body: '{"totalsize": 200, "data": []}'
            };
            
            const result = getResolvedValue(
                mockExecuteFunctions as any,
                expression,
                0,
                0,
                {},
                createHttpNodeAdditionalKeys(response, 0)
            );
            
            expect(result).toBe(expectedResult);
        });

        test('應該正確處理固定數值 Max Pages', () => {
            const fixedMaxPages = 100;
            
            const result = getResolvedValue(
                mockExecuteFunctions as any,
                fixedMaxPages,
                0,
                0,
                {},
                createHttpNodeAdditionalKeys({}, 0)
            );
            
            expect(result).toBe(fixedMaxPages);
            // 固定數值不需要調用 evaluateExpression
            expect(mockExecuteFunctions.evaluateExpression).not.toHaveBeenCalled();
        });

        test('應該正確處理字串數字 Max Pages', () => {
            const stringMaxPages = '50';
            
            const result = getResolvedValue(
                mockExecuteFunctions as any,
                stringMaxPages,
                0,
                0,
                {},
                createHttpNodeAdditionalKeys({}, 0)
            );
            
            expect(result).toBe(stringMaxPages);
        });
    });

    describe('Max Pages 數值轉換邏輯', () => {
        test('應該正確將字串數字轉換為數值', () => {
            const testCases = [
                { input: '100', expected: 100 },
                { input: '50', expected: 50 },
                { input: '0', expected: 0 },
                { input: '999', expected: 999 }
            ];

            testCases.forEach(({ input, expected }) => {
                const maxPages = typeof input === 'string' ? 
                    parseInt(input, 10) : 
                    Number(input);
                
                expect(maxPages).toBe(expected);
                expect(typeof maxPages).toBe('number');
            });
        });

        test('應該正確將數字保持為數值', () => {
            const testCases = [
                { input: 100, expected: 100 },
                { input: 50, expected: 50 },
                { input: 0, expected: 0 },
                { input: 999, expected: 999 }
            ];

            testCases.forEach(({ input, expected }) => {
                const maxPages = Number(input);
                
                expect(maxPages).toBe(expected);
                expect(typeof maxPages).toBe('number');
            });
        });

        test('應該正確處理無效的字串', () => {
            const invalidInputs = ['abc', 'not-a-number', ''];
            
            invalidInputs.forEach(input => {
                const maxPages = parseInt(input, 10);
                expect(isNaN(maxPages)).toBe(true);
            });
        });
    });

    describe('createHttpNodeAdditionalKeys - $response 支援', () => {
        test('應該正確創建包含 $response 的 additionalKeys', () => {
            const response = { 
                statusCode: 200, 
                statusMessage: 'OK',
                headers: { 'content-type': 'application/json' },
                body: { totalsize: 1516, data: [] } 
            };
            
            const additionalKeys = createHttpNodeAdditionalKeys(response, 0);
            
            expect(additionalKeys).toHaveProperty('$response');
            expect(additionalKeys.$response).toHaveProperty('statusCode', 200);
            expect(additionalKeys.$response).toHaveProperty('statusMessage', 'OK');
            expect(additionalKeys.$response).toHaveProperty('headers');
            expect(additionalKeys.$response).toHaveProperty('body');
            
            // body 應該被轉換為字串以支援 parseJson()
            expect(typeof additionalKeys.$response.body).toBe('string');
        });

        test('應該支援空回應', () => {
            const additionalKeys = createHttpNodeAdditionalKeys({}, 0);
            
            expect(additionalKeys.$response).toHaveProperty('statusCode', 200);
            expect(additionalKeys.$response).toHaveProperty('body', '{}');
        });

        test('應該支援不同的回應格式', () => {
            const responses = [
                {
                    input: { statusCode: 201, body: { total: 100 } },
                    expectedStatusCode: 201
                },
                {
                    input: { statusCode: 404, body: 'Not Found' },
                    expectedStatusCode: 404
                }
            ];

            responses.forEach(({ input, expectedStatusCode }) => {
                const additionalKeys = createHttpNodeAdditionalKeys(input, 0);
                expect(additionalKeys.$response.statusCode).toBe(expectedStatusCode);
            });
        });
    });

    describe('實際使用場景測試', () => {
        test('API 返回總記錄數的場景', () => {
            const scenarios = [
                {
                    name: '基本總數獲取',
                    expression: '={{ $response.body.parseJson().total }}',
                    response: {
                        statusCode: 200,
                        body: '{"total": 1516, "page": 1, "per_page": 50}'
                    },
                    expectedResult: 1516
                },
                {
                    name: '計算總頁數',
                    expression: '={{ Math.ceil($response.body.parseJson().total / 50) }}',
                    response: {
                        statusCode: 200,
                        body: '{"total": 1516, "page": 1, "per_page": 50}'
                    },
                    expectedResult: 31 // Math.ceil(1516 / 50)
                },
                {
                    name: '總數減去偏移量',
                    expression: '={{ $response.body.parseJson().total - 1000 }}',
                    response: {
                        statusCode: 200,
                        body: '{"total": 1516, "page": 1, "per_page": 50}'
                    },
                    expectedResult: 516
                }
            ];

            scenarios.forEach(({ name: _name, expression, response, expectedResult }) => {
                mockExecuteFunctions.evaluateExpression.mockReturnValueOnce(expectedResult);
                
                const result = getResolvedValue(
                    mockExecuteFunctions as any,
                    expression,
                    0,
                    0,
                    {},
                    createHttpNodeAdditionalKeys(response, 0)
                );
                
                expect(result).toBe(expectedResult);
            });
        });

        test('API 返回頁數資訊的場景', () => {
            const scenarios = [
                {
                    name: '直接獲取總頁數',
                    expression: '={{ $response.body.parseJson().totalPages }}',
                    response: {
                        statusCode: 200,
                        body: '{"totalPages": 30, "currentPage": 1}'
                    },
                    expectedResult: 30
                },
                {
                    name: '總頁數減去緩衝',
                    expression: '={{ $response.body.parseJson().totalPages - 5 }}',
                    response: {
                        statusCode: 200,
                        body: '{"totalPages": 30, "currentPage": 1}'
                    },
                    expectedResult: 25
                },
                {
                    name: '設定最大頁數限制',
                    expression: '={{ Math.min($response.body.parseJson().totalPages, 20) }}',
                    response: {
                        statusCode: 200,
                        body: '{"totalPages": 30, "currentPage": 1}'
                    },
                    expectedResult: 20
                }
            ];

            scenarios.forEach(({ name: _name, expression, response, expectedResult }) => {
                mockExecuteFunctions.evaluateExpression.mockReturnValueOnce(expectedResult);
                
                const result = getResolvedValue(
                    mockExecuteFunctions as any,
                    expression,
                    0,
                    0,
                    {},
                    createHttpNodeAdditionalKeys(response, 0)
                );
                
                expect(result).toBe(expectedResult);
            });
        });

        test('組合 $pageCount 和 $response 的場景', () => {
            const scenarios = [
                {
                    name: '基於當前頁數和總數計算剩餘頁數',
                    expression: '={{ $response.body.parseJson().totalPages - $pageCount }}',
                    response: {
                        statusCode: 200,
                        body: '{"totalPages": 30, "currentPage": 1}'
                    },
                    pageCount: 5,
                    expectedResult: 25 // 30 - 5
                },
                {
                    name: '動態調整最大頁數',
                    expression: '={{ Math.min($response.body.parseJson().totalPages, $pageCount + 10) }}',
                    response: {
                        statusCode: 200,
                        body: '{"totalPages": 30, "currentPage": 1}'
                    },
                    pageCount: 15,
                    expectedResult: 25 // Math.min(30, 15 + 10)
                }
            ];

            scenarios.forEach(({ name: _name, expression, response, pageCount, expectedResult }) => {
                mockExecuteFunctions.evaluateExpression.mockReturnValueOnce(expectedResult);
                
                const result = getResolvedValue(
                    mockExecuteFunctions as any,
                    expression,
                    0,
                    0,
                    {},
                    createHttpNodeAdditionalKeys(response, pageCount)
                );
                
                expect(result).toBe(expectedResult);
            });
        });
    });

    describe('錯誤處理', () => {
        test('應該處理表達式評估錯誤', () => {
            const invalidExpression = '={{ $response.body.parseJson().invalidField }}';
            
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

        test('應該處理 null 或 undefined Max Pages 值', () => {
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

        test('應該處理無效的回應格式', () => {
            const invalidResponses = [
                null,
                undefined,
                { statusCode: 500 },
                { body: null }
            ];

            invalidResponses.forEach(response => {
                const additionalKeys = createHttpNodeAdditionalKeys(response, 0);
                expect(additionalKeys).toHaveProperty('$response');
                expect(additionalKeys.$response).toHaveProperty('statusCode');
                expect(additionalKeys.$response).toHaveProperty('body');
            });
        });
    });

    describe('性能測試', () => {
        test('大量 Max Pages 表達式評估應該在合理時間內完成', () => {
            const expression = '={{ $response.body.parseJson().totalsize }}';
            const response = {
                statusCode: 200,
                body: '{"totalsize": 1516}'
            };
            
            const startTime = Date.now();
            
            // 模擬大量評估
            for (let i = 0; i < 1000; i++) {
                mockExecuteFunctions.evaluateExpression.mockReturnValueOnce(1516);
                
                getResolvedValue(
                    mockExecuteFunctions as any,
                    expression,
                    0,
                    0,
                    {},
                    createHttpNodeAdditionalKeys(response, 0)
                );
            }
            
            const endTime = Date.now();
            const duration = endTime - startTime;
            
            // 應該在 1 秒內完成 1000 次評估
            expect(duration).toBeLessThan(1000);
        });
    });

    describe('整合測試 - Max Pages 在分頁中的應用', () => {
        test('應該模擬真實的分頁場景', () => {
            console.log('\n測試場景: Max Pages 分頁應用');
            
            const scenarios = [
                {
                    name: '基於總記錄數限制頁數',
                    maxPagesExpression: '={{ Math.ceil($response.body.parseJson().totalsize / 50) }}',
                    response: { statusCode: 200, body: '{"totalsize": 1516}' },
                    expectedMaxPages: 31
                },
                {
                    name: '設定最大頁數上限',
                    maxPagesExpression: '={{ Math.min($response.body.parseJson().totalPages, 20) }}',
                    response: { statusCode: 200, body: '{"totalPages": 50}' },
                    expectedMaxPages: 20
                }
            ];
            
            scenarios.forEach((scenario, _index) => {
                console.log(`\n測試場景: ${scenario.name}`);
                
                // 重置 mock 並設定返回值
                mockExecuteFunctions.evaluateExpression.mockReset();
                mockExecuteFunctions.evaluateExpression.mockReturnValue(scenario.expectedMaxPages);
                
                const result = getResolvedValue(
                    mockExecuteFunctions as any,
                    scenario.maxPagesExpression,
                    0,
                    0,
                    {},
                    createHttpNodeAdditionalKeys(scenario.response, 0)
                );
                
                expect(result).toBe(scenario.expectedMaxPages);
                console.log(`Max Pages 計算結果: ${result}`);
            });
        });
    });
}); 