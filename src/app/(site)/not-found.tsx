import Link from "next/link";
import { Container } from "@/components/ui/misc";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <Container className="flex flex-col items-center py-28 text-center">
      <p className="text-sm font-medium text-accent">404</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">We could not find that page</h1>
      <p className="mt-3 max-w-md text-muted-foreground">It may have moved, or it may not be published.</p>
      <div className="mt-8 flex gap-3">
        <Button asChild><Link href="/explore">Explore notes</Link></Button>
        <Button asChild variant="outline"><Link href="/">Home</Link></Button>
      </div>
    </Container>
  );
}
