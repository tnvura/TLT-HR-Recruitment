import { Badge } from "@/components/ui/badge";

interface StatusBadgeProps {
  status: string;
}

const statusConfig: Record<string, { label: string; className: string }> = {
  new: { label: "New", className: "bg-blue-100 text-blue-700 hover:bg-blue-100" },
  shortlisted: { label: "Shortlisted", className: "bg-yellow-100 text-yellow-700 hover:bg-yellow-100" },
  to_interview: { label: "To Interview", className: "bg-amber-100 text-amber-700 hover:bg-amber-100" },
  interview_scheduled: { label: "Interview Scheduled", className: "bg-purple-100 text-purple-700 hover:bg-purple-100" },
  interviewed: { label: "Interviewed", className: "bg-indigo-100 text-indigo-700 hover:bg-indigo-100" },
  to_offer: { label: "To Offer", className: "bg-cyan-100 text-cyan-700 hover:bg-cyan-100" },
  pending_approval: { label: "Pending Approval", className: "bg-orange-100 text-orange-700 hover:bg-orange-100" },
  offer_sent: { label: "Offer Sent", className: "bg-green-100 text-green-700 hover:bg-green-100" },
  offer_accepted: { label: "Offer Accepted", className: "bg-teal-100 text-teal-700 hover:bg-teal-100" },
  hired: { label: "Hired", className: "bg-emerald-100 text-emerald-700 hover:bg-emerald-100" },
  rejected: { label: "Rejected", className: "bg-red-100 text-red-700 hover:bg-red-100" },
  offer_rejected: { label: "Offer Rejected", className: "bg-rose-100 text-rose-700 hover:bg-rose-100" },
  on_hold: { label: "On Hold", className: "bg-gray-100 text-gray-700 hover:bg-gray-100" },
};

export function StatusBadge({ status }: StatusBadgeProps) {
  const config = statusConfig[status] || statusConfig.new;
  return <Badge className={config.className}>{config.label}</Badge>;
}
