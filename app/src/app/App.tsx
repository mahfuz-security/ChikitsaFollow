import { AppProviders } from "./providers/AppProviders";
import { AuthProvider } from "./providers/AuthProvider";
import { AppRouter } from "./router/routes";
import { GuidanceChat } from "../features/ai/GuidanceChat";

export function App() {
  return (
    <AppProviders>
      <AuthProvider>
        <AppRouter />
        <GuidanceChat />
      </AuthProvider>
    </AppProviders>
  );
}
