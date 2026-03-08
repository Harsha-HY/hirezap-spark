import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import CandidateSignup from "./pages/CandidateSignup";
import Jobs from "./pages/Jobs";
import OwnerDashboard from "./pages/OwnerDashboard";
import AdminDashboard from "./pages/AdminDashboard";

import HRDashboard from "./pages/HRDashboard";
import CandidateDashboard from "./pages/CandidateDashboard";
import AptitudeTest from "./pages/AptitudeTest";
import VideoIntro from "./pages/VideoIntro";
import ReviewAssessment from "./pages/ReviewAssessment";
import ReviewTechnical from "./pages/ReviewTechnical";
import TechnicalTest from "./pages/TechnicalTest";
import NotFound from "./pages/NotFound";
import ProtectedRoute from "./components/ProtectedRoute";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/candidate-signup" element={<CandidateSignup />} />
          <Route path="/jobs" element={<Jobs />} />
          <Route
            path="/owner-dashboard"
            element={
              <ProtectedRoute requiredRole="owner">
                <OwnerDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin-dashboard"
            element={
              <ProtectedRoute requiredRole="superadmin">
                <AdminDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/manager-dashboard"
            element={
              <ProtectedRoute requiredRole="manager">
                <HRDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/hr-dashboard"
            element={
              <ProtectedRoute requiredRole="hr">
                <HRDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/review-assessment/:assessmentId"
            element={
              <ProtectedRoute requiredRole={["hr", "manager"]}>
                <ReviewAssessment />
              </ProtectedRoute>
            }
          />
          <Route
            path="/review-technical/:assessmentId"
            element={
              <ProtectedRoute requiredRole={["hr", "manager"]}>
                <ReviewTechnical />
              </ProtectedRoute>
            }
          />
          <Route
            path="/candidate-dashboard"
            element={
              <ProtectedRoute requiredRole="candidate">
                <CandidateDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/aptitude-test"
            element={
              <ProtectedRoute requiredRole="candidate">
                <AptitudeTest />
              </ProtectedRoute>
            }
          />
          <Route
            path="/video-intro"
            element={
              <ProtectedRoute requiredRole="candidate">
                <VideoIntro />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
