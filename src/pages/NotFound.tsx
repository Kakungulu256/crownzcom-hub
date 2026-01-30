import { Button } from "@/components/ui/button";
import { Link, useLocation } from "react-router-dom";
import { AlertCircle, Home, ArrowLeft } from "lucide-react";
import { useEffect } from "react";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-[hsl(260,50%,25%)] via-[hsl(270,45%,30%)] to-[hsl(280,50%,35%)] flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center">
        {/* Animated 404 Icon */}
        <div className="relative mb-8">
          <div className="h-32 w-32 mx-auto rounded-2xl bg-white/10 backdrop-blur-sm border border-white/20 flex items-center justify-center animate-pulse">
            <AlertCircle className="h-16 w-16 text-white" />
          </div>
          <div className="absolute -inset-4 bg-primary/20 rounded-3xl blur-xl -z-10" />
        </div>

        {/* Error Code */}
        <h1 className="text-8xl font-bold text-white mb-4 font-mono tracking-tight">
          404
        </h1>

        {/* Error Message */}
        <h2 className="text-2xl font-semibold text-white mb-2">
          Page Not Found
        </h2>
        <p className="text-white/70 mb-8 max-w-sm mx-auto">
          The page you're looking for doesn't exist or has been moved to another location.
        </p>

        {/* Path Display */}
        <div className="mb-8 p-3 bg-white/10 rounded-lg backdrop-blur-sm border border-white/20">
          <p className="text-sm text-white/60">Requested path:</p>
          <p className="font-mono text-white text-sm truncate">{location.pathname}</p>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button 
            asChild 
            variant="default"
            className="bg-white text-[hsl(260,50%,25%)] hover:bg-white/90"
          >
            <Link to="/">
              <Home className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Link>
          </Button>
          <Button 
            asChild 
            variant="outline"
            className="border-white/30 text-white hover:bg-white/10"
          >
            <Link to="/" onClick={() => window.history.back()}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Go Back
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
};

export default NotFound;
