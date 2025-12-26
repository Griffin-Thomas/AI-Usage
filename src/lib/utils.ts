import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatPercentage(value: number): string {
  return `${Math.round(value)}%`;
}

export function getUsageColor(utilization: number): string {
  if (utilization < 50) return "text-usage-low";
  if (utilization < 75) return "text-usage-medium";
  return "text-usage-high";
}

export function getUsageColorHex(utilization: number): string {
  if (utilization < 50) return "#22c55e";
  if (utilization < 75) return "#eab308";
  return "#ef4444";
}

export function formatTimeUntil(isoDate: string): string {
  const target = new Date(isoDate);
  const now = new Date();
  const diffMs = target.getTime() - now.getTime();

  if (diffMs <= 0) return "Now";

  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

  if (days > 0) {
    return `${days}d ${hours}h ${minutes}m`;
  }
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

import type { UsageData, UsageLimit } from "./types";

export function formatUsageForClipboard(usage: UsageData): string {
  const lines = [
    `AI Pulse - ${usage.provider.charAt(0).toUpperCase() + usage.provider.slice(1)} Usage`,
    `Updated: ${new Date(usage.timestamp).toLocaleString()}`,
    "",
    ...usage.limits.map((limit) => formatLimitForClipboard(limit)),
  ];
  return lines.join("\n");
}

export function formatLimitForClipboard(limit: UsageLimit): string {
  const resetTime = formatTimeUntil(limit.resetsAt);
  return `${limit.label}: ${Math.round(limit.utilization)}% (resets in ${resetTime})`;
}

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
