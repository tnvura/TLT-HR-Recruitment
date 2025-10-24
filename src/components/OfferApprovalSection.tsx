import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { OfferDetailsView } from "./OfferDetailsView";
import { offerNotifications } from "@/services/offerNotifications";
import { emailNotifications } from "@/services/emailNotifications";

interface OfferApprovalSectionProps {
  candidateId: string;
  candidate: any;
  jobProposal: any;
  interviewFeedback?: any;
  userRole: "hr_manager" | "interviewer" | "hr_user";
  onApprovalComplete: () => void;
}

export function OfferApprovalSection({
  candidateId,
  candidate,
  jobProposal,
  interviewFeedback,
  userRole,
  onApprovalComplete,
}: OfferApprovalSectionProps) {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(true);
  const [comments, setComments] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isHRManager = userRole === "hr_manager";
  const isInterviewer = userRole === "interviewer";
  const isHRUser = userRole === "hr_user";

  const handleApprove = async () => {
    setIsSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      if (isHRManager) {
        // HR Manager approval
        const { error: updateError } = await (supabase as any)
          .from("job_proposals")
          .update({
            hr_manager_approved: true,
            hr_manager_approved_by: user.id,
            hr_manager_approved_at: new Date().toISOString(),
            hr_manager_rejection_notes: null, // Clear rejection notes
          })
          .eq("id", jobProposal.id);

        if (updateError) throw updateError;

        // Get interviewer user ID and create notification
        const interviewerId = await offerNotifications.getInterviewerUserId(candidateId);
        if (interviewerId) {
          await offerNotifications.notifyInterviewerAcknowledgment(
            interviewerId,
            candidateId,
            `${candidate.first_name} ${candidate.last_name}`,
            jobProposal.position_offered,
            jobProposal.id
          );
        }

        // Notify HR User (creator) about HR Manager approval
        await offerNotifications.notifyHRUserManagerApproved(
          jobProposal.created_by,
          candidateId,
          `${candidate.first_name} ${candidate.last_name}`,
          jobProposal.position_offered,
          jobProposal.id
        );

        // Send email notification to interviewer about HR Manager approval
        if (interviewerId) {
          // Get interviewer email from interviews table
          const { data: interview } = await (supabase as any)
            .from("interviews")
            .select("interviewer_email, interviewer_name")
            .eq("candidate_id", candidateId)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          if (interview?.interviewer_email) {
            await emailNotifications.notifyOfferApprovedByHRManager(
              candidateId,
              interview.interviewer_email,
              interview.interviewer_name || interview.interviewer_email,
              user.email!,
              candidate,
              {
                position_offered: jobProposal.position_offered,
                company_name: jobProposal.company_name,
              }
            );
          }
        }

        toast({
          title: "Approved",
          description: "Job offer approved successfully. HR User and Interviewer have been notified.",
        });
      } else if (isInterviewer) {
        // Interviewer acknowledgment (final approval)
        const { error: updateError } = await (supabase as any)
          .from("job_proposals")
          .update({
            interviewer_acknowledged: true,
            interviewer_acknowledged_by: user.id,
            interviewer_acknowledged_at: new Date().toISOString(),
            interviewer_rejection_notes: null, // Clear rejection notes
          })
          .eq("id", jobProposal.id);

        if (updateError) throw updateError;

        // Update candidate status to offer_sent
        const { error: statusError } = await supabase
          .from("candidates")
          .update({
            status: "offer_sent",
            updated_by: user.id,
            updated_by_email: user.email,
          })
          .eq("id", candidateId);

        if (statusError) throw statusError;

        // Create status history
        await (supabase as any)
          .from("status_history")
          .insert({
            candidate_id: candidateId,
            from_status: "pending_approval",
            to_status: "offer_sent",
            changed_by: user.id,
            changed_by_email: user.email,
            notes: "Job offer acknowledged by interviewer - final approval",
          });

        // Send notifications to HR User and HR Manager
        await offerNotifications.notifyOfferApprovalComplete(
          jobProposal.created_by,
          jobProposal.assigned_hr_manager_id,
          candidateId,
          `${candidate.first_name} ${candidate.last_name}`,
          jobProposal.position_offered,
          jobProposal.id
        );

        toast({
          title: "Acknowledged",
          description: "Job offer acknowledged successfully. Candidate status updated to Offer Sent. HR User and HR Manager have been notified.",
        });
      }

      onApprovalComplete();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReject = async () => {
    if (!comments.trim()) {
      toast({
        title: "Validation Error",
        description: "Please provide rejection notes/comments",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      if (isHRManager) {
        // HR Manager rejection
        const { error: updateError } = await (supabase as any)
          .from("job_proposals")
          .update({
            hr_manager_rejection_notes: comments,
          })
          .eq("id", jobProposal.id);

        if (updateError) throw updateError;

        // Notify HR User (creator) about rejection
        await offerNotifications.notifyHRUserRejection(
          jobProposal.created_by,
          candidateId,
          `${candidate.first_name} ${candidate.last_name}`,
          jobProposal.position_offered,
          jobProposal.id,
          "HR Manager"
        );

        // Send email notification
        await offerNotifications.sendEmail({
          candidateId,
          eventType: "offer_rejected_by_hr_manager",
          recipientEmail: jobProposal.created_by_email,
          recipientName: "HR User",
          data: {
            candidate_name: `${candidate.first_name} ${candidate.last_name}`,
            position_offered: jobProposal.position_offered,
            company_name: jobProposal.company_name,
            rejected_by: user.email,
            rejected_by_role: "HR Manager",
            rejection_notes: comments,
            rejected_at: new Date().toISOString(),
          },
        });
      } else if (isInterviewer) {
        // Interviewer rejection - also reset HR Manager approval
        const { error: updateError } = await (supabase as any)
          .from("job_proposals")
          .update({
            interviewer_rejection_notes: comments,
            hr_manager_approved: false,
            hr_manager_approved_by: null,
            hr_manager_approved_at: null,
          })
          .eq("id", jobProposal.id);

        if (updateError) throw updateError;

        // Notify HR User (creator) about rejection
        await offerNotifications.notifyHRUserRejection(
          jobProposal.created_by,
          candidateId,
          `${candidate.first_name} ${candidate.last_name}`,
          jobProposal.position_offered,
          jobProposal.id,
          "Interviewer"
        );

        // Send email notification
        await offerNotifications.sendEmail({
          candidateId,
          eventType: "offer_rejected_by_interviewer",
          recipientEmail: jobProposal.created_by_email,
          recipientName: "HR User",
          data: {
            candidate_name: `${candidate.first_name} ${candidate.last_name}`,
            position_offered: jobProposal.position_offered,
            company_name: jobProposal.company_name,
            rejected_by: user.email,
            rejected_by_role: "Interviewer",
            rejection_notes: comments,
            rejected_at: new Date().toISOString(),
          },
        });
      }

      // Status stays at pending_approval (no status change needed)
      // Create status history
      await (supabase as any)
        .from("status_history")
        .insert({
          candidate_id: candidateId,
          from_status: "pending_approval",
          to_status: "pending_approval",
          changed_by: user.id,
          changed_by_email: user.email,
          notes: `Job offer rejected by ${isHRManager ? "HR Manager" : "Interviewer"}: ${comments}`,
        });

      toast({
        title: "Rejected",
        description: "Job offer has been rejected. HR User has been notified to make amendments.",
      });

      onApprovalComplete();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const title = isHRUser
    ? "Offer Approval Status"
    : isHRManager
    ? "Pending HR Manager Approval"
    : "Pending Interviewer Acknowledgment";

  const approveButtonText = isHRManager ? "Approve" : "Acknowledge";

  return (
    <Card className="border-orange-200 bg-orange-50">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="text-orange-700">{title}</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Collapsible open={isOpen} onOpenChange={setIsOpen}>
          <CollapsibleTrigger asChild>
            <Button variant="outline" className="w-full justify-between">
              {isOpen ? "Hide" : "Show"} Offer Details
              {isOpen ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-4">
            <OfferDetailsView
              interviewFeedback={interviewFeedback}
              jobProposal={jobProposal}
              candidate={candidate}
            />
          </CollapsibleContent>
        </Collapsible>

        {!isHRUser && (
          <>
            <div className="space-y-2">
              <Label htmlFor="comments">Comments (optional for approval, required for rejection)</Label>
              <Textarea
                id="comments"
                value={comments}
                onChange={(e) => setComments(e.target.value)}
                placeholder="Add your comments here..."
                className="min-h-[100px]"
              />
            </div>

            <div className="flex gap-3">
              <Button
                variant="destructive"
                onClick={handleReject}
                disabled={isSubmitting}
                className="flex-1"
              >
                {isSubmitting ? "Processing..." : "Reject"}
              </Button>
              <Button onClick={handleApprove} disabled={isSubmitting} className="flex-1">
                {isSubmitting ? "Processing..." : approveButtonText}
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
