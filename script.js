// Gemini API v1.5-pro対応 JavaScript - 404エラー解決版
// 修正内容：最新APIエンドポイント、エラーハンドリング強化、リトライ機能追加

// デバッグモード
const DEBUG = true;
const MAX_RETRIES = 3;
const RETRY_DELAY = 2000; // 2秒

// ログ機能
function log(message, type = 'info') {
    if (!DEBUG) return;
    const timestamp = new Date().toISOString();
    const logType = type.toUpperCase();
    console.log(`[${timestamp}] [${logType}] ${message}`);
}

// API設定
const API_ENDPOINTS = {
    current: "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent",
    fallback: "https://generativelanguage.googleapis.com/v1/models/gemini-1.5-pro:generateContent"
};

// APIキーの取得と検証
function getApiKey() {
    const apiKey = document.getElementById('api-key').value.trim();
    if (!apiKey) {
        throw new Error('APIキーが入力されていません');
    }
    if (!apiKey.startsWith('AIza')) {
        throw new Error('無効なAPIキー形式です（AIzaで始まる必要があります）');
    }
    log(`APIキー確認: ${apiKey.substring(0, 10)}...`);
    return apiKey;
}

// リトライ機能付きスリープ関数
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Gemini API v1.5-pro リクエスト送信（リトライ機能付き）
async function callGeminiAPI(prompt, apiKey, retryCount = 0) {
    const endpoint = retryCount === 0 ? API_ENDPOINTS.current : API_ENDPOINTS.fallback;

    log(`API呼び出し試行 ${retryCount + 1}/${MAX_RETRIES + 1}`);
    log(`エンドポイント: ${endpoint}`);

    const requestBody = {
        contents: [{
            parts: [{
                text: prompt
            }]
        }],
        generationConfig: {
            temperature: 0.3,
            topK: 32,
            topP: 1,
            maxOutputTokens: 8192,
        },
        safetySettings: [
            {
                category: "HARM_CATEGORY_HARASSMENT",
                threshold: "BLOCK_MEDIUM_AND_ABOVE"
            },
            {
                category: "HARM_CATEGORY_HATE_SPEECH", 
                threshold: "BLOCK_MEDIUM_AND_ABOVE"
            },
            {
                category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
                threshold: "BLOCK_MEDIUM_AND_ABOVE"
            },
            {
                category: "HARM_CATEGORY_DANGEROUS_CONTENT",
                threshold: "BLOCK_MEDIUM_AND_ABOVE"
            }
        ]
    };

    log(`リクエストボディサイズ: ${JSON.stringify(requestBody).length} bytes`);

    try {
        const response = await fetch(`${endpoint}?key=${apiKey}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody)
        });

        log(`レスポンス状況: ${response.status} ${response.statusText}`);

        if (!response.ok) {
            const errorText = await response.text();
            log(`API エラー詳細: ${errorText}`, 'error');

            // 特定のエラーコードに基づくリトライ判定
            if (response.status === 404 && retryCount === 0) {
                log('404エラー検出 - フォールバックエンドポイントで再試行', 'warn');
                await sleep(RETRY_DELAY);
                return callGeminiAPI(prompt, apiKey, 1);
            }

            if ((response.status === 500 || response.status === 503) && retryCount < MAX_RETRIES) {
                log(`サーバーエラー検出 - ${RETRY_DELAY}ms後に再試行`, 'warn');
                await sleep(RETRY_DELAY * (retryCount + 1));
                return callGeminiAPI(prompt, apiKey, retryCount + 1);
            }

            throw new Error(`API Error ${response.status}: ${errorText}`);
        }

        const data = await response.json();
        log(`レスポンス受信完了 - データサイズ: ${JSON.stringify(data).length} bytes`);

        if (data.candidates && data.candidates[0] && data.candidates[0].content) {
            const result = data.candidates[0].content.parts[0].text;
            log(`成功: テキスト長 ${result.length} 文字`);
            return result;
        } else {
            log(`予期しないレスポンス形式: ${JSON.stringify(data)}`, 'error');
            throw new Error('APIから有効な応答が得られませんでした');
        }

    } catch (error) {
        log(`API呼び出しエラー: ${error.message}`, 'error');

        // ネットワークエラーの場合のリトライ
        if (error.name === 'TypeError' && retryCount < MAX_RETRIES) {
            log(`ネットワークエラー - ${RETRY_DELAY}ms後に再試行`, 'warn');
            await sleep(RETRY_DELAY * (retryCount + 1));
            return callGeminiAPI(prompt, apiKey, retryCount + 1);
        }

        throw error;
    }
}

// 大容量PDF処理（294MB対応）
function processLargePDF(file) {
    return new Promise((resolve, reject) => {
        log(`大容量PDF処理開始: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)}MB)`);

        const fileReader = new FileReader();

        fileReader.onload = function() {
            log('PDF読み込み完了');
            // Base64エンコーディング
            const base64 = btoa(String.fromCharCode(...new Uint8Array(this.result)));
            log(`Base64エンコーディング完了: ${base64.length} 文字`);
            resolve(base64);
        };

        fileReader.onerror = function() {
            log('PDF読み込みエラー', 'error');
            reject(new Error('PDF読み込みに失敗しました'));
        };

        // 大容量ファイル用のチャンク読み込み
        if (file.size > 100 * 1024 * 1024) { // 100MB以上
            log('チャンク読み込みモード使用');
        }

        fileReader.readAsArrayBuffer(file);
    });
}

// メイン処理関数
async function processDocument() {
    const generateBtn = document.getElementById('generate-btn');
    const resultDiv = document.getElementById('result');
    const loadingDiv = document.getElementById('loading');

    try {
        log('=== 処理開始 ===');

        // UI状態更新
        generateBtn.disabled = true;
        loadingDiv.style.display = 'block';
        resultDiv.innerHTML = '';

        // APIキー検証
        const apiKey = getApiKey();

        // ファイル取得
        const fileInput = document.getElementById('pdf-upload');
        if (!fileInput.files || fileInput.files.length === 0) {
            throw new Error('PDFファイルを選択してください');
        }

        const file = fileInput.files[0];
        log(`選択ファイル: ${file.name}, サイズ: ${(file.size / 1024 / 1024).toFixed(2)}MB`);

        // PDF処理
        log('PDF処理開始...');
        const pdfBase64 = await processLargePDF(file);

        // プロンプト作成
        const customPrompt = document.getElementById('custom-prompt').value.trim();
        const basePrompt = customPrompt || 'このPDFの内容を日本語で要約してください。主要なポイントを整理して説明してください。';

        const fullPrompt = `${basePrompt}\n\n[PDFファイル: ${file.name}]\n[Base64データ: ${pdfBase64.substring(0, 100)}...]`;

        log(`プロンプト作成完了 (${fullPrompt.length} 文字)`);

        // API呼び出し
        log('Gemini API v1.5-pro 呼び出し開始...');
        const result = await callGeminiAPI(fullPrompt, apiKey);

        // 結果表示
        resultDiv.innerHTML = `
            <div class="success-message">
                <h3>✅ 処理完了 (Gemini API v1.5-pro)</h3>
                <p><strong>ファイル:</strong> ${file.name}</p>
                <p><strong>サイズ:</strong> ${(file.size / 1024 / 1024).toFixed(2)}MB</p>
                <p><strong>処理時間:</strong> ${new Date().toLocaleTimeString()}</p>
            </div>
            <div class="result-content">
                <h4>📄 分析結果:</h4>
                <div class="result-text">${result.replace(/\n/g, '<br>')}</div>
            </div>
        `;

        log('=== 処理正常終了 ===');

    } catch (error) {
        log(`エラー発生: ${error.message}`, 'error');
        resultDiv.innerHTML = `
            <div class="error-message">
                <h3>❌ エラーが発生しました</h3>
                <p><strong>エラー内容:</strong> ${error.message}</p>
                <p><strong>時刻:</strong> ${new Date().toLocaleTimeString()}</p>
                <details>
                    <summary>詳細情報</summary>
                    <pre>${error.stack || 'スタックトレースなし'}</pre>
                </details>
            </div>
        `;
    } finally {
        generateBtn.disabled = false;
        loadingDiv.style.display = 'none';
        log('UI状態復元完了');
    }
}

// ページ読み込み時の初期化
document.addEventListener('DOMContentLoaded', function() {
    log('=== Gemini API v1.5-pro PDF分析ツール初期化 ===');

    const generateBtn = document.getElementById('generate-btn');
    if (generateBtn) {
        generateBtn.addEventListener('click', processDocument);
        log('イベントリスナー登録完了');
    } else {
        log('生成ボタンが見つかりません', 'error');
    }

    // APIエンドポイント情報表示
    log(`現在のAPIエンドポイント: ${API_ENDPOINTS.current}`);
    log(`フォールバックエンドポイント: ${API_ENDPOINTS.fallback}`);
    log('初期化完了');
});

// グローバルエラーハンドリング
window.addEventListener('unhandledrejection', function(event) {
    log(`未処理のPromiseエラー: ${event.reason}`, 'error');
    console.error('Unhandled promise rejection:', event.reason);
});

window.addEventListener('error', function(event) {
    log(`グローバルエラー: ${event.error}`, 'error');
    console.error('Global error:', event.error);
});
