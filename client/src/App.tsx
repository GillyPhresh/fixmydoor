import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { lazy, Suspense, useEffect } from "react";
import NotFound from "@/pages/NotFound";
import { Route, Switch, useLocation } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import YellowPagesWebChat from "./components/YellowPagesWebChat";

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

const GA_MEASUREMENT_ID = import.meta.env.VITE_GA_MEASUREMENT_ID;

const Home = lazy(() => import("./pages/Home"));
const Admin = lazy(() => import("./pages/Admin"));
const TrackBooking = lazy(() => import("./pages/TrackBooking"));
const ServicePage = lazy(() => import("./pages/ServicePage"));
const PrivacyPolicy = lazy(() => import("./pages/PrivacyPolicy"));
const TermsConditions = lazy(() => import("./pages/TermsConditions"));

function HomeRoute() {
  return <Home />;
}

function AdminRoute() {
  return <Admin />;
}

function TrackBookingRoute() {
  return <TrackBooking />;
}

function ServicePageRoute() {
  return <ServicePage />;
}

function PrivacyPolicyRoute() {
  return <PrivacyPolicy />;
}

function TermsConditionsRoute() {
  return <TermsConditions />;
}

function GoogleAnalytics() {
  const [location] = useLocation();

  useEffect(() => {
    if (!GA_MEASUREMENT_ID || !/^G-[A-Z0-9]+$/i.test(GA_MEASUREMENT_ID)) {
      return;
    }

    if (!document.querySelector(`script[src*="googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}"]`)) {
      const script = document.createElement("script");
      script.async = true;
      script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`;
      document.head.appendChild(script);
    }

    window.dataLayer = window.dataLayer || [];
    window.gtag = window.gtag || function gtag(...args: unknown[]) {
      window.dataLayer?.push(args);
    };
    window.gtag("js", new Date());
    window.gtag("config", GA_MEASUREMENT_ID, { send_page_view: false });
  }, []);

  useEffect(() => {
    if (!GA_MEASUREMENT_ID || !window.gtag) {
      return;
    }

    window.gtag("event", "page_view", {
      page_path: location,
      page_title: document.title,
    });
  }, [location]);

  return null;
}

function Router() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background p-8 text-center font-semibold text-secondary">Loading FixMyDoor Services...</div>}>
      <GoogleAnalytics />
      <YellowPagesWebChat />
      <Switch>
        <Route path={"/"} component={HomeRoute} />
        <Route path={"/door-repair"} component={ServicePageRoute} />
        <Route path={"/lock-rekeying"} component={ServicePageRoute} />
        <Route path={"/furniture-repair"} component={ServicePageRoute} />
        <Route path={"/furniture-installation"} component={ServicePageRoute} />
        <Route path={"/furniture-setup"} component={ServicePageRoute} />
        <Route path={"/entry-door-installation"} component={ServicePageRoute} />
        <Route path={"/door-installation"} component={ServicePageRoute} />
        <Route path={"/door-alignment"} component={ServicePageRoute} />
        <Route path={"/door-purchase"} component={ServicePageRoute} />
        <Route path={"/buy-doors"} component={ServicePageRoute} />
        <Route path={"/buy-door-hardware"} component={ServicePageRoute} />
        <Route path={"/door-hardware-purchase"} component={ServicePageRoute} />
        <Route path={"/door-equipment"} component={ServicePageRoute} />
        <Route path={"/furniture-hardware-purchase"} component={ServicePageRoute} />
        <Route path={"/buy-furniture-hardware"} component={ServicePageRoute} />
        <Route path={"/furniture-parts"} component={ServicePageRoute} />
        <Route path={"/door-hardware"} component={ServicePageRoute} />
        <Route path={"/hardware-sourcing"} component={ServicePageRoute} />
        <Route path={"/international-requests"} component={ServicePageRoute} />
        <Route path={"/privacy-policy"} component={PrivacyPolicyRoute} />
        <Route path={"/terms-and-conditions"} component={TermsConditionsRoute} />
        <Route path={"/admin"} component={AdminRoute} />
        <Route path={"/admin/notify"} component={AdminRoute} />
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
