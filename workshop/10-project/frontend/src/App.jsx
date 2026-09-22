import { lazy, Suspense, useState } from "react";
const Dashboard = lazy(() => import("./pages/Dashboard.jsx"));
import Login from "./pages/Login.jsx";

export default function App() {
  const [session, setSession] = useState(null);
  return session
    ? <Suspense fallback={<div className="workspace-loading" role="status"><span className="loading-ring"/>Opening your research workspace…</div>}><Dashboard sampleMode={session.sample} onLogout={() => setSession(null)} /></Suspense>
    : <Login onLoggedIn={() => setSession({ sample: false })} onPreview={() => setSession({ sample: true })} />;
}
