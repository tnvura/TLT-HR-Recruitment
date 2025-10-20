import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Mail, User, Edit2, X, Check } from "lucide-react";
import { usePermissions } from "@/hooks/usePermissions";

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
      console.log("Fetching assignment for candidate:", candidateId);

      const { data, error } = await (supabase as any)
        .from("candidate_assignments")
        .select("*")
        .eq("candidate_id", candidateId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      console.log("Assignment query result:", { data, error });

      if (error) {
        console.error("Assignment fetch error:", error);
        console.error("Error details:", JSON.stringify(error, null, 2));
        // Don't throw error, just log it and continue
        // throw error;
      }

      setAssignment(data);

      if (data) {
        setEditForm({
          interviewer_name: data.interviewer_name,
          interviewer_email: data.interviewer_email,
        });
        console.log("Assignment data loaded:", data);
      } else {
        console.log("No assignment found for candidate:", candidateId);
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

    try {
      setIsSaving(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Update the assignment
      const { error: updateError } = await (supabase as any)
        .from("candidate_assignments")
        .update({
          interviewer_name: editForm.interviewer_name,
          interviewer_email: editForm.interviewer_email,
          updated_at: new Date().toISOString(),
        })
        .eq("id", assignment.id);

      if (updateError) throw updateError;

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
