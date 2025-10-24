import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { offerNotifications } from "@/services/offerNotifications";
import { emailNotifications } from "@/services/emailNotifications";
import { AlertCircle } from "lucide-react";

interface EditableOfferSectionProps {
  candidateId: string;
  candidate: any;
  jobProposal: any;
  interviewFeedback?: any;
  onUpdateComplete: () => void;
}

export function EditableOfferSection({
  candidateId,
  candidate,
  jobProposal,
  interviewFeedback,
  onUpdateComplete,
}: EditableOfferSectionProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [directReportEmailError, setDirectReportEmailError] = useState("");
  const [managerEmailError, setManagerEmailError] = useState("");

  const isValidEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const [formData, setFormData] = useState({
    // Employment fields
    position_level: "",
    job_grade: "",
    current_salary: "",
    expected_salary: "",
    current_position: "",
    position_offered: "",
    employment_type: "",
    temp_start_date: "",
    temp_end_date: "",
    position_type: "",
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

  // Update form data when props change
  useEffect(() => {
    if (jobProposal && candidate) {
      setFormData({
        // Employment fields from job proposal
        position_level: jobProposal.position_level || "",
        job_grade: jobProposal.job_grade || "",
        position_offered: jobProposal.position_offered || "",
        employment_type: jobProposal.employment_type || "",
        temp_start_date: jobProposal.temp_start_date || "",
        temp_end_date: jobProposal.temp_end_date || "",
        position_type: jobProposal.position_type || "",
        company_name: jobProposal.company_name || "",
        department_th: jobProposal.department_th || "",
        department_en: jobProposal.department_en || "",
        division_th: jobProposal.division_th || "",
        division_en: jobProposal.division_en || "",
        section_th: jobProposal.section_th || "",
        section_en: jobProposal.section_en || "",
        direct_report_name: jobProposal.direct_report_name || "",
        direct_report_email: jobProposal.direct_report_email || "",
        manager_name: jobProposal.manager_name || "",
        manager_email: jobProposal.manager_email || "",
        start_date: jobProposal.start_date || "",
        notes: jobProposal.notes || "",
        // Fields from job proposal (preferred) or interview feedback (fallback)
        current_salary: jobProposal.current_salary?.toString() || interviewFeedback?.current_salary?.toString() || "",
        expected_salary: jobProposal.expected_salary?.toString() || interviewFeedback?.expected_salary?.toString() || "",
        current_position: jobProposal.current_position || interviewFeedback?.current_position || "",
        // Personal identification fields from candidate
        name_title: candidate.name_title || "",
        first_name: candidate.first_name || "",
        last_name: candidate.last_name || "",
        first_name_en: candidate.first_name_en || "",
        last_name_en: candidate.last_name_en || "",
        national_id: candidate.national_id || "",
        birthday: candidate.birthday || "",
        gender: candidate.gender || "",
        religion: candidate.religion || "",
        house_no: candidate.house_no || "",
        moo: candidate.moo || "",
        soi: candidate.soi || "",
        street: candidate.street || "",
        sub_district: candidate.sub_district || "",
        district: candidate.district || "",
        province: candidate.province || "",
        postal_code: candidate.postal_code || "",
      });
    }
  }, [jobProposal, candidate, interviewFeedback]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate email fields
    if (formData.direct_report_email && !isValidEmail(formData.direct_report_email)) {
      setDirectReportEmailError("Please enter a valid email address");
      toast({
        title: "Validation Error",
        description: "Direct Report Email is invalid",
        variant: "destructive",
      });
      return;
    }

    if (!isValidEmail(formData.manager_email)) {
      setManagerEmailError("Please enter a valid email address");
      toast({
        title: "Validation Error",
        description: "Manager Email is required and must be valid",
        variant: "destructive",
      });
      return;
    }

    setDirectReportEmailError("");
    setManagerEmailError("");

    try {
      setIsSubmitting(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Validation
      const requiredEmploymentFields = [
        "position_level",
        "job_grade",
        "expected_salary",
        "position_offered",
        "employment_type",
        "position_type",
        "company_name",
        "department_th",
        "department_en",
        "division_th",
        "division_en",
        "section_th",
        "section_en",
        "start_date",
      ];

      if (formData.employment_type === "temporary") {
        requiredEmploymentFields.push("temp_start_date", "temp_end_date");
      }

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

      // Update job proposal - clear rejection notes and reset approval flags
      const { error: proposalError } = await (supabase as any)
        .from("job_proposals")
        .update({
          position_offered: formData.position_offered,
          position_level: formData.position_level,
          job_grade: formData.job_grade,
          employment_type: formData.employment_type,
          temp_start_date: formData.employment_type === "temporary" ? formData.temp_start_date : null,
          temp_end_date: formData.employment_type === "temporary" ? formData.temp_end_date : null,
          position_type: formData.position_type,
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
          current_salary: formData.current_salary ? parseFloat(formData.current_salary) : null,
          expected_salary: formData.expected_salary ? parseFloat(formData.expected_salary) : null,
          current_position: formData.current_position || null,
          notes: formData.notes || null,
          // Clear rejection notes and reset approval workflow
          hr_manager_rejection_notes: null,
          interviewer_rejection_notes: null,
          hr_manager_approved: false,
          hr_manager_approved_by: null,
          hr_manager_approved_at: null,
          interviewer_acknowledged: false,
          interviewer_acknowledged_by: null,
          interviewer_acknowledged_at: null,
          updated_by: user.id,
          updated_by_email: user.email,
          updated_at: new Date().toISOString(),
        })
        .eq("id", jobProposal.id);

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
          from_status: "pending_approval",
          to_status: "pending_approval",
          changed_by: user.id,
          changed_by_email: user.email,
          notes: `Job offer updated and re-submitted for approval to ${jobProposal.assigned_hr_manager_email}`,
        });

      // Re-notify assigned HR Manager (in-app notification)
      await offerNotifications.notifyHRManagerApproval(
        jobProposal.assigned_hr_manager_id,
        candidateId,
        `${formData.first_name} ${formData.last_name}`,
        formData.position_offered,
        jobProposal.id
      );

      // Send email notification to HR Manager
      console.log("🔔 Attempting to send offer_submitted_for_approval notification (resubmission)...");
      await emailNotifications.notifyOfferSubmittedForApproval(
        candidateId,
        jobProposal.assigned_hr_manager_email,
        jobProposal.assigned_hr_manager_email, // Using email as name
        user.email!,
        candidate,
        {
          position_offered: formData.position_offered,
          company_name: formData.company_name,
          start_date: formData.start_date,
        }
      );
      console.log("🔔 Offer notification call completed (resubmission)");

      toast({
        title: "Success",
        description: "Job offer updated and re-submitted for approval",
      });

      onUpdateComplete();
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
    <Card className="border-orange-200 bg-orange-50">
      <CardHeader>
        <CardTitle className="text-orange-700">Edit Job Offer</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Show rejection notes */}
        {(jobProposal.hr_manager_rejection_notes || jobProposal.interviewer_rejection_notes) && (
          <div className="space-y-2">
            {jobProposal.hr_manager_rejection_notes && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <h4 className="font-semibold text-red-700 mb-1">Rejected by HR Manager</h4>
                    <p className="text-sm text-red-600 whitespace-pre-wrap">{jobProposal.hr_manager_rejection_notes}</p>
                  </div>
                </div>
              </div>
            )}
            {jobProposal.interviewer_rejection_notes && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <h4 className="font-semibold text-red-700 mb-1">Rejected by Interviewer</h4>
                    <p className="text-sm text-red-600 whitespace-pre-wrap">{jobProposal.interviewer_rejection_notes}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Employment Details Section */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Employment Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="edit_position_level">
                    Position Level <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="edit_position_level"
                    value={formData.position_level}
                    onChange={(e) => setFormData({ ...formData, position_level: e.target.value })}
                    placeholder="e.g., Manager, Senior Manager"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="edit_job_grade">
                    Job Grade <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="edit_job_grade"
                    value={formData.job_grade}
                    onChange={(e) => setFormData({ ...formData, job_grade: e.target.value })}
                    placeholder="e.g. O1, O2"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="edit_current_salary">Current Salary</Label>
                  <Input
                    id="edit_current_salary"
                    type="number"
                    step="0.01"
                    value={formData.current_salary}
                    onChange={(e) => setFormData({ ...formData, current_salary: e.target.value })}
                    placeholder="Current salary"
                  />
                </div>
                <div>
                  <Label htmlFor="edit_expected_salary">
                    Expected Salary <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="edit_expected_salary"
                    type="number"
                    step="0.01"
                    value={formData.expected_salary}
                    onChange={(e) => setFormData({ ...formData, expected_salary: e.target.value })}
                    placeholder="Expected salary"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="edit_current_position">Current Position</Label>
                  <Input
                    id="edit_current_position"
                    value={formData.current_position}
                    onChange={(e) => setFormData({ ...formData, current_position: e.target.value })}
                    placeholder="Current position"
                  />
                </div>
                <div>
                  <Label htmlFor="edit_position_offered">
                    Offered Position <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="edit_position_offered"
                    value={formData.position_offered}
                    onChange={(e) => setFormData({ ...formData, position_offered: e.target.value })}
                    placeholder="Position offered"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="edit_employment_type">
                    Employment Type <span className="text-destructive">*</span>
                  </Label>
                  <Select
                    value={formData.employment_type}
                    onValueChange={(value) => setFormData({ ...formData, employment_type: value })}
                    required
                  >
                    <SelectTrigger id="edit_employment_type">
                      <SelectValue placeholder="Select employment type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="permanent-monthly">Permanent - Monthly</SelectItem>
                      <SelectItem value="permanent-daily">Permanent - Daily</SelectItem>
                      <SelectItem value="temporary">Temporary</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {formData.employment_type === "temporary" && (
                  <>
                    <div>
                      <Label htmlFor="edit_temp_start_date">
                        Temporary Start Date <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="edit_temp_start_date"
                        type="date"
                        value={formData.temp_start_date}
                        onChange={(e) => setFormData({ ...formData, temp_start_date: e.target.value })}
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="edit_temp_end_date">
                        Temporary End Date <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="edit_temp_end_date"
                        type="date"
                        value={formData.temp_end_date}
                        onChange={(e) => setFormData({ ...formData, temp_end_date: e.target.value })}
                        required
                      />
                    </div>
                  </>
                )}
                <div>
                  <Label htmlFor="edit_position_type">
                    Position Type <span className="text-destructive">*</span>
                  </Label>
                  <Select
                    value={formData.position_type}
                    onValueChange={(value) => setFormData({ ...formData, position_type: value })}
                    required
                  >
                    <SelectTrigger id="edit_position_type">
                      <SelectValue placeholder="Select position type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="replacement">Replacement</SelectItem>
                      <SelectItem value="new_position">New Position</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="edit_company_name">
                    Company Name <span className="text-destructive">*</span>
                  </Label>
                  <Select
                    value={formData.company_name}
                    onValueChange={(value) => setFormData({ ...formData, company_name: value })}
                    required
                  >
                    <SelectTrigger id="edit_company_name">
                      <SelectValue placeholder="Select company" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="TAECO">TAECO</SelectItem>
                      <SelectItem value="TAS">TAS</SelectItem>
                      <SelectItem value="TAF">TAF</SelectItem>
                      <SelectItem value="LOOP">LOOP</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="edit_start_date">
                    Start Date <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="edit_start_date"
                    type="date"
                    value={formData.start_date}
                    onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="edit_department_th">
                    Department (Thai) <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="edit_department_th"
                    value={formData.department_th}
                    onChange={(e) => setFormData({ ...formData, department_th: e.target.value })}
                    placeholder="แผนก"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="edit_department_en">
                    Department (English) <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="edit_department_en"
                    value={formData.department_en}
                    onChange={(e) => setFormData({ ...formData, department_en: e.target.value })}
                    placeholder="Department"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="edit_division_th">
                    Division (Thai) <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="edit_division_th"
                    value={formData.division_th}
                    onChange={(e) => setFormData({ ...formData, division_th: e.target.value })}
                    placeholder="ฝ่าย"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="edit_division_en">
                    Division (English) <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="edit_division_en"
                    value={formData.division_en}
                    onChange={(e) => setFormData({ ...formData, division_en: e.target.value })}
                    placeholder="Division"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="edit_section_th">
                    Section (Thai) <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="edit_section_th"
                    value={formData.section_th}
                    onChange={(e) => setFormData({ ...formData, section_th: e.target.value })}
                    placeholder="ส่วน"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="edit_section_en">
                    Section (English) <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="edit_section_en"
                    value={formData.section_en}
                    onChange={(e) => setFormData({ ...formData, section_en: e.target.value })}
                    placeholder="Section"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="edit_direct_report_name">Direct Report Name</Label>
                  <Input
                    id="edit_direct_report_name"
                    value={formData.direct_report_name}
                    onChange={(e) => setFormData({ ...formData, direct_report_name: e.target.value })}
                    placeholder="Direct report name"
                  />
                </div>
                <div>
                  <Label htmlFor="edit_direct_report_email">Direct Report Email</Label>
                  <Input
                    id="edit_direct_report_email"
                    type="email"
                    value={formData.direct_report_email}
                    onChange={(e) => {
                      setFormData({ ...formData, direct_report_email: e.target.value });
                      setDirectReportEmailError("");
                    }}
                    onBlur={(e) => {
                      if (e.target.value && !isValidEmail(e.target.value)) {
                        setDirectReportEmailError("Please enter a valid email address");
                      }
                    }}
                    placeholder="direct.report@example.com"
                    className={directReportEmailError ? "border-red-500" : ""}
                  />
                  {directReportEmailError && (
                    <p className="text-sm text-red-500 mt-1">{directReportEmailError}</p>
                  )}
                </div>
                <div>
                  <Label htmlFor="edit_manager_name">
                    Manager Name <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="edit_manager_name"
                    value={formData.manager_name}
                    onChange={(e) => setFormData({ ...formData, manager_name: e.target.value })}
                    placeholder="Manager name"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="edit_manager_email">
                    Manager Email <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="edit_manager_email"
                    type="email"
                    value={formData.manager_email}
                    onChange={(e) => {
                      setFormData({ ...formData, manager_email: e.target.value });
                      setManagerEmailError("");
                    }}
                    onBlur={(e) => {
                      if (e.target.value && !isValidEmail(e.target.value)) {
                        setManagerEmailError("Please enter a valid email address");
                      }
                    }}
                    placeholder="manager@example.com"
                    className={managerEmailError ? "border-red-500" : ""}
                    required
                  />
                  {managerEmailError && (
                    <p className="text-sm text-red-500 mt-1">{managerEmailError}</p>
                  )}
                </div>
              </div>

              <div>
                <Label htmlFor="edit_notes">Notes</Label>
                <Textarea
                  id="edit_notes"
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
              <CardTitle className="text-base">Personal Identification</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="edit_name_title">
                    Name Title <span className="text-destructive">*</span>
                  </Label>
                  <Select
                    value={formData.name_title}
                    onValueChange={(value) => setFormData({ ...formData, name_title: value })}
                    required
                  >
                    <SelectTrigger id="edit_name_title">
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
                  <Label htmlFor="edit_first_name">
                    First Name (Thai) <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="edit_first_name"
                    value={formData.first_name}
                    onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                    placeholder="ชื่อ"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="edit_last_name">
                    Last Name (Thai) <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="edit_last_name"
                    value={formData.last_name}
                    onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                    placeholder="นามสกุล"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="edit_first_name_en">
                    First Name (English) <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="edit_first_name_en"
                    value={formData.first_name_en}
                    onChange={(e) => setFormData({ ...formData, first_name_en: e.target.value })}
                    placeholder="First Name"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="edit_last_name_en">
                    Last Name (English) <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="edit_last_name_en"
                    value={formData.last_name_en}
                    onChange={(e) => setFormData({ ...formData, last_name_en: e.target.value })}
                    placeholder="Last Name"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="edit_national_id">
                    National ID <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="edit_national_id"
                    value={formData.national_id}
                    onChange={(e) => setFormData({ ...formData, national_id: e.target.value })}
                    placeholder="1234567890123"
                    maxLength={13}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="edit_birthday">
                    Birthday <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="edit_birthday"
                    type="date"
                    value={formData.birthday}
                    onChange={(e) => setFormData({ ...formData, birthday: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="edit_gender">
                    Gender <span className="text-destructive">*</span>
                  </Label>
                  <Select
                    value={formData.gender}
                    onValueChange={(value) => setFormData({ ...formData, gender: value })}
                    required
                  >
                    <SelectTrigger id="edit_gender">
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
                  <Label htmlFor="edit_religion">
                    Religion <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="edit_religion"
                    value={formData.religion}
                    onChange={(e) => setFormData({ ...formData, religion: e.target.value })}
                    placeholder="Religion"
                    required
                  />
                </div>
              </div>

              <div>
                <Label className="text-base font-semibold mb-3 block">Address</Label>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div>
                    <Label htmlFor="edit_house_no">
                      House No. <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="edit_house_no"
                      value={formData.house_no}
                      onChange={(e) => setFormData({ ...formData, house_no: e.target.value })}
                      placeholder="123"
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="edit_moo">Moo (Village No.)</Label>
                    <Input
                      id="edit_moo"
                      value={formData.moo}
                      onChange={(e) => setFormData({ ...formData, moo: e.target.value })}
                      placeholder="หมู่ที่"
                    />
                  </div>
                  <div>
                    <Label htmlFor="edit_soi">Soi (Alley)</Label>
                    <Input
                      id="edit_soi"
                      value={formData.soi}
                      onChange={(e) => setFormData({ ...formData, soi: e.target.value })}
                      placeholder="ซอย"
                    />
                  </div>
                  <div>
                    <Label htmlFor="edit_street">Street</Label>
                    <Input
                      id="edit_street"
                      value={formData.street}
                      onChange={(e) => setFormData({ ...formData, street: e.target.value })}
                      placeholder="ถนน"
                    />
                  </div>
                  <div>
                    <Label htmlFor="edit_sub_district">
                      Sub-district <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="edit_sub_district"
                      value={formData.sub_district}
                      onChange={(e) => setFormData({ ...formData, sub_district: e.target.value })}
                      placeholder="ตำบล/แขวง"
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="edit_district">
                      District <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="edit_district"
                      value={formData.district}
                      onChange={(e) => setFormData({ ...formData, district: e.target.value })}
                      placeholder="อำเภอ/เขต"
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="edit_province">
                      Province <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="edit_province"
                      value={formData.province}
                      onChange={(e) => setFormData({ ...formData, province: e.target.value })}
                      placeholder="จังหวัด"
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="edit_postal_code">
                      Postal Code <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="edit_postal_code"
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
          <div className="flex justify-end">
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Submitting..." : "Update and Re-Submit for Approval"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
