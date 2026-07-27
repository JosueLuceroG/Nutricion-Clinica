import * as React from "react";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@components/ui/card";
import i18n from "@i18n/config";

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

const DYNAMIC_IMPORT_ERROR =
  /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module/i;

export class ErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    if (import.meta.env.DEV) {
      console.error("[ErrorBoundary]", error, info.componentStack);
    }
  }

  private handleReset = () => {
    if (
      this.state.error &&
      DYNAMIC_IMPORT_ERROR.test(this.state.error.message)
    ) {
      window.location.reload();
      return;
    }

    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div className="flex min-h-screen items-center justify-center bg-background p-4">
          <Card className="max-w-md">
            <CardHeader>
              <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10">
                <AlertTriangle
                  className="h-5 w-5 text-destructive"
                  aria-hidden
                />
              </div>
              <CardTitle>{i18n.t("common.error_title")}</CardTitle>
              <CardDescription>
                {i18n.t("common.app_error_description")}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {this.state.error && (
                <pre className="max-h-40 overflow-auto rounded-md bg-muted p-3 text-xs">
                  {this.state.error.message}
                </pre>
              )}
              <div className="flex flex-wrap gap-2">
                <Button onClick={this.handleReset} variant="outline" size="sm">
                  <RefreshCw className="mr-2 h-4 w-4" />
                  {i18n.t("common.retry")}
                </Button>
                <Button asChild size="sm">
                  <Link to="/">
                    <Home className="mr-2 h-4 w-4" />
                    {i18n.t("pages.go_home")}
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}
