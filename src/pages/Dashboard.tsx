import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/use-auth";
import { LayoutDashboard, LogOut } from "lucide-react";
import { useNavigate } from "react-router";

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
</header>

          </Button>
        </header>

        <Card className="border-border/70 shadow-none">
          <CardHeader>
            <div className="mb-3 flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <LayoutDashboard className="size-5" />
            </div>
            <CardTitle>Your dashboard is ready</CardTitle>
          </CardHeader>
          <CardContent className="text-sm leading-6 text-muted-foreground">
            Replace this starter content with the product&apos;s authenticated
            experience. The route is protected and sign-in returns here by
            default.
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
