import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";

interface OfferDetailsViewProps {
  interviewFeedback?: any;
  jobProposal?: any;
  candidate?: any;
}

export function OfferDetailsView({ interviewFeedback, jobProposal, candidate }: OfferDetailsViewProps) {
  return (
    <div className="space-y-4">
      {/* Interview Feedback */}
      {interviewFeedback && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Interview Feedback</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label className="text-xs text-muted-foreground">Interviewer</Label>
                <p className="text-sm font-medium">{interviewFeedback.interviewer_name}</p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Interview Date</Label>
                <p className="text-sm font-medium">
                  {interviewFeedback.interview_date
                    ? format(new Date(interviewFeedback.interview_date), "PPP")
                    : "N/A"}
                </p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Total Score</Label>
                <p className="text-sm font-medium">
                  {interviewFeedback.total_score}/75 ({interviewFeedback.percentage}%)
                </p>
              </div>
            </div>

            <Separator />

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label className="text-xs text-muted-foreground">Current Position</Label>
                <p className="text-sm font-medium">
                  {jobProposal?.current_position || interviewFeedback.current_position || "N/A"}
                </p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Current Salary</Label>
                <p className="text-sm font-medium">
                  {(jobProposal?.current_salary || interviewFeedback.current_salary)
                    ? `${(jobProposal?.current_salary || interviewFeedback.current_salary).toLocaleString()} THB`
                    : "N/A"}
                </p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Expected Salary</Label>
                <p className="text-sm font-medium">
                  {(jobProposal?.expected_salary || interviewFeedback.expected_salary)
                    ? `${(jobProposal?.expected_salary || interviewFeedback.expected_salary).toLocaleString()} THB`
                    : "N/A"}
                </p>
              </div>
            </div>

            {interviewFeedback.comment && (
              <div>
                <Label className="text-xs text-muted-foreground">Feedback</Label>
                <p className="text-sm whitespace-pre-wrap bg-muted p-2 rounded-md mt-1">
                  {interviewFeedback.comment}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Employment Details */}
      {jobProposal && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Employment Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground">Position Offered</Label>
                <p className="text-sm font-medium">{jobProposal.position_offered}</p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Position Level</Label>
                <p className="text-sm font-medium">{jobProposal.position_level || "N/A"}</p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Job Grade</Label>
                <p className="text-sm font-medium">{jobProposal.job_grade || "N/A"}</p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Employment Type</Label>
                <p className="text-sm font-medium capitalize">{jobProposal.employment_type || "N/A"}</p>
              </div>
              {jobProposal.employment_type === "temporary" && (
                <>
                  <div>
                    <Label className="text-xs text-muted-foreground">Temporary Start Date</Label>
                    <p className="text-sm font-medium">
                      {jobProposal.temp_start_date ? format(new Date(jobProposal.temp_start_date), "PPP") : "N/A"}
                    </p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Temporary End Date</Label>
                    <p className="text-sm font-medium">
                      {jobProposal.temp_end_date ? format(new Date(jobProposal.temp_end_date), "PPP") : "N/A"}
                    </p>
                  </div>
                </>
              )}
              <div>
                <Label className="text-xs text-muted-foreground">Position Type</Label>
                <p className="text-sm font-medium">
                  {jobProposal.position_type === "replacement" ? "Replacement" : jobProposal.position_type === "new-position" ? "New Position" : "N/A"}
                </p>
              </div>
            </div>

            <Separator />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground">Company</Label>
                <p className="text-sm font-medium">{jobProposal.company_name || "N/A"}</p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Start Date</Label>
                <p className="text-sm font-medium">
                  {jobProposal.start_date ? format(new Date(jobProposal.start_date), "PPP") : "N/A"}
                </p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Department</Label>
                <p className="text-sm font-medium">
                  {jobProposal.department_en} ({jobProposal.department_th})
                </p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Division</Label>
                <p className="text-sm font-medium">
                  {jobProposal.division_en} ({jobProposal.division_th})
                </p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Section</Label>
                <p className="text-sm font-medium">
                  {jobProposal.section_en} ({jobProposal.section_th})
                </p>
              </div>
            </div>

            {(jobProposal.direct_report_name || jobProposal.manager_name) && (
              <>
                <Separator />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {jobProposal.direct_report_name && (
                    <div>
                      <Label className="text-xs text-muted-foreground">Direct Report</Label>
                      <p className="text-sm font-medium">{jobProposal.direct_report_name}</p>
                      {jobProposal.direct_report_email && (
                        <p className="text-xs text-muted-foreground">{jobProposal.direct_report_email}</p>
                      )}
                    </div>
                  )}
                  {jobProposal.manager_name && (
                    <div>
                      <Label className="text-xs text-muted-foreground">Manager</Label>
                      <p className="text-sm font-medium">{jobProposal.manager_name}</p>
                      {jobProposal.manager_email && (
                        <p className="text-xs text-muted-foreground">{jobProposal.manager_email}</p>
                      )}
                    </div>
                  )}
                </div>
              </>
            )}

            {jobProposal.notes && (
              <>
                <Separator />
                <div>
                  <Label className="text-xs text-muted-foreground">Notes</Label>
                  <p className="text-sm whitespace-pre-wrap bg-muted p-2 rounded-md mt-1">
                    {jobProposal.notes}
                  </p>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Personal Identification */}
      {candidate && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Personal Identification</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground">Full Name (Thai)</Label>
                <p className="text-sm font-medium">
                  {candidate.name_title} {candidate.first_name} {candidate.last_name}
                </p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Full Name (English)</Label>
                <p className="text-sm font-medium">
                  {candidate.name_title} {candidate.first_name_en} {candidate.last_name_en}
                </p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">National ID</Label>
                <p className="text-sm font-medium">{candidate.national_id || "N/A"}</p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Birthday</Label>
                <p className="text-sm font-medium">
                  {candidate.birthday ? format(new Date(candidate.birthday), "PPP") : "N/A"}
                </p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Gender</Label>
                <p className="text-sm font-medium">{candidate.gender || "N/A"}</p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Religion</Label>
                <p className="text-sm font-medium">{candidate.religion || "N/A"}</p>
              </div>
            </div>

            {candidate.house_no && (
              <>
                <Separator />
                <div>
                  <Label className="text-xs text-muted-foreground">Address</Label>
                  <p className="text-sm font-medium">
                    {[
                      candidate.house_no && `${candidate.house_no}`,
                      candidate.moo && `หมู่ ${candidate.moo}`,
                      candidate.soi && `ซอย${candidate.soi}`,
                      candidate.street && `ถนน${candidate.street}`,
                    ]
                      .filter(Boolean)
                      .join(" ")}
                  </p>
                  <p className="text-sm font-medium">
                    {[candidate.sub_district, candidate.district, candidate.province, candidate.postal_code]
                      .filter(Boolean)
                      .join(", ")}
                  </p>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
