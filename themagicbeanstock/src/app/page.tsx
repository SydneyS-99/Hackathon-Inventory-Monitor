"use client";

import React, { useState, useRef, useEffect } from 'react';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: "Hello Manager! I'm your Stock Inventory Optimizer. I've analyzed your 7-day forecast and current stock. How can I help you prepare for the shift?"
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = { role: 'user', content: input };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          messages: [...messages, userMessage],
          userId: "DEMO_USER_ID" // Replace with actual auth context if available
        }),
      });

      const data = await response.json();
      if (data.content) {
        setMessages((prev) => [...prev, { role: 'assistant', content: data.content }]);
      }
    } catch (error) {
      console.error("Chat Error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-[#131314] text-gray-200">
      {/* --- Sticky Header --- */}
      <header className="p-4 border-b border-gray-800 bg-[#131314]/80 backdrop-blur-md sticky top-0 z-10">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-lg font-medium text-white tracking-tight">Magic Bean Optimizer</h1>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
              <span className="text-xs text-gray-400 uppercase tracking-widest">Live Inventory Sync</span>
            </div>
          </div>
        </div>
      </header>

      {/* --- Message Thread --- */}
      <main 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 md:p-8 space-y-8 scroll-smooth"
      >
        <div className="max-w-3xl mx-auto w-full">
          {messages.map((m, index) => (
            <div 
              key={index} 
              className={`flex mb-8 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div className={`flex gap-4 items-start ${m.role === 'user' ? 'flex-row-reverse max-w-[85%]' : 'max-w-full'}`}>
                {/* Avatar / Icon */}
                <div className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center ${
                  m.role === 'user' 
                    ? 'bg-blue-600' 
                    : 'bg-gradient-to-tr from-purple-500 via-blue-500 to-cyan-400'
                }`}>
                  <span className="text-[10px] font-bold text-white uppercase">
                    {m.role === 'user' ? 'Me' : 'AI'}
                  </span>
                </div>

                {/* Content Bubble */}
                <div className={`px-1 py-1 rounded-2xl ${
                  m.role === 'user' 
                    ? 'bg-[#2f2f2f] px-5 py-3 rounded-tr-none text-white border border-gray-700' 
                    : 'text-gray-200 leading-relaxed'
                }`}>
                  <p className="text-[15px] whitespace-pre-wrap leading-7">
                    {m.content}
                  </p>
                </div>
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex gap-4 items-center animate-pulse">
              <div className="w-8 h-8 rounded-full bg-gray-700" />
              <div className="h-4 w-24 bg-gray-700 rounded" />
            </div>
          )}
        </div>
      </main>

      {/* --- Floating Input Bar --- */}
      <footer className="p-4 md:pb-10">
        <div className="max-w-3xl mx-auto relative group">
          <div className="flex items-center bg-[#1e1e1f] rounded-full border border-gray-700 focus-within:border-gray-500 focus-within:ring-1 focus-within:ring-gray-500 transition-all px-2 shadow-2xl">
            <input
              className="flex-1 bg-transparent px-6 py-4 text-white placeholder-gray-500 focus:outline-none text-sm"
              placeholder="Check weekend shortages or ask for tomorrow's prep..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            />
            <button 
              onClick={handleSend}
              disabled={isLoading || !input.trim()}
              className={`p-2 rounded-full transition-all m-1 ${
                input.trim() ? 'bg-white text-black hover:scale-105' : 'bg-gray-800 text-gray-500 cursor-not-allowed'
              }`}
            >
              <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current">
                <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
              </svg>
            </button>
          </div>
          <p className="text-[10px] text-center mt-3 text-gray-500 uppercase tracking-widest font-semibold">
            Optimized for Magic Bean Operations
          </p>
        </div>
      </footer>
    </div>
  );
}