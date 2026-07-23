const SOURCE_URL = 'https://ielts.org/cdn/Guides/ielts-writing-band-descriptors.pdf';
const KEY_ASSESSMENT_CRITERIA_URL = 'https://ielts.org/cdn/Guides/ielts-writing-key-assessment-criteria.pdf';
const VERSION = 'IELTS public Writing Band Descriptors, updated May 2023';

const TASK_1_ACHIEVEMENT = {
  9: 'All the requirements of the task are fully and appropriately satisfied. There may be extremely rare lapses in content.',
  8: 'The response covers all the requirements of the task appropriately, relevantly and sufficiently. Academic: key features are skilfully selected, and clearly presented, highlighted and illustrated. There may be occasional omissions or lapses in content.',
  7: 'The response covers the requirements of the task. The content is relevant and accurate, though there may be a few omissions or lapses. The format is appropriate. Academic: selected key features are covered and clearly highlighted but could be more fully or appropriately illustrated or extended. It presents a clear overview, the data are appropriately categorised, and main trends or differences are identified.',
  6: 'The response focuses on the requirements of the task and uses an appropriate format. Academic: selected key features are covered and adequately highlighted; a relevant overview is attempted; information is appropriately selected and supported using figures or data. Some irrelevant, inappropriate or inaccurate information may occur in details or illustrations. Some details may be missing or excessive and need further extension or illustration.',
  5: 'The response generally addresses the task requirements, though the format may be inappropriate in places. Academic: selected key features are not adequately covered; detail is recounted mainly mechanically and may lack supporting data. The response may focus on details without the bigger picture. Irrelevant, inappropriate or inaccurate material in key areas detracts from achievement. Main points have limited extension or illustration.',
  4: 'The response attempts to address the task. Academic: few key features are selected. The format may be inappropriate. Presented key features may be irrelevant, repetitive, inaccurate or inappropriate.',
  3: 'The response does not address the task requirements, possibly because the data, diagram or situation is misunderstood. Presented key features may be largely irrelevant. Limited information is presented and may be repetitive.',
  2: 'The content barely relates to the task.',
  1: 'Responses of 20 words or fewer are Band 1. The content is wholly unrelated to the task. Any copied rubric is excluded.',
  0: 'Use only when the candidate did not attend or attempt the question, used a language other than English throughout, or the answer is proven to be totally memorised.'
};

const TASK_2_RESPONSE = {
  9: 'The prompt is appropriately addressed and explored in depth. A clear and fully developed position directly answers the question or questions. Ideas are relevant, fully extended and well supported. Lapses in content or support are extremely rare.',
  8: 'The prompt is appropriately and sufficiently addressed. A clear and well-developed position responds to the question or questions. Ideas are relevant, well extended and supported. There may be occasional omissions or lapses in content.',
  7: 'The main parts of the prompt are appropriately addressed. A clear and developed position is presented. Main ideas are extended and supported, but there may be over-generalisation or a lack of focus and precision in supporting ideas or material.',
  6: 'The main parts of the prompt are addressed, though some may be more fully covered than others, and an appropriate format is used. A directly relevant position is presented, though conclusions may be unclear, unjustified or repetitive. Main ideas are relevant, but some may be insufficiently developed or unclear, and some support may be less relevant or inadequate.',
  5: 'The main parts of the prompt are incompletely addressed and the format may be inappropriate in places. A position is expressed but its development is not always clear. Some main ideas are put forward, but they are limited, insufficiently developed or accompanied by irrelevant detail. There may be repetition.',
  4: 'The prompt is tackled minimally or tangentially, possibly through misunderstanding, and the format may be inappropriate. A position is discernible only with careful reading. Main ideas are difficult to identify and may lack relevance, clarity or support. Large parts may be repetitive.',
  3: 'No part of the prompt is adequately addressed, or the prompt is misunderstood. No relevant position can be identified and there is little direct response. Ideas are few and may be irrelevant or insufficiently developed.',
  2: 'The content is barely related to the prompt. No position can be identified. There may be glimpses of one or two undeveloped ideas.',
  1: 'Responses of 20 words or fewer are Band 1. The content is wholly unrelated to the prompt. Any copied rubric is excluded.',
  0: 'Use only when the candidate did not attend or attempt the question, used a language other than English throughout, or the answer is proven to be totally memorised.'
};

const TASK_1_COHERENCE = {
  9: 'The message can be followed effortlessly. Cohesion very rarely attracts attention. Lapses in coherence or cohesion are minimal. Paragraphing is skilfully managed.',
  8: 'The message can be followed with ease. Information and ideas are logically sequenced and cohesion is well managed. Occasional lapses in coherence or cohesion may occur. Paragraphing is sufficient and appropriate.',
  7: 'Information and ideas are logically organised with clear progression throughout. A few lapses may occur. A range of cohesive devices, including reference and substitution, is used flexibly but with some inaccuracies or overuse or underuse.',
  6: 'Information and ideas are generally arranged coherently with clear overall progression. Cohesive devices have some good effect, but cohesion within or between sentences may be faulty or mechanical through misuse, overuse or omission. Reference and substitution may lack flexibility or clarity and cause repetition or error.',
  5: 'Organisation is evident but not wholly logical and overall progression may be lacking, though underlying coherence exists. Ideas can be followed but sentences are not fluently linked. Cohesive devices may be limited, overused or inaccurate. Inadequate or inaccurate reference and substitution may cause repetition.',
  4: 'Information and ideas are evident but not coherently arranged, with no clear progression. Relationships may be unclear or inadequately marked. Basic cohesive devices may be inaccurate or repetitive. Substitution or referencing is inaccurate or absent.',
  3: 'There is no apparent logical organisation. Ideas are discernible but difficult to relate. Sequencers or cohesive devices are minimal and do not necessarily show logical relationships. Referencing is difficult to identify.',
  2: 'There is little relevant message or the response may be entirely off-topic. There is little evidence of control of organisational features.',
  1: 'Responses of 20 words or fewer are Band 1. The writing communicates no message and appears to be by a virtual non-writer.',
  0: TASK_1_ACHIEVEMENT[0]
};

const TASK_2_COHERENCE = {
  9: TASK_1_COHERENCE[9],
  8: TASK_1_COHERENCE[8],
  7: 'Information and ideas are logically organised with clear progression throughout; any lapses are minor. A range of cohesive devices, including reference and substitution, is used flexibly but with some inaccuracies or overuse or underuse. Paragraphing generally supports overall coherence, and ideas within paragraphs are generally sequenced logically.',
  6: 'Information and ideas are generally arranged coherently with clear overall progression. Cohesive devices have some good effect, but cohesion within or between sentences may be faulty or mechanical through misuse, overuse or omission. Reference and substitution may lack flexibility or clarity and cause repetition or error. Paragraphing may not always be logical and the central topic may not always be clear.',
  5: 'Organisation is evident but not wholly logical and overall progression may be lacking, though underlying coherence exists. Ideas can be followed but sentences are not fluently linked. Cohesive devices may be limited, overused or inaccurate. Inadequate or inaccurate reference and substitution may cause repetition. Paragraphing may be inadequate or missing.',
  4: 'Information and ideas are evident but not coherently arranged, with no clear progression. Relationships may be unclear or inadequately marked. Basic cohesive devices may be inaccurate or repetitive. Substitution or referencing is inaccurate or absent. There may be no paragraphing or no clear main topic within paragraphs.',
  3: 'There is no apparent logical organisation. Ideas are discernible but difficult to relate. Sequencers or cohesive devices are minimal and do not necessarily show logical relationships. Referencing is difficult to identify. Attempts at paragraphing are unhelpful.',
  2: TASK_1_COHERENCE[2],
  1: TASK_1_COHERENCE[1],
  0: TASK_1_COHERENCE[0]
};

const LEXICAL_RESOURCE = {
  9: 'Full flexibility and precise use are evident. A wide range of vocabulary is accurate and appropriate with very natural and sophisticated control of lexical features. Minor spelling or word-formation errors are extremely rare and have minimal impact.',
  8: 'A wide resource is fluently and flexibly used to convey precise meanings. Uncommon or idiomatic items are used skilfully when appropriate, despite occasional inaccuracies in word choice and collocation. Occasional spelling or word-formation errors have minimal impact.',
  7: 'The resource is sufficient for some flexibility and precision. There is some ability to use less common or idiomatic items. Awareness of style and collocation is evident, though inappropriacies occur. Only a few spelling or word-formation errors occur and do not detract from clarity.',
  6: 'The resource is generally adequate and appropriate. Meaning is generally clear despite a restricted range or imprecise word choice. Risk-taking may produce a wider range with more inaccuracy or inappropriacy. Spelling or word-formation errors do not impede communication.',
  5: 'The resource is limited but minimally adequate. Simple vocabulary may be accurate but permits little variation. Word choice may frequently be inappropriate, and simplification or repetition shows limited flexibility. Spelling or word-formation errors may cause some difficulty.',
  4: 'The resource is limited and inadequate or unrelated to the task. Vocabulary is basic and repetitive. Lexical chunks may be inappropriate, including memorised, formulaic or input language. Word-choice, word-formation or spelling errors may impede meaning.',
  3: 'The resource is inadequate, possibly because the response is substantially underlength. There may be over-dependence on input material or memorised language. Control of word choice or spelling is very limited and errors predominate, possibly severely impeding meaning.',
  2: 'The resource is extremely limited, with few recognisable strings apart from memorised phrases. There is no apparent control of word formation or spelling.',
  1: 'Responses of 20 words or fewer are Band 1. No resource is apparent except a few isolated words.',
  0: TASK_1_ACHIEVEMENT[0]
};

const GRAMMATICAL_RANGE_ACCURACY = {
  9: 'A wide range of structures is used with full flexibility and control. Punctuation and grammar are appropriate throughout. Minor errors are extremely rare and have minimal impact.',
  8: 'A wide range of structures is flexibly and accurately used. The majority of sentences are error-free and punctuation is well managed. Occasional non-systematic errors and inappropriacies have minimal impact.',
  7: 'A variety of complex structures is used with some flexibility and accuracy. Grammar and punctuation are generally well controlled and error-free sentences are frequent. A few errors may persist but do not impede communication.',
  6: 'A mix of simple and complex sentence forms is used but flexibility is limited. Complex structures are less accurate than simple structures. Grammar and punctuation errors occur but rarely impede communication.',
  5: 'The range of structures is limited and repetitive. Complex sentences are attempted but tend to be faulty, while simple sentences are most accurate. Frequent grammatical errors may cause some difficulty. Punctuation may be faulty.',
  4: 'A very limited range of structures is used. Subordinate clauses are rare and simple sentences predominate. Some structures are accurate, but frequent grammatical errors may impede meaning. Punctuation is often faulty or inadequate.',
  3: 'Sentence forms are attempted, but grammar and punctuation errors predominate, except in memorised or copied phrases, preventing most meaning from coming through. Length may be insufficient to show control of sentence forms.',
  2: 'There is little or no evidence of sentence forms except in memorised phrases.',
  1: 'Responses of 20 words or fewer are Band 1. No rateable language is evident.',
  0: TASK_1_ACHIEVEMENT[0]
};

function getOfficialCriterionDescriptor(taskType, criterionKey, band) {
  const score = Number(band);
  if (!Number.isInteger(score) || score < 0 || score > 9) return '';
  if (criterionKey === 'task') {
    return (taskType === 'ielts-task-1' ? TASK_1_ACHIEVEMENT : TASK_2_RESPONSE)[score] || '';
  }
  if (criterionKey === 'coherenceCohesion') {
    return (taskType === 'ielts-task-1' ? TASK_1_COHERENCE : TASK_2_COHERENCE)[score] || '';
  }
  if (criterionKey === 'lexicalResource') return LEXICAL_RESOURCE[score] || '';
  if (criterionKey === 'grammaticalRangeAccuracy') return GRAMMATICAL_RANGE_ACCURACY[score] || '';
  return '';
}

function getOfficialCriterionFeatures(taskType, criterionKey, band) {
  return getOfficialCriterionDescriptor(taskType, criterionKey, band)
    .split(/(?<=\.)\s+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function buildOfficialWritingBandGuide(taskType) {
  const isTask1 = taskType === 'ielts-task-1';
  const taskLabel = isTask1 ? 'Task Achievement' : 'Task Response';
  const taskDescriptors = isTask1 ? TASK_1_ACHIEVEMENT : TASK_2_RESPONSE;
  const coherenceDescriptors = isTask1 ? TASK_1_COHERENCE : TASK_2_COHERENCE;
  const bands = [];
  for (let band = 9; band >= 0; band -= 1) {
    bands.push([
      `Band ${band}`,
      `${taskLabel}: ${taskDescriptors[band]}`,
      `Coherence and Cohesion: ${coherenceDescriptors[band]}`,
      `Lexical Resource: ${LEXICAL_RESOURCE[band]}`,
      `Grammatical Range and Accuracy: ${GRAMMATICAL_RANGE_ACCURACY[band]}`
    ].join('\n'));
  }
  return [
    VERSION,
    `Official Band Descriptors source: ${SOURCE_URL}`,
    `Official Key Assessment Criteria source: ${KEY_ASSESSMENT_CRITERIA_URL}`,
    'A script must fully fit the positive features of the descriptor at a particular level. Negative features limit a rating.',
    ...bands
  ].join('\n\n');
}

function buildOfficialBandSelectionProtocol(taskType) {
  const taskLabel = taskType === 'ielts-task-1' ? 'Task Achievement' : 'Task Response';
  return [
    'Official band-selection protocol:',
    `1. Assess ${taskLabel}, Coherence and Cohesion, Lexical Resource, and Grammatical Range and Accuracy independently.`,
    '2. For each criterion, start at Band 9 and move down one whole band at a time.',
    '3. Award the first band only when every positive feature at that band fully fits the script. One strong feature cannot compensate for an unmet feature in the same criterion.',
    '4. Record why the awarded band is fully met and identify the exact feature or features preventing the immediately higher band. Do not award a band when evidence is uncertain or absent.',
    '5. Dimension bands must be whole numbers. The reported task estimate is calculated later from the four dimension bands and rounded to the nearest 0.5.',
    '6. A response of 20 words or fewer is Band 1 for every criterion. Band 0 is reserved for no attempt, non-English throughout, or a proven totally memorised response.',
    '7. Do not infer a target score from writing fluency, school level, user identity, prior scores, or the requested score. Use only the official descriptors and the submitted response.'
  ].join('\n');
}

module.exports = {
  SOURCE_URL,
  KEY_ASSESSMENT_CRITERIA_URL,
  VERSION,
  buildOfficialWritingBandGuide,
  buildOfficialBandSelectionProtocol,
  getOfficialCriterionDescriptor,
  getOfficialCriterionFeatures,
  _test: {
    TASK_1_ACHIEVEMENT,
    TASK_2_RESPONSE,
    TASK_1_COHERENCE,
    TASK_2_COHERENCE,
    LEXICAL_RESOURCE,
    GRAMMATICAL_RANGE_ACCURACY
  }
};
