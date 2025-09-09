// グローバル変数（既存 + PDF機能追加）
let questions = [];
let currentQuestionIndex = 0;
let score = 0;
let wrongQuestions = [];
let wrongCount = 0;
let studyMode = 'normal'; // 'normal' または 'review'
let excludedQuestions = []; // 除外された問題のリスト
let questionQualityCache = {}; // AI応答のキャッシュ

// PDF内容を保存するグローバル変数（新規追加）
let lastTextbookText = null;      // 教科書のテキスト内容
let lastPastExamText = null;      // 過去問のテキスト内容
let lastApiKey = null;            // 最後に使用されたAPIキー

// PDF処理用の関数群

// PDFファイル処理のメイン関数
async function processPDF(file, type) {
    try {
        console.log(`Processing ${type} PDF:`, file.name);

        // PDF.jsを使用してテキストを抽出
        const text = await extractTextFromPDF(file);

        if (!text || text.trim().length === 0) {
            throw new Error('PDFからテキストを抽出できませんでした');
        }

        console.log(`Extracted ${text.length} characters from ${type} PDF`);

        // 抽出したテキストを適切な変数に保存
        if (type === 'textbook') {
            lastTextbookText = text;
            console.log('教科書テキストを更新しました');
        } else if (type === 'pastexam') {
            lastPastExamText = text;
            console.log('過去問テキストを更新しました');
        }

        // UI更新
        updatePDFStatus(type, file.name, text.length);

        return text;

    } catch (error) {
        console.error(`PDF processing error for ${type}:`, error);
        showError(`${type === 'textbook' ? '教科書' : '過去問'}PDFの処理中にエラーが発生しました: ${error.message}`);
        throw error;
    }
}

// PDF.jsを使用してPDFからテキストを抽出
async function extractTextFromPDF(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = async function(e) {
            try {
                const arrayBuffer = e.target.result;

                // PDF.jsを使用してPDFを読み込み
                const pdf = await pdfjsLib.getDocument({data: arrayBuffer}).promise;
                let fullText = '';

                console.log(`PDF has ${pdf.numPages} pages`);

                // 各ページからテキストを抽出
                for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
                    try {
                        const page = await pdf.getPage(pageNum);
                        const textContent = await page.getTextContent();

                        // テキスト項目を結合
                        const pageText = textContent.items.map(item => item.str).join(' ');
                        fullText += pageText + '\n\n';

                        // 進行状況を表示
                        if (pageNum % 10 === 0 || pageNum === pdf.numPages) {
                            console.log(`Processed page ${pageNum}/${pdf.numPages}`);
                        }

                    } catch (pageError) {
                        console.warn(`Error processing page ${pageNum}:`, pageError);
                        // ページエラーがあっても続行
                    }
                }

                resolve(fullText.trim());

            } catch (error) {
                reject(new Error(`PDF読み込みエラー: ${error.message}`));
            }
        };

        reader.onerror = function() {
            reject(new Error('ファイルの読み込みに失敗しました'));
        };

        reader.readAsArrayBuffer(file);
    });
}

// ファイル入力のイベントハンドラー
function setupPDFUploadHandlers() {
    // 教科書PDF用
    const textbookInput = document.getElementById('textbook-upload');
    if (textbookInput) {
        textbookInput.addEventListener('change', async function(e) {
            const file = e.target.files[0];
            if (file && file.type === 'application/pdf') {
                try {
                    await processPDF(file, 'textbook');
                    showSuccess('教科書PDFが正常にアップロードされました');
                } catch (error) {
                    console.error('Textbook PDF upload failed:', error);
                }
            } else if (file) {
                showError('PDFファイルを選択してください');
            }
        });
    }

    // 過去問PDF用
    const pastExamInput = document.getElementById('pastexam-upload');
    if (pastExamInput) {
        pastExamInput.addEventListener('change', async function(e) {
            const file = e.target.files[0];
            if (file && file.type === 'application/pdf') {
                try {
                    await processPDF(file, 'pastexam');
                    showSuccess('過去問PDFが正常にアップロードされました');
                } catch (error) {
                    console.error('Past exam PDF upload failed:', error);
                }
            } else if (file) {
                showError('PDFファイルを選択してください');
            }
        });
    }
}

// PDF処理状況をUIに表示
function updatePDFStatus(type, filename, textLength) {
    const statusElement = document.getElementById(`${type}-status`);
    if (statusElement) {
        statusElement.innerHTML = `
            <div class="pdf-status-success">
                <i class="fas fa-check-circle"></i>
                <span>${filename}</span>
                <small>(${textLength.toLocaleString()} 文字)</small>
            </div>
        `;
    }
}

// 成功メッセージの表示
function showSuccess(message) {
    console.log('Success:', message);
    // 既存の通知システムがあれば使用、なければコンソールログ
    if (typeof showNotification === 'function') {
        showNotification(message, 'success');
    }
}

// エラーメッセージの表示
function showError(message) {
    console.error('Error:', message);
    alert(message); // 基本的なアラートとして表示
}

// PDF内容をクリアする関数
function clearPDFContent(type) {
    if (type === 'textbook' || type === 'both') {
        lastTextbookText = null;
        console.log('教科書PDFの内容をクリアしました');
    }
    if (type === 'pastexam' || type === 'both') {
        lastPastExamText = null;
        console.log('過去問PDFの内容をクリアしました');
    }

    // UI更新
    if (type === 'textbook' || type === 'both') {
        const statusElement = document.getElementById('textbook-status');
        if (statusElement) statusElement.innerHTML = '<span class="no-pdf">未アップロード</span>';
    }
    if (type === 'pastexam' || type === 'both') {
        const statusElement = document.getElementById('pastexam-status');
        if (statusElement) statusElement.innerHTML = '<span class="no-pdf">未アップロード</span>';
    }
}

// PDF内容の統計情報を取得
function getPDFStats() {
    return {
        textbook: {
            available: lastTextbookText && lastTextbookText.length > 0,
            length: lastTextbookText ? lastTextbookText.length : 0,
            preview: lastTextbookText ? lastTextbookText.substring(0, 100) + '...' : null
        },
        pastExam: {
            available: lastPastExamText && lastPastExamText.length > 0,
            length: lastPastExamText ? lastPastExamText.length : 0,
            preview: lastPastExamText ? lastPastExamText.substring(0, 100) + '...' : null
        }
    };
}

// 初期化時にイベントハンドラーを設定
document.addEventListener('DOMContentLoaded', function() {
    console.log('Setting up PDF upload handlers...');
    setupPDFUploadHandlers();
});

// PDF内容を保存するグローバル変数（既存のグローバル変数セクションに追加）
let lastTextbookText = null;      // 教科書のテキスト内容
let lastPastExamText = null;      // 過去問のテキスト内容
let lastApiKey = null;            // 最後に使用されたAPIキー

// 改良されたaskAIAboutQuestion関数
async function askAIAboutQuestion(question, userQuestion, apiKey) {
    // PDF内容の存在チェック
    const hasTextbook = lastTextbookText && lastTextbookText.length > 0;
    const hasPastExam = lastPastExamText && lastPastExamText.length > 0;

    console.log('PDF Context Status:', {
        hasTextbook,
        hasPastExam,
        textbookLength: hasTextbook ? lastTextbookText.length : 0,
        pastExamLength: hasPastExam ? lastPastExamText.length : 0
    });

    // PDFコンテキストの準備
    let contextSection = '';

    if (hasTextbook || hasPastExam) {
        contextSection += '\n\n【参考資料】\n';

        if (hasTextbook) {
            // 教科書内容から関連部分を抽出（最初の2000文字まで使用）
            const textbookSummary = extractRelevantContent(lastTextbookText, userQuestion, 2000);
            contextSection += `\n【教科書内容】\n${textbookSummary}\n`;
        }

        if (hasPastExam) {
            // 過去問内容から関連部分を抽出
            const pastExamSummary = extractRelevantContent(lastPastExamText, userQuestion, 1500);
            contextSection += `\n【過去問内容】\n${pastExamSummary}\n`;
        }

        contextSection += '\n上記の参考資料を踏まえて回答してください。';
    }

    // 改良されたプロンプト
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
${userQuestion}${contextSection}

以下の点に注意して回答してください：
1. ユーザーの質問に直接的に答える
2. 根拠や理由を明確に示す
3. 参考資料がある場合は、その内容を活用して深い分析を提供する
4. もし現在の解説に不備がある場合は指摘する
5. 追加の情報や補足説明を提供する
6. NotebookLMのような詳細で包括的な分析を心がける
7. 分かりやすく丁寧に説明する

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
                    maxOutputTokens: 3000,  // PDFコンテキストに対応して増加
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

        // PDF内容が存在しない場合の適切なエラーメッセージ
        if (!hasTextbook && !hasPastExam) {
            console.warn('PDF内容が利用できません。基本的な回答を提供します。');
        }

        throw error;
    }
}

// PDF内容から質問に関連する部分を抽出する補助関数
function extractRelevantContent(text, userQuestion, maxLength = 2000) {
    if (!text || text.length === 0) {
        return '';
    }

    // 質問のキーワードを抽出
    const keywords = extractKeywords(userQuestion);

    // キーワードに基づいて関連セクションを検索
    const relevantSections = findRelevantSections(text, keywords);

    if (relevantSections.length > 0) {
        // 関連セクションを結合して返す
        let result = relevantSections.join('\n\n');

        // 最大長を超える場合は切り詰める
        if (result.length > maxLength) {
            result = result.substring(0, maxLength) + '...（以下省略）';
        }

        return result;
    } else {
        // 関連部分が見つからない場合は、冒頭部分を返す
        const summary = text.substring(0, maxLength);
        return summary + (text.length > maxLength ? '...（以下省略）' : '');
    }
}

// 質問からキーワードを抽出する関数
function extractKeywords(question) {
    // 基本的なキーワード抽出（より高度な自然言語処理も可能）
    const stopWords = new Set(['は', 'が', 'を', 'に', 'で', 'と', 'の', 'な', 'だ', 'である', 'です', 'ます', 'た', 'て', 'い', 'う', 'か', 'から', 'まで', 'より', 'について', 'によって']);

    // 文字を単語に分割（簡易版）
    const words = question.split(/[\s、。！？]+/).filter(word => 
        word.length > 1 && !stopWords.has(word)
    );

    return words;
}

// テキストから関連セクションを検索する関数
function findRelevantSections(text, keywords) {
    const sections = [];
    const lines = text.split('\n');

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // キーワードが含まれる行を探す
        const hasKeyword = keywords.some(keyword => 
            line.toLowerCase().includes(keyword.toLowerCase())
        );

        if (hasKeyword) {
            // 関連する行の前後を含めて抽出
            const start = Math.max(0, i - 2);
            const end = Math.min(lines.length, i + 3);
            const section = lines.slice(start, end).join('\n');
            sections.push(section);
        }
    }

    // 重複を除去
    return [...new Set(sections)];
}

// NotebookLMライクな高度な分析機能

// 複数の分析タイプを統合した質問応答システム
async function askAIWithAdvancedAnalysis(question, userQuestion, apiKey) {
    console.log('Starting advanced analysis...');

    try {
        // 1. 基本的なコンテキスト分析
        const contextAnalysis = await analyzeContext(question, userQuestion);

        // 2. PDF内容の深い分析
        const pdfAnalysis = await analyzePDFContent(userQuestion);

        // 3. 質問の意図分析
        const intentAnalysis = analyzeQuestionIntent(userQuestion);

        // 4. 統合プロンプトの生成
        const enhancedPrompt = buildAdvancedPrompt(question, userQuestion, contextAnalysis, pdfAnalysis, intentAnalysis);

        // 5. Gemini APIに送信
        const response = await callGeminiWithAdvancedPrompt(enhancedPrompt, apiKey);

        return response;

    } catch (error) {
        console.error('Advanced analysis failed:', error);

        // フォールバック: 基本のaskAIAboutQuestion関数を使用
        console.log('Falling back to basic askAIAboutQuestion...');
        return await askAIAboutQuestion(question, userQuestion, apiKey);
    }
}

// コンテキスト分析: 問題の複雑さや分野を分析
async function analyzeContext(question, userQuestion) {
    const analysis = {
        complexity: 'basic',
        domain: 'general',
        requires_calculation: false,
        requires_deep_reasoning: false,
        question_type: 'explanation'
    };

    // 複雑さの判定
    const complexityIndicators = ['なぜ', '根拠', '理由', '比較', '違い', '関係', '影響', '結果'];
    analysis.complexity = complexityIndicators.some(indicator => 
        userQuestion.includes(indicator)) ? 'advanced' : 'basic';

    // 計算が必要かどうか
    analysis.requires_calculation = /[0-9]+|計算|求める|算出/.test(userQuestion);

    // 深い推論が必要かどうか
    const deepReasoningIndicators = ['分析', '考察', '評価', '判断', '推論', '予測'];
    analysis.requires_deep_reasoning = deepReasoningIndicators.some(indicator => 
        userQuestion.includes(indicator));

    // 質問タイプの分類
    if (userQuestion.includes('具体例') || userQuestion.includes('例')) {
        analysis.question_type = 'example_request';
    } else if (userQuestion.includes('手順') || userQuestion.includes('方法')) {
        analysis.question_type = 'procedure_request';
    } else if (userQuestion.includes('比較') || userQuestion.includes('違い')) {
        analysis.question_type = 'comparison';
    }

    return analysis;
}

// PDF内容の深い分析
async function analyzePDFContent(userQuestion) {
    const analysis = {
        relevant_sections: [],
        key_concepts: [],
        related_topics: [],
        confidence_score: 0
    };

    // 教科書からの関連セクション抽出
    if (lastTextbookText) {
        const textbookSections = await findRelevantSectionsAdvanced(lastTextbookText, userQuestion, 'textbook');
        analysis.relevant_sections.push(...textbookSections);
    }

    // 過去問からの関連情報抽出
    if (lastPastExamText) {
        const pastExamSections = await findRelevantSectionsAdvanced(lastPastExamText, userQuestion, 'pastexam');
        analysis.relevant_sections.push(...pastExamSections);
    }

    // キー概念の抽出
    analysis.key_concepts = extractKeyConcepts(userQuestion, analysis.relevant_sections);

    // 関連トピックの推定
    analysis.related_topics = findRelatedTopics(analysis.key_concepts, analysis.relevant_sections);

    // 信頼度スコアの計算
    analysis.confidence_score = calculateConfidenceScore(analysis);

    return analysis;
}

// より高度な関連セクション検索
async function findRelevantSectionsAdvanced(text, userQuestion, source) {
    const sections = [];
    const lines = text.split('\n');
    const keywords = extractKeywords(userQuestion);

    // セクションヘッダーの検出パターン
    const headerPatterns = [
        /^[0-9]+[\.．]/, // 1. 2. 形式
        /^第[0-9]+[章節]/, // 第1章 形式
        /^[■□◆◇●○]/, // 記号付きヘッダー
        /^【.*】/, // 【】で囲まれたヘッダー
    ];

    let currentSection = null;
    let sectionContent = [];

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();

        // セクションヘッダーの検出
        const isHeader = headerPatterns.some(pattern => pattern.test(line));

        if (isHeader && line.length < 100) {
            // 前のセクションを保存
            if (currentSection && sectionContent.length > 0) {
                const content = sectionContent.join('\n');
                const relevanceScore = calculateRelevanceScore(content, keywords);

                if (relevanceScore > 0.3) {
                    sections.push({
                        title: currentSection,
                        content: content,
                        source: source,
                        relevance_score: relevanceScore,
                        line_start: i - sectionContent.length,
                        line_end: i - 1
                    });
                }
            }

            currentSection = line;
            sectionContent = [];
        } else {
            sectionContent.push(line);
        }
    }

    // 最後のセクションを処理
    if (currentSection && sectionContent.length > 0) {
        const content = sectionContent.join('\n');
        const relevanceScore = calculateRelevanceScore(content, keywords);

        if (relevanceScore > 0.3) {
            sections.push({
                title: currentSection,
                content: content,
                source: source,
                relevance_score: relevanceScore
            });
        }
    }

    // 関連度順にソート
    return sections.sort((a, b) => b.relevance_score - a.relevance_score).slice(0, 5);
}

// 関連度スコアの計算
function calculateRelevanceScore(content, keywords) {
    let score = 0;
    const contentLower = content.toLowerCase();

    for (const keyword of keywords) {
        const keywordLower = keyword.toLowerCase();
        const occurrences = (contentLower.match(new RegExp(keywordLower, 'g')) || []).length;

        // キーワードの出現頻度に基づくスコア
        score += occurrences * 0.1;

        // キーワードが近くにある場合のボーナス
        if (occurrences > 0) {
            score += 0.2;
        }
    }

    return Math.min(score, 1.0); // 最大値を1.0に制限
}

// キー概念の抽出
function extractKeyConcepts(userQuestion, relevantSections) {
    const concepts = new Set();

    // 質問から概念を抽出
    const questionKeywords = extractKeywords(userQuestion);
    questionKeywords.forEach(keyword => concepts.add(keyword));

    // 関連セクションから重要な概念を抽出
    for (const section of relevantSections) {
        const sectionKeywords = extractImportantTerms(section.content);
        sectionKeywords.slice(0, 3).forEach(term => concepts.add(term)); // 上位3つ
    }

    return Array.from(concepts);
}

// 重要な用語の抽出
function extractImportantTerms(text) {
    // 専門用語や重要概念を示すパターン
    const importantPatterns = [
        /【(.*?)】/g, // 【】で囲まれた用語
        /「(.*?)」/g, // 「」で囲まれた用語
        /《(.*?)》/g, // 《》で囲まれた用語
    ];

    const terms = [];

    for (const pattern of importantPatterns) {
        const matches = text.matchAll(pattern);
        for (const match of matches) {
            if (match[1] && match[1].length > 1 && match[1].length < 20) {
                terms.push(match[1]);
            }
        }
    }

    return terms;
}

// 関連トピックの検索
function findRelatedTopics(keyConcepts, relevantSections) {
    const topics = new Set();

    // セクションタイトルから関連トピックを抽出
    for (const section of relevantSections) {
        if (section.title && section.title.length > 2 && section.title.length < 50) {
            topics.add(section.title);
        }
    }

    return Array.from(topics).slice(0, 5); // 最大5つのトピック
}

// 信頼度スコアの計算
function calculateConfidenceScore(analysis) {
    let score = 0;

    // 関連セクションの数と品質
    if (analysis.relevant_sections.length > 0) {
        score += 0.3;
        const avgRelevance = analysis.relevant_sections.reduce((sum, s) => sum + s.relevance_score, 0) / analysis.relevant_sections.length;
        score += avgRelevance * 0.4;
    }

    // キー概念の数
    if (analysis.key_concepts.length > 0) {
        score += Math.min(analysis.key_concepts.length * 0.1, 0.3);
    }

    return Math.min(score, 1.0);
}

// 質問の意図分析
function analyzeQuestionIntent(userQuestion) {
    const intent = {
        type: 'general',
        urgency: 'normal',
        depth_required: 'basic',
        expects_examples: false,
        expects_step_by_step: false
    };

    // 質問タイプの分類
    if (userQuestion.includes('詳しく') || userQuestion.includes('詳細に')) {
        intent.depth_required = 'detailed';
    }

    if (userQuestion.includes('急い') || userQuestion.includes('すぐに')) {
        intent.urgency = 'high';
    }

    if (userQuestion.includes('例') || userQuestion.includes('具体的')) {
        intent.expects_examples = true;
    }

    if (userQuestion.includes('手順') || userQuestion.includes('ステップ') || userQuestion.includes('方法')) {
        intent.expects_step_by_step = true;
    }

    return intent;
}

// 高度なプロンプトの構築
function buildAdvancedPrompt(question, userQuestion, contextAnalysis, pdfAnalysis, intentAnalysis) {
    let prompt = `
あなたは教育専門のAIアシスタントです。NotebookLMのように深い分析と包括的な回答を提供してください。

【問題】
${question.question}

【選択肢】
${question.choices.map((choice, index) => `${String.fromCharCode(65 + index)}. ${choice}`).join('\n')}

【正解】
${String.fromCharCode(65 + question.correctAnswer)}. ${question.choices[question.correctAnswer]}

【現在の解説】
${question.explanation}

【ユーザーの質問】
${userQuestion}`;

    // PDF分析結果を追加
    if (pdfAnalysis.relevant_sections.length > 0) {
        prompt += `\n\n【参考資料からの関連情報】\n`;

        for (const section of pdfAnalysis.relevant_sections.slice(0, 3)) {
            prompt += `\n◆ ${section.title} (${section.source === 'textbook' ? '教科書' : '過去問'}より)\n`;
            prompt += `${section.content.substring(0, 500)}...\n`;
        }
    }

    // キー概念を追加
    if (pdfAnalysis.key_concepts.length > 0) {
        prompt += `\n\n【重要概念】\n${pdfAnalysis.key_concepts.join(', ')}`;
    }

    // 回答指針を追加
    prompt += `\n\n【回答指針】\n`;
    prompt += `1. 質問に直接的かつ包括的に回答する\n`;
    prompt += `2. 参考資料の情報を積極的に活用する\n`;
    prompt += `3. 概念間の関連性を明確に示す\n`;

    if (intentAnalysis.expects_examples) {
        prompt += `4. 具体例を豊富に提供する\n`;
    }

    if (intentAnalysis.expects_step_by_step) {
        prompt += `4. 段階的で分かりやすい説明を行う\n`;
    }

    if (contextAnalysis.requires_deep_reasoning) {
        prompt += `4. 深い推論と分析を提供する\n`;
    }

    prompt += `${5}. 教育的価値の高い補足情報を含める\n`;
    prompt += `${6}. 分かりやすく体系的に整理して説明する`;

    return prompt;
}

// Gemini APIの呼び出し（高度なプロンプト用）
async function callGeminiWithAdvancedPrompt(prompt, apiKey) {
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
                maxOutputTokens: 4000, // より長い回答を許可
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
}

// ========================
// 統合された質問処理機能
// ========================

// 質問に対するAI回答の統合エントリーポイント
async function processQuestionWithAI(question, userQuestion, apiKey) {
    try {
        // PDF内容の存在確認
        const hasPDFContent = (lastTextbookText && lastTextbookText.length > 0) || 
                             (lastPastExamText && lastPastExamText.length > 0);

        console.log('Processing question with AI:', {
            hasPDFContent,
            questionLength: userQuestion.length,
            useAdvanced: hasPDFContent
        });

        // PDF内容がある場合は高度な分析を使用、ない場合は基本機能を使用
        if (hasPDFContent) {
            console.log('Using advanced analysis with PDF context...');
            return await askAIWithAdvancedAnalysis(question, userQuestion, apiKey);
        } else {
            console.log('Using basic askAI function...');
            return await askAIAboutQuestion(question, userQuestion, apiKey);
        }

    } catch (error) {
        console.error('Question processing error:', error);

        // フォールバック: 最も基本的な機能を試行
        try {
            console.log('Falling back to basic function...');
            return await askAIAboutQuestion(question, userQuestion, apiKey);
        } catch (fallbackError) {
            console.error('Fallback also failed:', fallbackError);
            throw new Error('AI回答の取得に失敗しました。API設定やネットワーク接続を確認してください。');
        }
    }
}

// ========================
// 既存機能との互換性維持
// ========================

// 既存のコードとの互換性のため、元の関数名でも呼び出し可能にする
async function askAI_Original(question, userQuestion, apiKey) {
    return await processQuestionWithAI(question, userQuestion, apiKey);
}

// ========================  
// 初期化とイベントハンドラー設定
// ========================

// ページ読み込み完了時の初期化
document.addEventListener('DOMContentLoaded', function() {
    console.log('PDF-enhanced exam prep tool initialized');

    // PDF.jsの初期化確認
    if (typeof pdfjsLib !== 'undefined') {
        console.log('PDF.js loaded successfully');

        // PDF.js設定
        pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    } else {
        console.warn('PDF.js not loaded - PDF processing will not be available');
    }

    // PDFアップロードハンドラーを設定
    setupPDFUploadHandlers();

    // 既存の初期化コードがあればここに追加
    // initializeExamTool(); // 既存の関数があれば
});

// ========================
// デバッグ・診断機能
// ========================

// システム状態の診断
function diagnoseSystem() {
    const diagnosis = {
        pdfjs_loaded: typeof pdfjsLib !== 'undefined',
        textbook_loaded: lastTextbookText !== null,
        pastexam_loaded: lastPastExamText !== null,
        api_key_set: lastApiKey !== null,
        textbook_chars: lastTextbookText ? lastTextbookText.length : 0,
        pastexam_chars: lastPastExamText ? lastPastExamText.length : 0
    };

    console.log('System Diagnosis:', diagnosis);
    return diagnosis;
}

// PDF処理状況の詳細レポート
function getPDFReport() {
    const report = {
        status: 'ready',
        textbook: {
            loaded: lastTextbookText !== null,
            size: lastTextbookText ? lastTextbookText.length : 0,
            preview: lastTextbookText ? lastTextbookText.substring(0, 200) + '...' : null
        },
        pastexam: {
            loaded: lastPastExamText !== null,
            size: lastPastExamText ? lastPastExamText.length : 0,
            preview: lastPastExamText ? lastPastExamText.substring(0, 200) + '...' : null
        },
        ready_for_advanced: (lastTextbookText !== null || lastPastExamText !== null)
    };

    console.log('PDF Report:', report);
    return report;
}

console.log('📚 Enhanced Exam Prep Tool with PDF Context - Ready!');
