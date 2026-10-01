import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useAuth } from "@/hooks/use-auth";
import { LayoutDashboard, LogOut } from "lucide-react";
import { useNavigate } from "react-router-dom";
import "../styles/dashboard.css";

export default function Dashboard() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  return (
    <main className="min-h-screen bg-background text-zinc-100">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 p-4 sm:p-6 lg:p-8">
        <header className="flex flex-col gap-1">
          <div className="dashboard-header">
            <h1 className="text-3xl font-bold tracking-tight text-white">Dashboard</h1>
            <p className="mt-2 text-sm text-zinc-400">Manage groups, events, and clubs.</p>
          </div>
        </header>

        <Card className="border-border/70 shadow-none">
          <CardHeader>
            <div className="mb-3 flex size-10 items-center justify-center rounded-lg border border-border/50 bg-accent/30">
              <LogOut size={20} className="text-primary" />
            </div>
            <CardTitle>Active Recess</CardTitle>
            <CardDescription>Join ongoing or pending sessions</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="dashboard-grid">
              <div className="section-title">Active Recess</div>
              <div className="cards-container">
                <div className="activity-card">
                  <div className="card-icon">🎮</div>
                  <div className="card-info">
                    <h3 className="card-title">Quick Tic Tac Toe</h3>
                    <p className="card-description">A short game to pass the time</p>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
