import { supabase } from "@/integrations/supabase/client";

interface CreateNotificationParams {
  userId: string;
  type: string;
  title: string;
  message: string;
  relatedCandidateId?: string;
  relatedProposalId?: string;
}

export const offerNotifications = {
  // Create a notification for HR Manager approval
  async notifyHRManagerApproval(
    hrManagerUserId: string,
    candidateId: string,
    candidateName: string,
    position: string,
    proposalId: string
  ) {
    return this.createNotification({
      userId: hrManagerUserId,
      type: "offer_approval_hr_manager",
      title: "New Offer Pending Approval",
      message: `Offer for ${candidateName} - ${position} requires your approval`,
      relatedCandidateId: candidateId,
      relatedProposalId: proposalId,
    });
  },

  // Create a notification for Interviewer acknowledgment
  async notifyInterviewerAcknowledgment(
    interviewerUserId: string,
    candidateId: string,
    candidateName: string,
    position: string,
    proposalId: string
  ) {
    return this.createNotification({
      userId: interviewerUserId,
      type: "offer_approval_interviewer",
      title: "Offer Acknowledgment Required",
      message: `Offer for ${candidateName} - ${position} needs your acknowledgment`,
      relatedCandidateId: candidateId,
      relatedProposalId: proposalId,
    });
  },

  // Create a generic notification
  async createNotification(params: CreateNotificationParams) {
    try {
      const { error } = await (supabase as any).from("notifications").insert({
        user_id: params.userId,
        type: params.type,
        title: params.title,
        message: params.message,
        related_candidate_id: params.relatedCandidateId,
        related_proposal_id: params.relatedProposalId,
        is_read: false,
      });

      if (error) throw error;
    } catch (error: any) {
      console.error("Error creating notification:", error);
      throw error;
    }
  },

  // Get HR Manager user ID (first hr_manager found)
  async getHRManagerUserId(): Promise<string | null> {
    try {
      const { data, error } = await (supabase as any)
        .from("user_roles")
        .select("user_id")
        .eq("role", "hr_manager")
        .eq("is_active", true)
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return data?.user_id || null;
    } catch (error) {
      console.error("Error fetching HR Manager:", error);
      return null;
    }
  },

  // Get interviewer user ID from interview record
  async getInterviewerUserId(candidateId: string): Promise<string | null> {
    try {
      // First get interviewer email from interviews table
      const { data: interview, error: interviewError } = await (supabase as any)
        .from("interviews")
        .select("interviewer_email")
        .eq("candidate_id", candidateId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (interviewError || !interview) return null;

      // Then get user ID from auth.users based on email
      const { data: { users }, error: usersError } = await supabase.auth.admin.listUsers();

      if (usersError) {
        console.error("Error fetching users:", usersError);
        // Fallback: try to get from user_roles table using email
        const { data: userRole } = await (supabase as any)
          .from("user_roles")
          .select("user_id")
          .eq("role", "interviewer")
          .eq("is_active", true)
          .limit(1)
          .maybeSingle();

        return userRole?.user_id || null;
      }

      const interviewer = users?.find((u) => u.email === interview.interviewer_email);
      return interviewer?.id || null;
    } catch (error) {
      console.error("Error fetching interviewer user ID:", error);
      return null;
    }
  },
};
