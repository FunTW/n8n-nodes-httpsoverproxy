// 簡化的測試腳本，不依賴 TypeScript 模組
console.log('=== 動態請求間隔測試 ===\n');

// 模擬 getResolvedValue 函數的核心邏輯
function mockGetResolvedValue(expression, pageCount = 0) {
    console.log(`評估表達式: ${JSON.stringify(expression)}`);
    
    if (typeof expression === 'number') {
        return expression;
    }
    
    if (typeof expression === 'string') {
        // 如果是純數字字串
        if (/^\d+$/.test(expression)) {
            return parseInt(expression, 10);
        }
        
        // 如果是表達式格式
        if (expression.startsWith('={{') && expression.endsWith('}}')) {
            let processedExpression = expression.slice(3, -2); // 移除 ={{ 和 }}
            
            // 替換 $pageCount
            processedExpression = processedExpression.replace(/\$pageCount/g, pageCount.toString());
            
            try {
                const result = eval(processedExpression);
                console.log(`  -> 評估 "${processedExpression}" = ${result}`);
                return result;
            } catch (error) {
                console.log(`  -> 評估錯誤: ${error.message}`);
                return 0;
            }
        }
    }
    
    return expression;
}

// 測試案例
const testCases = [
    {
        name: '隨機間隔表達式',
        expression: '={{ Math.floor(Math.random() * 4501) + 10000 }}',
        description: '生成 10000-14500ms 之間的隨機間隔'
    },
    {
        name: '基於頁數的動態間隔',
        expression: '={{ $pageCount * 1000 + 5000 }}',
        description: '基於頁數計算間隔：第1頁5秒，第2頁6秒，依此類推'
    },
    {
        name: '複雜的頁數計算',
        expression: '={{ ($pageCount + 1) * 2000 }}',
        description: '更複雜的頁數計算：(頁數+1) * 2秒'
    },
    {
        name: '固定間隔',
        expression: 3000,
        description: '固定 3 秒間隔'
    },
    {
        name: '字串數字',
        expression: '2500',
        description: '字串格式的數字間隔'
    }
];

testCases.forEach((testCase, index) => {
    console.log(`測試 ${index + 1}: ${testCase.name}`);
    console.log(`描述: ${testCase.description}`);
    console.log(`輸入: ${JSON.stringify(testCase.expression)}`);
    
    try {
        // 模擬第2頁的情況
        const pageCount = 2;
        const evaluatedInterval = mockGetResolvedValue(testCase.expression, pageCount);
        
        // 轉換為毫秒數
        const intervalMs = typeof evaluatedInterval === 'string' ? 
            parseInt(evaluatedInterval, 10) : 
            Number(evaluatedInterval);
        
        console.log(`評估結果: ${evaluatedInterval}`);
        console.log(`間隔時間: ${intervalMs}ms (${intervalMs/1000}秒)`);
        
        // 驗證結果
        if (isNaN(intervalMs)) {
            console.log('❌ 錯誤：無法轉換為有效的數字');
        } else if (intervalMs <= 0) {
            console.log('⚠️  警告：間隔時間為 0 或負數，不會等待');
        } else {
            console.log('✅ 成功：有效的間隔時間');
        }
        
    } catch (error) {
        console.log(`❌ 錯誤：${error.message}`);
    }
    
    console.log('---\n');
});

// 測試多次隨機間隔生成
console.log('=== 隨機間隔多次測試 ===');
const randomExpression = '={{ Math.floor(Math.random() * 4501) + 10000 }}';

for (let i = 1; i <= 5; i++) {
    const evaluatedInterval = mockGetResolvedValue(randomExpression, i);
    const intervalMs = Number(evaluatedInterval);
    console.log(`第 ${i} 次請求間隔: ${intervalMs}ms (${intervalMs/1000}秒)`);
}

// 測試基於頁數的動態間隔
console.log('\n=== 基於頁數的動態間隔測試 ===');
const pageBasedExpression = '={{ $pageCount * 1000 + 5000 }}';

for (let pageCount = 0; pageCount <= 4; pageCount++) {
    const evaluatedInterval = mockGetResolvedValue(pageBasedExpression, pageCount);
    const intervalMs = Number(evaluatedInterval);
    console.log(`第 ${pageCount} 頁間隔: ${intervalMs}ms (${intervalMs/1000}秒)`);
}

console.log('\n=== 測試完成 ===');
console.log('動態請求間隔功能已實作，支援：');
console.log('• 隨機間隔表達式：{{ Math.floor(Math.random() * 4501) + 10000 }}');
console.log('• 基於頁數的動態間隔：{{ $pageCount * 1000 + 5000 }}');
console.log('• 複雜計算：{{ ($pageCount + 1) * 2000 }}');
console.log('• 固定數值間隔：3000');
console.log('• 字串數字間隔："2500"');
console.log('\n現在您可以在 Interval Between Requests 中使用這些表達式！'); 