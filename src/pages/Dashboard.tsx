import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { useAuth } from "@/hooks/use-auth";
import { LayoutDashboard, Logout } from "lucide-react";
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
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 p-6">
        <header className="flex flex-col gap-1">
          <div className="dashboard-header">
            <h1 className="text-3xl font-bold tracking-tight">Welcome back, {user?.email}</h1>
            <p className="mt-2 text-sm text-muted-foreground">Manage your gaming rooms and track your stats.</p>
          </div>
        </header>

        <Card className="border-border/70 shadow-sm">
          <CardHeader>
            <div className="mb-3 flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <LayoutDashboard size={20} className="text-primary" />
            </div>
            <CardTitle>Active Recess</CardTitle>
            <CardDescription>Join ongoing or practice solo.</CardDescription>
          </CardHeader>
          <CardContent className="dashboard-grid">
            <div className="section-title">Games</div>
            <div className="cards-container">
              <div className="activity-card">
                <div className="card-icon"></div>
                <div className="card-content">
                  <div className="card-title"></div>
                  <div className="card-description"></div>
                </div>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleSignOut}
              className="mt-4 flex items-center gap-2"
            >
              <Logout size={16} />
              Sign out
            </Button>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
