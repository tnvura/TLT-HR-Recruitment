import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface SendOfferDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  candidateId: string;
  onSuccess: () => void;
}

export function SendOfferDialog({ open, onOpenChange, candidateId, onSuccess }: SendOfferDialogProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    position_offered: "",
    job_grade: "",
    salary_offered: "",
    start_date: "",
    notes: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: userRole } = await (supabase as any)
        .from("user_roles")
        .select("email")
        .eq("user_id", user.id)
        .single();

      // Insert job proposal
      const { error: proposalError } = await (supabase as any)
        .from("job_proposals")
        .insert({
          candidate_id: candidateId,
          position_offered: formData.position_offered,
          job_grade: formData.job_grade,
          salary_offered: formData.salary_offered ? parseFloat(formData.salary_offered) : null,
          start_date: formData.start_date,
          notes: formData.notes,
          offer_status: "pending",
          offer_sent_date: new Date().toISOString().split("T")[0],
          created_by: user.id,
          created_by_email: userRole?.email,
        });

      if (proposalError) throw proposalError;

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
          status: "offer",
          updated_by: user.id,
          updated_by_email: userRole?.email,
        })
        .eq("id", candidateId);

      if (updateError) throw updateError;

      // Insert status history
      await (supabase as any)
        .from("status_history")
        .insert({
          candidate_id: candidateId,
          from_status: candidate?.status,
          to_status: "offer",
          changed_by: user.id,
          changed_by_email: userRole?.email,
          notes: "Job offer sent",
        });

      toast({
        title: "Success",
        description: "Job offer sent successfully",
      });

      onSuccess();
      onOpenChange(false);
      setFormData({
        position_offered: "",
        job_grade: "",
        salary_offered: "",
        start_date: "",
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
          <DialogTitle>Send Job Offer</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div>
              <Label htmlFor="position_offered">Position Offered *</Label>
              <Input
                id="position_offered"
                required
                value={formData.position_offered}
                onChange={(e) => setFormData({ ...formData, position_offered: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="job_grade">Job Grade</Label>
              <Input
                id="job_grade"
                value={formData.job_grade}
                onChange={(e) => setFormData({ ...formData, job_grade: e.target.value })}
                placeholder="e.g., Senior, Junior, Lead"
              />
            </div>
            <div>
              <Label htmlFor="salary_offered">Salary Offered</Label>
              <Input
                id="salary_offered"
                type="number"
                step="0.01"
                value={formData.salary_offered}
                onChange={(e) => setFormData({ ...formData, salary_offered: e.target.value })}
                placeholder="Annual salary"
              />
            </div>
            <div>
              <Label htmlFor="start_date">Start Date</Label>
              <Input
                id="start_date"
                type="date"
                value={formData.start_date}
                onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Additional details or benefits"
              />
            </div>
          </div>
          <DialogFooter className="mt-6">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Sending..." : "Send Offer"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
