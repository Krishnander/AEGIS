"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  searchCases, 
  getCaseById, 
  deleteCase, 
  getCaseStatistics, 
  exportCasesToJSON, 
  exportCasesToCSV,
  type Case,
  type CaseSearchResult 
} from "@/lib/db";
import { type CaseSearchOptions } from "@/lib/db";
import { 
  Search, 
  Download, 
  Trash2, 
  Calendar, 
  FileText,
  ChevronLeft,
  ChevronRight,
  X,
  Eye,
  RefreshCw
} from "lucide-react";
import { cn, getSeverityColor } from "@/lib/utils";

interface CaseListPanelProps {
  isOpen?: boolean;
  onClose?: () => void;
  onSelectCase?: (caseData: Case) => void;
}

export default function CaseListPanel({ isOpen = true, onClose, onSelectCase }: CaseListPanelProps) {
  const [searchResult, setSearchResult] = useState<CaseSearchResult>({ cases: [], total: 0, hasMore: false });
  const [statistics, setStatistics] = useState<{
    total: number;
    bySeverity: Record<string, number>;
    bySource: Record<string, number>;
    recentCount: number;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedCase, setSelectedCase] = useState<Case | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  // Search and filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [severityFilter, setSeverityFilter] = useState<string>("all");
  const [sourceFilter, setSourceFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("timestamp");
  const [sortOrder, setSortOrder] = useState<string>("desc");
  const [page, setPage] = useState(0);
  const pageSize = 10;

  // Load cases and statistics on mount and when filters change
  useEffect(() => {
    loadCases();
    loadStatistics();
  }, [searchQuery, severityFilter, sourceFilter, sortBy, sortOrder, page]);

  const loadCases = async () => {
    setIsLoading(true);
    try {
      const options: CaseSearchOptions = {
        query: searchQuery,
        severity: severityFilter as "low" | "medium" | "high" | "all",
        source: sourceFilter as "edge" | "cloud" | "demo" | "all",
        sortBy: sortBy as "timestamp" | "severity",
        sortOrder: sortOrder as "asc" | "desc",
        limit: pageSize,
        offset: page * pageSize,
      };
      const result = await searchCases(options);
      setSearchResult(result);
    } catch (error) {
      // silently handle
    } finally {
      setIsLoading(false);
    }
  };

  const loadStatistics = async () => {
    try {
      const stats = await getCaseStatistics();
      setStatistics(stats);
    } catch (error) {
      // silently handle
    }
  };

  const handleSearch = useCallback(() => {
    setPage(0);
    loadCases();
  }, [searchQuery, severityFilter, sourceFilter, sortBy, sortOrder]);

  const handleClearFilters = () => {
    setSearchQuery("");
    setSeverityFilter("all");
    setSourceFilter("all");
    setSortBy("timestamp");
    setSortOrder("desc");
    setPage(0);
  };

  const handleViewCase = async (id: number) => {
    try {
      const caseData = await getCaseById(id);
      if (caseData) {
        setSelectedCase(caseData);
        setIsDetailOpen(true);
      }
    } catch (error) {
      // silently handle
    }
  };

  const handleDeleteCase = async (id: number) => {
    if (window.confirm("Are you sure you want to delete this case?")) {
      try {
        await deleteCase(id);
        loadCases();
        loadStatistics();
      } catch (error) {
        // silently handle
      }
    }
  };

  const handleExport = async (format: "json" | "csv") => {
    try {
      const options: CaseSearchOptions = {
        query: searchQuery,
        severity: severityFilter as "low" | "medium" | "high" | "all",
        source: sourceFilter as "edge" | "cloud" | "demo" | "all",
      };

      let content: string;
      let filename: string;
      let mimeType: string;

      if (format === "json") {
        content = await exportCasesToJSON(options);
        filename = "aegis-cases.json";
        mimeType = "application/json";
      } else {
        content = await exportCasesToCSV(options);
        filename = "aegis-cases.csv";
        mimeType = "text/csv";
      }

      // Create download
      const blob = new Blob([content], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      // silently handle
    }
  };

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getSeverityVariant = (severity: string) => {
    switch (severity) {
      case "high":
        return "destructive";
      case "medium":
        return "medium";
      case "low":
        return "low";
      default:
        return "secondary";
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <CardHeader className="pb-3 border-b border-border/40">
        <div className="flex items-center justify-between">
          <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-2">
            <FileText className="w-3.5 h-3.5" />
            Case History
          </CardTitle>
          
          {onClose && (
            <Button variant="ghost" size="sm" onClick={onClose} className="h-8 w-8 p-0">
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>

        {/* Statistics */}
        {statistics && (
          <div className="grid grid-cols-4 gap-2 mt-3">
            <div className="p-2 bg-muted/30 rounded border border-border/30 text-center">
              <p className="text-lg font-mono font-semibold text-foreground">{statistics.total}</p>
              <p className="text-2xs text-muted-foreground">Total Cases</p>
            </div>
            <div className="p-2 bg-clinical-critical/10 rounded border border-clinical-critical/20 text-center">
              <p className="text-lg font-mono font-semibold text-clinical-critical">{statistics.bySeverity.high || 0}</p>
              <p className="text-2xs text-muted-foreground">High Priority</p>
            </div>
            <div className="p-2 bg-clinical-warning/10 rounded border border-clinical-warning/20 text-center">
              <p className="text-lg font-mono font-semibold text-clinical-warning">{statistics.bySeverity.medium || 0}</p>
              <p className="text-2xs text-muted-foreground">Medium</p>
            </div>
            <div className="p-2 bg-clinical-success/10 rounded border border-clinical-success/20 text-center">
              <p className="text-lg font-mono font-semibold text-clinical-success">{statistics.recentCount}</p>
              <p className="text-2xs text-muted-foreground">Last 24h</p>
            </div>
          </div>
        )}
      </CardHeader>

      {/* Search and Filters */}
      <div className="p-3 border-b border-border/40 space-y-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            placeholder="Search cases..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            className="pl-9 bg-muted/30 border-border/60 h-7 text-xs"
          />
        </div>

        <div className="flex gap-2">
          <Select value={severityFilter} onValueChange={setSeverityFilter}>
            <SelectTrigger className="flex-1 bg-muted/30 border-border/60 h-7 text-xs">
              <SelectValue placeholder="Severity" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Severity</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="low">Low</SelectItem>
            </SelectContent>
          </Select>

          <Select value={sourceFilter} onValueChange={setSourceFilter}>
            <SelectTrigger className="flex-1 bg-muted/30 border-border/60 h-7 text-xs">
              <SelectValue placeholder="Source" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Sources</SelectItem>
              <SelectItem value="edge">Edge AI</SelectItem>
              <SelectItem value="cloud">Cloud AI</SelectItem>
              <SelectItem value="demo">Scenario</SelectItem>
            </SelectContent>
          </Select>

          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-[120px] bg-muted/30 border-border/60 h-7 text-xs">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="timestamp">Date</SelectItem>
              <SelectItem value="severity">Severity</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex justify-between items-center">
          <Button variant="ghost" size="sm" onClick={handleClearFilters} className="text-muted-foreground text-2xs">
            <X className="w-3 h-3 mr-1" />
            Clear filters
          </Button>

          <div className="flex gap-1">
            <Button 
              variant="outline" 
              size="sm" 
              className="text-2xs border-border/60"
              onClick={() => handleExport("csv")}
            >
              <Download className="w-3 h-3 mr-1" />
              CSV
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              className="text-2xs border-border/60"
              onClick={() => handleExport("json")}
            >
              <Download className="w-3 h-3 mr-1" />
              JSON
            </Button>
          </div>
        </div>
      </div>

      {/* Case List */}
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-2">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="w-5 h-5 text-muted-foreground animate-spin" />
            </div>
          ) : searchResult.cases.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="w-8 h-8 mx-auto mb-3 opacity-50" />
              <p className="text-xs">No cases found</p>
              <p className="text-2xs mt-1">Try adjusting your filters</p>
            </div>
          ) : (
            <>
              {searchResult.cases.map((caseData, index) => (
                <div
                  key={caseData.id}
                  className="p-2 bg-muted/20 border border-border/30 rounded hover:bg-muted/40 transition-colors"
                  style={{ animationDelay: `${index * 30}ms` }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge 
                          variant={getSeverityVariant(caseData.severity) as any}
                          className="text-2xs"
                        >
                          {caseData.severity.toUpperCase()}
                        </Badge>
                        <Badge variant="outline" className="text-2xs">
                          {caseData.source === "edge" ? "Edge" : caseData.source === "cloud" ? "Cloud" : "Scenario"}
                        </Badge>
                      </div>
                      
                      <p className="text-xs text-foreground line-clamp-2 mb-1">
                        {caseData.summary}
                      </p>
                      
                      <div className="flex items-center gap-1.5 text-2xs text-muted-foreground">
                        <Calendar className="w-3 h-3" />
                        {formatDate(caseData.timestamp)}
                      </div>
                    </div>

                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0"
                        onClick={() => caseData.id && handleViewCase(caseData.id)}
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-red-400 hover:text-red-300"
                        onClick={() => caseData.id && handleDeleteCase(caseData.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}

              {/* Pagination */}
              {searchResult.total > pageSize && (
                <div className="flex items-center justify-center gap-2 mt-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(p => Math.max(0, p - 1))}
                    disabled={page === 0}
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <span className="text-xs text-muted-foreground">
                    Page {page + 1} of {Math.ceil(searchResult.total / pageSize)}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(p => p + 1)}
                    disabled={!searchResult.hasMore}
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </ScrollArea>

      {/* Case Detail Dialog */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="max-w-2xl bg-card border-border/60">
          <DialogHeader>
            <DialogTitle>Case Details</DialogTitle>
          </DialogHeader>

          {selectedCase && (
            <ScrollArea className="max-h-[60vh]">
              <div className="space-y-4">
                <div className="flex gap-2">
                  <Badge variant={getSeverityVariant(selectedCase.severity) as any}>
                    {selectedCase.severity.toUpperCase()} PRIORITY
                  </Badge>
                  <Badge variant="outline">
                    {selectedCase.source === "edge" ? "Edge AI" : selectedCase.source === "cloud" ? "Cloud AI" : "Scenario"}
                  </Badge>
                </div>

                <div>
                  <label className="text-2xs text-muted-foreground uppercase tracking-wider">Original Symptoms</label>
                  <p className="text-xs text-foreground mt-1">{selectedCase.symptoms}</p>
                </div>

                <div>
                  <label className="text-2xs text-muted-foreground uppercase tracking-wider">Clinical Summary</label>
                  <p className="text-xs text-muted-foreground mt-1">{selectedCase.summary}</p>
                </div>

                <div>
                  <label className="text-2xs text-muted-foreground uppercase tracking-wider">Timestamp</label>
                  <p className="text-xs text-foreground mt-1">{formatDate(selectedCase.timestamp)}</p>
                </div>
              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
