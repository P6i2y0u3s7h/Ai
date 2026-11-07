import { StudyNote } from '../types/chat';

/**
 * Downloads a study note as clean formatted plain text (.txt)
 */
export function downloadNoteAsTxt(note: StudyNote) {
  const dateStr = new Date(note.createdAt).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });

  const lines = [
    `TITLE: ${note.title}`,
    `SUBJECT: ${note.subject || 'General'}`,
    note.topic ? `TOPIC: ${note.topic}` : null,
    note.semester ? `SEMESTER: ${note.semester}` : null,
    `DATE: ${dateStr}`,
    note.tags && note.tags.length > 0 ? `TAGS: ${note.tags.join(', ')}` : null,
    `==================================================\n`,
    note.content || '(No content)',
    `\n==================================================`,
    `Generated & Managed via StudyAI`
  ].filter(Boolean).join('\n');

  const blob = new Blob([lines], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${note.title.replace(/[^a-zA-Z0-9_-]/g, '_')}_StudyAI_Notes.txt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Downloads / Prints a study note as a professional academic document / PDF
 */
export function downloadNoteAsPdf(note: StudyNote) {
  const dateStr = new Date(note.createdAt).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });

  // Convert basic markdown formatting into clean HTML elements for print
  const escapeHtml = (str: string) =>
    str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  const contentHtml = escapeHtml(note.content)
    .replace(/^### (.*$)/gim, '<h3 style="font-size:16px;font-weight:700;margin-top:16px;margin-bottom:8px;border-bottom:1px solid #ccc;padding-bottom:4px;">$1</h3>')
    .replace(/^## (.*$)/gim, '<h2 style="font-size:18px;font-weight:700;margin-top:20px;margin-bottom:10px;border-bottom:1px solid #aaa;padding-bottom:4px;">$1</h2>')
    .replace(/^# (.*$)/gim, '<h1 style="font-size:22px;font-weight:800;margin-top:24px;margin-bottom:12px;border-bottom:2px solid #333;padding-bottom:6px;">$1</h1>')
    .replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/gim, '<em>$1</em>')
    .replace(/^\- (.*$)/gim, '<li style="margin-bottom:4px;">$1</li>')
    .replace(/^\d+\. (.*$)/gim, '<li style="margin-bottom:4px;">$1</li>')
    .replace(/\n\n/g, '<p style="margin-bottom:12px;line-height:1.6;"></p>')
    .replace(/\n/g, '<br/>');

  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert('Please allow popups to download/print PDF.');
    return;
  }

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>${escapeHtml(note.title)} - StudyAI Notes</title>
        <style>
          @page {
            size: A4;
            margin: 20mm;
          }
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            color: #111;
            background: #fff;
            margin: 0;
            padding: 24px;
            font-size: 13.5px;
            line-height: 1.6;
          }
          .header {
            border-bottom: 2px solid #222;
            padding-bottom: 12px;
            margin-bottom: 20px;
          }
          .title {
            font-size: 24px;
            font-weight: 800;
            margin: 0 0 6px 0;
            color: #000;
          }
          .meta {
            display: flex;
            flex-wrap: wrap;
            gap: 16px;
            font-size: 11px;
            color: #555;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }
          .tag {
            background: #f0f0f0;
            padding: 2px 8px;
            border-radius: 12px;
            font-size: 10px;
          }
          .content {
            margin-top: 20px;
          }
          .footer {
            margin-top: 40px;
            border-top: 1px solid #ddd;
            padding-top: 10px;
            font-size: 10px;
            color: #777;
            text-align: center;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1 class="title">${escapeHtml(note.title)}</h1>
          <div class="meta">
            <span><strong>Subject:</strong> ${escapeHtml(note.subject || 'General')}</span>
            ${note.topic ? `<span><strong>Topic:</strong> ${escapeHtml(note.topic)}</span>` : ''}
            ${note.semester ? `<span><strong>Semester:</strong> ${escapeHtml(note.semester)}</span>` : ''}
            <span><strong>Date:</strong> ${dateStr}</span>
          </div>
          ${note.tags && note.tags.length > 0 ? `
            <div style="margin-top:8px;">
              ${note.tags.map(t => `<span class="tag">#${escapeHtml(t)}</span>`).join(' ')}
            </div>
          ` : ''}
        </div>

        <div class="content">
          ${contentHtml}
        </div>

        <div class="footer">
          StudyAI Academic Notes Ecosystem · Generated with AI Tutor Integration
        </div>

        <script>
          window.onload = function() {
            window.print();
          };
        </script>
      </body>
    </html>
  `);

  printWindow.document.close();
}

