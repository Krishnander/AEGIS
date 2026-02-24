"use client";

import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { type DemoCase } from "@/hooks/use-agent";
import { 
  Play, 
  Heart, 
  Brain, 
  Wind, 
  Thermometer, 
  Utensils, 
  Sparkles, 
  Search,
  X,
  RotateCcw,
  Info
} from "lucide-react";
import { cn, getSeverityColor } from "@/lib/utils";

interface DemoModeSelectorProps {
  onSelectCase: (caseId: string) => void;
  isLoading?: boolean;
}

const categoryIcons: Record<string, React.ReactNode> = {
  cardiac: <Heart className="w-4 h-4" />,
  respiratory: <Wind className="w-4 h-4" />,
  neurological: <Brain className="w-4 h-4" />,
  abdominal: <Utensils className="w-4 h-4" />,
  infectious: <Thermometer className="w-4 h-4" />,
};

const categoryColors: Record<string, string> = {
  cardiac: "text-clinical-critical bg-clinical-critical/10 border-clinical-critical/20",
  respiratory: "text-clinical-info bg-clinical-info/10 border-clinical-info/20",
  neurological: "text-foreground bg-muted/30 border-border/40",
  abdominal: "text-clinical-success bg-clinical-success/10 border-clinical-success/20",
  infectious: "text-clinical-warning bg-clinical-warning/10 border-clinical-warning/20",
};

export default function DemoModeSelector({ onSelectCase, isLoading }: DemoModeSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [demoCases, setDemoCases] = useState<DemoCase[]>([]);
  const [filteredCases, setFilteredCases] = useState<DemoCase[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [difficultyFilter, setDifficultyFilter] = useState("all");
  const [selectedCase, setSelectedCase] = useState<DemoCase | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  // Load demo cases on mount
  useEffect(() => {
    loadDemoCases();
  }, []);

  // Filter cases when filters change
  useEffect(() => {
    let filtered = demoCases;

    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (c) =>
          c.name.toLowerCase().includes(query) ||
          c.symptoms.some((s) => s.toLowerCase().includes(query)) ||
          c.category.toLowerCase().includes(query)
      );
    }

    // Apply category filter
    if (categoryFilter !== "all") {
      filtered = filtered.filter((c) => c.category === categoryFilter);
    }

    // Apply difficulty filter
    if (difficultyFilter !== "all") {
      filtered = filtered.filter((c) => c.difficulty === difficultyFilter);
    }

    setFilteredCases(filtered);
  }, [demoCases, searchQuery, categoryFilter, difficultyFilter]);

  const loadDemoCases = async () => {
    try {
      // Dynamic import to avoid SSR issues
      const { getDemoCases } = await import("@/hooks/use-agent");
      const cases = await getDemoCases();
      setDemoCases(cases);
      setFilteredCases(cases);
    } catch (error) {
      // silently handle
    }
  };

  const handlePreviewCase = (demoCase: DemoCase) => {
    setSelectedCase(demoCase);
    setIsPreviewOpen(true);
  };

  const handleSelectCase = (caseId: string) => {
    onSelectCase(caseId);
    setIsOpen(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          className="gap-2 border-border/60 text-muted-foreground hover:bg-muted/30 h-7 text-xs"
          disabled={isLoading}
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Case Library</span>
        </Button>
      </DialogTrigger>
      
      <DialogContent className="max-w-3xl max-h-[80vh] bg-card border-border/60">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground text-sm">
            <Sparkles className="w-4 h-4" />
            Clinical Scenarios
          </DialogTitle>
        </DialogHeader>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4 mt-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search cases, symptoms..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 bg-muted/30 border-border/60 h-8 text-xs"
            />
          </div>
          
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-[140px] bg-muted/30 border-border/60 h-8 text-xs">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              <SelectItem value="cardiac">Cardiac</SelectItem>
              <SelectItem value="respiratory">Respiratory</SelectItem>
              <SelectItem value="neurological">Neurological</SelectItem>
              <SelectItem value="abdominal">Abdominal</SelectItem>
              <SelectItem value="infectious">Infectious</SelectItem>
            </SelectContent>
          </Select>

          <Select value={difficultyFilter} onValueChange={setDifficultyFilter}>
            <SelectTrigger className="w-[120px] bg-muted/30 border-border/60 h-8 text-xs">
              <SelectValue placeholder="Difficulty" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Levels</SelectItem>
              <SelectItem value="low">Low</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="high">High</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Stats */}
        <div className="flex items-center gap-4 text-xs text-muted-foreground mt-2">
          <span>{filteredCases.length} cases available</span>
          {(searchQuery || categoryFilter !== "all" || difficultyFilter !== "all") && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSearchQuery("");
                setCategoryFilter("all");
                setDifficultyFilter("all");
              }}
              className="h-auto p-0 text-muted-foreground hover:text-foreground"
            >
              <RotateCcw className="w-3 h-3 mr-1" />
              Clear filters
            </Button>
          )}
        </div>

        {/* Case Grid */}
        <ScrollArea className="h-[400px] mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredCases.map((demoCase, index) => (
              <div
                key={demoCase.id}
                className="transition-all duration-300"
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <Card
                  className={cn(
                    "bg-card border-border/60 hover:bg-muted/30 transition-colors cursor-pointer",
                    categoryColors[demoCase.category]
                  )}
                  onClick={() => handlePreviewCase(demoCase)}
                >
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm flex items-center gap-2">
                        {categoryIcons[demoCase.category]}
                        {demoCase.name}
                      </CardTitle>
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-2xs",
                          demoCase.difficulty === "high" && "border-clinical-critical/40 text-clinical-critical",
                          demoCase.difficulty === "medium" && "border-clinical-warning/40 text-clinical-warning",
                          demoCase.difficulty === "low" && "border-clinical-success/40 text-clinical-success"
                        )}
                      >
                        {demoCase.difficulty}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="flex flex-wrap gap-1 mb-2">
                      {demoCase.symptoms.slice(0, 3).map((symptom, i) => (
                        <Badge key={i} variant="secondary" className="text-2xs px-1.5 py-0">
                          {symptom}
                        </Badge>
                      ))}
                      {demoCase.symptoms.length > 3 && (
                        <Badge variant="secondary" className="text-2xs px-1.5 py-0">
                          +{demoCase.symptoms.length - 3} more
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center justify-between">
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-2xs font-mono",
                          demoCase.severity === "high" && "border-clinical-critical/40 text-clinical-critical",
                          demoCase.severity === "medium" && "border-clinical-warning/40 text-clinical-warning",
                          demoCase.severity === "low" && "border-clinical-success/40 text-clinical-success"
                        )}
                      >
                        {demoCase.severity.toUpperCase()}
                      </Badge>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 text-2xs hover:bg-muted/30"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSelectCase(demoCase.id);
                        }}
                      >
                        <Play className="w-3 h-3 mr-1" />
                        Run
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            ))}
          </div>

          {filteredCases.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Search className="w-8 h-8 mb-3 opacity-50" />
              <p className="text-xs">No cases match your filters</p>
              <Button
                variant="link"
                onClick={() => {
                  setSearchQuery("");
                  setCategoryFilter("all");
                  setDifficultyFilter("all");
                }}
                className="mt-1 text-xs text-muted-foreground"
              >
                Clear all filters
              </Button>
            </div>
          )}
        </ScrollArea>

        {/* Info Box */}
        <div className="flex items-start gap-2 p-3 bg-muted/30 border border-border/40 rounded mt-3">
          <Info className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0 mt-0.5" />
          <div className="text-2xs text-muted-foreground">
            <p className="font-medium text-foreground mb-0.5">About Clinical Scenarios</p>
            <p>Pre-configured clinical scenarios with synthetic patient data for evaluation purposes.</p>
          </div>
        </div>
      </DialogContent>

      {/* Case Preview Dialog */}
      <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
        <DialogContent className="max-w-2xl bg-card border-border/60">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-foreground text-sm">
              {selectedCase && (
                <>
                  {categoryIcons[selectedCase.category]}
                  {selectedCase.name}
                </>
              )}
            </DialogTitle>
          </DialogHeader>

          {selectedCase && (
            <ScrollArea className="max-h-[60vh]">
              <div className="space-y-6">
                {/* Overview */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="p-2 bg-muted/30 rounded border border-border/30">
                    <Label className="text-2xs text-muted-foreground">Category</Label>
                    <p className="text-xs font-medium text-foreground capitalize">{selectedCase.category}</p>
                  </div>
                  <div className="p-2 bg-muted/30 rounded border border-border/30">
                    <Label className="text-2xs text-muted-foreground">Difficulty</Label>
                    <p className="text-xs font-medium text-foreground capitalize">{selectedCase.difficulty}</p>
                  </div>
                </div>

                {/* Symptoms */}
                <div>
                  <Label className="text-2xs text-muted-foreground mb-1.5 block uppercase tracking-wider">Symptoms</Label>
                  <div className="flex flex-wrap gap-1">
                    {selectedCase.symptoms.map((symptom, i) => (
                      <Badge key={i} variant="secondary" className="text-2xs">
                        {symptom}
                      </Badge>
                    ))}
                  </div>
                </div>

                {/* Severity */}
                <div className="p-3 bg-muted/30 rounded border border-border/30">
                  <Label className="text-2xs text-muted-foreground mb-1 block uppercase tracking-wider">Triage Priority</Label>
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-sm px-3 py-1 font-mono",
                      selectedCase.severity === "high" && "border-clinical-critical/40 text-clinical-critical",
                      selectedCase.severity === "medium" && "border-clinical-warning/40 text-clinical-warning",
                      selectedCase.severity === "low" && "border-clinical-success/40 text-clinical-success"
                    )}
                  >
                    {selectedCase.severity.toUpperCase()}
                  </Badge>
                </div>

                {/* Summary */}
                <div>
                  <Label className="text-2xs text-muted-foreground mb-1 block uppercase tracking-wider">Clinical Summary</Label>
                  <p className="text-xs text-foreground leading-relaxed">{selectedCase.summary}</p>
                </div>

                {/* Differential */}
                <div>
                  <Label className="text-2xs text-muted-foreground mb-1 block uppercase tracking-wider">Differential Diagnosis</Label>
                  <div className="space-y-1.5">
                    {selectedCase.differential.map((diff, i) => (
                      <div
                        key={i}
                        className="flex items-start justify-between p-2 bg-muted/30 rounded border border-border/30"
                      >
                        <div>
                          <p className="text-xs font-medium text-foreground">{diff.condition}</p>
                          <p className="text-2xs text-muted-foreground mt-0.5">{diff.recommendation}</p>
                        </div>
                        <span
                          className={cn(
                            "text-xs font-mono",
                            diff.probability >= 70 && "text-clinical-critical",
                            diff.probability >= 40 && diff.probability < 70 && "text-clinical-warning",
                            diff.probability < 40 && "text-clinical-success"
                          )}
                        >
                          {diff.probability}%
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </ScrollArea>
          )}

          <div className="flex justify-end gap-3 mt-4">
            <Button variant="outline" onClick={() => setIsPreviewOpen(false)}>
              Close
            </Button>
            <Button
              onClick={() => selectedCase && handleSelectCase(selectedCase.id)}
            >
              <Play className="w-3.5 h-3.5 mr-1.5" />
              Run This Case
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}
