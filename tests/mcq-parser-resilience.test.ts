import test from 'node:test';
import assert from 'node:assert/strict';
import { extractAndValidateMcqs, validateMcqQuestion, generateFallbackQuiz } from '../src/utils/mcqParser';

test('MCQ Parser Resilience & Multi-Format Parsing Tests', async (t) => {
  await t.test('1. Trailing brackets & commentary: Prevents greedy regex syntax errors', () => {
    const raw = `
\`\`\`json:studyai-mcq
{
  "questions": [
    {
      "id": "mcq-1",
      "question": "What is the worst-case time complexity of binary search on a sorted array of size n?",
      "options": ["O(1)", "O(log n)", "O(n)", "O(n log n)"],
      "correctIndex": 1,
      "explanation": "Binary search halves search space each iteration.",
      "difficulty": "medium"
    }
  ]
}
\`\`\`

Here is a summary:
Binary search operates on sorted arrays like [1, 3, 5, 7, 9]. Notice that [O(n)] is for linear search.
`;
    const res = extractAndValidateMcqs(raw, 'Binary Search');
    assert.equal(res.hasMcq, true);
    assert.equal(res.questions.length, 1);
    assert.equal(res.questions[0].correctIndex, 1);
    assert.equal(res.questions[0].options[1], 'O(log n)');
  });

  await t.test('2. Raw JSON array without code blocks', () => {
    const raw = `[
      {
        "id": "q1",
        "question": "What is the prerequisite for binary search?",
        "options": ["Sorted array", "Linked list", "Unsorted array", "Hash table"],
        "correctIndex": 0,
        "explanation": "Array elements must be sorted."
      }
    ]`;
    const res = extractAndValidateMcqs(raw, 'Binary Search');
    assert.equal(res.hasMcq, true);
    assert.equal(res.questions.length, 1);
    assert.equal(res.questions[0].options[0], 'Sorted array');
  });

  await t.test('3. Variations in option keys and answer representations (choices & letter answers)', () => {
    const raw = `
\`\`\`json
[
  {
    "question": "Which searching algorithm works by repeatedly dividing in half?",
    "choices": ["Linear Search", "Binary Search", "Jump Search", "Exponential Search"],
    "correctAnswer": "B",
    "reason": "Binary Search repeatedly divides the array in half."
  }
]
\`\`\`
`;
    const res = extractAndValidateMcqs(raw, 'Binary Search');
    assert.equal(res.hasMcq, true);
    assert.equal(res.questions.length, 1);
    assert.equal(res.questions[0].correctIndex, 1); // 'B' -> index 1
    assert.equal(res.questions[0].explanation, 'Binary Search repeatedly divides the array in half.');
  });

  await t.test('4. Plain markdown text questions: Parses standard numbered MCQs without JSON', () => {
    const raw = `
1. What is the average time complexity of binary search?
A) O(1)
B) O(log n)
C) O(n)
D) O(n log n)
Answer: B
Explanation: Binary search cuts the problem size in half each step.

2. Which data structure is NOT suitable for binary search?
A) Array
B) Vector
C) Singly Linked List
D) Sorted slice
Correct: C
Explanation: Linked lists do not provide O(1) random access by index.
`;
    const res = extractAndValidateMcqs(raw, 'Binary Search');
    assert.equal(res.hasMcq, true);
    assert.equal(res.questions.length, 2);
    assert.equal(res.questions[0].correctIndex, 1);
    assert.equal(res.questions[1].correctIndex, 2);
  });

  await t.test('5. Fallback quiz generation: Always yields high-yield questions for any topic', () => {
    const questions = generateFallbackQuiz('binary search', 5, 'medium');
    assert.equal(questions.length, 5);
    assert.ok(questions[0].question.includes('binary search'));
    assert.equal(questions[0].options.length, 4);
    assert.equal(typeof questions[0].correctIndex, 'number');
  });
});

