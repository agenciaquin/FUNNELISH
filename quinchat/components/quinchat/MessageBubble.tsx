'use client';

import type { ChatMessage } from '@/lib/quinchat/types';

interface Props {
  message: ChatMessage;
}

/** Renderiza markdown simple: **bold**, *italic*, listas con -, saltos de línea */
function renderMarkdown(text: string): React.ReactNode[] {
  const lines = text.split('\n');
  const result: React.ReactNode[] = [];

  lines.forEach((line, lineIdx) => {
    // Línea de lista: empieza con "- " o "* "
    const listMatch = line.match(/^[\-\*]\s+(.+)/);
    if (listMatch) {
      result.push(
        <div key={lineIdx} className="flex gap-2 my-0.5">
          <span className="text-brand-gold mt-0.5 flex-shrink-0">•</span>
          <span>{parseInline(listMatch[1])}</span>
        </div>
      );
    } else if (line.trim() === '') {
      result.push(<div key={lineIdx} className="h-2" />);
    } else {
      result.push(<div key={lineIdx}>{parseInline(line)}</div>);
    }
  });

  return result;
}

/** Parsea bold (**text**) e italic (*text*) dentro de una línea */
function parseInline(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  // Regex que captura **bold** y *italic*
  const regex = /(\*\*(.+?)\*\*|\*(.+?)\*)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    // Texto plano antes del match
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    if (match[0].startsWith('**')) {
      parts.push(<strong key={match.index} className="font-semibold text-white">{match[2]}</strong>);
    } else {
      parts.push(<em key={match.index} className="italic">{match[3]}</em>);
    }
    lastIndex = match.index + match[0].length;
  }

  // Texto restante
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts.length > 0 ? parts : [text];
}

export default function MessageBubble({ message }: Props) {
  const isUser = message.role === 'user';
  const time = new Date(message.timestamp).toLocaleTimeString('es-CO', {
    hour: '2-digit',
    minute: '2-digit',
  });

  if (isUser) {
    return (
      <div className="flex justify-end mb-4">
        <div className="max-w-[75%]">
          <div className="bg-brand-gold text-brand-black rounded-2xl rounded-br-none px-4 py-3 text-sm leading-relaxed font-medium">
            {message.content}
          </div>
          <p className="text-right text-xs text-gray-600 mt-1 pr-1">{time}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-end gap-2 mb-4">
      <div className="w-8 h-8 rounded-full bg-brand-gold flex items-center justify-center text-brand-black text-xs font-bold flex-shrink-0">
        Q
      </div>

      <div className="max-w-[75%]">
        <div className="bg-[#1A1A1A] border border-[#2A2A2A] text-brand-white rounded-2xl rounded-bl-none px-4 py-3 text-sm leading-relaxed">
          {renderMarkdown(message.content)}
        </div>
        <p className="text-xs text-gray-600 mt-1 pl-1">{time}</p>
      </div>
    </div>
  );
}
