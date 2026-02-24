"use client";

import React, { useState } from "react";
import { type AnalysisStatus, type AnalysisResult } from "@/hooks/use-agent";
import { ChatErrorBoundary } from "@/components/error-boundary";
import { ChatHeader } from "./parts/ChatHeader";
import { MessageList, Message } from "./parts/MessageList";
import { ChatInput } from "./parts/ChatInput";

interface ChatInterfaceProps {
  status: AnalysisStatus;
  error: string | null;
  analyze: (symptoms: string, demoCaseId?: string) => Promise<AnalysisResult | null>;
  reset: () => void;
}

export default function ChatInterface({ status, error, analyze, reset }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || status === "loading" || status === "streaming" || status === "initializing") return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");

    const analysisResult = await analyze(input);

    if (analysisResult) {
      const summaryText = analysisResult.summary
        || `${analysisResult.severity.toUpperCase()} priority — ${analysisResult.symptoms.join(", ") || "analysis complete"}`;

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: summaryText,
        timestamp: new Date(),
        analysis: analysisResult,
        isDemo: analysisResult.source === "demo",
        demoCaseName: analysisResult.demoCaseId || undefined,
      };

      setMessages((prev) => [...prev, assistantMessage]);
    }
  };

  return (
    <ChatErrorBoundary>
      <div className="flex flex-col h-full">
        <ChatHeader status={status} />
        <MessageList
          messages={messages}
          status={status}
          error={error}
          onReset={reset}
        />
        <ChatInput 
          input={input} 
          status={status} 
          onInputChange={setInput} 
          onSubmit={handleSubmit} 
        />
      </div>
    </ChatErrorBoundary>
  );
}
