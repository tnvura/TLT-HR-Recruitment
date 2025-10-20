import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { usePermissions } from "@/hooks/usePermissions";
import { useToast } from "@/hooks/use-toast";
import { Eye, Plus, Search, UserCircle2, CalendarIcon, Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import logo from "@/assets/talaadthai-logo.png";

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

  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [availablePositions, setAvailablePositions] = useState<string[]>([]);
  const [filters, setFilters] = useState({
    position: "",
    firstName: "",
    lastName: "",
    dateFrom: undefined as Date | undefined,
    dateTo: undefined as Date | undefined,
    statusFilter: "all" as string,
  });

  useEffect(() => {
    fetchCandidates();
    fetchAvailablePositions();
  }, [filters.statusFilter]);

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
      let query = supabase.from("candidates").select("*").order("created_at", { ascending: false });

      if (filters.position && filters.position !== "all") {
        query = query.ilike("position_applied", `%${filters.position}%`);
      }
      if (filters.firstName) {
        query = query.ilike("first_name", `%${filters.firstName}%`);
      }
      if (filters.lastName) {
        query = query.ilike("last_name", `%${filters.lastName}%`);
      }
      if (filters.dateFrom) {
        query = query.gte("created_at", format(filters.dateFrom, "yyyy-MM-dd"));
      }
      if (filters.dateTo) {
        query = query.lte("created_at", format(filters.dateTo, "yyyy-MM-dd"));
      }

      // Status filter
      if (filters.statusFilter && filters.statusFilter !== "all") {
        const statusMap: { [key: string]: string[] } = {
          new: ["new"],
          shortlisted: ["shortlisted"],
          interview: ["interview_scheduled", "interviewed"],
          offer: ["offer_sent"],
          hired: ["offer_accepted", "hired"],
          rejected: ["rejected", "offer_rejected"],
        };
        const statuses = statusMap[filters.statusFilter];
        if (statuses) {
          query = query.in("status", statuses);
        }
      }

      const { data, error } = await query;

      if (error) throw error;
      setCandidates(data || []);
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

  const handleSearch = () => {
    fetchCandidates();
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

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <img src={logo} alt="TalaadThai" className="h-24 w-auto mb-2" />
          <div className="flex items-center gap-4">
            {permissions.isHRAdmin ? (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate("/admin/users")}
                className="h-10 w-10"
              >
                <Settings className="h-6 w-6 text-muted-foreground" />
              </Button>
            ) : (
              <UserCircle2 className="h-8 w-8 text-muted-foreground" />
            )}
            <Button variant="outline" onClick={handleLogout}>
              Logout
            </Button>
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
            {/* Status Filter Buttons */}
            <div className="mb-6 flex flex-wrap gap-2">
              <Button
                variant={filters.statusFilter === "all" ? "default" : "outline"}
                onClick={() => setFilters({ ...filters, statusFilter: "all" })}
              >
                All
              </Button>
              <Button
                variant={filters.statusFilter === "new" ? "default" : "outline"}
                onClick={() => setFilters({ ...filters, statusFilter: "new" })}
              >
                New
              </Button>
              <Button
                variant={filters.statusFilter === "shortlisted" ? "default" : "outline"}
                onClick={() => setFilters({ ...filters, statusFilter: "shortlisted" })}
              >
                Shortlist
              </Button>
              <Button
                variant={filters.statusFilter === "interview" ? "default" : "outline"}
                onClick={() => setFilters({ ...filters, statusFilter: "interview" })}
              >
                Interview
              </Button>
              <Button
                variant={filters.statusFilter === "offer" ? "default" : "outline"}
                onClick={() => setFilters({ ...filters, statusFilter: "offer" })}
              >
                Offer
              </Button>
              <Button
                variant={filters.statusFilter === "hired" ? "default" : "outline"}
                onClick={() => setFilters({ ...filters, statusFilter: "hired" })}
              >
                Hired
              </Button>
              <Button
                variant={filters.statusFilter === "rejected" ? "default" : "outline"}
                onClick={() => setFilters({ ...filters, statusFilter: "rejected" })}
              >
                Rejected
              </Button>
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
                    <TableHead className="w-12">View</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8">
                        Loading...
                      </TableCell>
                    </TableRow>
                  ) : candidates.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                        No candidates found
                      </TableCell>
                    </TableRow>
                  ) : (
                    candidates.map((candidate, index) => (
                      <TableRow key={candidate.id}>
                        <TableCell>{index + 1}</TableCell>
                        <TableCell className="font-medium">{candidate.first_name}</TableCell>
                        <TableCell>{candidate.last_name}</TableCell>
                        <TableCell>{candidate.phone_number || "-"}</TableCell>
                        <TableCell>{candidate.email}</TableCell>
                        <TableCell>{candidate.position_applied}</TableCell>
                        <TableCell>{new Date(candidate.created_at).toLocaleDateString()}</TableCell>
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
