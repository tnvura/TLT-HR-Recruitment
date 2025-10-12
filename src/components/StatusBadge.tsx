import { Badge } from "@/components/ui/badge";

interface StatusBadgeProps {
  status: string;
}

const statusConfig: Record<string, { label: string; className: string }> = {
  new: { label: "New", className: "bg-blue-100 text-blue-700 hover:bg-blue-100" },
  shortlisted: { label: "Shortlisted", className: "bg-yellow-100 text-yellow-700 hover:bg-yellow-100" },
  interview: { label: "Interview", className: "bg-purple-100 text-purple-700 hover:bg-purple-100" },
  offer: { label: "Offer", className: "bg-green-100 text-green-700 hover:bg-green-100" },
  hired: { label: "Hired", className: "bg-emerald-100 text-emerald-700 hover:bg-emerald-100" },
  rejected: { label: "Rejected", className: "bg-red-100 text-red-700 hover:bg-red-100" },
  on_hold: { label: "On Hold", className: "bg-gray-100 text-gray-700 hover:bg-gray-100" },
};

export function StatusBadge({ status }: StatusBadgeProps) {
  const config = statusConfig[status] || statusConfig.new;
  return <Badge className={config.className}>{config.label}</Badge>;
}
