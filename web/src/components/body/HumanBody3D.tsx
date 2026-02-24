"use client";

import React, { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Activity, 
  Heart, 
  Brain, 
  Wind, 
  Utensils, 
  Bone, 
  AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface HumanBody3DProps {
  analysisResult?: {
    severity: "low" | "medium" | "high";
    symptoms: string[];
    differential?: Array<{
      condition: string;
      probability: number;
    }>;
  } | null;
  className?: string;
}

interface BodySystem {
  id: string;
  name: string;
  icon: React.ReactNode;
  color: string;
  symptoms: string[];
}

const BODY_SYSTEMS: BodySystem[] = [
  {
    id: "cardiac",
    name: "Cardiovascular",
    icon: <Heart className="w-5 h-5" />,
    color: "text-red-500",
    symptoms: ["chest pain", "palpitations", "shortness of breath", "syncope"]
  },
  {
    id: "respiratory",
    name: "Respiratory",
    icon: <Wind className="w-5 h-5" />,
    color: "text-blue-500",
    symptoms: ["cough", "wheezing", "shortness of breath", "chest tightness"]
  },
  {
    id: "neurological",
    name: "Neurological",
    icon: <Brain className="w-5 h-5" />,
    color: "text-purple-500",
    symptoms: ["headache", "confusion", "weakness", "numbness", "seizure"]
  },
  {
    id: "gi",
    name: "Gastrointestinal",
    icon: <Utensils className="w-5 h-5" />,
    color: "text-green-500",
    symptoms: ["abdominal pain", "nausea", "vomiting", "diarrhea"]
  },
  {
    id: "musculoskeletal",
    name: "Musculoskeletal",
    icon: <Bone className="w-5 h-5" />,
    color: "text-orange-500",
    symptoms: ["back pain", "joint pain", "fracture", "trauma"]
  },
  {
    id: "general",
    name: "General",
    icon: <Activity className="w-5 h-5" />,
    color: "text-gray-500",
    symptoms: ["fever", "fatigue", "rash", "infection"]
  }
];

export default function HumanBody3D({ analysisResult, className }: HumanBody3DProps) {
  const [selectedSystem, setSelectedSystem] = useState<string | null>(null);

  const matchedSystems = useMemo(() => {
    if (!analysisResult) return [];
    
    const symptomText = analysisResult.symptoms.join(" ").toLowerCase();
    const diffText = (analysisResult.differential || []).map(d => d.condition).join(" ").toLowerCase();
    const allText = `${symptomText} ${diffText}`;
    
    return BODY_SYSTEMS.filter(system => 
      system.symptoms.some(s => allText.includes(s.toLowerCase()))
    );
  }, [analysisResult]);

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "high": return "border-l-clinical-critical bg-red-500/5 text-clinical-critical";
      case "medium": return "border-l-clinical-warning bg-amber-500/5 text-clinical-warning";
      case "low": return "border-l-clinical-success bg-emerald-500/5 text-clinical-success";
      default: return "bg-muted/30 border-border/30 text-muted-foreground";
    }
  };

  if (!analysisResult) {
    return (
      <div className={cn("p-4", className)}>
        <div className="flex flex-col items-center justify-center h-full min-h-[160px] text-muted-foreground">
          <Activity className="w-6 h-6 mb-2 opacity-30" />
          <p className="text-xs">Enter symptoms to see affected systems</p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("p-4 space-y-3", className)}>
      {/* Severity */}
      <div className={cn(
        "p-2.5 rounded-md text-center border-l-[3px]",
        getSeverityColor(analysisResult.severity)
      )}>
        <p className="text-sm font-semibold uppercase tracking-wide">
          {analysisResult.severity} Severity
        </p>
        <p className="text-2xs opacity-60 mt-0.5">Based on symptom analysis</p>
      </div>

      {/* Matched Systems */}
      {matchedSystems.length > 0 ? (
        <div className="grid grid-cols-2 gap-1.5">
          {matchedSystems.map((system) => (
            <button
              key={system.id}
              className={cn(
                "flex items-center gap-2 p-2 rounded text-left transition-colors border",
                selectedSystem === system.id
                  ? "bg-secondary border-border text-foreground"
                  : "bg-transparent border-transparent text-muted-foreground hover:bg-muted/30"
              )}
              onClick={() => setSelectedSystem(selectedSystem === system.id ? null : system.id)}
            >
              <span className={system.color}>{system.icon}</span>
              <span className="text-xs font-medium">{system.name}</span>
            </button>
          ))}
        </div>
      ) : (
        <div className="p-2.5 rounded text-muted-foreground flex items-center gap-2 bg-muted/20 border border-border/30">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          <span className="text-xs">No specific body systems identified</span>
        </div>
      )}

      {/* Symptoms */}
      <div>
        <p className="text-2xs text-muted-foreground uppercase tracking-wide mb-1.5">Symptoms</p>
        <div className="flex flex-wrap gap-1">
          {analysisResult.symptoms.map((symptom, idx) => (
            <span key={idx} className="text-2xs px-1.5 py-0.5 rounded bg-secondary text-secondary-foreground">
              {symptom}
            </span>
          ))}
        </div>
      </div>

      {/* Differential */}
      {analysisResult.differential && analysisResult.differential.length > 0 && (
        <div>
          <p className="text-2xs text-muted-foreground uppercase tracking-wide mb-1.5">Differential</p>
          <div className="space-y-1">
            {analysisResult.differential.slice(0, 3).map((dx, idx) => (
              <div key={idx} className="flex justify-between items-center p-2 rounded bg-muted/20 border border-border/30">
                <span className="text-xs text-foreground/80">{dx.condition}</span>
                <span className="text-2xs font-mono text-muted-foreground">{dx.probability}%</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
