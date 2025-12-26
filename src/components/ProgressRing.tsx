import { cn, getUsageColorHex } from "@/lib/utils";

interface ProgressRingProps {
  value: number;
  size?: number;
  strokeWidth?: number;
  label?: string;
  showPercentage?: boolean;
  className?: string;
}

export function ProgressRing({
  value,
  size = 120,
  strokeWidth = 8,
  label,
  showPercentage = true,
  className,
}: ProgressRingProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (value / 100) * circumference;
  const color = getUsageColorHex(value);
  const isHighUsage = value >= 90;

  return (
    <div className={cn("relative inline-flex items-center justify-center", className)}>
      <svg width={size} height={size} className="-rotate-90">
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-muted"
        />
        {/* Progress circle with smooth animation */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-700 ease-out origin-center"
          style={{
            filter: isHighUsage ? `drop-shadow(0 0 6px ${color})` : undefined,
          }}
        />
      </svg>
      <div className={cn(
        "absolute inset-0 flex flex-col items-center justify-center",
        isHighUsage && "animate-pulse"
      )}>
        {showPercentage && (
          <span
            className="text-2xl font-bold tabular-nums transition-colors duration-500"
            style={{ color }}
          >
            {Math.round(value)}%
          </span>
        )}
        {label && <span className="text-xs text-muted-foreground mt-1">{label}</span>}
      </div>
    </div>
  );
}
