import { StatusBadge } from "./StatusBadge";

interface StatusHistoryItem {
  id: string;
  from_status: string;
  to_status: string;
  changed_by_email: string;
  changed_at: string;
  notes: string;
  reason: string;
}

interface StatusHistoryTimelineProps {
  history: StatusHistoryItem[];
}

export function StatusHistoryTimeline({ history }: StatusHistoryTimelineProps) {
  if (history.length === 0) {
    return (
      <p className="text-muted-foreground text-center py-8">No status changes yet</p>
    );
  }

  return (
    <div className="space-y-4">
      {history.map((item, index) => (
        <div key={item.id} className="flex gap-4">
          <div className="flex flex-col items-center">
            <div className="w-3 h-3 rounded-full bg-primary" />
            {index < history.length - 1 && (
              <div className="w-0.5 h-full bg-border mt-2" />
            )}
          </div>
          <div className="flex-1 pb-4">
            <div className="flex items-center gap-2 mb-1">
              <StatusBadge status={item.to_status} />
              <span className="text-sm text-muted-foreground">
                {new Date(item.changed_at).toLocaleString()}
              </span>
            </div>
            <p className="text-sm text-muted-foreground">
              Changed by {item.changed_by_email || "Unknown"}
            </p>
            {(item.notes || item.reason) && (
              <p className="text-sm mt-1">{item.notes || item.reason}</p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
