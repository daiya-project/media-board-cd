/**
 * Centralized query key factory for @tanstack/react-query.
 *
 * Naming convention: [section, resource, ...params]
 * Using factory pattern for type safety and easy invalidation.
 */
export const queryKeys = {
  dashboard: {
    serviceData: (allDates: string[], clientIds: string[] | null) =>
      ["dashboard", "service-data", allDates, clientIds] as const,
  },
  dataBoard: {
    fullData: (allDates: string[]) =>
      ["data-board", "full-data", allDates] as const,
    weeklyFullData: (
      allWeeks: { year: number; weekNumber: number; label: string }[],
    ) => ["data-board", "weekly-full-data", allWeeks] as const,
    monthlyFullData: (allMonths: string[]) =>
      ["data-board", "monthly-full-data", allMonths] as const,
  },
  maCharts: {
    fullServiceData: (allDates: string[]) =>
      ["ma-charts", "full-service-data", allDates] as const,
    widgetData: (allDates: string[]) =>
      ["ma-charts", "widget-data", allDates] as const,
  },
  external: {
    daily: (startDate: string, endDate: string) =>
      ["external", "daily", startDate, endDate] as const,
  },
} as const;
