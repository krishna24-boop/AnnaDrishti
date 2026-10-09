import { useEffect, useState } from "react";
import Login from "./Login";
import Home from "./Home";
import FarmerProfile from "./FarmerProfile";

export default function App() {
  const [installPrompt, setInstallPrompt] = useState(null);
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem("user")); } catch { return null; }
  });
  const [page, setPage] = useState("home");
  useEffect(() => {
    const capturePrompt = (event) => {
      event.preventDefault();
      setInstallPrompt(event);
    };
    window.addEventListener("beforeinstallprompt", capturePrompt);
    return () => window.removeEventListener("beforeinstallprompt", capturePrompt);
  }, []);
  const login = (u) => { localStorage.setItem("user", JSON.stringify(u)); setUser(u); };
  const logout = () => { localStorage.removeItem("user"); setUser(null); setPage("home"); };
  const install = async () => {
    if (!installPrompt) return;
    await installPrompt.prompt();
    setInstallPrompt(null);
  };
  if (!user) return <Login onLogin={(nextUser) => { login(nextUser); setPage("home"); }} />;
  if (page === "profile") {
    return <FarmerProfile user={user} onBack={() => setPage("home")} onLogout={logout} />;
  }
  return <Home
    user={user}
    onLogout={logout}
    onOpenProfile={() => setPage("profile")}
    canInstall={Boolean(installPrompt)}
    onInstall={install}
  />;
}
