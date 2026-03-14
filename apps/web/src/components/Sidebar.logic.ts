import type { Thread } from "../types";
import { cn } from "../lib/utils";
import { findLatestProposedPlan, isLatestTurnSettled } from "../session-logic";

export const THREAD_SELECTION_SAFE_SELECTOR = "[data-thread-item], [data-thread-selection-safe]";
export type SidebarNewThreadEnvMode = "local" | "worktree";
export type SidebarThreadStatusKey =
  | "working"
  | "connecting"
  | "pendingApproval"
  | "awaitingInput"
  | "planReady"
  | "completed";

export interface SidebarThreadFilters {
  statuses: SidebarThreadStatusKey[];
  terminalOpen: boolean;
  terminalRunning: boolean;
  unsentDraft: boolean;
}

export const SIDEBAR_THREAD_FILTER_MENU_ORDER = [
  "working",
  "connecting",
  "pendingApproval",
  "awaitingInput",
  "planReady",
  "completed",
] as const satisfies ReadonlyArray<SidebarThreadStatusKey>;

export const SIDEBAR_THREAD_STATUS_LABELS: Record<SidebarThreadStatusKey, string> = {
  working: "Working",
  connecting: "Connecting",
  pendingApproval: "Pending Approval",
  awaitingInput: "Awaiting Input",
  planReady: "Plan Ready",
  completed: "Completed",
};

export function createSidebarThreadFilters(): SidebarThreadFilters {
  return {
    statuses: [],
    terminalOpen: false,
    terminalRunning: false,
    unsentDraft: false,
  };
}

export interface ThreadStatusPill {
  label:
    | "Working"
    | "Connecting"
    | "Completed"
    | "Pending Approval"
    | "Awaiting Input"
    | "Plan Ready";
  colorClass: string;
  dotClass: string;
  pulse: boolean;
}

type ThreadStatusInput = Pick<
  Thread,
  "interactionMode" | "latestTurn" | "lastVisitedAt" | "proposedPlans" | "session"
>;

const THREAD_STATUS_PILLS: Record<SidebarThreadStatusKey, ThreadStatusPill> = {
  pendingApproval: {
    label: "Pending Approval",
    colorClass: "text-amber-600 dark:text-amber-300/90",
    dotClass: "bg-amber-500 dark:bg-amber-300/90",
    pulse: false,
  },
  awaitingInput: {
    label: "Awaiting Input",
    colorClass: "text-indigo-600 dark:text-indigo-300/90",
    dotClass: "bg-indigo-500 dark:bg-indigo-300/90",
    pulse: false,
  },
  working: {
    label: "Working",
    colorClass: "text-sky-600 dark:text-sky-300/80",
    dotClass: "bg-sky-500 dark:bg-sky-300/80",
    pulse: true,
  },
  connecting: {
    label: "Connecting",
    colorClass: "text-sky-600 dark:text-sky-300/80",
    dotClass: "bg-sky-500 dark:bg-sky-300/80",
    pulse: true,
  },
  planReady: {
    label: "Plan Ready",
    colorClass: "text-violet-600 dark:text-violet-300/90",
    dotClass: "bg-violet-500 dark:bg-violet-300/90",
    pulse: false,
  },
  completed: {
    label: "Completed",
    colorClass: "text-emerald-600 dark:text-emerald-300/90",
    dotClass: "bg-emerald-500 dark:bg-emerald-300/90",
    pulse: false,
  },
};

export function hasUnseenCompletion(thread: ThreadStatusInput): boolean {
  if (!thread.latestTurn?.completedAt) return false;
  const completedAt = Date.parse(thread.latestTurn.completedAt);
  if (Number.isNaN(completedAt)) return false;
  if (!thread.lastVisitedAt) return true;

  const lastVisitedAt = Date.parse(thread.lastVisitedAt);
  if (Number.isNaN(lastVisitedAt)) return true;
  return completedAt > lastVisitedAt;
}

export function shouldClearThreadSelectionOnMouseDown(target: HTMLElement | null): boolean {
  if (target === null) return true;
  return !target.closest(THREAD_SELECTION_SAFE_SELECTOR);
}

export function resolveSidebarNewThreadEnvMode(input: {
  requestedEnvMode?: SidebarNewThreadEnvMode;
  defaultEnvMode: SidebarNewThreadEnvMode;
}): SidebarNewThreadEnvMode {
  return input.requestedEnvMode ?? input.defaultEnvMode;
}

export function resolveThreadRowClassName(input: {
  isActive: boolean;
  isSelected: boolean;
}): string {
  const baseClassName =
    "h-7 w-full translate-x-0 cursor-default justify-start px-2 text-left select-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-ring";

  if (input.isSelected && input.isActive) {
    return cn(
      baseClassName,
      "bg-primary/22 text-foreground font-medium hover:bg-primary/26 hover:text-foreground dark:bg-primary/30 dark:hover:bg-primary/36",
    );
  }

  if (input.isSelected) {
    return cn(
      baseClassName,
      "bg-primary/15 text-foreground hover:bg-primary/19 hover:text-foreground dark:bg-primary/22 dark:hover:bg-primary/28",
    );
  }

  if (input.isActive) {
    return cn(
      baseClassName,
      "bg-accent/85 text-foreground font-medium hover:bg-accent hover:text-foreground dark:bg-accent/55 dark:hover:bg-accent/70",
    );
  }

  return cn(baseClassName, "text-muted-foreground hover:bg-accent hover:text-foreground");
}

export function resolveThreadStatusKey(input: {
  thread: ThreadStatusInput;
  hasPendingApprovals: boolean;
  hasPendingUserInput: boolean;
}): SidebarThreadStatusKey | null {
  const { hasPendingApprovals, hasPendingUserInput, thread } = input;

  if (hasPendingApprovals) {
    return "pendingApproval";
  }

  if (hasPendingUserInput) {
    return "awaitingInput";
  }

  if (thread.session?.status === "running") {
    return "working";
  }

  if (thread.session?.status === "connecting") {
    return "connecting";
  }

  const hasPlanReadyPrompt =
    !hasPendingUserInput &&
    thread.interactionMode === "plan" &&
    isLatestTurnSettled(thread.latestTurn, thread.session) &&
    findLatestProposedPlan(thread.proposedPlans, thread.latestTurn?.turnId ?? null) !== null;
  if (hasPlanReadyPrompt) {
    return "planReady";
  }

  if (hasUnseenCompletion(thread)) {
    return "completed";
  }

  return null;
}

export function resolveThreadStatusPill(input: {
  thread: ThreadStatusInput;
  hasPendingApprovals: boolean;
  hasPendingUserInput: boolean;
}): ThreadStatusPill | null {
  const statusKey = resolveThreadStatusKey(input);
  return statusKey ? THREAD_STATUS_PILLS[statusKey] : null;
}

export function hasActiveSidebarThreadFilters(filters: SidebarThreadFilters): boolean {
  return (
    filters.statuses.length > 0 ||
    filters.terminalOpen ||
    filters.terminalRunning ||
    filters.unsentDraft
  );
}

export function countActiveSidebarThreadFilters(filters: SidebarThreadFilters): number {
  return (
    filters.statuses.length +
    Number(filters.terminalOpen) +
    Number(filters.terminalRunning) +
    Number(filters.unsentDraft)
  );
}

export function areAllStatusSectionFiltersSelected(
  statuses: readonly SidebarThreadStatusKey[],
): boolean {
  return (
    statuses.length === SIDEBAR_THREAD_FILTER_MENU_ORDER.length &&
    SIDEBAR_THREAD_FILTER_MENU_ORDER.every((statusKey) => statuses.includes(statusKey))
  );
}

export function toggleAllStatusSectionFilters(input: {
  filters: SidebarThreadFilters;
  checked: boolean;
  previousStatuses: readonly SidebarThreadStatusKey[] | null;
}): {
  filters: SidebarThreadFilters;
  nextPreviousStatuses: SidebarThreadStatusKey[] | null;
} {
  if (input.checked) {
    return {
      filters: {
        ...input.filters,
        statuses: [...SIDEBAR_THREAD_FILTER_MENU_ORDER],
      },
      nextPreviousStatuses: [...input.filters.statuses],
    };
  }

  return {
    filters: {
      ...input.filters,
      statuses: input.previousStatuses ? [...input.previousStatuses] : [],
    },
    nextPreviousStatuses: null,
  };
}

export function areAllTerminalSectionFiltersSelected(
  filters: Pick<SidebarThreadFilters, "terminalOpen" | "terminalRunning">,
): boolean {
  return filters.terminalOpen && filters.terminalRunning;
}

export function toggleAllTerminalSectionFilters(input: {
  filters: SidebarThreadFilters;
  checked: boolean;
  previousTerminal: Pick<SidebarThreadFilters, "terminalOpen" | "terminalRunning"> | null;
}): {
  filters: SidebarThreadFilters;
  nextPreviousTerminal: Pick<SidebarThreadFilters, "terminalOpen" | "terminalRunning"> | null;
} {
  if (input.checked) {
    return {
      filters: {
        ...input.filters,
        terminalOpen: true,
        terminalRunning: true,
      },
      nextPreviousTerminal: {
        terminalOpen: input.filters.terminalOpen,
        terminalRunning: input.filters.terminalRunning,
      },
    };
  }

  return {
    filters: {
      ...input.filters,
      terminalOpen: input.previousTerminal?.terminalOpen ?? false,
      terminalRunning: input.previousTerminal?.terminalRunning ?? false,
    },
    nextPreviousTerminal: null,
  };
}

export function matchesSidebarThreadFilters(input: {
  statusKey: SidebarThreadStatusKey | null;
  terminalOpen: boolean;
  terminalRunning: boolean;
  hasUnsentDraft: boolean;
  filters: SidebarThreadFilters;
}): boolean {
  const { filters, hasUnsentDraft, statusKey, terminalOpen, terminalRunning } = input;

  if (
    filters.statuses.length > 0 &&
    (statusKey === null || !filters.statuses.includes(statusKey))
  ) {
    return false;
  }

  if (filters.terminalOpen || filters.terminalRunning) {
    const matchesTerminalFilter =
      (filters.terminalOpen && terminalOpen) || (filters.terminalRunning && terminalRunning);
    if (!matchesTerminalFilter) {
      return false;
    }
  }

  if (filters.unsentDraft && !hasUnsentDraft) {
    return false;
  }

  return true;
}
