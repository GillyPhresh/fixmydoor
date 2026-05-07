import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { lazy, Suspense } from "react";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";

const Home = lazy(() => import("./pages/Home"));
const Admin = lazy(() => import("./pages/Admin"));
const TrackBooking = lazy(() => import("./pages/TrackBooking"));

function HomeRoute() {
  return <Home />;
}

function AdminRoute() {
  return <Admin />;
}

function TrackBookingRoute() {
  return <TrackBooking />;
}

function Router() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background p-8 text-center font-semibold text-secondary">Loading FixMyDoor...</div>}>
      <Switch>
        <Route path={"/"} component={HomeRoute} />
        <Route path={"/admin"} component={AdminRoute} />
        <Route path={"/track/:token"} component={TrackBookingRoute} />
        <Route path={"/404"} component={NotFound} />
        {/* Final fallback route */}
        <Route component={NotFound} />
      </Switch>
    </Suspense>
  );
}

// NOTE: About Theme
// - First choose a default theme according to your design style (dark or light bg), than change color palette in index.css
//   to keep consistent foreground/background color across components
// - If you want to make theme switchable, pass `switchable` ThemeProvider and use `useTheme` hook

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider
        defaultTheme="light"
        // switchable
      >
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
