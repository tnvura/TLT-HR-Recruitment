import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface ShortlistDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  candidateId: string;
  onSuccess: () => void;
}

export function ShortlistDialog({ open, onOpenChange, candidateId, onSuccess }: ShortlistDialogProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    interviewer_name: "",
    interviewer_email: "",
    notes: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Get current status
      const { data: candidate } = await supabase
        .from("candidates")
        .select("status")
        .eq("id", candidateId)
        .single();

      // Update candidate status to shortlisted
      const { error: updateError } = await supabase
        .from("candidates")
        .update({
          status: "shortlisted",
          updated_by: user.id,
          updated_by_email: user.email,
        })
        .eq("id", candidateId);

      if (updateError) throw updateError;

      // Insert status history
      const { error: historyError } = await (supabase as any)
        .from("status_history")
        .insert({
          candidate_id: candidateId,
          from_status: candidate?.status,
          to_status: "shortlisted",
          changed_by: user.id,
          changed_by_email: user.email,
          notes: formData.notes || "Candidate shortlisted and assigned to interviewer",
        });

      if (historyError) {
        console.error("History insert error:", historyError);
        throw new Error(`Failed to create status history: ${historyError.message}`);
      }

      // Create candidate assignment for interviewer
      const { error: assignmentError } = await (supabase as any)
        .from("candidate_assignments")
        .insert({
          candidate_id: candidateId,
          interviewer_name: formData.interviewer_name,
          interviewer_email: formData.interviewer_email,
          assigned_by: user.id,
          assigned_by_email: user.email,
          status: "pending",
          notes: formData.notes || null,
        });

      if (assignmentError) {
        console.error("Assignment insert error:", assignmentError);
        throw new Error(`Failed to assign interviewer: ${assignmentError.message}`);
      }

      toast({
        title: "Success",
        description: "Candidate shortlisted and assigned to interviewer",
      });

      onSuccess();
      onOpenChange(false);
      setFormData({
        interviewer_name: "",
        interviewer_email: "",
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
          <DialogTitle>Shortlist Candidate</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div>
              <Label htmlFor="interviewer_name">Interviewer Name *</Label>
              <Input
                id="interviewer_name"
                required
                value={formData.interviewer_name}
                onChange={(e) => setFormData({ ...formData, interviewer_name: e.target.value })}
                placeholder="Enter interviewer name"
              />
            </div>
            <div>
              <Label htmlFor="interviewer_email">Interviewer Email *</Label>
              <Input
                id="interviewer_email"
                type="email"
                required
                value={formData.interviewer_email}
                onChange={(e) => setFormData({ ...formData, interviewer_email: e.target.value })}
                placeholder="interviewer@company.com"
              />
            </div>
            <div>
              <Label htmlFor="notes">Notes (Optional)</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Additional notes for the interviewer"
                rows={3}
              />
            </div>
            <div className="text-sm text-muted-foreground bg-blue-50 p-3 rounded-md">
              <p>
                The interviewer will receive access to review this candidate and provide feedback
                for the interview decision.
              </p>
            </div>
          </div>
          <DialogFooter className="mt-6">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Processing..." : "Shortlist & Assign"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
