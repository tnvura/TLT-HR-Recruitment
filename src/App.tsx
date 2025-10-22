import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import Index from "./pages/Index";
import Login from "./pages/Login";
import Candidates from "./pages/Candidates";
import CandidateDetail from "./pages/CandidateDetail";
import SendOfferPage from "./pages/SendOfferPage";
import ApplicationForm from "./components/ApplicationForm";
import Unauthorized from "./pages/Unauthorized";
import AccessPending from "./pages/AccessPending";
import AuthCallback from "./pages/AuthCallback";
import AdminUsers from "./pages/AdminUsers";
import InterviewerDashboard from "./pages/InterviewerDashboard";
import InterviewFeedbackForm from "./pages/InterviewFeedbackForm";
import InterviewFeedbackView from "./pages/InterviewFeedbackView";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/login" element={<Login />} />
          <Route path="/auth/callback" element={<AuthCallback />} />
          <Route path="/access-pending" element={<AccessPending />} />
          <Route path="/unauthorized" element={<Unauthorized />} />
          <Route
            path="/candidates"
            element={
              <ProtectedRoute allowedRoles={['hr_admin', 'hr_staff']}>
                <Candidates />
              </ProtectedRoute>
            }
          />
          <Route 
            path="/candidates/new" 
            element={
              <ProtectedRoute allowedRoles={['hr_admin', 'hr_staff']}>
                <ApplicationForm />
              </ProtectedRoute>
            } 
          />
          <Route
            path="/candidates/:id"
            element={
              <ProtectedRoute allowedRoles={['hr_admin', 'hr_staff', 'interviewer']}>
                <CandidateDetail />
              </ProtectedRoute>
            }
          />
          <Route
            path="/candidates/:candidateId/send-offer"
            element={
              <ProtectedRoute allowedRoles={['hr_admin', 'hr_staff', 'hr_manager']}>
                <SendOfferPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/users"
            element={
              <ProtectedRoute allowedRoles={['hr_admin']}>
                <AdminUsers />
              </ProtectedRoute>
            }
          />
          <Route
            path="/interviewer/dashboard"
            element={
              <ProtectedRoute allowedRoles={['interviewer', 'hr_admin']}>
                <InterviewerDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/interviewer/feedback/:candidateId"
            element={
              <ProtectedRoute allowedRoles={['interviewer', 'hr_admin']}>
                <InterviewFeedbackForm />
              </ProtectedRoute>
            }
          />
          <Route
            path="/feedback/view/:feedbackId"
            element={
              <ProtectedRoute allowedRoles={['hr_admin', 'hr_staff']}>
                <InterviewFeedbackView />
              </ProtectedRoute>
            }
          />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
