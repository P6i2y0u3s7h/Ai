import React, { useState, useRef } from 'react';
import {
  FileText,
  X,
  UploadCloud,
  Trash2,
  MessageSquare,
  AlertCircle,
  Loader2,
  BookOpen,
  Sparkles,
  FileQuestion,
  FileCheck2,
  ArrowRight
} from 'lucide-react';
import { useChat } from '../../context/ChatContext';
import { StudyDocument } from '../../types/chat';

export const DocumentsModal: React.FC = () => {
  const {
    activeModal,
    setActiveModal,
    documents,
    uploadDocument,
    deleteDocument,
    activeDocumentId,
    setActiveDocumentId,
    sendMessage,
    setStudyMode,
    showToast
  } = useChat();

  const [isDragging, setIsDragging] = useState(false);
  const [selectedPagePromptDoc, setSelectedPagePromptDoc] = useState<StudyDocument | null>(null);
  const [targetPageInput, setTargetPageInput] = useState<string>('1');
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (activeModal !== 'documents') return null;

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!file.name.toLowerCase().endsWith('.pdf') && file.type !== 'application/pdf') {
        showToast(`Skipped "${file.name}": Only PDF documents are supported.`);
        continue;
      }
      try {
        await uploadDocument(file);
      } catch (err: any) {
        // Error state handled inside uploadDocument
      }
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (!files || files.length === 0) return;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!file.name.toLowerCase().endsWith('.pdf')) {
        showToast(`Skipped "${file.name}": Only PDF documents are supported.`);
        continue;
      }
      try {
        await uploadDocument(file);
      } catch {}
    }
  };

  // Quick Study Actions with Document Grounding
  const handleQuickAction = (
    doc: StudyDocument,
    action: 'summarize' | 'mcq' | 'notes' | 'chat'
  ) => {
    setActiveDocumentId(doc.id);
    setActiveModal(null);
    setStudyMode('pdf');

    let prompt = '';
    switch (action) {
      case 'summarize':
        prompt = `Please summarize the uploaded document "${doc.name}" with a structured executive overview, core definitions, and key takeaways citing exact page numbers.`;
        break;
      case 'mcq':
        prompt = `Generate 5 exam-level Multiple Choice Questions based strictly on the uploaded document "${doc.name}". Include 4 options per question, verified correct answers, and exact page citations.`;
        break;
      case 'notes':
        prompt = `Create comprehensive exam revision notes from "${doc.name}": list core definitions, essential formulas/theorems, and flashcards with page references.`;
        break;
      case 'chat':
        prompt = `I am studying "${doc.name}". What are the main topics and concepts covered in this document?`;
        break;
    }

    sendMessage(prompt, undefined, undefined, 'pdf', {
      documentId: doc.id,
      documentName: doc.name
    });
  };

  const handleExplainSpecificPage = () => {
    if (!selectedPagePromptDoc) return;
    const pageNum = parseInt(targetPageInput, 10);
    if (isNaN(pageNum) || pageNum < 1) {
      showToast('Please enter a valid page number.');
      return;
    }

    const doc = selectedPagePromptDoc;
    setSelectedPagePromptDoc(null);
    setActiveDocumentId(doc.id);
    setActiveModal(null);
    setStudyMode('pdf');

    const prompt = `Please explain page ${pageNum} of "${doc.name}" in detail. Break down the key concepts, formulas, and definitions on this specific page.`;
    sendMessage(prompt, undefined, undefined, 'pdf', {
      documentId: doc.id,
      documentName: doc.name
    });
  };

  return (
    <div className="fixed inset-0 z-[60] w-screen h-screen bg-[#0A0A0A] flex flex-col overflow-hidden select-none">
      <div className="w-full h-full bg-[#0A0A0A] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#262626] bg-[#0D0D0D]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-[#141414] text-white border border-[#262626]">
              <FileText size={18} />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white">Study Documents & PDFs</h2>
              <p className="text-xs text-[#A1A1AA]">
                Upload PDFs for verified page-referenced learning, summaries, and MCQs
              </p>
            </div>
          </div>
          <button
            onClick={() => setActiveModal(null)}
            className="p-1.5 text-[#A1A1AA] hover:text-white rounded-lg hover:bg-[#1C1C1C] transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Inner Centered Scrollable Area */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-4xl mx-auto w-full">
            {/* Upload Dropzone */}
            <div className="p-4 sm:p-5 border-b border-[#262626]">
              <input
                type="file"
                ref={fileInputRef}
            onChange={handleFileUpload}
            multiple
            accept=".pdf,application/pdf"
            className="hidden"
          />
          <div
            onClick={() => fileInputRef.current?.click()}
            onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            className={`border border-dashed rounded-2xl p-5 sm:p-6 text-center cursor-pointer transition-all ${
              isDragging
                ? 'border-white bg-[#1C1C1C]'
                : 'border-[#262626] hover:border-zinc-400 bg-[#141414] hover:bg-[#1C1C1C]'
            } group`}
          >
            <UploadCloud
              size={28}
              className="mx-auto mb-2 text-[#A1A1AA] group-hover:text-white transition-colors"
            />
            <p className="text-xs sm:text-sm font-semibold text-white">
              Drop your syllabus, textbook, or lecture note PDF here
            </p>
            <p className="text-[11px] text-[#71717A] mt-1">
              Supports searchable PDFs up to 25 MB • Page references preserved automatically
            </p>
          </div>
        </div>

        {/* Documents List */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3">
          <div className="flex items-center justify-between text-[11px] font-semibold text-[#71717A] uppercase tracking-wider mb-1">
            <span>Uploaded Files ({documents.length})</span>
            {activeDocumentId && (
              <span className="text-white font-mono lowercase">
                Active Grounding Document Selected
              </span>
            )}
          </div>

          {documents.length === 0 ? (
            <div className="text-center py-10 px-4">
              <BookOpen size={32} className="mx-auto text-white mb-2 opacity-40" />
              <p className="text-xs text-white font-medium">No documents uploaded yet.</p>
              <p className="text-[11px] text-[#71717A] mt-1 max-w-sm mx-auto">
                Upload a university syllabus or lecture note PDF to chat with it, extract page-by-page definitions, and generate practice MCQs.
              </p>
            </div>
          ) : (
            documents.map(doc => {
              const isUploading = doc.status === 'uploading';
              const isProcessing = doc.status === 'processing';
              const isReady = doc.status === 'ready' || (!doc.status && doc.pages);
              const isScanned = doc.status === 'scanned_needs_ocr' || doc.isScanned;
              const isError = doc.status === 'error';
              const isActive = doc.id === activeDocumentId;

              return (
                <div
                  key={doc.id}
                  className={`p-4 rounded-2xl border transition-all ${
                    isActive
                      ? 'bg-[#1C1C1C] border-white shadow-sm'
                      : 'bg-[#141414] border-[#262626] hover:border-zinc-500'
                  }`}
                >
                  {/* Top Line: Name, Size, Status Badge, & Delete */}
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex items-start gap-2.5 min-w-0 flex-1">
                      <div className="p-2 rounded-xl flex-shrink-0 mt-0.5 bg-[#111111] text-white border border-[#262626]">
                        <FileText size={17} />
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="text-xs sm:text-[13.5px] font-semibold text-white truncate">
                            {doc.name}
                          </p>
                          {isActive && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-white text-black uppercase">
                              Active
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2 mt-0.5 text-[11px] text-[#A1A1AA]">
                          <span>{doc.size}</span>
                          {doc.pages && (
                            <span>• {doc.pages} Pages</span>
                          )}
                          {doc.chunkCount ? (
                            <span>• {doc.chunkCount} Searchable Chunks</span>
                          ) : null}
                        </div>
                      </div>
                    </div>

                    {/* Delete Action */}
                    <button
                      type="button"
                      onClick={() => deleteDocument(doc.id)}
                      className="p-1.5 text-[#71717A] hover:text-white rounded-lg hover:bg-[#1C1C1C] transition-colors flex-shrink-0"
                      title="Delete document"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>

                  {/* Upload Progress Bar (when uploading) */}
                  {isUploading && (
                    <div className="mt-2.5 mb-1.5">
                      <div className="flex items-center justify-between text-[11px] text-[#A1A1AA] mb-1">
                        <span className="flex items-center gap-1.5">
                          <Loader2 size={12} className="animate-spin text-white" />
                          <span>Uploading to Firebase Storage...</span>
                        </span>
                        <span className="text-white font-mono">{doc.progress || 0}%</span>
                      </div>
                      <div className="w-full h-1 bg-[#111111] rounded-full overflow-hidden">
                        <div
                          className="h-full bg-white rounded-full transition-all duration-300"
                          style={{ width: `${doc.progress || 0}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Processing Status */}
                  {isProcessing && (
                    <div className="flex items-center gap-1.5 py-1 text-xs text-[#A1A1AA]">
                      <Loader2 size={13} className="animate-spin text-white" />
                      <span>Extracting text & page structures...</span>
                    </div>
                  )}

                  {/* Scanned PDF Alert */}
                  {isScanned && (
                    <div className="mt-2 p-3 rounded-xl bg-[#111111] border border-[#3F3F46] text-zinc-300 text-xs">
                      <div className="flex items-start gap-2">
                        <AlertCircle size={15} className="text-white flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="font-semibold text-white">Scanned Document Notice</p>
                          <p className="text-[11px] text-[#A1A1AA] leading-relaxed mt-0.5">
                            {doc.error || 'This PDF appears to be a scanned document without an embedded text layer. Optical Character Recognition (OCR) is required.'}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Error Message */}
                  {isError && (
                    <div className="mt-2 p-3 rounded-xl bg-[#111111] border border-[#3F3F46] text-zinc-300 text-xs">
                      <div className="flex items-start gap-2">
                        <AlertCircle size={15} className="text-white flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="font-semibold text-white">Processing Error</p>
                          <p className="text-[11px] text-[#A1A1AA] leading-relaxed mt-0.5">
                            {doc.error || 'Failed to process document.'}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Interactive Study Actions (Available when document is ready) */}
                  {isReady && !isScanned && (
                    <div className="mt-3 pt-2.5 border-t border-[#262626] flex items-center gap-1.5 flex-wrap">
                      <button
                        type="button"
                        onClick={() => handleQuickAction(doc, 'summarize')}
                        className="px-3 py-1.5 rounded-xl bg-[#111111] hover:bg-[#1C1C1C] border border-[#262626] text-white text-xs flex items-center gap-1.5 transition-colors"
                      >
                        <Sparkles size={12} className="text-white" />
                        <span>Summarize</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleQuickAction(doc, 'mcq')}
                        className="px-3 py-1.5 rounded-xl bg-[#111111] hover:bg-[#1C1C1C] border border-[#262626] text-white text-xs flex items-center gap-1.5 transition-colors"
                      >
                        <FileQuestion size={12} className="text-white" />
                        <span>Generate MCQs</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleQuickAction(doc, 'notes')}
                        className="px-3 py-1.5 rounded-xl bg-[#111111] hover:bg-[#1C1C1C] border border-[#262626] text-white text-xs flex items-center gap-1.5 transition-colors"
                      >
                        <FileCheck2 size={12} className="text-white" />
                        <span>Exam Notes</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setSelectedPagePromptDoc(doc)}
                        className="px-3 py-1.5 rounded-xl bg-[#111111] hover:bg-[#1C1C1C] border border-[#262626] text-white text-xs flex items-center gap-1.5 transition-colors"
                      >
                        <BookOpen size={12} className="text-white" />
                        <span>Explain Page...</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setActiveDocumentId(doc.id);
                          setActiveModal(null);
                          setStudyMode('pdf');
                          showToast(`"${doc.name}" set as active study document.`);
                        }}
                        className="ml-auto px-3.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all bg-white text-black hover:bg-zinc-200"
                      >
                        <MessageSquare size={12} />
                        <span>{isActive ? 'Chatting' : 'Chat with PDF'}</span>
                      </button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Explain Specific Page Dialog */}
        {selectedPagePromptDoc && (
          <div className="p-4 border-t border-[#262626] bg-[#0A0A0A] flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <BookOpen size={16} className="text-white" />
              <span className="text-xs text-[#A1A1AA]">
                Explain specific page from <strong className="text-white">{selectedPagePromptDoc.name}</strong>:
              </span>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-[#71717A] font-mono">Page #</span>
              <input
                type="number"
                min={1}
                max={selectedPagePromptDoc.pages || 999}
                value={targetPageInput}
                onChange={e => setTargetPageInput(e.target.value)}
                className="w-16 px-2.5 py-1 rounded-xl bg-[#111111] border border-[#262626] text-xs text-white text-center focus:outline-none focus:border-white"
              />
              <button
                type="button"
                onClick={handleExplainSpecificPage}
                className="px-3.5 py-1.5 rounded-xl bg-white text-black text-xs font-semibold hover:bg-zinc-200 flex items-center gap-1 transition-colors"
              >
                <span>Ask Ai</span>
                <ArrowRight size={12} />
              </button>
              <button
                type="button"
                onClick={() => setSelectedPagePromptDoc(null)}
                className="p-1 text-[#71717A] hover:text-white"
              >
                <X size={14} />
              </button>
            </div>
          </div>
        )}
          </div>
        </div>
      </div>
    </div>
  );
};
