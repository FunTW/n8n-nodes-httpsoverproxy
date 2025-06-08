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
    console.error('錯誤：找不到源 SVG 文件');
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

// 將 JS/TS 編譯後的文件移動到節點子目錄
function moveCompiledFiles() {
  // 確保目標目錄存在
  if (!fs.existsSync(path.join(__dirname, 'dist', 'nodes', 'HttpsOverProxy'))) {
    fs.mkdirSync(path.join(__dirname, 'dist', 'nodes', 'HttpsOverProxy'), { recursive: true });
  }

  // 移動所有相關文件到子目錄
  return src([
    './dist/HttpsOverProxy.node.js',
    './dist/HttpsOverProxy.node.d.ts',
    './dist/HttpsOverProxy.node.js.map',
    './dist/description.js',
    './dist/description.d.ts',
    './dist/description.js.map',
    './dist/optimizeResponse.js',
    './dist/optimizeResponse.d.ts',
    './dist/optimizeResponse.js.map'
  ])
    .pipe(dest('./dist/nodes/HttpsOverProxy/'));
}

// 清理額外的文件
function cleanupFiles(cb) {
  // 在移動文件後刪除源目錄中的重複文件
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
  
  filesToDelete.forEach(file => {
    if (fs.existsSync(file)) {
      fs.unlinkSync(file);
    }
  });
  
  // 調用回調函數表示任務完成
  cb();
}

exports['build:icons'] = buildIcons;
exports['build:ensure-icons'] = ensureIcons;
exports['build:assets'] = buildOtherAssets;
exports['build:credentials'] = buildCredentials;
exports['build:move'] = moveCompiledFiles;
exports['build:cleanup'] = cleanupFiles;
exports['build:all'] = series(buildIcons, buildOtherAssets, buildCredentials, moveCompiledFiles, ensureIcons, cleanupFiles); 