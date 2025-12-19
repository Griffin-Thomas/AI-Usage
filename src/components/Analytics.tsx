import { useState, useEffect, useMemo, useCallback } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { Download, Trash2, RefreshCw, TrendingUp, TrendingDown, Minus, Clock, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  queryHistory,
  getHistoryMetadata,
  getUsageStats,
  exportHistoryJson,
  exportHistoryCsv,
  clearHistory,
} from "@/lib/tauri";
import type { UsageHistoryEntry, HistoryMetadata, UsageStats, ProviderId } from "@/lib/types";

interface AnalyticsProps {
  provider?: ProviderId;
}

type TimeRange = "24h" | "7d" | "30d" | "all";

export function Analytics({ provider = "claude" }: AnalyticsProps) {
  const [history, setHistory] = useState<UsageHistoryEntry[]>([]);
  const [metadata, setMetadata] = useState<HistoryMetadata | null>(null);
  const [stats, setStats] = useState<Record<string, UsageStats | null>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<TimeRange>("7d");
  const [isExporting, setIsExporting] = useState(false);

  // Calculate date range based on selection
  const dateRange = useMemo(() => {
    const now = new Date();
    let startDate: Date;

    switch (timeRange) {
      case "24h":
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case "7d":
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case "30d":
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case "all":
      default:
        return { startDate: undefined, endDate: undefined };
    }

    return {
      startDate: startDate.toISOString(),
      endDate: now.toISOString(),
    };
  }, [timeRange]);

  // Load data
  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Load history
      const historyData = await queryHistory({
        provider,
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
        limit: 1000,
      });
      setHistory(historyData);

      // Load metadata
      const meta = await getHistoryMetadata();
      setMetadata(meta);

      // Load stats for each limit type
      if (dateRange.startDate && dateRange.endDate) {
        const limitIds = ["five_hour", "seven_day"];
        const statsPromises = limitIds.map(async (limitId) => {
          const stat = await getUsageStats(
            provider,
            limitId,
            dateRange.startDate!,
            dateRange.endDate!
          );
          return { limitId, stat };
        });

        const statsResults = await Promise.all(statsPromises);
        const statsMap: Record<string, UsageStats | null> = {};
        statsResults.forEach(({ limitId, stat }) => {
          statsMap[limitId] = stat;
        });
        setStats(statsMap);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load analytics data");
    } finally {
      setIsLoading(false);
    }
  }, [provider, dateRange]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Prepare chart data
  const chartData = useMemo(() => {
    if (!history.length) return [];

    // Group by time and aggregate
    const sortedHistory = [...history].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    return sortedHistory.map((entry) => {
      const date = new Date(entry.timestamp);
      const dataPoint: Record<string, number | string> = {
        time: date.toLocaleString(undefined, {
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        }),
        timestamp: entry.timestamp,
      };

      entry.limits.forEach((limit) => {
        // utilization is already a percentage (0-100) from the API
        dataPoint[limit.id] = Math.round(limit.utilization);
      });

      return dataPoint;
    });
  }, [history]);

  // Calculate heatmap data (usage by hour and day of week)
  const heatmapData = useMemo(() => {
    if (!history.length) return { grid: [], hourlyAvg: [], dayAvg: [] };

    const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    // Initialize grid: 7 days x 24 hours
    const grid: number[][] = Array(7).fill(null).map(() => Array(24).fill(0));
    const counts: number[][] = Array(7).fill(null).map(() => Array(24).fill(0));

    history.forEach((entry) => {
      const date = new Date(entry.timestamp);
      const day = date.getDay();
      const hour = date.getHours();
      const fiveHourLimit = entry.limits.find((l) => l.id === "five_hour");
      if (fiveHourLimit) {
        // utilization is already a percentage (0-100) from the API
        grid[day][hour] += fiveHourLimit.utilization;
        counts[day][hour]++;
      }
    });

    // Calculate averages
    for (let d = 0; d < 7; d++) {
      for (let h = 0; h < 24; h++) {
        if (counts[d][h] > 0) {
          grid[d][h] = Math.round(grid[d][h] / counts[d][h]);
        }
      }
    }

    // Calculate hourly averages (across all days)
    const hourlyAvg = Array(24).fill(0).map((_, h) => {
      let sum = 0, count = 0;
      for (let d = 0; d < 7; d++) {
        if (counts[d][h] > 0) {
          sum += grid[d][h];
          count++;
        }
      }
      return { hour: h, avg: count > 0 ? Math.round(sum / count) : 0 };
    });

    // Calculate daily averages
    const dayAvg = days.map((name, d) => {
      let sum = 0, count = 0;
      for (let h = 0; h < 24; h++) {
        if (counts[d][h] > 0) {
          sum += grid[d][h];
          count++;
        }
      }
      return { day: name, avg: count > 0 ? Math.round(sum / count) : 0 };
    });

    return { grid, hourlyAvg, dayAvg, days };
  }, [history]);

  // Calculate peak usage times
  const peakUsage = useMemo(() => {
    if (!history.length) return null;

    const hourCounts: { [key: number]: { sum: number; count: number } } = {};
    const dayCounts: { [key: number]: { sum: number; count: number } } = {};

    history.forEach((entry) => {
      const date = new Date(entry.timestamp);
      const hour = date.getHours();
      const day = date.getDay();
      const fiveHourLimit = entry.limits.find((l) => l.id === "five_hour");

      if (fiveHourLimit) {
        // utilization is already a percentage (0-100) from the API
        const util = fiveHourLimit.utilization;

        if (!hourCounts[hour]) hourCounts[hour] = { sum: 0, count: 0 };
        hourCounts[hour].sum += util;
        hourCounts[hour].count++;

        if (!dayCounts[day]) dayCounts[day] = { sum: 0, count: 0 };
        dayCounts[day].sum += util;
        dayCounts[day].count++;
      }
    });

    // Find peak hour
    let peakHour = 0;
    let peakHourAvg = 0;
    Object.entries(hourCounts).forEach(([hour, data]) => {
      const avg = data.sum / data.count;
      if (avg > peakHourAvg) {
        peakHourAvg = avg;
        peakHour = parseInt(hour);
      }
    });

    // Find peak day
    const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    let peakDay = 0;
    let peakDayAvg = 0;
    Object.entries(dayCounts).forEach(([day, data]) => {
      const avg = data.sum / data.count;
      if (avg > peakDayAvg) {
        peakDayAvg = avg;
        peakDay = parseInt(day);
      }
    });

    // Find quietest hour
    let quietHour = 0;
    let quietHourAvg = 100;
    Object.entries(hourCounts).forEach(([hour, data]) => {
      const avg = data.sum / data.count;
      if (avg < quietHourAvg) {
        quietHourAvg = avg;
        quietHour = parseInt(hour);
      }
    });

    return {
      peakHour,
      peakHourFormatted: formatHour(peakHour),
      peakHourAvg: Math.round(peakHourAvg),
      peakDay: days[peakDay],
      peakDayAvg: Math.round(peakDayAvg),
      quietHour,
      quietHourFormatted: formatHour(quietHour),
      quietHourAvg: Math.round(quietHourAvg),
    };
  }, [history]);

  // Calculate comparison stats (current period vs previous period)
  const comparisonStats = useMemo(() => {
    if (!history.length || timeRange === "all") return null;

    const now = new Date();
    let periodMs: number;

    switch (timeRange) {
      case "24h":
        periodMs = 24 * 60 * 60 * 1000;
        break;
      case "7d":
        periodMs = 7 * 24 * 60 * 60 * 1000;
        break;
      case "30d":
        periodMs = 30 * 24 * 60 * 60 * 1000;
        break;
      default:
        return null;
    }

    const currentStart = now.getTime() - periodMs;
    const previousStart = currentStart - periodMs;
    const previousEnd = currentStart;

    // Split history into current and previous periods
    const currentPeriod = history.filter((e) => {
      const ts = new Date(e.timestamp).getTime();
      return ts >= currentStart;
    });

    const previousPeriod = history.filter((e) => {
      const ts = new Date(e.timestamp).getTime();
      return ts >= previousStart && ts < previousEnd;
    });

    // Calculate averages for each period
    const calcAvg = (entries: UsageHistoryEntry[]) => {
      if (!entries.length) return 0;
      const sum = entries.reduce((acc, e) => {
        const fiveHour = e.limits.find((l) => l.id === "five_hour");
        // utilization is already a percentage (0-100) from the API
        return acc + (fiveHour?.utilization ?? 0);
      }, 0);
      return sum / entries.length;
    };

    const currentAvg = calcAvg(currentPeriod);
    const previousAvg = calcAvg(previousPeriod);
    const change = previousAvg > 0 ? ((currentAvg - previousAvg) / previousAvg) * 100 : 0;

    return {
      currentAvg: Math.round(currentAvg),
      previousAvg: Math.round(previousAvg),
      change: Math.round(change),
      currentSamples: currentPeriod.length,
      previousSamples: previousPeriod.length,
      hasPreviousData: previousPeriod.length > 0,
    };
  }, [history, timeRange]);

  // Export handlers
  const handleExportJson = async () => {
    setIsExporting(true);
    try {
      const json = await exportHistoryJson({
        provider,
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
      });

      // Create download
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `ai-pulse-history-${provider}-${new Date().toISOString().split("T")[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to export");
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportCsv = async () => {
    setIsExporting(true);
    try {
      const csv = await exportHistoryCsv({
        provider,
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
      });

      // Create download
      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `ai-pulse-history-${provider}-${new Date().toISOString().split("T")[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to export");
    } finally {
      setIsExporting(false);
    }
  };

  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const handleClearHistory = async () => {
    setShowClearConfirm(true);
  };

  const confirmClearHistory = async () => {
    setShowClearConfirm(false);
    try {
      await clearHistory();
      await loadData();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to clear history");
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Clear Confirmation Dialog */}
      {showClearConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-background border rounded-lg p-6 max-w-sm mx-4 shadow-lg">
            <h3 className="text-lg font-semibold mb-2">Clear History</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Are you sure you want to clear all history data? This cannot be undone.
            </p>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={() => setShowClearConfirm(false)}>
                Cancel
              </Button>
              <Button variant="destructive" size="sm" onClick={confirmClearHistory}>
                Clear All
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Controls */}
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Time Range:</span>
          {(["24h", "7d", "30d", "all"] as TimeRange[]).map((range) => (
            <Button
              key={range}
              variant={timeRange === range ? "default" : "outline"}
              size="sm"
              onClick={() => setTimeRange(range)}
            >
              {range === "all" ? "All" : range}
            </Button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={loadData} disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4 space-y-6">
        {error && (
          <div className="p-3 rounded-md bg-destructive/10 text-destructive text-sm">
            {error}
          </div>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="flex flex-col items-center gap-2 text-muted-foreground">
              <RefreshCw className="h-8 w-8 animate-spin" />
              <p>Loading analytics...</p>
            </div>
          </div>
        ) : history.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
            <p>No history data available</p>
            <p className="text-sm">Usage data will be recorded automatically over time</p>
          </div>
        ) : (
          <>
            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard
                label="Data Points"
                value={metadata?.entryCount.toString() ?? "0"}
              />
              <StatCard
                label="Retention"
                value={`${metadata?.retentionDays ?? 30} days`}
              />
              {stats["five_hour"] && (
                <>
                  <StatCard
                    label="5-Hour Avg"
                    value={`${Math.round(stats["five_hour"].avgUtilization)}%`}
                  />
                  <StatCard
                    label="5-Hour Max"
                    value={`${Math.round(stats["five_hour"].maxUtilization)}%`}
                  />
                </>
              )}
            </div>

            {/* Usage Trend Chart */}
            <div className="border rounded-lg p-4">
              <h3 className="text-sm font-medium mb-4">Usage Trend</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis
                      dataKey="time"
                      tick={{ fontSize: 10 }}
                      interval="preserveStartEnd"
                    />
                    <YAxis
                      domain={[0, 100]}
                      tick={{ fontSize: 10 }}
                      tickFormatter={(value) => `${value}%`}
                    />
                    <Tooltip
                      formatter={(value) => [`${value ?? 0}%`, ""]}
                      labelFormatter={(label) => `Time: ${label}`}
                    />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="five_hour"
                      name="5-Hour Limit"
                      stroke="#3b82f6"
                      strokeWidth={2}
                      dot={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="seven_day"
                      name="Weekly Limit"
                      stroke="#10b981"
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Comparison View */}
            {comparisonStats && timeRange !== "all" && (
              <div className="border rounded-lg p-4">
                <h3 className="text-sm font-medium mb-4">Period Comparison</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="border rounded-lg p-4 text-center">
                    <div className="text-xs text-muted-foreground mb-1">Current {timeRange}</div>
                    <div className="text-2xl font-bold">{comparisonStats.currentAvg}%</div>
                    <div className="text-xs text-muted-foreground">{comparisonStats.currentSamples} samples</div>
                  </div>
                  <div className="border rounded-lg p-4 text-center">
                    <div className="text-xs text-muted-foreground mb-1">Previous {timeRange}</div>
                    {comparisonStats.hasPreviousData ? (
                      <>
                        <div className="text-2xl font-bold">{comparisonStats.previousAvg}%</div>
                        <div className="text-xs text-muted-foreground">{comparisonStats.previousSamples} samples</div>
                      </>
                    ) : (
                      <div className="text-lg text-muted-foreground">No data</div>
                    )}
                  </div>
                  <div className="border rounded-lg p-4 text-center">
                    <div className="text-xs text-muted-foreground mb-1">Change</div>
                    {comparisonStats.hasPreviousData ? (
                      <div className="flex items-center justify-center gap-2">
                        {comparisonStats.change > 0 ? (
                          <TrendingUp className="h-5 w-5 text-red-500" />
                        ) : comparisonStats.change < 0 ? (
                          <TrendingDown className="h-5 w-5 text-green-500" />
                        ) : (
                          <Minus className="h-5 w-5 text-muted-foreground" />
                        )}
                        <span className={`text-2xl font-bold ${
                          comparisonStats.change > 0 ? "text-red-500" :
                          comparisonStats.change < 0 ? "text-green-500" : ""
                        }`}>
                          {comparisonStats.change > 0 ? "+" : ""}{comparisonStats.change}%
                        </span>
                      </div>
                    ) : (
                      <div className="text-lg text-muted-foreground">-</div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Peak Usage Times */}
            {peakUsage && (
              <div className="border rounded-lg p-4">
                <h3 className="text-sm font-medium mb-4">Usage Patterns</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-lg bg-red-100 dark:bg-red-900/30">
                      <Clock className="h-4 w-4 text-red-600 dark:text-red-400" />
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Peak Hour</div>
                      <div className="font-semibold">{peakUsage.peakHourFormatted}</div>
                      <div className="text-xs text-muted-foreground">{peakUsage.peakHourAvg}% avg</div>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-lg bg-red-100 dark:bg-red-900/30">
                      <Calendar className="h-4 w-4 text-red-600 dark:text-red-400" />
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Busiest Day</div>
                      <div className="font-semibold">{peakUsage.peakDay}</div>
                      <div className="text-xs text-muted-foreground">{peakUsage.peakDayAvg}% avg</div>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/30">
                      <Clock className="h-4 w-4 text-green-600 dark:text-green-400" />
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Quietest Hour</div>
                      <div className="font-semibold">{peakUsage.quietHourFormatted}</div>
                      <div className="text-xs text-muted-foreground">{peakUsage.quietHourAvg}% avg</div>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                      <TrendingUp className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Data Points</div>
                      <div className="font-semibold">{history.length}</div>
                      <div className="text-xs text-muted-foreground">in range</div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Usage Heatmap */}
            {heatmapData.grid.length > 0 && heatmapData.days && (
              <div className="border rounded-lg p-4">
                <h3 className="text-sm font-medium mb-4">Usage Heatmap (Hour × Day)</h3>
                <UsageHeatmap grid={heatmapData.grid} days={heatmapData.days} />
              </div>
            )}

            {/* Hourly Distribution Chart */}
            {/* {heatmapData.hourlyAvg.length > 0 && (
              <div className="border rounded-lg p-4">
                <h3 className="text-sm font-medium mb-4">Hourly Distribution</h3>
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={heatmapData.hourlyAvg}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis
                        dataKey="hour"
                        tick={{ fontSize: 10 }}
                        tickFormatter={(h) => h % 4 === 0 ? formatHour(h) : ""}
                      />
                      <YAxis
                        domain={[0, 100]}
                        tick={{ fontSize: 10 }}
                        tickFormatter={(value) => `${value}%`}
                      />
                      <Tooltip
                        formatter={(value) => [`${value ?? 0}%`, "Avg Usage"]}
                        labelFormatter={(h) => formatHour(Number(h))}
                      />
                      <Bar dataKey="avg" fill="#3b82f6" radius={[2, 2, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )} */}

            {/* Export Section */}
            <div className="border rounded-lg p-4">
              <h3 className="text-sm font-medium mb-4">Export Data</h3>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExportJson}
                  disabled={isExporting}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Export JSON
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExportCsv}
                  disabled={isExporting}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Export CSV
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleClearHistory}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Clear
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

interface StatCardProps {
  label: string;
  value: string;
}

function StatCard({ label, value }: StatCardProps) {
  return (
    <div className="border rounded-lg p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-lg font-semibold">{value}</div>
    </div>
  );
}

// Helper function to format hour
function formatHour(hour: number): string {
  const suffix = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 || 12;
  return `${displayHour}${suffix}`;
}

// Get colour for heatmap cell based on usage percentage
function getHeatmapColor(value: number): string {
  if (value === 0) return "bg-muted";
  if (value < 25) return "bg-green-200 dark:bg-green-900";
  if (value < 50) return "bg-yellow-200 dark:bg-yellow-800";
  if (value < 75) return "bg-orange-300 dark:bg-orange-700";
  return "bg-red-400 dark:bg-red-600";
}

// Heatmap component
interface HeatmapProps {
  grid: number[][];
  days: string[];
}

function UsageHeatmap({ grid, days }: HeatmapProps) {
  if (!grid.length) return null;

  const hours = Array.from({ length: 24 }, (_, i) => i);

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[600px]">
        {/* Hour labels */}
        <div className="flex mb-1">
          <div className="w-12" /> {/* Spacer for day labels */}
          {hours.map((h) => (
            <div
              key={h}
              className="flex-1 text-center text-[10px] text-muted-foreground"
            >
              {h % 6 === 0 ? formatHour(h) : ""}
            </div>
          ))}
        </div>

        {/* Grid rows */}
        {days.map((day, dayIndex) => (
          <div key={day} className="flex items-center mb-0.5">
            <div className="w-12 text-xs text-muted-foreground">{day}</div>
            <div className="flex flex-1 gap-0.5">
              {hours.map((hour) => (
                <div
                  key={hour}
                  className={`flex-1 h-5 rounded-sm ${getHeatmapColor(grid[dayIndex]?.[hour] ?? 0)}`}
                  title={`${day} ${formatHour(hour)}: ${grid[dayIndex]?.[hour] ?? 0}%`}
                />
              ))}
            </div>
          </div>
        ))}

        {/* Legend */}
        <div className="flex items-center justify-end mt-3 gap-2 text-[10px] text-muted-foreground">
          <span>Less</span>
          <div className="flex gap-0.5">
            <div className="w-4 h-4 rounded-sm bg-muted" />
            <div className="w-4 h-4 rounded-sm bg-green-200 dark:bg-green-900" />
            <div className="w-4 h-4 rounded-sm bg-yellow-200 dark:bg-yellow-800" />
            <div className="w-4 h-4 rounded-sm bg-orange-300 dark:bg-orange-700" />
            <div className="w-4 h-4 rounded-sm bg-red-400 dark:bg-red-600" />
          </div>
          <span>More</span>
        </div>
      </div>
    </div>
  );
}
