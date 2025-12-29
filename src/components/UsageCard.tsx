import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ContextMenu } from "@/components/ui/context-menu";
import { ProgressRing } from "@/components/ProgressRing";
import { formatTimeUntil, formatLimitForClipboard, copyToClipboard } from "@/lib/utils";
import type { UsageLimit } from "@/lib/types";
import { Clock, Copy, Check, RefreshCw, ExternalLink } from "lucide-react";

interface UsageCardProps {
  limit: UsageLimit;
  onRefresh?: () => void;
  onOpenProvider?: () => void;
  providerName?: string;
}

export function UsageCard({
  limit,
  onRefresh,
  onOpenProvider,
  providerName,
}: UsageCardProps) {
  const [copied, setCopied] = useState(false);
  const resetTime = formatTimeUntil(limit.resetsAt);

  const handleCopy = async (e?: React.MouseEvent) => {
    e?.stopPropagation();
    const text = formatLimitForClipboard(limit);
    const success = await copyToClipboard(text);
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const contextMenuItems = [
    {
      label: "Copy usage",
      icon: <Copy className="h-4 w-4" />,
      onClick: () => handleCopy(),
    },
    ...(onRefresh
      ? [
          {
            label: "Refresh",
            icon: <RefreshCw className="h-4 w-4" />,
            onClick: onRefresh,
          },
        ]
      : []),
    ...(onOpenProvider && providerName
      ? [
          {
            label: `Open ${providerName}`,
            icon: <ExternalLink className="h-4 w-4" />,
            onClick: onOpenProvider,
          },
        ]
      : []),
  ];

  return (
    <ContextMenu items={contextMenuItems}>
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
    </ContextMenu>
  );
}

export function UsageCardSkeleton() {
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
