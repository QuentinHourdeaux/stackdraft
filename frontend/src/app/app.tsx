import { Route, Routes } from "react-router";
import { AppShell } from "./app-shell.tsx";
import { NotFoundPage } from "./routes/not-found-page.tsx";
import { StackDetailPage } from "./routes/stack-detail-page.tsx";
import { StackListPage } from "./routes/stack-list-page.tsx";
import { StateSettingsPage } from "./routes/state-settings-page.tsx";

export function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<StackListPage />} />
        <Route path="stacks/:stackId" element={<StackDetailPage />} />
        <Route path="settings/states" element={<StateSettingsPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
