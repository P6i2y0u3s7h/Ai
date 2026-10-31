import { ParsedMcqQuestion } from '../types/chat';

export interface McqParseResult {
  hasMcq: boolean;
  questions: ParsedMcqQuestion[];
  cleanMarkdown: string;
}

/**
 * Validates a candidate MCQ question object
 */
export function validateMcqQuestion(q: any, index: number = 0): ParsedMcqQuestion | null {
  if (!q || typeof q !== 'object') return null;

  // 1. Validate question text
  if (typeof q.question !== 'string' || !q.question.trim()) return null;

  // 2. Validate options (must be array of strings, at least 2, default 4)
  if (!Array.isArray(q.options) || q.options.length < 2) return null;
  const validOptions = (q.options as unknown[]).map((opt: unknown) => String(opt || '').trim()).filter(Boolean);
  if (validOptions.length !== q.options.length) return null;

  // 3. Validate correctIndex
  const correctIndex = Number(q.correctIndex);
  if (isNaN(correctIndex) || correctIndex < 0 || correctIndex >= validOptions.length) {
    return null;
  }

  // 4. Validate explanation
  const explanation = typeof q.explanation === 'string' && q.explanation.trim()
    ? q.explanation.trim()
    : 'No explanation provided.';

  return {
    id: q.id ? String(q.id) : `mcq-${Date.now()}-${index}`,
    question: q.question.trim(),
    options: validOptions,
    correctIndex,
    explanation,
    difficulty: q.difficulty || 'Medium',
    topic: q.topic || 'General Practice'
  };
}

/**
 * Parses assistant message content to find and validate embedded MCQ blocks
 */
export function extractAndValidateMcqs(content: string): McqParseResult {
  if (!content) {
    return { hasMcq: false, questions: [], cleanMarkdown: '' };
  }

  // Pattern 1: Look for ```json:studyai-mcq ... ``` or ```json ... ``` with questions array
  const jsonBlockRegex = /```(?:json:studyai-mcq|json)?\s*([\s\S]*?)\s*```/g;
  let match: RegExpExecArray | null;
  const questions: ParsedMcqQuestion[] = [];
  let cleanMarkdown = content;

  while ((match = jsonBlockRegex.exec(content)) !== null) {
    const rawBlock = match[1];
    try {
      const parsed = JSON.parse(rawBlock);
      const candidateList: unknown[] = Array.isArray(parsed)
        ? parsed
        : Array.isArray((parsed as any).questions)
        ? (parsed as any).questions
        : [parsed];

      let blockValid = false;
      candidateList.forEach((item: unknown, idx: number) => {
        const validated = validateMcqQuestion(item, idx);
        if (validated) {
          questions.push(validated);
          blockValid = true;
        }
      });

      if (blockValid) {
        // Remove the parsed JSON block from the readable markdown
        cleanMarkdown = cleanMarkdown.replace(match[0], '').trim();
      }
    } catch {
      // Not valid JSON, leave as markdown
    }
  }

  return {
    hasMcq: questions.length > 0,
    questions,
    cleanMarkdown
  };
}
