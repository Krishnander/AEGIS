import React, { useRef, useEffect } from "react";
import { AlertTriangle, Loader2, Stethoscope } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn, getSeverityBg, getSeverityColor } from "@/lib/utils";
import { AnalysisResult } from "@/hooks/use-agent";

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  analysis?: AnalysisResult;
  isDemo?: boolean;
  demoCaseName?: string;
}

interface MessageListProps {
  messages: Message[];
  status: string;
  error: string | null;
  onReset: () => void;
}

export function MessageList({ messages, status, error, onReset }: MessageListProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      const scrollContainer = scrollRef.current.querySelector(
        "[data-radix-scroll-area-viewport]"
      );
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
      }
    }
  }, [messages]);

  const getStatusMessage = () => {
    switch (status) {
      case "initializing":
        return "Initializing model...";
      case "loading":
        return "Analyzing with MedGemma...";
      case "streaming":
        return "Processing with Edge AI...";
      default:
        return "Analyzing...";
    }
  };

  return (
    <ScrollArea ref={scrollRef} className="flex-1 px-4 py-3">
      <div className="space-y-3">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
            <div className="w-10 h-10 rounded-lg bg-muted/50 flex items-center justify-center mb-3">
              <Stethoscope className="w-5 h-5 text-muted-foreground/60" />
            </div>
            <p className="text-sm font-medium text-foreground/80">Clinical Triage Assistant</p>
            <p className="text-xs text-center max-w-sm mt-1 text-muted-foreground/70">
              Describe patient symptoms for AI-powered triage analysis using Google MedGemma.
            </p>
          </div>
        )}

        {messages.map((message) => (
          <div
            key={message.id}
            className={cn(
              "flex w-full",
              message.role === "user" ? "justify-end" : "justify-start"
            )}
          >
            <div
              className={cn(
                "max-w-[88%] rounded-lg px-3.5 py-2.5 text-sm",
                message.role === "user"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted/60 text-foreground border border-border/40"
              )}
            >
              {/* Scenario indicator */}
              {message.isDemo && (
                <div className="flex items-center gap-1.5 mb-1.5 text-2xs opacity-70">
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-primary/60" />
                  {message.demoCaseName || "Clinical Scenario"}
                </div>
              )}

              <p className="leading-relaxed">{message.content}</p>

              {message.role === "assistant" && message.analysis && (
                <div className="mt-2.5 pt-2.5 border-t border-border/30 space-y-2">
                  {/* Severity */}
                  <Badge
                    variant={
                      message.analysis.severity === "high" ? "high"
                        : message.analysis.severity === "medium" ? "medium"
                        : "low"
                    }
                    className={cn(
                      "text-2xs font-semibold",
                      getSeverityBg(message.analysis.severity),
                      getSeverityColor(message.analysis.severity)
                    )}
                  >
                    {message.analysis.severity.toUpperCase()} PRIORITY
                  </Badge>

                  {/* Symptoms tags */}
                  <div className="flex flex-wrap gap-1">
                    {message.analysis.symptoms.map((symptom, i) => (
                      <span key={i} className="inline-block text-2xs px-1.5 py-0.5 rounded bg-secondary text-secondary-foreground">
                        {symptom}
                      </span>
                    ))}
                  </div>

                </div>
              )}

              <p className="text-2xs mt-1.5 text-muted-foreground/40">
                {message.timestamp.toLocaleTimeString()}
              </p>
            </div>
          </div>
        ))}

        {(status === "loading" || status === "streaming" || status === "initializing") && (
          <div className="flex items-center gap-2 text-muted-foreground text-xs py-2">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            <span>{getStatusMessage()}</span>
          </div>
        )}

        {error && (
          <div className="p-3 rounded-lg bg-destructive/8 border border-destructive/15 text-sm">
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-destructive flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="font-medium text-destructive text-xs">Analysis Error</p>
                <p className="text-xs text-muted-foreground mt-0.5">{error}</p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-2 h-7 text-xs border-destructive/20 text-destructive hover:bg-destructive/10"
                  onClick={onReset}
                >
                  Retry
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </ScrollArea>
  );
}
