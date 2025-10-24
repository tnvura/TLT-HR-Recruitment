import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { usePermissions } from "@/hooks/usePermissions";
import { Eye, Calendar, CheckCircle2, Clock, Users } from "lucide-react";
import logo from "@/assets/talaadthai-logo.png";
import { StatusBadge } from "@/components/StatusBadge";
import { format } from "date-fns";
import { TablePagination } from "@/components/TablePagination";
import { NotificationBell } from "@/components/NotificationBell";

interface AssignedCandidate {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  position_applied: string;
  status: string;
  created_at: string;
  assigned_at: string;
  assigned_by_email: string;
  interview_date?: string;
  interview_time?: string;
}

export default function InterviewerDashboard() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const permissions = usePermissions();
  const [allCandidates, setAllCandidates] = useState<AssignedCandidate[]>([]);
  const [filteredCandidates, setFilteredCandidates] = useState<AssignedCandidate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [userEmail, setUserEmail] = useState<string>("");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);
  const [pendingOffersCount, setPendingOffersCount] = useState(0);

  // Calculate pagination
  const totalPages = Math.ceil(filteredCandidates.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedCandidates = filteredCandidates.slice(startIndex, endIndex);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handleItemsPerPageChange = (newItemsPerPage: number) => {
    setItemsPerPage(newItemsPerPage);
    setCurrentPage(1); // Reset to first page when changing items per page
  };

  useEffect(() => {
    // Redirect HR staff (only interviewer and HR admin can access)
    if (!permissions.isLoading && !permissions.isInterviewer && !permissions.isHRAdmin) {
      toast({
        title: "Access Denied",
        description: "Only interviewers and HR admins can access this dashboard",
        variant: "destructive",
      });
      navigate("/candidates");
      return;
    }

    if (permissions.isInterviewer) {
      fetchAssignedCandidates();
      fetchPendingOffersCount();
    }

    // HR Admin can view all candidates (no filtering needed for now)
    if (permissions.isHRAdmin) {
      fetchAssignedCandidates();
      fetchPendingOffersCount();
    }
  }, [permissions.isInterviewer, permissions.isHRAdmin, permissions.isLoading]);

  // Apply filter when statusFilter changes
  useEffect(() => {
    applyFilter(allCandidates, statusFilter);
    setCurrentPage(1); // Reset to first page when filter changes
  }, [statusFilter, allCandidates]);

  const applyFilter = (candidates: AssignedCandidate[], filter: string) => {
    let filtered = candidates;
    if (filter !== "all") {
      filtered = candidates.filter(c => {
        switch (filter) {
          case "shortlisted":
            return c.status === "shortlisted";
          case "to_interview":
            return c.status === "to_interview";
          case "interview_scheduled":
            return c.status === "interview_scheduled";
          case "interviewed":
            return c.status === "interviewed" ||
                   c.status === "to_offer" ||
                   c.status === "pending_approval" ||
                   c.status === "offer_sent" ||
                   c.status === "offer_accepted" ||
                   c.status === "offer_rejected" ||
                   c.status === "hired" ||
                   c.status === "on_hold" ||
                   c.status === "rejected";
          default:
            return true;
        }
      });
    }
    setFilteredCandidates(filtered);
  };

  const fetchAssignedCandidates = async () => {
    try {
      setIsLoading(true);
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        throw new Error("Not authenticated");
      }

      setUserEmail(user.email || "");

      // Build query based on role
      let assignmentsQuery = (supabase as any)
        .from("candidate_assignments")
        .select(`
          candidate_id,
          created_at,
          assigned_by_email,
          candidates (
            id,
            first_name,
            last_name,
            email,
            position_applied,
            status,
            created_at
          )
        `)
        .eq("is_active", true);

      // For interviewers, filter by their email. For HR admins, show all assignments
      if (permissions.isInterviewer && !permissions.isHRAdmin) {
        assignmentsQuery = assignmentsQuery.eq("interviewer_email", user.email);
      }

      const { data: assignments, error: assignmentsError } = await assignmentsQuery
        .order("created_at", { ascending: false });

      if (assignmentsError) throw assignmentsError;

      // Fetch interview schedules for assigned candidates
      const candidateIds = assignments?.map(a => a.candidate_id) || [];
      let interviewsData: any[] = [];

      if (candidateIds.length > 0) {
        const { data: interviews } = await (supabase as any)
          .from("interviews")
          .select("candidate_id, interview_date, interview_time, status")
          .in("candidate_id", candidateIds)
          .eq("interviewer_email", user.email)
          .order("interview_date", { ascending: false });

        interviewsData = interviews || [];
      }

      // Combine data
      const candidatesData: AssignedCandidate[] = assignments?.map(assignment => {
        const candidate = assignment.candidates;
        const interview = interviewsData.find(i => i.candidate_id === assignment.candidate_id);

        return {
          id: candidate.id,
          first_name: candidate.first_name,
          last_name: candidate.last_name,
          email: candidate.email,
          position_applied: candidate.position_applied,
          status: candidate.status,
          created_at: candidate.created_at,
          assigned_at: assignment.created_at,
          assigned_by_email: assignment.assigned_by_email,
          interview_date: interview?.interview_date,
          interview_time: interview?.interview_time,
        };
      }) || [];

      // Store all candidates
      setAllCandidates(candidatesData);

      // Apply initial filter
      applyFilter(candidatesData, statusFilter);
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

  const fetchPendingOffersCount = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get interviewer's assigned candidates
      const { data: assignmentsData } = await (supabase as any)
        .from("candidate_assignments")
        .select("candidate_id")
        .eq("interviewer_email", user.email)
        .eq("is_active", true);

      if (!assignmentsData || assignmentsData.length === 0) {
        setPendingOffersCount(0);
        return;
      }

      const candidateIds = assignmentsData.map((a: any) => a.candidate_id);

      // Count pending offers (HR Manager approved but not acknowledged by interviewer)
      const { data: pendingOffers, error } = await (supabase as any)
        .from("job_proposals")
        .select("id")
        .in("candidate_id", candidateIds)
        .eq("hr_manager_approved", true)
        .eq("interviewer_acknowledged", false);

      if (error) throw error;

      setPendingOffersCount(pendingOffers?.length || 0);
    } catch (error: any) {
      console.error("Error fetching pending offers count:", error);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/login");
  };

  const getStats = () => {
    const total = allCandidates.length;
    const pendingReview = allCandidates.filter(c => c.status === "shortlisted").length;
    const toInterview = allCandidates.filter(c => c.status === "to_interview").length;
    const scheduled = allCandidates.filter(c => c.status === "interview_scheduled").length;
    const feedbacked = allCandidates.filter(c =>
      c.status === "interviewed" ||
      c.status === "to_offer" ||
      c.status === "pending_approval" ||
      c.status === "offer_sent" ||
      c.status === "offer_accepted" ||
      c.status === "offer_rejected" ||
      c.status === "hired" ||
      c.status === "on_hold" ||
      c.status === "rejected"
    ).length;

    return { total, pendingReview, toInterview, scheduled, feedbacked };
  };

  const stats = getStats();

  if (permissions.isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-start justify-between">
            <img src={logo} alt="TalaadThai" className="h-24 w-auto" />
            <div className="flex flex-col items-end">
              {userEmail && (
                <span className="text-sm text-muted-foreground pt-1.5 pb-1.5">{userEmail}</span>
              )}
              <div className="flex items-center gap-4 pt-1.5">
                <Button
                  variant="outline"
                  onClick={() => navigate("/interviewer/offers")}
                  className="relative"
                >
                  Job Offers
                  {pendingOffersCount > 0 && (
                    <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-destructive text-destructive-foreground text-xs flex items-center justify-center font-semibold">
                      {pendingOffersCount > 9 ? "9+" : pendingOffersCount}
                    </span>
                  )}
                </Button>
                <NotificationBell />
                <Button variant="outline" onClick={handleLogout}>
                  Logout
                </Button>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-6 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Interviewer Dashboard</h1>
          <p className="text-muted-foreground">Review and manage your assigned candidates</p>
        </div>

        {/* Stats Cards - Clickable Filters */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-8">
          <Card
            className={`cursor-pointer transition-all hover:shadow-md ${
              statusFilter === "all" ? "ring-2 ring-primary bg-accent" : ""
            }`}
            onClick={() => setStatusFilter("all")}
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Assigned</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
            </CardContent>
          </Card>

          <Card
            className={`cursor-pointer transition-all hover:shadow-md ${
              statusFilter === "shortlisted" ? "ring-2 ring-primary bg-accent" : ""
            }`}
            onClick={() => setStatusFilter("shortlisted")}
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending Review</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.pendingReview}</div>
            </CardContent>
          </Card>

          <Card
            className={`cursor-pointer transition-all hover:shadow-md ${
              statusFilter === "to_interview" ? "ring-2 ring-primary bg-accent" : ""
            }`}
            onClick={() => setStatusFilter("to_interview")}
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending Schedule</CardTitle>
              <Eye className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.toInterview}</div>
            </CardContent>
          </Card>

          <Card
            className={`cursor-pointer transition-all hover:shadow-md ${
              statusFilter === "interview_scheduled" ? "ring-2 ring-primary bg-accent" : ""
            }`}
            onClick={() => setStatusFilter("interview_scheduled")}
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Scheduled</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.scheduled}</div>
            </CardContent>
          </Card>

          <Card
            className={`cursor-pointer transition-all hover:shadow-md ${
              statusFilter === "interviewed" ? "ring-2 ring-primary bg-accent" : ""
            }`}
            onClick={() => setStatusFilter("interviewed")}
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Feedbacked</CardTitle>
              <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.feedbacked}</div>
            </CardContent>
          </Card>
        </div>

        {/* Candidates List */}
        <Card>
          <CardHeader>
            <CardTitle>Assigned Candidates</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8">Loading...</div>
            ) : filteredCandidates.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {statusFilter === "all"
                  ? "No candidates assigned to you yet"
                  : "No candidates found with this status"}
              </div>
            ) : (
              <>
                <div className="max-h-[700px] overflow-y-auto space-y-4 pr-2">
                  {paginatedCandidates.map((candidate) => (
                  <div
                    key={candidate.id}
                    className="border rounded-lg p-4 hover:bg-accent/50 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-lg font-semibold">
                            {candidate.first_name} {candidate.last_name}
                          </h3>
                          <StatusBadge status={candidate.status} />
                        </div>
                        <p className="text-sm text-muted-foreground mb-1">
                          Position: {candidate.position_applied}
                        </p>
                        <p className="text-sm text-muted-foreground mb-1">
                          Email: {candidate.email}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Assigned: {format(new Date(candidate.assigned_at), "MMM dd, yyyy")}
                        </p>
                        {candidate.interview_date && (
                          <p className="text-sm text-primary font-medium mt-2">
                            <Calendar className="inline h-4 w-4 mr-1" />
                            Interview: {format(new Date(candidate.interview_date), "MMM dd, yyyy")} at {candidate.interview_time}
                          </p>
                        )}
                      </div>
                      <div className="flex flex-col gap-2">
                        <Button
                          size="sm"
                          onClick={() => navigate(`/candidates/${candidate.id}`)}
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          View Details
                        </Button>
                        {candidate.status === "interviewed" && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => navigate(`/interviewer/feedback/${candidate.id}`)}
                          >
                            Submit Feedback
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <TablePagination
                currentPage={currentPage}
                totalPages={totalPages}
                totalItems={filteredCandidates.length}
                itemsPerPage={itemsPerPage}
                onPageChange={handlePageChange}
                onItemsPerPageChange={handleItemsPerPageChange}
              />
            </>
          )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
