"use client";
import { useState, useEffect, useRef } from "react";
import { auth } from "../../lib/firebase"; 
import { onAuthStateChanged } from "firebase/auth";

export default function AdvisorChat() {
  const [messages, setMessages] = useState<{role: string, content: string}[]>([]);
  const [input, setInput] = useState("");
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const suggestions = ["Greek Salad forecast", "Recommend for tomorrow", "What's the hot item?"];

  useEffect(() => {
    onAuthStateChanged(auth, (user) => user && setUserId(user.uid));
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const askAdvisor = async (text: string) => {
    const query = text || input;
    if (!query.trim() || !userId) return;

    setLoading(true);
    const newMsg = { role: "user", content: query };
    const updatedMessages = [...messages, newMsg];
    setMessages(updatedMessages);
    setInput("");

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        body: JSON.stringify({ messages: updatedMessages, userId }),
      });
      const data = await res.json();
      setMessages(prev => [...prev, { role: "assistant", content: data.content }]);
    } catch (e) {
      setMessages(prev => [...prev, { role: "assistant", content: "Error connecting to AI." }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed bottom-6 right-6 w-96 bg-white shadow-2xl rounded-2xl border border-gray-100 flex flex-col h-[500px]">
      <div className="bg-emerald-600 p-4 rounded-t-2xl text-white font-bold flex justify-between">
        <span>Inventory Advisor</span>
        <span className="text-xs opacity-70">ML v1.0</span>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && (
          <p className="text-gray-400 text-sm text-center mt-10">Ask me how much to prep today!</p>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`p-3 rounded-2xl max-w-[85%] text-sm ${
              m.role === 'user' ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-800'
            }`}>
              {m.content}
            </div>
          </div>
        ))}
        {loading && <div className="text-xs text-gray-400 animate-pulse italic">Analyzing data...</div>}
        <div ref={scrollRef} />
      </div>

      {/* Suggestion Chips */}
      <div className="px-4 py-2 flex gap-2 overflow-x-auto no-scrollbar">
        {suggestions.map((s, i) => (
          <button 
            key={i} 
            onClick={() => askAdvisor(s)}
            className="whitespace-nowrap bg-emerald-50 text-emerald-700 text-xs px-3 py-1 rounded-full border border-emerald-100 hover:bg-emerald-100"
          >
            {s}
          </button>
        ))}
      </div>

      <div className="p-4 border-t flex gap-2">
        <input 
          className="flex-1 text-sm p-2 outline-none border rounded-lg focus:border-emerald-500" 
          placeholder="Type message..."
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && askAdvisor("")}
        />
        <button onClick={() => askAdvisor("")} className="bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm">Send</button>
      </div>
    </div>
  );
}