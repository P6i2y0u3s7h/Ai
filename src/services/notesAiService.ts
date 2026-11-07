import { streamAiResponse } from './aiClient';

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
  }
};
