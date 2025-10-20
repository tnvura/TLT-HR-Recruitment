import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface ScheduleInterviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  candidateId: string;
  onSuccess: () => void;
}

export function ScheduleInterviewDialog({ open, onOpenChange, candidateId, onSuccess }: ScheduleInterviewDialogProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    interviewer_email: "",
    interviewer_name: "",
    interview_date: "",
    interview_time: "",
    location: "",
    meeting_link: "",
    notes: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Insert interview
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

      // Get current status
      const { data: candidate } = await supabase
        .from("candidates")
        .select("status")
        .eq("id", candidateId)
        .single();

      // Update candidate status
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
          from_status: candidate?.status,
          to_status: "interview_scheduled",
          changed_by: user.id,
          changed_by_email: user.email,
          notes: "Interview scheduled",
        });

      toast({
        title: "Success",
        description: "Interview scheduled successfully",
      });

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
          <DialogTitle>Schedule Interview</DialogTitle>
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
