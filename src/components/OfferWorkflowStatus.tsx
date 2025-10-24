import { format } from "date-fns";
import { CheckCircle2, Clock, XCircle, Send } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface OfferWorkflowStatusProps {
  jobProposal: any;
}

export function OfferWorkflowStatus({ jobProposal }: OfferWorkflowStatusProps) {
  // Check if offer is currently being held by HR Staff for editing
  const isBeingPrepared = jobProposal.hr_manager_rejection_notes || jobProposal.interviewer_rejection_notes;

  // Check if offer has been resubmitted after rejection
  const isResubmitted = !isBeingPrepared &&
    jobProposal.updated_at &&
    new Date(jobProposal.updated_at).getTime() > new Date(jobProposal.created_at).getTime();

  // Determine submission stage details
  let submissionLabel: string;
  let submissionStatus: string;
  let submissionUser: string;
  let submissionTime: string;

  if (isBeingPrepared) {
    // Offer is being edited after rejection
    submissionLabel = "Being prepared by HR Staff";
    submissionStatus = "pending";
    submissionUser = jobProposal.updated_by_email || jobProposal.created_by_email;
    submissionTime = jobProposal.updated_at || jobProposal.created_at;
  } else if (isResubmitted) {
    // Offer has been resubmitted
    submissionLabel = "Resubmitted by HR Staff";
    submissionStatus = "completed";
    submissionUser = jobProposal.updated_by_email;
    submissionTime = jobProposal.updated_at;
  } else {
    // Initial submission
    submissionLabel = "Submitted by HR Staff";
    submissionStatus = "completed";
    submissionUser = jobProposal.created_by_email;
    submissionTime = jobProposal.created_at;
  }

  // Determine workflow stages
  const stages = [
    {
      name: submissionLabel,
      status: submissionStatus,
      icon: submissionStatus === "pending" ? Clock : Send,
      user: submissionUser,
      timestamp: submissionTime,
      notes: null,
    },
    {
      name: "HR Manager Approval",
      status: jobProposal.hr_manager_rejection_notes
        ? "rejected"
        : jobProposal.hr_manager_approved
        ? "approved"
        : "pending",
      icon: jobProposal.hr_manager_rejection_notes
        ? XCircle
        : jobProposal.hr_manager_approved
        ? CheckCircle2
        : Clock,
      user: jobProposal.hr_manager_approved
        ? jobProposal.assigned_hr_manager_email
        : jobProposal.hr_manager_rejection_notes
        ? jobProposal.assigned_hr_manager_email
        : jobProposal.assigned_hr_manager_email,
      timestamp: jobProposal.hr_manager_approved
        ? jobProposal.hr_manager_approved_at
        : null,
      notes: jobProposal.hr_manager_rejection_notes,
    },
    {
      name: "Interviewer Acknowledgment",
      status: jobProposal.interviewer_rejection_notes
        ? "rejected"
        : jobProposal.interviewer_acknowledged
        ? "acknowledged"
        : jobProposal.hr_manager_approved && !jobProposal.hr_manager_rejection_notes
        ? "pending"
        : "waiting",
      icon: jobProposal.interviewer_rejection_notes
        ? XCircle
        : jobProposal.interviewer_acknowledged
        ? CheckCircle2
        : Clock,
      user: null, // Will be populated from interviews table if needed
      timestamp: jobProposal.interviewer_acknowledged
        ? jobProposal.interviewer_acknowledged_at
        : null,
      notes: jobProposal.interviewer_rejection_notes,
    },
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
      case "approved":
      case "acknowledged":
        return "text-green-600 bg-green-50 border-green-200";
      case "rejected":
        return "text-red-600 bg-red-50 border-red-200";
      case "pending":
        return "text-orange-600 bg-orange-50 border-orange-200";
      case "waiting":
        return "text-gray-400 bg-gray-50 border-gray-200";
      default:
        return "text-gray-600 bg-gray-50 border-gray-200";
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "completed":
        return "Submitted";
      case "approved":
        return "Approved";
      case "acknowledged":
        return "Acknowledged";
      case "rejected":
        return "Rejected";
      case "pending":
        return "Pending";
      case "waiting":
        return "Awaiting Previous Step";
      default:
        return status;
    }
  };

  return (
    <Card className="border-blue-200 bg-blue-50">
      <CardHeader>
        <CardTitle className="text-lg text-blue-700">Offer Approval Workflow Status</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {stages.map((stage, index) => {
            const Icon = stage.icon;
            const isLast = index === stages.length - 1;

            return (
              <div key={stage.name} className="relative">
                {/* Connector line */}
                {!isLast && (
                  <div
                    className={`absolute left-5 top-10 w-0.5 h-8 ${
                      stage.status === "completed" ||
                      stage.status === "approved" ||
                      stage.status === "acknowledged"
                        ? "bg-green-300"
                        : "bg-gray-300"
                    }`}
                  />
                )}

                {/* Stage card */}
                <div
                  className={`flex items-start gap-3 p-3 rounded-lg border ${getStatusColor(
                    stage.status
                  )}`}
                >
                  <Icon className="h-5 w-5 mt-0.5 flex-shrink-0" />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <h4 className="font-medium text-sm">{stage.name}</h4>
                      <Badge
                        variant="outline"
                        className={`text-xs ${getStatusColor(stage.status)}`}
                      >
                        {getStatusLabel(stage.status)}
                      </Badge>
                    </div>

                    {stage.user && (
                      <p className="text-xs opacity-75 mb-1">
                        {stage.status === "pending" ? "Assigned to: " : "By: "}
                        {stage.user}
                      </p>
                    )}

                    {stage.timestamp && (
                      <p className="text-xs opacity-75">
                        {format(new Date(stage.timestamp), "PPP 'at' p")}
                      </p>
                    )}

                    {stage.notes && (
                      <div className="mt-2 p-2 bg-white/50 rounded border border-current/20">
                        <p className="text-xs font-medium mb-1">Rejection Notes:</p>
                        <p className="text-xs whitespace-pre-wrap">{stage.notes}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
