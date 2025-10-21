import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { usePermissions } from "@/hooks/usePermissions";
import { useToast } from "@/hooks/use-toast";
import { Eye, Plus, Search, UserCircle2, CalendarIcon, Settings, Users, FileText, ClipboardList, MessageSquare, CheckCircle2, Send, UserCheck, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import logo from "@/assets/talaadthai-logo.png";
import { StatusBadge } from "@/components/StatusBadge";

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
}

export default function Candidates() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const permissions = usePermissions();

  const [allCandidates, setAllCandidates] = useState<Candidate[]>([]);
  const [filteredCandidates, setFilteredCandidates] = useState<Candidate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [availablePositions, setAvailablePositions] = useState<string[]>([]);
  const [userEmail, setUserEmail] = useState<string>("");
  const [filters, setFilters] = useState({
    position: "",
    firstName: "",
    lastName: "",
    dateFrom: undefined as Date | undefined,
    dateTo: undefined as Date | undefined,
    statusFilter: "all" as string,
  });

  useEffect(() => {
    // Redirect interviewers to their dashboard
    if (!permissions.isLoading && permissions.isInterviewer) {
      toast({
        title: "Access Denied",
        description: "Interviewers can only access their dashboard",
        variant: "destructive",
      });
      navigate("/interviewer/dashboard");
      return;
    }

    fetchUserEmail();
    fetchCandidates();
    fetchAvailablePositions();
  }, [permissions.isLoading, permissions.isInterviewer]);

  // Apply filters whenever filter state changes
  useEffect(() => {
    applyFilters();
  }, [filters, allCandidates]);

  const fetchUserEmail = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user?.email) {
      setUserEmail(user.email);
    }
  };

  const fetchAvailablePositions = async () => {
    try {
      const { data, error } = await supabase
        .from("candidates")
        .select("position_applied")
        .order("position_applied");

      if (error) throw error;

      // Get unique positions
      const uniquePositions = Array.from(
        new Set(data?.map((c) => c.position_applied).filter(Boolean))
      );
      setAvailablePositions(uniquePositions);
    } catch (error: any) {
      console.error("Error fetching positions:", error);
    }
  };

  const fetchCandidates = async () => {
    try {
      setIsLoading(true);
      const query = supabase.from("candidates").select("*").order("created_at", { ascending: false });

      const { data, error } = await query;

      if (error) throw error;
      setAllCandidates(data || []);
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

  const applyFilters = () => {
    let filtered = [...allCandidates];

    // Apply position filter
    if (filters.position && filters.position !== "all") {
      filtered = filtered.filter(c =>
        c.position_applied?.toLowerCase().includes(filters.position.toLowerCase())
      );
    }

    // Apply first name filter
    if (filters.firstName) {
      filtered = filtered.filter(c =>
        c.first_name?.toLowerCase().includes(filters.firstName.toLowerCase())
      );
    }

    // Apply last name filter
    if (filters.lastName) {
      filtered = filtered.filter(c =>
        c.last_name?.toLowerCase().includes(filters.lastName.toLowerCase())
      );
    }

    // Apply date range filter
    if (filters.dateFrom) {
      const fromDate = format(filters.dateFrom, "yyyy-MM-dd");
      filtered = filtered.filter(c =>
        c.created_at >= fromDate
      );
    }

    if (filters.dateTo) {
      const toDate = format(filters.dateTo, "yyyy-MM-dd");
      filtered = filtered.filter(c =>
        c.created_at <= toDate
      );
    }

    // Apply status filter
    if (filters.statusFilter && filters.statusFilter !== "all") {
      const statusMap: { [key: string]: string[] } = {
        new: ["new"],
        shortlisted: ["shortlisted"],
        to_interview: ["to_interview"],
        interview: ["interview_scheduled", "interviewed"],
        to_offer: ["to_offer"],
        offer: ["offer_sent"],
        hired: ["offer_accepted", "hired"],
        rejected: ["rejected", "offer_rejected"],
      };
      const statuses = statusMap[filters.statusFilter];
      if (statuses) {
        filtered = filtered.filter(c => statuses.includes(c.status));
      }
    }

    setFilteredCandidates(filtered);
  };

  const handleSearch = () => {
    applyFilters();
  };

  const handleViewCandidate = (candidateId: string) => {
    navigate(`/candidates/${candidateId}`);
  };

  const handleAddNew = () => {
    navigate("/candidates/new");
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/login");
  };

  const getStats = () => {
    const total = allCandidates.length;
    const newCount = allCandidates.filter(c => c.status === "new").length;
    const shortlisted = allCandidates.filter(c => c.status === "shortlisted").length;
    const toInterview = allCandidates.filter(c => c.status === "to_interview").length;
    const interview = allCandidates.filter(c =>
      c.status === "interview_scheduled" || c.status === "interviewed"
    ).length;
    const toOffer = allCandidates.filter(c => c.status === "to_offer").length;
    const offer = allCandidates.filter(c => c.status === "offer_sent").length;
    const hired = allCandidates.filter(c =>
      c.status === "offer_accepted" || c.status === "hired"
    ).length;
    const rejected = allCandidates.filter(c =>
      c.status === "rejected" || c.status === "offer_rejected"
    ).length;

    return { total, newCount, shortlisted, toInterview, interview, toOffer, offer, hired, rejected };
  };

  const stats = getStats();

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
                {permissions.isHRAdmin && (
                  <>
                    <Button
                      variant="outline"
                      onClick={() => navigate("/interviewer/dashboard")}
                    >
                      Interviewer Dashboard
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => navigate("/admin/users")}
                      className="h-10 w-10"
                    >
                      <Settings className="h-6 w-6 text-muted-foreground" />
                    </Button>
                  </>
                )}
                <Button variant="outline" onClick={handleLogout}>
                  Logout
                </Button>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Filters Sidebar */}
          <Card className="p-6 h-fit">
            <h2 className="text-xl font-semibold mb-6">Filters</h2>

            <div className="space-y-4">
              <div>
                <Label htmlFor="position">Position Applied</Label>
                <Select value={filters.position} onValueChange={(value) => setFilters({ ...filters, position: value })}>
                  <SelectTrigger id="position">
                    <SelectValue placeholder="All" />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border z-50">
                    <SelectItem value="all">All</SelectItem>
                    {availablePositions.map((position) => (
                      <SelectItem key={position} value={position}>
                        {position}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="firstName">First Name</Label>
                <Input
                  id="firstName"
                  value={filters.firstName}
                  onChange={(e) => setFilters({ ...filters, firstName: e.target.value })}
                  placeholder="Enter first name"
                />
              </div>

              <div>
                <Label htmlFor="lastName">Last Name</Label>
                <Input
                  id="lastName"
                  value={filters.lastName}
                  onChange={(e) => setFilters({ ...filters, lastName: e.target.value })}
                  placeholder="Enter last name"
                />
              </div>

              <div>
                <Label>Applied Date</Label>
                <div className="grid grid-cols-2 gap-2">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "justify-start text-left font-normal",
                          !filters.dateFrom && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {filters.dateFrom ? format(filters.dateFrom, "MM/dd/yyyy") : "From"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0 bg-card border-border z-50" align="start">
                      <Calendar
                        mode="single"
                        selected={filters.dateFrom}
                        onSelect={(date) => setFilters({ ...filters, dateFrom: date })}
                        initialFocus
                        className={cn("p-3 pointer-events-auto")}
                      />
                    </PopoverContent>
                  </Popover>

                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "justify-start text-left font-normal",
                          !filters.dateTo && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {filters.dateTo ? format(filters.dateTo, "MM/dd/yyyy") : "To"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0 bg-card border-border z-50" align="start">
                      <Calendar
                        mode="single"
                        selected={filters.dateTo}
                        onSelect={(date) => setFilters({ ...filters, dateTo: date })}
                        initialFocus
                        className={cn("p-3 pointer-events-auto")}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              <Button onClick={handleSearch} className="w-full">
                <Search className="mr-2 h-4 w-4" />
                Search
              </Button>
            </div>
          </Card>

          {/* Main Content */}
          <div className="lg:col-span-3">
            {/* Status Cards - Clickable Filters */}
            <div className="flex flex-wrap gap-2 mb-6">
              <Card
                className={`cursor-pointer transition-all hover:shadow-md px-2 py-1.5 w-[100px] bg-teal-100 border-teal-300 ${
                  filters.statusFilter === "all" ? "ring-2 ring-teal-500" : ""
                }`}
                onClick={() => setFilters({ ...filters, statusFilter: "all" })}
              >
                <div className="text-[10px] text-teal-700 mb-0.5 text-center">All</div>
                <div className="text-base font-bold text-teal-900 text-center">{stats.total}</div>
              </Card>

              <Card
                className={`cursor-pointer transition-all hover:shadow-md px-2 py-1.5 w-[100px] bg-white border-gray-300 ${
                  filters.statusFilter === "new" ? "ring-2 ring-gray-500" : ""
                }`}
                onClick={() => setFilters({ ...filters, statusFilter: "new" })}
              >
                <div className="text-[10px] text-gray-700 mb-0.5 text-center">New</div>
                <div className="text-base font-bold text-gray-900 text-center">{stats.newCount}</div>
              </Card>

              <Card
                className={`cursor-pointer transition-all hover:shadow-md px-2 py-1.5 w-[100px] bg-yellow-300 border-yellow-400 ${
                  filters.statusFilter === "shortlisted" ? "ring-2 ring-yellow-500" : ""
                }`}
                onClick={() => setFilters({ ...filters, statusFilter: "shortlisted" })}
              >
                <div className="text-[10px] text-yellow-900 mb-0.5 text-center">Shortlist</div>
                <div className="text-base font-bold text-yellow-950 text-center">{stats.shortlisted}</div>
              </Card>

              <Card
                className={`cursor-pointer transition-all hover:shadow-md px-2 py-1.5 w-[100px] bg-indigo-100 border-indigo-300 ${
                  filters.statusFilter === "to_interview" ? "ring-2 ring-indigo-500" : ""
                }`}
                onClick={() => setFilters({ ...filters, statusFilter: "to_interview" })}
              >
                <div className="text-[10px] text-indigo-700 mb-0.5 text-center">To Interview</div>
                <div className="text-base font-bold text-indigo-900 text-center">{stats.toInterview}</div>
              </Card>

              <Card
                className={`cursor-pointer transition-all hover:shadow-md px-2 py-1.5 w-[100px] bg-white border-gray-300 ${
                  filters.statusFilter === "interview" ? "ring-2 ring-gray-500" : ""
                }`}
                onClick={() => setFilters({ ...filters, statusFilter: "interview" })}
              >
                <div className="text-[10px] text-gray-700 mb-0.5 text-center">Interviewed</div>
                <div className="text-base font-bold text-gray-900 text-center">{stats.interview}</div>
              </Card>

              <Card
                className={`cursor-pointer transition-all hover:shadow-md px-2 py-1.5 w-[100px] bg-amber-100 border-amber-300 ${
                  filters.statusFilter === "to_offer" ? "ring-2 ring-amber-500" : ""
                }`}
                onClick={() => setFilters({ ...filters, statusFilter: "to_offer" })}
              >
                <div className="text-[10px] text-amber-700 mb-0.5 text-center">To Offer</div>
                <div className="text-base font-bold text-amber-900 text-center">{stats.toOffer}</div>
              </Card>

              <Card
                className={`cursor-pointer transition-all hover:shadow-md px-2 py-1.5 w-[100px] bg-orange-100 border-orange-300 ${
                  filters.statusFilter === "offer" ? "ring-2 ring-orange-500" : ""
                }`}
                onClick={() => setFilters({ ...filters, statusFilter: "offer" })}
              >
                <div className="text-[10px] text-orange-700 mb-0.5 text-center">Offer Sent</div>
                <div className="text-base font-bold text-orange-900 text-center">{stats.offer}</div>
              </Card>

              <Card
                className={`cursor-pointer transition-all hover:shadow-md px-2 py-1.5 w-[100px] bg-green-100 border-green-300 ${
                  filters.statusFilter === "hired" ? "ring-2 ring-green-500" : ""
                }`}
                onClick={() => setFilters({ ...filters, statusFilter: "hired" })}
              >
                <div className="text-[10px] text-green-700 mb-0.5 text-center">Hired</div>
                <div className="text-base font-bold text-green-900 text-center">{stats.hired}</div>
              </Card>

              <Card
                className={`cursor-pointer transition-all hover:shadow-md px-2 py-1.5 w-[100px] bg-red-100 border-red-300 ${
                  filters.statusFilter === "rejected" ? "ring-2 ring-red-500" : ""
                }`}
                onClick={() => setFilters({ ...filters, statusFilter: "rejected" })}
              >
                <div className="text-[10px] text-red-700 mb-0.5 text-center">Rejected</div>
                <div className="text-base font-bold text-red-900 text-center">{stats.rejected}</div>
              </Card>
            </div>

            <div className="flex items-center justify-between mb-6">
              <h1 className="text-3xl font-bold">Candidates</h1>
              {permissions.canCreate("candidates") && (
                <Button onClick={handleAddNew}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add New Application
                </Button>
              )}
            </div>

            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">#</TableHead>
                    <TableHead>First Name</TableHead>
                    <TableHead>Last Name</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Position Applied</TableHead>
                    <TableHead>Applied Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-12">View</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-8">
                        Loading...
                      </TableCell>
                    </TableRow>
                  ) : filteredCandidates.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                        No candidates found
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredCandidates.map((candidate, index) => (
                      <TableRow key={candidate.id}>
                        <TableCell>{index + 1}</TableCell>
                        <TableCell className="font-medium">{candidate.first_name}</TableCell>
                        <TableCell>{candidate.last_name}</TableCell>
                        <TableCell>{candidate.phone_number || "-"}</TableCell>
                        <TableCell>{candidate.email}</TableCell>
                        <TableCell>{candidate.position_applied}</TableCell>
                        <TableCell>{new Date(candidate.created_at).toLocaleDateString()}</TableCell>
                        <TableCell>
                          <StatusBadge status={candidate.status} />
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 rounded-full bg-primary text-primary-foreground hover:bg-primary/90"
                            onClick={() => handleViewCandidate(candidate.id)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
