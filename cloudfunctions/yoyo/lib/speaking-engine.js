const https = require('https');
const crypto = require('crypto');
const WebSocket = require('ws');
const tencentcloud = require('tencentcloud-sdk-nodejs');
const storageAdapter = require('../adapters/storage.adapter');

function normalizeText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function getEnvValue(names) {
  for (const name of names) {
    const value = String(process.env[name] || '').trim();
    if (value) {
      return value;
    }
  }
  return '';
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getSpeakingHttpTimeoutMs() {
  const value = Number(process.env.SPEAKING_MODEL_HTTP_TIMEOUT_MS || 240000);
  return Math.max(5000, Math.min(240000, Number.isFinite(value) ? value : 240000));
}

function getSpeakingRetryCount() {
  const value = Number(process.env.SPEAKING_MODEL_RETRY_COUNT || 1);
  return Math.max(1, Math.min(3, Number.isFinite(value) ? value : 1));
}

function clampScore(value, fallback) {
  const score = Number(value);
  if (!Number.isFinite(score)) {
    return fallback;
  }
  return Math.max(0, Math.min(100, score));
}

const PRONUNCIATION_SCORE_FORMULA = 'accuracy*0.55+fluency*0.25+completion*0.20';

function calculatePronunciationScore(accuracy, fluency, completion) {
  const values = [accuracy, fluency, completion].map((value) => clampScore(value, NaN));
  if (values.some((value) => !Number.isFinite(value))) {
    return NaN;
  }
  return Math.round((values[0] * 0.55) + (values[1] * 0.25) + (values[2] * 0.2));
}

function cleanPronunciationWord(value) {
  const word = normalizeText(value).replace(/^[^A-Za-z]+|[^A-Za-z'-]+$/g, '');
  return /^[A-Za-z][A-Za-z'-]*$/.test(word) ? word : '';
}

function normalizePronunciationWordDetails(items) {
  const details = (Array.isArray(items) ? items : [])
    .map((item) => {
      const word = cleanPronunciationWord(
        item && (item.referenceWord || item.ReferenceWord || item.word || item.Word)
      );
      if (!word) return null;
      return {
        word,
        accuracy: clampScore(
          item && (item.accuracy ?? item.PronAccuracy ?? item.pron_accuracy),
          NaN
        ),
        fluency: normalizeSoeRatioScore(
          item && (item.fluency ?? item.PronFluency ?? item.pron_fluency)
        ),
        matchTag: Number(item && (item.matchTag ?? item.MatchTag ?? item.match_tag))
      };
    })
    .filter(Boolean);
  const byWord = new Map();
  details.forEach((item) => {
    const key = item.word.toLowerCase();
    const old = byWord.get(key);
    const itemPriority = [2, 4, 3].includes(item.matchTag)
      ? -100
      : (Number.isFinite(item.accuracy) ? item.accuracy : 101);
    const oldPriority = old && [2, 4, 3].includes(old.matchTag)
      ? -100
      : (old && Number.isFinite(old.accuracy) ? old.accuracy : 101);
    if (!old || itemPriority < oldPriority) byWord.set(key, item);
  });
  return Array.from(byWord.values());
}

function buildPronunciationFeedback(accuracy, fluency, completion, wordDetails = []) {
  const metrics = [
    { key: 'accuracy', value: clampScore(accuracy, 0) },
    { key: 'fluency', value: clampScore(fluency, 0) },
    { key: 'completion', value: clampScore(completion, 0) }
  ];
  const score = calculatePronunciationScore(accuracy, fluency, completion);
  const lowest = metrics.reduce((current, item) => (
    item.value < current.value ? item : current
  ));
  const details = normalizePronunciationWordDetails(wordDetails);
  const missed = details.filter((item) => [2, 4].includes(item.matchTag)).slice(0, 3);
  const extra = details.filter((item) => item.matchTag === 1).slice(0, 2);
  const weak = details
    .filter((item) => (
      item.matchTag === 3
      || (![1, 2, 4].includes(item.matchTag) && Number.isFinite(item.accuracy) && item.accuracy < 80)
    ))
    .sort((left, right) => (
      (Number.isFinite(left.accuracy) ? left.accuracy : -1)
      - (Number.isFinite(right.accuracy) ? right.accuracy : -1)
    ))
    .slice(0, 3);
  let performance = '本句需要再练，先保证每个词都读清楚。';
  if (score >= 92) performance = '发音清楚，节奏稳定，句子完整。';
  else if (score >= 82) performance = '整体准确，句子基本连贯。';
  else if (score >= 70) performance = '已完成本句，部分发音或节奏还不稳定。';
  if (missed.length) {
    performance = score >= 82 ? '整体发音较清楚，但句子有漏读。' : '本句有漏读，完整度需要优先提高。';
  } else if (weak.length && score >= 82) {
    performance = '整体节奏稳定，但个别词发音还不准确。';
  }

  const focusParts = [];
  if (missed.length) focusParts.push(`漏读 ${missed.map((item) => `“${item.word}”`).join('、')}`);
  if (weak.length) {
    focusParts.push(weak.map((item) => (
      Number.isFinite(item.accuracy) ? `“${item.word}” ${Math.round(item.accuracy)}分` : `“${item.word}”`
    )).join('、'));
  }
  if (extra.length) focusParts.push(`多读 ${extra.map((item) => `“${item.word}”`).join('、')}`);
  let focus = focusParts.join('；');
  if (!focus) {
    if (lowest.key === 'accuracy' && lowest.value < 90) focus = '部分词音还不够准确。';
    else if (lowest.key === 'fluency' && lowest.value < 90) focus = '停顿和连接不够自然。';
    else if (lowest.key === 'completion' && lowest.value < 90) focus = '有漏词或句尾没有读完整。';
    else focus = '没有明显漏词，继续注意句子重音和语调起伏。';
  }

  let action = '减少逐词用力，让重读词更突出、非重读词更轻。';
  if (missed.length && weak.length) action = '先补齐漏读词，再慢读低分词各两遍，最后完整读一遍。';
  else if (missed.length) action = '先补齐漏读词，再从头完整读一遍。';
  else if (weak.length) action = '先慢读这些词各两遍，再放回句子中连贯朗读。';
  else if (lowest.key === 'fluency' && lowest.value < 90) action = '按意群连续读，只在标点处自然停顿。';
  else if (lowest.key === 'accuracy' && lowest.value < 90) action = '放慢语速，先读准元音和单词重音。';
  else if (lowest.key === 'completion' && lowest.value < 90) action = '对照原句逐词检查，确保句尾也读完整。';

  return `表现：${performance}\n重点：${focus.replace(/。$/, '')}。\n下一遍：${action}`;
}

function readNumber(value) {
  if (value === null || value === undefined || value === '') {
    return NaN;
  }
  const number = Number(value);
  return Number.isFinite(number) ? number : NaN;
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
      timeout: getSpeakingHttpTimeoutMs()
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
          resolve(parseJsonResponseBody(text));
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

function parseJsonResponseBody(text) {
  const raw = String(text || '').trim();
  if (!raw) {
    throw new Error('empty-json-response');
  }
  try {
    return JSON.parse(raw);
  } catch (error) {}
  const dataLines = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.slice(5).trim())
    .filter((line) => line && line !== '[DONE]');
  if (!dataLines.length) {
    throw new Error(`invalid-json-response:${raw.slice(0, 80)}`);
  }
  let last = null;
  let streamedText = '';
  dataLines.forEach((line) => {
    const item = JSON.parse(line);
    last = item;
    const choice = item && item.choices && item.choices[0];
    streamedText += extractMessageText(choice && (choice.delta || choice.message || choice.text || ''));
  });
  return streamedText
    ? { choices: [{ message: { content: streamedText } }], _streamed: true }
    : last;
}

async function postJsonWithRetry(url, headers, body, label) {
  let lastError = null;
  const maxAttempts = getSpeakingRetryCount();
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await postJson(url, headers, body);
    } catch (error) {
      lastError = error;
      if (!isRetryableScoreError(error) || attempt === maxAttempts) {
        break;
      }
      console.warn('[speaking-score-retry]', JSON.stringify({
        label: label || 'json',
        attempt,
        message: String(error && error.message || error || '')
      }));
      await sleep(900 * attempt);
    }
  }
  throw lastError;
}

async function postJsonWithModelFallback(url, headers, body, primaryModel, fallbackModel, label) {
  const models = Array.from(new Set([primaryModel, fallbackModel].filter(Boolean)));
  let lastError = null;
  for (const model of models) {
    try {
      return {
        model,
        data: await postJsonWithRetry(url, headers, Object.assign({}, body, { model }), label)
      };
    } catch (error) {
      lastError = error;
      console.error('[speaking-score-model-failed]', JSON.stringify({
        label: label || 'json',
        model,
        message: String(error && error.message || error || '')
      }));
    }
  }
  throw lastError;
}

function postMultipart(url, headers, fields, file) {
  return new Promise((resolve, reject) => {
    const target = new URL(url);
    const boundary = `----yoyo${Date.now()}${Math.random().toString(16).slice(2)}`;
    const chunks = [];
    Object.keys(fields || {}).forEach((name) => {
      chunks.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${fields[name]}\r\n`));
    });
    chunks.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${file.name}"; filename="${file.filename}"\r\nContent-Type: ${file.contentType}\r\n\r\n`));
    chunks.push(Buffer.isBuffer(file.buffer) ? file.buffer : Buffer.from(file.buffer || ''));
    chunks.push(Buffer.from(`\r\n--${boundary}--\r\n`));
    const payload = Buffer.concat(chunks);
    const request = https.request({
      method: 'POST',
      hostname: target.hostname,
      path: `${target.pathname}${target.search}`,
      headers: Object.assign({}, headers, {
        'content-type': `multipart/form-data; boundary=${boundary}`,
        'content-length': payload.length
      }),
      timeout: getSpeakingHttpTimeoutMs()
    }, (response) => {
      let text = '';
      response.setEncoding('utf8');
      response.on('data', (chunk) => {
        text += chunk;
      });
      response.on('end', () => {
        if (response.statusCode < 200 || response.statusCode >= 300) {
          const error = new Error(`transcribe-http-${response.statusCode || 0}:${text.slice(0, 120)}`);
          error.statusCode = response.statusCode;
          error.responseText = text;
          reject(error);
          return;
        }
        try {
          resolve(parseJsonResponseBody(text));
        } catch (error) {
          reject(error);
        }
      });
    });
    request.on('timeout', () => {
      request.destroy(new Error('transcribe-timeout'));
    });
    request.on('error', reject);
    request.write(payload);
    request.end();
  });
}

function isRetryableScoreError(error) {
  const message = String(error && error.message || error || '');
  return (error && error.statusCode === 429)
    || /upstream|负载|timeout|transcribe-http|ECONNRESET|ETIMEDOUT/i.test(message);
}

function getSpeakingErrorType(error) {
  const message = String(error && error.message || error || '');
  if (/storage|downloadFile|fileID|cloudPath|ENOENT|not\s*found/i.test(message)) {
    return 'audio-download';
  }
  if (/audio data empty|empty audio|empty-transcript|no speech|silence/i.test(message)) {
    return 'audio-transcript';
  }
  if (/transcribe-http|score-http|429|upstream|负载|timeout|ECONNRESET|ETIMEDOUT/i.test(message)) {
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
  const cueIndex = lines.findIndex((line) => /answer (?:this|these) questions?/i.test(String(line.text || '')));
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
    .filter((text) => !/answer (?:this|these) questions?/i.test(text))
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

function extractMessageText(content) {
  if (Array.isArray(content)) {
    return content.map((item) => (
      item && typeof item === 'object'
        ? (item.text || item.transcript || item.content || item.output_text || '')
        : item
    )).join(' ');
  }
  if (content && typeof content === 'object') {
    return content.text || content.transcript || content.content || JSON.stringify(content);
  }
  return String(content || '');
}

function inferTranscribeEndpoint(endpoint) {
  return normalizeTranscribeEndpoint(String(endpoint || '').replace(/\/chat\/completions\/?$/, '/audio/transcriptions'));
}

function normalizeTranscribeEndpoint(endpoint) {
  return String(endpoint || '').trim();
}

function inferAudioFormat(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 12) {
    return '';
  }
  const head4 = buffer.slice(0, 4).toString('ascii');
  const head3 = buffer.slice(0, 3).toString('ascii');
  if (head3 === 'ID3' || (buffer[0] === 0xff && (buffer[1] & 0xe0) === 0xe0)) {
    return 'mp3';
  }
  if (head4 === 'RIFF') {
    return 'wav';
  }
  if (head4 === 'OggS') {
    return 'ogg-opus';
  }
  if (head4.charCodeAt(0) === 0x1a && head4.charCodeAt(1) === 0x45 && head4.charCodeAt(2) === 0xdf && head4.charCodeAt(3) === 0xa3) {
    return 'webm';
  }
  if (buffer.slice(4, 8).toString('ascii') === 'ftyp') {
    return 'm4a';
  }
  if (buffer.slice(0, 5).toString('ascii') === '#!AM') {
    return 'amr';
  }
  return '';
}

async function transcribeAudio(endpoint, authHeaders, model, audioBuffer) {
  const data = await postMultipart(normalizeTranscribeEndpoint(endpoint), authHeaders, {
    model,
    language: 'en',
    prompt: 'This is a child answering a short English lesson question.'
  }, {
    name: 'file',
    filename: 'answer.mp3',
    contentType: 'audio/mpeg',
    buffer: audioBuffer
  });
  return normalizeText(data && (data.text || data.transcript || data.output_text));
}

async function transcribeAudioByChat(endpoint, authHeaders, model, audioBuffer) {
  const data = await postJson(endpoint, authHeaders, {
    model,
    temperature: 0,
    messages: [{
      role: 'user',
      content: [{
        type: 'text',
        text: [
          'Listen to this child English audio and transcribe the student answer.',
          'Return JSON only: {"transcript":"exact English words you hear"}.',
          'If there is any understandable English, write it. Do not translate.'
        ].join('\n')
      }, {
        type: 'input_audio',
        input_audio: {
          data: audioBuffer.toString('base64'),
          format: 'mp3'
        }
      }]
    }]
  });
  const message = data && data.choices && data.choices[0] && data.choices[0].message
    ? data.choices[0].message
    : {};
  const parsed = parseJsonResponseText(extractMessageText(message.content));
  return normalizeText((parsed && parsed.transcript) || extractMessageText(message.audio && message.audio.transcript));
}

async function transcribeAudioByTencentAsr(audioBuffer, payload) {
  const secretId = getEnvValue(['TENCENT_SECRET_ID', 'TENCENTCLOUD_SECRET_ID']);
  const secretKey = getEnvValue(['TENCENT_SECRET_KEY', 'TENCENTCLOUD_SECRET_KEY']);
  if (!secretId || !secretKey) {
    throw new Error('missing-tencent-asr-credential');
  }
  const AsrClient = tencentcloud.asr.v20190614.Client;
  const client = new AsrClient({
    credential: { secretId, secretKey },
    region: String(process.env.TENCENT_ASR_REGION || process.env.TENCENT_SOE_REGION || 'ap-guangzhou').trim(),
    profile: {
      httpProfile: {
        endpoint: 'asr.tencentcloudapi.com',
        reqTimeout: 20
      }
    }
  });
  const inferredFormat = inferAudioFormat(audioBuffer);
  if (inferredFormat === 'webm') {
    console.error('[speaking-tencent-asr-unsupported-format]', JSON.stringify({
      inferredFormat,
      bytes: audioBuffer && audioBuffer.length ? audioBuffer.length : 0,
      magic: Buffer.isBuffer(audioBuffer) ? audioBuffer.slice(0, 12).toString('hex') : ''
    }));
    throw new Error('录音格式为webm，腾讯ASR不支持；请用手机真机录音，或改为支持webm转码后再评分');
  }
  const voiceFormat = String(process.env.TENCENT_ASR_VOICE_FORMAT || inferredFormat || 'mp3').trim();
  const baseRequest = {
    EngSerViceType: String(process.env.TENCENT_ASR_ENGINE || '16k_en').trim(),
    VoiceFormat: voiceFormat,
    ProjectId: 0,
    SubServiceType: 2,
    UsrAudioKey: `yoyo-${Date.now()}`
  };
  console.log('[speaking-tencent-asr-input]', JSON.stringify({
    bytes: audioBuffer && audioBuffer.length ? audioBuffer.length : 0,
    voiceFormat,
    magic: Buffer.isBuffer(audioBuffer) ? audioBuffer.slice(0, 12).toString('hex') : '',
    answerAudioFileId: payload && payload.answerAudioFileId ? 'yes' : 'no',
    answerCloudPath: payload && payload.answerCloudPath ? 'yes' : 'no'
  }));
  if (!audioBuffer || !audioBuffer.length) {
    throw new Error('tencent-asr-empty-audio-buffer');
  }
  try {
    const result = await client.SentenceRecognition(Object.assign({}, baseRequest, {
      SourceType: 1,
      Data: audioBuffer.toString('base64'),
      DataLen: audioBuffer.length
    }));
    return normalizeText(result && result.Result);
  } catch (bufferError) {
    console.error('[speaking-tencent-asr-buffer-failed]', JSON.stringify({
      message: String(bufferError && bufferError.message || bufferError || ''),
      voiceFormat,
      bytes: audioBuffer.length,
      magic: audioBuffer.slice(0, 12).toString('hex')
    }));
    const audioUrl = await storageAdapter.getTempFileURL(
      payload && payload.answerAudioFileId,
      payload && payload.answerCloudPath
    );
    if (!audioUrl) {
      throw bufferError;
    }
    const urlResult = await client.SentenceRecognition(Object.assign({}, baseRequest, {
      SourceType: 0,
      Url: audioUrl
    }));
    return normalizeText(urlResult && urlResult.Result);
  }
}

function isChatAudioTranscribeModel(model) {
  return /audio-preview|audio$/i.test(String(model || ''));
}

function isTencentAsrModel(model) {
  return /^tencent-asr$/i.test(String(model || ''));
}

async function transcribeWithPreferredRoute(options) {
  const {
    endpoint,
    transcribeEndpoint,
    authHeaders,
    model,
    audioBuffer,
    payload
  } = options;
  if (isTencentAsrModel(model)) {
    return transcribeAudioByTencentAsr(audioBuffer, payload);
  }
  if (isChatAudioTranscribeModel(model)) {
    return transcribeAudioByChat(endpoint, authHeaders, model, audioBuffer);
  }
  return transcribeAudio(transcribeEndpoint, authHeaders, model, audioBuffer);
}

function estimateFluencyScore(transcript) {
  const answer = normalizeText(transcript);
  if (!answer) {
    return 0;
  }
  const wordCount = answer.split(/\s+/).filter(Boolean).length;
  if (wordCount <= 2) {
    return 68;
  }
  if (wordCount <= 5) {
    return 76;
  }
  return 82;
}

function shouldUseTencentSoe() {
  const provider = String(process.env.SPEAKING_PRONUNCIATION_PROVIDER || '').trim();
  return provider === 'tencent-soe'
    || provider === 'tencent-soe-new'
    || String(process.env.TENCENT_SOE_ENABLED || '').trim() === '1';
}

function buildTencentSoeRefText(payload, transcript) {
  const attemptType = String(payload && payload.attemptType || '');
  if (attemptType === 'unlock_sentence_repeat') {
    return normalizeText(payload.promptText || payload.questionText || transcript);
  }
  return normalizeText(transcript || payload.promptText || payload.questionText || 'answer');
}

function getTencentSoeVoiceFileType(format) {
  const normalized = String(format || '').toLowerCase();
  if (normalized === 'wav') {
    return 2;
  }
  if (normalized === 'mp3') {
    return 3;
  }
  if (normalized === 'speex') {
    return 4;
  }
  return 0;
}

function getTencentSoeCredentials() {
  return {
    appId: getEnvValue(['TENCENT_SOE_APP_ID', 'TENCENT_APP_ID', 'TENCENTCLOUD_APP_ID', 'TENCENT_APPID', 'APPID']),
    secretId: getEnvValue(['TENCENT_SECRET_ID', 'TENCENTCLOUD_SECRET_ID']),
    secretKey: getEnvValue(['TENCENT_SECRET_KEY', 'TENCENTCLOUD_SECRET_KEY'])
  };
}

function getTencentSoeNewVoiceFormat(format) {
  const normalized = String(format || '').toLowerCase();
  if (normalized === 'pcm') {
    return 0;
  }
  if (normalized === 'wav') {
    return 1;
  }
  if (normalized === 'mp3') {
    return 2;
  }
  if (normalized === 'speex') {
    return 4;
  }
  throw new Error(`tencent-soe-unsupported-audio-format:${normalized || 'unknown'}`);
}

function buildTencentSoeNewUrl(params, appId, secretKey) {
  const keys = Object.keys(params).filter((key) => key !== 'signature').sort();
  const queryForSign = keys.map((key) => `${key}=${params[key]}`).join('&');
  const signText = `soe.cloud.tencent.com/soe/api/${appId}?${queryForSign}`;
  const signature = crypto.createHmac('sha1', secretKey).update(signText).digest('base64');
  const finalQuery = keys
    .map((key) => `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`)
    .concat(`signature=${encodeURIComponent(signature)}`)
    .join('&');
  return `wss://soe.cloud.tencent.com/soe/api/${appId}?${finalQuery}`;
}

function readNamedNumber(text, name) {
  const match = String(text || '').match(new RegExp(`"?${name}"?\\s*[:=]\\s*(-?\\d+(?:\\.\\d+)?)`, 'i'));
  return match ? Number(match[1]) : NaN;
}

function averageValidNamedNumbers(text, name) {
  const values = [];
  const pattern = new RegExp(`"?${name}"?\\s*[:=]\\s*(-?\\d+(?:\\.\\d+)?)`, 'ig');
  let match = pattern.exec(String(text || ''));
  while (match) {
    const value = Number(match[1]);
    if (Number.isFinite(value) && value >= 0) {
      values.push(value);
    }
    match = pattern.exec(String(text || ''));
  }
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : NaN;
}

function stringifyTencentSoeResult(value) {
  if (value === null || value === undefined) {
    return '';
  }
  if (typeof value === 'string') {
    return value;
  }
  try {
    return JSON.stringify(value);
  } catch (error) {
    return String(value);
  }
}

function parseTencentSoeValue(value) {
  if (typeof value !== 'string') return value;
  const text = value.trim();
  if (!text || !/^[{[]/.test(text)) return value;
  try {
    return JSON.parse(text);
  } catch (error) {
    return value;
  }
}

function readTencentSoeObjectValue(value, names) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const wanted = new Set(names.map((name) => String(name).toLowerCase()));
  const key = Object.keys(value).find((item) => wanted.has(String(item).toLowerCase()));
  return key === undefined ? undefined : value[key];
}

function collectTencentSoeAggregateScores(value, results = []) {
  const parsed = parseTencentSoeValue(value);
  if (Array.isArray(parsed)) {
    parsed.forEach((item) => collectTencentSoeAggregateScores(item, results));
    return results;
  }
  if (!parsed || typeof parsed !== 'object') return results;
  const accuracy = readTencentSoeObjectValue(parsed, ['PronAccuracy', 'pron_accuracy', 'pronAccuracy']);
  const fluency = readTencentSoeObjectValue(parsed, ['PronFluency', 'pron_fluency', 'pronFluency']);
  const completion = readTencentSoeObjectValue(parsed, ['PronCompletion', 'pron_completion', 'pronCompletion']);
  const suggestedScore = readTencentSoeObjectValue(parsed, ['SuggestedScore', 'suggested_score', 'suggestedScore']);
  if (completion !== undefined || suggestedScore !== undefined) {
    results.push({ accuracy, fluency, completion, suggestedScore });
  }
  Object.keys(parsed).forEach((key) => collectTencentSoeAggregateScores(parsed[key], results));
  return results;
}

function collectTencentSoeWordDetails(value, results = []) {
  const parsed = parseTencentSoeValue(value);
  if (Array.isArray(parsed)) {
    parsed.forEach((item) => collectTencentSoeWordDetails(item, results));
    return results;
  }
  if (!parsed || typeof parsed !== 'object') return results;
  const word = readTencentSoeObjectValue(parsed, ['Word', 'word']);
  const referenceWord = readTencentSoeObjectValue(parsed, ['ReferenceWord', 'reference_word', 'referenceWord']);
  if (word !== undefined || referenceWord !== undefined) {
    results.push({
      word,
      referenceWord,
      accuracy: readTencentSoeObjectValue(parsed, ['PronAccuracy', 'pron_accuracy', 'pronAccuracy']),
      fluency: readTencentSoeObjectValue(parsed, ['PronFluency', 'pron_fluency', 'pronFluency']),
      matchTag: readTencentSoeObjectValue(parsed, ['MatchTag', 'match_tag', 'matchTag'])
    });
  }
  Object.keys(parsed).forEach((key) => collectTencentSoeWordDetails(parsed[key], results));
  return results;
}

function extractTencentSoeWordDetails(messages) {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const details = normalizePronunciationWordDetails(
      collectTencentSoeWordDetails(messages[index], [])
    );
    if (details.length) return details;
  }
  return [];
}

function collectTencentSoeNumbers(value, names, results = []) {
  if (value === null || value === undefined) {
    return results;
  }
  const wanted = new Set(names.map((name) => String(name).toLowerCase()));
  if (Array.isArray(value)) {
    value.forEach((item) => collectTencentSoeNumbers(item, names, results));
    return results;
  }
  if (typeof value === 'object') {
    Object.keys(value).forEach((key) => {
      const item = value[key];
      if (wanted.has(String(key).toLowerCase())) {
        const number = Number(item);
        if (Number.isFinite(number) && number >= 0) {
          results.push(number);
        }
      }
      collectTencentSoeNumbers(item, names, results);
    });
  }
  return results;
}

function firstTencentSoeNumber(messages, names) {
  const values = messages.flatMap((message) => collectTencentSoeNumbers(message, names, []));
  return values.length ? values[values.length - 1] : NaN;
}

function averageTencentSoeNumber(messages, names) {
  const values = messages.flatMap((message) => collectTencentSoeNumbers(message, names, []));
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : NaN;
}

function normalizeSoeRatioScore(value) {
  const number = readNumber(value);
  if (!Number.isFinite(number) || number < 0) {
    return NaN;
  }
  return clampScore(number <= 1 ? number * 100 : number, NaN);
}

function extractTencentSoeScores(messages) {
  const resultText = messages
    .map((message) => normalizeText([
      stringifyTencentSoeResult(message && message.result),
      stringifyTencentSoeResult(message && message.Result),
      stringifyTencentSoeResult(message && message.sentence_info),
      stringifyTencentSoeResult(message)
    ].filter(Boolean).join(' ')))
    .filter(Boolean)
    .join('\n');
  if (!resultText && !messages.length) {
    return null;
  }
  const aggregates = messages.flatMap((message) => collectTencentSoeAggregateScores(message, []));
  const aggregate = aggregates.length ? aggregates[aggregates.length - 1] : {};
  const aggregateSuggestedScore = readNumber(aggregate.suggestedScore);
  const aggregateAccuracy = readNumber(aggregate.accuracy);
  const aggregateFluency = readNumber(aggregate.fluency);
  const aggregateCompletion = readNumber(aggregate.completion);
  const suggestedScore = clampScore(
    Number.isFinite(aggregateSuggestedScore)
      ? aggregateSuggestedScore
      : (firstTencentSoeNumber(messages, ['SuggestedScore', 'suggested_score', 'suggestedScore'])
        || readNamedNumber(resultText, 'SuggestedScore')),
    NaN
  );
  const topAccuracy = clampScore(
    Number.isFinite(aggregateAccuracy)
      ? aggregateAccuracy
      : (firstTencentSoeNumber(messages, ['PronAccuracy', 'pron_accuracy', 'pronAccuracy'])
        || readNamedNumber(resultText, 'PronAccuracy')),
    NaN
  );
  const wordAccuracy = clampScore(
    averageTencentSoeNumber(messages, ['PronAccuracy', 'pron_accuracy', 'pronAccuracy'])
      || averageValidNamedNumbers(resultText, 'PronAccuracy'),
    NaN
  );
  const accuracy = Number.isFinite(topAccuracy) ? topAccuracy : wordAccuracy;
  const topFluency = normalizeSoeRatioScore(
    Number.isFinite(aggregateFluency)
      ? aggregateFluency
      : (firstTencentSoeNumber(messages, ['PronFluency', 'pron_fluency', 'pronFluency'])
        || readNamedNumber(resultText, 'PronFluency'))
  );
  const wordFluency = normalizeSoeRatioScore(
    averageTencentSoeNumber(messages, ['PronFluency', 'pron_fluency', 'pronFluency'])
      || averageValidNamedNumbers(resultText, 'PronFluency')
  );
  const fluency = Number.isFinite(topFluency) ? topFluency : wordFluency;
  const completion = normalizeSoeRatioScore(
    Number.isFinite(aggregateCompletion)
      ? aggregateCompletion
      : (firstTencentSoeNumber(messages, ['PronCompletion', 'pron_completion', 'pronCompletion'])
        || readNamedNumber(resultText, 'PronCompletion'))
  );
  const wordDetails = extractTencentSoeWordDetails(messages);
  const blended = calculatePronunciationScore(accuracy, fluency, completion);
  if (!Number.isFinite(blended)) {
    return null;
  }
  return {
    score: Math.round(clampScore(blended, NaN)),
    accuracy,
    fluency,
    completion,
    feedback: buildPronunciationFeedback(accuracy, fluency, completion, wordDetails),
    wordDetails,
    scoreFormula: PRONUNCIATION_SCORE_FORMULA,
    providerSuggestedScore: Number.isFinite(suggestedScore) ? suggestedScore : null,
    rawResult: resultText
  };
}

function sendWebSocketMessage(ws, data) {
  return new Promise((resolve, reject) => {
    ws.send(data, (error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getAnswerDurationMs(payload, audioBuffer) {
  const candidates = [
    payload && payload.answerDurationMs,
    payload && payload.durationMs,
    payload && payload.audioDurationMs
  ];
  const value = candidates.map(readNumber).find((number) => Number.isFinite(number) && number > 0);
  if (value) {
    return Math.max(1000, Math.min(60000, value));
  }
  const bytes = audioBuffer && audioBuffer.length ? audioBuffer.length : 0;
  return Math.max(1000, Math.min(15000, Math.round(bytes / 6)));
}

async function sendTencentSoeAudio(ws, audioBuffer, payload, recMode) {
  if (Number(recMode) === 1) {
    await sendWebSocketMessage(ws, audioBuffer);
    await sendWebSocketMessage(ws, JSON.stringify({ type: 'end' }));
    return { chunks: 1, intervalMs: 0 };
  }
  const durationMs = getAnswerDurationMs(payload, audioBuffer);
  const chunkCount = Math.max(1, Math.min(40, Math.ceil(durationMs / 250)));
  const chunkSize = Math.max(1, Math.ceil(audioBuffer.length / chunkCount));
  const intervalMs = Math.max(80, Math.min(250, Math.round(durationMs / chunkCount)));
  let chunks = 0;
  for (let offset = 0; offset < audioBuffer.length; offset += chunkSize) {
    await sendWebSocketMessage(ws, audioBuffer.slice(offset, Math.min(audioBuffer.length, offset + chunkSize)));
    chunks += 1;
    if (offset + chunkSize < audioBuffer.length) {
      await delay(intervalMs);
    }
  }
  await sendWebSocketMessage(ws, JSON.stringify({ type: 'end' }));
  return { chunks, intervalMs };
}

async function evaluateWithTencentSoeNew(audioBuffer, payload, transcript) {
  if (!shouldUseTencentSoe()) {
    return null;
  }
  const { appId, secretId, secretKey } = getTencentSoeCredentials();
  const refText = buildTencentSoeRefText(payload, transcript);
  if (!appId || !secretId || !secretKey || !refText) {
    return null;
  }
  const audioFormat = inferAudioFormat(audioBuffer);
  const voiceFormat = getTencentSoeNewVoiceFormat(audioFormat);
  const wordCount = refText.split(/\s+/).filter(Boolean).length;
  const now = Math.floor(Date.now() / 1000);
  const voiceId = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const params = {
    eval_mode: wordCount > 30 ? 2 : 1,
    expired: now + 3600,
    nonce: Math.floor(Math.random() * 1000000000) + 1,
    rec_mode: readNumber(process.env.TENCENT_SOE_REC_MODE || 0),
    ref_text: refText,
    score_coeff: Number(process.env.TENCENT_SOE_SCORE_COEFF || 1),
    secretid: secretId,
    sentence_info_enabled: 1,
    server_engine_type: String(process.env.TENCENT_SOE_ENGINE || '16k_en').trim(),
    text_mode: 0,
    timestamp: now,
    voice_format: voiceFormat,
    voice_id: voiceId
  };
  console.log('[speaking-tencent-soe-input]', JSON.stringify({
    provider: 'tencent-soe-new',
    bytes: audioBuffer && audioBuffer.length ? audioBuffer.length : 0,
    audioFormat,
    voiceFormat,
    evalMode: params.eval_mode,
    recMode: params.rec_mode,
    wordCount,
    refTextLength: refText.length,
    magic: Buffer.isBuffer(audioBuffer) ? audioBuffer.slice(0, 12).toString('hex') : ''
  }));
  const url = buildTencentSoeNewUrl(params, appId, secretKey);
  const messages = [];
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url, { perMessageDeflate: false, handshakeTimeout: 15000 });
    let settled = false;
    let sentAudio = false;
    const timer = setTimeout(() => {
      if (settled) {
        return;
      }
      settled = true;
      try { ws.close(); } catch (error) {}
      reject(new Error('tencent-soe-timeout'));
    }, 45000);
    function finish(error, value) {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timer);
      try { ws.close(); } catch (closeError) {}
      if (error) {
        reject(error);
        return;
      }
      resolve(value);
    }
    ws.on('message', async (data) => {
      try {
        const text = Buffer.isBuffer(data) ? data.toString('utf8') : String(data || '');
        const message = JSON.parse(text);
        messages.push(message);
        if (message.code && Number(message.code) !== 0) {
          finish(new Error(`tencent-soe-${message.code}:${message.message || ''}`));
          return;
        }
        if (!sentAudio && Number(message.code) === 0 && message.message === 'success') {
          sentAudio = true;
          const sent = await sendTencentSoeAudio(ws, audioBuffer, payload, params.rec_mode);
          console.log('[speaking-tencent-soe-audio-sent]', JSON.stringify({
            provider: 'tencent-soe-new',
            recMode: params.rec_mode,
            chunks: sent.chunks,
            intervalMs: sent.intervalMs
          }));
          return;
        }
        if (Number(message.final || 0) === 1) {
          const parsed = extractTencentSoeScores(messages);
          if (!parsed) {
            console.warn('[speaking-tencent-soe-no-score]', JSON.stringify({
              messages: messages.map((item) => ({
                code: item && item.code,
                message: item && item.message,
                final: item && item.final,
                keys: item && typeof item === 'object' ? Object.keys(item) : [],
                resultPreview: normalizeText(stringifyTencentSoeResult(item && item.result)).slice(0, 240)
              }))
            }));
            finish(new Error('tencent-soe-no-valid-score'));
            return;
          }
          console.log('[speaking-tencent-soe-result]', JSON.stringify({
            provider: 'tencent-soe-new',
            score: parsed.score,
            accuracy: parsed.accuracy,
            fluency: parsed.fluency,
            completion: parsed.completion,
            messages: messages.length
          }));
          finish(null, {
            score: parsed.score,
            requestId: voiceId,
            status: 'success',
            accuracy: parsed.accuracy,
            fluency: parsed.fluency,
            completion: parsed.completion,
            feedback: parsed.feedback,
            wordDetails: parsed.wordDetails,
            scoreFormula: parsed.scoreFormula,
            providerSuggestedScore: parsed.providerSuggestedScore
          });
        }
      } catch (error) {
        finish(error);
      }
    });
    ws.on('error', finish);
    ws.on('close', () => {
      if (!settled) {
        finish(new Error('tencent-soe-closed-before-final'));
      }
    });
  });
}

async function evaluateWithTencentSoeLegacy(audioBuffer, payload, transcript) {
  if (!shouldUseTencentSoe()) {
    return null;
  }
  const { secretId, secretKey } = getTencentSoeCredentials();
  const refText = buildTencentSoeRefText(payload, transcript);
  if (!secretId || !secretKey || !refText) {
    return null;
  }
  const SoeClient = tencentcloud.soe.v20180724.Client;
  const client = new SoeClient({
    credential: { secretId, secretKey },
    region: String(process.env.TENCENT_SOE_REGION || 'ap-guangzhou').trim(),
    profile: {
      httpProfile: {
        endpoint: 'soe.tencentcloudapi.com',
        reqTimeout: 20
      }
    }
  });
  const wordCount = refText.split(/\s+/).filter(Boolean).length;
  const audioFormat = inferAudioFormat(audioBuffer);
  const voiceFileType = getTencentSoeVoiceFileType(audioFormat);
  if (!voiceFileType) {
    throw new Error(`tencent-soe-unsupported-audio-format:${audioFormat || 'unknown'}`);
  }
  const request = {
    SeqId: 1,
    IsEnd: 1,
    VoiceFileType: voiceFileType,
    VoiceEncodeType: 1,
    UserVoiceData: audioBuffer.toString('base64'),
    SessionId: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    RefText: refText,
    WorkMode: 1,
    EvalMode: wordCount > 30 ? 2 : 1,
    ScoreCoeff: Number(process.env.TENCENT_SOE_SCORE_COEFF || 1),
    ServerType: 0,
    IsAsync: 0
  };
  const soeAppId = getEnvValue(['TENCENT_SOE_APP_ID', 'TENCENT_APP_ID', 'TENCENTCLOUD_APP_ID', 'TENCENT_APPID', 'APPID']);
  if (soeAppId) {
    request.SoeAppId = soeAppId;
  }
  console.log('[speaking-tencent-soe-input]', JSON.stringify({
    bytes: audioBuffer && audioBuffer.length ? audioBuffer.length : 0,
    audioFormat,
    voiceFileType,
    evalMode: request.EvalMode,
    wordCount,
    refTextLength: refText.length,
    magic: Buffer.isBuffer(audioBuffer) ? audioBuffer.slice(0, 12).toString('hex') : ''
  }));
  const result = await client.TransmitOralProcessWithInit(request);
  console.log('[speaking-tencent-soe-result]', JSON.stringify({
    requestId: result && result.RequestId ? result.RequestId : '',
    status: result && result.Status ? result.Status : '',
    suggestedScore: result && result.SuggestedScore,
    pronAccuracy: result && result.PronAccuracy,
    pronFluency: result && result.PronFluency,
    pronCompletion: result && result.PronCompletion,
    words: Array.isArray(result && result.Words) ? result.Words.length : 0
  }));
  const suggestedScore = clampScore(readNumber(result && result.SuggestedScore), NaN);
  const accuracy = clampScore(readNumber(result && result.PronAccuracy), NaN);
  const fluency = clampScore(readNumber(result && result.PronFluency) * 100, NaN);
  const completion = clampScore(readNumber(result && result.PronCompletion) * 100, NaN);
  const wordDetails = normalizePronunciationWordDetails(result && result.Words);
  const blended = calculatePronunciationScore(accuracy, fluency, completion);
  if (!Number.isFinite(blended)) {
    throw new Error(`tencent-soe-no-valid-score:${result && result.Status ? result.Status : 'unknown'}`);
  }
  return {
    score: Math.round(clampScore(blended, NaN)),
    requestId: result && result.RequestId,
    status: result && result.Status,
    accuracy,
    fluency,
    completion,
    feedback: buildPronunciationFeedback(accuracy, fluency, completion, wordDetails),
    wordDetails,
    scoreFormula: PRONUNCIATION_SCORE_FORMULA,
    providerSuggestedScore: Number.isFinite(suggestedScore) ? suggestedScore : null
  };
}

async function evaluateWithTencentSoe(audioBuffer, payload, transcript) {
  const version = String(process.env.TENCENT_SOE_VERSION || 'new').trim();
  if (version === 'legacy') {
    return evaluateWithTencentSoeLegacy(audioBuffer, payload, transcript);
  }
  return evaluateWithTencentSoeNew(audioBuffer, payload, transcript);
}

async function evaluateSpeakingPronunciation(payload) {
  const audioBuffer = await storageAdapter.downloadCloudFileBuffer(payload.answerAudioFileId, payload.answerCloudPath);
  if (!audioBuffer || !audioBuffer.length) {
    throw new Error('empty-downloaded-audio');
  }
  const refText = normalizeText(payload.promptText || payload.questionText || payload.refText);
  if (!refText) {
    throw new Error('missing-pronunciation-ref-text');
  }
  if (!shouldUseTencentSoe()) {
    throw new Error('tencent-soe-disabled');
  }
  const result = await evaluateWithTencentSoe(audioBuffer, Object.assign({}, payload, {
    promptText: refText
  }), refText);
  if (!result) {
    throw new Error('tencent-soe-no-result');
  }
  const accuracy = Math.round(clampScore(result.accuracy, result.score || 0));
  const fluency = Math.round(clampScore(result.fluency, result.score || 0));
  const completion = Math.round(clampScore(result.completion, result.score || 0));
  return {
    score: calculatePronunciationScore(accuracy, fluency, completion),
    accuracy,
    fluency,
    completion,
    feedback: buildPronunciationFeedback(accuracy, fluency, completion, result.wordDetails),
    wordDetails: normalizePronunciationWordDetails(result.wordDetails),
    scoreFormula: result.scoreFormula || PRONUNCIATION_SCORE_FORMULA,
    providerSuggestedScore: result.providerSuggestedScore !== null
      && result.providerSuggestedScore !== ''
      && Number.isFinite(Number(result.providerSuggestedScore))
      ? Number(result.providerSuggestedScore)
      : null,
    requestId: result.requestId || '',
    status: result.status || 'success'
  };
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

function parseContentScoreData(data) {
  const content = data && data.choices && data.choices[0] && data.choices[0].message
    ? data.choices[0].message.content
    : '';
  const responseText = extractMessageText(content);
  const parsed = parseJsonResponseText(responseText) || {};
  const looseParsed = !Number.isFinite(Number(parsed.contentScore))
    ? parseScoreResponseText(responseText)
    : null;
  const rawContentScore = Number(parsed.contentScore || parsed.score || (looseParsed && looseParsed.score) || 0);
  return {
    parsed,
    looseParsed,
    rawContentScore
  };
}

function roundIeltsOverallBand(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.max(0, Math.min(9, Math.round(numeric * 2) / 2));
}

function normalizeIeltsCriterionBand(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.max(0, Math.min(9, Math.round(numeric)));
}

function inferIeltsPart(payload) {
  const direct = Number(payload && payload.ieltsPart || 0);
  if ([1, 2, 3].includes(direct)) return direct;
  const source = [
    payload && payload.questionViewKey,
    payload && payload.taskId,
    payload && payload.promptText
  ].filter(Boolean).join(' ');
  const match = source.match(/part[\s_-]*([123])/i);
  return match ? Number(match[1]) : 0;
}

function getTencentSoeEvidenceScore(soeResult) {
  if (!soeResult) return NaN;
  const weighted = [
    [Number(soeResult.score), 0.4],
    [Number(soeResult.accuracy), 0.3],
    [Number(soeResult.fluency), 0.2],
    [Number(soeResult.completion), 0.1]
  ].filter(([value]) => Number.isFinite(value));
  if (!weighted.length) return NaN;
  const totalWeight = weighted.reduce((sum, item) => sum + item[1], 0);
  return weighted.reduce((sum, item) => sum + (item[0] * item[1]), 0) / totalWeight;
}

function mapTencentSoeToIeltsPronunciationBand(soeResult) {
  const evidence = getTencentSoeEvidenceScore(soeResult);
  if (!Number.isFinite(evidence)) return 0;
  if (evidence >= 97) return 9;
  if (evidence >= 91) return 8;
  if (evidence >= 84) return 7;
  if (evidence >= 75) return 6;
  if (evidence >= 65) return 5;
  if (evidence >= 52) return 4;
  if (evidence >= 38) return 3;
  if (evidence >= 22) return 2;
  return 1;
}

function getIeltsPartInstruction(part) {
  if (part === 2) {
    return 'Part 2 is the long turn: assess sustained speech, coverage and logical organisation of the cue-card topic. Use duration as evidence; a very short answer cannot fully demonstrate topic development.';
  }
  if (part === 3) {
    return 'Part 3 is an abstract discussion: assess how well the candidate explains opinions and analyses, discusses or speculates about the issue with relevant development.';
  }
  return 'Part 1 is an interview on familiar topics: assess a direct, relevant and naturally extended answer. Do not penalise an appropriately concise answer as if it were a Part 2 long turn.';
}

function buildIeltsScoreBody(payload, transcript, soeResult) {
  const part = inferIeltsPart(payload);
  const soeEvidence = getTencentSoeEvidenceScore(soeResult);
  return {
    temperature: 0,
    messages: [{
      role: 'user',
      content: [
        'You are an IELTS Speaking practice assessor. Apply the official public IELTS Speaking Band Descriptors strictly.',
        'Assess only these three criteria from the transcript and delivery evidence: Fluency and Coherence, Lexical Resource, and Grammatical Range and Accuracy.',
        'Return JSON only: {"fluencyCoherenceBand": integer, "lexicalResourceBand": integer, "grammaticalRangeAccuracyBand": integer, "feedback": "concise Chinese feedback", "suggestedAnswer": "natural English example"}.',
        'Each criterion must be a whole Band from 1 to 9. Select the highest band whose positive features are fully demonstrated; do not award half bands for criteria.',
        'Fluency and Coherence: continuity, hesitation/repetition/self-correction, logical sequencing, cohesive devices and topic development. Use the Tencent delivery evidence and duration, but do not invent audio features.',
        'Lexical Resource: range, precision, appropriacy, collocation, less-common or idiomatic language, and paraphrase.',
        'Grammatical Range and Accuracy: range and flexibility of structures, error-free sentences, simple/complex forms, and whether errors impede communication.',
        'Do not score factual correctness or agreement with the opinion. Judge the language performance and relevance to the prompt.',
        getIeltsPartInstruction(part),
        'Pronunciation is scored separately from the audio by Tencent SOE; do not output a pronunciation band.',
        `IELTS part: ${part || 'unknown'}`,
        `Prompt:\n${payload.promptText || payload.questionText || ''}`,
        `Student transcript:\n${transcript}`,
        `Recorded duration milliseconds: ${Number(payload.answerDurationMs || 0)}`,
        `Tencent SOE delivery evidence (0-100, not an IELTS band): ${Number.isFinite(soeEvidence) ? Math.round(soeEvidence) : 'unavailable'}`,
        'Feedback must briefly identify one demonstrated strength and one specific next improvement tied to the awarded descriptors.'
      ].join('\n')
    }]
  };
}

function parseIeltsScoreData(data) {
  const content = data && data.choices && data.choices[0] && data.choices[0].message
    ? data.choices[0].message.content
    : '';
  const parsed = parseJsonResponseText(extractMessageText(content)) || {};
  return {
    parsed,
    fluencyCoherenceBand: normalizeIeltsCriterionBand(parsed.fluencyCoherenceBand),
    lexicalResourceBand: normalizeIeltsCriterionBand(parsed.lexicalResourceBand),
    grammaticalRangeAccuracyBand: normalizeIeltsCriterionBand(parsed.grammaticalRangeAccuracyBand)
  };
}

async function scoreSpeakingAttempt(payload) {
  const endpoint = String(process.env.SPEAKING_SCORE_ENDPOINT || '').trim();
  const transcribeEndpoint = normalizeTranscribeEndpoint(process.env.SPEAKING_TRANSCRIBE_ENDPOINT || inferTranscribeEndpoint(endpoint)).trim();
  const apiKey = String(process.env.SPEAKING_SCORE_API_KEY || '').trim();
  const transcribeModel = String(process.env.SPEAKING_TRANSCRIBE_MODEL || 'gpt-4o-transcribe').trim();
  const contentModel = getEnvValue(['SPEAKING_CONTENT_SCORE_MODEL', 'SPEAKING_CONTENT_SCORE_MODE', 'SPEAKING_SCORE_PREFERRED_MODEL']) || 'gpt-5.6-sol';
  const fallbackContentModel = String(process.env.SPEAKING_CONTENT_ALLOW_FALLBACK || '').trim() === '1'
    ? getEnvValue(['SPEAKING_SCORE_FALLBACK_MODEL', 'SPEAKING_SCORE_FALLBACK_MODE', 'SPEAKING_CONTENT_SCORE_FALLBACK_MODEL', 'SPEAKING_CONTENT_SCORE_FALLBACK_MODE'])
    : '';
  const audioTranscribeModels = [
    process.env.SPEAKING_AUDIO_TRANSCRIBE_MODEL
  ]
    .flatMap((item) => String(item || '').split(','))
    .map((item) => item.trim())
    .filter(Boolean);
  const chatAudioTranscribeModels = audioTranscribeModels.filter(isChatAudioTranscribeModel);
  const standardAudioTranscribeModels = audioTranscribeModels.filter((model) => !isChatAudioTranscribeModel(model) && !isTencentAsrModel(model));
  const transcribeProvider = String(process.env.SPEAKING_TRANSCRIBE_PROVIDER || '').trim();
  const tencentAsrModels = transcribeProvider === 'tencent-asr' ? ['tencent-asr'] : [];
  const allowTencentAsrFallback = String(process.env.TENCENT_ASR_ALLOW_FALLBACK || '').trim() === '1';
  const allowTranscribeFallback = String(process.env.SPEAKING_TRANSCRIBE_ALLOW_FALLBACK || '').trim() === '1';
  const transcribeModels = transcribeProvider === 'tencent-asr' && !allowTencentAsrFallback
    ? ['tencent-asr']
    : (allowTranscribeFallback
      ? Array.from(new Set(tencentAsrModels.concat(chatAudioTranscribeModels, standardAudioTranscribeModels, [transcribeModel]).filter(Boolean)))
      : [transcribeModel].filter(Boolean));
  if (!endpoint || !transcribeEndpoint) {
    return {
      score: 0,
      feedback: '评分服务未配置，请联系管理员。',
      status: 'score-pending',
      error: 'missing-score-endpoint',
      errorType: 'configuration'
    };
  }
  const isIeltsAttempt = String(payload.attemptType || '') === 'ielts_speaking';
  const ieltsPart = inferIeltsPart(payload);
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
    if (!audioBuffer || !audioBuffer.length) {
      throw new Error('empty-downloaded-audio');
    }
    const authHeaders = {
      authorization: apiKey ? `Bearer ${apiKey}` : ''
    };
    let transcript = '';
    let transcriptModel = '';
    let pronunciationScore = null;
    let pronunciationResult = null;
    let transcribeError = null;
    for (const model of transcribeModels) {
      if (transcript) {
        break;
      }
      try {
        console.log('[speaking-score-stage]', JSON.stringify({
          stage: isTencentAsrModel(model) ? 'transcribe-tencent-asr-start' : (isChatAudioTranscribeModel(model) ? 'transcribe-chat-start' : 'transcribe-start'),
          model,
          taskId: payload.taskId || '',
          attemptType: payload.attemptType || '',
          attemptIndex: payload.attemptIndex || 0
        }));
        transcript = await transcribeWithPreferredRoute({
          endpoint,
          transcribeEndpoint,
          authHeaders,
          model,
          audioBuffer,
          payload
        });
        transcriptModel = model;
      } catch (error) {
        transcribeError = error;
        console.error('[speaking-transcribe-failed]', JSON.stringify({
          model,
          message: String(error && error.message || error || ''),
          endpointHost: isTencentAsrModel(model)
            ? 'asr.tencentcloudapi.com'
            : (isChatAudioTranscribeModel(model)
            ? (endpoint ? new URL(endpoint).hostname : '')
            : (transcribeEndpoint ? new URL(transcribeEndpoint).hostname : ''))
        }));
      }
    }
    if (!transcript && transcribeError) {
      throw transcribeError;
    }
    console.log('[speaking-score-stage]', JSON.stringify({
      stage: 'transcribe-ok',
      model: transcriptModel,
      transcriptLength: transcript.length,
      taskId: payload.taskId || '',
      attemptType: payload.attemptType || '',
      attemptIndex: payload.attemptIndex || 0
    }));
    if (!transcript) {
      return {
        score: 0,
        pronunciationFluencyScore: 0,
        contentGrammarScore: 0,
        transcript: '',
        feedback: '这次录音没有识别到清晰英文回答，请重新录音后再提交评分。',
        status: 'score-pending',
        error: 'empty-transcript',
        errorType: 'audio-transcript'
      };
    }
    const requireTencentSoeScore = shouldUseTencentSoe();
    if (transcript && !pronunciationScore && requireTencentSoeScore) {
      try {
        const soeResult = await evaluateWithTencentSoe(audioBuffer, payload, transcript);
        if (soeResult) {
          pronunciationResult = soeResult;
          pronunciationScore = soeResult.score;
          console.log('[speaking-score-stage]', JSON.stringify({
            stage: 'tencent-soe-ok',
            score: pronunciationScore,
            requestId: soeResult.requestId || '',
            status: soeResult.status || '',
            taskId: payload.taskId || '',
            attemptType: payload.attemptType || '',
            attemptIndex: payload.attemptIndex || 0
          }));
        }
      } catch (error) {
        console.error('[speaking-tencent-soe-failed]', JSON.stringify({
          message: String(error && error.message || error || ''),
          taskId: payload.taskId || '',
          attemptType: payload.attemptType || '',
          attemptIndex: payload.attemptIndex || 0
        }));
      }
    }
    if (isIeltsAttempt && !pronunciationResult) {
      return {
        score: 0,
        transcript,
        feedback: '发音证据暂时不可用，录音已保存，请稍后重新评分。',
        status: 'score-pending',
        error: 'missing-tencent-soe-evidence',
        errorType: 'pronunciation-evidence'
      };
    }
    if (!isIeltsAttempt && requireTencentSoeScore && !Number.isFinite(Number(pronunciationScore))) {
      pronunciationScore = estimateFluencyScore(transcript);
      console.warn('[speaking-score-stage]', JSON.stringify({
        stage: 'tencent-soe-fallback',
        score: pronunciationScore,
        taskId: payload.taskId || '',
        attemptType: payload.attemptType || '',
        attemptIndex: payload.attemptIndex || 0
      }));
    }
    console.log('[speaking-score-stage]', JSON.stringify({
      stage: 'content-model-start',
      model: contentModel,
      taskId: payload.taskId || '',
      attemptType: payload.attemptType || '',
      attemptIndex: payload.attemptIndex || 0
    }));
    const contentBody = isIeltsAttempt ? buildIeltsScoreBody(payload, transcript, pronunciationResult) : {
      temperature: 0,
      messages: [{
        role: 'user',
        content: [
          'You grade a child English speaking answer from transcript and lesson source.',
          'Return JSON only: {"contentScore": number, "expressionFluencyScore": number, "feedback": "short Chinese advice", "suggestedAnswer": "one natural English answer"}.',
          'contentScore must be 0 to 100. Rubric: answer structure 35, grammar 30, source accuracy 25, relevance to question 10.',
          'expressionFluencyScore must be 0 to 100 based only on transcript completeness and naturalness.',
          'Be stable and lenient for a child learner. Correct answer with acceptable grammar should score 85-100.',
          'Suggested answer must be one direct declarative answer to the question, not a new question.',
          'Never suggest sentence starters such as "Excuse me" or "Is this" for a Whose/Who/What answer.',
          'Feedback must be warm Chinese: praise one thing, then give one concrete improvement, then point to the suggested answer.',
          `Source lesson text:\n${payload.sourceText || ''}`,
          `Question or prompt: ${payload.promptText || payload.questionText || ''}`,
          `Student transcript: ${transcript}`,
          `Attempt index: ${payload.attemptIndex || 0}`
        ].join('\n')
      }]
    };
    let contentResult = await postJsonWithModelFallback(endpoint, authHeaders, contentBody, contentModel, fallbackContentModel, 'content-score');
    let contentParsed = isIeltsAttempt ? parseIeltsScoreData(contentResult.data) : parseContentScoreData(contentResult.data);
    const hasValidIeltsBands = (value) => value
      && value.fluencyCoherenceBand > 0
      && value.lexicalResourceBand > 0
      && value.grammaticalRangeAccuracyBand > 0;
    if (
      (isIeltsAttempt ? !hasValidIeltsBands(contentParsed) : (!Number.isFinite(contentParsed.rawContentScore) || contentParsed.rawContentScore <= 0))
      && fallbackContentModel
      && fallbackContentModel !== contentResult.model
    ) {
      console.warn('[speaking-score-model-invalid]', JSON.stringify({
        model: contentResult.model,
        fallbackModel: fallbackContentModel,
        taskId: payload.taskId || '',
        attemptType: payload.attemptType || '',
        attemptIndex: payload.attemptIndex || 0
      }));
      contentResult = {
        model: fallbackContentModel,
        data: await postJsonWithRetry(endpoint, authHeaders, Object.assign({}, contentBody, { model: fallbackContentModel }), 'content-score-fallback')
      };
      contentParsed = isIeltsAttempt ? parseIeltsScoreData(contentResult.data) : parseContentScoreData(contentResult.data);
    }
    console.log('[speaking-score-stage]', JSON.stringify({
      stage: 'content-model-ok',
      model: contentResult.model,
      taskId: payload.taskId || '',
      attemptType: payload.attemptType || '',
      attemptIndex: payload.attemptIndex || 0
    }));
    const parsed = contentParsed.parsed;
    if (isIeltsAttempt) {
      const pronunciationBand = mapTencentSoeToIeltsPronunciationBand(pronunciationResult);
      if (!hasValidIeltsBands(contentParsed) || !pronunciationBand) {
        return {
          score: 0,
          transcript,
          feedback: '模型评分暂时失败，录音已保存，请重新提交评分。',
          status: 'score-pending',
          error: 'invalid-ielts-band-json',
          errorType: 'model-output'
        };
      }
      const overallBand = roundIeltsOverallBand((
        contentParsed.fluencyCoherenceBand
        + contentParsed.lexicalResourceBand
        + contentParsed.grammaticalRangeAccuracyBand
        + pronunciationBand
      ) / 4);
      const contentBandAverage = (
        contentParsed.fluencyCoherenceBand
        + contentParsed.lexicalResourceBand
        + contentParsed.grammaticalRangeAccuracyBand
      ) / 3;
      return {
        score: Math.round((overallBand / 9) * 100),
        pronunciationFluencyScore: Math.round(getTencentSoeEvidenceScore(pronunciationResult)),
        contentGrammarScore: Math.round((contentBandAverage / 9) * 100),
        transcript,
        feedback: buildFeedbackWithSuggestedAnswer(parsed.feedback, parsed.suggestedAnswer),
        status: 'scored',
        ieltsOverallBand: overallBand,
        ieltsFluencyCoherenceBand: contentParsed.fluencyCoherenceBand,
        ieltsLexicalResourceBand: contentParsed.lexicalResourceBand,
        ieltsGrammaticalRangeAccuracyBand: contentParsed.grammaticalRangeAccuracyBand,
        ieltsPronunciationBand: pronunciationBand,
        ieltsPart,
        ieltsAssessmentScope: 'practice-answer',
        ieltsDescriptorVersion: 'official-public-speaking-band-descriptors',
        scoreModel: contentResult.model,
        pronunciationProvider: 'tencent-soe'
      };
    }
    const looseParsed = contentParsed.looseParsed;
    const rawContentScore = contentParsed.rawContentScore;
    if (!Number.isFinite(rawContentScore) || rawContentScore <= 0) {
      return {
        score: 0,
        pronunciationFluencyScore: 0,
        contentGrammarScore: 0,
        transcript,
        feedback: '模型评分暂时失败，录音已保存，请重新提交评分。',
        status: 'score-pending',
        error: 'invalid-score-json',
        errorType: 'model-output'
      };
    }
    const expressionFallback = clampScore(parsed.expressionFluencyScore, estimateFluencyScore(transcript));
    const expressionScore = Number.isFinite(Number(pronunciationScore))
      ? clampScore(pronunciationScore, expressionFallback)
      : expressionFallback;
    const contentScore = Math.max(0, Math.min(100, rawContentScore));
    return {
      score: Math.max(0, Math.min(100, Math.round((contentScore * 0.8) + (expressionScore * 0.2)))),
      pronunciationFluencyScore: Math.round(expressionScore),
      contentGrammarScore: Math.round(contentScore),
      transcript,
      feedback: buildFeedbackWithSuggestedAnswer(parsed.feedback || (looseParsed && looseParsed.feedback), parsed.suggestedAnswer || (looseParsed && looseParsed.suggestedAnswer))
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
      pronunciationFluencyScore: 0,
      contentGrammarScore: 0,
      feedback: '模型评分暂时失败，录音已保存，请重新提交评分。',
      status: 'score-pending',
      error: String(error && error.message || error || ''),
      errorType
    };
  }
}

async function synthesizeFeedbackAudio(text, cloudPath) {
  const endpoint = String(process.env.SPEAKING_TTS_ENDPOINT || '').trim();
  const apiKey = String(process.env.SPEAKING_TTS_API_KEY || process.env.SPEAKING_SCORE_API_KEY || '').trim();
  const model = String(process.env.SPEAKING_TTS_MODEL || 'gpt-4o-mini-tts').trim();
  const voice = String(process.env.SPEAKING_TTS_VOICE || 'alloy').trim();
  const input = normalizeText(text);
  if (!endpoint || !input || !cloudPath) {
    return null;
  }
  if (endpoint.includes('api.openai.com') && !process.env.SPEAKING_TTS_API_KEY && process.env.SPEAKING_SCORE_ENDPOINT && !String(process.env.SPEAKING_SCORE_ENDPOINT).includes('api.openai.com')) {
    throw new Error('missing-speaking-tts-api-key-for-openai-endpoint');
  }
  const audioBuffer = await postAudio(endpoint, {
    authorization: apiKey ? `Bearer ${apiKey}` : ''
  }, {
    model,
    voice,
    input,
    response_format: 'mp3'
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
  getSpeakingHttpTimeoutMs,
  calculatePronunciationScore,
  buildPronunciationFeedback,
  normalizePronunciationWordDetails,
  extractTencentSoeScores,
  findQuestionFromTranscript,
  buildSourceTextFromTranscript,
  roundIeltsOverallBand,
  inferIeltsPart,
  mapTencentSoeToIeltsPronunciationBand,
  buildIeltsScoreBody,
  parseIeltsScoreData,
  evaluateSpeakingPronunciation,
  scoreSpeakingAttempt,
  synthesizeFeedbackAudio,
  summarizeAttempts
};
