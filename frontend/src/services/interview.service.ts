import apiClient from './api';
import { InterviewSchedule, InterviewFeedback } from '../../types';

export const interviewService = {
    /**
     * Schedule an interview for a request
     */
    async scheduleInterview(requestId: string, interviewData: {
        candidateId: string;
        interviewDate: string;
        interviewTime: string;
        location?: string;
        meetingLink?: string;
        interviewers: string[];
        notes?: string;
    }) {
        const response = await apiClient.post(`/interviews/requests/${requestId}/schedule`, interviewData);
        return response.data;
    },

    /**
     * Submit interview feedback
     */
    async submitFeedback(requestId: string, feedbackData: {
        decision: 'PROCEED' | 'REJECT';
        overallRating: number;
        technicalSkills: number;
        culturalFit: number;
        communication: number;
        feedback: string;
        concerns?: string;
    }) {
        const response = await apiClient.post(`/interviews/requests/${requestId}/feedback`, feedbackData);
        return response.data;
    },

    /**
     * Get interview details (schedule and feedback)
     */
    async getInterviewDetails(requestId: string): Promise<{
        schedule: InterviewSchedule | null;
        feedback: InterviewFeedback | null;
    }> {
        const response = await apiClient.get(`/interviews/requests/${requestId}`);
        return response.data.data;
    }
};

export default interviewService;
