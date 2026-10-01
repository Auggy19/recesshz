import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/use-auth";
import { LayoutDashboard, LogOut } from "lucide-react";
import { useNavigate } from "react-router";
import "../styles/dashboard.css";

export default function Dashboard() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  return (
    <main className="min-h-screen bg-background px-6 py-10 text-foreground">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8">
        <div className="dashboard-header">
            <h1 className="text-3xl font-bold tracking-tight text-white">Dashboard</h1>
            <p className="mt-2 text-sm text-zinc-400">Manage groups, events, and clubs.</p>
          </div>
        </header>

        <Card className="border-border/70 shadow-none">
          <CardHeader>

            <div className="dashboard-grid">
  <div className="section-title">Active Recess</div>
  <div className="cards-container">
    <div className="activity-card">
      <div className="card-icon">🎮</div>
      <div className="card-info">
        <h3 className="card-title">Quick Tic Tac Toe</h3>
        <p className="card-description">A short game between messages. Start a room or practice solo.</p>
      </div>
    </div>
  </div>
</div>

      </div>
    </main>
  );
}
