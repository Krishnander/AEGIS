"use client";

import React, { Component, ErrorInfo, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, RefreshCw, Home, Info } from "lucide-react";
import { Telemetry } from "@/lib/telemetry";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Report to telemetry (respects NEXT_PUBLIC_DEBUG for console output)
    Telemetry.captureError(error, {
      component: "ErrorBoundary",
      componentStack: errorInfo.componentStack,
    });
    
    this.setState({
      error,
      errorInfo,
    });

    // Call optional error callback
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  private handleRefresh = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    window.location.reload();
  };

  private handleGoHome = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    window.location.href = "/";
  };

  public render() {
    if (this.state.hasError) {
      // Custom fallback UI
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-background">
          <Card className="max-w-lg w-full bg-card border-border/60">
            <CardHeader className="text-center pb-2">
              <div className="mx-auto mb-4 p-3 rounded-full bg-red-500/10">
                <AlertTriangle className="w-8 h-8 text-red-400" />
              </div>
              <CardTitle className="text-xl text-white">
                Something went wrong
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="p-4 bg-muted/50 rounded-lg">
                <p className="text-sm text-muted-foreground">
                  {this.state.error?.message || "An unexpected error occurred"}
                </p>
              </div>

              {/* Technical details (collapsible) */}
              <details className="text-sm">
                <summary className="cursor-pointer text-muted-foreground hover:text-foreground flex items-center gap-2">
                  <Info className="w-4 h-4" />
                  Technical Details
                </summary>
                <pre className="mt-2 p-3 bg-background rounded-lg overflow-x-auto text-xs text-muted-foreground font-mono">
                  {this.state.error?.toString()}
                  {"\n\n"}
                  {this.state.errorInfo?.componentStack}
                </pre>
              </details>

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={this.handleRefresh}
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Refresh
                </Button>
                <Button
                  variant="default"
                  className="flex-1 bg-blue-600 hover:bg-blue-700"
                  onClick={this.handleGoHome}
                >
                  <Home className="w-4 h-4 mr-2" />
                  Go Home
                </Button>
              </div>

              <p className="text-xs text-muted-foreground/60 text-center">
                If this problem persists, please contact support or try again later.
              </p>
            </CardContent>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}

// Functional wrapper for easy use
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  fallback?: ReactNode
) {
  return function WrappedComponent(props: P) {
    return (
      <ErrorBoundary fallback={fallback}>
        <Component {...props} />
      </ErrorBoundary>
    );
  };
}

// Specialized error boundaries for different areas
export function ChatErrorBoundary({ children }: { children: ReactNode }) {
  return (
    <ErrorBoundary
      fallback={
        <Card className="bg-card/50 border-border/60 p-8 text-center">
          <AlertTriangle className="w-12 h-12 text-clinical-critical mx-auto mb-4" />
          <h3 className="text-lg font-medium text-foreground mb-2">Chat Error</h3>
          <p className="text-muted-foreground mb-4">
            The chat interface encountered an error. Please refresh to try again.
          </p>
          <Button onClick={() => window.location.reload()}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh Page
          </Button>
        </Card>
      }
    >
      {children}
    </ErrorBoundary>
  );
}

export function GraphErrorBoundary({ children }: { children: ReactNode }) {
  return (
    <ErrorBoundary
      fallback={
        <Card className="bg-card/50 border-border/60 p-8 text-center">
          <AlertTriangle className="w-12 h-12 text-clinical-warning mx-auto mb-4" />
          <h3 className="text-lg font-medium text-foreground mb-2">Graph Error</h3>
          <p className="text-muted-foreground mb-4">
            The visualization encountered an error. Please try a different analysis.
          </p>
          <Button onClick={() => window.location.reload()}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh Page
          </Button>
        </Card>
      }
    >
      {children}
    </ErrorBoundary>
  );
}

export default ErrorBoundary;
