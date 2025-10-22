import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Mail, User, Edit2, X, Check } from "lucide-react";
import { usePermissions } from "@/hooks/usePermissions";
import { emailNotifications } from "@/services/emailNotifications";

interface InterviewerInfoProps {
  candidateId: string;
}

interface Assignment {
  id: string;
  interviewer_name: string;
  interviewer_email: string;
  assigned_by_email: string;
  assigned_at: string;
  status: string;
}

export function InterviewerInfo({ candidateId }: InterviewerInfoProps) {
  const { toast } = useToast();
  const permissions = usePermissions();
  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [editForm, setEditForm] = useState({
    interviewer_name: "",
    interviewer_email: "",
  });

  useEffect(() => {
    fetchAssignment();
  }, [candidateId]);

  const fetchAssignment = async () => {
    try {
      setIsLoading(true);

      const { data, error } = await (supabase as any)
        .from("candidate_assignments")
        .select("*")
        .eq("candidate_id", candidateId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error("Assignment fetch error:", error);
      }

      setAssignment(data);

      if (data) {
        setEditForm({
          interviewer_name: data.interviewer_name,
          interviewer_email: data.interviewer_email,
        });
      }
    } catch (error: any) {
      console.error("Error fetching assignment:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEdit = () => {
    setIsEditing(true);
    if (assignment) {
      setEditForm({
        interviewer_name: assignment.interviewer_name,
        interviewer_email: assignment.interviewer_email,
      });
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
    if (assignment) {
      setEditForm({
        interviewer_name: assignment.interviewer_name,
        interviewer_email: assignment.interviewer_email,
      });
    }
  };

  const handleSave = async () => {
    if (!assignment) return;

    // Check if interviewer actually changed
    const interviewerChanged =
      assignment.interviewer_email !== editForm.interviewer_email ||
      assignment.interviewer_name !== editForm.interviewer_name;

    try {
      setIsSaving(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      if (interviewerChanged) {
        // Check if there's an existing scheduled interview
        const { data: existingInterview } = await (supabase as any)
          .from("interviews")
          .select("*")
          .eq("candidate_id", candidateId)
          .eq("status", "scheduled")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        // If there's a scheduled interview, handle interview reassignment
        if (existingInterview && existingInterview.interviewer_email === assignment.interviewer_email) {
          // 1. Cancel old interview
          const { error: cancelError } = await (supabase as any)
            .from("interviews")
            .update({ status: "cancelled" })
            .eq("id", existingInterview.id);

          if (cancelError) throw cancelError;

          // 2. Create new interview with new interviewer (same schedule details)
          const { error: newInterviewError } = await (supabase as any)
            .from("interviews")
            .insert({
              candidate_id: candidateId,
              interviewer_email: editForm.interviewer_email,
              interviewer_name: editForm.interviewer_name,
              interview_date: existingInterview.interview_date,
              interview_time: existingInterview.interview_time,
              location: existingInterview.location,
              meeting_link: existingInterview.meeting_link,
              notes: existingInterview.notes,
              status: "scheduled",
              created_by: user.id,
              created_by_email: user.email,
            });

          if (newInterviewError) throw newInterviewError;
        }

        // Deactivate old assignment
        await (supabase as any)
          .from("candidate_assignments")
          .update({ is_active: false })
          .eq("id", assignment.id);

        // Create new assignment
        await (supabase as any)
          .from("candidate_assignments")
          .insert({
            candidate_id: candidateId,
            interviewer_name: editForm.interviewer_name,
            interviewer_email: editForm.interviewer_email,
            assigned_by: user.id,
            assigned_by_email: user.email,
            status: "pending",
            is_active: true,
          });

        // Fetch candidate data for email and status
        const { data: candidateData, error: candidateError } = await supabase
          .from("candidates")
          .select("*")
          .eq("id", candidateId)
          .single();

        if (candidateData) {
          // Log the interviewer change in status history
          await (supabase as any)
            .from("status_history")
            .insert({
              candidate_id: candidateId,
              from_status: candidateData.status,
              to_status: candidateData.status,
              changed_by: user.id,
              changed_by_email: user.email,
              notes: `Interviewer changed from ${assignment.interviewer_name} (${assignment.interviewer_email}) to ${editForm.interviewer_name} (${editForm.interviewer_email})`,
            });

          // Send email notifications to both old and new interviewer
          await emailNotifications.notifyInterviewerChanged(
            candidateId,
            assignment.interviewer_email,
            assignment.interviewer_name,
            editForm.interviewer_email,
            editForm.interviewer_name,
            user.email!,
            candidateData
          );
        }
      } else {
        // Just update the notes if no interviewer change
        await (supabase as any)
          .from("candidate_assignments")
          .update({
            updated_at: new Date().toISOString(),
          })
          .eq("id", assignment.id);
      }

      toast({
        title: "Success",
        description: "Interviewer information updated successfully",
      });

      setIsEditing(false);
      await fetchAssignment();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Assigned Interviewer</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-2">
            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!assignment) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Assigned Interviewer</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-4">
            No interviewer assigned yet
          </p>
        </CardContent>
      </Card>
    );
  }

  const canUpdate = permissions.canUpdate("candidates") && (permissions.isHRAdmin || permissions.isHRStaff);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle>Assigned Interviewer</CardTitle>
        {!isEditing && canUpdate && (
          <Button variant="ghost" size="sm" onClick={handleEdit}>
            <Edit2 className="h-4 w-4" />
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {isEditing ? (
          <div className="space-y-4">
            <div>
              <Label htmlFor="edit_interviewer_name">Interviewer Name *</Label>
              <Input
                id="edit_interviewer_name"
                value={editForm.interviewer_name}
                onChange={(e) => setEditForm({ ...editForm, interviewer_name: e.target.value })}
                placeholder="Enter interviewer name"
              />
            </div>
            <div>
              <Label htmlFor="edit_interviewer_email">Interviewer Email *</Label>
              <Input
                id="edit_interviewer_email"
                type="email"
                value={editForm.interviewer_email}
                onChange={(e) => setEditForm({ ...editForm, interviewer_email: e.target.value })}
                placeholder="interviewer@company.com"
              />
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={handleSave}
                disabled={isSaving || !editForm.interviewer_name || !editForm.interviewer_email}
              >
                <Check className="h-4 w-4 mr-1" />
                {isSaving ? "Saving..." : "Save"}
              </Button>
              <Button size="sm" variant="outline" onClick={handleCancel} disabled={isSaving}>
                <X className="h-4 w-4 mr-1" />
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Name</p>
                <p className="font-medium">{assignment.interviewer_name}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Email</p>
                <p className="font-medium">{assignment.interviewer_email}</p>
              </div>
            </div>
            <div className="pt-2 border-t text-xs text-muted-foreground">
              <p>Assigned on {new Date(assignment.created_at || assignment.assigned_at).toLocaleDateString()}</p>
              {assignment.assigned_by_email && <p>by {assignment.assigned_by_email}</p>}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
