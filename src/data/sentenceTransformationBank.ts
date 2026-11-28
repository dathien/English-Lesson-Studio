import type {BankQuestionRecord} from '../types/exam';
import type {
  CognitiveLevel,
  HighSchoolGrade,
  QuestionItem,
  SentenceTransformationMeta,
} from '../types/lesson';
import {
  buildTransformationPromptText,
  DEFAULT_TRANSFORMATION_GRADING_RULES,
} from '../services/sentenceTransformationEngine';

export const TRANSFORMATION_BANK_ATTRIBUTION =
  'Tự biên soạn bám sát chủ điểm ngữ pháp bộ sách Tiếng Anh Global Success (GDPT 2018) — giáo viên đối chiếu SGK khi sử dụng.';

interface CuratedTransformSeed {
  id: string;
  grade: HighSchoolGrade;
  unitId: string;
  unitLabel: string;
  grammarTopic: string;
  cognitiveLevel: CognitiveLevel;
  meta: Omit<SentenceTransformationMeta, 'grade' | 'unitId' | 'grammarTopic' | 'sourceAttribution'>;
  correctAnswer: string;
  acceptedAnswers: string[];
  explanation: string;
  points?: number;
}

const CURATED_SEEDS: CuratedTransformSeed[] = [
  // ================= GRADE 10 (10 Units) =================
  {
    id: 'tf-gs10-u1-1',
    grade: 10,
    unitId: 'gs10-u1',
    unitLabel: 'Unit 1: Family Life',
    grammarTopic: 'Present Simple & Present Continuous (Habits & Routines)',
    cognitiveLevel: 'comprehension',
    meta: {
      subtype: 'given_start',
      originalSentence: 'My father usually does the heavy lifting in our family.',
      instruction: 'Rewrite the sentence using the given beginning without changing its meaning.',
      givenStart: 'My father is responsible',
      hints: [
        'Cấu trúc tương đương cho trách nhiệm thường xuyên: be responsible for + V-ing / Noun.',
        'Đổi động từ "does the heavy lifting" thành danh động từ "doing the heavy lifting".',
        'Ghép đủ: My father is responsible for doing the heavy lifting in our family.',
      ],
      structurePattern: 'usually + V(s/es) ↔ be responsible for + V-ing',
      grammarReviewNote: 'Unit 1 · Thì hiện tại đơn diễn tả thói quen, phân công việc nhà.',
    },
    correctAnswer: 'My father is responsible for doing the heavy lifting in our family.',
    acceptedAnswers: [
      'My father is responsible for the heavy lifting in our family.',
      'My father is responsible for doing the heavy lifting in my family.',
    ],
    explanation:
      'Cấu trúc "be responsible for + V-ing / N" diễn đạt trách nhiệm làm việc gì một cách tự nhiên, giữ nguyên nghĩa của câu gốc ở thì hiện tại đơn.',
  },
  {
    id: 'tf-gs10-u1-2',
    grade: 10,
    unitId: 'gs10-u1',
    unitLabel: 'Unit 1: Family Life',
    grammarTopic: 'Present Simple vs Present Continuous (Temporary Action)',
    cognitiveLevel: 'application',
    meta: {
      subtype: 'keyword_unchanged',
      originalSentence: 'My mother normally cooks dinner, but tonight my sister is doing it instead.',
      instruction: 'Complete the second sentence using the word given. Do not change the word given.',
      givenStart: 'Although my mother normally cooks dinner, my sister',
      givenEnd: 'tonight.',
      keyword: 'PLACE',
      keepKeywordUnchanged: true,
      wordLimit: {min: 2, max: 6},
      hints: [
        'Cụm thành ngữ mang nghĩa "thay thế ai đó": take someone’s place.',
        'Hành động diễn ra tạm thời "tonight" chia ở thì hiện tại tiếp diễn (is taking).',
        'Điền cụm: is taking her place.',
      ],
      structurePattern: 'do sth instead of sb ↔ be taking sb’s place',
      grammarReviewNote: 'Unit 1 · Phân biệt thì hiện tại đơn (normally) và hiện tại tiếp diễn (tonight).',
    },
    correctAnswer: 'Although my mother normally cooks dinner, my sister is taking her place tonight.',
    acceptedAnswers: [
      'Although my mother normally cooks dinner, my sister is taking my mother’s place tonight.',
      "Although my mother normally cooks dinner, my sister is taking my mother's place tonight.",
    ],
    explanation:
      'Dùng thì hiện tại tiếp diễn "is taking her place" để diễn tả hành động tạm thời tối nay, giữ nguyên từ khóa PLACE.',
  },
  {
    id: 'tf-gs10-u2-1',
    grade: 10,
    unitId: 'gs10-u2',
    unitLabel: 'Unit 2: Humans and the Environment',
    grammarTopic: 'Passive Voice (Future with will / be going to)',
    cognitiveLevel: 'comprehension',
    meta: {
      subtype: 'given_start',
      originalSentence: 'The youth club will plant more than 200 trees around the school yard next Sunday.',
      instruction: 'Rewrite the sentence in the passive voice.',
      givenStart: 'More than 200 trees',
      hints: [
        'Xác định thì tương lai đơn chủ động: will + V0 → bị động: will be + V3/ed.',
        'Đưa cụm trạng ngữ chỉ nơi chốn (around the school yard) đứng trước "by the youth club", trạng ngữ thời gian (next Sunday) đặt cuối câu.',
        'Kiểm tra lại dạng quá khứ phân từ: plant → planted.',
      ],
      structurePattern: 'S + will + V0 + O → O + will be + V3/ed + (place) + by S + (time)',
      grammarReviewNote: 'Unit 2 · Câu bị động với thì tương lai đơn (will be + V3/ed).',
    },
    correctAnswer: 'More than 200 trees will be planted around the school yard by the youth club next Sunday.',
    acceptedAnswers: [
      'More than 200 trees will be planted by the youth club around the school yard next Sunday.',
    ],
    explanation:
      'Bị động thì tương lai đơn có dạng "will be + V3/ed" (will be planted). Trạng ngữ nơi chốn đặt trước "by + O", trạng ngữ thời gian đặt cuối câu.',
  },
  {
    id: 'tf-gs10-u2-2',
    grade: 10,
    unitId: 'gs10-u2',
    unitLabel: 'Unit 2: Humans and the Environment',
    grammarTopic: 'Be going to (Planned Future Intention)',
    cognitiveLevel: 'recognition',
    meta: {
      subtype: 'keyword',
      originalSentence: 'Our class plans to organize a clean-up campaign this weekend.',
      instruction: 'Rewrite the sentence using the keyword given.',
      givenStart: 'Our class',
      keyword: 'GOING',
      keepKeywordUnchanged: true,
      hints: [
        'Cấu trúc "plan to V" diễn tả dự định đã lên kế hoạch tương đương với "be going to + V0".',
        'Chủ ngữ "Our class" đi với động từ "is" (hoặc "are" trong tiếng Anh-Anh).',
        'Giữ nguyên cụm "organize a clean-up campaign this weekend".',
      ],
      structurePattern: 'S + plan(s) to V ↔ S + be going to + V0',
      grammarReviewNote: 'Unit 2 · Dùng "be going to" để nói về kế hoạch, dự định đã chuẩn bị.',
    },
    correctAnswer: 'Our class is going to organize a clean-up campaign this weekend.',
    acceptedAnswers: [
      'Our class is going to organise a clean-up campaign this weekend.',
      'Our class are going to organize a clean-up campaign this weekend.',
      'Our class are going to organise a clean-up campaign this weekend.',
    ],
    explanation:
      '"Plan to + V" diễn tả dự định có sẵn nên chuyển sang "is going to + V0" (organize/organise đều được chấp nhận).',
  },
  {
    id: 'tf-gs10-u3-1',
    grade: 10,
    unitId: 'gs10-u3',
    unitLabel: 'Unit 3: Music',
    grammarTopic: 'Bare Infinitive vs To-Infinitive (Make / Let / Allow)',
    cognitiveLevel: 'comprehension',
    meta: {
      subtype: 'given_start',
      originalSentence: 'Her parents did not let her attend the rock concert alone.',
      instruction: 'Rewrite the sentence using the given beginning.',
      givenStart: 'Her parents did not allow',
      hints: [
        'Cấu trúc: let sb + V0 ↔ allow sb + to V.',
        'Giữ nguyên thì quá khứ đơn phủ định "did not allow".',
        'Thêm "to" trước động từ "attend".',
      ],
      structurePattern: 'let + O + V0 ↔ allow + O + to V',
      grammarReviewNote: 'Unit 3 · Động từ theo sau bởi động từ nguyên mẫu có "to" và không "to".',
    },
    correctAnswer: 'Her parents did not allow her to attend the rock concert alone.',
    acceptedAnswers: [
      "Her parents didn't allow her to attend the rock concert alone.",
    ],
    explanation:
      'Sau "let + O" là động từ nguyên mẫu không "to" (V0), còn sau "allow + O" bắt buộc dùng "to + V0" (allow her to attend).',
  },
  {
    id: 'tf-gs10-u3-2',
    grade: 10,
    unitId: 'gs10-u3',
    unitLabel: 'Unit 3: Music',
    grammarTopic: 'Compound Sentences (FANBOYS: so / but / yet)',
    cognitiveLevel: 'comprehension',
    meta: {
      subtype: 'full_rewrite',
      originalSentence: 'The tickets were very expensive. Many fans still queued for hours to buy them.',
      instruction: 'Combine the two sentences into one compound sentence using "but" or "yet".',
      keyword: 'but',
      keepKeywordUnchanged: false,
      hints: [
        'Hai mệnh đề mang nghĩa tương phản nhau (vé đắt ↔ người hâm mộ vẫn xếp hàng).',
        'Đặt dấu phẩy trước liên từ đẳng lập "but" hoặc "yet" để nối hai mệnh đề độc lập.',
        'Viết thường chữ "many" sau liên từ.',
      ],
      structurePattern: 'Clause 1, but / yet Clause 2',
      grammarReviewNote: 'Unit 3 · Câu ghép (Compound sentences) với các liên từ and, or, but, so.',
    },
    correctAnswer: 'The tickets were very expensive, but many fans still queued for hours to buy them.',
    acceptedAnswers: [
      'The tickets were very expensive, yet many fans still queued for hours to buy them.',
      'The tickets were very expensive, but many fans queued for hours to buy them.',
    ],
    explanation:
      'Nối hai mệnh đề độc lập mang nghĩa tương phản bằng dấu phẩy + "but" (hoặc "yet") để tạo câu ghép chuẩn ngữ pháp.',
  },
  {
    id: 'tf-gs10-u4-1',
    grade: 10,
    unitId: 'gs10-u4',
    unitLabel: 'Unit 4: For a Better Community',
    grammarTopic: 'Past Simple vs Past Continuous (When / While)',
    cognitiveLevel: 'comprehension',
    meta: {
      subtype: 'given_start',
      originalSentence: 'We were distributing free meals at the shelter when it suddenly started to rain.',
      instruction: 'Rewrite the sentence starting with "While".',
      givenStart: 'While',
      hints: [
        'Sau "While" dùng mệnh đề hành động đang diễn ra ở thì quá khứ tiếp diễn (were distributing).',
        'Ngăn cách hai mệnh đề bằng dấu phẩy khi "While" đứng đầu câu.',
        'Mệnh đề hành động xen vào giữ nguyên thì quá khứ đơn (it suddenly started to rain).',
      ],
      structurePattern: 'S1 + was/were V-ing + when + S2 + V2 ↔ While S1 + was/were V-ing, S2 + V2',
      grammarReviewNote: 'Unit 4 · Kết hợp thì quá khứ tiếp diễn và quá khứ đơn với when / while.',
    },
    correctAnswer: 'While we were distributing free meals at the shelter, it suddenly started to rain.',
    acceptedAnswers: [
      'While we were distributing free meals at the shelter, it started to rain suddenly.',
    ],
    explanation:
      'Mệnh đề đi với "While" diễn tả hành động kéo dài đang xảy ra (Past Continuous), mệnh đề còn lại diễn tả hành động cắt ngang (Past Simple).',
  },
  {
    id: 'tf-gs10-u5-1',
    grade: 10,
    unitId: 'gs10-u5',
    unitLabel: 'Unit 5: Inventions',
    grammarTopic: 'Present Perfect (Since / For / Started ... ago)',
    cognitiveLevel: 'comprehension',
    meta: {
      subtype: 'given_start',
      originalSentence: 'Scientists started developing smart educational robots five years ago.',
      instruction: 'Rewrite the sentence using the Present Perfect tense.',
      givenStart: 'Scientists have',
      hints: [
        'Đổi "started + V-ing ... ago" sang "have/has + V3/ed ... for + khoảng thời gian".',
        'Bỏ "started" và "ago", đổi "developing" thành "developed" (hoặc dùng "have been developing").',
        'Đặt "for five years" ở cuối câu.',
      ],
      structurePattern: 'S + started/began + V-ing + (time) ago ↔ S + have/has + V3/been V-ing + for (time)',
      grammarReviewNote: 'Unit 5 · Chuyển đổi giữa thì Quá khứ đơn và Hiện tại hoàn thành.',
    },
    correctAnswer: 'Scientists have developed smart educational robots for five years.',
    acceptedAnswers: [
      'Scientists have been developing smart educational robots for five years.',
    ],
    explanation:
      'Hành động bắt đầu trong quá khứ và kéo dài đến hiện tại chuyển từ "started + V-ing ... ago" sang "have developed / have been developing ... for five years".',
  },
  {
    id: 'tf-gs10-u5-2',
    grade: 10,
    unitId: 'gs10-u5',
    unitLabel: 'Unit 5: Inventions',
    grammarTopic: 'Gerunds as Subjects (It is + adj + to V ↔ V-ing + is + adj)',
    cognitiveLevel: 'recognition',
    meta: {
      subtype: 'given_start',
      originalSentence: 'It is very convenient to store study materials on cloud platforms.',
      instruction: 'Rewrite the sentence beginning with a gerund.',
      givenStart: 'Storing',
      hints: [
        'Đưa cụm "to store study materials on cloud platforms" lên đầu câu làm chủ ngữ ở dạng V-ing.',
        'Danh động từ làm chủ ngữ luôn đi với động từ số ít "is".',
        'Hoàn thiện phần vị ngữ: "is very convenient."',
      ],
      structurePattern: 'It is + adj + to V + O ↔ V-ing + O + is + adj',
      grammarReviewNote: 'Unit 5 · Danh động từ (Gerund) làm chủ ngữ trong câu.',
    },
    correctAnswer: 'Storing study materials on cloud platforms is very convenient.',
    acceptedAnswers: [
      'Storing study materials on cloud platforms is convenient.',
    ],
    explanation:
      'Chuyển cấu trúc chủ ngữ giả "It is + adj + to V" thành danh động từ làm chủ ngữ "V-ing ... + is + adj".',
  },
  {
    id: 'tf-gs10-u6-1',
    grade: 10,
    unitId: 'gs10-u6',
    unitLabel: 'Unit 6: Gender Equality',
    grammarTopic: 'Passive Voice with Modal Verbs (should / must / can)',
    cognitiveLevel: 'comprehension',
    meta: {
      subtype: 'given_start',
      originalSentence: 'Society should give women equal opportunities in leadership positions.',
      instruction: 'Rewrite the sentence in the passive voice.',
      givenStart: 'Women',
      hints: [
        'Công thức bị động với động từ khuyết thiếu: Modal + be + V3/ed.',
        'Động từ "give" chuyển thành phân từ hai "given".',
        'Chủ ngữ chung chung "Society" có thể giữ "by society" hoặc lược bỏ.',
      ],
      structurePattern: 'S + modal + V0 + O → O + modal + be + V3/ed + (by S)',
      grammarReviewNote: 'Unit 6 · Câu bị động với động từ khuyết thiếu (should/must/can + be + V3/ed).',
    },
    correctAnswer: 'Women should be given equal opportunities in leadership positions.',
    acceptedAnswers: [
      'Women should be given equal opportunities in leadership positions by society.',
    ],
    explanation:
      'Bị động động từ khuyết thiếu có dạng "should be + V3/ed" (should be given). Tác nhân chung "by society" có thể lược bỏ hoặc giữ nguyên.',
  },
  {
    id: 'tf-gs10-u6-2',
    grade: 10,
    unitId: 'gs10-u6',
    unitLabel: 'Unit 6: Gender Equality',
    grammarTopic: 'Passive Voice with Modal Verbs (must)',
    cognitiveLevel: 'application',
    meta: {
      subtype: 'gap_completion',
      originalSentence: 'Governments must eliminate gender discrimination in the workplace.',
      instruction: 'Complete the passive sentence by filling in the missing words.',
      gapTemplate: 'Gender discrimination in the workplace ___ ___ ___ by governments.',
      hints: [
        'Xác định động từ khuyết thiếu trong câu gốc là "must".',
        'Cấu trúc bị động động từ khuyết thiếu gồm 3 từ: modal + be + V3/ed.',
        'Ba từ cần điền lần lượt là: must | be | eliminated.',
      ],
      structurePattern: 'must + V0 → must + be + V3/ed',
      grammarReviewNote: 'Unit 6 · Hoàn thành chỗ trống cấu trúc bị động với "must".',
    },
    correctAnswer: 'Gender discrimination in the workplace must be eliminated by governments.',
    acceptedAnswers: [
      'Gender discrimination in the workplace must be eliminated.',
    ],
    explanation:
      'Ba chỗ trống tương ứng với cấu trúc bị động "must + be + eliminated".',
  },
  {
    id: 'tf-gs10-u7-1',
    grade: 10,
    unitId: 'gs10-u7',
    unitLabel: 'Unit 7: Viet Nam and International Organisations',
    grammarTopic: 'Comparatives & Superlatives (Superlative ↔ Comparative)',
    cognitiveLevel: 'application',
    meta: {
      subtype: 'given_start',
      originalSentence: 'No other regional organization in Southeast Asia is more influential than ASEAN.',
      instruction: 'Rewrite the sentence using a superlative adjective.',
      givenStart: 'ASEAN is',
      hints: [
        'Cấu trúc "No other + N + is + so sánh hơn + than X" tương đương so sánh nhất "X is the most + adj + N".',
        'Tính từ dài "influential" có dạng so sánh nhất là "the most influential".',
        'Giữ cụm danh từ "regional organization in Southeast Asia".',
      ],
      structurePattern: 'No other N is more + adj + than X ↔ X is the most + adj + N',
      grammarReviewNote: 'Unit 7 · Chuyển đổi giữa so sánh hơn và so sánh nhất.',
    },
    correctAnswer: 'ASEAN is the most influential regional organization in Southeast Asia.',
    acceptedAnswers: [
      'ASEAN is the most influential regional organisation in Southeast Asia.',
    ],
    explanation:
      'Chuyển từ so sánh hơn phủ định ("No other ... more influential than") sang so sánh nhất ("the most influential ...").',
  },
  {
    id: 'tf-gs10-u7-2',
    grade: 10,
    unitId: 'gs10-u7',
    unitLabel: 'Unit 7: Viet Nam and International Organisations',
    grammarTopic: 'Comparatives (Comparative ↔ Not as ... as)',
    cognitiveLevel: 'comprehension',
    meta: {
      subtype: 'keyword_unchanged',
      originalSentence: 'International trade today is much more competitive than it was twenty years ago.',
      instruction: 'Complete the second sentence using AS. Do not change the word given.',
      givenStart: 'Twenty years ago, international trade was not',
      givenEnd: 'it is today.',
      keyword: 'AS',
      keepKeywordUnchanged: true,
      wordLimit: {min: 2, max: 5},
      hints: [
        'Cấu trúc so sánh không bằng: not as + adj + as.',
        'Đổi từ "more competitive than" sang "as competitive as" (hoặc "so competitive as").',
        'Kiểm tra số từ điền vào chỗ trống: "as competitive as" (3 từ).',
      ],
      structurePattern: 'A is more + adj + than B ↔ B is not as + adj + as A',
      grammarReviewNote: 'Unit 7 · So sánh hơn chuyển sang so sánh không bằng (not as ... as).',
    },
    correctAnswer: 'Twenty years ago, international trade was not as competitive as it is today.',
    acceptedAnswers: [
      'Twenty years ago, international trade was not nearly as competitive as it is today.',
      'Twenty years ago, international trade was not so competitive as it is today.',
    ],
    explanation:
      'Đảo ngược hai vế so sánh hơn bằng cấu trúc "not as + tính từ nguyên mẫu + as" (as competitive as).',
  },
  {
    id: 'tf-gs10-u8-1',
    grade: 10,
    unitId: 'gs10-u8',
    unitLabel: 'Unit 8: New Ways to Learn',
    grammarTopic: 'Defining & Non-defining Relative Clauses',
    cognitiveLevel: 'comprehension',
    meta: {
      subtype: 'full_rewrite',
      originalSentence: 'Blended learning combines online study with face-to-face lessons. It helps students learn more flexibly.',
      instruction: 'Combine the two sentences using a non-defining relative clause with "which".',
      keyword: 'which',
      keepKeywordUnchanged: true,
      hints: [
        'Chủ ngữ "Blended learning" đã xác định, do đó mệnh đề quan hệ không xác định cần dấu phẩy.',
        'Thay đại từ "It" bằng ", which" đặt ngay sau "Blended learning" hoặc nối ở vế sau.',
        'Kiểm tra đủ 2 dấu phẩy nếu chèn mệnh đề quan hệ vào giữa câu.',
      ],
      structurePattern: 'S, which + V1..., V2...',
      grammarReviewNote: 'Unit 8 · Mệnh đề quan hệ xác định và không xác định (who, which, that, whose).',
    },
    correctAnswer: 'Blended learning, which combines online study with face-to-face lessons, helps students learn more flexibly.',
    acceptedAnswers: [
      'Blended learning, which helps students learn more flexibly, combines online study with face-to-face lessons.',
    ],
    explanation:
      'Dùng mệnh đề quan hệ không xác định với "which" và cặp dấu phẩy để bổ sung thông tin cho danh từ riêng/khái niệm xác định "Blended learning".',
  },
  {
    id: 'tf-gs10-u9-1',
    grade: 10,
    unitId: 'gs10-u9',
    unitLabel: 'Unit 9: Protecting the Environment',
    grammarTopic: 'Reported Speech (Statements)',
    cognitiveLevel: 'comprehension',
    meta: {
      subtype: 'given_start',
      originalSentence: '"We are organizing an eco-friendly exhibition next week," the teacher told us.',
      instruction: 'Rewrite the sentence in reported speech.',
      givenStart: 'The teacher told us that',
      hints: [
        'Đổi đại từ: "We" → "they".',
        'Lùi thì Hiện tại tiếp diễn (are organizing) → Quá khứ tiếp diễn (were organizing).',
        'Đổi trạng từ thời gian: "next week" → "the following week" hoặc "the next week".',
      ],
      structurePattern: 'S + told + O + (that) + S + V(lùi thì) + trạng từ đổi',
      grammarReviewNote: 'Unit 9 · Câu tường thuật lời kể: đổi ngôi, lùi thì và đổi trạng ngữ thời gian.',
    },
    correctAnswer: 'The teacher told us that they were organizing an eco-friendly exhibition the following week.',
    acceptedAnswers: [
      'The teacher told us that they were organising an eco-friendly exhibition the following week.',
      'The teacher told us that they were organizing an eco-friendly exhibition the next week.',
      'The teacher told us that we were organizing an eco-friendly exhibition the following week.',
    ],
    explanation:
      'Khi chuyển sang câu tường thuật với động từ "told" ở quá khứ: lùi thì "are organizing" → "were organizing", đổi "next week" → "the following week / the next week".',
  },
  {
    id: 'tf-gs10-u9-2',
    grade: 10,
    unitId: 'gs10-u9',
    unitLabel: 'Unit 9: Protecting the Environment',
    grammarTopic: 'Reported Speech (Yes/No & Wh-Questions)',
    cognitiveLevel: 'application',
    meta: {
      subtype: 'given_start',
      originalSentence: '"Have you ever participated in a wildlife conservation project?" Minh asked Lan.',
      instruction: 'Rewrite the question in reported speech.',
      givenStart: 'Minh asked Lan',
      hints: [
        'Đây là câu hỏi Yes/No → dùng "if" hoặc "whether" sau "Minh asked Lan".',
        'Đổi trật tự câu hỏi về trật tự câu trần thuật (chủ ngữ "she" đứng trước động từ).',
        'Lùi thì Hiện tại hoàn thành (Have ... participated) → Quá khứ hoàn thành (had ... participated).',
      ],
      structurePattern: 'S + asked + O + if/whether + S + V(lùi thì)',
      grammarReviewNote: 'Unit 9 · Tường thuật câu hỏi Yes/No không đảo trợ động từ và bỏ dấu hỏi chấm.',
    },
    correctAnswer: 'Minh asked Lan if she had ever participated in a wildlife conservation project.',
    acceptedAnswers: [
      'Minh asked Lan whether she had ever participated in a wildlife conservation project.',
    ],
    explanation:
      'Câu hỏi Yes/No chuyển sang gián tiếp dùng "if/whether", đổi "you" → "she", lùi thì "have participated" → "had participated" và kết thúc bằng dấu chấm.',
  },
  {
    id: 'tf-gs10-u10-1',
    grade: 10,
    unitId: 'gs10-u10',
    unitLabel: 'Unit 10: Ecotourism',
    grammarTopic: 'Conditional Sentences Type 1 (If ... not ↔ Unless)',
    cognitiveLevel: 'comprehension',
    meta: {
      subtype: 'given_start',
      originalSentence: 'If tourists do not respect local wildlife, the natural ecosystem will suffer.',
      instruction: 'Rewrite the sentence starting with "Unless".',
      givenStart: 'Unless',
      hints: [
        '"Unless" có nghĩa là "If ... not" (trừ khi).',
        'Khi dùng "Unless", bỏ trợ động từ phủ định "do not" và giữ động từ chính ở dạng khẳng định "respect".',
        'Mệnh đề chính giữ nguyên: "the natural ecosystem will suffer."',
      ],
      structurePattern: 'If + S + do/does not + V0, S + will + V0 ↔ Unless + S + V(s/es), S + will + V0',
      grammarReviewNote: 'Unit 10 · Câu điều kiện loại 1 với Unless (= If ... not).',
    },
    correctAnswer: 'Unless tourists respect local wildlife, the natural ecosystem will suffer.',
    acceptedAnswers: [],
    explanation:
      'Unless = If ... not. Bỏ "do not" để mệnh đề sau Unless ở thể khẳng định nhưng vẫn giữ nguyên nghĩa điều kiện phủ định.',
  },
  {
    id: 'tf-gs10-u10-2',
    grade: 10,
    unitId: 'gs10-u10',
    unitLabel: 'Unit 10: Ecotourism',
    grammarTopic: 'Conditional Sentences Type 2 (Unreal Present)',
    cognitiveLevel: 'application',
    meta: {
      subtype: 'given_start',
      originalSentence: 'We do not have enough funding, so we cannot build a new eco-lodge this year.',
      instruction: 'Rewrite the sentence using a Type 2 conditional.',
      givenStart: 'If we',
      hints: [
        'Tình huống trái với thực tế ở hiện tại → dùng câu điều kiện loại 2.',
        'Đổi mệnh đề nguyên nhân phủ định ("do not have") thành quá khứ đơn khẳng định ("had").',
        'Mệnh đề kết quả: "cannot build" → "could build".',
      ],
      structurePattern: 'S + do/does not V1, so S + cannot V2 ↔ If S + V2(ed), S + could/would + V2',
      grammarReviewNote: 'Unit 10 · Câu điều kiện loại 2 diễn tả giả định trái hiện tại.',
    },
    correctAnswer: 'If we had enough funding, we could build a new eco-lodge this year.',
    acceptedAnswers: [
      'If we had enough funding, we would be able to build a new eco-lodge this year.',
    ],
    explanation:
      'Thực tế hiện tại ở dạng phủ định (do not have / cannot build) chuyển sang điều kiện loại 2 dạng khẳng định (had / could build).',
  },

  // ================= GRADE 11 (8 Suitable Units: U1, U2, U4, U5, U6, U7, U8, U9) =================
  {
    id: 'tf-gs11-u1-1',
    grade: 11,
    unitId: 'gs11-u1',
    unitLabel: 'Unit 1: A Long and Healthy Life',
    grammarTopic: 'Past Simple ↔ Present Perfect (The last time / Haven’t ... for)',
    cognitiveLevel: 'comprehension',
    meta: {
      subtype: 'given_start',
      originalSentence: 'The last time Nam ate fast food was six months ago.',
      instruction: 'Rewrite the sentence using the Present Perfect tense.',
      givenStart: 'Nam has not',
      hints: [
        'Cấu trúc: The last time + S + V2 + was + (time) ago ↔ S + have/has not + V3/ed + for + (time).',
        'Chuyển động từ "ate" sang phân từ hai "eaten".',
        'Đổi "six months ago" thành "for six months".',
      ],
      structurePattern: 'The last time S + V2 was (time) ago ↔ S + have/has not + V3 + for (time)',
      grammarReviewNote: 'Unit 1 (Lớp 11) · Chuyển đổi giữa Quá khứ đơn và Hiện tại hoàn thành.',
    },
    correctAnswer: 'Nam has not eaten fast food for six months.',
    acceptedAnswers: [
      "Nam hasn't eaten fast food for six months.",
    ],
    explanation:
      'Cấu trúc "The last time S + V2 was ... ago" tương đương với "S + has/have not + V3 + for ..." (has not eaten ... for six months).',
  },
  {
    id: 'tf-gs11-u1-2',
    grade: 11,
    unitId: 'gs11-u1',
    unitLabel: 'Unit 1: A Long and Healthy Life',
    grammarTopic: 'Present Perfect (First time ↔ Never ... before)',
    cognitiveLevel: 'application',
    meta: {
      subtype: 'keyword_unchanged',
      originalSentence: 'This is the first time I have tried an organic vegetarian diet.',
      instruction: 'Complete the second sentence using NEVER. Do not change the word given.',
      givenStart: 'I',
      givenEnd: 'an organic vegetarian diet before.',
      keyword: 'NEVER',
      keepKeywordUnchanged: true,
      wordLimit: {min: 2, max: 4},
      hints: [
        'Cấu trúc tương đương: This is the first time S + have/has + V3 ↔ S + have/has + never + V3 + before.',
        'Đặt "never" giữa trợ động từ "have" và phân từ hai "tried".',
        'Cụm điền vào chỗ trống gồm 3 từ: "have never tried".',
      ],
      structurePattern: 'This is the first time S + have/has V3 ↔ S + have/has never V3 ... before',
      grammarReviewNote: 'Unit 1 (Lớp 11) · Hiện tại hoàn thành với "never ... before".',
    },
    correctAnswer: 'I have never tried an organic vegetarian diet before.',
    acceptedAnswers: [
      "I've never tried an organic vegetarian diet before.",
    ],
    explanation:
      '"This is the first time + Hiện tại hoàn thành" chuyển tương đương thành "have/has never + V3 + before".',
  },
  {
    id: 'tf-gs11-u2-1',
    grade: 11,
    unitId: 'gs11-u2',
    unitLabel: 'Unit 2: The Generation Gap',
    grammarTopic: 'Modal Verbs (must / have to / not allowed to)',
    cognitiveLevel: 'comprehension',
    meta: {
      subtype: 'keyword',
      originalSentence: 'Teenagers are not allowed to stay out past 10 p.m. on weekdays.',
      instruction: 'Rewrite the sentence using "mustn’t" or "must not".',
      givenStart: 'Teenagers',
      keyword: 'must not',
      keepKeywordUnchanged: false,
      hints: [
        'Cấu trúc cấm đoán "be not allowed to V" tương đương với "must not / mustn’t + V0".',
        'Giữ nguyên động từ nguyên mẫu "stay out past 10 p.m. on weekdays".',
        'Lưu ý không dùng "don’t have to" vì "don’t have to" mang nghĩa không cần thiết, không phải cấm đoán.',
      ],
      structurePattern: 'S + be not allowed to V ↔ S + must not / mustn’t + V0',
      grammarReviewNote: 'Unit 2 (Lớp 11) · Phân biệt mustn’t (cấm đoán) và don’t have to (không bắt buộc).',
    },
    correctAnswer: 'Teenagers must not stay out past 10 p.m. on weekdays.',
    acceptedAnswers: [
      "Teenagers mustn't stay out past 10 p.m. on weekdays.",
    ],
    explanation:
      '"Be not allowed to V" diễn đạt sự cấm đoán, tương đương trực tiếp với "must not / mustn’t + V0".',
  },
  {
    id: 'tf-gs11-u2-2',
    grade: 11,
    unitId: 'gs11-u2',
    unitLabel: 'Unit 2: The Generation Gap',
    grammarTopic: 'Modal Verbs of Advice (should / ought to)',
    cognitiveLevel: 'recognition',
    meta: {
      subtype: 'given_start',
      originalSentence: 'It is a good idea for parents to listen to their children’s opinions patiently.',
      instruction: 'Rewrite the sentence using a modal verb of advice.',
      givenStart: 'Parents',
      hints: [
        '"It is a good idea for sb to V" diễn tả lời khuyên → dùng "should + V0" hoặc "ought to + V0".',
        'Chủ ngữ là "Parents", động từ chính là "listen".',
        'Giữ nguyên phần còn lại: "to their children’s opinions patiently."',
      ],
      structurePattern: 'It is a good idea for S to V ↔ S + should / ought to + V0',
      grammarReviewNote: 'Unit 2 (Lớp 11) · Động từ khuyết thiếu đưa ra lời khuyên (should / ought to).',
    },
    correctAnswer: "Parents should listen to their children's opinions patiently.",
    acceptedAnswers: [
      "Parents ought to listen to their children's opinions patiently.",
    ],
    explanation:
      'Cấu trúc khuyên nhủ "It is a good idea for sb to V" chuyển tự nhiên sang "should + V0" hoặc "ought to + V0".',
  },
  {
    id: 'tf-gs11-u4-1',
    grade: 11,
    unitId: 'gs11-u4',
    unitLabel: 'Unit 4: ASEAN and Viet Nam',
    grammarTopic: 'Gerunds as Subjects & Objects (Spend / Take)',
    cognitiveLevel: 'comprehension',
    meta: {
      subtype: 'given_start',
      originalSentence: 'It took the delegates two hours to prepare for the ASEAN Youth Forum.',
      instruction: 'Rewrite the sentence using "spent".',
      givenStart: 'The delegates spent',
      hints: [
        'Cấu trúc: It takes/took + sb + (time) + to V ↔ S + spend(s)/spent + (time) + V-ing.',
        'Đưa "two hours" ngay sau "spent".',
        'Đổi "to prepare" thành danh động từ "preparing".',
      ],
      structurePattern: 'It took sb + time + to V ↔ S + spent + time + V-ing',
      grammarReviewNote: 'Unit 4 (Lớp 11) · Danh động từ (Gerund) sau spend + thời gian.',
    },
    correctAnswer: 'The delegates spent two hours preparing for the ASEAN Youth Forum.',
    acceptedAnswers: [],
    explanation:
      'Cấu trúc "It took sb + time + to V" chuyển tương đương thành "S + spent + time + V-ing" (spent two hours preparing).',
  },
  {
    id: 'tf-gs11-u4-2',
    grade: 11,
    unitId: 'gs11-u4',
    unitLabel: 'Unit 4: ASEAN and Viet Nam',
    grammarTopic: 'Gerunds (Look forward to / Prefer / Would rather)',
    cognitiveLevel: 'application',
    meta: {
      subtype: 'keyword_unchanged',
      originalSentence: 'Many Vietnamese students are excited about joining cultural exchange programmes in ASEAN.',
      instruction: 'Complete the second sentence using FORWARD. Do not change the word given.',
      givenStart: 'Many Vietnamese students are',
      givenEnd: 'cultural exchange programmes in ASEAN.',
      keyword: 'FORWARD',
      keepKeywordUnchanged: true,
      wordLimit: {min: 3, max: 5},
      hints: [
        'Cụm động từ mang nghĩa mong đợi: look forward to + V-ing.',
        'Động từ "are" đứng trước gợi ý thì hiện tại tiếp diễn: "looking forward to".',
        'Sau giới từ "to" bắt buộc dùng V-ing: "joining".',
      ],
      structurePattern: 'be excited about + V-ing ↔ be looking forward to + V-ing',
      grammarReviewNote: 'Unit 4 (Lớp 11) · Danh động từ sau cụm giới từ "look forward to".',
    },
    correctAnswer: 'Many Vietnamese students are looking forward to joining cultural exchange programmes in ASEAN.',
    acceptedAnswers: [
      'Many Vietnamese students are looking forward to joining cultural exchange programs in ASEAN.',
    ],
    explanation:
      '"Look forward to" kết thúc bằng giới từ "to" nên theo sau là V-ing ("looking forward to joining").',
  },
  {
    id: 'tf-gs11-u5-1',
    grade: 11,
    unitId: 'gs11-u5',
    unitLabel: 'Unit 5: Global Warming',
    grammarTopic: 'Present Participle Clauses (V-ing)',
    cognitiveLevel: 'application',
    meta: {
      subtype: 'given_start',
      originalSentence: 'Because factories burn massive amounts of coal, they release tonnes of carbon dioxide into the air.',
      instruction: 'Rewrite the sentence using a present participle clause.',
      givenStart: 'Burning',
      hints: [
        'Hai mệnh đề có cùng chủ ngữ "factories / they" và mệnh đề nguyên nhân ở thể chủ động.',
        'Lược bỏ "Because" và chủ ngữ thứ nhất, chuyển động từ "burn" thành hiện tại phân từ "Burning".',
        'Thay đại từ "they" ở mệnh đề chính bằng danh từ cụ thể "factories" để câu rõ nghĩa.',
      ],
      structurePattern: 'Because S + V(active), S + V2 ↔ V-ing..., S + V2',
      grammarReviewNote: 'Unit 5 (Lớp 11) · Mệnh đề hiện tại phân từ (Present Participle Clause) chỉ nguyên nhân.',
    },
    correctAnswer: 'Burning massive amounts of coal, factories release tonnes of carbon dioxide into the air.',
    acceptedAnswers: [
      'Burning massive amounts of coal, factories release tons of carbon dioxide into the air.',
    ],
    explanation:
      'Rút gọn mệnh đề trạng ngữ chỉ nguyên nhân đồng chủ ngữ ở thể chủ động thành Present Participle Clause ("Burning massive amounts of coal, factories...").',
  },
  {
    id: 'tf-gs11-u5-2',
    grade: 11,
    unitId: 'gs11-u5',
    unitLabel: 'Unit 5: Global Warming',
    grammarTopic: 'Past Participle Clauses (V3/ed)',
    cognitiveLevel: 'application',
    meta: {
      subtype: 'given_start',
      originalSentence: 'When coral reefs are exposed to warmer ocean temperatures, they lose their colour.',
      instruction: 'Rewrite the sentence using a past participle clause.',
      givenStart: 'Exposed',
      hints: [
        'Mệnh đề trạng ngữ ở thể bị động ("are exposed") và cùng chủ ngữ với mệnh đề chính ("coral reefs / they").',
        'Lược bỏ "When", chủ ngữ và động từ "are", bắt đầu bằng quá khứ phân từ "Exposed".',
        'Thay "they" ở mệnh đề chính thành "coral reefs".',
      ],
      structurePattern: 'When/If S + be + V3/ed, S + V2 ↔ V3/ed..., S + V2',
      grammarReviewNote: 'Unit 5 (Lớp 11) · Mệnh đề quá khứ phân từ (Past Participle Clause) mang nghĩa bị động.',
    },
    correctAnswer: 'Exposed to warmer ocean temperatures, coral reefs lose their colour.',
    acceptedAnswers: [
      'Exposed to warmer ocean temperatures, coral reefs lose their color.',
    ],
    explanation:
      'Mệnh đề bị động đồng chủ ngữ rút gọn thành Past Participle Clause ("Exposed to warmer ocean temperatures, coral reefs...").',
  },
  {
    id: 'tf-gs11-u6-1',
    grade: 11,
    unitId: 'gs11-u6',
    unitLabel: 'Unit 6: Preserving Our Heritage',
    grammarTopic: 'To-Infinitive Clauses Modifying Nouns (the first / only / last ... to V)',
    cognitiveLevel: 'application',
    meta: {
      subtype: 'given_start',
      originalSentence: 'Trang An Scenic Landscape Complex was the only site in Southeast Asia that was recognised as a mixed heritage site.',
      instruction: 'Rewrite the sentence using a to-infinitive clause.',
      givenStart: 'Trang An Scenic Landscape Complex was the only site in Southeast Asia',
      hints: [
        'Sau cụm chứa "the only / the first / the last + N", ta rút gọn mệnh đề quan hệ bằng "to + V".',
        'Động từ trong mệnh đề quan hệ ở thể bị động ("was recognised") → rút gọn thành "to be + V3/ed".',
        'Kết hợp: "to be recognised as a mixed heritage site."',
      ],
      structurePattern: 'the first/last/only + N + that/who + be + V3 ↔ the first/last/only + N + to be + V3',
      grammarReviewNote: 'Unit 6 (Lớp 11) · Rút gọn mệnh đề quan hệ bằng to-infinitive bị động.',
    },
    correctAnswer:
      'Trang An Scenic Landscape Complex was the only site in Southeast Asia to be recognised as a mixed heritage site.',
    acceptedAnswers: [
      'Trang An Scenic Landscape Complex was the only site in Southeast Asia to be recognized as a mixed heritage site.',
    ],
    explanation:
      'Sau "the only site", mệnh đề quan hệ bị động "that was recognised" rút gọn thành "to be recognised" (hoặc recognized).',
  },
  {
    id: 'tf-gs11-u6-2',
    grade: 11,
    unitId: 'gs11-u6',
    unitLabel: 'Unit 6: Preserving Our Heritage',
    grammarTopic: 'To-Infinitive Clauses of Purpose',
    cognitiveLevel: 'comprehension',
    meta: {
      subtype: 'given_start',
      originalSentence: 'Local volunteers launched a social media page so that they could promote traditional folk singing.',
      instruction: 'Rewrite the sentence using a to-infinitive clause of purpose.',
      givenStart: 'Local volunteers launched a social media page',
      hints: [
        'Bỏ "so that they could" và thay bằng "to" (hoặc "in order to / so as to") + V0.',
        'Giữ nguyên động từ nguyên mẫu "promote traditional folk singing".',
        'Kiểm tra câu hoàn chỉnh không lặp lại chủ ngữ "they".',
      ],
      structurePattern: 'S + V + so that S + can/could + V0 ↔ S + V + (in order) to + V0',
      grammarReviewNote: 'Unit 6 (Lớp 11) · Mệnh đề to-infinitive chỉ mục đích.',
    },
    correctAnswer: 'Local volunteers launched a social media page to promote traditional folk singing.',
    acceptedAnswers: [
      'Local volunteers launched a social media page in order to promote traditional folk singing.',
      'Local volunteers launched a social media page so as to promote traditional folk singing.',
    ],
    explanation:
      'Khi hai mệnh đề cùng chủ ngữ, mệnh đề mục đích "so that they could + V0" được rút gọn gọn gàng thành "to / in order to / so as to + V0".',
  },
  {
    id: 'tf-gs11-u7-1',
    grade: 11,
    unitId: 'gs11-u7',
    unitLabel: 'Unit 7: Education Options for School-Leavers',
    grammarTopic: 'Perfect Participle Clauses (Having + V3/ed)',
    cognitiveLevel: 'high_application',
    meta: {
      subtype: 'given_start',
      originalSentence: 'After Minh had completed his vocational training course, he opened a small repair workshop.',
      instruction: 'Rewrite the sentence using a perfect participle clause.',
      givenStart: 'Having',
      hints: [
        'Hành động xảy ra và hoàn tất trước hành động chính → dùng Perfect Participle: Having + V3/ed.',
        'Bỏ "After Minh had", bắt đầu bằng "Having completed his vocational training course,".',
        'Thay đại từ "he" ở mệnh đề chính bằng "Minh".',
      ],
      structurePattern: 'After S + had + V3, S + V2 ↔ Having + V3..., S + V2',
      grammarReviewNote: 'Unit 7 (Lớp 11) · Phân từ hoàn thành (Having + V3/ed) nhấn mạnh hành động xảy ra trước.',
    },
    correctAnswer: 'Having completed his vocational training course, Minh opened a small repair workshop.',
    acceptedAnswers: [],
    explanation:
      'Dùng "Having + V3/ed" (Having completed) để rút gọn mệnh đề thời gian có hành động xảy ra trước hành động ở mệnh đề chính.',
  },
  {
    id: 'tf-gs11-u7-2',
    grade: 11,
    unitId: 'gs11-u7',
    unitLabel: 'Unit 7: Education Options for School-Leavers',
    grammarTopic: 'Perfect Gerunds (Having + V3/ed after Verbs/Prepositions)',
    cognitiveLevel: 'high_application',
    meta: {
      subtype: 'given_start',
      originalSentence: 'Linh regretted that she had not applied for the scholarship earlier.',
      instruction: 'Rewrite the sentence using a perfect gerund.',
      givenStart: 'Linh regretted',
      hints: [
        'Cấu trúc: regret + (not) having + V3/ed để nói về điều hối tiếc đã xảy ra trong quá khứ.',
        'Đặt "not" ngay trước "having".',
        'Ghép hoàn chỉnh: "Linh regretted not having applied for the scholarship earlier."',
      ],
      structurePattern: 'regret that S + had (not) + V3 ↔ regret (not) having + V3',
      grammarReviewNote: 'Unit 7 (Lớp 11) · Danh động từ hoàn thành (Perfect Gerund) ở thể phủ định.',
    },
    correctAnswer: 'Linh regretted not having applied for the scholarship earlier.',
    acceptedAnswers: [
      'Linh regretted not applying for the scholarship earlier.',
    ],
    explanation:
      'Sau "regret", dùng danh động từ hoàn thành phủ định "not having applied" để nhấn mạnh hành động đã không làm trong quá khứ.',
  },
  {
    id: 'tf-gs11-u8-1',
    grade: 11,
    unitId: 'gs11-u8',
    unitLabel: 'Unit 8: Becoming Independent',
    grammarTopic: 'Cleft Sentences (It is/was ... that/who ...)',
    cognitiveLevel: 'comprehension',
    meta: {
      subtype: 'given_start',
      originalSentence: 'Good time-management skills help teenagers become truly independent.',
      instruction: 'Rewrite the sentence using a cleft sentence to emphasize the subject.',
      givenStart: 'It is',
      hints: [
        'Cấu trúc câu chẻ (Cleft sentence): It is/was + thành phần nhấn mạnh + that/who + phần còn lại.',
        'Câu gốc ở thì hiện tại đơn → dùng "It is".',
        'Thành phần nhấn mạnh là vật/kỹ năng ("good time-management skills") → dùng "that".',
      ],
      structurePattern: 'It is/was + [Focus] + that/who + [Rest of clause]',
      grammarReviewNote: 'Unit 8 (Lớp 11) · Câu chẻ nhấn mạnh chủ ngữ (It is ... that ...).',
    },
    correctAnswer: 'It is good time-management skills that help teenagers become truly independent.',
    acceptedAnswers: [],
    explanation:
      'Câu chẻ "It is + chủ ngữ nhấn mạnh + that + V..." luôn dùng động từ số ít "is", còn động từ sau "that" chia theo danh từ nhấn mạnh ("skills" → "help").',
  },
  {
    id: 'tf-gs11-u8-2',
    grade: 11,
    unitId: 'gs11-u8',
    unitLabel: 'Unit 8: Becoming Independent',
    grammarTopic: 'Cleft Sentences Emphasizing Adverbial / Object',
    cognitiveLevel: 'application',
    meta: {
      subtype: 'gap_completion',
      originalSentence: 'Mai learned how to manage her monthly budget from her older brother.',
      instruction: 'Complete the cleft sentence emphasizing "from her older brother".',
      gapTemplate: 'It ___ from her older brother ___ Mai learned how to manage her monthly budget.',
      hints: [
        'Động từ câu gốc "learned" ở thì quá khứ đơn → điền "was" vào chỗ trống thứ nhất.',
        'Nhấn mạnh cụm trạng ngữ → luôn dùng "that" ở chỗ trống thứ hai.',
        'Hai từ cần điền: was | that.',
      ],
      structurePattern: 'It was + [Adverbial] + that + S + V',
      grammarReviewNote: 'Unit 8 (Lớp 11) · Câu chẻ nhấn mạnh cụm trạng ngữ ở thì quá khứ.',
    },
    correctAnswer: 'It was from her older brother that Mai learned how to manage her monthly budget.',
    acceptedAnswers: [
      'It was from her older brother that Mai learnt how to manage her monthly budget.',
    ],
    explanation:
      'Câu gốc ở thì quá khứ đơn ("learned") nên dùng "It was ... that ..." để nhấn mạnh cụm trạng ngữ "from her older brother".',
  },
  {
    id: 'tf-gs11-u9-1',
    grade: 11,
    unitId: 'gs11-u9',
    unitLabel: 'Unit 9: Social Issues',
    grammarTopic: 'Linking Words of Concession (Although ↔ Despite / In spite of)',
    cognitiveLevel: 'application',
    meta: {
      subtype: 'keyword_unchanged',
      originalSentence: 'Although cyberbullying causes serious mental stress, many students hesitate to report it.',
      instruction: 'Rewrite the sentence using DESPITE. Do not change the word given.',
      givenStart: 'Despite',
      keyword: 'DESPITE',
      keepKeywordUnchanged: true,
      hints: [
        'Sau "Despite" là cụm danh từ hoặc V-ing (không dùng mệnh đề S + V trực tiếp trừ khi có "the fact that").',
        'Có thể viết "Despite the serious mental stress caused by cyberbullying," hoặc "Despite the fact that cyberbullying causes serious mental stress,".',
        'Mệnh đề chính giữ nguyên: "many students hesitate to report it."',
      ],
      structurePattern: 'Although + S + V ↔ Despite + N-phrase / V-ing / the fact that + S + V',
      grammarReviewNote: 'Unit 9 (Lớp 11) · Chuyển đổi liên từ chỉ sự nhượng bộ Although ↔ Despite.',
    },
    correctAnswer: 'Despite the fact that cyberbullying causes serious mental stress, many students hesitate to report it.',
    acceptedAnswers: [
      'Despite the serious mental stress caused by cyberbullying, many students hesitate to report it.',
      'Despite cyberbullying causing serious mental stress, many students hesitate to report it.',
    ],
    explanation:
      'Sau "Despite" không đi trực tiếp với mệnh đề; ta chuyển sang "Despite the fact that + clause" hoặc cụm danh từ tương đương.',
  },
  {
    id: 'tf-gs11-u9-2',
    grade: 11,
    unitId: 'gs11-u9',
    unitLabel: 'Unit 9: Social Issues',
    grammarTopic: 'Linking Words of Cause (Because ↔ Because of)',
    cognitiveLevel: 'comprehension',
    meta: {
      subtype: 'given_start',
      originalSentence: 'Because peer pressure was intense, several teenagers made unwise choices.',
      instruction: 'Rewrite the sentence using "Because of".',
      givenStart: 'Because of',
      hints: [
        'Sau "Because of" là một cụm danh từ (Noun phrase), không còn động từ "was".',
        'Đưa tính từ "intense" đứng trước danh từ "peer pressure" → "the intense peer pressure" hoặc "intense peer pressure".',
        'Giữ nguyên mệnh đề chính phía sau dấu phẩy.',
      ],
      structurePattern: 'Because + N + be + adj ↔ Because of + (the) + adj + N',
      grammarReviewNote: 'Unit 9 (Lớp 11) · Chuyển đổi Because + mệnh đề sang Because of + cụm danh từ.',
    },
    correctAnswer: 'Because of the intense peer pressure, several teenagers made unwise choices.',
    acceptedAnswers: [
      'Because of intense peer pressure, several teenagers made unwise choices.',
    ],
    explanation:
      'Đổi mệnh đề "peer pressure was intense" thành cụm danh từ "(the) intense peer pressure" ngay sau giới từ "Because of".',
  },

  // ================= GRADE 12 (8 Suitable Units: U1, U3, U4, U5, U6, U7, U8, U10) =================
  {
    id: 'tf-gs12-u1-1',
    grade: 12,
    unitId: 'gs12-u1',
    unitLabel: 'Unit 1: Life Stories We Admire',
    grammarTopic: 'Past Simple & Past Continuous (Interrupted Action in Biography)',
    cognitiveLevel: 'comprehension',
    meta: {
      subtype: 'given_start',
      originalSentence: 'During his university studies in France, the young scientist discovered a new vaccine.',
      instruction: 'Rewrite the sentence using "While" and the Past Continuous tense.',
      givenStart: 'While the young scientist',
      hints: [
        'Đổi cụm danh từ "During his university studies in France" thành mệnh đề Quá khứ tiếp diễn.',
        'Động từ tương ứng với "studies" là "was studying at university in France".',
        'Ở mệnh đề chính thay "the young scientist" bằng đại từ "he" để tránh lặp từ.',
      ],
      structurePattern: 'During + N-phrase, S + V2 ↔ While S + was/were V-ing, S + V2',
      grammarReviewNote: 'Unit 1 (Lớp 12) · Kết hợp Quá khứ tiếp diễn và Quá khứ đơn khi kể tiểu sử.',
    },
    correctAnswer: 'While the young scientist was studying at university in France, he discovered a new vaccine.',
    acceptedAnswers: [
      'While the young scientist was studying in France, he discovered a new vaccine.',
    ],
    explanation:
      'Chuyển cụm giới từ chỉ thời gian "During his university studies" sang mệnh đề quá khứ tiếp diễn "While ... was studying at university".',
  },
  {
    id: 'tf-gs12-u3-1',
    grade: 12,
    unitId: 'gs12-u3',
    unitLabel: 'Unit 3: Green Living',
    grammarTopic: 'Relative Clauses Referring to a Whole Sentence (, which)',
    cognitiveLevel: 'application',
    meta: {
      subtype: 'full_rewrite',
      originalSentence: 'Our school has replaced single-use plastic bottles with refill stations. This significantly reduces daily waste.',
      instruction: 'Combine the two sentences using a relative clause referring to the whole first sentence.',
      keyword: 'which',
      keepKeywordUnchanged: true,
      hints: [
        'Đại từ "This" ở câu 2 thay cho toàn bộ mệnh đề câu 1.',
        'Đổi dấu chấm thành dấu phẩy và thay "This" bằng "which".',
        'Động từ sau ", which" luôn chia số ít ("reduces").',
      ],
      structurePattern: 'Clause 1. This + V(s/es)... ↔ Clause 1, which + V(s/es)...',
      grammarReviewNote: 'Unit 3 (Lớp 12) · Mệnh đề quan hệ ", which" bổ nghĩa cho cả mệnh đề đứng trước.',
    },
    correctAnswer:
      'Our school has replaced single-use plastic bottles with refill stations, which significantly reduces daily waste.',
    acceptedAnswers: [
      'Our school has replaced single-use plastic bottles with refill stations, which reduces daily waste significantly.',
    ],
    explanation:
      'Dùng dấu phẩy + "which" thay cho "This" để liên kết hệ quả của toàn bộ mệnh đề phía trước.',
  },
  {
    id: 'tf-gs12-u3-2',
    grade: 12,
    unitId: 'gs12-u3',
    unitLabel: 'Unit 3: Green Living',
    grammarTopic: 'Verbs with Prepositions (rely on / cut down on / care about)',
    cognitiveLevel: 'application',
    meta: {
      subtype: 'keyword_unchanged',
      originalSentence: 'Many households are trying to reduce their electricity consumption this summer.',
      instruction: 'Complete the second sentence using DOWN. Do not change the word given.',
      givenStart: 'Many households are trying to',
      givenEnd: 'their electricity consumption this summer.',
      keyword: 'DOWN',
      keepKeywordUnchanged: true,
      wordLimit: {min: 2, max: 4},
      hints: [
        'Cụm động từ mang nghĩa "cắt giảm lượng tiêu thụ": cut down on.',
        'Động từ nguyên mẫu đi sau "trying to".',
        'Ba từ cần điền vào chỗ trống: "cut down on".',
      ],
      structurePattern: 'reduce + N ↔ cut down on + N',
      grammarReviewNote: 'Unit 3 (Lớp 12) · Cụm động từ với giới từ chủ đề Green Living.',
    },
    correctAnswer: 'Many households are trying to cut down on their electricity consumption this summer.',
    acceptedAnswers: [],
    explanation:
      '"Cut down on + N" đồng nghĩa với "reduce + N" (cắt giảm lượng điện năng tiêu thụ) và giữ nguyên từ khóa DOWN.',
  },
  {
    id: 'tf-gs12-u4-1',
    grade: 12,
    unitId: 'gs12-u4',
    unitLabel: 'Unit 4: Urbanisation',
    grammarTopic: 'Double Comparatives (The more ..., the more ...)',
    cognitiveLevel: 'high_application',
    meta: {
      subtype: 'given_start',
      originalSentence: 'As big cities expand more rapidly, traffic congestion becomes more serious.',
      instruction: 'Rewrite the sentence using a double comparative.',
      givenStart: 'The more rapidly',
      hints: [
        'Cấu trúc so sánh kép: The + so sánh hơn + S1 + V1, the + so sánh hơn + S2 + V2.',
        'Vế 1: The more rapidly big cities expand,',
        'Vế 2: đưa "more serious" lên đầu cùng "the" → "the more serious traffic congestion becomes."',
      ],
      structurePattern: 'The + comp1 + S1 + V1, the + comp2 + S2 + V2',
      grammarReviewNote: 'Unit 4 (Lớp 12) · Câu so sánh kép (Double Comparatives).',
    },
    correctAnswer: 'The more rapidly big cities expand, the more serious traffic congestion becomes.',
    acceptedAnswers: [],
    explanation:
      'Áp dụng đúng trật tự so sánh kép "The + trạng từ/tính từ so sánh hơn + S + V" ở cả hai vế.',
  },
  {
    id: 'tf-gs12-u4-2',
    grade: 12,
    unitId: 'gs12-u4',
    unitLabel: 'Unit 4: Urbanisation',
    grammarTopic: 'Double Comparatives (Short Adjectives)',
    cognitiveLevel: 'application',
    meta: {
      subtype: 'gap_completion',
      originalSentence: 'When housing prices get higher, it becomes harder for young workers to buy a home.',
      instruction: 'Complete the double comparative sentence.',
      gapTemplate: 'The ___ housing prices get, the ___ it becomes for young workers to buy a home.',
      hints: [
        'Cả hai tính từ "high" và "hard" đều là tính từ ngắn.',
        'Chỗ trống 1: higher.',
        'Chỗ trống 2: harder.',
      ],
      structurePattern: 'The + adj1-er + S1 + V1, the + adj2-er + S2 + V2',
      grammarReviewNote: 'Unit 4 (Lớp 12) · So sánh kép với tính từ ngắn (-er).',
    },
    correctAnswer: 'The higher housing prices get, the harder it becomes for young workers to buy a home.',
    acceptedAnswers: [],
    explanation:
      'Hai tính từ ngắn "higher" và "harder" đặt ngay sau "The" ở đầu mỗi mệnh đề.',
  },
  {
    id: 'tf-gs12-u5-1',
    grade: 12,
    unitId: 'gs12-u5',
    unitLabel: 'Unit 5: The World of Work',
    grammarTopic: 'Complex Sentences (Although / Even though / Whereas)',
    cognitiveLevel: 'comprehension',
    meta: {
      subtype: 'given_start',
      originalSentence: 'The internship offered a modest allowance, yet it gave Minh invaluable hands-on experience.',
      instruction: 'Rewrite the compound sentence as a complex sentence starting with "Although".',
      givenStart: 'Although',
      hints: [
        'Bỏ liên từ ghép "yet" khi đã dùng liên từ phụ thuộc "Although" ở đầu câu.',
        'Giữ dấu phẩy ngăn cách giữa mệnh đề phụ thuộc và mệnh đề chính.',
        'Không được dùng đồng thời cả "Although" và "but / yet".',
      ],
      structurePattern: 'Clause 1, yet/but Clause 2 ↔ Although Clause 1, Clause 2',
      grammarReviewNote: 'Unit 5 (Lớp 12) · Chuyển đổi câu ghép sang câu phức với mệnh đề nhượng bộ.',
    },
    correctAnswer:
      'Although the internship offered a modest allowance, it gave Minh invaluable hands-on experience.',
    acceptedAnswers: [],
    explanation:
      'Chuyển câu ghép dùng "yet" sang câu phức dùng "Although" (nhớ bỏ "yet/but" để tránh lỗi thừa liên từ).',
  },
  {
    id: 'tf-gs12-u6-1',
    grade: 12,
    unitId: 'gs12-u6',
    unitLabel: 'Unit 6: Artificial Intelligence',
    grammarTopic: 'Passive Causative (have / get something done)',
    cognitiveLevel: 'application',
    meta: {
      subtype: 'given_start',
      originalSentence: 'The IT department upgraded our school’s AI learning platform last month.',
      instruction: 'Rewrite the sentence using the passive causative "had ... done".',
      givenStart: 'Our school had',
      hints: [
        'Cấu trúc thể sai khiến bị động: have/get + something (O vật) + V3/ed (+ by sb).',
        'Tân ngữ chỉ vật là "its AI learning platform" (hoặc "our AI learning platform").',
        'Phân từ hai của "upgrade" là "upgraded".',
      ],
      structurePattern: 'S(doer) + V + O → S(owner) + had/got + O + V3/ed (+ by doer)',
      grammarReviewNote: 'Unit 6 (Lớp 12) · Thể sai khiến bị động (have/get something done).',
    },
    correctAnswer: 'Our school had its AI learning platform upgraded by the IT department last month.',
    acceptedAnswers: [
      'Our school had its AI learning platform upgraded last month.',
      'Our school had our AI learning platform upgraded by the IT department last month.',
      'Our school had our AI learning platform upgraded last month.',
    ],
    explanation:
      'Thể sai khiến bị động ở quá khứ dùng "had + tân ngữ vật + V3/ed" (had its AI learning platform upgraded).',
  },
  {
    id: 'tf-gs12-u6-2',
    grade: 12,
    unitId: 'gs12-u6',
    unitLabel: 'Unit 6: Artificial Intelligence',
    grammarTopic: 'Active Causative (have sb do sth / get sb to do sth)',
    cognitiveLevel: 'application',
    meta: {
      subtype: 'keyword_unchanged',
      originalSentence: 'The company asked a software engineer to design a customer-service chatbot.',
      instruction: 'Complete the second sentence using GOT. Do not change the word given.',
      givenStart: 'The company',
      givenEnd: 'a customer-service chatbot.',
      keyword: 'GOT',
      keepKeywordUnchanged: true,
      wordLimit: {min: 4, max: 7},
      hints: [
        'Thể sai khiến chủ động với "get": get + someone + to V0.',
        'Động từ quá khứ: "got a software engineer to design".',
        'Kiểm tra số từ: got a software engineer to design (6 từ).',
      ],
      structurePattern: 'ask sb to V ↔ get sb to V',
      grammarReviewNote: 'Unit 6 (Lớp 12) · Thể sai khiến chủ động: have sb V0 vs get sb to V0.',
    },
    correctAnswer: 'The company got a software engineer to design a customer-service chatbot.',
    acceptedAnswers: [],
    explanation:
      'Khác với "have sb + V0", động từ "get" ở thể sai khiến chủ động đi với "to V0" ("got a software engineer to design").',
  },
  {
    id: 'tf-gs12-u7-1',
    grade: 12,
    unitId: 'gs12-u7',
    unitLabel: 'Unit 7: The World of Mass Media',
    grammarTopic: 'Adverbial Clauses of Result (so ... that ↔ such ... that)',
    cognitiveLevel: 'application',
    meta: {
      subtype: 'given_start',
      originalSentence: 'The fake news story was so convincing that thousands of viewers shared it immediately.',
      instruction: 'Rewrite the sentence using "such ... that".',
      givenStart: 'It was such',
      hints: [
        'Cấu trúc: S + be + so + adj + that... ↔ It + be + such + (a/an) + adj + N + that...',
        'Danh từ số ít đếm được "fake news story" cần mạo từ "a": "such a convincing fake news story".',
        'Giữ nguyên mệnh đề kết quả sau "that".',
      ],
      structurePattern: 'S + be + so + adj + that ↔ It + be + such + a/an + adj + N + that',
      grammarReviewNote: 'Unit 7 (Lớp 12) · Mệnh đề trạng ngữ chỉ kết quả với so...that và such...that.',
    },
    correctAnswer: 'It was such a convincing fake news story that thousands of viewers shared it immediately.',
    acceptedAnswers: [
      'It was such a convincing story that thousands of viewers shared it immediately.',
    ],
    explanation:
      'Chuyển "so + adj + that" sang "such + a/an + adj + N + that" (such a convincing fake news story that).',
  },
  {
    id: 'tf-gs12-u7-2',
    grade: 12,
    unitId: 'gs12-u7',
    unitLabel: 'Unit 7: The World of Mass Media',
    grammarTopic: 'Too ... to ↔ Not ... enough to',
    cognitiveLevel: 'comprehension',
    meta: {
      subtype: 'keyword_unchanged',
      originalSentence: 'The online report is too biased to be trusted as a reliable source.',
      instruction: 'Complete the second sentence using ENOUGH. Do not change the word given.',
      givenStart: 'The online report is',
      givenEnd: 'to be trusted as a reliable source.',
      keyword: 'ENOUGH',
      keepKeywordUnchanged: true,
      wordLimit: {min: 3, max: 5},
      hints: [
        'Đổi "too + tính từ tiêu cực (biased)" sang "not + tính từ trái nghĩa (objective / neutral / unbiased) + enough".',
        'Tính từ đứng TRƯỚC "enough".',
        'Ví dụ đúng: "not objective enough" hoặc "not neutral enough" hoặc "not unbiased enough".',
      ],
      structurePattern: 'be too + adj1 + to V ↔ be not + antonym(adj1) + enough + to V',
      grammarReviewNote: 'Unit 7 (Lớp 12) · Cấu trúc too ... to và not ... enough to.',
    },
    correctAnswer: 'The online report is not objective enough to be trusted as a reliable source.',
    acceptedAnswers: [
      'The online report is not unbiased enough to be trusted as a reliable source.',
      'The online report is not neutral enough to be trusted as a reliable source.',
      'The online report is not fair enough to be trusted as a reliable source.',
    ],
    explanation:
      'Chuyển từ "too biased" sang phủ định với tính từ trái nghĩa đứng trước "enough" ("not objective/unbiased/neutral enough").',
  },
  {
    id: 'tf-gs12-u8-1',
    grade: 12,
    unitId: 'gs12-u8',
    unitLabel: 'Unit 8: Wildlife Conservation',
    grammarTopic: 'Adverbial Clauses of Condition (Unless / Provided that)',
    cognitiveLevel: 'application',
    meta: {
      subtype: 'given_start',
      originalSentence: 'Endangered sea turtles will survive only if coastal habitats are strictly protected.',
      instruction: 'Rewrite the sentence using "Provided that".',
      givenStart: 'Provided that',
      hints: [
        '"Provided that" mang nghĩa "miễn là / với điều kiện là" (= if / on condition that).',
        'Đưa mệnh đề điều kiện ("coastal habitats are strictly protected") lên ngay sau "Provided that".',
        'Đặt dấu phẩy trước mệnh đề chính "endangered sea turtles will survive."',
      ],
      structurePattern: 'Main clause + only if + Condition ↔ Provided that + Condition, Main clause',
      grammarReviewNote: 'Unit 8 (Lớp 12) · Mệnh đề trạng ngữ chỉ điều kiện với Provided that / Unless.',
    },
    correctAnswer: 'Provided that coastal habitats are strictly protected, endangered sea turtles will survive.',
    acceptedAnswers: [
      'Provided that coastal habitats are protected strictly, endangered sea turtles will survive.',
    ],
    explanation:
      '"Provided that" dẫn mệnh đề điều kiện ở thì hiện tại đơn, ngăn cách bằng dấu phẩy với mệnh đề chính ở thì tương lai đơn.',
  },
  {
    id: 'tf-gs12-u10-1',
    grade: 12,
    unitId: 'gs12-u10',
    unitLabel: 'Unit 10: Lifelong Learning',
    grammarTopic: 'Reported Speech: Reporting Verbs (advise / remind / warn / offer)',
    cognitiveLevel: 'application',
    meta: {
      subtype: 'given_start',
      originalSentence: '"You should set clear weekly learning goals to stay motivated," the mentor told Hoa.',
      instruction: 'Rewrite the sentence using the reporting verb "advised".',
      givenStart: 'The mentor advised',
      hints: [
        'Cấu trúc động từ tường thuật lời khuyên: advise + someone + (not) to + V0.',
        'Tân ngữ là "Hoa", bỏ "You should".',
        'Giữ nguyên cụm động từ nguyên mẫu "to set clear weekly learning goals to stay motivated."',
      ],
      structurePattern: '"You should + V0," S told O ↔ S advised O to + V0',
      grammarReviewNote: 'Unit 10 (Lớp 12) · Tường thuật lời khuyên, lời nhắc và lời đề nghị bằng to-infinitive.',
    },
    correctAnswer: 'The mentor advised Hoa to set clear weekly learning goals to stay motivated.',
    acceptedAnswers: [],
    explanation:
      'Câu khuyên nhủ "You should + V0" chuyển sang câu tường thuật dùng động từ "advise + O + to V0".',
  },
  {
    id: 'tf-gs12-u10-2',
    grade: 12,
    unitId: 'gs12-u10',
    unitLabel: 'Unit 10: Lifelong Learning',
    grammarTopic: 'Reported Speech: Reporting Verbs (remind / warn / offer)',
    cognitiveLevel: 'application',
    meta: {
      subtype: 'keyword_unchanged',
      originalSentence: '"Don’t forget to update your digital learning portfolio before Friday," said our teacher.',
      instruction: 'Complete the second sentence using REMINDED. Do not change the word given.',
      givenStart: 'Our teacher',
      givenEnd: 'our digital learning portfolio before Friday.',
      keyword: 'REMINDED',
      keepKeywordUnchanged: true,
      wordLimit: {min: 3, max: 5},
      hints: [
        '"Don’t forget to V" diễn tả lời nhắc nhở → dùng cấu trúc "remind + O + to V".',
        'Tân ngữ tương ứng với "our" là "us".',
        'Cụm điền vào chỗ trống gồm 4 từ: "reminded us to update".',
      ],
      structurePattern: '"Don’t forget to V" ↔ remind + O + to V',
      grammarReviewNote: 'Unit 10 (Lớp 12) · Tường thuật lời nhắc nhở với "remind sb to V".',
    },
    correctAnswer: 'Our teacher reminded us to update our digital learning portfolio before Friday.',
    acceptedAnswers: [],
    explanation:
      '"Don’t forget to V" tường thuật bằng động từ "remind + O + to V" ("reminded us to update").',
  },
];

const SEED_TIMESTAMP = 1762100000000;

export const CURATED_TRANSFORMATION_BANK: BankQuestionRecord[] = CURATED_SEEDS.map((seed) => {
  const fullMeta: SentenceTransformationMeta = {
    ...seed.meta,
    grade: seed.grade,
    unitId: seed.unitId,
    grammarTopic: seed.grammarTopic,
    points: seed.points ?? 0.25,
    gradingRules: {
      ...DEFAULT_TRANSFORMATION_GRADING_RULES,
      ...(seed.meta.gradingRules || {}),
    },
    sourceAttribution: TRANSFORMATION_BANK_ATTRIBUTION,
  };

  return {
    id: seed.id,
    grade: seed.grade,
    textbookId: 'global-success',
    unitId: seed.unitId,
    topic: `${seed.unitLabel} · ${seed.grammarTopic}`,
    skill: 'writing',
    cognitiveLevel: seed.cognitiveLevel,
    questionType: 'transformation',
    format: 'transformation',
    prompt: buildTransformationPromptText(fullMeta),
    correctAnswer: seed.correctAnswer,
    acceptedAnswers: seed.acceptedAnswers,
    explanation: seed.explanation,
    points: seed.points ?? 0.25,
    sourceLabel: `Ngân hàng Viết lại câu tự biên soạn · Global Success ${seed.grade} (${seed.unitLabel})`,
    verificationStatus: 'teacher_authored',
    tags: [
      `Lớp ${seed.grade}`,
      seed.unitId,
      'Sentence Transformation',
      seed.grammarTopic,
      seed.meta.subtype,
    ],
    transformation: fullMeta,
    createdAt: SEED_TIMESTAMP,
    updatedAt: SEED_TIMESTAMP,
  };
});

export const UNITS_WITH_TRANSFORMATION_IDS = Array.from(
  new Set(CURATED_TRANSFORMATION_BANK.map((q) => q.unitId)),
);

export function getTransformationsByUnit(unitId: string): BankQuestionRecord[] {
  return CURATED_TRANSFORMATION_BANK.filter((q) => q.unitId === unitId);
}

export function getTransformationsByGrade(grade: HighSchoolGrade): BankQuestionRecord[] {
  return CURATED_TRANSFORMATION_BANK.filter((q) => q.grade === grade);
}

export function getTransformationsByTopicKeywords(keywords: string[]): BankQuestionRecord[] {
  const lowered = keywords.map((k) => k.toLowerCase()).filter(Boolean);
  if (lowered.length === 0) return [];
  return CURATED_TRANSFORMATION_BANK.filter((q) => {
    const haystack = `${q.topic} ${q.transformation?.grammarTopic || ''} ${q.tags.join(' ')}`.toLowerCase();
    return lowered.some((kw) => haystack.includes(kw));
  });
}

export function bankRecordsToQuestionItems(records: BankQuestionRecord[]): QuestionItem[] {
  return records.map((rec, idx) => ({
    id: rec.id,
    number: idx + 1,
    type: 'transformation',
    prompt: rec.prompt,
    correctAnswer: rec.correctAnswer,
    acceptedAnswers: rec.acceptedAnswers,
    explanation: rec.explanation,
    cognitiveLevel: rec.cognitiveLevel,
    tags: rec.tags,
    transformation: rec.transformation,
  }));
}
