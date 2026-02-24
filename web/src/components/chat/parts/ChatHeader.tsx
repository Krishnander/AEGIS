import React from "react";
import { MessageSquare } from "lucide-react";

interface ChatHeaderProps {
  status: string;
}

export function ChatHeader({ status }: ChatHeaderProps) {
  return (
    <div className="flex items-center justify-between px-4 py-3 border-b border-border/40">
      <div className="flex items-center gap-2">
        <MessageSquare className="w-4 h-4 text-muted-foreground" />
        <span className="text-sm font-medium text-foreground">Clinical Assessment</span>
      </div>
    </div>
  );
}
