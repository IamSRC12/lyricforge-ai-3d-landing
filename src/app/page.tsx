import AnimationGallery from "@/components/landing/AnimationGallery";
import EditorShowcase from "@/components/landing/EditorShowcase";
import Features from "@/components/landing/Features";
import ForgeDemo from "@/components/landing/ForgeDemo";
import Hero from "@/components/landing/Hero";
import Nav from "@/components/landing/Nav";
import Pipeline from "@/components/landing/Pipeline";
import { getLandingStats, type LandingStats } from "@/lib/stats";

export const dynamic = "force-dynamic";

const FALLBACK_STATS: LandingStats = {
  waitlistCount: 0,
  timelinesForged: 0,
  wordsAligned: 0,
  avgConfidence: 0,
  avgProcessingMs: 0,
};

export default async function HomePage() {
  const stats = await getLandingStats().catch(() => FALLBACK_STATS);

  return (
    <>
      <Nav />
      <main className="relative overflow-hidden">
        <Hero stats={stats} />
        <Features />
        <Pipeline />
        <ForgeDemo initialRuns={stats.timelinesForged} />
        <EditorShowcase />
        <AnimationGallery />
      </main>
    </>
  );
}
