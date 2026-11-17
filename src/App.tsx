import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HashRouter, Routes, Route, Navigate, useNavigate } from "react-router-dom";
import { useState, useEffect, lazy, Suspense } from "react";
const AuthPage = lazy(() => import("./pages/AuthPage"));
const LandingPage = lazy(() => import("./pages/LandingPage"));
const Index = lazy(() => import("./pages/Index"));
const LessonPage = lazy(() => import("./pages/LessonPage"));
const LessonsPage = lazy(() => import("./pages/LessonsPage"));
const PracticePage = lazy(() => import("./pages/PracticePage"));
const InfoPage = lazy(() => import("./pages/InfoPage"));
const TopicVideoPage = lazy(() => import("./pages/TopicVideoPage"));
const TestPage = lazy(() => import("./pages/TestPage"));
const YakuniyTestPage = lazy(() => import("./pages/YakuniyTestPage"));
const ProfilePage = lazy(() => import("./pages/ProfilePage"));
const CheckoutPage = lazy(() => import("./pages/CheckoutPage"));
const DuelPage = lazy(() => import("./pages/DuelPage"));
const LeaderboardPage = lazy(() => import("./pages/LeaderboardPage"));
const AvtodromPage = lazy(() => import("./game/AvtodromPage"));
const FoydaliMalumotlarPage = lazy(() => import("./pages/FoydaliMalumotlarPage"));
const LegalPage = lazy(() => import("./pages/LegalPage"));
const MistakesPage = lazy(() => import("./pages/MistakesPage"));
const AllQuestionsPage = lazy(() => import("./pages/AllQuestionsPage"));
const SavedPage = lazy(() => import("./pages/SavedPage"));
const SearchPage = lazy(() => import("./pages/SearchPage"));
const ExamCentersPage = lazy(() => import("./pages/ExamCentersPage"));
const CheatSheetsPage = lazy(() => import("./pages/CheatSheetsPage"));
import { useAuth } from "./hooks/useAuth";
import { PresenceProvider, useUserEvent } from "./hooks/usePresence";
import { CornerSwitch } from "./components/CornerSwitch";
import NotFound from "./pages/NotFound";
import { safeStorage } from '@/lib/safeStorage';

// Shown for a moment while a page chunk loads.
const PageFallback = () => <div className="min-h-[60vh]" />;

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 60,
      gcTime: 1000 * 60 * 60 * 24,
      refetchOnWindowFocus: false,
      // Auto-recover when the connection comes back. Without this a single
      // mobile-network blip left a failed query stuck in its error state
      // forever (nothing else retries it), so the student sat looking at an
      // empty "no lessons found" screen until they fully reloaded the page.
      // Only fires on a real online event, so it costs no idle invocations.
      refetchOnReconnect: true,
      retry: 2,
    },
  },
});

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    setIsAuthenticated(!!safeStorage.getItem('session_token'));
  }, []);

  if (isAuthenticated === null) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Юкланмоқда...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/auth" replace />;
  }

  return <AuthenticatedContent>{children}</AuthenticatedContent>;
}

function AuthenticatedContent({ children }: { children: React.ReactNode }) {
  useAuth();
  return <>{children}</>;
}

// Root route: logged-out visitors always see the marketing landing page.
// Logged-in visitors go straight into the study app (least surprising,
// avoids re-prompting for login) unless they've manually flipped to the
// landing view via the corner switch.
function RootRoute() {
  const [hasSession, setHasSession] = useState<boolean | null>(null);

  useEffect(() => {
    setHasSession(!!safeStorage.getItem('session_token'));
  }, []);

  if (hasSession === null) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Юкланмоқда...</div>
      </div>
    );
  }

  // Logged-out → marketing landing. Logged-in → straight into the study app.
  if (!hasSession) return <LandingPage />;

  return (
    <ProtectedRoute>
      <Index />
    </ProtectedRoute>
  );
}

function GlobalCornerSwitch() {
  const [hasSession, setHasSession] = useState(false);

  useEffect(() => {
    setHasSession(!!safeStorage.getItem('session_token'));
    const onStorage = () => setHasSession(!!safeStorage.getItem('session_token'));
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  // Logged-out visitors are on the landing page, which already has its own
  // theme toggle in the nav bar (next to language/login) -- this floating
  // corner button there was a confusing duplicate. Logged-in users have no
  // other theme toggle anywhere in the app, so it stays for them.
  // Logged-in students switch the theme in Profile; the corner button sat over the tab bar.
  void hasSession;
  return null;
}

// A random opponent was found: take the student to the room wherever he is.
function DuelMatchListener() {
  const navigate = useNavigate();
  useUserEvent('duel_matched', (payload) => {
    if (typeof payload.duel_id === 'string') navigate(`/duel/${payload.duel_id}`);
  });
  return null;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <HashRouter>
        <PresenceProvider>
        <DuelMatchListener />
        <GlobalCornerSwitch />
        <Suspense fallback={<PageFallback />}>
        <Routes>
          <Route path="/auth" element={<AuthPage />} />
          {/* Registration is mandatory — old public preview routes now lead to sign-up. */}
          <Route path="/preview/lesson" element={<Navigate to="/auth" replace />} />
          <Route path="/preview/yakuniy" element={<Navigate to="/auth" replace />} />
          <Route path="/" element={<RootRoute />} />
          <Route path="/oferta" element={<LegalPage type="offer" />} />
          <Route path="/privacy" element={<LegalPage type="privacy" />} />
          <Route path="/profile" element={
            <ProtectedRoute>
              <ProfilePage />
            </ProtectedRoute>
          } />
          <Route path="/checkout" element={
            <ProtectedRoute>
              <CheckoutPage />
            </ProtectedRoute>
          } />
          <Route path="/duel/:duelId" element={
            <ProtectedRoute>
              <DuelPage />
            </ProtectedRoute>
          } />
          <Route path="/leaderboard" element={
            <ProtectedRoute>
              <LeaderboardPage />
            </ProtectedRoute>
          } />
          <Route path="/lessons" element={<ProtectedRoute><LessonsPage /></ProtectedRoute>} />
          <Route path="/practice" element={<ProtectedRoute><PracticePage /></ProtectedRoute>} />
          <Route path="/info" element={<ProtectedRoute><InfoPage /></ProtectedRoute>} />
          <Route path="/mistakes" element={<ProtectedRoute><MistakesPage /></ProtectedRoute>} />
          <Route path="/all-questions" element={<ProtectedRoute><AllQuestionsPage /></ProtectedRoute>} />
          <Route path="/saved" element={<ProtectedRoute><SavedPage /></ProtectedRoute>} />
          <Route path="/search" element={<ProtectedRoute><SearchPage /></ProtectedRoute>} />
          <Route path="/exam-centers" element={<ProtectedRoute><ExamCentersPage /></ProtectedRoute>} />
          <Route path="/cheat-sheets" element={<ProtectedRoute><CheatSheetsPage /></ProtectedRoute>} />
          <Route path="/cheat-sheets/:sheetId" element={<ProtectedRoute><CheatSheetsPage /></ProtectedRoute>} />
          <Route path="/avtodrom" element={<ProtectedRoute><AvtodromPage /></ProtectedRoute>} />
          <Route path="/foydali-malumotlar" element={
            <ProtectedRoute>
              <FoydaliMalumotlarPage />
            </ProtectedRoute>
          } />
          <Route path="/lesson/:lessonId" element={
            <ProtectedRoute>
              <LessonPage />
            </ProtectedRoute>
          } />
          <Route path="/topic/:topicId/video" element={
            <ProtectedRoute>
              <TopicVideoPage />
            </ProtectedRoute>
          } />
          <Route path="/test/yakuniy/:topicId" element={
            <ProtectedRoute>
              <YakuniyTestPage />
            </ProtectedRoute>
          } />
          <Route path="/test/:topicId" element={
            <ProtectedRoute>
              <TestPage />
            </ProtectedRoute>
          } />
          <Route path="*" element={<NotFound />} />
        </Routes>
        </Suspense>
        </PresenceProvider>
      </HashRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
