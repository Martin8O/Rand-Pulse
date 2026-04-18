import { Outlet, Link, createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";

import appCss from "../styles.css?url";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Randomness Simulator — Live 1–1000 Distribution" },
      {
        name: "description",
        content:
          "Watch true randomness unfold: roll integers 1–1000 at any speed and see the live frequency distribution with full statistics.",
      },
      { name: "author", content: "Lovable" },
      { property: "og:title", content: "Randomness Simulator — Live 1–1000 Distribution" },
      {
        property: "og:description",
        content:
          "Watch true randomness unfold: roll integers 1–1000 at any speed and see the live frequency distribution with full statistics.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:site", content: "@Lovable" },
      { name: "twitter:title", content: "Randomness Simulator — Live 1–1000 Distribution" },
      { name: "description", content: "Probability Playground simulates randomness and statistics, visualizing number distribution with a dynamic bar graph." },
      { property: "og:description", content: "Probability Playground simulates randomness and statistics, visualizing number distribution with a dynamic bar graph." },
      { name: "twitter:description", content: "Probability Playground simulates randomness and statistics, visualizing number distribution with a dynamic bar graph." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/124b1e09-ebba-40b7-a97e-f6bfbcb64ad0/id-preview-e78f8063--48e74e9b-a949-493f-bc76-138b3e171df5.lovable.app-1776544702574.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/124b1e09-ebba-40b7-a97e-f6bfbcb64ad0/id-preview-e78f8063--48e74e9b-a949-493f-bc76-138b3e171df5.lovable.app-1776544702574.png" },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  return <Outlet />;
}
