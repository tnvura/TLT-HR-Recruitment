import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
    position_level: "",
    job_grade: "",
    current_position: "",
    current_salary: "",
    expected_salary: "",
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

      // Update interview_feedback with HR-filled fields
      const { data: feedbackData } = await (supabase as any)
        .from("interview_feedback")
        .select("id")
        .eq("candidate_id", candidateId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (feedbackData) {
        const { error: feedbackUpdateError } = await (supabase as any)
          .from("interview_feedback")
          .update({
            position_level: formData.position_level || null,
            job_grade: formData.job_grade || null,
            current_position: formData.current_position || null,
            current_salary: formData.current_salary ? parseFloat(formData.current_salary) : null,
            expected_salary: formData.expected_salary ? parseFloat(formData.expected_salary) : null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", feedbackData.id);

        if (feedbackUpdateError) throw feedbackUpdateError;
      }

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
          created_by_email: user.email,
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
          status: "offer_sent",
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
          to_status: "offer_sent",
          changed_by: user.id,
          changed_by_email: user.email,
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
        position_level: "",
        job_grade: "",
        current_position: "",
        current_salary: "",
        expected_salary: "",
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
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Send Job Offer</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-6">
            {/* Candidate Current Information Section */}
            <div className="border-b pb-4">
              <h3 className="text-lg font-semibold mb-3">Candidate Current Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="current_position">Current Position</Label>
                  <Input
                    id="current_position"
                    value={formData.current_position}
                    onChange={(e) => setFormData({ ...formData, current_position: e.target.value })}
                    placeholder="e.g., Senior Developer"
                  />
                </div>
                <div>
                  <Label htmlFor="current_salary">Current Salary</Label>
                  <Input
                    id="current_salary"
                    type="number"
                    step="0.01"
                    value={formData.current_salary}
                    onChange={(e) => setFormData({ ...formData, current_salary: e.target.value })}
                    placeholder="Current salary"
                  />
                </div>
                <div>
                  <Label htmlFor="expected_salary">Expected Salary</Label>
                  <Input
                    id="expected_salary"
                    type="number"
                    step="0.01"
                    value={formData.expected_salary}
                    onChange={(e) => setFormData({ ...formData, expected_salary: e.target.value })}
                    placeholder="Expected salary"
                  />
                </div>
              </div>
            </div>

            {/* Job Offer Details Section */}
            <div>
              <h3 className="text-lg font-semibold mb-3">Job Offer Details</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="position_offered">Position Offered <span className="text-destructive">*</span></Label>
                  <Input
                    id="position_offered"
                    required
                    value={formData.position_offered}
                    onChange={(e) => setFormData({ ...formData, position_offered: e.target.value })}
                    placeholder="e.g., Senior Software Engineer"
                  />
                </div>
                <div>
                  <Label htmlFor="position_level">Position Level</Label>
                  <Select
                    value={formData.position_level}
                    onValueChange={(value) => setFormData({ ...formData, position_level: value })}
                  >
                    <SelectTrigger id="position_level">
                      <SelectValue placeholder="Select level" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="entry">Entry</SelectItem>
                      <SelectItem value="junior">Junior</SelectItem>
                      <SelectItem value="mid">Mid-Level</SelectItem>
                      <SelectItem value="senior">Senior</SelectItem>
                      <SelectItem value="lead">Lead</SelectItem>
                      <SelectItem value="manager">Manager</SelectItem>
                      <SelectItem value="senior-manager">Senior Manager</SelectItem>
                      <SelectItem value="director">Director</SelectItem>
                      <SelectItem value="senior-director">Senior Director</SelectItem>
                      <SelectItem value="vp">Vice President</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="job_grade">Job Grade</Label>
                  <Input
                    id="job_grade"
                    value={formData.job_grade}
                    onChange={(e) => setFormData({ ...formData, job_grade: e.target.value })}
                    placeholder="e.g., G5, L4"
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
                    placeholder="Offered salary"
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
              </div>
              <div className="mt-4">
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Additional details, benefits, or terms"
                  className="min-h-[100px]"
                />
              </div>
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
