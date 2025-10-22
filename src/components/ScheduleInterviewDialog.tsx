import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { emailNotifications } from "@/services/emailNotifications";

interface Assignment {
  interviewer_name: string;
  interviewer_email: string;
}

interface ScheduleInterviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  candidateId: string;
  onSuccess: () => void;
  assignment?: Assignment | null;
}

export function ScheduleInterviewDialog({ open, onOpenChange, candidateId, onSuccess, assignment }: ScheduleInterviewDialogProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [existingInterview, setExistingInterview] = useState<any>(null);
  const [formData, setFormData] = useState({
    interviewer_email: "",
    interviewer_name: "",
    interview_date: "",
    interview_time: "",
    location: "",
    meeting_link: "",
    notes: "",
  });

  // Fetch existing scheduled interview and update form data when dialog opens
  useEffect(() => {
    const fetchExistingInterview = async () => {
      if (open && candidateId) {
        // Fetch the most recent scheduled interview
        const { data: scheduledInterview } = await (supabase as any)
          .from("interviews")
          .select("*")
          .eq("candidate_id", candidateId)
          .eq("status", "scheduled")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        setExistingInterview(scheduledInterview);

        // Pre-fill form with existing interview or assignment data
        if (scheduledInterview) {
          setFormData({
            interviewer_email: scheduledInterview.interviewer_email || "",
            interviewer_name: scheduledInterview.interviewer_name || "",
            interview_date: scheduledInterview.interview_date || "",
            interview_time: scheduledInterview.interview_time || "",
            location: scheduledInterview.location || "",
            meeting_link: scheduledInterview.meeting_link || "",
            notes: scheduledInterview.notes || "",
          });
        } else if (assignment) {
          setFormData(prev => ({
            ...prev,
            interviewer_email: assignment.interviewer_email || "",
            interviewer_name: assignment.interviewer_name || "",
          }));
        }
      }
    };

    fetchExistingInterview();
  }, [open, candidateId, assignment]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Get current candidate data
      const { data: candidate } = await supabase
        .from("candidates")
        .select("*")
        .eq("id", candidateId)
        .single();

      if (!candidate) throw new Error("Candidate not found");

      // Determine scenario
      const isReschedule = existingInterview && existingInterview.interviewer_email === formData.interviewer_email;
      const isReassignment = existingInterview && existingInterview.interviewer_email !== formData.interviewer_email;

      if (isReschedule) {
        // SCENARIO A: Reschedule (same interviewer, update existing record)
        const { error: updateError } = await (supabase as any)
          .from("interviews")
          .update({
            interview_date: formData.interview_date,
            interview_time: formData.interview_time,
            location: formData.location,
            meeting_link: formData.meeting_link,
            notes: formData.notes,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existingInterview.id);

        if (updateError) throw updateError;

        // Send reschedule notification to interviewer and candidate
        await emailNotifications.notifyInterviewScheduled(
          candidateId,
          formData.interviewer_email,
          formData.interviewer_name,
          candidate.email,
          `${candidate.first_name} ${candidate.last_name}`,
          {
            interview_date: formData.interview_date,
            interview_time: formData.interview_time,
            location: formData.location,
            meeting_link: formData.meeting_link,
            notes: formData.notes,
          },
          user.email!
        );

        toast({
          title: "Success",
          description: "Interview rescheduled successfully",
        });
      } else if (isReassignment) {
        // SCENARIO B: Interviewer Reassignment

        // 1. Cancel old interview
        const { error: cancelError } = await (supabase as any)
          .from("interviews")
          .update({ status: "cancelled" })
          .eq("id", existingInterview.id);

        if (cancelError) throw cancelError;

        // 2. Create new interview with new interviewer
        const { error: newInterviewError } = await (supabase as any)
          .from("interviews")
          .insert({
            candidate_id: candidateId,
            interviewer_email: formData.interviewer_email,
            interviewer_name: formData.interviewer_name,
            interview_date: formData.interview_date,
            interview_time: formData.interview_time,
            location: formData.location,
            meeting_link: formData.meeting_link,
            notes: formData.notes,
            status: "scheduled",
            created_by: user.id,
            created_by_email: user.email,
          });

        if (newInterviewError) throw newInterviewError;

        // 3. Update candidate_assignments - deactivate old, create new
        await (supabase as any)
          .from("candidate_assignments")
          .update({ is_active: false })
          .eq("candidate_id", candidateId)
          .eq("interviewer_email", existingInterview.interviewer_email);

        await (supabase as any)
          .from("candidate_assignments")
          .insert({
            candidate_id: candidateId,
            interviewer_name: formData.interviewer_name,
            interviewer_email: formData.interviewer_email,
            assigned_by: user.id,
            assigned_by_email: user.email,
            status: "pending",
            notes: `Reassigned from ${existingInterview.interviewer_name}`,
          });

        // 4. Send cancellation email to old interviewer
        // Note: We'll need to add this email notification method
        // await emailNotifications.notifyInterviewCancelled(...)

        // 5. Send assignment email to new interviewer
        await emailNotifications.notifyCandidateAssigned(
          candidateId,
          formData.interviewer_email,
          formData.interviewer_name,
          user.email!,
          candidate
        );

        toast({
          title: "Success",
          description: "Interviewer reassigned successfully",
        });
      } else {
        // SCENARIO C: New interview (no existing scheduled interview)

        // Insert new interview
        const { error: interviewError } = await (supabase as any)
          .from("interviews")
          .insert({
            candidate_id: candidateId,
            interviewer_email: formData.interviewer_email,
            interviewer_name: formData.interviewer_name,
            interview_date: formData.interview_date,
            interview_time: formData.interview_time,
            location: formData.location,
            meeting_link: formData.meeting_link,
            notes: formData.notes,
            status: "scheduled",
            created_by: user.id,
            created_by_email: user.email,
          });

        if (interviewError) throw interviewError;

        // Update candidate status if not already interview_scheduled
        if (candidate.status !== "interview_scheduled") {
          const { error: updateError } = await supabase
            .from("candidates")
            .update({
              status: "interview_scheduled",
              updated_by: user.id,
              updated_by_email: user.email,
            })
            .eq("id", candidateId);

          if (updateError) throw updateError;

          // Insert status history
          await (supabase as any)
            .from("status_history")
            .insert({
              candidate_id: candidateId,
              from_status: candidate.status,
              to_status: "interview_scheduled",
              changed_by: user.id,
              changed_by_email: user.email,
              notes: "Interview scheduled",
            });
        }

        // Send email notifications to interviewer and candidate
        await emailNotifications.notifyInterviewScheduled(
          candidateId,
          formData.interviewer_email,
          formData.interviewer_name,
          candidate.email,
          `${candidate.first_name} ${candidate.last_name}`,
          {
            interview_date: formData.interview_date,
            interview_time: formData.interview_time,
            location: formData.location,
            meeting_link: formData.meeting_link,
            notes: formData.notes,
          },
          user.email!
        );

        toast({
          title: "Success",
          description: "Interview scheduled successfully",
        });
      }

      onSuccess();
      onOpenChange(false);
      setFormData({
        interviewer_email: "",
        interviewer_name: "",
        interview_date: "",
        interview_time: "",
        location: "",
        meeting_link: "",
        notes: "",
      });
      setExistingInterview(null);
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{existingInterview ? "Reschedule Interview" : "Schedule Interview"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div>
              <Label htmlFor="interviewer_email">Interviewer Email *</Label>
              <Input
                id="interviewer_email"
                type="email"
                required
                value={formData.interviewer_email}
                onChange={(e) => setFormData({ ...formData, interviewer_email: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="interviewer_name">Interviewer Name</Label>
              <Input
                id="interviewer_name"
                value={formData.interviewer_name}
                onChange={(e) => setFormData({ ...formData, interviewer_name: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="interview_date">Interview Date *</Label>
              <Input
                id="interview_date"
                type="date"
                required
                value={formData.interview_date}
                onChange={(e) => setFormData({ ...formData, interview_date: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="interview_time">Interview Time *</Label>
              <Input
                id="interview_time"
                type="time"
                required
                value={formData.interview_time}
                onChange={(e) => setFormData({ ...formData, interview_time: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="location">Location</Label>
              <Input
                id="location"
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                placeholder="Office location or room"
              />
            </div>
            <div>
              <Label htmlFor="meeting_link">Meeting Link</Label>
              <Input
                id="meeting_link"
                type="url"
                value={formData.meeting_link}
                onChange={(e) => setFormData({ ...formData, meeting_link: e.target.value })}
                placeholder="https://meet.google.com/..."
              />
            </div>
            <div>
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Additional information"
              />
            </div>
          </div>
          <DialogFooter className="mt-6">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Scheduling..." : "Schedule Interview"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
