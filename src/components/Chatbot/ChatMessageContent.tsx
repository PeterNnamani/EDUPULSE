import type { ReactNode } from 'react';

/** Lightweight formatting for assistant replies (headings, lists, bold, simple tables). */
export default function ChatMessageContent({ content }: { content: string }) {
  const blocks = splitBlocks(content);

  return (
    <div className="text-sm space-y-2 break-words">
      {blocks.map((block, i) => {
        if (block.type === 'table') {
          return <SimpleTable key={i} rows={block.rows} />;
        }
        return (
          <div key={i} className="space-y-1.5 whitespace-pre-wrap">
            {block.lines.map((line, j) => renderLine(line, j))}
          </div>
        );
      })}
    </div>
  );
}

function splitBlocks(content: string): Array<{ type: 'text'; lines: string[] } | { type: 'table'; rows: string[][] }> {
  const lines = content.split('\n');
  const blocks: Array<{ type: 'text'; lines: string[] } | { type: 'table'; rows: string[][] }> = [];
  let textBuffer: string[] = [];
  let tableBuffer: string[][] = [];

  const flushText = () => {
    if (textBuffer.length) {
      blocks.push({ type: 'text', lines: textBuffer });
      textBuffer = [];
    }
  };
  const flushTable = () => {
    if (tableBuffer.length >= 2) {
      blocks.push({ type: 'table', rows: tableBuffer });
    } else {
      for (const row of tableBuffer) {
        textBuffer.push(row.join(' | '));
      }
    }
    tableBuffer = [];
  };

  for (const line of lines) {
    const isTableRow = /^\|?.+\|.+\|?$/.test(line.trim()) && line.includes('|');
    if (isTableRow && !line.match(/^\|[\s\-:|]+\|$/)) {
      flushText();
      const cells = line
        .split('|')
        .map((c) => c.trim())
        .filter((c, idx, arr) => !(idx === 0 && c === '') && !(idx === arr.length - 1 && c === ''));
      if (cells.length) tableBuffer.push(cells);
    } else if (line.match(/^\|[\s\-:|]+\|$/)) {
      // separator row — skip
    } else {
      flushTable();
      textBuffer.push(line);
    }
  }
  flushTable();
  flushText();
  return blocks;
}

function SimpleTable({ rows }: { rows: string[][] }) {
  const [header, ...body] = rows;
  return (
    <div className="overflow-x-auto -mx-1">
      <table className="w-full text-[11px] border-collapse">
        <thead>
          <tr>
            {header.map((cell, i) => (
              <th
                key={i}
                className="border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 px-2 py-1 text-left font-semibold text-neutral-900 dark:text-neutral-100"
              >
                {formatInline(cell)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {body.map((row, ri) => (
            <tr key={ri}>
              {row.map((cell, ci) => (
                <td
                  key={ci}
                  className="border border-neutral-200 dark:border-neutral-700 px-2 py-1 align-top text-neutral-800 dark:text-neutral-200"
                >
                  {formatInline(cell)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function renderLine(line: string, key: number) {
  const trimmed = line.trim();
  if (!trimmed) return <div key={key} className="h-1" />;

  if (trimmed.startsWith('### ')) {
    return (
      <p key={key} className="font-semibold text-[13px] mt-2">
        {formatInline(trimmed.slice(4))}
      </p>
    );
  }
  if (trimmed.startsWith('## ')) {
    return (
      <p key={key} className="font-semibold text-sm mt-2">
        {formatInline(trimmed.slice(3))}
      </p>
    );
  }
  if (trimmed.startsWith('- ') || trimmed.startsWith('• ')) {
    return (
      <p key={key} className="pl-1">
        {formatInline(trimmed)}
      </p>
    );
  }
  if (trimmed.startsWith('_') && trimmed.endsWith('_')) {
    return (
      <p key={key} className="text-xs italic opacity-80">
        {trimmed.slice(1, -1)}
      </p>
    );
  }
  return <p key={key}>{formatInline(trimmed)}</p>;
}

function formatInline(text: string): ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, idx) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong key={idx} className="font-semibold">
          {part.slice(2, -2)}
        </strong>
      );
    }
    return part;
  });
}
