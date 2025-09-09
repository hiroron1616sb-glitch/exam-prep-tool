// 294MB超大容量PDFファイル対応 - 高度最適化版 script.js
// 制限: ファイルサイズ500MB、1000ページ、5ページバッチ処理
// 最適化: プログレッシブローディング、メモリ管理、処理中断・再開

// === グローバル設定 ===
const ULTRA_LARGE_CONFIG = {
    MAX_FILE_SIZE: 500 * 1024 * 1024, // 500MB
    MAX_PAGES: 1000,
    BATCH_SIZE: 5, // 超小バッチで最適化
    PROGRESS_UPDATE_INTERVAL: 100, // 100ms
    GC_INTERVAL: 1, // 各バッチ後にGC
    MAX_RETRIES: 3,
    MEMORY_CLEANUP_DELAY: 50 // メモリクリーンアップ遅延
};

// === 処理状態管理 ===
let processingState = {
    isProcessing: false,
    isPaused: false,
    currentPage: 0,
    totalPages: 0,
    processedPages: 0,
    batchCount: 0,
    startTime: null,
    lastProgressUpdate: 0,
    memoryPressure: false
};

// === メモリ管理クラス ===
class UltraMemoryManager {
    constructor() {
        this.gcCounter = 0;
        this.memoryThreshold = 0.8; // メモリ使用率80%で警告
        this.cleanupCallbacks = [];
    }

    // 強制ガベージコレクション（Chrome DevToolsで確認可能）
    forceGC() {
        this.gcCounter++;

        // 明示的なメモリクリーンアップ
        this.cleanupCallbacks.forEach(callback => {
            try {
                callback();
            } catch (error) {
                console.warn('Memory cleanup callback failed:', error);
            }
        });

        // ブラウザにGCを促す
        if (window.gc) {
            window.gc();
        }

        // メモリプレッシャーチェック
        this.checkMemoryPressure();

        console.log(`🧹 GC実行 #${this.gcCounter} - メモリクリーンアップ完了`);
    }

    // メモリクリーンアップコールバック登録
    addCleanupCallback(callback) {
        this.cleanupCallbacks.push(callback);
    }

    // メモリプレッシャー検知
    checkMemoryPressure() {
        if (performance.memory) {
            const memUsage = performance.memory.usedJSHeapSize / performance.memory.jsHeapSizeLimit;
            processingState.memoryPressure = memUsage > this.memoryThreshold;

            if (processingState.memoryPressure) {
                console.warn(`⚠️ メモリプレッシャー検知: ${(memUsage * 100).toFixed(1)}%`);
                this.emergencyCleanup();
            }
        }
    }

    // 緊急メモリクリーンアップ
    emergencyCleanup() {
        console.log('🚨 緊急メモリクリーンアップ実行中...');

        // 複数回のGC実行
        for (let i = 0; i < 3; i++) {
            setTimeout(() => this.forceGC(), i * 100);
        }

        // 処理を一時停止してメモリ回復を待つ
        return new Promise(resolve => {
            setTimeout(() => {
                this.checkMemoryPressure();
                resolve();
            }, 500);
        });
    }
}

// === プログレッシブローダー ===
class ProgressiveLoader {
    constructor() {
        this.chunks = new Map();
        this.loadQueue = [];
        this.maxConcurrent = 2; // 同時読み込み制限
        this.activeLoads = 0;
    }

    // チャンク単位でのプログレッシブ読み込み
    async loadChunk(pdf, startPage, endPage) {
        const chunkId = `${startPage}-${endPage}`;

        if (this.chunks.has(chunkId)) {
            return this.chunks.get(chunkId);
        }

        console.log(`📖 チャンク読み込み: ページ${startPage}-${endPage}`);

        const pages = [];
        for (let pageNum = startPage; pageNum <= Math.min(endPage, pdf.numPages); pageNum++) {
            try {
                const page = await pdf.getPage(pageNum);
                pages.push(page);
            } catch (error) {
                console.error(`ページ${pageNum}読み込みエラー:`, error);
                // エラーページはnullで埋める
                pages.push(null);
            }
        }

        this.chunks.set(chunkId, pages);

        // メモリ使用量監視
        if (this.chunks.size > 10) {
            this.cleanupOldChunks();
        }

        return pages;
    }

    // 古いチャンクのクリーンアップ
    cleanupOldChunks() {
        const entries = Array.from(this.chunks.entries());

        // 最も古い半分のチャンクを削除
        const toRemove = entries.slice(0, Math.floor(entries.length / 2));

        toRemove.forEach(([chunkId]) => {
            this.chunks.delete(chunkId);
            console.log(`🗑️ チャンク削除: ${chunkId}`);
        });
    }

    // 全チャンククリア
    clearAll() {
        this.chunks.clear();
        console.log('🧹 全チャンククリア完了');
    }
}

// === 進行状況表示（超大容量ファイル専用） ===
class UltraProgressDisplay {
    constructor() {
        this.lastUpdateTime = 0;
        this.updateThrottle = ULTRA_LARGE_CONFIG.PROGRESS_UPDATE_INTERVAL;
        this.performanceMetrics = {
            avgPageTime: 0,
            totalProcessingTime: 0,
            memoryUsage: 0,
            gcCount: 0
        };
    }

    updateProgress(current, total, additionalInfo = {}) {
        const now = performance.now();

        // スロットル制御で頻繁な更新を制限
        if (now - this.lastUpdateTime < this.updateThrottle) {
            return;
        }

        this.lastUpdateTime = now;

        const percentage = Math.round((current / total) * 100);
        const elapsed = now - processingState.startTime;
        const pagesPerSecond = current / (elapsed / 1000);
        const remainingPages = total - current;
        const estimatedRemaining = remainingPages / pagesPerSecond;

        // パフォーマンスメトリクス更新
        this.performanceMetrics.avgPageTime = elapsed / current;
        this.performanceMetrics.totalProcessingTime = elapsed;
        this.performanceMetrics.gcCount = memoryManager.gcCounter;

        if (performance.memory) {
            this.performanceMetrics.memoryUsage = performance.memory.usedJSHeapSize;
        }

        // プログレスバー更新
        const progressBar = document.getElementById('progressBar');
        const progressText = document.getElementById('progressText');
        const detailsDiv = document.getElementById('progressDetails');

        if (progressBar) {
            progressBar.value = percentage;
            progressBar.style.background = processingState.memoryPressure ? 
                'linear-gradient(90deg, #ff6b6b, #feca57)' : 
                'linear-gradient(90deg, #4ecdc4, #45b7aa)';
        }

        if (progressText) {
            const memoryWarning = processingState.memoryPressure ? ' ⚠️' : '';
            progressText.textContent = `処理中: ${current}/${total}ページ (${percentage}%)${memoryWarning}`;
        }

        if (detailsDiv) {
            const memoryMB = this.performanceMetrics.memoryUsage / (1024 * 1024);

            detailsDiv.innerHTML = `
                <div class="ultra-progress-details">
                    <div class="metrics-row">
                        <span>📊 処理速度: ${pagesPerSecond.toFixed(1)} ページ/秒</span>
                        <span>⏱️ 経過時間: ${this.formatTime(elapsed)}</span>
                    </div>
                    <div class="metrics-row">
                        <span>💾 メモリ使用量: ${memoryMB.toFixed(1)} MB</span>
                        <span>🧹 GC実行回数: ${this.performanceMetrics.gcCount}</span>
                    </div>
                    <div class="metrics-row">
                        <span>📦 現在のバッチ: ${processingState.batchCount}</span>
                        <span>⏳ 残り時間: ${this.formatTime(estimatedRemaining * 1000)}</span>
                    </div>
                    ${additionalInfo.currentOperation ? 
                        `<div class="current-operation">🔄 ${additionalInfo.currentOperation}</div>` : ''}
                </div>
            `;
        }

        console.log(`📈 進行状況: ${percentage}% (${current}/${total}) - ${pagesPerSecond.toFixed(1)}ページ/秒`);
    }

    formatTime(ms) {
        if (!ms || ms < 0 || !isFinite(ms)) return '計算中...';

        const seconds = Math.floor(ms / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);

        if (hours > 0) {
            return `${hours}:${String(minutes % 60).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
        } else if (minutes > 0) {
            return `${minutes}:${String(seconds % 60).padStart(2, '0')}`;
        } else {
            return `${seconds}秒`;
        }
    }
}

// === 処理中断・再開機能 ===
class ProcessingController {
    constructor() {
        this.pauseResolve = null;
        this.shouldStop = false;
    }

    pause() {
        if (processingState.isProcessing && !processingState.isPaused) {
            processingState.isPaused = true;
            console.log('⏸️ 処理を一時停止しました');
            this.updateControlButtons();
        }
    }

    resume() {
        if (processingState.isPaused && this.pauseResolve) {
            processingState.isPaused = false;
            this.pauseResolve();
            this.pauseResolve = null;
            console.log('▶️ 処理を再開しました');
            this.updateControlButtons();
        }
    }

    stop() {
        this.shouldStop = true;
        if (this.pauseResolve) {
            this.resume(); // 停止のために一時停止を解除
        }
        console.log('⏹️ 処理停止が要求されました');
    }

    async checkPause() {
        if (processingState.isPaused) {
            return new Promise(resolve => {
                this.pauseResolve = resolve;
            });
        }

        if (this.shouldStop) {
            throw new Error('処理がユーザーによって停止されました');
        }
    }

    updateControlButtons() {
        const pauseBtn = document.getElementById('pauseBtn');
        const resumeBtn = document.getElementById('resumeBtn');
        const stopBtn = document.getElementById('stopBtn');

        if (pauseBtn) pauseBtn.style.display = processingState.isPaused ? 'none' : 'inline-block';
        if (resumeBtn) resumeBtn.style.display = processingState.isPaused ? 'inline-block' : 'none';
        if (stopBtn) stopBtn.style.display = processingState.isProcessing ? 'inline-block' : 'none';
    }

    reset() {
        this.shouldStop = false;
        this.pauseResolve = null;
        processingState.isPaused = false;
        this.updateControlButtons();
    }
}

// === グローバルインスタンス ===
const memoryManager = new UltraMemoryManager();
const progressiveLoader = new ProgressiveLoader();
const progressDisplay = new UltraProgressDisplay();
const processController = new ProcessingController();

// === エラーハンドリング ===
class RobustErrorHandler {
    constructor() {
        this.retryCount = 0;
        this.maxRetries = ULTRA_LARGE_CONFIG.MAX_RETRIES;
        this.errors = [];
    }

    async withRetry(operation, description) {
        for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
            try {
                return await operation();
            } catch (error) {
                console.warn(`⚠️ ${description} 失敗 (試行 ${attempt}/${this.maxRetries}):`, error.message);
                this.errors.push({ description, error: error.message, attempt });

                if (attempt === this.maxRetries) {
                    throw new Error(`${description} が ${this.maxRetries} 回失敗しました: ${error.message}`);
                }

                // 指数バックオフで待機
                await this.delay(Math.pow(2, attempt - 1) * 1000);

                // メモリ関連エラーの場合は緊急クリーンアップ
                if (error.message.includes('memory') || error.message.includes('heap')) {
                    await memoryManager.emergencyCleanup();
                }
            }
        }
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    getErrorSummary() {
        return {
            totalErrors: this.errors.length,
            errors: this.errors
        };
    }
}


// === メイン処理関数（超大容量対応） ===
async function processUltraLargePDF() {
    const fileInput = document.getElementById('pdfFile');
    const file = fileInput.files[0];

    if (!file) {
        alert('PDFファイルを選択してください。');
        return;
    }

    // ファイルサイズチェック（500MB制限）
    if (file.size > ULTRA_LARGE_CONFIG.MAX_FILE_SIZE) {
        const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
        alert(`ファイルサイズが大きすぎます: ${sizeMB}MB\n制限: 500MB`);
        return;
    }

    const errorHandler = new RobustErrorHandler();

    try {
        // 処理開始準備
        processingState.isProcessing = true;
        processingState.startTime = performance.now();
        processController.reset();

        console.log(`🚀 超大容量PDF処理開始: ${file.name} (${(file.size / (1024 * 1024)).toFixed(1)}MB)`);

        // PDF読み込み（リトライ付き）
        const pdf = await errorHandler.withRetry(async () => {
            const arrayBuffer = await file.arrayBuffer();
            return await pdfjsLib.getDocument(arrayBuffer).promise;
        }, 'PDF読み込み');

        processingState.totalPages = Math.min(pdf.numPages, ULTRA_LARGE_CONFIG.MAX_PAGES);

        console.log(`📄 総ページ数: ${pdf.numPages} (処理対象: ${processingState.totalPages})`);

        if (pdf.numPages > ULTRA_LARGE_CONFIG.MAX_PAGES) {
            alert(`ページ数制限により最初の${ULTRA_LARGE_CONFIG.MAX_PAGES}ページのみ処理します。`);
        }

        // UIの準備
        showProgressUI();

        // 超大容量ファイル専用の処理開始
        await processInUltraSmallBatches(pdf, errorHandler);

        console.log('🎉 超大容量PDF処理完了!');

    } catch (error) {
        console.error('❌ 処理エラー:', error);
        alert(`処理中にエラーが発生しました: ${error.message}`);

        // エラー詳細をコンソールに出力
        const errorSummary = errorHandler.getErrorSummary();
        if (errorSummary.totalErrors > 0) {
            console.log('🔍 エラー詳細:', errorSummary);
        }
    } finally {
        // 最終クリーンアップ
        await finalCleanup();
        hideProgressUI();
        processingState.isProcessing = false;
        processController.reset();
    }
}

// === 超小バッチ処理（5ページずつ） ===
async function processInUltraSmallBatches(pdf, errorHandler) {
    let allText = '';
    const batchSize = ULTRA_LARGE_CONFIG.BATCH_SIZE;
    const totalBatches = Math.ceil(processingState.totalPages / batchSize);

    console.log(`📦 バッチ処理開始: ${totalBatches}バッチ (${batchSize}ページ/バッチ)`);

    // メモリクリーンアップコールバック登録
    memoryManager.addCleanupCallback(() => {
        progressiveLoader.cleanupOldChunks();
    });

    for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
        processingState.batchCount = batchIndex + 1;

        // 処理制御チェック（一時停止/停止）
        await processController.checkPause();

        const startPage = batchIndex * batchSize + 1;
        const endPage = Math.min(startPage + batchSize - 1, processingState.totalPages);

        progressDisplay.updateProgress(
            startPage - 1, 
            processingState.totalPages, 
            { currentOperation: `バッチ${processingState.batchCount}/${totalBatches} 処理中` }
        );

        // バッチ処理（リトライ付き）
        const batchText = await errorHandler.withRetry(async () => {
            return await processBatchWithOptimization(pdf, startPage, endPage);
        }, `バッチ${processingState.batchCount}処理`);

        allText += batchText + '\n\n';

        // 各バッチ後にメモリ管理
        await performBatchCleanup(batchIndex, totalBatches);

        console.log(`✅ バッチ${processingState.batchCount}完了 (ページ${startPage}-${endPage})`);
    }

    // テキスト出力
    await outputProcessedText(allText);

    return allText;
}

// === 最適化されたバッチ処理 ===
async function processBatchWithOptimization(pdf, startPage, endPage) {
    console.log(`🔄 バッチ処理: ページ${startPage}-${endPage}`);

    // プログレッシブローディングでページを読み込み
    const pages = await progressiveLoader.loadChunk(pdf, startPage, endPage);
    let batchText = '';

    // 各ページのテキスト抽出
    for (let i = 0; i < pages.length; i++) {
        const page = pages[i];
        const pageNum = startPage + i;

        // 処理制御チェック
        await processController.checkPause();

        if (page) {
            try {
                const textContent = await page.getTextContent();
                const pageText = textContent.items
                    .map(item => item.str)
                    .join(' ')
                    .trim();

                if (pageText) {
                    batchText += `--- ページ ${pageNum} ---\n${pageText}\n\n`;
                }

                processingState.processedPages = pageNum;

                // 高頻度の進行状況更新
                if (pageNum % 2 === 0 || pageNum === endPage) {
                    progressDisplay.updateProgress(
                        pageNum, 
                        processingState.totalPages,
                        { currentOperation: `ページ${pageNum}処理完了` }
                    );
                }

            } catch (error) {
                console.warn(`⚠️ ページ${pageNum}処理エラー:`, error.message);
                batchText += `--- ページ ${pageNum} (処理エラー) ---\n\n`;
            }
        } else {
            console.warn(`⚠️ ページ${pageNum}が読み込めませんでした`);
            batchText += `--- ページ ${pageNum} (読み込みエラー) ---\n\n`;
        }

        // ページ間でのマイクロGC
        if (pageNum % 2 === 0) {
            await new Promise(resolve => setTimeout(resolve, 10));
        }
    }

    return batchText;
}

// === バッチ後クリーンアップ ===
async function performBatchCleanup(batchIndex, totalBatches) {
    // 毎バッチ後にガベージコレクション
    memoryManager.forceGC();

    // メモリプレッシャー対応
    if (processingState.memoryPressure) {
        console.log('🧹 メモリプレッシャー検知 - 追加クリーンアップ実行');
        await memoryManager.emergencyCleanup();
    }

    // より頻繁なチャンククリーンアップ（10バッチごと）
    if (batchIndex > 0 && batchIndex % 10 === 0) {
        progressiveLoader.clearAll();
        console.log('🗑️ 大容量ファイル用チャンククリア実行');

        // 追加の待機時間でメモリ安定化
        await new Promise(resolve => setTimeout(resolve, ULTRA_LARGE_CONFIG.MEMORY_CLEANUP_DELAY));
    }

    // 進行状況に応じたクリーンアップ間隔調整
    const progressPercent = ((batchIndex + 1) / totalBatches) * 100;
    if (progressPercent > 50 && batchIndex % 5 === 0) {
        // 後半はより頻繁にクリーンアップ
        await new Promise(resolve => setTimeout(resolve, 20));
    }
}

// === 最終クリーンアップ ===
async function finalCleanup() {
    console.log('🧹 最終クリーンアップ開始...');

    // 全リソースクリア
    progressiveLoader.clearAll();

    // 複数回のGC実行
    for (let i = 0; i < 3; i++) {
        memoryManager.forceGC();
        await new Promise(resolve => setTimeout(resolve, 100));
    }

    // メモリ状態のリセット
    processingState.memoryPressure = false;

    console.log('✨ 最終クリーンアップ完了');
}

// === テキスト出力 ===
async function outputProcessedText(text) {
    const outputArea = document.getElementById('output');
    if (outputArea) {
        outputArea.value = text;
        console.log(`📝 テキスト出力完了: ${text.length}文字`);
    }

    // 大容量テキストの場合は分割出力も検討
    if (text.length > 1000000) { // 100万文字以上
        console.log('💾 大容量テキストのため分割ダウンロードを推奨');
        createDownloadLink(text, 'ultra_large_pdf_text.txt');
    }
}

// === ダウンロードリンク作成 ===
function createDownloadLink(text, filename) {
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.textContent = '📥 テキストファイルをダウンロード';
    link.style.cssText = 'display: block; margin: 10px 0; padding: 10px; background: #4ecdc4; color: white; text-decoration: none; border-radius: 5px;';

    const outputArea = document.getElementById('output');
    if (outputArea && outputArea.parentNode) {
        outputArea.parentNode.insertBefore(link, outputArea.nextSibling);
    }

    // メモリリーク防止のためURL解放
    setTimeout(() => URL.revokeObjectURL(url), 60000);
}


// === UI制御とプログレス表示 ===
function showProgressUI() {
    let progressContainer = document.getElementById('progressContainer');

    if (!progressContainer) {
        progressContainer = document.createElement('div');
        progressContainer.id = 'progressContainer';
        progressContainer.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            width: 400px;
            background: rgba(255, 255, 255, 0.95);
            border: 2px solid #4ecdc4;
            border-radius: 10px;
            padding: 20px;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
            z-index: 10000;
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        `;

        progressContainer.innerHTML = `
            <h3 style="margin: 0 0 15px 0; color: #2c3e50; font-size: 18px;">
                🔥 超大容量PDF処理中 (500MB対応)
            </h3>

            <div id="progressText" style="margin-bottom: 10px; font-weight: bold; color: #34495e;">
                準備中...
            </div>

            <progress id="progressBar" value="0" max="100" style="
                width: 100%; 
                height: 20px; 
                border-radius: 10px;
                background: linear-gradient(90deg, #4ecdc4, #45b7aa);
            "></progress>

            <div id="progressDetails" style="
                margin-top: 15px; 
                font-size: 12px; 
                color: #7f8c8d;
                line-height: 1.4;
            "></div>

            <div style="margin-top: 15px; text-align: center;">
                <button id="pauseBtn" onclick="processController.pause()" style="
                    margin: 0 5px; padding: 8px 15px; 
                    background: #f39c12; color: white; border: none; 
                    border-radius: 5px; cursor: pointer; font-size: 12px;
                ">⏸️ 一時停止</button>

                <button id="resumeBtn" onclick="processController.resume()" style="
                    margin: 0 5px; padding: 8px 15px; 
                    background: #27ae60; color: white; border: none; 
                    border-radius: 5px; cursor: pointer; font-size: 12px; display: none;
                ">▶️ 再開</button>

                <button id="stopBtn" onclick="processController.stop()" style="
                    margin: 0 5px; padding: 8px 15px; 
                    background: #e74c3c; color: white; border: none; 
                    border-radius: 5px; cursor: pointer; font-size: 12px;
                ">⏹️ 停止</button>
            </div>
        `;

        document.body.appendChild(progressContainer);
    }

    progressContainer.style.display = 'block';

    // メモリ監視の開始
    startMemoryMonitoring();
}

function hideProgressUI() {
    const progressContainer = document.getElementById('progressContainer');
    if (progressContainer) {
        progressContainer.style.display = 'none';
    }

    // メモリ監視の停止
    stopMemoryMonitoring();
}

// === メモリ監視機能 ===
let memoryMonitorInterval;

function startMemoryMonitoring() {
    if (memoryMonitorInterval) return;

    memoryMonitorInterval = setInterval(() => {
        memoryManager.checkMemoryPressure();

        // メモリ使用量をリアルタイム表示
        if (performance.memory) {
            const usedMB = (performance.memory.usedJSHeapSize / (1024 * 1024)).toFixed(1);
            const limitMB = (performance.memory.jsHeapSizeLimit / (1024 * 1024)).toFixed(1);
            const usage = (performance.memory.usedJSHeapSize / performance.memory.jsHeapSizeLimit * 100).toFixed(1);

            console.log(`💾 メモリ使用状況: ${usedMB}MB / ${limitMB}MB (${usage}%)`);
        }
    }, 5000); // 5秒間隔
}

function stopMemoryMonitoring() {
    if (memoryMonitorInterval) {
        clearInterval(memoryMonitorInterval);
        memoryMonitorInterval = null;
    }
}

// === CSS追加で進行状況表示を強化 ===
function addUltraProgressStyles() {
    const style = document.createElement('style');
    style.textContent = `
        .ultra-progress-details {
            background: #f8f9fa;
            border-radius: 8px;
            padding: 12px;
            margin-top: 10px;
        }

        .metrics-row {
            display: flex;
            justify-content: space-between;
            margin-bottom: 8px;
            font-size: 11px;
        }

        .metrics-row:last-child {
            margin-bottom: 0;
        }

        .current-operation {
            background: #e3f2fd;
            color: #1976d2;
            padding: 6px 10px;
            border-radius: 15px;
            text-align: center;
            margin-top: 8px;
            font-weight: bold;
            animation: pulse 2s infinite;
        }

        @keyframes pulse {
            0% { opacity: 1; }
            50% { opacity: 0.7; }
            100% { opacity: 1; }
        }

        #progressBar::-webkit-progress-bar {
            background-color: #ecf0f1;
            border-radius: 10px;
        }

        #progressBar::-webkit-progress-value {
            background: linear-gradient(90deg, #4ecdc4, #45b7aa);
            border-radius: 10px;
            transition: all 0.3s ease;
        }

        #progressBar.memory-warning::-webkit-progress-value {
            background: linear-gradient(90deg, #ff6b6b, #feca57) !important;
            animation: warning-pulse 1.5s infinite;
        }

        @keyframes warning-pulse {
            0%, 100% { filter: brightness(1); }
            50% { filter: brightness(1.2); }
        }
    `;

    document.head.appendChild(style);
}

// === イベントリスナーとDOMReady ===
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 超大容量PDF処理システム初期化中...');

    // CSS追加
    addUltraProgressStyles();

    // PDF.js workerの設定
    if (typeof pdfjsLib !== 'undefined') {
        pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        console.log('✅ PDF.js Worker設定完了');
    }

    // メイン処理ボタンのイベント設定
    const processBtn = document.getElementById('processBtn');
    if (processBtn) {
        processBtn.addEventListener('click', processUltraLargePDF);
        processBtn.textContent = '🔥 超大容量PDF処理開始 (500MB対応)';
        console.log('✅ 処理ボタン設定完了');
    }

    // ファイル選択時の詳細情報表示
    const fileInput = document.getElementById('pdfFile');
    if (fileInput) {
        fileInput.addEventListener('change', function(e) {
            const file = e.target.files[0];
            if (file) {
                const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
                const maxSizeMB = (ULTRA_LARGE_CONFIG.MAX_FILE_SIZE / (1024 * 1024));

                console.log(`📄 ファイル選択: ${file.name}`);
                console.log(`📏 ファイルサイズ: ${sizeMB}MB (制限: ${maxSizeMB}MB)`);

                if (file.size > ULTRA_LARGE_CONFIG.MAX_FILE_SIZE) {
                    alert(`⚠️ ファイルサイズが制限を超えています\n現在: ${sizeMB}MB\n制限: ${maxSizeMB}MB`);
                } else if (file.size > 100 * 1024 * 1024) { // 100MB以上
                    console.log('🔥 大容量ファイル検出 - 超最適化モードで処理します');
                }
            }
        });
    }

    // キーボードショートカット
    document.addEventListener('keydown', function(e) {
        if (processingState.isProcessing) {
            if (e.code === 'Space') {
                e.preventDefault();
                if (processingState.isPaused) {
                    processController.resume();
                } else {
                    processController.pause();
                }
            } else if (e.code === 'Escape') {
                e.preventDefault();
                processController.stop();
            }
        }
    });

    console.log('✨ 超大容量PDF処理システム初期化完了');
    console.log('📋 操作方法:');
    console.log('   - スペースキー: 一時停止/再開');
    console.log('   - Escキー: 処理停止');
    console.log('   - 対応ファイルサイズ: 最大500MB');
    console.log('   - 対応ページ数: 最大1000ページ');
    console.log('   - バッチサイズ: 5ページ（超最適化）');
});

// === 緊急時のグローバル停止機能 ===
window.emergencyStop = function() {
    console.log('🚨 緊急停止実行!');
    processController.stop();
    finalCleanup();
    hideProgressUI();
    processingState.isProcessing = false;
};

// === 開発者向けデバッグ機能 ===
window.debugUltraLarge = {
    showMemoryStats: () => {
        if (performance.memory) {
            const stats = {
                used: (performance.memory.usedJSHeapSize / (1024 * 1024)).toFixed(2) + 'MB',
                total: (performance.memory.totalJSHeapSize / (1024 * 1024)).toFixed(2) + 'MB',
                limit: (performance.memory.jsHeapSizeLimit / (1024 * 1024)).toFixed(2) + 'MB',
                gcCount: memoryManager.gcCounter,
                memoryPressure: processingState.memoryPressure
            };
            console.table(stats);
            return stats;
        }
        return 'Memory API not available';
    },

    forceGC: () => {
        memoryManager.forceGC();
        console.log('🧹 手動ガベージコレクション実行');
    },

    clearAllChunks: () => {
        progressiveLoader.clearAll();
        console.log('🗑️ 全チャンククリア実行');
    },

    getProcessingState: () => {
        return { ...processingState };
    }
};

console.log('🔧 デバッグ機能: window.debugUltraLarge で利用可能');
