import { Route, Routes } from "react-router";
import { AppShell } from "./app-shell.tsx";
import { DraftDetailPage } from "./routes/draft-detail-page.tsx";
import { DraftListPage } from "./routes/draft-list-page.tsx";
import { NotFoundPage } from "./routes/not-found-page.tsx";
import { StackDetailPage } from "./routes/stack-detail-page.tsx";
import { StackListPage } from "./routes/stack-list-page.tsx";
import { StateSettingsPage } from "./routes/state-settings-page.tsx";

export function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<DraftListPage />} />
        <Route path="stacks" element={<StackListPage />} />
        <Route path="stacks/:stackId" element={<StackDetailPage />} />
        <Route path="drafts/:draftId" element={<DraftDetailPage />} />
        <Route path="settings/states" element={<StateSettingsPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
