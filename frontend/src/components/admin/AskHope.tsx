"use client"

import { useState, useEffect, useRef } from 'react';
import {
  Sparkles,
  Loader2,
  AlertCircle,
  X,
  Send,
  User,
  Bot,
  Trash2,
  ClipboardList,
  FileText,
  FilePlus,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import apiService from '../../services/api.service';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface AskHopeProps {
  patientId: string;  // Patient UUID - agent queries database directly
  patientName?: string;  // Display name for UI
  onOpenChange?: (isOpen: boolean) => void;
}

export default function AskHope({ patientId, patientName, onOpenChange }: AskHopeProps) {
  const [isOpen, setIsOpen] = useState(false);

  // Notify parent when open state changes
  useEffect(() => {
    onOpenChange?.(isOpen);
  }, [isOpen, onOpenChange]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Get patient display name
  const getPatientName = () => patientName || 'Patient';

  // Close panel on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input when panel opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [isOpen]);

  const ACTION_PILLS = [
    {
      label: 'Clinical Summary',
      icon: ClipboardList,
      prompt: "Provide a concise clinical summary of this patient's current status, highlighting any key concerns, active problems, and recent trends.",
    },
    {
      label: 'Referral Note',
      icon: FilePlus,
      prompt: "Generate a referral note for this patient. Include patient demographics, current diagnoses, relevant history, current medications, recent vitals, and reason for referral. Format it as a professional medical referral letter.",
    },
    {
      label: 'Discharge Note',
      icon: FileText,
      prompt: "Generate a discharge summary for this patient. Include admission diagnoses, treatment provided, current medications, follow-up instructions, and any pending results. Format it as a professional discharge note.",
    },
  ];

  const handlePillClick = (prompt: string) => {
    submitQuery(prompt);
  };

  const submitQuery = async (question: string) => {
    if (loading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: question,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setLoading(true);
    setError(null);

    const assistantMessageId = (Date.now() + 1).toString();
    let streamedContent = '';

    const conversationHistory = messages.map(m => ({
      role: m.role,
      content: m.content,
    }));

    try {
      await apiService.ehrAgentQueryStream(
        {
          question,
          patient_id: patientId,
          conversation_history: conversationHistory,
        },
        {
          onStatus: (status) => {
            setMessages(prev => {
              const filtered = prev.filter(m => m.id !== assistantMessageId);
              return [...filtered, {
                id: assistantMessageId,
                role: 'assistant',
                content: `*${status}*`,
                timestamp: new Date(),
              }];
            });
          },
          onToolCall: (_tool, _table, _result) => {
            setMessages(prev => {
              const filtered = prev.filter(m => m.id !== assistantMessageId);
              return [...filtered, {
                id: assistantMessageId,
                role: 'assistant',
                content: `*Calling tools...*`,
                timestamp: new Date(),
              }];
            });
          },
          onContent: (content) => {
            streamedContent += content;
            setMessages(prev => {
              const filtered = prev.filter(m => m.id !== assistantMessageId);
              return [...filtered, {
                id: assistantMessageId,
                role: 'assistant',
                content: streamedContent,
                timestamp: new Date(),
              }];
            });
          },
          onDone: () => {
            setLoading(false);
          },
          onError: (error) => {
            setError(error || 'Failed to get response. Please try again.');
            setLoading(false);
          },
        }
      );
    } catch (err: any) {
      setError(err.message || 'Failed to get response. Please try again.');
      setLoading(false);
    }
  };

  const sendMessage = async () => {
    if (!input.trim() || loading) return;
    const question = input.trim();
    setInput('');
    submitQuery(question);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const clearChat = () => {
    setMessages([]);
    setError(null);
  };

  const handleOpen = () => {
    setIsOpen(true);
  };

  return (
    <>
      {/* Floating Action Button - Olive/Green theme matching admin */}
      <button
        onClick={handleOpen}
        className={`
          fixed bottom-6 right-6 z-40
          flex items-center gap-2 px-5 py-3
          bg-gradient-to-r from-[#4a5d4e] to-[#3d4f41] hover:from-[#3d4f41] hover:to-[#354539]
          text-white font-medium
          rounded-full shadow-lg hover:shadow-xl
          transition-all duration-200 group
          ${isOpen ? 'opacity-0 pointer-events-none' : 'opacity-100'}
        `}
        title="Ask Hope - AI Clinical Assistant"
      >
        <Sparkles className="h-5 w-5 group-hover:animate-pulse" />
        <span>Ask Hope</span>
      </button>

      {/* Slide-out Panel */}
      <div
        className={`
          fixed top-0 right-0 h-full w-[440px] max-w-[90vw]
          bg-white border-l border-gray-200 shadow-xl
          z-50 transform transition-transform duration-300 ease-out
          flex flex-col
          ${isOpen ? 'translate-x-0' : 'translate-x-full'}
        `}
      >
        {/* Panel Header - Olive/Green theme matching admin */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 flex-shrink-0 bg-white">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-[#6b8070] to-[#4a5d4e] rounded-lg">
              <Sparkles className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Hope AI</h2>
              <p className="text-xs text-gray-500">AI Clinical Assistant • {getPatientName()}</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {messages.length > 0 && (
              <button
                onClick={clearChat}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                title="Clear conversation"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
            <button
              onClick={() => setIsOpen(false)}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Messages Container */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
          {/* Disclaimer */}
          <div className="flex items-start gap-2 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
            <AlertCircle className="h-3.5 w-3.5 text-amber-600 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-amber-700 leading-relaxed">
              AI assistant for clinical decision support. Verify all information before making treatment decisions.
            </p>
          </div>

          {/* Action Pills - shown when no messages */}
          {messages.length === 0 && !loading && (
            <div className="space-y-2 mt-2">
              <p className="text-xs text-gray-500 font-medium px-1">Quick actions</p>
              {ACTION_PILLS.map((pill) => (
                <button
                  key={pill.label}
                  onClick={() => handlePillClick(pill.prompt)}
                  className="w-full flex items-center gap-3 px-4 py-3 text-sm text-gray-700 hover:bg-[#f0f4f1] hover:text-[#4a5d4e] rounded-xl transition-colors border border-gray-100 hover:border-[#c5d1c8] bg-white"
                >
                  <pill.icon className="h-4 w-4 text-[#6b8070] flex-shrink-0" />
                  {pill.label}
                </button>
              ))}
            </div>
          )}

          {/* Messages */}
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex gap-3 ${message.role === 'user' ? 'flex-row-reverse' : ''}`}
            >
              <div className={`
                flex-shrink-0 h-7 w-7 rounded-full flex items-center justify-center
                ${message.role === 'user' ? 'bg-[#e8ede9]' : 'bg-gray-100'}
              `}>
                {message.role === 'user' ? (
                  <User className="h-3.5 w-3.5 text-[#4a5d4e]" />
                ) : (
                  <Bot className="h-3.5 w-3.5 text-[#4a5d4e]" />
                )}
              </div>
              <div className={`
                flex-1 rounded-lg px-3 py-2
                ${message.role === 'user'
                  ? 'bg-gradient-to-r from-[#4a5d4e] to-[#3d4f41] text-white ml-8'
                  : 'bg-gray-50 border border-gray-100 mr-8'}
              `}>
                {message.role === 'user' ? (
                  <p className="text-sm">{message.content}</p>
                ) : (
                  <div className="prose prose-sm max-w-none prose-headings:text-gray-900 prose-headings:font-semibold prose-headings:text-sm prose-p:text-gray-700 prose-p:text-sm prose-li:text-gray-700 prose-li:text-sm prose-strong:text-gray-900 prose-ul:my-1 prose-ol:my-1 prose-p:my-1">
                    <ReactMarkdown>{message.content}</ReactMarkdown>
                  </div>
                )}
              </div>
            </div>
          ))}

          {/* Loading indicator */}
          {loading && (
            <div className="flex gap-3">
              <div className="flex-shrink-0 h-7 w-7 rounded-full bg-gray-100 flex items-center justify-center">
                <Bot className="h-3.5 w-3.5 text-[#4a5d4e]" />
              </div>
              <div className="flex-1 bg-gray-50 border border-gray-100 rounded-lg px-3 py-2 mr-8">
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 text-[#4a5d4e] animate-spin" />
                  <span className="text-sm text-gray-500">Analyzing...</span>
                </div>
              </div>
            </div>
          )}

          {/* Error state */}
          {error && (
            <div className="bg-red-50 border border-red-100 rounded-lg p-3">
              <div className="flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-red-500 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-700">{error}</p>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="flex-shrink-0 border-t border-gray-100 p-4 bg-white">
          <div className="flex gap-2">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about this patient..."
              disabled={loading}
              className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#4a5d4e] focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
            />
            <button
              onClick={sendMessage}
              disabled={!input.trim() || loading}
              className="px-3 py-2 bg-gradient-to-r from-[#4a5d4e] to-[#3d4f41] text-white rounded-lg hover:from-[#3d4f41] hover:to-[#354539] disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
          <p className="text-xs text-gray-400 mt-2 text-center">
            Press Enter to send • Esc to close
          </p>
        </div>
      </div>
    </>
  );
}
