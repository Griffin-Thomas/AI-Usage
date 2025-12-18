import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ProgressRing } from "@/components/ProgressRing";
import { formatTimeUntil } from "@/lib/utils";
import type { UsageLimit } from "@/lib/types";
import { Clock } from "lucide-react";

interface UsageCardProps {
  limit: UsageLimit;
  compact?: boolean;
}

export function UsageCard({ limit, compact = false }: UsageCardProps) {
  const resetTime = formatTimeUntil(limit.resetsAt);

  if (compact) {
    return (
      <Card className="p-3">
        <div className="flex items-center gap-3">
          <ProgressRing value={limit.utilization} size={48} strokeWidth={4} />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{limit.label}</p>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              <span>{resetTime}</span>
            </div>
          </div>
          <div className="text-lg font-semibold tabular-nums">
            {Math.round(limit.utilization * 100)}%
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-medium">{limit.label}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col items-center gap-4">
        <ProgressRing value={limit.utilization} size={100} strokeWidth={8} />
        <div className="flex items-center gap-1 text-sm text-muted-foreground">
          <Clock className="h-4 w-4" />
          <span>Resets in {resetTime}</span>
        </div>
      </CardContent>
    </Card>
  );
}
