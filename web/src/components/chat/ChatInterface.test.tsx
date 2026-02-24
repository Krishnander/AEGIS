import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ChatInterface from "./ChatInterface";
import DemoModeSelector from "./DemoModeSelector";
import CaseListPanel from "./CaseListPanel";

// Mock child components that might cause issues
vi.mock("@/components/chat/DemoModeSelector", () => ({
  default: () => <div data-testid="demo-mode-selector">Case Library</div>,
}));

// Mock React Flow to avoid canvas issues
vi.mock("reactflow", () => ({
  ReactFlowProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Background: () => null,
  Controls: () => null,
  MiniMap: () => null,
  Panel: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  useNodesState: () => [[], vi.fn(), vi.fn()],
  useEdgesState: () => [[], vi.fn(), vi.fn()],
  useReactFlow: () => ({
    fitView: vi.fn(),
    zoomIn: vi.fn(),
    zoomOut: vi.fn(),
    getViewport: vi.fn(() => ({ x: 0, y: 0, zoom: 1 })),
  }),
}));

describe("ChatInterface", () => {
  const mockAnalyze = vi.fn();
  const mockReset = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should render the chat interface", () => {
    render(<ChatInterface status="idle" error={null} analyze={mockAnalyze} reset={mockReset} />);
    
    expect(screen.getByText("Clinical Assessment")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Describe patient symptoms...")).toBeInTheDocument();
  });

  it("should show welcome message when no messages", () => {
    render(<ChatInterface status="idle" error={null} analyze={mockAnalyze} reset={mockReset} />);
    
    expect(screen.getByText("Clinical Triage Assistant")).toBeInTheDocument();
  });

  it("should call analyze when form is submitted", async () => {
    const user = userEvent.setup();
    mockAnalyze.mockResolvedValue({
      symptoms: ["Chest Pain"],
      severity: "high",
      summary: "Test summary",
      source: "edge",
    });

    render(<ChatInterface status="idle" error={null} analyze={mockAnalyze} reset={mockReset} />);

    const input = screen.getByPlaceholderText("Describe patient symptoms...");
    await user.type(input, "Chest pain and shortness of breath");
    
    const submitButton = screen.getByRole("button", { name: /send symptom analysis request/i });
    await user.click(submitButton);

    await waitFor(() => {
      expect(mockAnalyze).toHaveBeenCalledWith("Chest pain and shortness of breath");
    });
  });

  it("should show loading state when analyzing", () => {
    render(<ChatInterface status="streaming" error={null} analyze={mockAnalyze} reset={mockReset} />);

    expect(screen.getByText("Processing with Edge AI...")).toBeInTheDocument();
  });

  it("should show error message when error occurs", () => {
    render(<ChatInterface status="error" error="Failed to analyze. Please try again." analyze={mockAnalyze} reset={mockReset} />);

    expect(screen.getByText("Analysis Error")).toBeInTheDocument();
    expect(screen.getByText("Failed to analyze. Please try again.")).toBeInTheDocument();
  });

  it("should disable input while loading", () => {
    render(<ChatInterface status="loading" error={null} analyze={mockAnalyze} reset={mockReset} />);

    const input = screen.getByPlaceholderText("Describe patient symptoms...");
    expect(input).toBeDisabled();
  });
});

describe("DemoModeSelector", () => {
  const mockOnSelect = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should render case library button", () => {
    render(<DemoModeSelector onSelectCase={mockOnSelect} />);
    
    expect(screen.getByRole("button", { name: /case library/i })).toBeInTheDocument();
  });

  it("should open dialog when clicked", async () => {
    const user = userEvent.setup();
    
    render(<DemoModeSelector onSelectCase={mockOnSelect} />);

    const button = screen.getByRole("button", { name: /case library/i });
    await user.click(button);

    await waitFor(() => {
      expect(screen.getByText("Clinical Scenarios")).toBeInTheDocument();
    });
  });

  it("should show search input in dialog", async () => {
    const user = userEvent.setup();
    
    render(<DemoModeSelector onSelectCase={mockOnSelect} />);

    await user.click(screen.getByRole("button", { name: /case library/i }));

    await waitFor(() => {
      expect(screen.getByPlaceholderText("Search cases, symptoms...")).toBeInTheDocument();
    });
  });

  it("should show category filters", async () => {
    const user = userEvent.setup();
    
    render(<DemoModeSelector onSelectCase={mockOnSelect} />);

    await user.click(screen.getByRole("button", { name: /case library/i }));

    await waitFor(() => {
      expect(screen.getByText("All Categories")).toBeInTheDocument();
    });
  });
});

describe("CaseListPanel", () => {
  const mockLoadCases = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    // Mock searchCases
    vi.mock("@/lib/db", async () => {
      const actual = await vi.importActual("@/lib/db");
      return {
        ...actual,
        searchCases: vi.fn().mockResolvedValue({
          cases: [],
          total: 0,
          hasMore: false,
        }),
        getCaseStatistics: vi.fn().mockResolvedValue({
          total: 0,
          bySeverity: { high: 0, medium: 0, low: 0 },
          bySource: { edge: 0, cloud: 0, demo: 0 },
          recentCount: 0,
        }),
      };
    });
  });

  it("should render case list panel", () => {
    render(<CaseListPanel isOpen={true} />);
    
    expect(screen.getByText("Case History")).toBeInTheDocument();
  });

  it("should show statistics when loaded", async () => {
    render(<CaseListPanel isOpen={true} />);

    await waitFor(() => {
      expect(screen.getByText("Total Cases")).toBeInTheDocument();
    });
  });

  it("should show search input", async () => {
    render(<CaseListPanel isOpen={true} />);

    await waitFor(() => {
      expect(screen.getByPlaceholderText("Search cases...")).toBeInTheDocument();
    });
  });

  it("should show filter options", async () => {
    render(<CaseListPanel isOpen={true} />);

    await waitFor(() => {
      expect(screen.getByText("All Severity")).toBeInTheDocument();
      expect(screen.getByText("All Sources")).toBeInTheDocument();
    });
  });

  it("should show export buttons", async () => {
    render(<CaseListPanel isOpen={true} />);

    await waitFor(() => {
      expect(screen.getByText("CSV")).toBeInTheDocument();
      expect(screen.getByText("JSON")).toBeInTheDocument();
    });
  });
});

describe("Component Integration", () => {
  it("should handle empty input gracefully", async () => {
    const mockAnalyze = vi.fn();

    const user = userEvent.setup();
    render(<ChatInterface status="idle" error={null} analyze={mockAnalyze} reset={vi.fn()} />);

    const submitButton = screen.getByRole("button", { name: /send/i });
    await user.click(submitButton);

    expect(mockAnalyze).not.toHaveBeenCalled();
  });

  it("should handle rapid submit attempts", async () => {
    const mockAnalyze = vi.fn().mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)));

    const user = userEvent.setup();
    render(<ChatInterface status="idle" error={null} analyze={mockAnalyze} reset={vi.fn()} />);

    const input = screen.getByPlaceholderText("Describe patient symptoms...");
    const submitButton = screen.getByRole("button", { name: /send/i });

    await user.type(input, "Test");
    
    // Click submit multiple times rapidly
    await user.click(submitButton);
    await user.click(submitButton);
    await user.click(submitButton);

    // Should only call analyze once due to loading state
    expect(mockAnalyze).toHaveBeenCalledTimes(1);
  });
});
