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
