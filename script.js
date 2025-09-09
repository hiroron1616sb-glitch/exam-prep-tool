// 1. グローバル変数の宣言
let questions = [];
let currentQuestionIndex = 0;
let score = 0;
let wrongQuestions = [];
let wrongCount = 0;

// 復習機能用の変数
let studyMode = 'normal';
let allWrongQuestions = [];
let originalQuestions = [];

// 追加問題生成用の変数
let lastTextbookText = '';
let lastPastExamText = '';
let lastApiKey = '';
let generationCount = 1;

// 複数ファイル管理用の変数
let selectedTextbookFiles = [];
let selectedPastExamFiles = [];

// 2. PDF.jsの初期化
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

// 3. DOM要素の宣言
let uploadSection, quizSection, generateBtn, loadingDiv, apiKeyInput;
let textbookFilesInput, pastExamFilesInput, textbookFileList, pastExamFileList;
let questionNumberSpan, questionTextP, choicesDiv, explanationDiv, explanationTextP, nextBtn, scoreSpan, wrongCountSpan;
let reviewWrongBtn, restartBtn, generateMoreBtn;

// 4. DOMContentLoadedイベントで初期化
document.addEventListener('DOMContentLoaded', function() {
    // DOM要素の取得
    uploadSection = document.getElementById('upload-section');
    quizSection = document.getElementById('quiz-section');
    generateBtn = document.getElementById('generate-btn');
    loadingDiv = document.getElementById('loading');
    apiKeyInput = document.getElementById('api-key');
    
    textbookFilesInput = document.getElementById('textbook-files');
    pastExamFilesInput = document.getElementById('past-exam-files');
    textbookFileList = document.getElementById('textbook-file-list');
    pastExamFileList = document.getElementById('past-exam-file-list');
    
    questionNumberSpan = document.getElementById('question-number');
    questionTextP = document.getElementById('question-text');
    choicesDiv = document.getElementById('choices');
    explanationDiv = document.getElementById('explanation');
    explanationTextP = document.getElementById('explanation-text');
    nextBtn = document.getElementById('next-btn');
    scoreSpan = document.getElementById('score');
    wrongCountSpan = document.getElementById('wrong-count');
    
    reviewWrongBtn = document.getElementById('review-wrong-btn');
    restartBtn = document.getElementById('restart-btn');
    generateMoreBtn = document.getElementById('generate-more-btn');
    
    // イベントリスナーの設定
    if (generateBtn) generateBtn.addEventListener('click', generateQuestions);
    if (nextBtn) nextBtn.addEventListener('click', showNextQuestion);
    if (reviewWrongBtn) reviewWrongBtn.addEventListener('click', startReviewMode);
    if (restartBtn) restartBtn.addEventListener('click', restartQuiz);
    if (generateMoreBtn) generateMoreBtn.addEventListener('click', generateMoreQuestions);
    
    if (textbookFilesInput) textbookFilesInput.addEventListener('change', handleTextbookFilesChange);
    if (pastExamFilesInput) pastExamFilesInput.addEventListener('change', handlePastExamFilesChange);
    
    // 初期ファイルリスト表示
    if (textbookFileList) updateFileList(textbookFileList, [], 'textbook');
    if (pastExamFileList) updateFileList(pastExamFileList, [], 'past-exam');
});

// 5. 全ての関数定義
// PDFファイルを読み込む関数
async function extractTextFromPDF(file) {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;
    let fullText = '';
    
    for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map(item => item.str).join(' ');
        fullText += pageText + '\n';
    }
    
    return fullText;
}

// 問題生成関数（複数ファイル対応）
async function generateQuestions() {
    const apiKey = apiKeyInput.value.trim();
    
    // ファイル取得
    let textbookFiles = [];
    if (textbookFilesInput && textbookFilesInput.files.length > 0) {
        textbookFiles = Array.from(textbookFilesInput.files);
    } else if (selectedTextbookFiles.length > 0) {
        textbookFiles = selectedTextbookFiles;
    }
    
    // 入力チェック
    if (textbookFiles.length === 0) {
        alert('教科書PDFファイルを少なくとも1つ選択してください。');
        return;
    }
    
    if (!apiKey) {
        alert('Gemini API Keyを入力してください。');
        return;
    }
    
    // ローディング表示
    generateBtn.disabled = true;
    loadingDiv.classList.remove('hidden');
    loadingDiv.textContent = 'PDFファイルを処理しています...';
    
    try {
        console.log(`${textbookFiles.length}個の教科書PDFを処理開始`);
        
        // PDFテキスト抽出
        let textbookText = '';
        for (let i = 0; i < textbookFiles.length; i++) {
            const file = textbookFiles[i];
            loadingDiv.textContent = `PDF処理中... (${i + 1}/${textbookFiles.length}): ${file.name}`;
            
            const fileText = await extractTextFromPDF(file);
            textbookText += `\n\n=== ${file.name} ===\n${fileText}\n`;
        }
        
        let pastExamText = '';
        let pastExamFiles = [];
        if (pastExamFilesInput && pastExamFilesInput.files.length > 0) {
            pastExamFiles = Array.from(pastExamFilesInput.files);
        } else if (selectedPastExamFiles.length > 0) {
            pastExamFiles = selectedPastExamFiles;
        }
        
        if (pastExamFiles.length > 0) {
            for (let i = 0; i < pastExamFiles.length; i++) {
                const file = pastExamFiles[i];
                loadingDiv.textContent = `過去問PDF処理中... (${i + 1}/${pastExamFiles.length}): ${file.name}`;
                
                const fileText = await extractTextFromPDF(file);
                pastExamText += `\n\n=== ${file.name} ===\n${fileText}\n`;
            }
        }
        
        loadingDiv.textContent = 'AIが問題を生成しています...';
        
        // 生成データを保存
        saveGenerationData(textbookText, pastExamText, apiKey);
        
        // Gemini APIで問題生成
        const generatedQuestions = await callGeminiAPI(textbookText, pastExamText, apiKey);
        
        if (generatedQuestions && generatedQuestions.length > 0) {
            // 問題初期化
            initializeQuestions(generatedQuestions);
            
            // 問題画面に切り替え
            uploadSection.classList.add('hidden');
            quizSection.classList.remove('hidden');
            
            // モード表示を更新
            updateModeDisplay();
            
            // 最初の問題を表示
            showQuestion();
            
            console.log(`問題生成完了: ${generatedQuestions.length}問を生成`);
            
        } else {
            alert('問題の生成に失敗しました。APIキーを確認してください。');
        }
        
    } catch (error) {
        console.error('エラーが発生しました:', error);
        alert('エラーが発生しました: ' + error.message);
    } finally {
        generateBtn.disabled = false;
        loadingDiv.classList.add('hidden');
    }
}

// 教科書ファイル選択処理
function handleTextbookFilesChange(event) {
    const files = Array.from(event.target.files);
    selectedTextbookFiles = files;
    updateFileList(textbookFileList, selectedTextbookFiles, 'textbook');
}

// 過去問ファイル選択処理
function handlePastExamFilesChange(event) {
    const files = Array.from(event.target.files);
    selectedPastExamFiles = files;
    updateFileList(pastExamFileList, selectedPastExamFiles, 'past-exam');
}

// ファイルリスト表示更新
function updateFileList(listElement, files, type) {
    if (!listElement) return;
    
    listElement.innerHTML = '';
    
    if (files.length === 0) {
        listElement.innerHTML = '<div style="color: #6c757d; font-style: italic;">ファイルが選択されていません</div>';
        return;
    }
    
    files.forEach((file, index) => {
        const fileItem = document.createElement('div');
        fileItem.className = 'file-item';
        
        const fileName = document.createElement('span');
        fileName.className = 'file-name';
        fileName.textContent = file.name;
        
        const fileSize = document.createElement('span');
        fileSize.className = 'file-size';
        fileSize.textContent = formatFileSize(file.size);
        
        const removeBtn = document.createElement('button');
        removeBtn.className = 'remove-btn';
        removeBtn.textContent = '×';
        removeBtn.onclick = () => removeFile(index, type);
        
        fileItem.appendChild(fileName);
        fileItem.appendChild(fileSize);
        fileItem.appendChild(removeBtn);
        
        listElement.appendChild(fileItem);
    });
    
    // ファイル概要を追加
    const summary = document.createElement('div');
    summary.className = 'file-summary';
    const totalSize = files.reduce((sum, file) => sum + file.size, 0);
    summary.textContent = `合計: ${files.length}ファイル（${formatFileSize(totalSize)}）`;
    listElement.appendChild(summary);
}

// ファイルサイズフォーマット
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// ファイル削除
function removeFile(index, type) {
    if (type === 'textbook') {
        selectedTextbookFiles.splice(index, 1);
        updateFileList(textbookFileList, selectedTextbookFiles, 'textbook');
        if (textbookFilesInput) textbookFilesInput.value = '';
    } else if (type === 'past-exam') {
        selectedPastExamFiles.splice(index, 1);
        updateFileList(pastExamFileList, selectedPastExamFiles, 'past-exam');
        if (pastExamFilesInput) pastExamFilesInput.value = '';
    }
}

// 生成データ保存（確実版）
function saveGenerationData(textbookText, pastExamText, apiKey) {
    lastTextbookText = textbookText || '';
    lastPastExamText = pastExamText || '';
    lastApiKey = apiKey || '';
    generationCount = 1;
    
    console.log('生成データ保存完了:', {
        textbookLength: lastTextbookText.length,
        pastExamLength: lastPastExamText.length,
        hasApiKey: !!lastApiKey
    });
}
// 追加問題生成機能（完全版）
async function generateMoreQuestions() {
    if (!lastApiKey) {
        alert('最初に基本問題を生成してください。');
        return;
    }
    
    if (!lastTextbookText || lastTextbookText.trim() === '') {
        alert('教科書データがありません。最初から問題を生成し直してください。');
        return;
    }
    
    // ローディング状態
    generateMoreBtn.disabled = true;
    generateMoreBtn.style.opacity = '0.6';
    const originalText = generateMoreBtn.textContent;
    generateMoreBtn.textContent = '🔄 生成中...';
    
    try {
        generationCount++;
        console.log(`${generationCount}回目の追加問題生成を開始`);
        
        // 軽量版プロンプトを使用（スマホ対応）
        const additionalQuestions = await callGeminiAPIForMore(
            lastTextbookText, 
            lastPastExamText, 
            lastApiKey, 
            generationCount
        );
        
        if (additionalQuestions && additionalQuestions.length > 0) {
            // 既存の問題に追加
            const newQuestionCount = additionalQuestions.length;
            originalQuestions.push(...additionalQuestions);
            
            // 現在のモードに応じて問題を追加
            if (studyMode === 'normal') {
                questions.push(...additionalQuestions);
            }
            
            // モード表示を更新
            updateModeDisplay();
            
            // 成功メッセージ
            const message = isMobile ? 
                `📱 新しい問題を ${newQuestionCount}問 追加しました！\n\n総問題数: ${originalQuestions.length}問` :
                `✅ 新しい問題を ${newQuestionCount}問 追加しました！\n\n現在の問題総数: ${originalQuestions.length}問\n生成回数: ${generationCount}回`;
            
            alert(message);
            
            console.log(`問題追加完了: +${newQuestionCount}問（総計: ${originalQuestions.length}問）`);
        } else {
            alert('❌ 追加問題の生成に失敗しました。\n\nしばらく待ってから再試行してください。');
        }
        
    } catch (error) {
        console.error('追加問題生成エラー:', error);
        alert('❌ 追加問題生成でエラーが発生しました:\n' + error.message + '\n\nネットワーク接続を確認してから再試行してください。');
    } finally {
        generateMoreBtn.disabled = false;
        generateMoreBtn.style.opacity = '1';
        generateMoreBtn.textContent = originalText;
    }
}

// 追加問題用のGemini API呼び出し（軽量版）
async function callGeminiAPIForMore(textbookText, pastExamText, apiKey, generationNumber) {
    const prompt = createAdditionalPromptLightweight(textbookText, pastExamText, generationNumber);
    
    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
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
                    temperature: 0.8,
                    maxOutputTokens: isMobile ? 4000 : 8000,
                    topP: 0.9,
                    topK: 50
                }
            })
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('追加問題API エラー:', errorText);
            throw new Error(`API呼び出しに失敗しました: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (!data.candidates || !data.candidates[0] || !data.candidates[0].content) {
            console.error('API応答エラー:', data);
            throw new Error('APIからの応答が不正です');
        }
        
        const content = data.candidates[0].content.parts[0].text;
        console.log(`${generationNumber}回目のAPI応答:`, content.length, '文字');
        
        return parseQuestions(content);
        
    } catch (error) {
        console.error('追加問題API呼び出しエラー:', error);
        throw error;
    }
}

// 追加問題用の軽量プロンプト作成
function createAdditionalPromptLightweight(textbookText, pastExamText, generationNumber) {
    // 教科書の異なる部分にフォーカス（軽量版）
    const maxLength = isMobile ? 15000 : 30000;
    const startIndex = ((generationNumber - 1) * 10000) % textbookText.length;
    const endIndex = Math.min(startIndex + maxLength, textbookText.length);
    const focusedText = textbookText.substring(startIndex, endIndex);
    
    const questionCount = isMobile ? 5 : 10; // モバイルは5問、PCは10問
    
    let prompt = `
これは${generationNumber}回目の問題生成です。前回とは異なる新しい観点から、${questionCount}問作成してください。

## 重要な指示:
- 前回と重複しない、新しい視点の問題を作成
- より${getGenerationFocus(generationNumber)}な内容にフォーカス

## 教科書の内容:
${focusedText}
`;

    if (pastExamText && pastExamText.trim() && !isMobile) {
        prompt += `
## 過去問の参考:
${pastExamText.substring(0, 2000)}
`;
    }

    prompt += `
## 回答形式:
必ず以下のJSON形式で${questionCount}問作成してください：

\`\`\`json
[
  {
    "question": "問題文",
    "choices": ["選択肢A", "選択肢B", "選択肢C", "選択肢D", "選択肢E"],
    "correctAnswer": 0,
    "explanation": "詳細な解説"
  }
]
\`\`\`

注意事項:
- 前回と同じような問題は避ける
- より深い理解を要求する問題を作成
- 実際の試験で出題されそうな実用性の高い問題
`;

    return prompt;
}

// 生成回数に応じたフォーカス（軽量版）
function getGenerationFocus(generationNumber) {
    const focuses = [
        "基本的", // 1回目
        "応用的", // 2回目
        "実践的", // 3回目
        "統合的", // 4回目
        "発展的"  // 5回目以降
    ];
    
    const index = Math.min(generationNumber - 1, focuses.length - 1);
    return focuses[index];
}


// 問題初期化（復習機能対応）
function initializeQuestions(generatedQuestions) {
    questions = generatedQuestions;
    originalQuestions = [...generatedQuestions];
    allWrongQuestions = [];
    currentQuestionIndex = 0;
    score = 0;
    wrongQuestions = [];
    wrongCount = 0;
    studyMode = 'normal';
    
    if (reviewWrongBtn) reviewWrongBtn.classList.add('hidden');
}

// Gemini API呼び出し
async function callGeminiAPI(textbookText, pastExamText, apiKey) {
    const prompt = createPrompt(textbookText, pastExamText);
    
    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
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
                    maxOutputTokens: 8000,
                    topP: 0.8,
                    topK: 40
                }
            })
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('Gemini API エラー:', errorText);
            throw new Error(`Gemini API呼び出しに失敗しました: ${response.status} - ${errorText}`);
        }
        
        const data = await response.json();
        
        if (!data.candidates || !data.candidates[0] || !data.candidates[0].content) {
            console.error('Gemini API応答エラー:', data);
            throw new Error('Geminiからの応答が不正です');
        }
        
        const content = data.candidates[0].content.parts[0].text;
        console.log('Gemini応答:', content);
        
        return parseQuestions(content);
        
    } catch (error) {
        console.error('Gemini API呼び出しエラー:', error);
        throw error;
    }
}

// プロンプト作成
function createPrompt(textbookText, pastExamText) {
    const maxTextbookLength = 50000;
    const truncatedTextbook = textbookText.length > maxTextbookLength 
        ? textbookText.substring(0, maxTextbookLength) + '...'
        : textbookText;

    let prompt = `
あなたは緩和医療専門医試験問題作成の専門家です。以下の教科書の内容から、高品質な5択の選択問題を10問作成してください。

## 教科書の内容:
${truncatedTextbook}
`;

    if (pastExamText && pastExamText.trim()) {
        prompt += `
## 過去問の参考:
${pastExamText.substring(0, 5000)}

過去問の出題形式、問題の難易度、出題範囲の傾向を分析して、同様のスタイルで問題を作成してください。
`;
    }

    prompt += `
## 回答形式:
必ず以下のJSON形式で10問作成してください。

\`\`\`json
[
  {
    "question": "問題文",
    "choices": [
      "選択肢A",
      "選択肢B",
      "選択肢C",
      "選択肢D",
      "選択肢E"
    ],
    "correctAnswer": 0,
    "explanation": "詳細な解説"
  }
]
\`\`\`
`;

    return prompt;
}

// 問題解析関数
function parseQuestions(content) {
    try {
        // JSONブロックを探す
        const jsonMatch = content.match(/```json\n?([\s\S]*?)\n?```/);
        if (jsonMatch) {
            const jsonStr = jsonMatch[1].trim();
            return JSON.parse(jsonStr);
        }
        
        // 配列形式を探す
        const arrayMatch = content.match(/\[[\s\S]*\]/);
        if (arrayMatch) {
            return JSON.parse(arrayMatch[0]);
        }
        
        // 直接JSONとして解析
        const cleanContent = content.trim();
        if (cleanContent.startsWith('[') && cleanContent.endsWith(']')) {
            return JSON.parse(cleanContent);
        }
        
        throw new Error('有効なJSON形式が見つかりません');
        
    } catch (parseError) {
        console.error('JSON解析エラー:', parseError);
        alert('AIの応答をJSON形式で解析できませんでした。サンプル問題を表示します。');
        return createSampleQuestions();
    }
}

// サンプル問題
function createSampleQuestions() {
    return [
        {
            question: "教科書の内容に基づく問題です（サンプル）。",
            choices: [
                "基本概念の理解",
                "応用技術の習得",
                "実践的な運用方法",
                "理論的な分析手法",
                "総合的な評価基準"
            ],
            correctAnswer: 0,
            explanation: "これはサンプル問題です。"
        }
    ];
}

// 復習機能
function startReviewMode() {
    if (allWrongQuestions.length === 0) {
        alert('まだ間違えた問題がありません。');
        return;
    }
    
    studyMode = 'review';
    questions = [...allWrongQuestions];
    currentQuestionIndex = 0;
    score = 0;
    wrongQuestions = [];
    
    updateModeDisplay();
    showQuestion();
}

function restartQuiz() {
    if (originalQuestions.length === 0) {
        alert('最初に問題を生成してください。');
        return;
    }
    
    studyMode = 'normal';
    questions = [...originalQuestions];
    currentQuestionIndex = 0;
    score = 0;
    wrongQuestions = [];
    wrongCount = 0;
    
    updateModeDisplay();
    showQuestion();
}

function updateModeDisplay() {
    const existingIndicator = document.querySelector('.mode-indicator');
    if (existingIndicator) {
        existingIndicator.remove();
    }
    
    const modeIndicator = document.createElement('div');
    modeIndicator.className = studyMode === 'review' ? 'mode-indicator review' : 'mode-indicator';
    
    if (studyMode === 'review') {
        modeIndicator.textContent = `🔄 復習モード（${questions.length}問）`;
    } else {
        modeIndicator.textContent = `📚 通常モード（${questions.length}問）`;
    }
    
    const quizHeader = document.querySelector('.quiz-header');
    if (quizHeader) {
        quizHeader.insertAdjacentElement('afterend', modeIndicator);
    }
}

function updateWrongQuestionTracking(selectedIndex, question) {
    if (selectedIndex !== question.correctAnswer) {
        wrongCount++;
        
        if (!wrongQuestions.some(q => q.question === question.question)) {
            wrongQuestions.push(question);
        }
        
        if (!allWrongQuestions.some(q => q.question === question.question)) {
            allWrongQuestions.push(question);
            if (reviewWrongBtn) reviewWrongBtn.classList.remove('hidden');
        }
    } else {
        score++;
    }
}

function showQuestion() {
    const question = questions[currentQuestionIndex];
    
    if (questionNumberSpan) questionNumberSpan.textContent = currentQuestionIndex + 1;
    if (questionTextP) questionTextP.textContent = question.question;
    
    if (choicesDiv) {
        choicesDiv.innerHTML = '';
        
        question.choices.forEach((choice, index) => {
            const choiceDiv = document.createElement('div');
            choiceDiv.className = 'choice';
            choiceDiv.textContent = `${String.fromCharCode(65 + index)}. ${choice}`;
            choiceDiv.addEventListener('click', () => selectChoice(index));
            choicesDiv.appendChild(choiceDiv);
        });
    }
    
    if (explanationDiv) explanationDiv.classList.add('hidden');
    if (nextBtn) nextBtn.classList.add('hidden');
    
    if (scoreSpan) scoreSpan.textContent = `正解: ${score}`;
    if (wrongCountSpan) wrongCountSpan.textContent = `間違い: ${wrongCount}`;
}

function selectChoice(selectedIndex) {
    const question = questions[currentQuestionIndex];
    const choices = document.querySelectorAll('.choice');
    
    choices.forEach(choice => {
        choice.style.pointerEvents = 'none';
    });
    
    choices.forEach((choice, index) => {
        if (index === question.correctAnswer) {
            choice.classList.add('correct');
        } else if (index === selectedIndex && index !== question.correctAnswer) {
            choice.classList.add('wrong');
        }
    });
    
    updateWrongQuestionTracking(selectedIndex, question);
    
    if (explanationTextP) explanationTextP.textContent = question.explanation;
    if (explanationDiv) explanationDiv.classList.remove('hidden');
    if (nextBtn) nextBtn.classList.remove('hidden');
    
    if (scoreSpan) scoreSpan.textContent = `正解: ${score}`;
    if (wrongCountSpan) wrongCountSpan.textContent = `間違い: ${wrongCount}`;
}

function showNextQuestion() {
    currentQuestionIndex++;
    
    if (studyMode === 'normal' && currentQuestionIndex >= questions.length && wrongQuestions.length > 0) {
        questions = [...questions, ...wrongQuestions];
        wrongQuestions = [];
    }
    
    if (currentQuestionIndex < questions.length) {
        showQuestion();
    } else {
        showResults();
    }
}

function showResults() {
    const totalQuestions = currentQuestionIndex;
    const successRate = Math.round((score / totalQuestions) * 100);
    
    let resultMessage = `お疲れ様でした！\n\n【結果】\n`;
    
    if (studyMode === 'review') {
        resultMessage += `復習モード完了\n`;
    } else {
        resultMessage += `通常モード完了\n`;
    }
    
    resultMessage += `総問題数: ${totalQuestions}問\n正解数: ${score}問\n間違い: ${wrongCount}問\n正答率: ${successRate}%`;
    
    if (allWrongQuestions.length > 0) {
        resultMessage += `\n\n💡 間違えた問題が ${allWrongQuestions.length}問 あります。`;
    }
    
    alert(resultMessage);
    
    if (allWrongQuestions.length > 0 && reviewWrongBtn) {
        reviewWrongBtn.classList.remove('hidden');
    }
}

// 追加問題生成機能（完全版）
async function generateMoreQuestions() {
    if (!lastApiKey) {
        alert('最初に基本問題を生成してください。');
        return;
    }
    
    if (!lastTextbookText || lastTextbookText.trim() === '') {
        alert('教科書データがありません。最初から問題を生成し直してください。');
        return;
    }
    
    // ローディング状態
    generateMoreBtn.disabled = true;
    generateMoreBtn.style.opacity = '0.6';
    const originalText = generateMoreBtn.textContent;
    generateMoreBtn.textContent = '🔄 生成中...';
    
    try {
        generationCount++;
        console.log(`${generationCount}回目の追加問題生成を開始`);
        
        // 軽量版プロンプトを使用（スマホ対応）
        const additionalQuestions = await callGeminiAPIForMore(
            lastTextbookText, 
            lastPastExamText, 
            lastApiKey, 
            generationCount
        );
        
        if (additionalQuestions && additionalQuestions.length > 0) {
            // 既存の問題に追加
            const newQuestionCount = additionalQuestions.length;
            originalQuestions.push(...additionalQuestions);
            
            // 現在のモードに応じて問題を追加
            if (studyMode === 'normal') {
                questions.push(...additionalQuestions);
            }
            
            // モード表示を更新
            updateModeDisplay();
            
            // 成功メッセージ
            const message = isMobile ? 
                `📱 新しい問題を ${newQuestionCount}問 追加しました！\n\n総問題数: ${originalQuestions.length}問` :
                `✅ 新しい問題を ${newQuestionCount}問 追加しました！\n\n現在の問題総数: ${originalQuestions.length}問\n生成回数: ${generationCount}回`;
            
            alert(message);
            
            console.log(`問題追加完了: +${newQuestionCount}問（総計: ${originalQuestions.length}問）`);
        } else {
            alert('❌ 追加問題の生成に失敗しました。\n\nしばらく待ってから再試行してください。');
        }
        
    } catch (error) {
        console.error('追加問題生成エラー:', error);
        alert('❌ 追加問題生成でエラーが発生しました:\n' + error.message + '\n\nネットワーク接続を確認してから再試行してください。');
    } finally {
        generateMoreBtn.disabled = false;
        generateMoreBtn.style.opacity = '1';
        generateMoreBtn.textContent = originalText;
    }
}

// 追加問題用のGemini API呼び出し（軽量版）
async function callGeminiAPIForMore(textbookText, pastExamText, apiKey, generationNumber) {
    const prompt = createAdditionalPromptLightweight(textbookText, pastExamText, generationNumber);
    
    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
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
                    temperature: 0.8, // より多様性を増やす
                    maxOutputTokens: isMobile ? 4000 : 8000, // モバイル対応
                    topP: 0.9,
                    topK: 50
                }
            })
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('追加問題API エラー:', errorText);
            throw new Error(`API呼び出しに失敗しました: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (!data.candidates || !data.candidates[0] || !data.candidates[0].content) {
            console.error('API応答エラー:', data);
            throw new Error('APIからの応答が不正です');
        }
        
        const content = data.candidates[0].content.parts[0].text;
        console.log(`${generationNumber}回目のAPI応答:`, content.length, '文字');
        
        return parseQuestions(content);
        
    } catch (error) {
        console.error('追加問題API呼び出しエラー:', error);
        throw error;
    }
}

// 追加問題用の軽量プロンプト作成
function createAdditionalPromptLightweight(textbookText, pastExamText, generationNumber) {
    // 教科書の異なる部分にフォーカス（軽量版）
    const maxLength = isMobile ? 15000 : 30000;
    const startIndex = ((generationNumber - 1) * 10000) % textbookText.length;
    const endIndex = Math.min(startIndex + maxLength, textbookText.length);
    const focusedText = textbookText.substring(startIndex, endIndex);
    
    const questionCount = isMobile ? 5 : 10; // モバイルは5問、PCは10問
    
    let prompt = `
これは${generationNumber}回目の問題生成です。前回とは異なる新しい観点から、${questionCount}問作成してください。

## 重要な指示:
- 前回と重複しない、新しい視点の問題を作成
- より${getGenerationFocus(generationNumber)}な内容にフォーカス

## 教科書の内容:
${focusedText}
`;

    if (pastExamText && pastExamText.trim() && !isMobile) {
        prompt += `
## 過去問の参考:
${pastExamText.substring(0, 2000)}
`;
    }

    prompt += `
## 回答形式:
必ず以下のJSON形式で${questionCount}問作成してください：

\`\`\`json
[
  {
    "question": "問題文",
    "choices": ["選択肢A", "選択肢B", "選択肢C", "選択肢D", "選択肢E"],
    "correctAnswer": 0,
    "explanation": "詳細な解説"
  }
]
\`\`\`

注意事項:
- 前回と同じような問題は避ける
- より深い理解を要求する問題を作成
- 実際の試験で出題されそうな実用性の高い問題
`;

    return prompt;
}

// 生成回数に応じたフォーカス（軽量版）
function getGenerationFocus(generationNumber) {
    const focuses = [
        "基本的", // 1回目
        "応用的", // 2回目
        "実践的", // 3回目
        "統合的", // 4回目
        "発展的"  // 5回目以降
    ];
    
    const index = Math.min(generationNumber - 1, focuses.length - 1);
    return focuses[index];
}

// 既存のsaveGenerationData関数が呼び出されるように修正
// generateQuestionsLightweight関数内で確実にsaveGenerationDataが呼び出されるように確認


// スマホ用の追加機能

// タッチイベントの最適化
document.addEventListener('DOMContentLoaded', function() {
    // iOSのズーム無効化（API入力時の自動ズームを防ぐ）
    document.querySelectorAll('input[type="password"], input[type="file"]').forEach(input => {
        input.addEventListener('focus', function() {
            document.querySelector('meta[name=viewport]').setAttribute('content', 
                'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=0');
        });
        
        input.addEventListener('blur', function() {
            document.querySelector('meta[name=viewport]').setAttribute('content', 
                'width=device-width, initial-scale=1.0');
        });
    });
    
    // 長押しコンテキストメニューを無効化（問題文・選択肢）
    document.addEventListener('contextmenu', function(e) {
        if (e.target.classList.contains('choice') || 
            e.target.id === 'question-text') {
            e.preventDefault();
        }
    });
});

// スマホでの文字サイズ調整機能（オプション）
function adjustFontSize(size) {
    document.documentElement.style.fontSize = size + 'px';
    localStorage.setItem('fontSize', size);
}

// 保存された文字サイズを復元
document.addEventListener('DOMContentLoaded', function() {
    const savedFontSize = localStorage.getItem('fontSize');
    if (savedFontSize) {
        adjustFontSize(savedFontSize);
    }
});

// PWA機能
document.addEventListener('DOMContentLoaded', function() {
    // サービスワーカーの登録
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', function() {
            navigator.serviceWorker.register('./service-worker.js')
                .then(function(registration) {
                    console.log('ServiceWorker 登録成功:', registration.scope);
                })
                .catch(function(err) {
                    console.log('ServiceWorker 登録失敗:', err);
                });
        });
    }
    
    // アプリインストール促進
    let deferredPrompt;
    const installButton = createInstallButton();
    
    window.addEventListener('beforeinstallprompt', (e) => {
        // デフォルトのインストールプロンプトを防ぐ
        e.preventDefault();
        deferredPrompt = e;
        
        // カスタムインストールボタンを表示
        showInstallButton(installButton);
    });
    
    // インストール後の処理
    window.addEventListener('appinstalled', (evt) => {
        console.log('アプリがインストールされました');
        hideInstallButton(installButton);
        
        // インストール完了メッセージ
        showNotification('🎉 アプリがホーム画面に追加されました！', 'success');
    });
    
    // オンライン/オフライン状態の監視
    window.addEventListener('online', () => {
        showNotification('📶 オンラインに復帰しました', 'success');
    });
    
    window.addEventListener('offline', () => {
        showNotification('📴 オフラインモードです', 'warning');
    });
});

// カスタムインストールボタンを作成
function createInstallButton() {
    const button = document.createElement('button');
    button.id = 'install-app';
    button.className = 'btn-success install-btn hidden';
    button.innerHTML = '📱 アプリとしてインストール';
    button.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        z-index: 1000;
        border-radius: 50px;
        padding: 15px 25px;
        font-size: 14px;
        box-shadow: 0 4px 20px rgba(0,0,0,0.3);
        animation: pulse 2s infinite;
    `;
    
    button.addEventListener('click', installApp);
    document.body.appendChild(button);
    
    return button;
}

// インストールボタンを表示
function showInstallButton(button) {
    button.classList.remove('hidden');
}

// インストールボタンを非表示
function hideInstallButton(button) {
    button.classList.add('hidden');
}

// アプリインストール処理
async function installApp() {
    const installButton = document.getElementById('install-app');
    
    if (deferredPrompt) {
        // インストールプロンプトを表示
        deferredPrompt.prompt();
        
        // ユーザーの選択を待つ
        const { outcome } = await deferredPrompt.userChoice;
        
        if (outcome === 'accepted') {
            console.log('ユーザーがインストールを受け入れました');
        } else {
            console.log('ユーザーがインストールを拒否しました');
        }
        
        deferredPrompt = null;
        hideInstallButton(installButton);
    }
}

// 通知表示
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 15px 20px;
        border-radius: 8px;
        color: white;
        z-index: 1001;
        font-size: 14px;
        max-width: 300px;
        word-wrap: break-word;
        animation: slideIn 0.3s ease-out;
    `;
    
    // タイプに応じて背景色を設定
    switch(type) {
        case 'success':
            notification.style.backgroundColor = '#28a745';
            break;
        case 'warning':
            notification.style.backgroundColor = '#ffc107';
            notification.style.color = '#212529';
            break;
        case 'error':
            notification.style.backgroundColor = '#dc3545';
            break;
        default:
            notification.style.backgroundColor = '#667eea';
    }
    
    document.body.appendChild(notification);
    
    // 3秒後に自動で削除
    setTimeout(() => {
        if (notification.parentNode) {
            notification.remove();
        }
    }, 3000);
}

// アニメーション用CSS（動的に追加）
const style = document.createElement('style');
style.textContent = `
    @keyframes pulse {
        0% { transform: scale(1); }
        50% { transform: scale(1.05); }
        100% { transform: scale(1); }
    }
    
    @keyframes slideIn {
        from { 
            transform: translateX(100%); 
            opacity: 0; 
        }
        to { 
            transform: translateX(0); 
            opacity: 1; 
        }
    }
    
    .install-btn.hidden {
        display: none !important;
    }
`;
document.head.appendChild(style);

// データの永続化（ローカルストレージ活用）
function saveAppData(key, data) {
    try {
        localStorage.setItem(`exam-tool-${key}`, JSON.stringify(data));
    } catch (e) {
        console.error('データ保存エラー:', e);
    }
}

function loadAppData(key) {
    try {
        const data = localStorage.getItem(`exam-tool-${key}`);
        return data ? JSON.parse(data) : null;
    } catch (e) {
        console.error('データ読み込みエラー:', e);
        return null;
    }
}

// アプリの使用統計を保存
function trackAppUsage() {
    const usage = loadAppData('usage') || { 
        totalSessions: 0, 
        totalQuestions: 0, 
        lastUsed: null 
    };
    
    usage.totalSessions++;
    usage.lastUsed = new Date().toISOString();
    
    saveAppData('usage', usage);
}

// アプリ初期化時に統計を更新

document.addEventListener('DOMContentLoaded', trackAppUsage);
// 問題品質管理機能
let excludedQuestions = []; // 除外された問題のリスト
let questionQualityCache = {}; // AI応答のキャッシュ

// DOM要素（品質管理用）
let questionQualityBtn, reportProblemBtn, qualityForm, closeFormBtn;
let questionTab, reportTab, questionInput, reportDetails;
let askQuestionBtn, excludeQuestionBtn, improveQuestionBtn;
let aiResponse, aiResponseText, closeResponseBtn;

// 品質管理機能の初期化
document.addEventListener('DOMContentLoaded', function() {
    // 既存の初期化後に追加
    initQualityManagement();
});

function initQualityManagement() {
    // DOM要素取得
    questionQualityBtn = document.getElementById('question-quality-btn');
    reportProblemBtn = document.getElementById('report-problem-btn');
    qualityForm = document.getElementById('quality-form');
    closeFormBtn = document.getElementById('close-form-btn');
    
    questionTab = document.getElementById('question-tab');
    reportTab = document.getElementById('report-tab');
    questionInput = document.getElementById('question-input');
    reportDetails = document.getElementById('report-details');
    
    askQuestionBtn = document.getElementById('ask-question-btn');
    excludeQuestionBtn = document.getElementById('exclude-question-btn');
    improveQuestionBtn = document.getElementById('improve-question-btn');
    
    aiResponse = document.getElementById('ai-response');
    aiResponseText = document.getElementById('ai-response-text');
    closeResponseBtn = document.getElementById('close-response-btn');
    
    // イベントリスナー設定
    if (questionQualityBtn) questionQualityBtn.addEventListener('click', () => showQualityForm('question'));
    if (reportProblemBtn) reportProblemBtn.addEventListener('click', () => showQualityForm('report'));
    if (closeFormBtn) closeFormBtn.addEventListener('click', hideQualityForm);
    if (closeResponseBtn) closeResponseBtn.addEventListener('click', hideAIResponse);
    
    if (askQuestionBtn) askQuestionBtn.addEventListener('click', askQuestionAboutExplanation);
    if (excludeQuestionBtn) excludeQuestionBtn.addEventListener('click', excludeCurrentQuestion);
    if (improveQuestionBtn) improveQuestionBtn.addEventListener('click', improveCurrentQuestion);
    
    // タブ切り替え
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const tabName = e.target.dataset.tab;
            switchTab(tabName);
        });
    });
}

// 品質フォーム表示
function showQualityForm(tab = 'question') {
    if (qualityForm) {
        qualityForm.classList.remove('hidden');
        switchTab(tab);
        hideAIResponse();
    }
}

// 品質フォーム非表示
function hideQualityForm() {
    if (qualityForm) {
        qualityForm.classList.add('hidden');
    }
    hideAIResponse();
}

// AI応答非表示
function hideAIResponse() {
    if (aiResponse) {
        aiResponse.classList.add('hidden');
    }
}

// タブ切り替え
function switchTab(tabName) {
    // タブボタンの状態更新
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tabName);
    });
    
    // タブコンテンツの表示切り替え
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.toggle('active', content.id === `${tabName}-tab`);
    });
}

// 解説への質問機能
async function askQuestionAboutExplanation() {
    const question = questions[currentQuestionIndex];
    const userQuestion = questionInput.value.trim();
    
    if (!userQuestion) {
        alert('質問を入力してください。');
        return;
    }
    
    if (!lastApiKey) {
        alert('APIキーが設定されていません。');
        return;
    }
    
    // ローディング状態
    askQuestionBtn.disabled = true;
    askQuestionBtn.innerHTML = '<span class="loading-response"></span>回答生成中...';
    
    try {
        // キャッシュチェック
        const cacheKey = `${question.question}_${userQuestion}`;
        if (questionQualityCache[cacheKey]) {
            showAIResponse(questionQualityCache[cacheKey]);
            return;
        }
        
        // AIに質問
        const response = await askAIAboutQuestion(question, userQuestion, lastApiKey);
        
        // キャッシュに保存
        questionQualityCache[cacheKey] = response;
        
        // 応答表示
        showAIResponse(response);
        
    } catch (error) {
        console.error('質問処理エラー:', error);
        alert('質問の処理中にエラーが発生しました: ' + error.message);
    } finally {
        askQuestionBtn.disabled = false;
        askQuestionBtn.innerHTML = '📝 AIに質問する';
    }
}

// AIに問題について質問
async function askAIAboutQuestion(question, userQuestion, apiKey) {
    const prompt = `
以下の問題と解説について、ユーザーからの質問に詳しく回答してください。

【問題】
${question.question}

【選択肢】
${question.choices.map((choice, index) => `${String.fromCharCode(65 + index)}. ${choice}`).join('\n')}

【正解】
${String.fromCharCode(65 + question.correctAnswer)}. ${question.choices[question.correctAnswer]}

【現在の解説】
${question.explanation}

【ユーザーの質問】
${userQuestion}

以下の点に注意して回答してください：
1. ユーザーの質問に直接的に答える
2. 根拠や理由を明確に示す
3. もし現在の解説に不備がある場合は指摘する
4. 追加の情報や補足説明を提供する
5. 分かりやすく丁寧に説明する

回答:`;

    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
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
                    maxOutputTokens: 2000,
                    topP: 0.8,
                    topK: 40
                }
            })
        });
        
        if (!response.ok) {
            throw new Error(`API呼び出し失敗: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (!data.candidates || !data.candidates[0] || !data.candidates[0].content) {
            throw new Error('APIからの応答が不正です');
        }
        
        return data.candidates[0].content.parts[0].text;
        
    } catch (error) {
        console.error('AI質問API呼び出しエラー:', error);
        throw error;
    }
}

// AI応答表示
function showAIResponse(responseText) {
    if (aiResponseText) {
        aiResponseText.textContent = responseText;
    }
    if (aiResponse) {
        aiResponse.classList.remove('hidden');
    }
    
    // フォームをスクロールして応答が見えるようにする
    setTimeout(() => {
        if (aiResponse) {
            aiResponse.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    }, 100);
}

// 現在の問題を除外
function excludeCurrentQuestion() {
    const question = questions[currentQuestionIndex];
    
    // 報告理由を取得
    const selectedIssues = Array.from(document.querySelectorAll('input[name="issue"]:checked'))
        .map(cb => cb.value);
    const details = reportDetails ? reportDetails.value.trim() : '';
    
    const confirmMessage = selectedIssues.length > 0 
        ? `この問題を除外しますか？\n\n報告理由: ${selectedIssues.join(', ')}`
        : 'この問題を除外しますか？';
    
    if (!confirm(confirmMessage)) {
        return;
    }
    
    // 除外リストに追加
    excludedQuestions.push({
        question: question,
        index: currentQuestionIndex,
        issues: selectedIssues,
        details: details,
        timestamp: new Date().toISOString()
    });
    
    // 問題セットから削除
    questions.splice(currentQuestionIndex, 1);
    originalQuestions = originalQuestions.filter(q => q.question !== question.question);
    
    // インデックス調整
    if (currentQuestionIndex >= questions.length) {
        currentQuestionIndex = questions.length - 1;
    }
    
    // ローカルストレージに保存
    saveAppData('excludedQuestions', excludedQuestions);
    
    hideQualityForm();
    
    // 次の問題表示または終了
    if (questions.length === 0) {
        alert('すべての問題が除外されました。新しい問題を生成してください。');
        uploadSection.classList.remove('hidden');
        quizSection.classList.add('hidden');
    } else if (currentQuestionIndex < 0) {
        currentQuestionIndex = 0;
        showQuestion();
    } else {
        showQuestion();
    }
    
    console.log(`問題を除外しました。残り: ${questions.length}問`);
}

// 問題改善要求
async function improveCurrentQuestion() {
    const question = questions[currentQuestionIndex];
    
    if (!lastApiKey) {
        alert('APIキーが設定されていません。');
        return;
    }
    
    // 報告内容を取得
    const selectedIssues = Array.from(document.querySelectorAll('input[name="issue"]:checked'))
        .map(cb => cb.value);
    const details = reportDetails ? reportDetails.value.trim() : '';
    
    if (selectedIssues.length === 0 && !details) {
        alert('改善要求の内容を入力してください。');
        return;
    }
    
    // ローディング状態
    improveQuestionBtn.disabled = true;
    improveQuestionBtn.innerHTML = '<span class="loading-response"></span>修正中...';
    
    try {
        const improvedQuestion = await requestQuestionImprovement(question, selectedIssues, details, lastApiKey);
        
        if (improvedQuestion) {
            // 現在の問題を改善版に置き換え
            questions[currentQuestionIndex] = improvedQuestion;
            
            // 元の問題セットも更新
            const originalIndex = originalQuestions.findIndex(q => q.question === question.question);
            if (originalIndex !== -1) {
                originalQuestions[originalIndex] = improvedQuestion;
            }
            
            // 画面を更新
            hideQualityForm();
            showQuestion();
            
            alert('✅ 問題が改善されました！新しい解説を確認してください。');
        }
        
    } catch (error) {
        console.error('問題改善エラー:', error);
        alert('問題の改善中にエラーが発生しました: ' + error.message);
    } finally {
        improveQuestionBtn.disabled = false;
        improveQuestionBtn.innerHTML = '🔧 AIに修正依頼';
    }
}

// 問題改善をAIに依頼
async function requestQuestionImprovement(question, issues, details, apiKey) {
    const prompt = `
以下の問題について、指摘された問題点を修正してください。

【現在の問題】
問題文: ${question.question}
選択肢: ${question.choices.map((choice, index) => `${String.fromCharCode(65 + index)}. ${choice}`).join('\n')}
正解: ${String.fromCharCode(65 + question.correctAnswer)}. ${question.choices[question.correctAnswer]}
解説: ${question.explanation}

【指摘された問題点】
${issues.length > 0 ? issues.join(', ') : ''}
${details ? `詳細: ${details}` : ''}

【修正指示】
1. 指摘された問題点を解決してください
2. 解説の正確性を向上させてください
3. 選択肢と解説の一貫性を保ってください
4. より明確で理解しやすい解説にしてください

修正された問題をJSON形式で回答してください：

\`\`\`json
{
  "question": "修正された問題文",
  "choices": ["選択肢A", "選択肢B", "選択肢C", "選択肢D", "選択肢E"],
  "correctAnswer": 0,
  "explanation": "修正された詳細な解説"
}
\`\`\``;

    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
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
                    maxOutputTokens: 2000,
                    topP: 0.8,
                    topK: 40
                }
            })
        });
        
        if (!response.ok) {
            throw new Error(`API呼び出し失敗: ${response.status}`);
        }
        
        const data = await response.json();
        const content = data.candidates[0].content.parts[0].text;
        
        // JSONを解析
        const jsonMatch = content.match(/```json\n?([\s\S]*?)\n?```/);
        if (jsonMatch) {
            const improvedQuestion = JSON.parse(jsonMatch[1].trim());
            return improvedQuestion;
        }
        
        throw new Error('改善された問題のJSON解析に失敗しました');
        
    } catch (error) {
        console.error('問題改善API呼び出しエラー:', error);
        throw error;
    }
}

// ローカルストレージ関数（既存の関数が無い場合）
if (typeof saveAppData === 'undefined') {
    function saveAppData(key, data) {
        try {
            localStorage.setItem(`exam-tool-${key}`, JSON.stringify(data));
        } catch (e) {
            console.error('データ保存エラー:', e);
        }
    }
}

if (typeof loadAppData === 'undefined') {
    function loadAppData(key) {
        try {
            const data = localStorage.getItem(`exam-tool-${key}`);
            return data ? JSON.parse(data) : null;
        } catch (e) {
            console.error('データ読み込みエラー:', e);
            return null;
        }
    }
}

// アプリ開始時に除外された問題を読み込み
document.addEventListener('DOMContentLoaded', function() {
    const savedExcluded = loadAppData('excludedQuestions');
    if (savedExcluded) {
        excludedQuestions = savedExcluded;
        console.log(`除外された問題を読み込みました: ${excludedQuestions.length}問`);
    }
});

