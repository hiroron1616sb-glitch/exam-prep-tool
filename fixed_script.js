
// 予習問題作成ツール - 修正版
// 変数宣言の重複エラーを修正し、PDF参照機能を追加

// ===== グローバル変数の宣言（一箇所にまとめる） =====
let currentQuestionIndex = 0;
let score = 0;
let studyMode = "normal"; // 'normal', 'review'
let includeQuestions = [];
let excludeQuestions = [];
let questionsPool = []; 
let wrongCount = {};
let isQuestionMode = false;

// PDF関連のグローバル変数
let lastTextbookText = null;
let lastPastExamText = null;

// API Key
let apiKey = "";

// ===== PDF処理関数 =====
async function processPDF(file, type) {
    try {
        console.log(`Processing ${type} PDF:`, file.name);

        const text = await extractTextFromPDF(file);

        if (!text || text.trim().length === 0) {
            throw new Error(`PDFファイル「${file.name}」からテキストを読み取れませんでした。スキャン画像や暗号化されたPDFの可能性があります。`);
        }

        console.log(`Extracted ${text.length} characters from ${type} PDF`);

        // 50ページ制限のチェック（概算）
        const estimatedPages = Math.ceil(text.length / 2000);
        if (estimatedPages > 50) {
            throw new Error(`PDFファイル「${file.name}」は約${estimatedPages}ページで、50ページ制限を超えています。ファイルサイズを縮小してください。`);
        }

        // テキスト内容をグローバル変数に保存
        if (type === 'textbook') {
            lastTextbookText = text;
        } else if (type === 'pastexam') {
            lastPastExamText = text;
        }

        updateStatus(type, file.name, text.length);
        return text;
    } catch (error) {
        console.error(`PDF processing error for ${type}:`, error);
        showError(`PDFファイル「${file.name}」の処理でエラーが発生しました: ${error.message}`);
        throw error;
    }
}

async function extractTextFromPDF(file) {
    // PDFJSを使用してテキスト抽出
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;

    let text = '';
    for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map(item => item.str).join(' ');
        text += pageText + '\n';
    }

    return text;
}

function updateStatus(type, fileName, textLength) {
    if (type === 'textbook') {
        document.getElementById('textbook-status').textContent = `ファイル選択済: ${fileName}`;
    } else if (type === 'pastexam') {
        document.getElementById('pastexam-status').textContent = `ファイル選択済: ${fileName}`;
    }
}

// ===== 問題生成関数 =====
async function generateQuestions() {
    const apiKey = document.getElementById('api-key').value;

    if (!apiKey) {
        alert('Gemini API Keyを入力してください。');
        return;
    }

    // PDFがアップロードされているかチェック
    if (!lastTextbookText) {
        alert('教科書PDFがアップロードされていません。');
        return;
    }

    try {
        document.getElementById('generate-button').disabled = true;
        document.getElementById('generate-button').textContent = '問題生成中...';

        const prompt = createQuestionPrompt(lastTextbookText, lastPastExamText);
        const response = await callGeminiAPI(apiKey, prompt);

        // JSONレスポンスをパース
        const parsedQuestions = parseGeminiResponse(response);

        if (parsedQuestions && parsedQuestions.length > 0) {
            questionsPool = parsedQuestions;
            displayQuestions();
            document.getElementById('question-section').style.display = 'block';
        } else {
            throw new Error('問題の生成に失敗しました。');
        }

    } catch (error) {
        console.error('Question generation error:', error);
        alert('問題生成中にエラーが発生しました: ' + error.message);
    } finally {
        document.getElementById('generate-button').disabled = false;
        document.getElementById('generate-button').textContent = '問題を生成';
    }
}

function createQuestionPrompt(textbookText, pastExamText) {
    let prompt = `以下の教科書の内容から、5択問題を10問作成してください。`;

    if (pastExamText) {
        prompt += `過去問も参考にして、実際の試験レベルに合わせてください。\n\n【過去問】\n${pastExamText.substring(0, 10000)}\n\n`;
    }

    prompt += `【教科書】\n${textbookText.substring(0, 15000)}\n\n`;
    prompt += `
出力形式（必ずこの形式で）:
[
  {
    "question": "問題文",
    "choices": ["選択肢1", "選択肢2", "選択肢3", "選択肢4", "選択肢5"],
    "correct": 0,
    "explanation": "詳細な解説"
  }
]

要件:
- 問題は基礎〜応用レベルで作成
- 選択肢は明確に区別できるものに
- correctは正解の選択肢のインデックス（0-4）
- 解説は詳細で理解しやすく
- 必ずJSON配列形式で出力`;

    return prompt;
}

async function callGeminiAPI(apiKey, prompt) {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            contents: [{
                parts: [{
                    text: prompt
                }]
            }]
        })
    });

    if (!response.ok) {
        throw new Error(`API request failed: ${response.status}`);
    }

    const data = await response.json();

    if (!data.candidates || !data.candidates[0] || !data.candidates[0].content) {
        throw new Error('Invalid API response format');
    }

    return data.candidates[0].content.parts[0].text;
}

function parseGeminiResponse(response) {
    try {
        // JSONの開始と終了を見つける
        const startIndex = response.indexOf('[');
        const endIndex = response.lastIndexOf(']');

        if (startIndex === -1 || endIndex === -1) {
            throw new Error('JSON format not found in response');
        }

        const jsonStr = response.substring(startIndex, endIndex + 1);
        const questions = JSON.parse(jsonStr);

        // 各問題の形式を検証
        return questions.map((q, index) => {
            if (!q.question || !q.choices || !Array.isArray(q.choices) || q.choices.length !== 5) {
                throw new Error(`Question ${index + 1} has invalid format`);
            }

            return {
                question: q.question,
                choices: q.choices,
                correct: parseInt(q.correct),
                explanation: q.explanation || "解説が提供されていません"
            };
        });

    } catch (error) {
        console.error('Failed to parse response:', response);
        throw new Error(`レスポンスの解析に失敗しました: ${error.message}`);
    }
}

// ===== 質問表示・回答処理 =====
function displayQuestions() {
    if (!questionsPool || questionsPool.length === 0) return;

    currentQuestionIndex = 0;
    showQuestion();
}

function showQuestion() {
    if (currentQuestionIndex >= questionsPool.length) {
        showResult();
        return;
    }

    const question = questionsPool[currentQuestionIndex];
    document.getElementById('question-text').textContent = question.question;

    const choicesDiv = document.getElementById('choices');
    choicesDiv.innerHTML = '';

    question.choices.forEach((choice, index) => {
        const button = document.createElement('button');
        button.textContent = `${index + 1}. ${choice}`;
        button.className = 'choice-button';
        button.onclick = () => selectAnswer(index);
        choicesDiv.appendChild(button);
    });

    document.getElementById('question-counter').textContent = 
        `問題 ${currentQuestionIndex + 1} / ${questionsPool.length}`;
}

function selectAnswer(selectedIndex) {
    const question = questionsPool[currentQuestionIndex];
    const isCorrect = selectedIndex === question.correct;

    if (isCorrect) {
        score++;
    } else {
        // 間違えた問題を記録
        const questionId = `q_${currentQuestionIndex}`;
        wrongCount[questionId] = (wrongCount[questionId] || 0) + 1;
    }

    showFeedback(selectedIndex, question.correct, question.explanation);
}

function showFeedback(selected, correct, explanation) {
    const choices = document.querySelectorAll('.choice-button');

    choices.forEach((choice, index) => {
        if (index === correct) {
            choice.classList.add('correct');
        } else if (index === selected && index !== correct) {
            choice.classList.add('incorrect');
        }
        choice.disabled = true;
    });

    // 解説表示
    const explanationDiv = document.getElementById('explanation');
    explanationDiv.innerHTML = `
        <h4>解説:</h4>
        <p>${explanation}</p>
        <div class="explanation-actions">
            <button onclick="askAIAboutQuestion()" class="ask-ai-button">解説について質問</button>
        </div>
    `;
    explanationDiv.style.display = 'block';

    // 次へボタン表示
    document.getElementById('next-button').style.display = 'block';
}

// ===== PDF参照機能付き AI質問機能 =====
async function askAIAboutQuestion() {
    const question = questionsPool[currentQuestionIndex];
    const userQuestion = prompt("解説について質問してください（例: この概念について教科書の他の部分ではどう説明されていますか？）:");

    if (!userQuestion) return;

    // PDFがアップロードされているかチェック
    if (!lastTextbookText && !lastPastExamText) {
        alert('PDF参照機能を使用するには、教科書または過去問PDFをアップロードしてください。');
        return;
    }

    try {
        const apiKeyValue = document.getElementById('api-key').value;
        if (!apiKeyValue) {
            alert('API Keyが設定されていません。');
            return;
        }

        // AI質問用のコンテキストを構築
        const contextPrompt = createAIQuestionPrompt(question, userQuestion, lastTextbookText, lastPastExamText);

        // ローディング表示
        const loadingDiv = document.createElement('div');
        loadingDiv.className = 'ai-loading';
        loadingDiv.textContent = 'AIが回答を生成中...';
        document.getElementById('explanation').appendChild(loadingDiv);

        const response = await callGeminiAPI(apiKeyValue, contextPrompt);

        // ローディング削除
        loadingDiv.remove();

        // AI回答を表示
        const aiResponseDiv = document.createElement('div');
        aiResponseDiv.className = 'ai-response';
        aiResponseDiv.innerHTML = `
            <h5>AI回答:</h5>
            <div class="ai-answer">${response}</div>
        `;
        document.getElementById('explanation').appendChild(aiResponseDiv);

    } catch (error) {
        console.error('AI質問エラー:', error);
        alert('AI質問中にエラーが発生しました: ' + error.message);
    }
}

function createAIQuestionPrompt(currentQuestion, userQuestion, textbookText, pastExamText) {
    let prompt = `以下の状況で質問に答えてください:\n\n`;

    // 現在の問題情報
    prompt += `【現在の問題】\n`;
    prompt += `問題: ${currentQuestion.question}\n`;
    prompt += `正解: ${currentQuestion.choices[currentQuestion.correct]}\n`;
    prompt += `解説: ${currentQuestion.explanation}\n\n`;

    // ユーザーの質問
    prompt += `【質問】\n${userQuestion}\n\n`;

    // アップロードされたPDF内容をコンテキストに含める
    if (textbookText) {
        // 質問に関連する部分を特定（簡易版）
        const relevantText = findRelevantTextSection(userQuestion, textbookText);
        prompt += `【教科書の関連内容】\n${relevantText}\n\n`;
    }

    if (pastExamText) {
        const relevantPastExam = findRelevantTextSection(userQuestion, pastExamText);
        prompt += `【過去問の関連内容】\n${relevantPastExam}\n\n`;
    }

    prompt += `上記の教科書と過去問の内容を参照して、質問に詳しく答えてください。特に以下の点を重視してください:
- アップロードされた教材の内容に基づいた説明
- 具体的な例や関連する概念の説明
- 理解を深めるための追加情報
- 可能であれば教科書の他の章や過去問との関連性`;

    return prompt;
}

function findRelevantTextSection(question, text) {
    // 簡易的な関連テキスト検索
    const keywords = question.toLowerCase().split(/\s+/).filter(word => word.length > 2);
    const sentences = text.split(/[.。!！?？]/).filter(s => s.trim().length > 20);

    // キーワードを含む文章を検索
    const relevantSentences = sentences.filter(sentence => {
        const sentenceLower = sentence.toLowerCase();
        return keywords.some(keyword => sentenceLower.includes(keyword));
    });

    // 関連する文章がある場合は上位10文を返す
    if (relevantSentences.length > 0) {
        return relevantSentences.slice(0, 10).join('。') + '。';
    }

    // 関連する文章がない場合は、テキストの最初の部分を返す
    return text.substring(0, 2000) + '...';
}

// ===== その他の基本機能 =====
function nextQuestion() {
    currentQuestionIndex++;

    // 解説とボタンを隠す
    document.getElementById('explanation').style.display = 'none';
    document.getElementById('next-button').style.display = 'none';

    showQuestion();
}

function showResult() {
    const percentage = Math.round((score / questionsPool.length) * 100);

    document.getElementById('question-section').innerHTML = `
        <div class="result">
            <h3>結果</h3>
            <p>正解数: ${score} / ${questionsPool.length}</p>
            <p>正解率: ${percentage}%</p>
            <button onclick="startReview()" class="review-button">間違えた問題を復習</button>
            <button onclick="generateAdditionalQuestions()" class="additional-button">追加問題を生成</button>
            <button onclick="location.reload()" class="restart-button">最初から</button>
        </div>
    `;
}

async function startReview() {
    // 間違えた問題だけを抽出
    const reviewQuestions = questionsPool.filter((_, index) => {
        const questionId = `q_${index}`;
        return wrongCount[questionId] > 0;
    });

    if (reviewQuestions.length === 0) {
        alert('復習する問題がありません！');
        return;
    }

    questionsPool = reviewQuestions;
    currentQuestionIndex = 0;
    score = 0;
    studyMode = "review";

    document.getElementById('question-section').innerHTML = `
        <div id="question-container">
            <h3 id="question-counter"></h3>
            <div id="question-text"></div>
            <div id="choices"></div>
            <div id="explanation" style="display: none;"></div>
            <button id="next-button" onclick="nextQuestion()" style="display: none;">次の問題</button>
        </div>
    `;

    showQuestion();
}

async function generateAdditionalQuestions() {
    const apiKeyValue = document.getElementById('api-key').value;

    if (!apiKeyValue) {
        alert('API Keyを設定してください。');
        return;
    }

    if (!lastTextbookText) {
        alert('教科書PDFがアップロードされていません。');
        return;
    }

    try {
        // 追加問題生成のプロンプト
        const additionalPrompt = createAdditionalQuestionPrompt(lastTextbookText, lastPastExamText);

        alert('追加問題を生成中...');
        const response = await callGeminiAPI(apiKeyValue, additionalPrompt);
        const additionalQuestions = parseGeminiResponse(response);

        if (additionalQuestions && additionalQuestions.length > 0) {
            questionsPool = questionsPool.concat(additionalQuestions);
            alert(`${additionalQuestions.length}問の追加問題を生成しました。`);

            // 新しい問題から開始
            currentQuestionIndex = questionsPool.length - additionalQuestions.length;
            score = 0;

            document.getElementById('question-section').innerHTML = `
                <div id="question-container">
                    <h3 id="question-counter"></h3>
                    <div id="question-text"></div>
                    <div id="choices"></div>
                    <div id="explanation" style="display: none;"></div>
                    <button id="next-button" onclick="nextQuestion()" style="display: none;">次の問題</button>
                </div>
            `;

            showQuestion();
        }

    } catch (error) {
        console.error('Additional question generation error:', error);
        alert('追加問題生成でエラーが発生しました: ' + error.message);
    }
}

function createAdditionalQuestionPrompt(textbookText, pastExamText) {
    let prompt = `前回とは異なる観点から、以下の教科書内容に基づいて新しい5択問題を5問作成してください。`;

    if (pastExamText) {
        prompt += `過去問も参考にしてください。\n\n【過去問】\n${pastExamText.substring(0, 8000)}\n\n`;
    }

    prompt += `【教科書】\n${textbookText.substring(0, 12000)}\n\n`;

    prompt += `
出力形式（必ずこの形式で）:
[
  {
    "question": "問題文",
    "choices": ["選択肢1", "選択肢2", "選択肢3", "選択肢4", "選択肢5"],
    "correct": 0,
    "explanation": "詳細な解説"
  }
]

要件:
- 前回とは異なる内容・観点の問題
- より発展的・応用的な内容を含める
- 実践的な問題も含める
- JSON配列形式で出力`;

    return prompt;
}

function showError(message) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    errorDiv.textContent = message;
    document.body.appendChild(errorDiv);

    setTimeout(() => {
        errorDiv.remove();
    }, 5000);
}

// ===== イベントリスナーの設定 =====
document.addEventListener('DOMContentLoaded', function() {
    // PDF.js workerの設定
    if (typeof pdfjsLib !== 'undefined') {
        pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js';
    }

    // ファイル選択イベント
    document.getElementById('textbook-pdf').addEventListener('change', async function(e) {
        if (e.target.files.length > 0) {
            try {
                await processPDF(e.target.files[0], 'textbook');
            } catch (error) {
                console.error('Textbook PDF processing failed:', error);
            }
        }
    });

    document.getElementById('pastexam-pdf').addEventListener('change', async function(e) {
        if (e.target.files.length > 0) {
            try {
                await processPDF(e.target.files[0], 'pastexam');
            } catch (error) {
                console.error('Past exam PDF processing failed:', error);
            }
        }
    });

    // 問題生成ボタン
    document.getElementById('generate-button').addEventListener('click', generateQuestions);
});
