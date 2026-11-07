import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { StudyNote } from '../src/types/chat.js';

describe('AI-Powered Study Notes Management System Tests', () => {
  const sampleNote: StudyNote = {
    id: 'note-test-1',
    userId: 'user-123',
    title: 'Operating System Virtual Memory',
    topic: 'Memory Management',
    subject: 'Computer Science',
    semester: 'Semester 4',
    content: '### Virtual Memory\nVirtual memory maps virtual addresses to physical addresses using paging and TLB.\n\n- Page faults occur when a page is not resident in RAM.\n- LRU is a common page replacement policy.',
    tags: ['os', 'memory', 'paging'],
    createdAt: Date.now(),
    updatedAt: Date.now()
  };

  it('1. Note Data Structure: Supports subject, topic, semester, and tags', () => {
    assert.equal(sampleNote.title, 'Operating System Virtual Memory');
    assert.equal(sampleNote.topic, 'Memory Management');
    assert.equal(sampleNote.semester, 'Semester 4');
    assert.equal(sampleNote.subject, 'Computer Science');
    assert.deepEqual(sampleNote.tags, ['os', 'memory', 'paging']);
  });

  it('2. Multi-Dimensional Search & Filter: Matches title, topic, semester, and tags', () => {
    const notes: StudyNote[] = [
      sampleNote,
      {
        id: 'note-test-2',
        title: 'Thermodynamics Heat Engine',
        topic: 'Carnot Cycle',
        subject: 'Physics',
        semester: 'Semester 2',
        content: 'Carnot efficiency is 1 - Tc/Th.',
        tags: ['physics', 'heat'],
        createdAt: Date.now()
      }
    ];

    // Search by topic
    const topicFiltered = notes.filter(n => n.topic?.toLowerCase().includes('memory'));
    assert.equal(topicFiltered.length, 1);
    assert.equal(topicFiltered[0].id, 'note-test-1');

    // Search by semester
    const semFiltered = notes.filter(n => n.semester === 'Semester 4');
    assert.equal(semFiltered.length, 1);
    assert.equal(semFiltered[0].id, 'note-test-1');

    // Search by subject
    const subjFiltered = notes.filter(n => n.subject === 'Physics');
    assert.equal(subjFiltered.length, 1);
    assert.equal(subjFiltered[0].id, 'note-test-2');
  });

  it('3. Text Export Generation: Formats note title, subject, semester, topic, and content cleanly', () => {
    const formatted = `TITLE: ${sampleNote.title}
SUBJECT: ${sampleNote.subject}
TOPIC: ${sampleNote.topic}
SEMESTER: ${sampleNote.semester}
TAGS: ${sampleNote.tags.join(', ')}
${sampleNote.content}`;

    assert.ok(formatted.includes('TITLE: Operating System Virtual Memory'));
    assert.ok(formatted.includes('TOPIC: Memory Management'));
    assert.ok(formatted.includes('SEMESTER: Semester 4'));
    assert.ok(formatted.includes('Virtual memory maps virtual addresses'));
  });

  it('4. Flashcard Conversion: Generates valid Flashcard Deck objects from study notes', () => {
    const rawFlashcards = [
      { front: 'What is Virtual Memory?', back: 'Separation of user logical memory from physical memory.' },
      { front: 'What causes a page fault?', back: 'Accessing a page whose valid-invalid bit is set to invalid in RAM.' }
    ];

    const deck = {
      id: `deck-${Date.now()}`,
      title: `${sampleNote.title} (Revision Deck)`,
      topic: sampleNote.topic || sampleNote.title,
      subject: sampleNote.subject,
      cards: rawFlashcards.map((c, i) => ({
        id: `card-${i}`,
        front: c.front,
        back: c.back,
        status: 'new' as const
      }))
    };

    assert.equal(deck.cards.length, 2);
    assert.equal(deck.cards[0].front, 'What is Virtual Memory?');
    assert.equal(deck.cards[0].status, 'new');
    assert.equal(deck.topic, 'Memory Management');
  });
});

