"use client";

import React, { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";

type Role = "user" | "assistant";

interface Message {
  role: Role;
  content: string;
}

export default function ChatPage() {
  const [hasStarted, setHasStarted] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content:
        "Hello Manager! I'm your Stock Inventory Optimizer. I've analyzed your 7-day forecast and current stock. How can I help you prepare for the shift?",
    },
  ]);

  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages, isLoading]);

  const handleSend = async (override?: string) => {
    const text = (override ?? input).trim();
    if (!text || isLoading) return;

    if (!hasStarted) setHasStarted(true);

    const userMessage: Message = { role: "user", content: text };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [...messages, userMessage],
          userId: "DEMO_USER_ID",
        }),
      });

      const data = await res.json();

      if (data?.content) {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: String(data.content) },
        ]);
      }
    } catch (e) {
      console.error("Chat Error:", e);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Something went wrong sending that. Try again?",
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="h-screen w-full bg-[#131314] text-gray-200 flex flex-col overflow-hidden">
      {/* Header */}
      

      {/* Main */}
      <main className="flex-1 relative overflow-hidden">
        {/* Landing */}
        {!hasStarted ? (
          <div className="h-full flex flex-col items-center justify-center px-6">
            <motion.h2
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-4xl md:text-5xl font-medium text-white text-center tracking-tight"
            >
              Where should we begin?
            </motion.h2>

            <div className="w-full max-w-3xl mt-10">
              <div className="flex items-center bg-[#1e1e1f] rounded-full border border-gray-700 p-1 pl-6 pr-2 shadow-2xl focus-within:border-gray-500 focus-within:ring-1 focus-within:ring-gray-500 transition-all">
                <input
                  className="flex-1 bg-transparent py-4 text-white placeholder-gray-500 focus:outline-none text-lg"
                  placeholder="Ask anything"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSend()}
                />
                <button
                  onClick={() => handleSend()}
                  disabled={!input.trim() || isLoading}
                  className="w-12 h-12 flex items-center justify-center rounded-full transition-transform shrink-0
                             bg-white text-black hover:scale-105 disabled:opacity-50 disabled:hover:scale-100"
                >
                  <svg viewBox="0 0 24 24" className="w-6 h-6 fill-current">
                    <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
                  </svg>
                </button>
              </div>

              <p className="text-[10px] text-center mt-4 text-gray-500 uppercase tracking-widest font-semibold">
                Optimized for Magic Bean Operations
              </p>
            </div>
          </div>
        ) : (
          <>
            {/* Thread */}
            <div
              ref={scrollRef}
              className="h-full overflow-y-auto px-4 md:px-8 py-6 scroll-smooth"
              // IMPORTANT: keeps last messages visible above fixed input bar
              style={{ paddingBottom: "7.5rem" }}
            >
              <div className="max-w-3xl mx-auto w-full">
                {messages.map((m, index) => {
                  const isUser = m.role === "user";

                  return (
                    <div
                      key={index}
                      className={`flex mb-6 ${isUser ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`flex items-start gap-3 ${
                          isUser ? "flex-row-reverse" : ""
                        } w-full`}
                      >
                        {/* Avatar */}
                        <div
                          className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center ${
                            isUser
                              ? "bg-blue-600"
                              : "bg-gradient-to-tr from-purple-500 via-blue-500 to-cyan-400"
                          }`}
                        >
                          <span className="text-[10px] font-bold text-white uppercase">
                            {isUser ? "Me" : "AI"}
                          </span>
                        </div>

                        {/* Bubble */}
                        <div
                          className={[
                            "rounded-2xl px-5 py-3",
                            isUser
                              ? "bg-[#2f2f2f] text-white border border-gray-700 rounded-tr-none max-w-[85%] ml-auto"
                              : "bg-[#19191a] text-gray-200 border border-gray-800 max-w-[95%]",
                          ].join(" ")}
                        >
                          <p className="text-[15px] whitespace-pre-wrap leading-7">
                            {m.content}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}

                {isLoading && (
                  <div className="flex items-center gap-3 animate-pulse mt-2">
                    <div className="w-8 h-8 rounded-full bg-gray-700" />
                    <div className="h-4 w-28 bg-gray-700 rounded" />
                  </div>
                )}
              </div>
            </div>

            {/* Fixed Input */}
            <div className="fixed bottom-0 left-0 right-0 z-30">
              <div className="bg-gradient-to-t from-[#131314] via-[#131314] to-transparent px-4 md:px-8 pt-6 pb-8">
                <div className="max-w-3xl mx-auto">
                  <div className="flex items-center bg-[#1e1e1f] rounded-full border border-gray-700 px-2 shadow-2xl focus-within:border-gray-500 focus-within:ring-1 focus-within:ring-gray-500 transition-all">
                    <input
                      className="flex-1 bg-transparent px-5 py-4 text-white placeholder-gray-500 focus:outline-none text-sm"
                      placeholder="Check weekend shortages or ask for tomorrow's prep..."
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleSend()}
                    />
                    <button
                      onClick={() => handleSend()}
                      disabled={!input.trim() || isLoading}
                      className={`p-2 rounded-full transition-transform m-1 ${
                        input.trim() && !isLoading
                          ? "bg-white text-black hover:scale-105"
                          : "bg-gray-800 text-gray-500 cursor-not-allowed"
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
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
