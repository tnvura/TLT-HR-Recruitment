import { supabase } from "@/integrations/supabase/client";

interface NotificationPayload {
  event_type: string;
  candidate_id: string;
  recipient_email: string;
  recipient_name?: string;
  data: Record<string, any>;
}

interface Candidate {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  position_applied: string;
  status: string;
}

class EmailNotificationService {
  private async getWebhookUrl(eventType: string): Promise<string | null> {
    try {
      const { data, error } = await (supabase as any)
        .from("notification_config")
        .select("webhook_url, is_enabled")
        .eq("event_type", eventType)
        .single();

      if (error) {
        console.error(`Error fetching webhook config for ${eventType}:`, error);
        return null;
      }

      return data?.is_enabled ? data.webhook_url : null;
    } catch (error) {
      console.error("Error in getWebhookUrl:", error);
      return null;
    }
  }

  async sendNotification(payload: NotificationPayload): Promise<void> {
    try {
      const webhookUrl = await this.getWebhookUrl(payload.event_type);

      if (!webhookUrl) {
        console.log(`Notifications disabled or not configured for ${payload.event_type}`);
        return;
      }

      // Log notification attempt
      const { data: notification, error: insertError } = await (supabase as any)
        .from("email_notifications")
        .insert({
          candidate_id: payload.candidate_id,
          event_type: payload.event_type,
          recipient_email: payload.recipient_email,
          recipient_name: payload.recipient_name,
          webhook_payload: payload,
          status: "pending",
        })
        .select()
        .single();

      if (insertError) {
        console.error("Error logging notification:", insertError);
        // Continue anyway - we still want to send the email
      }

      // Send to n8n webhook
      const response = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      let responseData;
      try {
        responseData = await response.json();
      } catch (e) {
        responseData = { message: await response.text() };
      }

      // Update notification status
      if (notification) {
        await (supabase as any)
          .from("email_notifications")
          .update({
            status: response.ok ? "sent" : "failed",
            webhook_response: responseData,
            sent_at: new Date().toISOString(),
            error_message: response.ok ? null : responseData.error || responseData.message,
          })
          .eq("id", notification.id);
      }

      if (!response.ok) {
        console.error("Webhook failed:", responseData);
      }
    } catch (error) {
      console.error("Email notification error:", error);
      // Don't throw - email failures shouldn't block main flow
    }
  }

  /**
   * Notify interviewer when candidate is assigned to them
   */
  async notifyCandidateAssigned(
    candidateId: string,
    interviewerEmail: string,
    interviewerName: string,
    assignedByEmail: string,
    candidate: Candidate
  ): Promise<void> {
    await this.sendNotification({
      event_type: "candidate_assigned",
      candidate_id: candidateId,
      recipient_email: interviewerEmail,
      recipient_name: interviewerName,
      data: {
        candidate_name: `${candidate.first_name} ${candidate.last_name}`,
        candidate_position: candidate.position_applied,
        candidate_link: `${window.location.origin}/candidates/${candidateId}`,
        assigned_by: assignedByEmail,
        assigned_at: new Date().toISOString(),
      },
    });
  }

  /**
   * Notify both old and new interviewer when assignment changes
   */
  async notifyInterviewerChanged(
    candidateId: string,
    oldInterviewerEmail: string,
    oldInterviewerName: string,
    newInterviewerEmail: string,
    newInterviewerName: string,
    changedByEmail: string,
    candidate: Candidate
  ): Promise<void> {
    const baseData = {
      candidate_name: `${candidate.first_name} ${candidate.last_name}`,
      candidate_position: candidate.position_applied,
      changed_by: changedByEmail,
      changed_at: new Date().toISOString(),
    };

    // Notify old interviewer
    await this.sendNotification({
      event_type: "interviewer_changed",
      candidate_id: candidateId,
      recipient_email: oldInterviewerEmail,
      recipient_name: oldInterviewerName,
      data: {
        ...baseData,
        notification_type: "removed",
        new_interviewer: newInterviewerName,
      },
    });

    // Notify new interviewer
    await this.sendNotification({
      event_type: "interviewer_changed",
      candidate_id: candidateId,
      recipient_email: newInterviewerEmail,
      recipient_name: newInterviewerName,
      data: {
        ...baseData,
        notification_type: "assigned",
        candidate_link: `${window.location.origin}/candidates/${candidateId}`,
      },
    });
  }

  /**
   * Notify HR when interviewer confirms interest
   */
  async notifyInterestConfirmed(
    candidateId: string,
    hrEmail: string,
    interviewerName: string,
    interviewerEmail: string,
    candidate: Candidate
  ): Promise<void> {
    await this.sendNotification({
      event_type: "interest_confirmed",
      candidate_id: candidateId,
      recipient_email: hrEmail,
      data: {
        candidate_name: `${candidate.first_name} ${candidate.last_name}`,
        candidate_position: candidate.position_applied,
        interviewer_name: interviewerName,
        interviewer_email: interviewerEmail,
        candidate_link: `${window.location.origin}/candidates/${candidateId}`,
        confirmed_at: new Date().toISOString(),
      },
    });
  }

  /**
   * Notify interviewer and candidate when interview is scheduled
   * Data structure compatible with n8n Microsoft Outlook Calendar node
   */
  async notifyInterviewScheduled(
    candidateId: string,
    interviewerEmail: string,
    interviewerName: string,
    candidateEmail: string,
    candidateName: string,
    interviewDetails: {
      interview_date: string; // YYYY-MM-DD format
      interview_time: string; // HH:MM format
      location?: string;
      meeting_link?: string;
      notes?: string;
    },
    scheduledByEmail: string
  ): Promise<void> {
    // Parse date and time to create ISO datetime strings for Outlook Calendar
    const [year, month, day] = interviewDetails.interview_date.split('-');
    const [hours, minutes] = interviewDetails.interview_time.split(':');

    // Create start datetime (ISO 8601 format for Outlook)
    const startDateTime = new Date(
      parseInt(year),
      parseInt(month) - 1,
      parseInt(day),
      parseInt(hours),
      parseInt(minutes)
    );

    // Assume 1 hour duration by default
    const endDateTime = new Date(startDateTime.getTime() + 60 * 60 * 1000);

    const calendarEventData = {
      subject: `Interview - ${candidateName} for ${interviewDetails.location || 'Position'}`,
      start: startDateTime.toISOString(),
      end: endDateTime.toISOString(),
      location: interviewDetails.location || '',
      body: `Interview scheduled with ${candidateName}\n\nPosition: ${interviewDetails.location || ''}\nMeeting Link: ${interviewDetails.meeting_link || 'N/A'}\n\nNotes: ${interviewDetails.notes || 'No additional notes'}`,
      attendees: [
        {
          emailAddress: {
            address: interviewerEmail,
            name: interviewerName
          },
          type: 'required'
        },
        {
          emailAddress: {
            address: candidateEmail,
            name: candidateName
          },
          type: 'required'
        }
      ],
      isOnlineMeeting: !!interviewDetails.meeting_link,
      onlineMeetingUrl: interviewDetails.meeting_link || null
    };

    const baseData = {
      candidate_id: candidateId,
      candidate_name: candidateName,
      candidate_email: candidateEmail,
      interviewer_name: interviewerName,
      interviewer_email: interviewerEmail,
      interview_date: interviewDetails.interview_date,
      interview_time: interviewDetails.interview_time,
      location: interviewDetails.location,
      meeting_link: interviewDetails.meeting_link,
      notes: interviewDetails.notes,
      scheduled_by: scheduledByEmail,
      scheduled_at: new Date().toISOString(),
      // Outlook Calendar Event data
      calendar_event: calendarEventData
    };

    // Send single notification with both recipients
    // n8n can split this to send to both interviewer and candidate
    await this.sendNotification({
      event_type: "interview_scheduled",
      candidate_id: candidateId,
      recipient_email: interviewerEmail, // Primary recipient for logging
      recipient_name: interviewerName,
      data: baseData,
    });
  }

  /**
   * Notify HR when interviewer submits feedback
   */
  async notifyFeedbackSubmitted(
    candidateId: string,
    hrEmail: string,
    interviewerName: string,
    interviewerEmail: string,
    candidate: Candidate,
    feedbackSummary: {
      decision: string;
      total_score: number;
      max_score: number;
      percentage: number;
    }
  ): Promise<void> {
    await this.sendNotification({
      event_type: "feedback_submitted",
      candidate_id: candidateId,
      recipient_email: hrEmail,
      data: {
        candidate_name: `${candidate.first_name} ${candidate.last_name}`,
        candidate_position: candidate.position_applied,
        interviewer_name: interviewerName,
        interviewer_email: interviewerEmail,
        decision: feedbackSummary.decision,
        total_score: feedbackSummary.total_score,
        max_score: feedbackSummary.max_score,
        percentage: feedbackSummary.percentage,
        feedback_link: `${window.location.origin}/interviewer/feedback/${candidateId}/view`,
        candidate_link: `${window.location.origin}/candidates/${candidateId}`,
        submitted_at: new Date().toISOString(),
      },
    });
  }

  /**
   * Notify HR Manager when job offer is submitted for approval
   */
  async notifyOfferSubmittedForApproval(
    candidateId: string,
    hrManagerEmail: string,
    hrManagerName: string,
    submittedByEmail: string,
    candidate: Candidate,
    offerDetails: {
      position_offered: string;
      company_name: string;
      start_date: string;
    }
  ): Promise<void> {
    await this.sendNotification({
      event_type: "offer_submitted_for_approval",
      candidate_id: candidateId,
      recipient_email: hrManagerEmail,
      recipient_name: hrManagerName,
      data: {
        candidate_name: `${candidate.first_name} ${candidate.last_name}`,
        candidate_email: candidate.email,
        position_offered: offerDetails.position_offered,
        company_name: offerDetails.company_name,
        start_date: offerDetails.start_date,
        submitted_by: submittedByEmail,
        candidate_link: `${window.location.origin}/candidates/${candidateId}`,
        submitted_at: new Date().toISOString(),
      },
    });
  }

  /**
   * Notify Interviewer when HR Manager approves job offer
   */
  async notifyOfferApprovedByHRManager(
    candidateId: string,
    interviewerEmail: string,
    interviewerName: string,
    hrManagerEmail: string,
    candidate: Candidate,
    offerDetails: {
      position_offered: string;
      company_name: string;
    }
  ): Promise<void> {
    await this.sendNotification({
      event_type: "offer_approved_by_hr_manager",
      candidate_id: candidateId,
      recipient_email: interviewerEmail,
      recipient_name: interviewerName,
      data: {
        candidate_name: `${candidate.first_name} ${candidate.last_name}`,
        position_offered: offerDetails.position_offered,
        company_name: offerDetails.company_name,
        approved_by: hrManagerEmail,
        candidate_link: `${window.location.origin}/candidates/${candidateId}`,
        approved_at: new Date().toISOString(),
      },
    });
  }

  /**
   * Notify HR when Interviewer acknowledges job offer
   */
  async notifyOfferAcknowledged(
    candidateId: string,
    hrEmail: string,
    interviewerName: string,
    interviewerEmail: string,
    candidate: Candidate,
    offerDetails: {
      position_offered: string;
      company_name: string;
    }
  ): Promise<void> {
    await this.sendNotification({
      event_type: "offer_acknowledged",
      candidate_id: candidateId,
      recipient_email: hrEmail,
      data: {
        candidate_name: `${candidate.first_name} ${candidate.last_name}`,
        candidate_email: candidate.email,
        position_offered: offerDetails.position_offered,
        company_name: offerDetails.company_name,
        interviewer_name: interviewerName,
        interviewer_email: interviewerEmail,
        candidate_link: `${window.location.origin}/candidates/${candidateId}`,
        acknowledged_at: new Date().toISOString(),
      },
    });
  }

  /**
   * Notify relevant parties when job offer is rejected
   */
  async notifyOfferRejected(
    candidateId: string,
    recipientEmail: string,
    recipientName: string,
    rejectedBy: string,
    rejectedByRole: string,
    rejectionNotes: string,
    candidate: Candidate,
    offerDetails: {
      position_offered: string;
      company_name: string;
    }
  ): Promise<void> {
    await this.sendNotification({
      event_type: "offer_rejected",
      candidate_id: candidateId,
      recipient_email: recipientEmail,
      recipient_name: recipientName,
      data: {
        candidate_name: `${candidate.first_name} ${candidate.last_name}`,
        position_offered: offerDetails.position_offered,
        company_name: offerDetails.company_name,
        rejected_by: rejectedBy,
        rejected_by_role: rejectedByRole,
        rejection_notes: rejectionNotes,
        candidate_link: `${window.location.origin}/candidates/${candidateId}`,
        rejected_at: new Date().toISOString(),
      },
    });
  }
}

export const emailNotifications = new EmailNotificationService();
