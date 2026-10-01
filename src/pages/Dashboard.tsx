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
        <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <header className="dashboard-header">
  <div className="search-container">
    <input type="text" placeholder="Find hangouts, groups..." className="search-bar" />
  </div>
  <nav className="filter-pills">
    <button className="pill active">Groups</button>
    <button className="pill">Events</button>
    <button className="pill">Clubs</button>
  </nav>
          <CardHeader>
            <div className="mb-3 flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <LayoutDashboard className="size-5" />
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
