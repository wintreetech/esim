import { ButtonLink } from "@/components/ui/button";
export default function NotFound() {
  return (
    <div className="container server-error">
      <div className="eyebrow" style={{ justifyContent: "center" }}>
        A little off the map
      </div>
      <h1>This page took a detour.</h1>
      <p>Let’s get you back to somewhere good.</p>
      <ButtonLink href="/destinations">Explore destinations →</ButtonLink>
    </div>
  );
}
