"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  AlertTriangle, 
  Dna, 
  Pill, 
  ArrowRight, 
  CheckCircle,
  XCircle,
  Info
} from "lucide-react";
import { cn } from "@/lib/utils";

interface GenomicVariant {
  gene: string;
  variant: string;
  zygosity?: string;
  effect: string;
}

interface PGxAlert {
  medication: string;
  severity: "HIGH" | "MODERATE" | "LOW";
  recommendation: string;
  alternatives?: string[];
  gene?: string;
}

interface PharmacogenomicsAlertProps {
  variants?: GenomicVariant[];
  alerts?: PGxAlert[];
  className?: string;
}

export default function PharmacogenomicsAlert({
  variants = [],
  alerts = [],
  className,
}: PharmacogenomicsAlertProps) {
  if (variants.length === 0 && alerts.length === 0) {
    return null;
  }

  const hasHighSeverity = alerts.some(a => a.severity === "HIGH");
  const hasModerate = alerts.some(a => a.severity === "MODERATE");

  const getSeverityStyles = (severity: string) => {
    switch (severity) {
      case "HIGH":
        return {
          bg: "bg-clinical-critical/10",
          border: "border-clinical-critical/30",
          text: "text-clinical-critical",
          badge: "border-clinical-critical/40 text-clinical-critical",
          icon: XCircle,
        };
      case "MODERATE":
        return {
          bg: "bg-clinical-warning/10",
          border: "border-clinical-warning/30",
          text: "text-clinical-warning",
          badge: "border-clinical-warning/40 text-clinical-warning",
          icon: AlertTriangle,
        };
      default:
        return {
          bg: "bg-clinical-info/10",
          border: "border-clinical-info/30",
          text: "text-clinical-info",
          badge: "border-clinical-info/40 text-clinical-info",
          icon: Info,
        };
    }
  };

  return (
    <Card className={cn(
      "border",
      hasHighSeverity
        ? "border-clinical-critical/30 bg-clinical-critical/5"
        : hasModerate
          ? "border-clinical-warning/30 bg-clinical-warning/5"
          : "bg-card border-border/60",
      className
    )}>
      <CardHeader className="pb-2 border-b border-border/40">
        <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-2">
          <Dna className="w-3.5 h-3.5" />
          Pharmacogenomics
          {hasHighSeverity && (
            <Badge variant="outline" className="text-2xs border-clinical-critical/40 text-clinical-critical ml-auto">
              ACTION REQUIRED
            </Badge>
          )}
        </CardTitle>
      </CardHeader>

      <CardContent className="p-4 space-y-3">
        {/* Genetic Variants */}
        {variants.length > 0 && (
          <div className="space-y-1.5">
            <h4 className="text-2xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <Dna className="w-3 h-3" />
              Detected Variants
            </h4>
            <div className="space-y-1">
              {variants.map((variant, idx) => (
                <div key={idx} className="flex items-center justify-between p-2 rounded bg-muted/30 border border-border/30">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-2xs text-foreground">{variant.gene}</span>
                    <span className="text-xs text-foreground font-medium">{variant.variant}</span>
                  </div>
                  {variant.zygosity && (
                    <span className="text-2xs text-muted-foreground">{variant.zygosity}</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Drug Alerts */}
        {alerts.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-2xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <Pill className="w-3 h-3" />
              Drug-Gene Interactions
            </h4>
            <div className="space-y-2">
              {alerts.map((alert, idx) => {
                const styles = getSeverityStyles(alert.severity);
                const Icon = styles.icon;
                return (
                  <div key={idx} className={cn("p-2.5 rounded border", styles.bg, styles.border)}>
                    <div className="flex items-start gap-2">
                      <Icon className={cn("w-3.5 h-3.5 mt-0.5 flex-shrink-0", styles.text)} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <span className="text-xs font-semibold text-foreground">{alert.medication}</span>
                          <Badge variant="outline" className={cn("text-2xs", styles.badge)}>{alert.severity}</Badge>
                          {alert.gene && <span className="text-2xs text-muted-foreground font-mono">via {alert.gene}</span>}
                        </div>
                        <p className="text-2xs text-muted-foreground leading-relaxed">{alert.recommendation}</p>
                        {alert.alternatives && alert.alternatives.length > 0 && (
                          <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
                            <span className="text-2xs text-muted-foreground">Alt:</span>
                            {alert.alternatives.map((alt, altIdx) => (
                              <span key={altIdx} className="text-2xs font-mono text-clinical-success flex items-center gap-0.5">
                                <CheckCircle className="w-2.5 h-2.5" />{alt}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="pt-2 border-t border-border/40 flex items-start gap-2">
          <Info className="w-3 h-3 text-clinical-info mt-0.5 flex-shrink-0" />
          <p className="text-2xs text-muted-foreground leading-relaxed">
            <strong className="text-foreground">Precision Medicine:</strong> Based on CPIC guidelines and FDA labels. Pharmacogenomic testing can reduce ADRs by up to 30%.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

// Demo data export for easy integration
export const DEMO_PGX_DATA = {
  variants: [
    {
      gene: "CYP2C9",
      variant: "*2/*3",
      zygosity: "Compound Heterozygote",
      effect: "Poor metabolizer - significantly reduced warfarin clearance",
    },
    {
      gene: "VKORC1",
      variant: "-1639G>A",
      zygosity: "Homozygous",
      effect: "Increased sensitivity to warfarin",
    },
    {
      gene: "CYP2C19",
      variant: "*2",
      zygosity: "Heterozygote",
      effect: "Intermediate metabolizer",
    },
  ],
  alerts: [
    {
      medication: "Warfarin",
      severity: "HIGH" as const,
      gene: "CYP2C9/VKORC1",
      recommendation: "REDUCE DOSE by 50-70%. Standard loading doses will cause over-anticoagulation and bleeding risk. Consider pharmacogenetic dosing algorithm (IWPC). Monitor INR daily until stable.",
      alternatives: ["Rivaroxaban", "Apixaban", "Dabigatran"],
    },
    {
      medication: "Clopidogrel",
      severity: "MODERATE" as const,
      gene: "CYP2C19",
      recommendation: "Consider alternative antiplatelet therapy if no contraindications. Verify platelet function if clopidogrel required.",
      alternatives: ["Prasugrel", "Ticagrelor"],
    },
  ],
};
