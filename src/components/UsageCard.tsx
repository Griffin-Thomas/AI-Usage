import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ProgressRing } from "@/components/ProgressRing";
import { formatTimeUntil, formatLimitForClipboard, copyToClipboard } from "@/lib/utils";
import type { UsageLimit } from "@/lib/types";
import { Clock, Copy, Check } from "lucide-react";

interface UsageCardProps {
  limit: UsageLimit;
  compact?: boolean;
}

export function UsageCard({ limit, compact = false }: UsageCardProps) {
  const [copied, setCopied] = useState(false);
  const resetTime = formatTimeUntil(limit.resetsAt);

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const text = formatLimitForClipboard(limit);
    const success = await copyToClipboard(text);
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

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
            {Math.round(limit.utilization)}%
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="group relative">
      <button
        onClick={handleCopy}
        className="absolute top-3 right-3 p-1.5 rounded-md opacity-0 group-hover:opacity-100 transition-opacity hover:bg-muted"
        title="Copy to clipboard"
      >
        {copied ? (
          <Check className="h-4 w-4 text-green-500" />
        ) : (
          <Copy className="h-4 w-4 text-muted-foreground" />
        )}
      </button>
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

interface UsageCardSkeletonProps {
  compact?: boolean;
}

export function UsageCardSkeleton({ compact = false }: UsageCardSkeletonProps) {
  if (compact) {
    return (
      <Card className="p-3">
        <div className="flex items-center gap-3">
          <Skeleton className="h-12 w-12 rounded-full" />
          <div className="flex-1 min-w-0 space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-3 w-16" />
          </div>
          <Skeleton className="h-6 w-10" />
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <Skeleton className="h-5 w-32" />
      </CardHeader>
      <CardContent className="flex flex-col items-center gap-4">
        <Skeleton className="h-[100px] w-[100px] rounded-full" />
        <div className="flex items-center gap-1">
          <Skeleton className="h-4 w-4 rounded" />
          <Skeleton className="h-4 w-24" />
        </div>
      </CardContent>
    </Card>
  );
}
