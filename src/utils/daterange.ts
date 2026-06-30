export type DashboardRange = "month" | "3months" | "year" | "all";

export const DASHBOARD_RANGES: DashboardRange[] = ["month", "3months", "year", "all"];

export interface DateWindow {
  start: Date | null; // null = no lower bound (open-ended)
  end: Date;
}

export interface DashboardDateRange {
  range: DashboardRange;
  current: DateWindow;
  /**
   * The period immediately preceding `current`, used to compute
   * percentage change / trend. Null for "all" — there is no
   * meaningful "previous all-time" window to compare against.
   */
  previous: DateWindow | null;
}

/**
 * Normalizes an incoming query value to a known DashboardRange.
 * Falls back to "all" for anything missing or unrecognized, since
 * "all" is the product-mandated default.
 */
export const parseDashboardRange = (value: unknown): DashboardRange => {
  if (typeof value === "string" && (DASHBOARD_RANGES as string[]).includes(value)) {
    return value as DashboardRange;
  }
  return "all";
};

/**
 * Computes the current window and its equal-length previous window
 * for a given dashboard range, anchored to "now".
 */
export const getDashboardDateRange = (range: DashboardRange): DashboardDateRange => {
  const now = new Date();

  switch (range) {
    case "month": {
      const currentStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const previousStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const previousEnd = new Date(currentStart.getTime() - 1);

      return {
        range,
        current: { start: currentStart, end: now },
        previous: { start: previousStart, end: previousEnd },
      };
    }

    case "3months": {
      const currentStart = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());
      const previousStart = new Date(now.getFullYear(), now.getMonth() - 6, now.getDate());
      const previousEnd = new Date(currentStart.getTime() - 1);

      return {
        range,
        current: { start: currentStart, end: now },
        previous: { start: previousStart, end: previousEnd },
      };
    }

    case "year": {
      const currentStart = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
      const previousStart = new Date(now.getFullYear() - 2, now.getMonth(), now.getDate());
      const previousEnd = new Date(currentStart.getTime() - 1);

      return {
        range,
        current: { start: currentStart, end: now },
        previous: { start: previousStart, end: previousEnd },
      };
    }

    case "all":
    default:
      return {
        range: "all",
        current: { start: null, end: now },
        previous: null,
      };
  }
};

/**
 * Builds a Mongo match clause for a date field given a window.
 * Returns an empty object when there's no lower bound (i.e. "all").
 */
export const buildDateMatch = (field: string, window: DateWindow | null) => {
  if (!window) return null;

  const clause: Record<string, Date> = {};
  if (window.start) clause.$gte = window.start;
  clause.$lte = window.end;

  return { [field]: clause };
};