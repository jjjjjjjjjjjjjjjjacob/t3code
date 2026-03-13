import { describe, expect, it } from "vitest";

import {
  areAllStatusSectionFiltersSelected,
  areAllTerminalSectionFiltersSelected,
  countActiveSidebarThreadFilters,
  createSidebarThreadFilters,
  hasUnseenCompletion,
  hasActiveSidebarThreadFilters,
  matchesSidebarThreadFilters,
  resolveSidebarNewThreadEnvMode,
  resolveThreadRowClassName,
  resolveThreadStatusKey,
  resolveThreadStatusPill,
  shouldClearThreadSelectionOnMouseDown,
  toggleAllStatusSectionFilters,
  toggleAllTerminalSectionFilters,
} from "./Sidebar.logic";

function makeLatestTurn(overrides?: {
  completedAt?: string | null;
  startedAt?: string | null;
}): Parameters<typeof hasUnseenCompletion>[0]["latestTurn"] {
  return {
    turnId: "turn-1" as never,
    state: "completed",
    assistantMessageId: null,
    requestedAt: "2026-03-09T10:00:00.000Z",
    startedAt: overrides?.startedAt ?? "2026-03-09T10:00:00.000Z",
    completedAt: overrides?.completedAt ?? "2026-03-09T10:05:00.000Z",
  };
}

describe("hasUnseenCompletion", () => {
  it("returns true when a thread completed after its last visit", () => {
    expect(
      hasUnseenCompletion({
        interactionMode: "default",
        latestTurn: makeLatestTurn(),
        lastVisitedAt: "2026-03-09T10:04:00.000Z",
        proposedPlans: [],
        session: null,
      }),
    ).toBe(true);
  });
});

describe("shouldClearThreadSelectionOnMouseDown", () => {
  it("preserves selection for thread items", () => {
    const child = {
      closest: (selector: string) =>
        selector.includes("[data-thread-item]") ? ({} as Element) : null,
    } as unknown as HTMLElement;

    expect(shouldClearThreadSelectionOnMouseDown(child)).toBe(false);
  });

  it("preserves selection for thread list toggle controls", () => {
    const selectionSafe = {
      closest: (selector: string) =>
        selector.includes("[data-thread-selection-safe]") ? ({} as Element) : null,
    } as unknown as HTMLElement;

    expect(shouldClearThreadSelectionOnMouseDown(selectionSafe)).toBe(false);
  });

  it("clears selection for unrelated sidebar clicks", () => {
    const unrelated = {
      closest: () => null,
    } as unknown as HTMLElement;

    expect(shouldClearThreadSelectionOnMouseDown(unrelated)).toBe(true);
  });
});

describe("resolveSidebarNewThreadEnvMode", () => {
  it("uses the app default when the caller does not request a specific mode", () => {
    expect(
      resolveSidebarNewThreadEnvMode({
        defaultEnvMode: "worktree",
      }),
    ).toBe("worktree");
  });

  it("preserves an explicit requested mode over the app default", () => {
    expect(
      resolveSidebarNewThreadEnvMode({
        requestedEnvMode: "local",
        defaultEnvMode: "worktree",
      }),
    ).toBe("local");
  });
});

describe("resolveThreadStatusPill", () => {
  const baseThread = {
    interactionMode: "plan" as const,
    latestTurn: null,
    lastVisitedAt: undefined,
    proposedPlans: [],
    session: {
      provider: "codex" as const,
      status: "running" as const,
      createdAt: "2026-03-09T10:00:00.000Z",
      updatedAt: "2026-03-09T10:00:00.000Z",
      orchestrationStatus: "running" as const,
    },
  };

  it("resolves pending approval as the highest-priority status key", () => {
    expect(
      resolveThreadStatusKey({
        thread: baseThread,
        hasPendingApprovals: true,
        hasPendingUserInput: true,
      }),
    ).toBe("pendingApproval");
  });

  it("shows pending approval before all other statuses", () => {
    expect(
      resolveThreadStatusPill({
        thread: baseThread,
        hasPendingApprovals: true,
        hasPendingUserInput: true,
      }),
    ).toMatchObject({ label: "Pending Approval", pulse: false });
  });

  it("shows awaiting input when plan mode is blocked on user answers", () => {
    expect(
      resolveThreadStatusPill({
        thread: baseThread,
        hasPendingApprovals: false,
        hasPendingUserInput: true,
      }),
    ).toMatchObject({ label: "Awaiting Input", pulse: false });
  });

  it("falls back to working when the thread is actively running without blockers", () => {
    expect(
      resolveThreadStatusPill({
        thread: baseThread,
        hasPendingApprovals: false,
        hasPendingUserInput: false,
      }),
    ).toMatchObject({ label: "Working", pulse: true });
  });

  it("shows plan ready when a settled plan turn has a proposed plan ready for follow-up", () => {
    expect(
      resolveThreadStatusPill({
        thread: {
          ...baseThread,
          latestTurn: makeLatestTurn(),
          proposedPlans: [
            {
              id: "plan-1" as never,
              turnId: "turn-1" as never,
              createdAt: "2026-03-09T10:00:00.000Z",
              updatedAt: "2026-03-09T10:05:00.000Z",
              planMarkdown: "# Plan",
            },
          ],
          session: {
            ...baseThread.session,
            status: "ready",
            orchestrationStatus: "ready",
          },
        },
        hasPendingApprovals: false,
        hasPendingUserInput: false,
      }),
    ).toMatchObject({ label: "Plan Ready", pulse: false });
  });

  it("shows completed when there is an unseen completion and no active blocker", () => {
    expect(
      resolveThreadStatusPill({
        thread: {
          ...baseThread,
          interactionMode: "default",
          latestTurn: makeLatestTurn(),
          lastVisitedAt: "2026-03-09T10:04:00.000Z",
          session: {
            ...baseThread.session,
            status: "ready",
            orchestrationStatus: "ready",
          },
        },
        hasPendingApprovals: false,
        hasPendingUserInput: false,
      }),
    ).toMatchObject({ label: "Completed", pulse: false });
  });

  it("does not treat an already-visited settled thread as completed", () => {
    expect(
      resolveThreadStatusKey({
        thread: {
          ...baseThread,
          interactionMode: "default",
          latestTurn: makeLatestTurn(),
          lastVisitedAt: "2026-03-09T10:06:00.000Z",
          session: {
            ...baseThread.session,
            status: "ready",
            orchestrationStatus: "ready",
          },
        },
        hasPendingApprovals: false,
        hasPendingUserInput: false,
      }),
    ).toBeNull();
  });
});

describe("matchesSidebarThreadFilters", () => {
  const defaultFilters = createSidebarThreadFilters();

  it("matches any thread when no filters are active", () => {
    expect(
      matchesSidebarThreadFilters({
        statusKey: null,
        terminalOpen: false,
        terminalRunning: false,
        hasUnsentDraft: false,
        filters: defaultFilters,
      }),
    ).toBe(true);
  });

  it("matches a single selected status", () => {
    expect(
      matchesSidebarThreadFilters({
        statusKey: "working",
        terminalOpen: false,
        terminalRunning: false,
        hasUnsentDraft: false,
        filters: {
          ...defaultFilters,
          statuses: ["working"],
        },
      }),
    ).toBe(true);
  });

  it("treats multiple selected statuses as OR conditions", () => {
    expect(
      matchesSidebarThreadFilters({
        statusKey: "pendingApproval",
        terminalOpen: false,
        terminalRunning: false,
        hasUnsentDraft: false,
        filters: {
          ...defaultFilters,
          statuses: ["working", "pendingApproval"],
        },
      }),
    ).toBe(true);
  });

  it("requires an open terminal when the terminal-open filter is active", () => {
    expect(
      matchesSidebarThreadFilters({
        statusKey: "working",
        terminalOpen: false,
        terminalRunning: true,
        hasUnsentDraft: false,
        filters: {
          ...defaultFilters,
          terminalOpen: true,
        },
      }),
    ).toBe(false);
  });

  it("requires a running terminal when the terminal-running filter is active", () => {
    expect(
      matchesSidebarThreadFilters({
        statusKey: "working",
        terminalOpen: true,
        terminalRunning: false,
        hasUnsentDraft: false,
        filters: {
          ...defaultFilters,
          terminalRunning: true,
        },
      }),
    ).toBe(false);
  });

  it("treats terminal open and running as OR conditions within the terminal section", () => {
    expect(
      matchesSidebarThreadFilters({
        statusKey: "working",
        terminalOpen: false,
        terminalRunning: true,
        hasUnsentDraft: false,
        filters: {
          ...defaultFilters,
          terminalOpen: true,
          terminalRunning: true,
        },
      }),
    ).toBe(true);
  });

  it("requires an unsent draft when the message filter is active", () => {
    expect(
      matchesSidebarThreadFilters({
        statusKey: "working",
        terminalOpen: true,
        terminalRunning: true,
        hasUnsentDraft: false,
        filters: {
          ...defaultFilters,
          unsentDraft: true,
        },
      }),
    ).toBe(false);
  });

  it("intersects status, terminal, and message filters across sections", () => {
    expect(
      matchesSidebarThreadFilters({
        statusKey: "working",
        terminalOpen: false,
        terminalRunning: true,
        hasUnsentDraft: true,
        filters: {
          statuses: ["working", "connecting"],
          terminalOpen: true,
          terminalRunning: true,
          unsentDraft: true,
        },
      }),
    ).toBe(true);
  });
});

describe("sidebar thread filter counters", () => {
  it("reports inactive default filters", () => {
    expect(
      hasActiveSidebarThreadFilters({
        statuses: [],
        terminalOpen: false,
        terminalRunning: false,
        unsentDraft: false,
      }),
    ).toBe(false);
    expect(
      countActiveSidebarThreadFilters({
        statuses: [],
        terminalOpen: false,
        terminalRunning: false,
        unsentDraft: false,
      }),
    ).toBe(0);
  });

  it("counts status, terminal, and message filters together", () => {
    expect(
      countActiveSidebarThreadFilters({
        statuses: ["working", "completed"],
        terminalOpen: true,
        terminalRunning: false,
        unsentDraft: true,
      }),
    ).toBe(4);
  });
});

describe("sidebar section all toggles", () => {
  it("detects when all status filters are selected", () => {
    expect(
      areAllStatusSectionFiltersSelected([
        "working",
        "connecting",
        "pendingApproval",
        "awaitingInput",
        "planReady",
        "completed",
      ]),
    ).toBe(true);
    expect(areAllStatusSectionFiltersSelected(["working", "completed"])).toBe(false);
  });

  it("selects all status filters and snapshots the previous subset", () => {
    expect(
      toggleAllStatusSectionFilters({
        filters: {
          ...createSidebarThreadFilters(),
          statuses: ["working", "completed"],
        },
        checked: true,
        previousStatuses: null,
      }),
    ).toEqual({
      filters: {
        ...createSidebarThreadFilters(),
        statuses: [
          "working",
          "connecting",
          "pendingApproval",
          "awaitingInput",
          "planReady",
          "completed",
        ],
      },
      nextPreviousStatuses: ["working", "completed"],
    });
  });

  it("restores the previous status subset when all is unchecked", () => {
    expect(
      toggleAllStatusSectionFilters({
        filters: {
          ...createSidebarThreadFilters(),
          statuses: [
            "working",
            "connecting",
            "pendingApproval",
            "awaitingInput",
            "planReady",
            "completed",
          ],
        },
        checked: false,
        previousStatuses: ["working", "completed"],
      }),
    ).toEqual({
      filters: {
        ...createSidebarThreadFilters(),
        statuses: ["working", "completed"],
      },
      nextPreviousStatuses: null,
    });
  });

  it("detects when all terminal filters are selected", () => {
    expect(
      areAllTerminalSectionFiltersSelected({
        terminalOpen: true,
        terminalRunning: true,
      }),
    ).toBe(true);
    expect(
      areAllTerminalSectionFiltersSelected({
        terminalOpen: true,
        terminalRunning: false,
      }),
    ).toBe(false);
  });

  it("selects and restores all terminal filters", () => {
    const selectedAll = toggleAllTerminalSectionFilters({
      filters: {
        ...createSidebarThreadFilters(),
        terminalOpen: true,
      },
      checked: true,
      previousTerminal: null,
    });

    expect(selectedAll).toEqual({
      filters: {
        ...createSidebarThreadFilters(),
        terminalOpen: true,
        terminalRunning: true,
      },
      nextPreviousTerminal: {
        terminalOpen: true,
        terminalRunning: false,
      },
    });

    expect(
      toggleAllTerminalSectionFilters({
        filters: selectedAll.filters,
        checked: false,
        previousTerminal: selectedAll.nextPreviousTerminal,
      }),
    ).toEqual({
      filters: {
        ...createSidebarThreadFilters(),
        terminalOpen: true,
        terminalRunning: false,
      },
      nextPreviousTerminal: null,
    });
  });
});

describe("resolveThreadRowClassName", () => {
  it("uses the darker selected palette when a thread is both selected and active", () => {
    const className = resolveThreadRowClassName({ isActive: true, isSelected: true });
    expect(className).toContain("bg-primary/22");
    expect(className).toContain("hover:bg-primary/26");
    expect(className).toContain("dark:bg-primary/30");
    expect(className).not.toContain("bg-accent/85");
  });

  it("uses selected hover colors for selected threads", () => {
    const className = resolveThreadRowClassName({ isActive: false, isSelected: true });
    expect(className).toContain("bg-primary/15");
    expect(className).toContain("hover:bg-primary/19");
    expect(className).toContain("dark:bg-primary/22");
    expect(className).not.toContain("hover:bg-accent");
  });

  it("keeps the accent palette for active-only threads", () => {
    const className = resolveThreadRowClassName({ isActive: true, isSelected: false });
    expect(className).toContain("bg-accent/85");
    expect(className).toContain("hover:bg-accent");
  });
});
