import { streamAiResponse } from './aiClient';
import { extractAndValidateMcqs, generateFallbackQuiz } from '../utils/mcqParser';

export interface GeneratedQuestions {
  mcqs: Array<{
    question: string;
    options: string[];
    answer: string;
    explanation: string;
  }>;
  shortQuestions: Array<{
    question: string;
    answer: string;
  }>;
  longQuestions: Array<{
    question: string;
    keyPoints: string[];
  }>;
}

export interface GeneratedFlashcard {
  front: string;
  back: string;
}

export const notesAiService = {
  /**
   * Generates comprehensive, curriculum-grade study notes for any topic
   */
  async generateNotes(topic: string, subject = 'General', semester = 'All Semesters'): Promise<string> {
    const prompt = `You are StudyAI. Create comprehensive, curriculum-grade study notes on the topic "${topic}" for the subject "${subject}" (${semester}).
Structure the output in clean, readable GitHub-Flavored Markdown:
1. **Executive Overview & Formal Definition**
2. **Key Concepts, Principles & Formulas**
3. **Structured Bullet Points & Comparisons**
4. **Real-World Examples & Applications**
5. **Common Pitfalls, Edge Cases & Exam Tips**
6. **Quick Self-Check Review Points**
Make it detailed, clear, and high-yield for university exams.`;

    let result = '';
    await streamAiResponse({
      messages: [{ role: 'user', content: prompt }],
      studyMode: 'study',
      onChunk: (_delta, fullText) => {
        result = fullText;
      }
    });

    return result.trim();
  },

  /**
   * Summarizes lengthy study notes into concise, easy-to-understand executive takeaways
   */
  async summarizeNote(title: string, content: string): Promise<string> {
    const prompt = `You are StudyAI. Summarize the following study note ("${title}") into easy-to-understand, high-retention revision content.

Original Note Content:
"""
${content.slice(0, 4000)}
"""

Please provide:
1. **Executive 2-Sentence Summary**
2. **5 Key Takeaways (Bullet Points)**
3. **Must-Remember Terms & Formulas**
4. **Quick Memory Anchor (Analogy/Mnemonic)**`;

    let result = '';
    await streamAiResponse({
      messages: [{ role: 'user', content: prompt }],
      studyMode: 'general',
      onChunk: (_delta, fullText) => {
        result = fullText;
      }
    });

    return result.trim();
  },

  /**
   * Explains difficult concepts in simple English (ELI5) or conversational Hinglish
   */
  async explainConcept(title: string, content: string, language: 'english' | 'hinglish'): Promise<string> {
    const isHinglish = language === 'hinglish';
    const prompt = isHinglish
      ? `You are StudyAI, a friendly academic mentor. Explain the difficult concepts in this study note ("${title}") in conversational Hinglish (Hindi + English in Roman script).
Keep all technical terms and formulas in standard English, but explain the core intuition, analogies, and logic in conversational Roman Hindi.

Note content:
"""
${content.slice(0, 3500)}
"""`
      : `You are StudyAI. Explain the difficult concepts in this study note ("${title}") in simple, accessible English (ELI5 style).
Avoid dense academic jargon, use relatable everyday analogies, and break down complex ideas step-by-step.

Note content:
"""
${content.slice(0, 3500)}
"""`;

    let result = '';
    await streamAiResponse({
      messages: [{ role: 'user', content: prompt }],
      studyMode: 'study',
      options: { language },
      onChunk: (_delta, fullText) => {
        result = fullText;
      }
    });

    return result.trim();
  },

  /**
   * Generates MCQs, 2-mark short questions, and 5-mark long questions from notes
   */
  async generateQuestions(title: string, content: string): Promise<GeneratedQuestions> {
    const prompt = `You are an expert university examiner. Analyze the study note titled "${title}" and generate an exam question paper.
Return the output strictly inside a JSON block with language tag \`\`\`json:study-questions\`\`\` in this exact format:
\`\`\`json:study-questions
{
  "mcqs": [
    {
      "question": "Question text?",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "answer": "Option A",
      "explanation": "Why this is correct."
    }
  ],
  "shortQuestions": [
    {
      "question": "Define/Explain X (2 Marks)?",
      "answer": "Concise model answer (2-3 sentences)."
    }
  ],
  "longQuestions": [
    {
      "question": "Discuss and elaborate on Y with diagrams/steps (5-10 Marks)?",
      "keyPoints": ["Point 1", "Point 2", "Point 3", "Point 4"]
    }
  ]
}
\`\`\`

Note content:
"""
${content.slice(0, 4000)}
"""`;

    let rawOutput = '';
    await streamAiResponse({
      messages: [{ role: 'user', content: prompt }],
      studyMode: 'exam',
      onChunk: (_delta, fullText) => {
        rawOutput = fullText;
      }
    });

    // Extract JSON block
    try {
      const match = rawOutput.match(/```(?:json:study-questions|json)?\s*([\s\S]*?)\s*```/);
      const jsonStr = match ? match[1] : rawOutput.slice(rawOutput.indexOf('{'), rawOutput.lastIndexOf('}') + 1);
      const parsed = JSON.parse(jsonStr);
      return {
        mcqs: Array.isArray(parsed.mcqs) ? parsed.mcqs : [],
        shortQuestions: Array.isArray(parsed.shortQuestions) ? parsed.shortQuestions : [],
        longQuestions: Array.isArray(parsed.longQuestions) ? parsed.longQuestions : []
      };
    } catch {
      // Fallback structured generation
      return {
        mcqs: [
          {
            question: `What is the core focus of ${title}?`,
            options: ['Core concept', 'Unrelated detail', 'Historical side-note', 'None of the above'],
            answer: 'Core concept',
            explanation: `Based on the key findings in ${title}.`
          }
        ],
        shortQuestions: [
          {
            question: `Explain the fundamental principle of ${title}.`,
            answer: content.slice(0, 200) + '...'
          }
        ],
        longQuestions: [
          {
            question: `Analyze and evaluate the primary themes discussed in ${title}.`,
            keyPoints: ['Key principle definition', 'Mechanism of operation', 'Practical applications', 'Evaluation & edge cases']
          }
        ]
      };
    }
  },

  /**
   * Converts study notes into revision flashcards
   */
  async generateFlashcards(title: string, content: string): Promise<GeneratedFlashcard[]> {
    const prompt = `You are StudyAI. Convert this study note ("${title}") into 5-8 high-yield revision flashcards.
Output strictly inside a JSON block with tag \`\`\`json:flashcards\`\`\` in this exact format:
\`\`\`json:flashcards
[
  {
    "front": "Clear question, term, or formula to test",
    "back": "Crisp, memorable answer or definition"
  }
]
\`\`\`

Note content:
"""
${content.slice(0, 4000)}
"""`;

    let rawOutput = '';
    await streamAiResponse({
      messages: [{ role: 'user', content: prompt }],
      studyMode: 'study',
      onChunk: (_delta, fullText) => {
        rawOutput = fullText;
      }
    });

    try {
      const match = rawOutput.match(/```(?:json:flashcards|json)?\s*([\s\S]*?)\s*```/);
      const jsonStr = match ? match[1] : rawOutput.slice(rawOutput.indexOf('['), rawOutput.lastIndexOf(']') + 1);
      const parsed = JSON.parse(jsonStr);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map((item: any) => ({
          front: String(item.front || item.question || '').trim(),
          back: String(item.back || item.answer || '').trim()
        })).filter(c => c.front && c.back);
      }
    } catch {
      // Fallback
    }

    return [
      {
        front: `What is ${title}?`,
        back: content.slice(0, 150) + '...'
      }
    ];
  },

  /**
   * Generates a full set of exam-grade QuizQuestions directly from a note
   */
  async generateQuizFromNote(title: string, content: string, count = 5): Promise<Array<{
    id: string;
    question: string;
    options: string[];
    correctIndex: number;
    explanation: string;
  }>> {
    const prompt = `You are StudyAI. Generate exactly ${count} multiple-choice exam questions based directly on this study note: "${title}".
Output in validated JSON block using tag 'json:studyai-mcq':
\`\`\`json:studyai-mcq
{
  "questions": [
    {
      "id": "q1",
      "question": "Clear conceptual question?",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctIndex": 0,
      "explanation": "Why this answer is correct and others are incorrect."
    }
  ]
}
\`\`\`

Note Content:
"""
${content.slice(0, 4000)}
"""`;

    let rawOutput = '';
    try {
      await streamAiResponse({
        messages: [{ role: 'user', content: prompt }],
        studyMode: 'mcq',
        onChunk: (_delta, fullText) => {
          rawOutput = fullText;
        }
      });
    } catch (err) {
      console.warn('Note quiz generation stream interrupted:', err);
    }

    if (rawOutput) {
      const parsed = extractAndValidateMcqs(rawOutput, title);
      if (parsed.hasMcq && parsed.questions.length > 0) {
        return parsed.questions.map(q => ({
          id: q.id,
          question: q.question,
          options: q.options,
          correctIndex: q.correctIndex,
          explanation: q.explanation
        }));
      }
    }

    // High quality curriculum fallback
    return generateFallbackQuiz(title, count, 'medium').map(q => ({
      id: q.id,
      question: q.question,
      options: q.options,
      correctIndex: q.correctIndex,
      explanation: q.explanation
    }));
  },

  /**
   * Summarizes arbitrary text with key points and definitions
   */
  async summarizeText(text: string): Promise<string> {
    const prompt = `You are StudyAI Summarizer. Analyze the text below and provide a structured, high-yield summary:
1. **Executive Overview (2 sentences)**
2. **Key Takeaways (5 bullet points)**
3. **Core Definitions & Formulas**
4. **Important Review Questions**

Text:
"""
${text.slice(0, 5000)}
"""`;

    let result = '';
    await streamAiResponse({
      messages: [{ role: 'user', content: prompt }],
      studyMode: 'general',
      onChunk: (_delta, fullText) => {
        result = fullText;
      }
    });

    return result.trim();
  },

  /**
   * Explains any topic step by step with real-world examples in English or Hinglish
   */
  async explainTopic(topic: string, subject = 'General', language: 'english' | 'hinglish' = 'english'): Promise<string> {
    const isHinglish = language === 'hinglish';
    const prompt = isHinglish
      ? `You are StudyAI Topic Explainer. Explain "${topic}" (Subject: ${subject}) in friendly conversational Hinglish (Hindi + English in Roman script).
Structure:
1. **Easy Intuition & What it is (Aasan Bhasha Mein)**
2. **Step-by-Step Working & Core Logic**
3. **Real-Life Example (Asli Duniya Ka Example)**
4. **Exam Questions & Common Confusions (Dhyan Rakhne Wali Baatein)**
Keep technical terms in English, explanations in friendly Roman Hindi.`
      : `You are StudyAI Topic Explainer. Explain "${topic}" (Subject: ${subject}) clearly step-by-step.
Structure:
1. **Intuitive Overview (ELI5)**
2. **Step-by-Step Deep Dive**
3. **Real-World Practical Example & Analogy**
4. **Key Equations / Principles**
5. **Common Mistakes & Exam Pro-Tips**`;

    let result = '';
    await streamAiResponse({
      messages: [{ role: 'user', content: prompt }],
      studyMode: 'study',
      onChunk: (_delta, fullText) => {
        result = fullText;
      }
    });

    return result.trim();
  },

  /**
   * Explains code line by line, identifies bugs, and provides corrected examples
   */
  async explainCode(code: string, language = 'General Programming'): Promise<string> {
    const prompt = `You are StudyAI Code Explainer. Analyze the following code (${language}):
1. **High-Level Purpose & Algorithm**
2. **Line-by-Line Breakdown**
3. **Time & Space Complexity Analysis**
4. **Potential Bugs, Edge Cases & Performance Bottlenecks**
5. **Clean / Optimized Code Solution with Comments**

Code:
\`\`\`
${code.slice(0, 4000)}
\`\`\``;

    let result = '';
    await streamAiResponse({
      messages: [{ role: 'user', content: prompt }],
      studyMode: 'study',
      onChunk: (_delta, fullText) => {
        result = fullText;
      }
    });

    return result.trim();
  },

  /**
   * Generates AI performance analytics and personalized study recommendations
   */
  async analyzePerformance(sessions: any[]): Promise<string> {
    const summaryData = sessions.slice(0, 10).map(s => ({
      title: s.title,
      subject: s.subject || 'General',
      score: `${s.score}/${s.total}`,
      pct: Math.round((s.score / s.total) * 100),
      date: new Date(s.date).toLocaleDateString()
    }));

    const prompt = `You are StudyAI Academic Performance Advisor. Based on the student's recent quiz performance data:
${JSON.stringify(summaryData, null, 2)}

Provide an encouraging, data-backed academic performance analysis:
1. **Overall Performance Diagnostic**
2. **Identified Strong Topics (Keep it up)**
3. **Identified Weak Topics Needing Revision**
4. **Targeted 3-Step Study Plan for Improvement**
5. **Recommended Revision Technique (Active Recall, Spaced Repetition)**
Keep it motivational, structured, and practical for university exams.`;

    let result = '';
    await streamAiResponse({
      messages: [{ role: 'user', content: prompt }],
      studyMode: 'general',
      onChunk: (_delta, fullText) => {
        result = fullText;
      }
    });

    return result.trim();
  }
};

