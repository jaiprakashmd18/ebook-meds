"use client";

import { useEffect } from "react";
import { Container } from "@/components/ui/misc";
import { Button } from "@/components/ui/button";

export default function SiteError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <Container className="flex flex-col items-center py-28 text-center">
      <h1 className="text-3xl font-semibold tracking-tight">Something went wrong</h1>
      <p className="mt-3 max-w-md text-muted-foreground">
        We could not load this page. This is usually temporary — please try again.
        {error.digest ? <span className="mt-2 block text-xs">Reference: {error.digest}</span> : null}
      </p>
      <Button className="mt-8" onClick={reset}>Try again</Button>
    </Container>
  );
}
