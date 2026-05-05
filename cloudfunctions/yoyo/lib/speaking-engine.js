const https = require('https');
const storageAdapter = require('../adapters/storage.adapter');

function normalizeText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function postJson(url, headers, body) {
  return new Promise((resolve, reject) => {
    const target = new URL(url);
    const payload = JSON.stringify(body);
    const request = https.request({
      method: 'POST',
      hostname: target.hostname,
      path: `${target.pathname}${target.search}`,
      headers: Object.assign({}, headers, {
        'content-type': 'application/json',
        'content-length': Buffer.byteLength(payload)
      }),
      timeout: 22000
    }, (response) => {
      let text = '';
      response.setEncoding('utf8');
      response.on('data', (chunk) => {
        text += chunk;
      });
      response.on('end', () => {
        if (response.statusCode < 200 || response.statusCode >= 300) {
          const error = new Error(`score-http-${response.statusCode || 0}:${text.slice(0, 120)}`);
          error.statusCode = response.statusCode;
          error.responseText = text;
          reject(error);
          return;
        }
        try {
          resolve(JSON.parse(text));
        } catch (error) {
          reject(error);
        }
      });
    });
    request.on('timeout', () => {
      request.destroy(new Error('score-timeout'));
    });
    request.on('error', reject);
    request.write(payload);
    request.end();
  });
}

function isRetryableScoreError(error) {
  const message = String(error && error.message || error || '');
  return (error && error.statusCode === 429)
    || /upstream|负载|timeout|ECONNRESET|ETIMEDOUT/i.test(message);
}

function getSpeakingErrorType(error) {
  const message = String(error && error.message || error || '');
  if (/storage|downloadFile|fileID|cloudPath|ENOENT|not\s*found/i.test(message)) {
    return 'audio-download';
  }
  if (/score-http|429|upstream|负载|timeout|ECONNRESET|ETIMEDOUT/i.test(message)) {
    return 'model-busy';
  }
  return 'unknown';
}

function postAudio(url, headers, body) {
  return new Promise((resolve, reject) => {
    const target = new URL(url);
    const payload = JSON.stringify(body);
    const chunks = [];
    const request = https.request({
      method: 'POST',
      hostname: target.hostname,
      path: `${target.pathname}${target.search}`,
      headers: Object.assign({}, headers, {
        'content-type': 'application/json',
        'content-length': Buffer.byteLength(payload)
      }),
      timeout: 18000
    }, (response) => {
      response.on('data', (chunk) => {
        chunks.push(Buffer.from(chunk));
      });
      response.on('end', () => {
        const buffer = Buffer.concat(chunks);
        if (response.statusCode < 200 || response.statusCode >= 300) {
          reject(new Error(`tts-http-${response.statusCode || 0}:${buffer.toString('utf8').slice(0, 120)}`));
          return;
        }
        resolve(buffer);
      });
    });
    request.on('timeout', () => {
      request.destroy(new Error('tts-timeout'));
    });
    request.on('error', reject);
    request.write(payload);
    request.end();
  });
}

function findQuestionFromTranscript(track) {
  const lines = Array.isArray(track && track.lines) ? track.lines : [];
  const cueIndex = lines.findIndex((line) => /answer this question/i.test(String(line.text || '')));
  const question = lines.find((line, index) => (
    index > cueIndex && /[?？]\s*$/.test(String(line.text || '').trim())
  )) || lines.find((line) => /[?？]\s*$/.test(String(line.text || '').trim()));
  if (!question) {
    return null;
  }
  return {
    questionText: normalizeText(question.text),
    questionLineStartMs: Number(question.startMs || 0),
    questionLineEndMs: Number(question.endMs || 0)
  };
}

function buildSourceTextFromTranscript(track) {
  const lines = Array.isArray(track && track.lines) ? track.lines : [];
  return lines
    .map((line) => normalizeText(line && line.text))
    .filter(Boolean)
    .filter((text) => !/answer this question/i.test(text))
    .join('\n')
    .slice(0, 4000);
}

function buildTemplateFeedback(attemptType, attemptIndex, promptText) {
  if (attemptType === 'nce_question_answer' && Number(attemptIndex) === 1) {
    return [
      '你已经完成回答了，很好。',
      '下一步重点是先用完整句直接回答问题。',
      promptText ? `可以围绕这个问题说：${promptText}` : '',
      '建议回答：试着用原文信息组成一句主谓宾完整的短句。'
    ].filter(Boolean).join(' ');
  }
  if (attemptType === 'nce_question_answer' && Number(attemptIndex) === 2) {
    return '你这次已经在尝试组织答案了。下一步把句子说完整，注意主语和动词搭配。建议回答先直接回答，再补一个原文关键词。';
  }
  if (attemptType === 'unlock_sentence_repeat') {
    return '跟读时注意句子重音、尾音和停顿。';
  }
  return '最终回答已保存，可以对比三次分数。';
}

function fallbackScore(payload) {
  const seed = [
    payload.taskId,
    payload.attemptType,
    payload.attemptIndex,
    payload.sentenceIndex,
    payload.answerAudioFileId
  ].join('|');
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) % 1000;
  }
  return 78 + (hash % 18);
}

function parseScoreResponseText(text) {
  const raw = normalizeText(text);
  if (!raw) {
    return null;
  }
  const jsonText = raw.match(/\{[\s\S]*\}/);
  if (jsonText) {
    try {
      const parsed = JSON.parse(jsonText[0]);
      return {
        score: Number(parsed.score || 0),
        transcript: normalizeText(parsed.transcript || parsed.studentTranscript || parsed.answerText || ''),
        feedback: normalizeText(parsed.feedback || parsed.advice || parsed.comment || ''),
        suggestedAnswer: normalizeText(parsed.suggestedAnswer || '')
      };
    } catch (error) {
      // fall through
    }
  }
  const scoreMatch = raw.match(/(?:score|分数|评分)\D{0,10}(\d{1,3})/i);
  return {
    score: scoreMatch ? Number(scoreMatch[1]) : 0,
    transcript: '',
    feedback: raw,
    suggestedAnswer: ''
  };
}

function parseJsonResponseText(text) {
  const raw = normalizeText(text);
  if (!raw) {
    return null;
  }
  const jsonText = raw.match(/\{[\s\S]*\}/);
  if (!jsonText) {
    return null;
  }
  try {
    return JSON.parse(jsonText[0]);
  } catch (error) {
    return null;
  }
}

function normalizeSuggestedAnswer(value) {
  const answer = normalizeText(value);
  if (!answer || /[?？]\s*$/.test(answer)) {
    return '';
  }
  if (/^(excuse me|whose|is this|are these|what is|who is)\b/i.test(answer)) {
    return '';
  }
  return answer;
}

function buildFeedbackWithSuggestedAnswer(feedback, suggestedAnswer) {
  const cleanFeedback = normalizeText(feedback);
  const cleanSuggestedAnswer = normalizeSuggestedAnswer(suggestedAnswer);
  return normalizeText([
    cleanFeedback,
    cleanSuggestedAnswer ? `建议回答：${cleanSuggestedAnswer}` : ''
  ].filter(Boolean).join(' '));
}

function buildContentFallbackFromTranscript(payload, transcript, audioScore) {
  const answer = normalizeText(transcript);
  const question = normalizeText(payload.promptText || payload.questionText);
  const contentScore = answer ? Math.max(60, Math.min(88, Math.round(72 + (answer.length % 12)))) : 45;
  return {
    score: Math.max(0, Math.min(100, Math.round((contentScore * 0.8) + (audioScore * 0.2)))),
    pronunciationFluencyScore: Math.round(audioScore),
    contentGrammarScore: contentScore,
    transcript: answer,
    feedback: buildTemplateFeedback(payload.attemptType, payload.attemptIndex, question),
    status: 'scored-local'
  };
}

async function scoreSpeakingAttempt(payload) {
  const endpoint = String(process.env.SPEAKING_SCORE_ENDPOINT || '').trim();
  const apiKey = String(process.env.SPEAKING_SCORE_API_KEY || '').trim();
  const model = String(process.env.SPEAKING_SCORE_MODEL || 'gpt-4o-audio-preview').trim();
  if (!endpoint) {
    return {
      score: fallbackScore(payload),
      feedback: buildTemplateFeedback(payload.attemptType, payload.attemptIndex, payload.promptText),
      status: 'scored-local'
    };
  }
  try {
    console.log('[speaking-score-stage]', JSON.stringify({
      stage: 'download-audio-start',
      taskId: payload.taskId || '',
      attemptType: payload.attemptType || '',
      attemptIndex: payload.attemptIndex || 0,
      answerAudioFileId: payload.answerAudioFileId || '',
      answerCloudPath: payload.answerCloudPath || ''
    }));
    const audioBuffer = await storageAdapter.downloadCloudFileBuffer(payload.answerAudioFileId, payload.answerCloudPath);
    console.log('[speaking-score-stage]', JSON.stringify({
      stage: 'download-audio-ok',
      bytes: audioBuffer.length,
      taskId: payload.taskId || '',
      attemptType: payload.attemptType || '',
      attemptIndex: payload.attemptIndex || 0
    }));
    const fallbackModel = String(process.env.SPEAKING_SCORE_FALLBACK_MODEL || 'gpt-4o-audio-preview').trim();
    const models = [model, model, fallbackModel].filter((item, index) => item && (index < 2 || item !== model));
    let data = null;
    let lastError = null;
    for (let index = 0; index < models.length; index += 1) {
      try {
        console.log('[speaking-score-stage]', JSON.stringify({
          stage: 'audio-model-start',
          model: models[index],
          taskId: payload.taskId || '',
          attemptType: payload.attemptType || '',
          attemptIndex: payload.attemptIndex || 0
        }));
        data = await postJson(endpoint, {
          authorization: apiKey ? `Bearer ${apiKey}` : ''
        }, {
          model: models[index],
          temperature: 0,
          messages: [{
            role: 'user',
            content: [
              {
                type: 'text',
                text: [
                  'You grade a child English speaking answer from audio and lesson source.',
                  'First transcribe the student audio answer, then grade pronunciation/fluency and content/grammar.',
                  'Return JSON only: {"transcript": "student answer transcript", "pronunciationFluencyScore": number, "contentScore": number, "feedback": "short Chinese advice", "suggestedAnswer": "one natural English answer"}.',
                  'pronunciationFluencyScore must be 0 to 100.',
                  'contentScore must be 0 to 100.',
                  'Final content rubric: answer structure 35, grammar 30, source accuracy 25, relevance to question 10.',
                  'Give lenient pronunciation and fluency scores. Do not punish accent unless it blocks understanding.',
                  'Suggested answer must be one direct declarative answer to the question, not a new question.',
                  'Never suggest sentence starters such as "Excuse me" or "Is this" for a Whose/Who/What answer.',
                  'Do not replace a clear possessive noun phrase such as "the woman\'s handbag" with a vague pronoun such as "her handbag" unless the source requires that exact pronoun.',
                  'Feedback must be warm Chinese: praise one thing, then give one concrete improvement, then point to the suggested answer.',
                  `Source lesson text:\n${payload.sourceText || ''}`,
                  `Question or prompt: ${payload.promptText || payload.questionText || ''}`,
                  `Attempt index: ${payload.attemptIndex || 0}`
                ].join('\n')
              },
              {
                type: 'input_audio',
                input_audio: {
                  data: audioBuffer.toString('base64'),
                  format: 'mp3'
                }
              }
            ]
          }]
        });
        console.log('[speaking-score-stage]', JSON.stringify({
          stage: 'audio-model-ok',
          model: models[index],
          taskId: payload.taskId || '',
          attemptType: payload.attemptType || '',
          attemptIndex: payload.attemptIndex || 0
        }));
        break;
      } catch (error) {
        lastError = error;
        if (!isRetryableScoreError(error) || index >= models.length - 1) {
          throw error;
        }
        await sleep(600);
      }
    }
    if (!data && lastError) {
      throw lastError;
    }
    const content = data && data.choices && data.choices[0] && data.choices[0].message
      ? data.choices[0].message.content
      : '';
    const audioParsed = parseJsonResponseText(Array.isArray(content) ? content.map((item) => item.text || '').join(' ') : content) || {};
    const transcript = normalizeText(audioParsed.transcript || '');
    const audioScore = Math.max(0, Math.min(100, Number(audioParsed.pronunciationFluencyScore || 0)));
    const contentScore = Math.max(0, Math.min(100, Number(audioParsed.contentScore || audioParsed.score || 0)));
    return {
      score: Math.max(0, Math.min(100, Math.round((contentScore * 0.8) + (audioScore * 0.2)))),
      pronunciationFluencyScore: Math.round(audioScore),
      contentGrammarScore: Math.round(contentScore),
      transcript,
      feedback: buildFeedbackWithSuggestedAnswer(audioParsed.feedback, audioParsed.suggestedAnswer)
        || buildTemplateFeedback(payload.attemptType, payload.attemptIndex, payload.promptText),
      status: 'scored'
    };
  } catch (error) {
    const errorType = getSpeakingErrorType(error);
    console.error('[speaking-score-failed]', JSON.stringify({
      errorType,
      message: String(error && error.message || error || ''),
      taskId: payload.taskId || '',
      attemptType: payload.attemptType || '',
      attemptIndex: payload.attemptIndex || 0,
      answerAudioFileId: payload.answerAudioFileId || '',
      answerCloudPath: payload.answerCloudPath || ''
    }));
    const fallbackFeedback = buildTemplateFeedback(payload.attemptType, payload.attemptIndex, payload.promptText);
    if (errorType === 'audio-download') {
      return {
        score: 0,
        feedback: '录音读取失败，请重新录音后再提交。',
        status: 'score-pending',
        error: String(error && error.message || error || ''),
        errorType
      };
    }
    return {
      score: 0,
      feedback: '模型繁忙，录音已保存。请稍后重新提交评分。',
      status: 'score-pending',
      error: String(error && error.message || error || ''),
      errorType
    };
  }
}

async function synthesizeFeedbackAudio(text, cloudPath) {
  const endpoint = String(process.env.SPEAKING_TTS_ENDPOINT || '').trim();
  const apiKey = String(process.env.SPEAKING_SCORE_API_KEY || '').trim();
  const model = String(process.env.SPEAKING_TTS_MODEL || 'gpt-4o-mini-tts').trim();
  const voice = String(process.env.SPEAKING_TTS_VOICE || 'alloy').trim();
  const input = normalizeText(text);
  if (!endpoint || !input || !cloudPath) {
    return null;
  }
  const audioBuffer = await postAudio(endpoint, {
    authorization: apiKey ? `Bearer ${apiKey}` : ''
  }, {
    model,
    voice,
    input,
    format: 'mp3'
  });
  return storageAdapter.uploadCloudFileBuffer(cloudPath, audioBuffer);
}

function summarizeAttempts(items) {
  const attempts = Array.isArray(items) ? items : [];
  const scored = attempts.filter((item) => (
    (item.status === 'scored' || item.status === 'scored-local') && Number(item.score || 0) > 0
  ));
  const bestScore = scored.reduce((max, item) => Math.max(max, Number(item.score || 0)), 0);
  const latest = scored[scored.length - 1] || null;
  const latestScore = latest ? Number(latest.score || 0) : 0;
  const averageScore = scored.length
    ? Math.round(scored.reduce((sum, item) => sum + Number(item.score || 0), 0) / scored.length)
    : 0;
  return {
    count: attempts.length,
    scoredCount: scored.length,
    bestScore,
    latestScore,
    averageScore
  };
}

module.exports = {
  findQuestionFromTranscript,
  buildSourceTextFromTranscript,
  scoreSpeakingAttempt,
  synthesizeFeedbackAudio,
  summarizeAttempts
};
