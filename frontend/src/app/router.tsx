import { Navigate, Route, Routes } from "react-router-dom";

import { DesktopGuard } from "../components/DesktopGuard";
import { AdminPage } from "../pages/AdminPage";
import { CompletionPage } from "../pages/CompletionPage";
import { DebriefPage } from "../pages/DebriefPage";
import { GamePage } from "../pages/GamePage";
import { IntroPage } from "../pages/IntroPage";
import { LandingPage } from "../pages/LandingPage";
import { LearningPage } from "../pages/LearningPage";
import { LobbyPage } from "../pages/LobbyPage";

export function AppRouter() {
  return (
    <>
      <DesktopGuard />
      <Routes>
        <Route path="/" element={<IntroPage />} />
        <Route path="/session/:token" element={<LandingPage />} />
        <Route path="/session/:token/learning" element={<LearningPage />} />
        <Route path="/session/:token/lobby" element={<LobbyPage />} />
        <Route path="/session/:token/game" element={<GamePage />} />
        <Route path="/session/:token/debrief" element={<DebriefPage />} />
        <Route path="/session/:token/completion" element={<CompletionPage />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}
