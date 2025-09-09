// ========================================
// 確実に動作するシンプル版script.js
// デバッグログ豊富・294MB対応・ID完全対応版
// ========================================

console.log("🚀 Script.js開始 - 全機能デバッグモード");

// ========================================
// グローバル変数とPDF.jsセットアップ
// ========================================

// PDF.js の Worker 設定
console.log("📚 PDF.js Worker設定中...");
if (typeof pdfjsLib !== 'undefined') {
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.11.338/pdf.worker.min.js';
    console.log("✅ PDF.js Worker設定完了");
} else {
    console.error("❌ PDF.js ライブラリが読み込まれていません");
}

// グローバル変数
let questions = [];
let currentQuestionIndex = 0;
let correctAnswers = 0;
let wrongAnswers = 0;
let wrongQuestions = [];
let isReviewMode = false;
let lastTextbookText = '';
let lastPastExamText = '';

console.log("✅ グローバル変数初期化完了");

// ========================================
// DOM読み込み完了後の初期化
// ========================================

document.addEventListener('DOMContentLoaded', function() {
    console.log("🎯 DOMContentLoaded - 要素ID検証開始");

    // 重要な要素のID存在確認
    const criticalElements = [
        'generate-btn',
        'textbook-files', 
        'past-exam-files',
        'api-key',
        'quiz-section',
        'question-text',
        'choices',
        'explanation',
        'next-btn',
        'loading'
    ];

    let allElementsFound = true;
    criticalElements.forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            console.log(`✅ 要素発見: ${id}`);
        } else {
            console.error(`❌ 要素未発見: ${id}`);
            allElementsFound = false;
        }
    });

    if (allElementsFound) {
        console.log("🎉 全重要要素が発見されました - イベントリスナー設定開始");
        initializeEventListeners();
    } else {
        console.error("💥 重要な要素が不足しています - HTMLファイルを確認してください");
    }
});

// ========================================
// イベントリスナー初期化
// ========================================

function initializeEventListeners() {
    console.log("🔗 イベントリスナー設定開始");

    // 生成ボタンのイベントリスナー
    const generateBtn = document.getElementById('generate-btn');
    if (generateBtn) {
        console.log("🎯 generate-btnにクリックイベント設定中...");

        generateBtn.addEventListener('click', function(event) {
            console.log("🎉 generate-btnがクリックされました！");
            event.preventDefault();
            handleGenerateClick();
        });

        // さらに確実にするため、複数の方法でイベントを設定
        generateBtn.onclick = function(event) {
            console.log("🎉 generate-btn onclick トリガー！");
            event.preventDefault();
            handleGenerateClick();
        };

        console.log("✅ generate-btnイベントリスナー設定完了");
    } else {
        console.error("❌ generate-btn要素が見つかりません");
    }

    // ファイル選択のイベントリスナー
    const textbookFiles = document.getElementById('textbook-files');
    if (textbookFiles) {
        textbookFiles.addEventListener('change', function(event) {
            console.log(`📁 教科書ファイル選択: ${event.target.files.length}個のファイル`);
            displayFileList(event.target.files, 'textbook-file-list');
        });
        console.log("✅ textbook-filesイベントリスナー設定完了");
    }

    const pastExamFiles = document.getElementById('past-exam-files');
    if (pastExamFiles) {
        pastExamFiles.addEventListener('change', function(event) {
            console.log(`📁 過去問ファイル選択: ${event.target.files.length}個のファイル`);
            displayFileList(event.target.files, 'past-exam-file-list');
        });
        console.log("✅ past-exam-filesイベントリスナー設定完了");
    }

    // その他のボタンイベント設定
    setupOtherEventListeners();
}

// ========================================
// 生成ボタンクリック処理
// ========================================

function handleGenerateClick() {
    console.log("🚀 handleGenerateClick開始");

    try {
        // バリデーション
        const textbookFiles = document.getElementById('textbook-files').files;
        const apiKey = document.getElementById('api-key').value.trim();

        console.log(`📊 バリデーション: 教科書ファイル数=${textbookFiles.length}, APIキー長=${apiKey.length}`);

        if (textbookFiles.length === 0) {
            console.warn("⚠️ 教科書ファイルが選択されていません");
            alert('教科書PDFファイルを選択してください。');
            return;
        }

        if (apiKey.length === 0) {
            console.warn("⚠️ APIキーが入力されていません");
            alert('Gemini APIキーを入力してください。');
            return;
        }

        console.log("✅ バリデーション通過 - 問題生成処理開始");

        // ローディング表示
        showLoading(true);

        // PDF処理とAI問題生成
        processFilesAndGenerate();

    } catch (error) {
        console.error("💥 handleGenerateClickでエラー:", error);
        alert('エラーが発生しました: ' + error.message);
        showLoading(false);
    }
}

// ========================================
// ローディング表示制御
// ========================================

function showLoading(show) {
    console.log(`🔄 ローディング表示: ${show ? 'ON' : 'OFF'}`);

    const loading = document.getElementById('loading');
    const generateBtn = document.getElementById('generate-btn');

    if (loading && generateBtn) {
        if (show) {
            loading.classList.remove('hidden');
            generateBtn.disabled = true;
            generateBtn.textContent = '生成中...';
        } else {
            loading.classList.add('hidden');
            generateBtn.disabled = false;
            generateBtn.textContent = '問題を生成する';
        }
        console.log(`✅ ローディング状態変更完了`);
    } else {
        console.error("❌ ローディング要素が見つかりません");
    }
}

// ========================================
// ファイルリスト表示
// ========================================

function displayFileList(files, containerId) {
    console.log(`📋 ファイルリスト表示: ${files.length}個, コンテナ: ${containerId}`);

    const container = document.getElementById(containerId);
    if (!container) {
        console.error(`❌ コンテナが見つかりません: ${containerId}`);
        return;
    }

    container.innerHTML = '';

    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const fileSize = (file.size / (1024 * 1024)).toFixed(2);
        console.log(`📄 ファイル${i+1}: ${file.name} (${fileSize}MB)`);

        const fileItem = document.createElement('div');
        fileItem.className = 'file-item';
        fileItem.innerHTML = `
            <span class="file-name">${file.name}</span>
            <span class="file-size">${fileSize}MB</span>
        `;
        container.appendChild(fileItem);
    }

    console.log("✅ ファイルリスト表示完了");
}

// ========================================
// PDF処理とAI問題生成（メイン処理）
// ========================================

async function processFilesAndGenerate() {
    console.log("📚 PDF処理とAI問題生成開始");

    try {
        // ファイル取得
        const textbookFiles = document.getElementById('textbook-files').files;
        const pastExamFiles = document.getElementById('past-exam-files').files;

        console.log(`📊 処理対象: 教科書${textbookFiles.length}個, 過去問${pastExamFiles.length}個`);

        // 教科書PDF処理
        console.log("📖 教科書PDF処理開始...");
        lastTextbookText = await processMultiplePDFs(textbookFiles, "教科書");
        console.log(`✅ 教科書テキスト抽出完了: ${lastTextbookText.length}文字`);

        // 過去問PDF処理（あれば）
        if (pastExamFiles.length > 0) {
            console.log("📝 過去問PDF処理開始...");
            lastPastExamText = await processMultiplePDFs(pastExamFiles, "過去問");
            console.log(`✅ 過去問テキスト抽出完了: ${lastPastExamText.length}文字`);
        } else {
            console.log("ℹ️ 過去問ファイルなし");
            lastPastExamText = '';
        }

        // AI問題生成
        console.log("🤖 AI問題生成開始...");
        await generateQuestionsWithAI();

    } catch (error) {
        console.error("💥 PDF処理でエラー:", error);
        alert('PDF処理中にエラーが発生しました: ' + error.message);
        showLoading(false);
    }
}

// ========================================
// 複数PDF処理（大容量対応）
// ========================================

async function processMultiplePDFs(files, type) {
    console.log(`📚 ${type}PDF処理開始: ${files.length}個のファイル`);

    let combinedText = '';

    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const fileSizeMB = (file.size / (1024 * 1024)).toFixed(2);

        console.log(`📄 ${type}ファイル${i+1}/${files.length}: ${file.name} (${fileSizeMB}MB)`);

        try {
            // 大容量ファイル処理
            const text = await processSinglePDF(file);
            combinedText += text + '\n\n';

            console.log(`✅ ${file.name}処理完了: ${text.length}文字抽出`);

            // メモリ管理（大容量対応）
            if (i % 3 === 0 && i > 0) {
                console.log("🧹 メモリクリーンアップ実行");
                if (window.gc) window.gc();
                await new Promise(resolve => setTimeout(resolve, 100));
            }

        } catch (error) {
            console.error(`❌ ${file.name}処理エラー:`, error);
            // エラーがあっても他のファイルは処理継続
        }
    }

    console.log(`✅ ${type}PDF処理完了: 総文字数${combinedText.length}`);
    return combinedText;
}

// ========================================
// 単一PDF処理（バッチ処理・大容量対応）
// ========================================

async function processSinglePDF(file) {
    console.log(`📖 PDF処理開始: ${file.name}`);

    try {
        const arrayBuffer = await file.arrayBuffer();
        console.log(`💾 ArrayBuffer読み込み完了: ${arrayBuffer.byteLength}bytes`);

        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        const totalPages = pdf.numPages;

        console.log(`📄 PDF情報: ${totalPages}ページ`);

        let fullText = '';
        const batchSize = 10; // 10ページずつ処理（大容量対応）

        // バッチ処理
        for (let batchStart = 1; batchStart <= totalPages; batchStart += batchSize) {
            const batchEnd = Math.min(batchStart + batchSize - 1, totalPages);
            console.log(`📋 バッチ処理: ${batchStart}-${batchEnd}ページ (${totalPages}ページ中)`);

            const batchPromises = [];
            for (let pageNum = batchStart; pageNum <= batchEnd; pageNum++) {
                batchPromises.push(extractPageText(pdf, pageNum));
            }

            const batchResults = await Promise.all(batchPromises);
            fullText += batchResults.join(' ');

            // プログレス更新
            const progress = Math.round((batchEnd / totalPages) * 100);
            console.log(`📊 進捗: ${progress}% (${batchEnd}/${totalPages}ページ)`);

            // メモリ管理
            if (batchStart % 50 === 1 && batchStart > 1) {
                console.log("🧹 中間メモリクリーンアップ");
                await new Promise(resolve => setTimeout(resolve, 50));
            }
        }

        console.log(`✅ PDF処理完了: ${fullText.length}文字抽出`);
        return fullText;

    } catch (error) {
        console.error(`💥 PDF処理エラー (${file.name}):`, error);
        throw error;
    }
}

// ========================================
// ページテキスト抽出
// ========================================

async function extractPageText(pdf, pageNumber) {
    try {
        const page = await pdf.getPage(pageNumber);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map(item => item.str).join(' ');

        // メモリ解放
        page.cleanup();

        return pageText;
    } catch (error) {
        console.error(`❌ ページ${pageNumber}テキスト抽出エラー:`, error);
        return ''; // エラー時は空文字を返して処理継続
    }
}

// ========================================
// AI問題生成
// ========================================

async function generateQuestionsWithAI() {
    console.log("🤖 AI問題生成開始");

    try {
        const apiKey = document.getElementById('api-key').value.trim();

        // プロンプト作成
        let prompt = `以下のテキストに基づいて、5択の問題を5問作成してください。\n\n`;
        prompt += `【教科書テキスト】\n${lastTextbookText}\n\n`;

        if (lastPastExamText) {
            prompt += `【過去問テキスト】\n${lastPastExamText}\n\n`;
        }

        prompt += `
形式:
問題1: [問題文]
A) [選択肢1]
B) [選択肢2]
C) [選択肢3]
D) [選択肢4]
E) [選択肢5]
正解: [A-E]
解説: [詳細な解説]

問題2: [同様の形式で続ける]
...
`;

        console.log(`📝 プロンプト作成完了: ${prompt.length}文字`);

        // Gemini API呼び出し
        const response = await callGeminiAPI(apiKey, prompt);
        console.log("🎉 AI応答受信完了");

        // 問題パース
        const parsedQuestions = parseQuestions(response);
        console.log(`📋 問題パース完了: ${parsedQuestions.length}問`);

        if (parsedQuestions.length > 0) {
            questions = parsedQuestions;
            currentQuestionIndex = 0;
            correctAnswers = 0;
            wrongAnswers = 0;
            wrongQuestions = [];

            showQuizSection();
            displayCurrentQuestion();
            console.log("✅ 問題表示完了");
        } else {
            throw new Error('問題の生成に失敗しました');
        }

        showLoading(false);

    } catch (error) {
        console.error("💥 AI問題生成エラー:", error);
        alert('問題生成中にエラーが発生しました: ' + error.message);
        showLoading(false);
    }
}

// ========================================
// Gemini API呼び出し
// ========================================

async function callGeminiAPI(apiKey, prompt) {
    console.log("📡 Gemini API呼び出し開始");

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${apiKey}`;

    const requestBody = {
        contents: [{
            parts: [{
                text: prompt
            }]
        }]
    };

    console.log("🚀 API リクエスト送信中...");

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ API応答エラー: ${response.status} - ${errorText}`);
        throw new Error(`API呼び出しに失敗しました: ${response.status}`);
    }

    const data = await response.json();
    console.log("✅ API応答解析完了");

    if (data.candidates && data.candidates[0] && data.candidates[0].content) {
        return data.candidates[0].content.parts[0].text;
    } else {
        console.error("❌ 無効なAPI応答形式:", data);
        throw new Error('APIからの応答が無効です');
    }
}

// ========================================
// 問題パース
// ========================================

function parseQuestions(text) {
    console.log("📋 問題パース開始");

    const questions = [];
    const questionBlocks = text.split(/問題\d+:/);

    console.log(`📊 問題ブロック数: ${questionBlocks.length}`);

    for (let i = 1; i < questionBlocks.length; i++) {
        try {
            const block = questionBlocks[i].trim();

            // 問題文抽出
            const questionMatch = block.match(/^([^A-E]+?)(?=[A-E]\))/s);
            if (!questionMatch) continue;

            const questionText = questionMatch[1].trim();

            // 選択肢抽出
            const choices = [];
            const choiceMatches = block.match(/[A-E]\)[^A-E]+/g);

            if (!choiceMatches || choiceMatches.length !== 5) {
                console.warn(`⚠️ 問題${i}: 選択肢が5個ではありません`);
                continue;
            }

            choiceMatches.forEach(choice => {
                choices.push(choice.substring(2).trim());
            });

            // 正解抽出
            const answerMatch = block.match(/正解:\s*([A-E])/);
            if (!answerMatch) {
                console.warn(`⚠️ 問題${i}: 正解が見つかりません`);
                continue;
            }

            const correctAnswer = answerMatch[1].charCodeAt(0) - 'A'.charCodeAt(0);

            // 解説抽出
            const explanationMatch = block.match(/解説:\s*(.+)$/s);
            const explanation = explanationMatch ? explanationMatch[1].trim() : '解説がありません。';

            questions.push({
                question: questionText,
                choices: choices,
                correct: correctAnswer,
                explanation: explanation
            });

            console.log(`✅ 問題${i}パース完了`);

        } catch (error) {
            console.error(`❌ 問題${i}パースエラー:`, error);
        }
    }

    console.log(`📋 パース完了: ${questions.length}問作成`);
    return questions;
}

// ========================================
// クイズ表示
// ========================================

function showQuizSection() {
    console.log("🎯 クイズセクション表示");

    const quizSection = document.getElementById('quiz-section');
    const uploadSection = document.getElementById('upload-section');

    if (quizSection) {
        quizSection.classList.remove('hidden');
        console.log("✅ クイズセクション表示完了");
    }

    if (uploadSection) {
        uploadSection.style.display = 'none';
        console.log("✅ アップロードセクション非表示完了");
    }
}

function displayCurrentQuestion() {
    console.log(`📝 問題表示: ${currentQuestionIndex + 1}/${questions.length}`);

    if (currentQuestionIndex >= questions.length) {
        console.log("🎉 全問題完了");
        showResults();
        return;
    }

    const question = questions[currentQuestionIndex];

    // 問題番号更新
    const questionNumber = document.getElementById('question-number');
    if (questionNumber) {
        questionNumber.textContent = currentQuestionIndex + 1;
    }

    // スコア更新
    updateScore();

    // 問題文表示
    const questionText = document.getElementById('question-text');
    if (questionText) {
        questionText.textContent = question.question;
    }

    // 選択肢表示
    const choicesContainer = document.getElementById('choices');
    if (choicesContainer) {
        choicesContainer.innerHTML = '';

        question.choices.forEach((choice, index) => {
            const button = document.createElement('button');
            button.className = 'choice-btn';
            button.textContent = `${String.fromCharCode(65 + index)}) ${choice}`;
            button.addEventListener('click', () => selectAnswer(index));
            choicesContainer.appendChild(button);
        });
    }

    // UI状態リセット
    hideExplanation();
    hideNextButton();

    console.log("✅ 問題表示完了");
}

// ========================================
// その他のイベントリスナー設定
// ========================================

function setupOtherEventListeners() {
    console.log("🔗 その他イベントリスナー設定開始");

    // 次の問題ボタン
    const nextBtn = document.getElementById('next-btn');
    if (nextBtn) {
        nextBtn.addEventListener('click', () => {
            console.log("➡️ 次の問題ボタンクリック");
            nextQuestion();
        });
    }

    // AI質問ボタン
    const askQuestionBtn = document.getElementById('ask-question-btn');
    if (askQuestionBtn) {
        askQuestionBtn.addEventListener('click', () => {
            console.log("🤖 AI質問ボタンクリック");
            handleAIQuestion();
        });
    }

    console.log("✅ その他イベントリスナー設定完了");
}

// ========================================
// 回答選択処理
// ========================================

function selectAnswer(selectedIndex) {
    console.log(`🎯 回答選択: ${String.fromCharCode(65 + selectedIndex)}`);

    const question = questions[currentQuestionIndex];
    const isCorrect = selectedIndex === question.correct;

    console.log(`📊 判定結果: ${isCorrect ? '正解' : '不正解'}`);

    // 選択肢のボタンを無効化と色付け
    const choices = document.querySelectorAll('.choice-btn');
    choices.forEach((btn, index) => {
        btn.disabled = true;
        if (index === question.correct) {
            btn.classList.add('correct');
        } else if (index === selectedIndex && !isCorrect) {
            btn.classList.add('incorrect');
        }
    });

    // スコア更新
    if (isCorrect) {
        correctAnswers++;
        console.log(`✅ 正解数: ${correctAnswers}`);
    } else {
        wrongAnswers++;
        wrongQuestions.push({ ...question, questionIndex: currentQuestionIndex });
        console.log(`❌ 不正解数: ${wrongAnswers}`);
    }

    // 解説表示
    showExplanation(question.explanation);
    showNextButton();

    updateScore();
}

// ========================================
// UI制御関数群
// ========================================

function updateScore() {
    const scoreElement = document.getElementById('score');
    const wrongCountElement = document.getElementById('wrong-count');

    if (scoreElement) {
        scoreElement.textContent = `正解: ${correctAnswers}`;
    }

    if (wrongCountElement) {
        wrongCountElement.textContent = `間違い: ${wrongAnswers}`;
    }

    console.log(`📊 スコア更新: 正解${correctAnswers}, 間違い${wrongAnswers}`);
}

function showExplanation(text) {
    const explanation = document.getElementById('explanation');
    const explanationText = document.getElementById('explanation-text');

    if (explanation && explanationText) {
        explanationText.textContent = text;
        explanation.classList.remove('hidden');
        console.log("📝 解説表示完了");
    }
}

function hideExplanation() {
    const explanation = document.getElementById('explanation');
    if (explanation) {
        explanation.classList.add('hidden');
    }
}

function showNextButton() {
    const nextBtn = document.getElementById('next-btn');
    if (nextBtn) {
        nextBtn.classList.remove('hidden');
    }
}

function hideNextButton() {
    const nextBtn = document.getElementById('next-btn');
    if (nextBtn) {
        nextBtn.classList.add('hidden');
    }
}

function nextQuestion() {
    console.log("➡️ 次の問題へ");
    currentQuestionIndex++;
    displayCurrentQuestion();
}

function showResults() {
    console.log("🎉 結果表示");

    const total = correctAnswers + wrongAnswers;
    const percentage = total > 0 ? Math.round((correctAnswers / total) * 100) : 0;

    alert(`お疲れ様でした！\n\n正解: ${correctAnswers}問\n間違い: ${wrongAnswers}問\n正答率: ${percentage}%`);

    // 間違い復習ボタン表示
    if (wrongQuestions.length > 0) {
        const reviewBtn = document.getElementById('review-wrong-btn');
        if (reviewBtn) {
            reviewBtn.classList.remove('hidden');
        }
    }
}

// ========================================
// AI質問機能
// ========================================

async function handleAIQuestion() {
    console.log("🤖 AI質問処理開始");

    try {
        const questionInput = document.getElementById('question-input');
        if (!questionInput || !questionInput.value.trim()) {
            alert('質問を入力してください。');
            return;
        }

        const userQuestion = questionInput.value.trim();
        const currentQuestion = questions[currentQuestionIndex];

        console.log(`❓ ユーザー質問: ${userQuestion}`);

        // AI応答生成（PDFコンテンツを参照）
        const prompt = `
以下の問題と解説について、ユーザーの質問に答えてください。
回答は必ず教科書の内容に基づいて行ってください。

【問題】
${currentQuestion.question}

【選択肢】
${currentQuestion.choices.map((choice, idx) => `${String.fromCharCode(65 + idx)}) ${choice}`).join('\n')}

【正解】
${String.fromCharCode(65 + currentQuestion.correct)}) ${currentQuestion.choices[currentQuestion.correct]}

【解説】
${currentQuestion.explanation}

【教科書の内容】
${lastTextbookText.substring(0, 3000)}

【ユーザーの質問】
${userQuestion}

【回答】
`;

        const apiKey = document.getElementById('api-key').value.trim();
        const aiResponse = await callGeminiAPI(apiKey, prompt);

        // AI応答表示
        showAIResponse(aiResponse);

        console.log("✅ AI質問処理完了");

    } catch (error) {
        console.error("💥 AI質問エラー:", error);
        alert('AI質問中にエラーが発生しました: ' + error.message);
    }
}

function showAIResponse(response) {
    const aiResponseElement = document.getElementById('ai-response');
    const aiResponseText = document.getElementById('ai-response-text');

    if (aiResponseElement && aiResponseText) {
        aiResponseText.textContent = response;
        aiResponseElement.classList.remove('hidden');
        console.log("🤖 AI応答表示完了");
    }
}

// ========================================
// スクリプト読み込み完了通知
// ========================================

console.log("🎉 Script.js読み込み完了 - 全機能準備完了");
console.log("📋 利用可能な機能:");
console.log("  ✅ 294MB大容量PDF対応");
console.log("  ✅ 複数ファイル処理");  
console.log("  ✅ AI問題生成");
console.log("  ✅ AI質問機能");
console.log("  ✅ デバッグログ出力");
console.log("  ✅ エラーハンドリング");
console.log("🚀 ボタンクリック待機中...");
