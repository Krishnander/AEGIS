"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import ReactFlow, {
  Background,
  Controls,
  Node,
  Edge,
  useNodesState,
  useEdgesState,
  Position,
  Handle,
  MarkerType,
  useReactFlow,
  ReactFlowProvider,
  Panel,
  MiniMap,
  BackgroundVariant,
} from "reactflow";
import "reactflow/dist/style.css";
import { cn } from "@/lib/utils";
import { 
  ZoomIn, 
  ZoomOut, 
  Maximize2, 
  Download, 
  RotateCcw,
  Info
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface GraphData {
  nodes: Array<{
    id: string;
    label: string;
    type: "patient" | "symptom" | "history" | "risk" | "diagnosis";
    severity?: "low" | "medium" | "high";
  }>;
  edges: Array<{
    id: string;
    source: string;
    target: string;
    label?: string;
  }>;
}

interface NodeData {
  label: string;
  type: string;
  severity?: string;
  description?: string;
}

// Custom node component for better styling
function CustomNode({ data }: { data: NodeData }) {
  const [isExpanded, setIsExpanded] = useState(false);

  const getNodeStyle = () => {
    switch (data.type) {
      case "patient":
        return "bg-clinical-info/15 border-clinical-info/60 text-foreground";
      case "symptom":
        return "bg-clinical-warning/15 border-clinical-warning/60 text-foreground";
      case "history":
        return "bg-muted/40 border-border text-foreground";
      case "risk":
        const severity = data.severity || "medium";
        switch (severity) {
          case "high":
            return "bg-clinical-critical/15 border-clinical-critical/60 text-foreground";
          case "medium":
            return "bg-clinical-warning/15 border-clinical-warning/60 text-foreground";
          default:
            return "bg-clinical-success/15 border-clinical-success/60 text-foreground";
        }
      case "diagnosis":
        return "bg-clinical-info/10 border-clinical-info/40 text-foreground";
      default:
        return "bg-muted/30 border-border text-foreground";
    }
  };

  return (
    <div className="relative">
      <Handle type="target" position={Position.Top} className="!bg-muted-foreground" />
      <div
        className={cn(
          "px-3 py-2 rounded border shadow-sm min-w-[120px] text-center cursor-pointer transition-all duration-150",
          getNodeStyle(),
          isExpanded && "ring-1 ring-primary/40"
        )}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="font-medium text-xs">{data.label}</div>
        {data.severity && data.type === "risk" && (
          <div className={cn(
            "mt-1 text-2xs font-mono uppercase tracking-wider",
            data.severity === "high" && "text-clinical-critical",
            data.severity === "medium" && "text-clinical-warning",
            data.severity === "low" && "text-clinical-success"
          )}>
            {data.severity}
          </div>
        )}
        {isExpanded && data.description && (
          <div className="mt-1.5 text-2xs text-muted-foreground pt-1.5 border-t border-border/40">
            {data.description}
          </div>
        )}
      </div>
      <Handle type="source" position={Position.Bottom} className="!bg-muted-foreground" />
    </div>
  );
}

const nodeTypes = {
  custom: CustomNode,
};

const nodeDefaults = {
  sourcePosition: Position.Bottom,
  targetPosition: Position.Top,
};

// Helper to generate unique node positions
function generateNodePositions(nodes: GraphData["nodes"], edges: GraphData["edges"]): { nodes: Node[]; edges: Edge[] } {
  const nodeMap = new Map<string, Node>();
  const edgeList: Edge[] = [];
  
  // Group nodes by type for layering
  const patientNodes = nodes.filter(n => n.type === "patient");
  const historyNodes = nodes.filter(n => n.type === "history");
  const symptomNodes = nodes.filter(n => n.type === "symptom");
  const riskNodes = nodes.filter(n => n.type === "risk");
  const diagnosisNodes = nodes.filter(n => n.type === "diagnosis");

  const centerX = 400;
  let currentY = 50;
  
  // Calculate column width based on number of nodes
  const getColumnWidth = (count: number) => count > 1 ? Math.min(250, 800 / count) : 0;

  // Patient nodes (top)
  patientNodes.forEach((node, index) => {
    const count = patientNodes.length;
    const x = count === 1 ? centerX - 70 : centerX - ((count - 1) * getColumnWidth(count)) / 2 + index * getColumnWidth(count);
    nodeMap.set(node.id, {
      id: node.id,
      type: "custom",
      data: { label: node.label, type: node.type, description: `Patient: ${node.label}` },
      position: { x, y: currentY },
      ...nodeDefaults,
    });
  });

  if (patientNodes.length > 0) currentY += 120;

  // History nodes
  if (historyNodes.length > 0) {
    const count = historyNodes.length;
    const startX = centerX - ((count - 1) * getColumnWidth(count)) / 2;
    historyNodes.forEach((node, index) => {
      const x = count === 1 ? centerX - 70 : startX + index * getColumnWidth(count);
      nodeMap.set(node.id, {
        id: node.id,
        type: "custom",
        data: { label: node.label, type: node.type, description: `History: ${node.label}` },
        position: { x, y: currentY },
        ...nodeDefaults,
      });
    });
    currentY += 120;
  }

  // Symptom nodes (middle row)
  if (symptomNodes.length > 0) {
    const count = symptomNodes.length;
    const startX = centerX - ((count - 1) * getColumnWidth(count)) / 2;
    symptomNodes.forEach((node, index) => {
      const x = count === 1 ? centerX - 70 : startX + index * getColumnWidth(count);
      nodeMap.set(node.id, {
        id: node.id,
        type: "custom",
        data: { label: node.label, type: node.type, description: `Symptom: ${node.label}` },
        position: { x, y: currentY },
        ...nodeDefaults,
      });
    });
    currentY += 120;
  }

  // Risk/Diagnosis nodes (bottom)
  const bottomNodes = [...riskNodes, ...diagnosisNodes];
  if (bottomNodes.length > 0) {
    const count = bottomNodes.length;
    const startX = centerX - ((count - 1) * getColumnWidth(count)) / 2;
    bottomNodes.forEach((node, index) => {
      const x = count === 1 ? centerX - 70 : startX + index * getColumnWidth(count);
      nodeMap.set(node.id, {
        id: node.id,
        type: "custom",
        data: { 
          label: node.label, 
          type: node.type, 
          severity: node.severity,
          description: `${node.type === "risk" ? "Risk Assessment" : "Diagnosis"}: ${node.label}`
        },
        position: { x, y: currentY },
        ...nodeDefaults,
      });
    });
  }

  // Create edges from graph data
  edges.forEach((edge) => {
    edgeList.push({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      label: edge.label,
      animated: true,
      style: { stroke: "hsl(215 12% 40%)", strokeWidth: 1.5 },
      labelStyle: { fill: "hsl(210 20% 80%)", fontSize: 10 },
      labelBgStyle: { fill: "hsl(220 20% 6%)", padding: 2 },
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: "hsl(215 12% 40%)",
      },
    });
  });

  return {
    nodes: Array.from(nodeMap.values()),
    edges: edgeList,
  };
}

// Inner component that uses ReactFlow hooks
function CausalMapInner({ 
  data, 
  onLayout,
  showControls = true,
  showMiniMap = true,
  className = ""
}: { 
  data?: GraphData; 
  onLayout?: () => void;
  showControls?: boolean;
  showMiniMap?: boolean;
  className?: string;
}) {
  const [mounted, setMounted] = useState(false);
  const { fitView, zoomIn, zoomOut, getViewport } = useReactFlow();
  const [showLegend, setShowLegend] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const { nodes: initialNodes, edges: initialEdges } = useMemo(() => {
    if (!data || data.nodes.length === 0) {
      return {
        nodes: [{
          id: "placeholder",
          type: "input",
          data: { label: "Awaiting Analysis...", type: "placeholder" },
          position: { x: 250, y: 100 },
          style: {
            background: "transparent",
            color: "hsl(215 12% 55%)",
            border: "1px dashed hsl(220 13% 20%)",
            borderRadius: "6px",
            padding: "10px",
          },
        }],
        edges: [],
      };
    }

    return generateNodePositions(data.nodes, data.edges);
  }, [data]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  // Update nodes and edges when data changes
  useEffect(() => {
    setNodes(initialNodes);
    setEdges(initialEdges);
  }, [initialNodes, initialEdges]);

  const handleZoomIn = useCallback(() => {
    zoomIn({ duration: 300 });
  }, [zoomIn]);

  const handleZoomOut = useCallback(() => {
    zoomOut({ duration: 300 });
  }, [zoomOut]);

  const handleFitView = useCallback(() => {
    fitView({ duration: 300, padding: 0.2 });
  }, [fitView]);

  const handleReset = useCallback(() => {
    onLayout?.();
    fitView({ duration: 300, padding: 0.2 });
  }, [fitView, onLayout]);

  const handleExport = useCallback(() => {
    const viewport = getViewport();
    const exportData = {
      nodes: initialNodes,
      edges: initialEdges,
      viewport,
      exportedAt: new Date().toISOString(),
    };
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `aegis-graph-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [initialNodes, initialEdges, getViewport]);

  if (!mounted) {
    return (
      <div className="h-96 flex items-center justify-center text-muted-foreground">
        <div className="flex flex-col items-center gap-2">
          <div className="w-6 h-6 border-2 border-border border-t-foreground/50 rounded-full animate-spin" />
          <p className="text-2xs">Loading visualization...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("relative h-full w-full", className)}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        fitView
        attributionPosition="bottom-left"
        proOptions={{ hideAttribution: true }}
      >
        {/* Legend Panel */}
        {showLegend && (
          <Panel position="top-right">
            <Card className="bg-card/95 border-border/60 backdrop-blur-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-2xs uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Info className="w-3 h-3" />
                  Legend
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-1.5 text-2xs">
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded bg-clinical-info/15 border border-clinical-info/60" />
                    <span className="text-muted-foreground">Patient</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded bg-clinical-warning/15 border border-clinical-warning/60" />
                    <span className="text-muted-foreground">Symptom</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded bg-muted/40 border border-border" />
                    <span className="text-muted-foreground">History</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded bg-clinical-critical/15 border border-clinical-critical/60" />
                    <span className="text-muted-foreground">High Risk</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded bg-clinical-info/10 border border-clinical-info/40" />
                    <span className="text-muted-foreground">Diagnosis</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </Panel>
        )}

        {/* Control Panel */}
        {showControls && (
          <Panel position="bottom-right">
            <div className="flex flex-col gap-1.5">
              <div className="flex gap-1 bg-card/90 p-1 rounded border border-border/60 backdrop-blur-sm">
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={handleZoomIn} title="Zoom In">
                  <ZoomIn className="w-3.5 h-3.5" />
                </Button>
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={handleZoomOut} title="Zoom Out">
                  <ZoomOut className="w-3.5 h-3.5" />
                </Button>
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={handleFitView} title="Fit View">
                  <Maximize2 className="w-3.5 h-3.5" />
                </Button>
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={handleReset} title="Reset">
                  <RotateCcw className="w-3.5 h-3.5" />
                </Button>
              </div>
              <div className="flex gap-1 bg-card/90 p-1 rounded border border-border/60 backdrop-blur-sm">
                <Button variant="ghost" size="sm" className="h-7 px-2 text-2xs" onClick={() => setShowLegend(!showLegend)}>
                  <Info className="w-3 h-3 mr-1" />Legend
                </Button>
                <Button variant="ghost" size="sm" className="h-7 px-2 text-2xs" onClick={handleExport}>
                  <Download className="w-3 h-3 mr-1" />Export
                </Button>
              </div>
            </div>
          </Panel>
        )}

        {/* Mini Map */}
        {showMiniMap && (
          <Panel position="bottom-left">
            <MiniMap
              nodeColor={(node) => {
                const data = node.data as NodeData;
                switch (data.type) {
                  case "patient": return "hsl(199 89% 48%)";
                  case "symptom": return "hsl(38 92% 50%)";
                  case "history": return "hsl(215 12% 40%)";
                  case "risk": return data.severity === "high" ? "hsl(0 72% 51%)" : "hsl(38 92% 50%)";
                  case "diagnosis": return "hsl(199 89% 48%)";
                  default: return "hsl(215 12% 40%)";
                }
              }}
              maskColor="rgba(14, 17, 22, 0.8)"
              className="bg-card rounded border border-border/60"
              style={{
                width: 120,
                height: 80,
              }}
            />
          </Panel>
        )}

        {/* Background */}
        <Background
          color="hsl(220 13% 18%)"
          gap={16}
          variant={BackgroundVariant.Dots}
          style={{ backgroundColor: "transparent" }}
        />
        
        {/* Controls */}
        <Controls
          className="bg-card border-border/60 text-foreground"
          showInteractive={false}
        />
      </ReactFlow>
    </div>
  );
}

// Wrapper component with ReactFlowProvider
export default function CausalMap({ 
  data, 
  onLayout,
  showControls = true,
  showMiniMap = true,
  className = ""
}: { 
  data?: GraphData; 
  onLayout?: () => void;
  showControls?: boolean;
  showMiniMap?: boolean;
  className?: string;
}) {
  return (
    <ReactFlowProvider>
      <CausalMapInner
        data={data}
        onLayout={onLayout}
        showControls={showControls}
        showMiniMap={showMiniMap}
        className={className}
      />
    </ReactFlowProvider>
  );
}

