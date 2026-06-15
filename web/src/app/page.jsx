import { Button } from "@/components/ui/button";
import { validate } from "@/lib/validation";
import { exampleInputSchema } from "@/lib/schemas/example";

export default function Home() {
  // Smoke test: proves the zod boundary-validation helper resolves and runs.
  const check = validate(exampleInputSchema, { name: "Sprint Tracker" });

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-8 p-24 text-center">
      <div className="flex flex-col items-center gap-3">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">
          Sprint Tracker
        </h1>
        <p className="text-sm text-muted-foreground">
          Tailwind v4 + shadcn/ui + zod scaffold —{" "}
          {check.success ? "validation OK" : check.error}
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-3">
        <Button>Primary</Button>
        <Button variant="secondary">Secondary</Button>
        <Button variant="outline">Outline</Button>
        <Button variant="ghost">Ghost</Button>
        <Button variant="destructive">Destructive</Button>
      </div>
    </main>
  );
}
