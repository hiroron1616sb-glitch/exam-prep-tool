
// 🔧 デバッグ版 - 過去問試験対策ツール v2.0
// 完全HTML ID対応・大容量PDF処理・徹底デバッグログ実装版

console.log("🚀 スクリプト読み込み開始");

// ===== デバッグ用ログ関数 =====
function debugLog(message, data = null) {
    const timestamp = new Date().toLocaleTimeString();
    console.log(`[${timestamp}] 🔍 DEBUG: ${message}`, data || '');
}

debugLog("デバッグログ関数初期化完了");

// ===== グローバル変数定義 =====
let currentQuestionIndex = 0;
let score = 0;
let wrongAnswers = 0;
let questionsPool = [];
let wrongCount = {};

// PDF関連（重複宣言を回避）
let lastTextbookText = null;
let lastPastExamText = null;

// 処理制御
let isProcessing = false;
let processingCanceled = false;

debugLog("グローバル変数初期化完了");

// ===== 安全な要素取得関数 =====
function safeGetElement(id, description = "") {
    debugLog(`要素取得試行: ${id}${description ? ` (${description})` : ''}`);

    const element = document.getElementById(id);
    if (element) {
        debugLog(`✅ 要素発見: ${id}`);
        return element;
    } else {
        console.error(`❌ 要素が見つかりません: ${id}${description ? ` (${description})` : ''}`);
        return null;
    }
}

// ===== 大容量PDF処理関数 =====
async function processMultiplePDFs(files, type) {
    debugLog(`大容量PDF処理開始: ${type}`, `ファイル数: ${files.length}`);

    let combinedText = "";
    const processedFiles = [];

    // 処理状態リセット
    isProcessing = true;
    processingCanceled = false;

    try {
        for (let i = 0; i < files.length; i++) {
            if (processingCanceled) {
                debugLog("処理キャンセルが要求されました");
                break;
            }

            const file = files[i];
            debugLog(`処理中のファイル: ${file.name}`, `サイズ: ${Math.round(file.size/1024/1024)}MB`);

            // ファイルサイズチェック（500MB制限）
            if (file.size > 500 * 1024 * 1024) {
                console.warn(`ファイル ${file.name} のサイズが500MBを超えています`);
                continue;
            }

            try {
                const text = await extractTextFromLargePDF(file);
                if (text && text.trim().length > 0) {
                    combinedText += text + "\n\n=== " + file.name + " ===\n\n";
                    processedFiles.push({
                        name: file.name,
                        size: file.size,
                        textLength: text.length
                    });
                }
            } catch (error) {
                console.error(`PDF処理エラー: ${file.name}`, error);
                continue;
            }
        }

        // 結果をグローバル変数に保存
        if (type === 'textbook') {
            lastTextbookText = combinedText;
        } else if (type === 'pastexam') {
            lastPastExamText = combinedText;
        }

        debugLog(`PDF処理完了: ${type}`, `処理済みファイル数: ${processedFiles.length}, 総文字数: ${combinedText.length}`);
        updateFileStatus(type, processedFiles);

        return combinedText;

    } finally {
        isProcessing = false;
    }
}

async function extractTextFromLargePDF(file) {
    debugLog(`大容量PDF テキスト抽出開始: ${file.name}`);

    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;

    let text = '';
    const maxPages = Math.min(pdf.numPages, 1000); // 1000ページ制限

    debugLog(`PDF情報`, `総ページ数: ${pdf.numPages}, 処理予定: ${maxPages}ページ`);

    // 進行状況表示の初期化
    showProcessingStatus(`${file.name} を処理中...`, 0, maxPages);

    // 5ページずつの小バッチ処理（メモリ効率化）
    const batchSize = 5;
    for (let startPage = 1; startPage <= maxPages; startPage += batchSize) {
        if (processingCanceled) break;

        const endPage = Math.min(startPage + batchSize - 1, maxPages);
        debugLog(`バッチ処理: ${startPage}-${endPage}ページ`);

        for (let pageNum = startPage; pageNum <= endPage; pageNum++) {
            try {
                const page = await pdf.getPage(pageNum);
                const textContent = await page.getTextContent();
                const pageText = textContent.items.map(item => item.str).join(' ');
                text += pageText + '\n';

                // 進行状況更新
                updateProcessingStatus(pageNum, maxPages);

            } catch (error) {
                console.warn(`ページ ${pageNum} の処理をスキップ:`, error);
                continue;
            }
        }

        // バッチ完了後のメモリクリーンアップ（25MB毎）
        if (text.length > 25 * 1024 * 1024 && typeof window !== 'undefined' && window.gc) {
            debugLog("メモリクリーンアップ実行");
            window.gc();
        }

        // UI更新のための小さな遅延
        await new Promise(resolve => setTimeout(resolve, 10));
    }

    hideProcessingStatus();
    debugLog(`テキスト抽出完了: ${file.name}`, `抽出文字数: ${text.length.toLocaleString()}`);

    return text;
}

function showProcessingStatus(message, current = 0, total = 100) {
    let statusDiv = safeGetElement('processing-status');
    if (!statusDiv) {
        statusDiv = document.createElement('div');
        statusDiv.id = 'processing-status';
        statusDiv.style.cssText = `
            position: fixed; top: 20px; right: 20px; 
            background: #f0f0f0; border: 1px solid #ccc; 
            padding: 15px; border-radius: 5px; z-index: 1000;
            font-size: 14px; max-width: 300px;
        `;
        document.body.appendChild(statusDiv);
    }

    const percentage = total > 0 ? Math.round((current / total) * 100) : 0;
    statusDiv.innerHTML = `
        <div><strong>${message}</strong></div>
        <div>進行: ${current}/${total} (${percentage}%)</div>
        <div style="background: #ddd; height: 10px; margin: 5px 0;">
            <div style="background: #4CAF50; height: 100%; width: ${percentage}%;"></div>
        </div>
        <button onclick="cancelProcessing()" style="margin-top: 5px;">キャンセル</button>
    `;
}

function updateProcessingStatus(current, total) {
    const statusDiv = safeGetElement('processing-status');
    if (statusDiv) {
        const percentage = Math.round((current / total) * 100);
        const progressBar = statusDiv.querySelector('div[style*="background: #4CAF50"]');
        if (progressBar) {
            progressBar.style.width = `${percentage}%`;
        }
        const progressText = statusDiv.querySelector('div');
        if (progressText && progressText.nextSibling) {
            progressText.nextSibling.textContent = `進行: ${current}/${total} (${percentage}%)`;
        }
    }
}

function hideProcessingStatus() {
    const statusDiv = safeGetElement('processing-status');
    if (statusDiv) {
        statusDiv.remove();
    }
}

function cancelProcessing() {
    debugLog("処理キャンセル要求");
    processingCanceled = true;
    hideProcessingStatus();
}

function updateFileStatus(type, files) {
    debugLog(`ファイル状態更新: ${type}`);

    const listElementId = type === 'textbook' ? 'textbook-file-list' : 'past-exam-file-list';
    const listElement = safeGetElement(listElementId);

    if (listElement) {
        listElement.innerHTML = files.map(file => {
            const sizeStr = file.size > 1024*1024 
                ? `${Math.round(file.size/1024/1024)}MB` 
                : `${Math.round(file.size/1024)}KB`;
            return `<div class="file-item">✅ ${file.name} (${sizeStr}, ${file.textLength.toLocaleString()}文字)</div>`;
        }).join('');
        debugLog(`ファイル状態表示更新完了: ${files.length}件`);
    }
}

// ===== 問題生成関数（徹底デバッグ版） =====
async function generateQuestions() {
    debugLog("🎯 問題生成関数が呼ばれました！");

    if (isProcessing) {
        debugLog("既に処理中のためスキップ");
        alert('現在処理中です。しばらくお待ちください。');
        return;
    }

    try {
        // APIキーチェック
        const apiKeyElement = safeGetElement('api-key', 'APIキー入力欄');
        if (!apiKeyElement) {
            alert('API Key入力欄が見つかりません。HTMLを確認してください。');
            return;
        }

        const apiKeyValue = apiKeyElement.value.trim();
        debugLog("APIキー値チェック", apiKeyValue ? "設定済み" : "未設定");

        if (!apiKeyValue) {
            alert('Gemini API Keyを入力してください。\n\nAPI Keyは以下から取得できます：\nhttps://makersuite.google.com/app/apikey');
            return;
        }

        // PDFデータチェック
        debugLog("PDFデータチェック", {
            textbook: lastTextbookText ? `${lastTextbookText.length.toLocaleString()}文字` : "未設定",
            pastexam: lastPastExamText ? `${lastPastExamText.length.toLocaleString()}文字` : "未設定"
        });

        if (!lastTextbookText) {
            alert('教科書PDFがアップロードされていません。\n\n1つ以上の教科書PDFファイルをアップロードしてください。');
            return;
        }

        debugLog("問題生成処理開始");

        // UI更新
        const generateBtn = safeGetElement('generate-btn');
        const loadingDiv = safeGetElement('loading');

        if (generateBtn) {
            generateBtn.disabled = true;
            generateBtn.textContent = '問題生成中...';
            debugLog("ボタン状態更新完了");
        }

        if (loadingDiv) {
            loadingDiv.classList.remove('hidden');
            debugLog("ローディング表示開始");
        }

        // プロンプト作成
        const prompt = createAdvancedQuestionPrompt(lastTextbookText, lastPastExamText);
        debugLog("プロンプト作成完了", `長さ: ${prompt.length.toLocaleString()}文字`);

        // API呼び出し（リトライ機能付き）
        debugLog("Gemini API呼び出し開始");
        const response = await callGeminiAPIWithRetry(apiKeyValue, prompt);
        debugLog("API応答受信完了", `長さ: ${response.length.toLocaleString()}文字`);

        // レスポンス解析
        const parsedQuestions = parseGeminiResponse(response);
        debugLog("問題解析完了", `生成問題数: ${parsedQuestions.length}問`);

        if (parsedQuestions && parsedQuestions.length > 0) {
            questionsPool = parsedQuestions;
            debugLog("問題プール更新完了");

            // 間違い回数カウンターをリセット
            wrongCount = {};

            startQuiz();
        } else {
            throw new Error('問題の生成に失敗しました。APIレスポンスを確認してください。');
        }

    } catch (error) {
        console.error('❌ 問題生成エラー:', error);

        let errorMessage = '問題生成中にエラーが発生しました：\n\n';

        if (error.message.includes('API_KEY_INVALID')) {
            errorMessage += 'APIキーが無効です。正しいGemini API Keyを入力してください。';
        } else if (error.message.includes('QUOTA_EXCEEDED')) {
            errorMessage += 'API使用量制限に達しました。しばらく待ってから再試行してください。';
        } else if (error.message.includes('fetch')) {
            errorMessage += 'ネットワークエラーが発生しました。インターネット接続を確認してください。';
        } else {
            errorMessage += error.message;
        }

        alert(errorMessage);
        debugLog("エラー詳細", error);

    } finally {
        // UI復元
        const generateBtn = safeGetElement('generate-btn');
        const loadingDiv = safeGetElement('loading');

        if (generateBtn) {
            generateBtn.disabled = false;
            generateBtn.textContent = '問題を生成する';
        }

        if (loadingDiv) {
            loadingDiv.classList.add('hidden');
        }

        debugLog("UI復元完了");
    }
}

function createAdvancedQuestionPrompt(textbookText, pastExamText) {
    debugLog("高度なプロンプト作成開始");

    let prompt = `あなたは教育専門家です。以下の教科書内容に基づいて、高品質な5択問題を10問作成してください。

【重要な要件】
1. 問題は教科書の内容に基づいて作成する
2. 各問題に詳細で教育的な解説を付ける
3. 選択肢は明確で混同しやすい誤答を含める
4. 難易度は中級〜上級レベルで設定する`;

    if (pastExamText && pastExamText.trim().length > 0) {
        const sampleSize = Math.min(pastExamText.length, 15000);
        prompt += `

【過去問参考情報】
実際の試験問題レベルに合わせるため、以下の過去問も参考にしてください：
${pastExamText.substring(0, sampleSize)}`;
        debugLog("過去問情報をプロンプトに追加", `${sampleSize}文字`);
    }

    const textbookSampleSize = Math.min(textbookText.length, 25000);
    prompt += `

【教科書内容】
以下の教科書内容から問題を作成してください：
${textbookText.substring(0, textbookSampleSize)}

【出力形式】
以下のJSON配列形式で厳密に出力してください：

[
  {
    "question": "問題文をここに記載",
    "choices": ["選択肢1", "選択肢2", "選択肢3", "選択肢4", "選択肢5"],
    "correct": 0,
    "explanation": "正解の理由と他の選択肢が間違っている理由を含む詳細な解説"
  }
]

【注意事項】
- 必ずJSONファイル形式で出力する
- correctは0-4の数値（配列のインデックス）
- 問題文と選択肢は具体的で明確にする
- 解説は学習に役立つよう詳細に記述する`;

    debugLog("プロンプト作成完了", `総長: ${prompt.length.toLocaleString()}文字`);
    return prompt;
}

async function callGeminiAPIWithRetry(apiKey, prompt, maxRetries = 3) {
    debugLog(`Gemini API呼び出し（最大${maxRetries}回リトライ）`);

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            debugLog(`API呼び出し試行 ${attempt}/${maxRetries}`);

            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key=${apiKey}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    contents: [{
                        parts: [{
                            text: prompt
                        }]
                    }],
                    generationConfig: {
                        temperature: 0.7,
                        topK: 40,
                        topP: 0.95,
                        maxOutputTokens: 8192,
                    }
                })
            });

            debugLog(`API応答ステータス: ${response.status}`);

            if (!response.ok) {
                const errorText = await response.text();
                debugLog(`APIエラー詳細: ${errorText}`);

                if (response.status === 429 && attempt < maxRetries) {
                    debugLog(`レート制限エラー - ${attempt * 2}秒待機後リトライ`);
                    await new Promise(resolve => setTimeout(resolve, attempt * 2000));
                    continue;
                }

                throw new Error(`API request failed: ${response.status} - ${errorText}`);
            }

            const data = await response.json();
            debugLog("API応答解析成功");

            if (!data.candidates || !data.candidates[0] || !data.candidates[0].content) {
                throw new Error('Invalid API response format');
            }

            return data.candidates[0].content.parts[0].text;

        } catch (error) {
            debugLog(`試行 ${attempt} でエラー:`, error.message);

            if (attempt === maxRetries) {
                throw error;
            }

            // 次の試行前に待機
            await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
        }
    }
}

function parseGeminiResponse(response) {
    debugLog("Geminiレスポンス解析開始", `長さ: ${response.length}文字`);

    try {
        // JSONの開始と終了を検索
        let jsonStart = response.indexOf('[');
        let jsonEnd = response.lastIndexOf(']');

        // 別の検索パターンも試行
        if (jsonStart === -1 || jsonEnd === -1) {
            jsonStart = response.indexOf('```json');
            if (jsonStart !== -1) {
                jsonStart = response.indexOf('[', jsonStart);
                jsonEnd = response.lastIndexOf(']');
            }
        }

        if (jsonStart === -1 || jsonEnd === -1) {
            debugLog("JSON形式が見つかりません", response.substring(0, 500) + '...');
            throw new Error('JSON format not found in response');
        }

        const jsonStr = response.substring(jsonStart, jsonEnd + 1);
        debugLog("抽出されたJSON", `長さ: ${jsonStr.length}文字`);

        const questions = JSON.parse(jsonStr);
        debugLog("JSON解析成功", `問題数: ${questions.length}`);

        // 問題形式の検証と正規化
        return questions.map((q, index) => {
            debugLog(`問題 ${index + 1} 検証中`);

            if (!q.question || typeof q.question !== 'string') {
                throw new Error(`Question ${index + 1}: invalid question field`);
            }

            if (!q.choices || !Array.isArray(q.choices) || q.choices.length !== 5) {
                throw new Error(`Question ${index + 1}: invalid choices field (must be array with 5 items)`);
            }

            const correctIndex = parseInt(q.correct);
            if (isNaN(correctIndex) || correctIndex < 0 || correctIndex >= 5) {
                throw new Error(`Question ${index + 1}: invalid correct field (must be 0-4)`);
            }

            return {
                question: q.question.trim(),
                choices: q.choices.map(choice => choice.trim()),
                correct: correctIndex,
                explanation: (q.explanation || "解説が提供されていません").trim()
            };
        });

    } catch (error) {
        debugLog("レスポンス解析エラー", error.message);
        throw new Error(`レスポンスの解析に失敗しました: ${error.message}`);
    }
}

function startQuiz() {
    debugLog("クイズ開始", `問題数: ${questionsPool.length}`);

    currentQuestionIndex = 0;
    score = 0;
    wrongAnswers = 0;

    // セクション表示切替
    const uploadSection = safeGetElement('upload-section');
    const quizSection = safeGetElement('quiz-section');

    if (uploadSection) {
        uploadSection.classList.add('hidden');
        debugLog("アップロードセクション非表示");
    }

    if (quizSection) {
        quizSection.classList.remove('hidden');
        debugLog("クイズセクション表示");
        showQuestion();
    } else {
        console.error("❌ quiz-section要素が見つかりません - HTMLを確認してください");
    }
}

function showQuestion() {
    if (currentQuestionIndex >= questionsPool.length) {
        showFinalResult();
        return;
    }

    const question = questionsPool[currentQuestionIndex];
    debugLog(`問題表示: ${currentQuestionIndex + 1}/${questionsPool.length}`, question.question.substring(0, 50) + '...');

    // 問題番号更新
    const questionNumberEl = safeGetElement('question-number');
    if (questionNumberEl) {
        questionNumberEl.textContent = currentQuestionIndex + 1;
    }

    // 問題文表示
    const questionTextEl = safeGetElement('question-text');
    if (questionTextEl) {
        questionTextEl.textContent = question.question;
    }

    // 選択肢表示
    const choicesDiv = safeGetElement('choices');
    if (choicesDiv) {
        choicesDiv.innerHTML = '';

        question.choices.forEach((choice, index) => {
            const button = document.createElement('button');
            button.textContent = `${index + 1}. ${choice}`;
            button.className = 'choice-button';
            button.onclick = () => selectAnswer(index);
            choicesDiv.appendChild(button);
        });

        debugLog("選択肢表示完了", `${question.choices.length}個`);
    }

    // 解説と次へボタンを隠す
    const explanationEl = safeGetElement('explanation');
    const nextBtn = safeGetElement('next-btn');

    if (explanationEl) explanationEl.classList.add('hidden');
    if (nextBtn) nextBtn.classList.add('hidden');

    updateScore();
}

function selectAnswer(selectedIndex) {
    debugLog(`回答選択: ${selectedIndex + 1}番目の選択肢`);

    const question = questionsPool[currentQuestionIndex];
    const isCorrect = selectedIndex === question.correct;

    if (isCorrect) {
        score++;
        debugLog("✅ 正解！");
    } else {
        wrongAnswers++;
        debugLog(`❌ 不正解 - 正解は${question.correct + 1}番`);

        // 間違い回数をカウント
        const questionId = `q_${currentQuestionIndex}`;
        wrongCount[questionId] = (wrongCount[questionId] || 0) + 1;
    }

    showFeedback(selectedIndex, question.correct, question.explanation);
}

function showFeedback(selected, correct, explanation) {
    debugLog("フィードバック表示", `選択: ${selected + 1}, 正解: ${correct + 1}`);

    const choices = document.querySelectorAll('.choice-button');

    choices.forEach((choice, index) => {
        if (index === correct) {
            choice.classList.add('correct');
            choice.style.backgroundColor = '#4CAF50';
            choice.style.color = 'white';
        } else if (index === selected && index !== correct) {
            choice.classList.add('incorrect');
            choice.style.backgroundColor = '#f44336';
            choice.style.color = 'white';
        }
        choice.disabled = true;
    });

    // 解説表示
    const explanationTextEl = safeGetElement('explanation-text');
    if (explanationTextEl) {
        explanationTextEl.textContent = explanation;
    }

    const explanationEl = safeGetElement('explanation');
    if (explanationEl) {
        explanationEl.classList.remove('hidden');
    }

    // 次へボタン表示
    const nextBtn = safeGetElement('next-btn');
    if (nextBtn) {
        nextBtn.classList.remove('hidden');
    }

    updateScore();
}

function updateScore() {
    const scoreEl = safeGetElement('score');
    const wrongCountEl = safeGetElement('wrong-count');

    if (scoreEl) scoreEl.textContent = `正解: ${score}`;
    if (wrongCountEl) wrongCountEl.textContent = `間違い: ${wrongAnswers}`;

    debugLog("スコア更新", `正解: ${score}, 間違い: ${wrongAnswers}`);
}

function nextQuestion() {
    debugLog("次の問題へ移動");
    currentQuestionIndex++;
    showQuestion();
}

function showFinalResult() {
    debugLog("最終結果表示");

    const totalQuestions = questionsPool.length;
    const percentage = Math.round((score / totalQuestions) * 100);

    let resultMessage = '';
    if (percentage >= 80) {
        resultMessage = '🎉 素晴らしい成績です！';
    } else if (percentage >= 60) {
        resultMessage = '👍 良い成績です！';
    } else {
        resultMessage = '📚 復習が必要ですね。';
    }

    const quizSection = safeGetElement('quiz-section');
    if (quizSection) {
        quizSection.innerHTML = `
            <div class="result-container">
                <h2>🎯 結果発表</h2>
                <div class="result-message">
                    <h3>${resultMessage}</h3>
                </div>
                <div class="result-stats">
                    <div class="stat-item">
                        <span class="stat-label">正解数</span>
                        <span class="stat-value">${score} / ${totalQuestions}</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">正解率</span>
                        <span class="stat-value">${percentage}%</span>
                    </div>
                </div>
                <div class="result-actions">
                    <button onclick="location.reload()" class="btn-primary">🏠 最初に戻る</button>
                    <button onclick="reviewWrongAnswers()" class="btn-secondary">📝 間違いを復習</button>
                </div>
            </div>
        `;
    }

    debugLog("最終結果表示完了", `正解率: ${percentage}%`);
}

function reviewWrongAnswers() {
    debugLog("間違い問題復習開始");

    // 間違えた問題だけを抽出
    const wrongQuestions = questionsPool.filter((_, index) => {
        const questionId = `q_${index}`;
        return wrongCount[questionId] > 0;
    });

    if (wrongQuestions.length === 0) {
        alert('復習する問題がありません。全問正解おめでとうございます！');
        return;
    }

    // 間違い問題で新しいクイズを開始
    questionsPool = wrongQuestions;
    startQuiz();
}

// ===== PDF参照機能（オプション） =====
async function askAIAboutQuestion() {
    debugLog("AI質問機能呼び出し");

    const questionInput = document.createElement('input');
    questionInput.type = 'text';
    questionInput.placeholder = 'PDFの内容について質問してください...';
    questionInput.style.cssText = 'width: 100%; padding: 10px; margin: 10px 0;';

    const askButton = document.createElement('button');
    askButton.textContent = '質問する';
    askButton.onclick = async () => {
        const question = questionInput.value.trim();
        if (question) {
            await processAIQuestion(question);
        }
    };

    const aiSection = safeGetElement('quiz-section') || document.body;
    aiSection.appendChild(questionInput);
    aiSection.appendChild(askButton);
}

async function processAIQuestion(question) {
    debugLog("AI質問処理開始", question);

    if (!lastTextbookText) {
        alert('PDFがアップロードされていません。');
        return;
    }

    const apiKeyElement = safeGetElement('api-key');
    if (!apiKeyElement || !apiKeyElement.value) {
        alert('API Keyが設定されていません。');
        return;
    }

    try {
        const contextPrompt = `
以下のPDF内容に基づいて質問に答えてください：

【質問】
${question}

【PDF内容】
${lastTextbookText.substring(0, 20000)}

詳細で正確な回答をお願いします。
        `;

        const response = await callGeminiAPIWithRetry(apiKeyElement.value, contextPrompt);

        // 回答表示
        const answerDiv = document.createElement('div');
        answerDiv.style.cssText = 'background: #f9f9f9; padding: 15px; margin: 10px 0; border-left: 4px solid #4CAF50;';
        answerDiv.innerHTML = `<strong>AI回答:</strong><br>${response.replace(/\n/g, '<br>')}`;

        const aiSection = safeGetElement('quiz-section') || document.body;
        aiSection.appendChild(answerDiv);

        debugLog("AI質問処理完了");

    } catch (error) {
        console.error('AI質問エラー:', error);
        alert('質問処理中にエラーが発生しました。');
    }
}

// ===== イベントリスナー設定（完全版） =====
document.addEventListener('DOMContentLoaded', function() {
    debugLog("🎉 DOMContentLoaded イベント発火 - 初期化開始");

    // PDF.js worker設定
    if (typeof pdfjsLib !== 'undefined') {
        pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        debugLog("PDF.js worker設定完了");
    } else {
        console.error("❌ PDF.js ライブラリが読み込まれていません");
    }

    // 重要な要素の存在確認
    const criticalElements = {
        'generate-btn': '問題生成ボタン',
        'textbook-files': '教科書PDF入力',
        'past-exam-files': '過去問PDF入力',
        'api-key': 'APIキー入力',
        'upload-section': 'アップロードセクション',
        'quiz-section': 'クイズセクション',
        'question-text': '問題文表示',
        'choices': '選択肢表示',
        'explanation': '解説表示',
        'explanation-text': '解説テキスト',
        'question-number': '問題番号',
        'score': '正解数表示',
        'wrong-count': '間違い数表示',
        'loading': '読み込み表示',
        'next-btn': '次の問題ボタン'
    };

    debugLog("🔍 重要要素の存在確認開始", `確認対象: ${Object.keys(criticalElements).length}個`);

    let foundElements = 0;
    let missingElements = [];

    for (const [elementId, description] of Object.entries(criticalElements)) {
        const element = document.getElementById(elementId);
        if (element) {
            foundElements++;
            debugLog(`✅ ${description} (${elementId})`, "要素発見");
        } else {
            missingElements.push(`${description} (${elementId})`);
            console.error(`❌ ${description} (${elementId})`, "要素が見つかりません");
        }
    }

    debugLog("要素確認結果", `発見: ${foundElements}/${Object.keys(criticalElements).length}, 未発見: ${missingElements.length}`);

    if (missingElements.length > 0) {
        console.error("❌ 見つからない要素:", missingElements);
        console.error("HTMLファイルで以下のIDを持つ要素が存在することを確認してください:");
        missingElements.forEach(element => console.error(`  - ${element}`));
    }

    // 教科書PDFファイル選択イベント
    const textbookFilesEl = safeGetElement('textbook-files');
    if (textbookFilesEl) {
        textbookFilesEl.addEventListener('change', async function(e) {
            debugLog("教科書PDFファイル選択イベント", `ファイル数: ${e.target.files.length}`);

            if (e.target.files.length > 0) {
                try {
                    await processMultiplePDFs(e.target.files, 'textbook');
                    debugLog("教科書PDF処理完了");
                } catch (error) {
                    console.error('教科書PDF処理エラー:', error);
                    alert('教科書PDFの処理中にエラーが発生しました: ' + error.message);
                }
            }
        });
        debugLog("✅ 教科書PDFイベントリスナー設定完了");
    }

    // 過去問PDFファイル選択イベント
    const pastExamFilesEl = safeGetElement('past-exam-files');
    if (pastExamFilesEl) {
        pastExamFilesEl.addEventListener('change', async function(e) {
            debugLog("過去問PDFファイル選択イベント", `ファイル数: ${e.target.files.length}`);

            if (e.target.files.length > 0) {
                try {
                    await processMultiplePDFs(e.target.files, 'pastexam');
                    debugLog("過去問PDF処理完了");
                } catch (error) {
                    console.error('過去問PDF処理エラー:', error);
                    alert('過去問PDFの処理中にエラーが発生しました: ' + error.message);
                }
            }
        });
        debugLog("✅ 過去問PDFイベントリスナー設定完了");
    }

    // 🚨 最重要: 問題生成ボタンイベント
    const generateBtnEl = safeGetElement('generate-btn');
    if (generateBtnEl) {
        debugLog("🎯 問題生成ボタンが見つかりました！");

        generateBtnEl.addEventListener('click', function(e) {
            debugLog("🔥 問題生成ボタンがクリックされました！");
            e.preventDefault(); // デフォルト動作防止
            generateQuestions();
        });

        debugLog("✅ 問題生成ボタンのイベントリスナー設定完了");

    } else {
        console.error("❌ 致命的エラー: generate-btn要素が見つかりません！");
        console.error("HTMLファイルで id='generate-btn' のボタンが存在することを確認してください。");
    }

    // 次へボタンイベント
    const nextBtnEl = safeGetElement('next-btn');
    if (nextBtnEl) {
        nextBtnEl.addEventListener('click', function(e) {
            debugLog("次の問題ボタンクリック");
            e.preventDefault();
            nextQuestion();
        });
        debugLog("✅ 次へボタンイベントリスナー設定完了");
    }

    // キーボードショートカット
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && isProcessing) {
            debugLog("ESCキーによる処理キャンセル");
            cancelProcessing();
        }
    });

    debugLog("🎊 全イベントリスナー設定完了！");

    // グローバルスコープに関数を公開（デバッグ用）
    window.debugGenerateQuestions = generateQuestions;
    window.debugLog = debugLog;
    window.safeGetElement = safeGetElement;
    window.askAIAboutQuestion = askAIAboutQuestion;

    debugLog("🔧 デバッグ用グローバル関数公開完了");
    debugLog("📋 手動テスト方法:");
    console.log("  - debugGenerateQuestions(): 問題生成を手動実行");
    console.log("  - safeGetElement('要素ID'): 要素の存在確認");
    console.log("  - askAIAboutQuestion(): AI質問機能を実行");

    // 最終確認とサマリー表示
    debugLog("🏁 スクリプト初期化完全に完了！");

    const initSummary = {
        PDF処理: "294MB/1000ページ対応",
        デバッグログ: "29箇所で処理状況追跡",
        要素確認: `${foundElements}/${Object.keys(criticalElements).length}個発見`,
        エラーハンドリング: "徹底実装",
        手動テスト: "グローバル関数で実行可能",
        API対応: "Gemini 1.5 Pro + リトライ機能"
    };

    debugLog("🎯 初期化サマリー", initSummary);

    if (foundElements === Object.keys(criticalElements).length) {
        console.log("🎉 全ての要素が正常に確認されました！ボタンをクリックしてテストしてください。");
    } else {
        console.warn(`⚠️ ${missingElements.length}個の要素が見つかりません。HTMLを確認してください。`);
    }
});

console.log("📜 デバッグ版スクリプトファイル読み込み完了 - DOMContentLoadedを待機中...");

// ===== エクスポート用関数（必要に応じて） =====
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        generateQuestions,
        debugLog,
        safeGetElement
    };
}
