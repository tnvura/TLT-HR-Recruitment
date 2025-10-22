import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Calendar as CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { usePermissions } from "@/hooks/usePermissions";
import logo from "@/assets/talaadthai-logo.png";

const competencyTopics = [
  "ความรู้ในงาน ทักษะและประสบการณ์เหมาะสมสำหรับตำแหน่งที่สัมภาษณ์",
  "ท่าทาง / บุคลิกภาพ / มารยาท / ความเหมาะสมของการแต่งกาย",
  "ความสามารถในการสื่อสาร (ชัดเจน เข้าใจง่าย)",
  "มีปฏิภาณไหวพริบ การวิเคราะห์ และตอบคำถาม",
  "ทัศนคติต่อตนเอง ผู้อื่น และงานที่จะปฏิบัติ",
  "มีลักษณะการเป็นผู้นำ",
  "ความเหมาะสมกับองค์กรในตำแหน่งที่สัมภาษณ์",
];

const coreValueTopics = [
  { letter: "S", color: "text-green-600", text: 'มีมนุษย์สัมพันธ์ที่ดี "ยิ้มแย้มแจ่มใส พร้อมให้บริการ"' },
  { letter: "S", color: "text-green-600", text: "การแก้ไขปัญหาแม้ว่าจะนอกเหนือหน้าที่ความรับผิดชอบ" },
  { letter: "A", color: "text-orange-500", text: "ความมีวิริยะ อุตสาหะ ความกระตือรือร้น และความพร้อมจะเรียนรู้" },
  { letter: "A", color: "text-orange-500", text: "การส่งมอบงานให้กับผู้อื่น / ความละเอียดรอบคอบในงาน" },
  { letter: "T", color: "text-blue-900", text: "การสนับสนุนทีมงาน, การรับฟังความเห็น และการทำงานร่วมกับผู้อื่น" },
  { letter: "T", color: "text-blue-900", text: "เมื่อเกิดปัญหากล้าที่จะยอมรับผิดและช่วยกันแก้ไขปรับปรุง" },
  { letter: "I", color: "text-cyan-500", text: "การตรงต่อเวลา" },
  { letter: "I", color: "text-cyan-500", text: "ทำงานด้วยความโปร่งใส ตรวจสอบได้ หรือไม่เอื้อประโยชน์กับพวกพ้อง หรือไม่ใช้ทรัพยากรส่วนรวมเพื่อประโยชน์ส่วนตน ไม่ละเมิดสิทธิผู้อื่น" },
];

interface CompetencyScore {
  topic_index: number;
  score: number;
  opinion: string;
}

interface CoreValueScore {
  topic_index: number;
  score: number;
  opinion: string;
}

interface FeedbackData {
  id: string;
  candidate_id: string;
  interviewer_email: string;
  interviewer_name: string;
  applied_date: string | null;
  interview_date: string;
  position_level: string;
  job_grade: string;
  current_salary: number | null;
  expected_salary: number | null;
  current_position: string | null;
  employment_type: string;
  temp_start_date: string | null;
  temp_end_date: string | null;
  position_type: string;
  competency_scores: CompetencyScore[];
  core_value_scores: CoreValueScore[];
  total_score: number;
  percentage: number;
  comment: string | null;
  decision: string;
  submitted_at: string;
}

export default function InterviewFeedbackView() {
  const { candidateId, feedbackId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const permissions = usePermissions();

  const [isLoading, setIsLoading] = useState(true);
  const [feedback, setFeedback] = useState<FeedbackData | null>(null);
  const [candidate, setCandidate] = useState<any>(null);

  useEffect(() => {
    fetchFeedback();
  }, [candidateId, feedbackId]);

  const fetchFeedback = async () => {
    try {
      setIsLoading(true);

      // Fetch feedback - either by feedbackId or latest for candidate
      let feedbackQuery;
      if (feedbackId) {
        feedbackQuery = (supabase as any)
          .from("interview_feedback")
          .select("*")
          .eq("id", feedbackId)
          .single();
      } else if (candidateId) {
        feedbackQuery = (supabase as any)
          .from("interview_feedback")
          .select("*")
          .eq("candidate_id", candidateId)
          .order("submitted_at", { ascending: false })
          .limit(1)
          .maybeSingle();
      } else {
        toast({
          title: "Error",
          description: "Missing feedback or candidate ID",
          variant: "destructive",
        });
        navigate("/candidates");
        return;
      }

      const { data: feedbackData, error: feedbackError } = await feedbackQuery;

      if (feedbackError) throw feedbackError;

      if (!feedbackData) {
        toast({
          title: "Not Found",
          description: "No interview feedback found",
          variant: "destructive",
        });
        navigate("/candidates");
        return;
      }

      setFeedback(feedbackData);

      // Fetch candidate using candidate_id from feedback
      const { data: candidateData, error: candidateError } = await supabase
        .from("candidates")
        .select("*")
        .eq("id", feedbackData.candidate_id)
        .single();

      if (candidateError) throw candidateError;
      setCandidate(candidateData);
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

  const getDecisionBadge = (decision: string) => {
    switch (decision) {
      case "to_offer":
        return <Badge className="bg-green-100 text-green-700">To Offer</Badge>;
      case "on_hold":
        return <Badge className="bg-gray-100 text-gray-700">On Hold</Badge>;
      case "reject":
        return <Badge className="bg-red-100 text-red-700">Reject</Badge>;
      default:
        return <Badge>{decision}</Badge>;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!feedback) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4">Feedback not found</h2>
          <Button onClick={() => navigate(`/candidates/${candidateId}`)}>Back to Candidate</Button>
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
        <Button variant="ghost" onClick={() => navigate(`/candidates/${feedback.candidate_id}`)} className="mb-6">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Candidate
        </Button>

        <div className="max-w-6xl mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-bold text-foreground">Interview Feedback - Read Only</h1>
            {getDecisionBadge(feedback.decision)}
          </div>

          {/* Interviewer & Submission Info */}
          <Card>
            <CardHeader>
              <CardTitle>Feedback Information</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Interviewer</p>
                  <p className="font-medium">{feedback.interviewer_name}</p>
                  <p className="text-sm text-muted-foreground">{feedback.interviewer_email}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Submitted At</p>
                  <p className="font-medium">
                    {format(new Date(feedback.submitted_at), "PPP 'at' p")}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Candidate Profile */}
          <Card>
            <CardHeader>
              <CardTitle>Candidate Profile</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Name</p>
                  <p className="font-medium">
                    {candidate?.first_name} {candidate?.last_name}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Applied Position</p>
                  <p className="font-medium">{candidate?.position_applied}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Position Level</p>
                  <p className="font-medium">{feedback.position_level}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Job Grade</p>
                  <p className="font-medium">{feedback.job_grade}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Applied Date</p>
                  <p className="font-medium">
                    {feedback.applied_date ? format(new Date(feedback.applied_date), "PPP") : "N/A"}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Interview Date</p>
                  <p className="font-medium">{format(new Date(feedback.interview_date), "PPP")}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Current Employment */}
          <Card>
            <CardHeader>
              <CardTitle>Current Employment</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Current Salary</p>
                  <p className="font-medium">
                    {feedback.current_salary ? `฿${feedback.current_salary.toLocaleString()}` : "N/A"}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Expected Salary</p>
                  <p className="font-medium">
                    {feedback.expected_salary ? `฿${feedback.expected_salary.toLocaleString()}` : "N/A"}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Current Position</p>
                  <p className="font-medium">{feedback.current_position || "N/A"}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Employment Terms */}
          <Card>
            <CardHeader>
              <CardTitle>TalaadThai Employment Terms</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Employment Type</p>
                  <p className="font-medium capitalize">{feedback.employment_type.replace("-", " ")}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Position Type</p>
                  <p className="font-medium capitalize">{feedback.position_type.replace("-", " ")}</p>
                </div>
                {feedback.employment_type === "temporary" && (
                  <>
                    <div>
                      <p className="text-sm text-muted-foreground">Temporary Period Start</p>
                      <p className="font-medium">
                        {feedback.temp_start_date ? format(new Date(feedback.temp_start_date), "PPP") : "N/A"}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Temporary Period End</p>
                      <p className="font-medium">
                        {feedback.temp_end_date ? format(new Date(feedback.temp_end_date), "PPP") : "N/A"}
                      </p>
                    </div>
                  </>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Competency Assessment */}
          <Card>
            <CardHeader>
              <CardTitle>Competency Assessment</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-emerald-100 hover:bg-emerald-100">
                      <TableHead className="w-16 text-center font-semibold text-foreground">#</TableHead>
                      <TableHead className="w-[500px] text-center font-semibold text-foreground">Topic</TableHead>
                      <TableHead className="w-32 text-center font-semibold text-foreground">Score</TableHead>
                      <TableHead className="w-64 text-center font-semibold text-foreground">Opinion</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {competencyTopics.map((topic, index) => {
                      const score = feedback.competency_scores.find((s) => s.topic_index === index);
                      return (
                        <TableRow key={index}>
                          <TableCell className="font-medium">{index + 1}</TableCell>
                          <TableCell>{topic}</TableCell>
                          <TableCell className="text-center">
                            <Badge variant="outline">{score?.score || "-"} / 5</Badge>
                          </TableCell>
                          <TableCell className="text-sm">{score?.opinion || "-"}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* Core Value Assessment */}
          <Card>
            <CardHeader>
              <CardTitle>Core Value Assessment</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-emerald-100 hover:bg-emerald-100">
                      <TableHead className="w-16 text-center font-semibold text-foreground">#</TableHead>
                      <TableHead className="w-[500px] text-center font-semibold text-foreground">Topic</TableHead>
                      <TableHead className="w-32 text-center font-semibold text-foreground">Score</TableHead>
                      <TableHead className="w-64 text-center font-semibold text-foreground">Opinion</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {coreValueTopics.map((topic, index) => {
                      const score = feedback.core_value_scores.find((s) => s.topic_index === index);
                      return (
                        <TableRow key={index}>
                          <TableCell className="font-medium">{index + 1}</TableCell>
                          <TableCell>
                            <span className={`${topic.color} font-bold`}>{topic.letter}</span>
                            <span> : {topic.text}</span>
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge variant="outline">{score?.score || "-"} / 5</Badge>
                          </TableCell>
                          <TableCell className="text-sm">{score?.opinion || "-"}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* Interviewer Feedback & Decision */}
          <Card>
            <CardHeader>
              <CardTitle>Interviewer Feedback & Decision</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-4">
                <div className="flex-1">
                  <p className="text-sm text-muted-foreground mb-2">Comment</p>
                  <div className="p-4 bg-muted rounded-lg min-h-[100px]">
                    <p className="whitespace-pre-wrap">{feedback.comment || "No comment provided"}</p>
                  </div>
                </div>
                <div className="bg-primary text-primary-foreground px-10 py-6 rounded-lg shadow-lg flex-shrink-0 flex flex-col justify-center items-center min-w-[180px]">
                  <div className="text-sm font-medium mb-1 text-center">Total Score</div>
                  <div className="text-4xl font-bold text-center">
                    {feedback.total_score}/{(competencyTopics.length + coreValueTopics.length) * 5}
                  </div>
                  <div className="text-xl font-semibold mt-2 text-center">({feedback.percentage}%)</div>
                </div>
              </div>
              <div className="pt-4 border-t">
                <p className="text-sm text-muted-foreground mb-2">Final Decision</p>
                <div className="flex items-center gap-2">
                  {getDecisionBadge(feedback.decision)}
                  <span className="text-muted-foreground text-sm">
                    Submitted on {format(new Date(feedback.submitted_at), "PPP 'at' p")}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
