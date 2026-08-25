'use client';

// Tres puntitos animados que aparecen mientras Claude está respondiendo

export default function TypingIndicator() {
  return (
    <div className="flex items-end gap-2 mb-4">
      {/* Avatar QUINCHAT */}
      <div className="w-8 h-8 rounded-full bg-brand-gold flex items-center justify-center text-brand-black text-xs font-bold flex-shrink-0">
        Q
      </div>

      <div className="bg-[#1A1A1A] border border-[#2A2A2A] rounded-2xl rounded-bl-none px-4 py-3">
        <div className="flex gap-1 items-center h-4">
          <span
            className="w-2 h-2 bg-brand-gold rounded-full animate-bounce"
            style={{ animationDelay: '0ms' }}
          />
          <span
            className="w-2 h-2 bg-brand-gold rounded-full animate-bounce"
            style={{ animationDelay: '150ms' }}
          />
          <span
            className="w-2 h-2 bg-brand-gold rounded-full animate-bounce"
            style={{ animationDelay: '300ms' }}
          />
        </div>
      </div>
    </div>
  );
}
