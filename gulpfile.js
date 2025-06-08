const { series, src, dest } = require('gulp');
const fs = require('fs');
const path = require('path');

function buildIcons() {
  // 複製 SVG 文件到目標目錄，保持原始目錄結構
  return src('./nodes/**/*.svg', { base: '.' })
    .pipe(dest('./dist'));
}

// 額外添加一個專門處理圖標的任務，確保圖標直接放到節點子目錄中
function ensureIcons(cb) {
  // 檢查源 SVG 文件是否存在
  const sourceSvg = path.join(__dirname, 'nodes', 'HttpsOverProxy', 'HttpsOverProxy.svg');
  const targetDir = path.join(__dirname, 'dist', 'nodes', 'HttpsOverProxy');
  const targetSvg = path.join(targetDir, 'HttpsOverProxy.svg');
  
  // 確保目標目錄存在
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }
  
  // 如果源文件存在，直接複製到目標目錄
  if (fs.existsSync(sourceSvg)) {
    fs.copyFileSync(sourceSvg, targetSvg);
    console.log('SVG 圖標已複製到節點子目錄');
  } else {
    console.log('注意：找不到源 SVG 文件，但可能已經存在於目標位置');
  }
  
  cb();
}

function buildOtherAssets() {
  return src(['./nodes/**/*.json', './nodes/**/*.html', './nodes/**/*.css'], { base: '.' })
    .pipe(dest('./dist'));
}

function buildCredentials() {
  // 檢查credentials目錄是否存在
  if (fs.existsSync(path.join(__dirname, 'credentials'))) {
    return src('./credentials/**/*.{json,svg,png}', { base: '.' })
      .pipe(dest('./dist'));
  }
  
  // 如果目錄不存在，返回一個空流
  return Promise.resolve();
}

// 檢查編譯後的文件是否已經在正確位置
function verifyCompiledFiles(cb) {
  const targetDir = path.join(__dirname, 'dist', 'nodes', 'HttpsOverProxy');
  const requiredFiles = [
    'HttpsOverProxy.node.js',
    'description.js',
    'optimizeResponse.js'
  ];
  
  let allFilesExist = true;
  
  requiredFiles.forEach(file => {
    const filePath = path.join(targetDir, file);
    if (!fs.existsSync(filePath)) {
      console.error(`錯誤：找不到必要的檔案 ${filePath}`);
      allFilesExist = false;
    } else {
      console.log(`✓ 檔案存在：${file}`);
    }
  });
  
  if (allFilesExist) {
    console.log('✓ 所有必要的編譯檔案都已存在於正確位置');
  } else {
    console.error('✗ 部分必要檔案缺失，請檢查 TypeScript 編譯是否成功');
  }
  
  cb();
}

// 清理不需要的文件（如果存在於根目錄）
function cleanupRootFiles(cb) {
  // 清理可能存在於根目錄的重複文件
  const filesToDelete = [
    './dist/HttpsOverProxy.node.js',
    './dist/HttpsOverProxy.node.d.ts',
    './dist/HttpsOverProxy.node.js.map',
    './dist/description.js',
    './dist/description.d.ts',
    './dist/description.js.map',
    './dist/optimizeResponse.js',
    './dist/optimizeResponse.d.ts',
    './dist/optimizeResponse.js.map'
  ];
  
  let deletedCount = 0;
  filesToDelete.forEach(file => {
    if (fs.existsSync(file)) {
      fs.unlinkSync(file);
      deletedCount++;
      console.log(`已刪除重複檔案：${file}`);
    }
  });
  
  if (deletedCount === 0) {
    console.log('✓ 沒有需要清理的重複檔案');
  } else {
    console.log(`✓ 已清理 ${deletedCount} 個重複檔案`);
  }
  
  cb();
}

exports['build:icons'] = buildIcons;
exports['build:ensure-icons'] = ensureIcons;
exports['build:assets'] = buildOtherAssets;
exports['build:credentials'] = buildCredentials;
exports['build:verify'] = verifyCompiledFiles;
exports['build:cleanup'] = cleanupRootFiles;
exports['build:all'] = series(buildIcons, buildOtherAssets, buildCredentials, verifyCompiledFiles, ensureIcons, cleanupRootFiles); 