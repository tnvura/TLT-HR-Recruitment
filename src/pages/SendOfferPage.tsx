import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { offerNotifications } from "@/services/offerNotifications";

export default function SendOfferPage() {
  const { candidateId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [candidate, setCandidate] = useState<any>(null);
  const [interviewFeedback, setInterviewFeedback] = useState<any>(null);

  // Form state
  const [formData, setFormData] = useState({
    // Employment fields
    position_level: "",
    job_grade: "",
    current_salary: "",
    expected_salary: "",
    current_position: "",
    position_offered: "",
    company_name: "",
    department_th: "",
    department_en: "",
    division_th: "",
    division_en: "",
    section_th: "",
    section_en: "",
    direct_report_name: "",
    direct_report_email: "",
    manager_name: "",
    manager_email: "",
    start_date: "",
    notes: "",
    // Personal identification fields
    name_title: "",
    first_name: "",
    last_name: "",
    first_name_en: "",
    last_name_en: "",
    national_id: "",
    birthday: "",
    gender: "",
    religion: "",
    house_no: "",
    moo: "",
    soi: "",
    street: "",
    sub_district: "",
    district: "",
    province: "",
    postal_code: "",
  });

  useEffect(() => {
    fetchData();
  }, [candidateId]);

  const fetchData = async () => {
    try {
      setIsLoading(true);

      // Fetch candidate data
      const { data: candidateData, error: candidateError } = await supabase
        .from("candidates")
        .select("*")
        .eq("id", candidateId)
        .single();

      if (candidateError) throw candidateError;
      setCandidate(candidateData);

      // Pre-fill personal identification from candidate data
      setFormData((prev) => ({
        ...prev,
        first_name: candidateData.first_name || "",
        last_name: candidateData.last_name || "",
        first_name_en: candidateData.first_name_en || "",
        last_name_en: candidateData.last_name_en || "",
        name_title: candidateData.name_title || "",
        national_id: candidateData.national_id || "",
        birthday: candidateData.birthday || "",
        gender: candidateData.gender || "",
        religion: candidateData.religion || "",
        house_no: candidateData.house_no || "",
        moo: candidateData.moo || "",
        soi: candidateData.soi || "",
        street: candidateData.street || "",
        sub_district: candidateData.sub_district || "",
        district: candidateData.district || "",
        province: candidateData.province || "",
        postal_code: candidateData.postal_code || "",
        position_offered: candidateData.position_applied || "",
      }));

      // Fetch interview feedback
      const { data: feedbackData, error: feedbackError } = await (supabase as any)
        .from("interview_feedback")
        .select("*")
        .eq("candidate_id", candidateId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (feedbackError) throw feedbackError;
      setInterviewFeedback(feedbackData);

      // Pre-fill employment data from interview feedback if available
      if (feedbackData) {
        setFormData((prev) => ({
          ...prev,
          current_salary: feedbackData.current_salary?.toString() || "",
          expected_salary: feedbackData.expected_salary?.toString() || "",
          current_position: feedbackData.current_position || "",
        }));
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
      navigate(-1);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Validation
      const requiredEmploymentFields = [
        "position_level",
        "job_grade",
        "expected_salary",
        "position_offered",
        "company_name",
        "department_th",
        "department_en",
        "division_th",
        "division_en",
        "section_th",
        "section_en",
        "start_date",
      ];

      const requiredPersonalFields = [
        "name_title",
        "first_name",
        "last_name",
        "first_name_en",
        "last_name_en",
        "national_id",
        "birthday",
        "gender",
        "religion",
        "house_no",
        "sub_district",
        "district",
        "province",
        "postal_code",
      ];

      const missingFields = [...requiredEmploymentFields, ...requiredPersonalFields].filter(
        (field) => !formData[field as keyof typeof formData]
      );

      if (missingFields.length > 0) {
        toast({
          title: "Validation Error",
          description: "Please fill in all required fields",
          variant: "destructive",
        });
        return;
      }

      // Validate national ID (13 digits)
      if (!/^\d{13}$/.test(formData.national_id.replace(/-/g, ""))) {
        toast({
          title: "Validation Error",
          description: "National ID must be 13 digits",
          variant: "destructive",
        });
        return;
      }

      // Validate email formats
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (formData.direct_report_email && !emailRegex.test(formData.direct_report_email)) {
        toast({
          title: "Validation Error",
          description: "Invalid Direct Report email format",
          variant: "destructive",
        });
        return;
      }
      if (formData.manager_email && !emailRegex.test(formData.manager_email)) {
        toast({
          title: "Validation Error",
          description: "Invalid Manager email format",
          variant: "destructive",
        });
        return;
      }

      // Update interview_feedback with current/expected salary and position
      if (interviewFeedback) {
        const { error: feedbackUpdateError } = await (supabase as any)
          .from("interview_feedback")
          .update({
            current_salary: formData.current_salary ? parseFloat(formData.current_salary) : null,
            expected_salary: formData.expected_salary ? parseFloat(formData.expected_salary) : null,
            current_position: formData.current_position || null,
          })
          .eq("id", interviewFeedback.id);

        if (feedbackUpdateError) throw feedbackUpdateError;
      }

      // Insert job proposal
      const { data: proposalData, error: proposalError } = await (supabase as any)
        .from("job_proposals")
        .insert({
          candidate_id: candidateId,
          position_offered: formData.position_offered,
          position_level: formData.position_level,
          job_grade: formData.job_grade,
          company_name: formData.company_name,
          department_th: formData.department_th,
          department_en: formData.department_en,
          division_th: formData.division_th,
          division_en: formData.division_en,
          section_th: formData.section_th,
          section_en: formData.section_en,
          direct_report_name: formData.direct_report_name || null,
          direct_report_email: formData.direct_report_email || null,
          manager_name: formData.manager_name || null,
          manager_email: formData.manager_email || null,
          start_date: formData.start_date,
          notes: formData.notes || null,
          offer_status: "pending",
          hr_manager_approved: false,
          interviewer_acknowledged: false,
          created_by: user.id,
          created_by_email: user.email,
        })
        .select()
        .single();

      if (proposalError) throw proposalError;

      // Update candidates table with personal identification
      const { error: candidateUpdateError } = await supabase
        .from("candidates")
        .update({
          name_title: formData.name_title,
          first_name: formData.first_name,
          last_name: formData.last_name,
          first_name_en: formData.first_name_en,
          last_name_en: formData.last_name_en,
          national_id: formData.national_id,
          birthday: formData.birthday,
          gender: formData.gender,
          religion: formData.religion,
          house_no: formData.house_no,
          moo: formData.moo || null,
          soi: formData.soi || null,
          street: formData.street || null,
          sub_district: formData.sub_district,
          district: formData.district,
          province: formData.province,
          postal_code: formData.postal_code,
          status: "pending_approval",
          updated_by: user.id,
          updated_by_email: user.email,
        })
        .eq("id", candidateId);

      if (candidateUpdateError) throw candidateUpdateError;

      // Create status history
      await (supabase as any)
        .from("status_history")
        .insert({
          candidate_id: candidateId,
          from_status: candidate.status,
          to_status: "pending_approval",
          changed_by: user.id,
          changed_by_email: user.email,
          notes: "Job offer submitted for approval",
        });

      // Get HR Manager user ID and create notification
      const hrManagerId = await offerNotifications.getHRManagerUserId();
      if (hrManagerId) {
        await offerNotifications.notifyHRManagerApproval(
          hrManagerId,
          candidateId!,
          `${formData.first_name} ${formData.last_name}`,
          formData.position_offered,
          proposalData.id
        );
      }

      toast({
        title: "Success",
        description: "Job offer submitted successfully and sent for approval",
      });

      navigate(`/candidates/${candidateId}`);
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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-6 py-8 max-w-6xl">
      <Button variant="ghost" onClick={() => navigate(-1)} className="mb-6">
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back
      </Button>

      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Send Job Offer</h1>
          <p className="text-muted-foreground mt-1">
            {candidate?.first_name} {candidate?.last_name} - {candidate?.position_applied}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Interview Feedback Section */}
          {interviewFeedback && (
            <Card>
              <CardHeader>
                <CardTitle>Interview Feedback</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label className="text-muted-foreground">Interviewer</Label>
                    <p className="font-medium">{interviewFeedback.interviewer_name}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Interview Date</Label>
                    <p className="font-medium">
                      {interviewFeedback.interview_date
                        ? format(new Date(interviewFeedback.interview_date), "PPP")
                        : "N/A"}
                    </p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">Total Score</Label>
                    <p className="font-medium text-lg">
                      {interviewFeedback.total_score}/75 ({interviewFeedback.percentage}%)
                    </p>
                  </div>
                </div>
                {interviewFeedback.comment && (
                  <div>
                    <Label className="text-muted-foreground">Interviewer's Feedback</Label>
                    <p className="mt-1 text-sm whitespace-pre-wrap bg-muted p-3 rounded-md">
                      {interviewFeedback.comment}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Employment Details Section */}
          <Card>
            <CardHeader>
              <CardTitle>Employment Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="position_level">
                    Position Level <span className="text-destructive">*</span>
                  </Label>
                  <Select
                    value={formData.position_level}
                    onValueChange={(value) => setFormData({ ...formData, position_level: value })}
                    required
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
                  <Label htmlFor="job_grade">
                    Job Grade <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="job_grade"
                    value={formData.job_grade}
                    onChange={(e) => setFormData({ ...formData, job_grade: e.target.value })}
                    placeholder="e.g., G5, L4"
                    required
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
                  <Label htmlFor="expected_salary">
                    Expected Salary <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="expected_salary"
                    type="number"
                    step="0.01"
                    value={formData.expected_salary}
                    onChange={(e) => setFormData({ ...formData, expected_salary: e.target.value })}
                    placeholder="Expected salary"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="current_position">Current Position</Label>
                  <Input
                    id="current_position"
                    value={formData.current_position}
                    onChange={(e) => setFormData({ ...formData, current_position: e.target.value })}
                    placeholder="Current position"
                  />
                </div>
                <div>
                  <Label htmlFor="position_offered">
                    Offered Position <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="position_offered"
                    value={formData.position_offered}
                    onChange={(e) => setFormData({ ...formData, position_offered: e.target.value })}
                    placeholder="Position offered"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="company_name">
                    Company Name <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="company_name"
                    value={formData.company_name}
                    onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                    placeholder="Company name"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="start_date">
                    Start Date <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="start_date"
                    type="date"
                    value={formData.start_date}
                    onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="department_th">
                    Department (Thai) <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="department_th"
                    value={formData.department_th}
                    onChange={(e) => setFormData({ ...formData, department_th: e.target.value })}
                    placeholder="แผนก"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="department_en">
                    Department (English) <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="department_en"
                    value={formData.department_en}
                    onChange={(e) => setFormData({ ...formData, department_en: e.target.value })}
                    placeholder="Department"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="division_th">
                    Division (Thai) <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="division_th"
                    value={formData.division_th}
                    onChange={(e) => setFormData({ ...formData, division_th: e.target.value })}
                    placeholder="ฝ่าย"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="division_en">
                    Division (English) <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="division_en"
                    value={formData.division_en}
                    onChange={(e) => setFormData({ ...formData, division_en: e.target.value })}
                    placeholder="Division"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="section_th">
                    Section (Thai) <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="section_th"
                    value={formData.section_th}
                    onChange={(e) => setFormData({ ...formData, section_th: e.target.value })}
                    placeholder="ส่วน"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="section_en">
                    Section (English) <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="section_en"
                    value={formData.section_en}
                    onChange={(e) => setFormData({ ...formData, section_en: e.target.value })}
                    placeholder="Section"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="direct_report_name">Direct Report Name</Label>
                  <Input
                    id="direct_report_name"
                    value={formData.direct_report_name}
                    onChange={(e) => setFormData({ ...formData, direct_report_name: e.target.value })}
                    placeholder="Direct report name"
                  />
                </div>
                <div>
                  <Label htmlFor="direct_report_email">Direct Report Email</Label>
                  <Input
                    id="direct_report_email"
                    type="email"
                    value={formData.direct_report_email}
                    onChange={(e) => setFormData({ ...formData, direct_report_email: e.target.value })}
                    placeholder="direct.report@example.com"
                  />
                </div>
                <div>
                  <Label htmlFor="manager_name">Manager Name</Label>
                  <Input
                    id="manager_name"
                    value={formData.manager_name}
                    onChange={(e) => setFormData({ ...formData, manager_name: e.target.value })}
                    placeholder="Manager name"
                  />
                </div>
                <div>
                  <Label htmlFor="manager_email">Manager Email</Label>
                  <Input
                    id="manager_email"
                    type="email"
                    value={formData.manager_email}
                    onChange={(e) => setFormData({ ...formData, manager_email: e.target.value })}
                    placeholder="manager@example.com"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Additional notes, benefits, or details..."
                  className="min-h-[100px]"
                />
              </div>
            </CardContent>
          </Card>

          {/* Personal Identification Section */}
          <Card>
            <CardHeader>
              <CardTitle>Personal Identification</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="name_title">
                    Name Title <span className="text-destructive">*</span>
                  </Label>
                  <Select
                    value={formData.name_title}
                    onValueChange={(value) => setFormData({ ...formData, name_title: value })}
                    required
                  >
                    <SelectTrigger id="name_title">
                      <SelectValue placeholder="Select title" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Mr.">Mr.</SelectItem>
                      <SelectItem value="Mrs.">Mrs.</SelectItem>
                      <SelectItem value="Miss">Miss</SelectItem>
                      <SelectItem value="Ms.">Ms.</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="first_name">
                    First Name (Thai) <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="first_name"
                    value={formData.first_name}
                    onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                    placeholder="ชื่อ"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="last_name">
                    Last Name (Thai) <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="last_name"
                    value={formData.last_name}
                    onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                    placeholder="นามสกุล"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="first_name_en">
                    First Name (English) <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="first_name_en"
                    value={formData.first_name_en}
                    onChange={(e) => setFormData({ ...formData, first_name_en: e.target.value })}
                    placeholder="First Name"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="last_name_en">
                    Last Name (English) <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="last_name_en"
                    value={formData.last_name_en}
                    onChange={(e) => setFormData({ ...formData, last_name_en: e.target.value })}
                    placeholder="Last Name"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="national_id">
                    National ID <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="national_id"
                    value={formData.national_id}
                    onChange={(e) => setFormData({ ...formData, national_id: e.target.value })}
                    placeholder="1234567890123"
                    maxLength={13}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="birthday">
                    Birthday <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="birthday"
                    type="date"
                    value={formData.birthday}
                    onChange={(e) => setFormData({ ...formData, birthday: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="gender">
                    Gender <span className="text-destructive">*</span>
                  </Label>
                  <Select
                    value={formData.gender}
                    onValueChange={(value) => setFormData({ ...formData, gender: value })}
                    required
                  >
                    <SelectTrigger id="gender">
                      <SelectValue placeholder="Select gender" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Male">Male</SelectItem>
                      <SelectItem value="Female">Female</SelectItem>
                      <SelectItem value="LGBTQ">LGBTQ</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="religion">
                    Religion <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="religion"
                    value={formData.religion}
                    onChange={(e) => setFormData({ ...formData, religion: e.target.value })}
                    placeholder="Religion"
                    required
                  />
                </div>
              </div>

              <div>
                <Label className="text-base font-semibold mb-3 block">
                  Address <span className="text-destructive">*</span>
                </Label>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div>
                    <Label htmlFor="house_no">House No.</Label>
                    <Input
                      id="house_no"
                      value={formData.house_no}
                      onChange={(e) => setFormData({ ...formData, house_no: e.target.value })}
                      placeholder="123"
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="moo">Moo (Village No.)</Label>
                    <Input
                      id="moo"
                      value={formData.moo}
                      onChange={(e) => setFormData({ ...formData, moo: e.target.value })}
                      placeholder="หมู่ที่"
                    />
                  </div>
                  <div>
                    <Label htmlFor="soi">Soi (Alley)</Label>
                    <Input
                      id="soi"
                      value={formData.soi}
                      onChange={(e) => setFormData({ ...formData, soi: e.target.value })}
                      placeholder="ซอย"
                    />
                  </div>
                  <div>
                    <Label htmlFor="street">Street</Label>
                    <Input
                      id="street"
                      value={formData.street}
                      onChange={(e) => setFormData({ ...formData, street: e.target.value })}
                      placeholder="ถนน"
                    />
                  </div>
                  <div>
                    <Label htmlFor="sub_district">Sub-district</Label>
                    <Input
                      id="sub_district"
                      value={formData.sub_district}
                      onChange={(e) => setFormData({ ...formData, sub_district: e.target.value })}
                      placeholder="ตำบล/แขวง"
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="district">District</Label>
                    <Input
                      id="district"
                      value={formData.district}
                      onChange={(e) => setFormData({ ...formData, district: e.target.value })}
                      placeholder="อำเภอ/เขต"
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="province">Province</Label>
                    <Input
                      id="province"
                      value={formData.province}
                      onChange={(e) => setFormData({ ...formData, province: e.target.value })}
                      placeholder="จังหวัด"
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="postal_code">Postal Code</Label>
                    <Input
                      id="postal_code"
                      value={formData.postal_code}
                      onChange={(e) => setFormData({ ...formData, postal_code: e.target.value })}
                      placeholder="10000"
                      maxLength={5}
                      required
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Form Actions */}
          <div className="flex gap-4 justify-end">
            <Button type="button" variant="outline" onClick={() => navigate(-1)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Submitting..." : "Submit Offer for Approval"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
