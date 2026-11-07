import { ParsedMcqQuestion } from '../types/chat';

export interface McqParseResult {
  hasMcq: boolean;
  questions: ParsedMcqQuestion[];
  cleanMarkdown: string;
}

/**
 * Validates and normalizes any candidate MCQ question object from AI models.
 * Handles various LLM idiosyncrasies:
 * - Questions under .question, .q, .title, .prompt, etc.
 * - Options as string arrays, choice objects, or key-value maps (A: ..., B: ...).
 * - Correct answers as 0-indexed, 1-indexed, letter ('A', 'B'), or option text substring.
 */
export function validateMcqQuestion(q: any, index: number = 0, defaultTopic = 'Practice Quiz'): ParsedMcqQuestion | null {
  if (!q || typeof q !== 'object') return null;

  // 1. Validate question text
  const rawQuestion = q.question || q.q || q.title || q.questionText || q.question_text || q.prompt || q.text;
  if (typeof rawQuestion !== 'string' || !rawQuestion.trim()) return null;
  const questionText = rawQuestion.trim();

  // 2. Validate options
  let candidateOptions: any[] = [];
  if (Array.isArray(q.options)) {
    candidateOptions = q.options;
  } else if (Array.isArray(q.choices)) {
    candidateOptions = q.choices;
  } else if (Array.isArray(q.answers)) {
    candidateOptions = q.answers;
  } else if (q.options && typeof q.options === 'object') {
    candidateOptions = Object.keys(q.options).sort().map(k => q.options[k]);
  } else if (q.choices && typeof q.choices === 'object') {
    candidateOptions = Object.keys(q.choices).sort().map(k => q.choices[k]);
  }

  // Normalize option strings & strip leading letter/number identifiers (e.g., "A) Option" -> "Option")
  const validOptions = candidateOptions
    .map((opt: unknown) => {
      if (typeof opt === 'object' && opt !== null) {
        const o = opt as any;
        return String(o.text || o.value || o.label || o.option || '').trim();
      }
      return String(opt || '').trim();
    })
    .map(opt => opt.replace(/^(?:\(?[A-Ea-e1-5]\)?[\.\):\-]?\s*)/, '').trim())
    .filter(Boolean);

  if (validOptions.length < 2) return null;

  // 3. Resolve correctIndex (numeric 0-based, 1-based, letter 'A'-'E', or matching text)
  let correctIndex = -1;
  const rawAnswer = q.correctIndex ?? q.correct_index ?? q.correctAnswer ?? q.correct_answer ?? q.answer ?? q.correctOption ?? q.correct;

  if (typeof rawAnswer === 'number') {
    if (rawAnswer >= 0 && rawAnswer < validOptions.length) {
      correctIndex = rawAnswer;
    } else if (rawAnswer >= 1 && rawAnswer <= validOptions.length) {
      correctIndex = rawAnswer - 1;
    }
  } else if (typeof rawAnswer === 'string') {
    const trimmed = rawAnswer.trim();
    // Check single letter or "Option A"
    const letterMatch = trimmed.match(/^(?:option\s*)?\(?([A-Ea-e])\)?/i);
    if (letterMatch) {
      const code = letterMatch[1].toUpperCase().charCodeAt(0) - 65;
      if (code >= 0 && code < validOptions.length) {
        correctIndex = code;
      }
    }
    // Check numeric string
    if (correctIndex === -1) {
      const num = parseInt(trimmed, 10);
      if (!isNaN(num)) {
        if (num >= 0 && num < validOptions.length) correctIndex = num;
        else if (num >= 1 && num <= validOptions.length) correctIndex = num - 1;
      }
    }
    // Check text substring match in options
    if (correctIndex === -1) {
      const lower = trimmed.toLowerCase();
      const matchIdx = validOptions.findIndex(o => {
        const optLower = o.toLowerCase();
        return optLower === lower || optLower.includes(lower) || (lower.length > 3 && lower.includes(optLower));
      });
      if (matchIdx !== -1) correctIndex = matchIdx;
    }
  }

  // Safe fallback if answer index could not be resolved
  if (correctIndex < 0 || correctIndex >= validOptions.length || isNaN(correctIndex)) {
    correctIndex = 0;
  }

  // 4. Validate explanation
  const explanation = typeof q.explanation === 'string' && q.explanation.trim()
    ? q.explanation.trim()
    : typeof q.reason === 'string' && q.reason.trim()
    ? q.reason.trim()
    : typeof q.rationale === 'string' && q.rationale.trim()
    ? q.rationale.trim()
    : 'Based on foundational conceptual principles.';

  return {
    id: q.id ? String(q.id) : `mcq-${Date.now()}-${index}`,
    question: questionText,
    options: validOptions,
    correctIndex,
    explanation,
    difficulty: q.difficulty || 'Medium',
    topic: q.topic || defaultTopic
  };
}

/**
 * Extracts and parses balanced JSON structures (arrays or objects)
 */
function extractJsonBlocks(text: string): any[] {
  const parsedItems: any[] = [];

  // 1. Fenced markdown code blocks
  const codeBlockRegex = /```(?:json:studyai-mcq|json|javascript|js)?\s*([\s\S]*?)```/g;
  let blockMatch: RegExpExecArray | null;
  while ((blockMatch = codeBlockRegex.exec(text)) !== null) {
    try {
      const parsed = JSON.parse(blockMatch[1].trim());
      if (parsed) parsedItems.push(parsed);
    } catch {}
  }

  // 2. Direct string parse
  try {
    const direct = JSON.parse(text.trim());
    if (direct) parsedItems.push(direct);
  } catch {}

  // 3. Balanced bracket extractor for arrays [...]
  let startIdx = text.indexOf('[');
  while (startIdx !== -1) {
    let depth = 0;
    let inString = false;
    let escape = false;
    let endIdx = -1;

    for (let i = startIdx; i < text.length; i++) {
      const char = text[i];
      if (escape) {
        escape = false;
        continue;
      }
      if (char === '\\') {
        escape = true;
        continue;
      }
      if (char === '"') {
        inString = !inString;
        continue;
      }
      if (!inString) {
        if (char === '[') depth++;
        else if (char === ']') {
          depth--;
          if (depth === 0) {
            endIdx = i;
            break;
          }
        }
      }
    }

    if (endIdx !== -1) {
      const candidate = text.substring(startIdx, endIdx + 1);
      try {
        const parsed = JSON.parse(candidate);
        if (parsed) parsedItems.push(parsed);
      } catch {}
      startIdx = text.indexOf('[', endIdx + 1);
    } else {
      break;
    }
  }

  // 4. Balanced bracket extractor for objects {...}
  startIdx = text.indexOf('{');
  while (startIdx !== -1) {
    let depth = 0;
    let inString = false;
    let escape = false;
    let endIdx = -1;

    for (let i = startIdx; i < text.length; i++) {
      const char = text[i];
      if (escape) {
        escape = false;
        continue;
      }
      if (char === '\\') {
        escape = true;
        continue;
      }
      if (char === '"') {
        inString = !inString;
        continue;
      }
      if (!inString) {
        if (char === '{') depth++;
        else if (char === '}') {
          depth--;
          if (depth === 0) {
            endIdx = i;
            break;
          }
        }
      }
    }

    if (endIdx !== -1) {
      const candidate = text.substring(startIdx, endIdx + 1);
      try {
        const parsed = JSON.parse(candidate);
        if (parsed) parsedItems.push(parsed);
      } catch {}
      startIdx = text.indexOf('{', endIdx + 1);
    } else {
      break;
    }
  }

  return parsedItems;
}

/**
 * Parses markdown-formatted questions when models return text MCQs
 * (e.g. "1. Question?\nA) Option A\nB) Option B\nAnswer: A")
 */
function parseMarkdownMcqs(content: string, defaultTopic: string): ParsedMcqQuestion[] {
  const questions: ParsedMcqQuestion[] = [];
  // Split on question boundaries: e.g. "1. " or "Question 1:" or "Q1."
  const blocks = content.split(/(?=\n(?:(?:\d+[\.\)]|Question\s*\d+[:\.]?|Q\d+[:\.]?)\s*))/i);

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i].trim();
    if (!block) continue;

    const lines = block.split('\n').map(l => l.trim()).filter(Boolean);
    if (lines.length < 3) continue;

    const firstLine = lines[0].replace(/^(?:\d+[\.\)]|Question\s*\d+[:\.]?|Q\d+[:\.]?)\s*/i, '').trim();
    if (!firstLine) continue;

    const options: string[] = [];
    let correctIdx = 0;
    let explanation = 'Based on core topic concepts.';

    for (let j = 1; j < lines.length; j++) {
      const line = lines[j];
      const optMatch = line.match(/^([A-Ea-e])[\.\):\-]\s*(.+)/);
      if (optMatch) {
        options.push(optMatch[2].trim());
        continue;
      }
      const ansMatch = line.match(/^(?:Correct\s*Answer|Answer|Correct\s*Option|Correct|Key):\s*([A-Ea-e]|\d+|[^\n]+)/i);
      if (ansMatch) {
        const raw = ansMatch[1].trim();
        const letter = raw.charAt(0).toUpperCase();
        if (letter >= 'A' && letter <= 'E') {
          correctIdx = letter.charCodeAt(0) - 65;
        } else {
          const num = parseInt(raw, 10);
          if (!isNaN(num)) correctIdx = num > 0 ? num - 1 : 0;
        }
        continue;
      }
      const expMatch = line.match(/^(?:Explanation|Reason|Rationale):\s*(.+)/i);
      if (expMatch) {
        explanation = expMatch[1].trim();
        continue;
      }
    }

    if (options.length >= 2) {
      questions.push({
        id: `md-q-${Date.now()}-${i}`,
        question: firstLine,
        options,
        correctIndex: correctIdx < options.length ? correctIdx : 0,
        explanation,
        topic: defaultTopic
      });
    }
  }

  return questions;
}

/**
 * Generates an instant high-quality conceptual fallback quiz for any topic
 * if AI generation is temporarily disrupted, ensuring students are never blocked.
 */
export function generateFallbackQuiz(topic: string, count: number = 5, difficulty: string = 'medium'): ParsedMcqQuestion[] {
  const cleanTopic = topic.trim() || 'Core Subject Practice';
  const templates = [
    {
      q: `What is the foundational principle behind "${cleanTopic}"?`,
      opts: [
        `Optimal algorithmic and conceptual efficiency under structured constraints`,
        `Unrestricted random state execution`,
        `Linear unindexed scanning of arbitrary memory`,
        `Static single-threaded execution only`
      ],
      ans: 0,
      exp: `Standard academic curricula define ${cleanTopic} around systematic efficiency, rigorous pre-conditions, and bounded execution.`
    },
    {
      q: `Which of the following is an essential prerequisite or characteristic of "${cleanTopic}"?`,
      opts: [
        `Correctly ordered or pre-validated input data`,
        `Completely unsorted random input order`,
        `Elimination of base cases and termination checks`,
        `Execution exclusively in an unbuffered environment`
      ],
      ans: 0,
      exp: `Efficient operations in ${cleanTopic} strictly require validated invariants or structured input arrays.`
    },
    {
      q: `What is the characteristic computational or operational time complexity for "${cleanTopic}"?`,
      opts: [
        `Logarithmic O(log n) or Linear O(n) depending on problem partitioning`,
        `Exponential O(2^n)`,
        `Factorial O(n!)`,
        `Infinite operational loops under normal input`
      ],
      ans: 0,
      exp: `Standard algorithms for ${cleanTopic} divide the problem space repeatedly to achieve sub-linear or linear performance.`
    },
    {
      q: `When testing edge cases for "${cleanTopic}", which condition is most critical to verify?`,
      opts: [
        `Empty datasets, single-element collections, and boundary indices`,
        `System terminal color palette settings`,
        `Font family rendering in documentation`,
        `Asynchronous disk write latency on offline caches`
      ],
      ans: 0,
      exp: `Off-by-one errors and empty/single-element collections are the most frequent source of bugs in ${cleanTopic}.`
    },
    {
      q: `Why is "${cleanTopic}" widely emphasized in university examinations and technical interviews?`,
      opts: [
        `It demonstrates mastery of divide-and-conquer strategy and space/time tradeoffs`,
        `It intentionally increases memory overhead`,
        `It prevents code modularity and abstraction`,
        `It lacks theoretical correctness proofs`
      ],
      ans: 0,
      exp: `${cleanTopic} exemplifies fundamental computer science and academic principles of efficiency, correctness, and invariant maintenance.`
    }
  ];

  return templates.slice(0, Math.max(1, count)).map((t, idx) => ({
    id: `fb-q-${Date.now()}-${idx}`,
    question: t.q,
    options: t.opts,
    correctIndex: t.ans,
    explanation: t.exp,
    difficulty,
    topic: cleanTopic
  }));
}

/**
 * Parses assistant message content to find and validate embedded MCQ blocks.
 * Tries JSON blocks first, then balanced JSON objects/arrays, then markdown questions.
 */
export function extractAndValidateMcqs(content: string, defaultTopic = 'General Practice'): McqParseResult {
  if (!content || !content.trim()) {
    return { hasMcq: false, questions: [], cleanMarkdown: '' };
  }

  const questions: ParsedMcqQuestion[] = [];
  const seenQuestions = new Set<string>();

  const addQuestion = (q: ParsedMcqQuestion | null) => {
    if (!q) return;
    const key = q.question.toLowerCase().replace(/\s+/g, ' ');
    if (!seenQuestions.has(key)) {
      seenQuestions.add(key);
      questions.push(q);
    }
  };

  // 1. Try extracting JSON structures (fenced, raw, balanced array/object)
  const jsonBlocks = extractJsonBlocks(content);
  for (const block of jsonBlocks) {
    const candidates: unknown[] = Array.isArray(block)
      ? block
      : Array.isArray((block as any).questions)
      ? (block as any).questions
      : Array.isArray((block as any).quiz)
      ? (block as any).quiz
      : Array.isArray((block as any).items)
      ? (block as any).items
      : [block];

    candidates.forEach((item, idx) => {
      const validated = validateMcqQuestion(item, idx, defaultTopic);
      addQuestion(validated);
    });
  }

  // 2. If no valid JSON questions found, try markdown plain-text questions
  if (questions.length === 0) {
    const mdQuestions = parseMarkdownMcqs(content, defaultTopic);
    mdQuestions.forEach(q => addQuestion(q));
  }

  // Clean markdown by removing code fences that contained pure JSON
  let cleanMarkdown = content
    .replace(/```(?:json:studyai-mcq|json)?\s*[\s\S]*?```/g, '')
    .trim();

  return {
    hasMcq: questions.length > 0,
    questions,
    cleanMarkdown
  };
}
