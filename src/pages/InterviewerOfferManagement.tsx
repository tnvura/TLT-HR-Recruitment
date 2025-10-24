import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { usePermissions } from "@/hooks/usePermissions";
import { Eye, ArrowLeft, CheckCircle2, Clock, XCircle, ChevronDown, ChevronRight } from "lucide-react";
import logo from "@/assets/talaadthai-logo.png";
import { TablePagination } from "@/components/TablePagination";
import { NotificationBell } from "@/components/NotificationBell";

interface JobOffer {
  id: string;
  candidate_id: string;
  candidate_name: string;
  position_offered: string;
  expected_salary: string;
  employment_type: string;
  hr_manager_approved: boolean;
  interviewer_acknowledged: boolean;
  hr_manager_rejection_notes: string | null;
  interviewer_rejection_notes: string | null;
  created_at: string;
  candidate_status: string;
}

export default function InterviewerOfferManagement() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const permissions = usePermissions();
  const [allOffers, setAllOffers] = useState<JobOffer[]>([]);
  const [filteredOffers, setFilteredOffers] = useState<JobOffer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("pending");
  const [userEmail, setUserEmail] = useState<string>("");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);
  const [expandedSections, setExpandedSections] = useState({
    pending: true,
    acknowledged: false,
  });

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  // Calculate pagination
  const totalPages = Math.ceil(filteredOffers.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedOffers = filteredOffers.slice(startIndex, endIndex);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handleItemsPerPageChange = (newItemsPerPage: number) => {
    setItemsPerPage(newItemsPerPage);
    setCurrentPage(1);
  };

  useEffect(() => {
    // Redirect non-interviewers
    if (!permissions.isLoading && !permissions.isInterviewer && !permissions.isHRAdmin) {
      toast({
        title: "Access Denied",
        description: "Only interviewers can access this page",
        variant: "destructive",
      });
      navigate("/candidates");
      return;
    }

    fetchUserEmail();
    fetchOffers();
  }, [permissions.isLoading, permissions.isInterviewer, permissions.isHRAdmin]);

  useEffect(() => {
    applyFilter();
    setCurrentPage(1);
  }, [statusFilter, allOffers]);

  const fetchUserEmail = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user?.email) {
      setUserEmail(user.email);
    }
  };

  const fetchOffers = async () => {
    try {
      setIsLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Get interviewer's email from interviews/candidate_assignments
      const { data: assignmentsData } = await (supabase as any)
        .from("candidate_assignments")
        .select("candidate_id")
        .eq("interviewer_email", user.email)
        .eq("is_active", true);

      if (!assignmentsData || assignmentsData.length === 0) {
        setAllOffers([]);
        return;
      }

      const candidateIds = assignmentsData.map((a: any) => a.candidate_id);

      // Fetch job proposals for these candidates
      const { data: proposalsData, error: proposalsError } = await (supabase as any)
        .from("job_proposals")
        .select(`
          id,
          candidate_id,
          position_offered,
          employment_type,
          hr_manager_approved,
          interviewer_acknowledged,
          hr_manager_rejection_notes,
          interviewer_rejection_notes,
          created_at
        `)
        .in("candidate_id", candidateIds)
        .order("created_at", { ascending: false });

      if (proposalsError) throw proposalsError;

      // Fetch candidate details and interview feedback for each proposal
      const offersWithCandidates = await Promise.all(
        (proposalsData || []).map(async (proposal: any) => {
          const { data: candidateData } = await supabase
            .from("candidates")
            .select("first_name, last_name, status")
            .eq("id", proposal.candidate_id)
            .single();

          // Fetch interview feedback for expected salary
          const { data: feedbackData } = await (supabase as any)
            .from("interview_feedback")
            .select("expected_salary")
            .eq("candidate_id", proposal.candidate_id)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          return {
            ...proposal,
            candidate_name: candidateData
              ? `${candidateData.first_name} ${candidateData.last_name}`
              : "Unknown",
            candidate_status: candidateData?.status || "unknown",
            expected_salary: feedbackData?.expected_salary || null,
          };
        })
      );

      setAllOffers(offersWithCandidates);
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

  const applyFilter = () => {
    let filtered = [...allOffers];

    switch (statusFilter) {
      case "pending":
        filtered = filtered.filter(
          o => o.hr_manager_approved && !o.interviewer_acknowledged
        );
        break;
      case "acknowledged":
        filtered = filtered.filter(o => o.interviewer_acknowledged);
        break;
      case "rejected":
        filtered = filtered.filter(
          o => o.interviewer_rejection_notes !== null
        );
        break;
      // "all" shows everything
    }

    setFilteredOffers(filtered);
  };

  const getStats = () => {
    const total = allOffers.length;
    const pending = allOffers.filter(
      o => o.hr_manager_approved && !o.interviewer_acknowledged
    ).length;
    const acknowledged = allOffers.filter(o => o.interviewer_acknowledged).length;
    const rejected = allOffers.filter(o => o.interviewer_rejection_notes !== null).length;

    return { total, pending, acknowledged, rejected };
  };

  const stats = getStats();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/login");
  };

  const getOfferStatusBadge = (offer: JobOffer) => {
    if (offer.interviewer_rejection_notes) {
      return <span className="px-2 py-1 rounded text-xs bg-red-100 text-red-700">Rejected</span>;
    }
    if (offer.interviewer_acknowledged) {
      return <span className="px-2 py-1 rounded text-xs bg-green-100 text-green-700">Acknowledged</span>;
    }
    if (offer.hr_manager_approved) {
      return <span className="px-2 py-1 rounded text-xs bg-orange-100 text-orange-700">Pending Acknowledgment</span>;
    }
    return <span className="px-2 py-1 rounded text-xs bg-gray-100 text-gray-700">Awaiting HR Manager</span>;
  };

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
                  onClick={() => navigate("/interviewer/dashboard")}
                >
                  Dashboard
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
        <Button
          variant="ghost"
          onClick={() => navigate("/interviewer/dashboard")}
          className="mb-6"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Dashboard
        </Button>

        <div className="grid grid-cols-1 lg:grid-cols-8 gap-6">
          {/* Status Cards Sidebar */}
          <Card className="p-6 h-fit lg:col-span-1">
            <h2 className="text-xl font-semibold mb-6">Offer Status</h2>

            <div className="space-y-6">
              {/* All Section */}
              <div>
                <Card
                  className={`cursor-pointer transition-all hover:shadow-md px-2 py-1.5 bg-teal-100 border-teal-300 ${
                    statusFilter === "all" ? "ring-2 ring-teal-500" : ""
                  }`}
                  onClick={() => setStatusFilter("all")}
                >
                  <div className="text-[10px] text-teal-700 mb-0.5">All</div>
                  <div className="text-base font-bold text-teal-900">{stats.total}</div>
                </Card>
              </div>

              {/* Pending Section */}
              <div>
                <div
                  className="flex items-center justify-between cursor-pointer mb-2 hover:bg-accent/50 rounded px-1 py-1"
                  onClick={() => toggleSection('pending')}
                >
                  <h3 className="text-sm font-medium text-muted-foreground">Action Needed</h3>
                  {expandedSections.pending ? (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
                {expandedSections.pending && (
                  <Card
                    className={`cursor-pointer transition-all hover:shadow-md px-2 py-1.5 bg-orange-100 border-orange-300 ${
                      statusFilter === "pending" ? "ring-2 ring-orange-500" : ""
                    }`}
                    onClick={() => setStatusFilter("pending")}
                  >
                    <div className="text-[10px] text-orange-700 mb-0.5">Pending</div>
                    <div className="text-base font-bold text-orange-900">{stats.pending}</div>
                  </Card>
                )}
              </div>

              {/* Acknowledged Section */}
              <div>
                <div
                  className="flex items-center justify-between cursor-pointer mb-2 hover:bg-accent/50 rounded px-1 py-1"
                  onClick={() => toggleSection('acknowledged')}
                >
                  <h3 className="text-sm font-medium text-muted-foreground">Completed</h3>
                  {expandedSections.acknowledged ? (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
                {expandedSections.acknowledged && (
                  <Card
                    className={`cursor-pointer transition-all hover:shadow-md px-2 py-1.5 bg-green-100 border-green-300 ${
                      statusFilter === "acknowledged" ? "ring-2 ring-green-500" : ""
                    }`}
                    onClick={() => setStatusFilter("acknowledged")}
                  >
                    <div className="text-[10px] text-green-700 mb-0.5">Acknowledged</div>
                    <div className="text-base font-bold text-green-900">{stats.acknowledged}</div>
                  </Card>
                )}
              </div>
            </div>
          </Card>

          {/* Main Content */}
          <div className="lg:col-span-7">
            <div className="flex items-center justify-between mb-6">
              <h1 className="text-3xl font-bold">Job Offers</h1>
            </div>

            <Card>
              <div className="relative">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-primary hover:bg-primary border-b">
                        <th className="h-12 px-4 text-primary-foreground font-medium" style={{ textAlign: 'center', width: '60px' }}>#</th>
                        <th className="h-12 px-4 text-primary-foreground font-medium" style={{ textAlign: 'center', width: '180px' }}>Candidate</th>
                        <th className="h-12 px-4 text-primary-foreground font-medium" style={{ textAlign: 'center', width: '200px' }}>Position</th>
                        <th className="h-12 px-4 text-primary-foreground font-medium" style={{ textAlign: 'center', width: '130px' }}>Salary</th>
                        <th className="h-12 px-4 text-primary-foreground font-medium" style={{ textAlign: 'center', width: '120px' }}>Type</th>
                        <th className="h-12 px-4 text-primary-foreground font-medium" style={{ textAlign: 'center', width: '160px' }}>Status</th>
                        <th className="h-12 px-4 text-primary-foreground font-medium" style={{ textAlign: 'center', width: '100px' }}>View</th>
                      </tr>
                    </thead>
                  </table>
                </div>
                <div className="max-h-[585px] overflow-y-auto">
                  <table className="w-full">
                    <tbody>
                      {isLoading ? (
                        <tr className="border-b transition-colors hover:bg-muted/50">
                          <td colSpan={7} className="p-4 text-center py-8">
                            Loading...
                          </td>
                        </tr>
                      ) : filteredOffers.length === 0 ? (
                        <tr className="border-b transition-colors hover:bg-muted/50">
                          <td colSpan={7} className="p-4 text-center py-8 text-muted-foreground">
                            No offers found
                          </td>
                        </tr>
                      ) : (
                        paginatedOffers.map((offer, index) => (
                          <tr key={offer.id} className="border-b transition-colors hover:bg-muted/50">
                            <td className="p-4 text-center" style={{ width: '60px' }}>{startIndex + index + 1}</td>
                            <td className="p-4 text-center font-medium" style={{ width: '180px' }}>{offer.candidate_name}</td>
                            <td className="p-4 text-center" style={{ width: '200px' }}>{offer.position_offered}</td>
                            <td className="p-4 text-center" style={{ width: '130px' }}>
                              {offer.expected_salary ? `฿${parseFloat(offer.expected_salary).toLocaleString()}` : "-"}
                            </td>
                            <td className="p-4 text-center" style={{ width: '120px' }}>
                              {offer.employment_type === "permanent" ? "Permanent" : "Temporary"}
                            </td>
                            <td className="p-4 text-center" style={{ width: '160px' }}>
                              {getOfferStatusBadge(offer)}
                            </td>
                            <td className="p-4 text-center" style={{ width: '100px' }}>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 mx-auto"
                                onClick={() => navigate(`/candidates/${offer.candidate_id}`)}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
              {filteredOffers.length > 0 && (
                <TablePagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  totalItems={filteredOffers.length}
                  itemsPerPage={itemsPerPage}
                  onPageChange={handlePageChange}
                  onItemsPerPageChange={handleItemsPerPageChange}
                />
              )}
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
