import React, { useRef, useEffect } from "react";
import { ArrowUp } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface ChatInputProps {
  input: string;
  status: string;
  onInputChange: (value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
}

export function ChatInput({ input, status, onInputChange, onSubmit }: ChatInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "l") {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const isLoading = status === "loading" || status === "streaming" || status === "initializing";

  return (
    <div className="p-3 border-t border-border/40">
      <form onSubmit={onSubmit} className="flex gap-2">
        <Input
          value={input}
          onChange={(e) => onInputChange(e.target.value)}
          placeholder="Describe patient symptoms..."
          className="flex-1 h-9 text-sm bg-muted/50 border-border/60 placeholder:text-muted-foreground/50 focus-visible:ring-1 focus-visible:ring-primary/30"
          disabled={isLoading}
          ref={inputRef}
          aria-label="Patient symptoms input"
        />
        <Button
          type="submit"
          disabled={!input.trim() || isLoading}
          size="sm"
          className="h-9 w-9 p-0 bg-primary hover:bg-primary/90"
          aria-label="Send symptom analysis request"
        >
          <ArrowUp className="w-4 h-4" />
        </Button>
      </form>
      <p className="mt-1.5 text-center text-2xs text-muted-foreground/50">
        Try: &quot;Chest pain, shortness of breath, diaphoresis&quot; &middot; Ctrl+L to focus
      </p>
    </div>
  );
}
