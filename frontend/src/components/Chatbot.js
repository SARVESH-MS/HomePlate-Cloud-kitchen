// frontend/src/components/Chatbot.js

import React, { useState } from 'react';
import { MessageCircle, X, Send, Bot } from 'lucide-react';
import { chatbotAPI } from '../services/api'; // Import the API

const Chatbot = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState([
    { role: 'bot', content: 'Hi! I am the Home Plate assistant. How can I help you today?' }
  ]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!input.trim()) return;

    const userMessage = { role: 'user', content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      // Call the new chatbot API
      const response = await chatbotAPI.askBot(input);
      const botMessage = { role: 'bot', content: response.data.reply };
      setMessages(prev => [...prev, botMessage]);
    } catch (error) {
      console.error("Chatbot error:", error);
      const errorMessage = { role: 'bot', content: 'Sorry, I am having trouble connecting. Please try again later.' };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 bg-orange-500 text-white p-4 rounded-full shadow-lg hover:bg-orange-600 transition"
        aria-label="Open Chat"
      >
        <MessageCircle size={32} />
      </button>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 w-80 h-[450px] bg-white rounded-xl shadow-2xl flex flex-col z-50">
      {/* Header */}
      <div className="flex justify-between items-center p-4 bg-gray-800 text-white rounded-t-xl">
        <h3 className="font-bold text-lg flex items-center gap-2">
          <Bot /> Home Plate AI
        </h3>
        <button onClick={() => setIsOpen(false)} className="hover:text-gray-300">
          <X size={24} />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 p-4 space-y-4 overflow-y-auto">
        {messages.map((msg, index) => (
          <div key={index} className={`flex ${msg.role === 'bot' ? 'justify-start' : 'justify-end'}`}>
            <div
              className={`max-w-[80%] p-3 rounded-lg ${
                msg.role === 'bot'
                  ? 'bg-gray-200 text-gray-800'
                  : 'bg-orange-500 text-white'
              }`}
            >
              {msg.content}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-gray-200 text-gray-800 p-3 rounded-lg">
              <span className="animate-pulse">...</span>
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <form onSubmit={handleSend} className="p-4 border-t flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          className="flex-1 px-4 py-2 border rounded-full focus:outline-none focus:ring-2 focus:ring-orange-400"
          placeholder="Ask a question..."
          disabled={isLoading}
        />
        <button
          type="submit"
          className="bg-orange-500 text-white p-3 rounded-full hover:bg-orange-600 disabled:bg-gray-400"
          disabled={isLoading}
        >
          <Send size={20} />
        </button>
      </form>
    </div>
  );
};

export default Chatbot;