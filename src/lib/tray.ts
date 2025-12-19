import { TrayIcon } from "@tauri-apps/api/tray";
import { Image } from "@tauri-apps/api/image";
import type { UsageData, UsageLimit } from "./types";
import type { TrayDisplayLimit } from "./tauri";

const TRAY_ID = "main-tray";
const ICON_SIZE = 22; // Standard tray icon size

export type UsageLevel = "low" | "medium" | "high" | "critical";

/**
 * Normalize utilization to a decimal (0-1)
 * Handles both decimal (0.28) and percentage (28) formats
 */
function normalizeUtilization(utilization: number): number {
  // If value is > 1, assume it's already a percentage
  if (utilization > 1) {
    return utilization / 100;
  }
  return utilization;
}

export function getUsageLevel(utilization: number): UsageLevel {
  const normalized = normalizeUtilization(utilization);
  if (normalized < 0.5) return "low";
  if (normalized < 0.75) return "medium";
  if (normalized < 0.9) return "high";
  return "critical";
}

export function getUsageColor(level: UsageLevel): string {
  switch (level) {
    case "low":
      return "#22c55e"; // green-500
    case "medium":
      return "#eab308"; // yellow-500
    case "high":
      return "#f97316"; // orange-500
    case "critical":
      return "#ef4444"; // red-500
  }
}

/**
 * Generate a tray icon with progress ring
 */
function generateIconData(
  percentage: number,
  level: UsageLevel
): Uint8Array {
  const canvas = document.createElement("canvas");
  canvas.width = ICON_SIZE;
  canvas.height = ICON_SIZE;
  const ctx = canvas.getContext("2d");

  if (!ctx) {
    throw new Error("Could not get canvas context");
  }

  const centerX = ICON_SIZE / 2;
  const centerY = ICON_SIZE / 2;
  const radius = ICON_SIZE / 2 - 2;
  const strokeWidth = 3;

  // Clear canvas
  ctx.clearRect(0, 0, ICON_SIZE, ICON_SIZE);

  // Draw background ring (dark gray)
  ctx.strokeStyle = "rgba(255, 255, 255, 0.2)";
  ctx.lineWidth = strokeWidth;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
  ctx.stroke();

  // Draw progress arc
  const color = getUsageColor(level);
  ctx.strokeStyle = color;
  ctx.lineWidth = strokeWidth;
  ctx.lineCap = "round";
  ctx.beginPath();

  // Start from top (-90 degrees = -π/2)
  const startAngle = -Math.PI / 2;
  const endAngle = startAngle + (percentage / 100) * Math.PI * 2;
  ctx.arc(centerX, centerY, radius, startAngle, endAngle);
  ctx.stroke();

  // Draw heartbeat pulse in center (ECG-like wave)
  const pulseWidth = 10;
  const pulseHeight = 4;
  const pulseStartX = centerX - pulseWidth / 2;
  const pulseY = centerY;

  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();

  // Simplified heartbeat: flat - spike up - spike down - flat
  ctx.moveTo(pulseStartX, pulseY);
  ctx.lineTo(pulseStartX + pulseWidth * 0.25, pulseY);
  ctx.lineTo(pulseStartX + pulseWidth * 0.4, pulseY - pulseHeight);
  ctx.lineTo(pulseStartX + pulseWidth * 0.55, pulseY + pulseHeight * 0.6);
  ctx.lineTo(pulseStartX + pulseWidth * 0.7, pulseY - pulseHeight * 0.3);
  ctx.lineTo(pulseStartX + pulseWidth * 0.8, pulseY);
  ctx.lineTo(pulseStartX + pulseWidth, pulseY);
  ctx.stroke();

  // Get image data as RGBA
  const imageData = ctx.getImageData(0, 0, ICON_SIZE, ICON_SIZE);
  return new Uint8Array(imageData.data);
}

/**
 * Get the limit to display based on the user's preference
 */
function getDisplayLimit(usage: UsageData, displayOption: TrayDisplayLimit): UsageLimit | null {
  if (!usage.limits || usage.limits.length === 0) return null;

  // Find specific limit by ID if requested
  if (displayOption === "five_hour") {
    const fiveHour = usage.limits.find(l => l.id === "five_hour");
    if (fiveHour) return fiveHour;
    // Fall back to highest if five_hour not available
  } else if (displayOption === "seven_day") {
    const sevenDay = usage.limits.find(l => l.id === "seven_day");
    if (sevenDay) return sevenDay;
    // Fall back to highest if seven_day not available
  }

  // Default: find the limit with highest normalized utilization (most critical)
  return usage.limits.reduce((max, limit) =>
    normalizeUtilization(limit.utilization) > normalizeUtilization(max.utilization) ? limit : max
  );
}

/**
 * Format a tooltip string from usage data
 */
function formatTooltip(usage: UsageData): string {
  const lines: string[] = ["AI Pulse"];

  for (const limit of usage.limits) {
    const normalized = normalizeUtilization(limit.utilization);
    const percent = Math.min(Math.round(normalized * 100), 100);
    lines.push(`${limit.label}: ${percent}%`);
  }

  return lines.join("\n");
}

/**
 * Update the system tray with current usage data
 */
export async function updateTray(
  usage: UsageData | null,
  displayOption: TrayDisplayLimit = "highest"
): Promise<void> {
  try {
    const tray = await TrayIcon.getById(TRAY_ID);
    if (!tray) {
      console.warn("Tray icon not found");
      return;
    }

    if (!usage || usage.limits.length === 0) {
      // No usage data - show default state
      await tray.setTooltip("AI Pulse\nNo data available");
      return;
    }

    // Get the limit to display based on user preference
    const displayLimit = getDisplayLimit(usage, displayOption);
    if (!displayLimit) return;

    // Normalize utilization and calculate percentage
    const normalizedUtilization = normalizeUtilization(displayLimit.utilization);
    const percentage = Math.min(Math.round(normalizedUtilization * 100), 100);
    const level = getUsageLevel(normalizedUtilization);

    // Generate progress ring icon
    const iconData = generateIconData(percentage, level);
    const image = await Image.new(iconData, ICON_SIZE, ICON_SIZE);
    await tray.setIcon(image);

    // Update tooltip
    const tooltip = formatTooltip(usage);
    await tray.setTooltip(tooltip);
  } catch (err) {
    console.error("Failed to update tray:", err);
  }
}

/**
 * Reset tray to default state (e.g., when credentials are removed)
 */
export async function resetTray(): Promise<void> {
  try {
    const tray = await TrayIcon.getById(TRAY_ID);
    if (!tray) return;

    await tray.setTooltip("AI Pulse\nConfigure credentials in Settings");
  } catch (err) {
    console.error("Failed to reset tray:", err);
  }
}
