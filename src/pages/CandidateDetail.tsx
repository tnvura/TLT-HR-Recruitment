import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Mail, Phone, Briefcase, GraduationCap, Calendar } from "lucide-react";
import logo from "@/assets/talaadthai-logo.png";
import { usePermissions } from "@/hooks/usePermissions";
import { StatusBadge } from "@/components/StatusBadge";
import { ScheduleInterviewDialog } from "@/components/ScheduleInterviewDialog";
import { SendOfferDialog } from "@/components/SendOfferDialog";
import { StatusHistoryTimeline } from "@/components/StatusHistoryTimeline";

interface Candidate {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone_number: string;
  position_applied: string;
  status: string;
  created_at: string;
  education_level: string;
  years_of_experience: string;
  current_position: string;
  current_employer: string;
  institution: string;
  message: string;
  cv_file_url: string;
}

interface Interview {
  id: string;
  scheduled_date: string;
  scheduled_time: string;
  interviewer_name: string;
  interviewer_email: string;
  status: string;
  location: string;
  meeting_link: string;
  notes: string;
}

interface StatusHistory {
  id: string;
  from_status: string;
  to_status: string;
  changed_by_email: string;
  changed_at: string;
  notes: string;
  reason: string;
}

export default function CandidateDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const permissions = usePermissions();

  const [candidate, setCandidate] = useState<Candidate | null>(null);
  const [interviews, setInterviews] = useState<Interview[]>([]);
  const [statusHistory, setStatusHistory] = useState<StatusHistory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showScheduleDialog, setShowScheduleDialog] = useState(false);
  const [showOfferDialog, setShowOfferDialog] = useState(false);

  useEffect(() => {
    fetchCandidateData();
  }, [id]);

  const fetchCandidateData = async () => {
    try {
      setIsLoading(true);

      // Fetch candidate details
      const { data: candidateData, error: candidateError } = await supabase
        .from("candidates")
        .select("*")
        .eq("id", id)
        .single();

      if (candidateError) throw candidateError;
      setCandidate(candidateData);

      // Fetch interviews
      const { data: interviewsData, error: interviewsError } = await (supabase as any)
        .from("interviews")
        .select(
          "id, scheduled_date, scheduled_time, interviewer_name, interviewer_email, status, location, meeting_link, notes",
        )
        .eq("candidate_id", id)
        .order("scheduled_date", { ascending: false });

      if (interviewsError) throw interviewsError;
      setInterviews(interviewsData || []);

      // Fetch status history
      const { data: historyData, error: historyError } = await (supabase as any)
        .from("status_history")
        .select("*")
        .eq("candidate_id", id)
        .order("changed_at", { ascending: false });

      if (historyError) throw historyError;
      setStatusHistory(historyData || []);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: userRole } = await (supabase as any)
        .from("user_roles")
        .select("email")
        .eq("user_id", user.id)
        .single();

      // Update candidate status
      const { error: updateError } = await supabase
        .from("candidates")
        .update({
          status: newStatus,
          updated_by: user.id,
        })
        .eq("id", id);

      if (updateError) throw updateError;

      // Insert status history
      await (supabase as any)
        .from("status_history")
        .insert({
          candidate_id: id,
          from_status: candidate?.status,
          to_status: newStatus,
          changed_by: user.id,
          changed_by_email: userRole?.email,
        });

      toast({
        title: "Success",
        description: `Status updated to ${newStatus}`,
      });

      fetchCandidateData();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const getStatusActions = () => {
    if (!candidate) return [];

    const canUpdate = permissions.canUpdate("candidates");
    if (!canUpdate) return [];

    const actions: Array<{ label: string; onClick: () => void; variant?: any }> = [];

    switch (candidate.status) {
      case "new":
        actions.push(
          { label: "Shortlist", onClick: () => handleStatusChange("shortlisted") },
          { label: "Schedule Interview", onClick: () => setShowScheduleDialog(true) },
          { label: "Put On Hold", onClick: () => handleStatusChange("on_hold") },
          { label: "Reject", onClick: () => handleStatusChange("rejected"), variant: "destructive" }
        );
        break;
      case "shortlisted":
        actions.push(
          { label: "Schedule Interview", onClick: () => setShowScheduleDialog(true) },
          { label: "Send Offer", onClick: () => setShowOfferDialog(true) },
          { label: "Put On Hold", onClick: () => handleStatusChange("on_hold") },
          { label: "Reject", onClick: () => handleStatusChange("rejected"), variant: "destructive" }
        );
        break;
      case "interview":
        actions.push(
          { label: "Send Offer", onClick: () => setShowOfferDialog(true) },
          { label: "Put On Hold", onClick: () => handleStatusChange("on_hold") },
          { label: "Reject", onClick: () => handleStatusChange("rejected"), variant: "destructive" }
        );
        break;
      case "offer":
        actions.push(
          { label: "Mark as Hired", onClick: () => handleStatusChange("hired") },
          { label: "Reject", onClick: () => handleStatusChange("rejected"), variant: "destructive" }
        );
        break;
      case "on_hold":
        actions.push(
          { label: "Back to Shortlist", onClick: () => handleStatusChange("shortlisted") },
          { label: "Schedule Interview", onClick: () => setShowScheduleDialog(true) },
          { label: "Reject", onClick: () => handleStatusChange("rejected"), variant: "destructive" }
        );
        break;
    }

    return actions;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!candidate) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4">Candidate not found</h2>
          <Button onClick={() => navigate("/candidates")}>Back to Candidates</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container mx-auto px-6 py-4">
          <img src={logo} alt="TalaadThai" className="h-24 w-auto mb-2" />
        </div>
      </header>

      <div className="container mx-auto px-6 py-8">
        <Button variant="ghost" onClick={() => navigate("/candidates")} className="mb-6">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Candidates
        </Button>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Candidate Profile */}
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Candidate Profile</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">First Name</p>
                    <p className="font-medium">{candidate.first_name}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Last Name</p>
                    <p className="font-medium">{candidate.last_name}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <p>{candidate.email}</p>
                </div>

                {candidate.phone_number && (
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <p>{candidate.phone_number}</p>
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <Briefcase className="h-4 w-4 text-muted-foreground" />
                  <p>{candidate.position_applied}</p>
                </div>

                {candidate.education_level && (
                  <div className="flex items-center gap-2">
                    <GraduationCap className="h-4 w-4 text-muted-foreground" />
                    <p>
                      {candidate.education_level} - {candidate.institution}
                    </p>
                  </div>
                )}

                {candidate.years_of_experience && (
                  <div>
                    <p className="text-sm text-muted-foreground">Years of Experience</p>
                    <p className="font-medium">{candidate.years_of_experience}</p>
                  </div>
                )}

                {candidate.current_position && (
                  <div>
                    <p className="text-sm text-muted-foreground">Current Position</p>
                    <p className="font-medium">
                      {candidate.current_position} at {candidate.current_employer}
                    </p>
                  </div>
                )}

                {candidate.message && (
                  <div>
                    <p className="text-sm text-muted-foreground">Message</p>
                    <p className="mt-1">{candidate.message}</p>
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <p>Applied on {new Date(candidate.created_at).toLocaleDateString()}</p>
                </div>
              </CardContent>
            </Card>

            {/* Interviews */}
            <Card>
              <CardHeader>
                <CardTitle>Interview History</CardTitle>
              </CardHeader>
              <CardContent>
                {interviews.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">No interviews scheduled</p>
                ) : (
                  <div className="space-y-4">
                    {interviews.map((interview) => (
                      <div key={interview.id} className="border rounded-lg p-4">
                        <div className="flex items-center justify-between mb-2">
                          <p className="font-medium">{interview.interviewer_name}</p>
                          <span
                            className={`px-2 py-1 rounded text-xs ${
                              interview.status === "completed"
                                ? "bg-green-100 text-green-700"
                                : interview.status === "scheduled"
                                  ? "bg-blue-100 text-blue-700"
                                  : "bg-gray-100 text-gray-700"
                            }`}
                          >
                            {interview.status}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {new Date(interview.scheduled_date).toLocaleDateString()} at {interview.scheduled_time}
                        </p>
                        {interview.location && <p className="text-sm mt-1">Location: {interview.location}</p>}
                        {interview.notes && <p className="text-sm mt-2 text-muted-foreground">{interview.notes}</p>}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Status Management */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Status Management</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <p className="text-sm text-muted-foreground mb-2">Current Status</p>
                    <StatusBadge status={candidate.status} />
                  </div>

                  {getStatusActions().length > 0 && (
                    <div className="flex flex-col gap-2">
                      {getStatusActions().map((action, index) => (
                        <Button
                          key={index}
                          variant={action.variant || "outline"}
                          onClick={action.onClick}
                          className="w-full"
                        >
                          {action.label}
                        </Button>
                      ))}
                    </div>
                  )}

                  {candidate.cv_file_url && (
                    <Button className="w-full" variant="outline" asChild>
                      <a href={candidate.cv_file_url} target="_blank" rel="noopener noreferrer">
                        View CV
                      </a>
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Status History</CardTitle>
              </CardHeader>
              <CardContent>
                <StatusHistoryTimeline history={statusHistory} />
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      <ScheduleInterviewDialog
        open={showScheduleDialog}
        onOpenChange={setShowScheduleDialog}
        candidateId={id!}
        onSuccess={fetchCandidateData}
      />

      <SendOfferDialog
        open={showOfferDialog}
        onOpenChange={setShowOfferDialog}
        candidateId={id!}
        onSuccess={fetchCandidateData}
      />
    </div>
  );
}
