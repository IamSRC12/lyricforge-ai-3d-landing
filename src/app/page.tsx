import AnimationGallery from "@/components/landing/AnimationGallery";
import EditorShowcase from "@/components/landing/EditorShowcase";
import FAQ from "@/components/landing/FAQ";
import Features from "@/components/landing/Features";
import Footer from "@/components/landing/Footer";
import ForgeDemo from "@/components/landing/ForgeDemo";
import Hero from "@/components/landing/Hero";
import Nav from "@/components/landing/Nav";
import Pipeline from "@/components/landing/Pipeline";
import Pricing from "@/components/landing/Pricing";
import Roadmap from "@/components/landing/Roadmap";
import Waitlist from "@/components/landing/Waitlist";
import type { FeatureVote } from "@/db/schema";
import { DEFAULT_ROADMAP, getRoadmap } from "@/lib/roadmap";
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
  const [stats, features] = await Promise.all([
    getLandingStats().catch(() => FALLBACK_STATS),
    getRoadmap().catch(
      () =>
        DEFAULT_ROADMAP.map((entry, index) => ({
          ...entry,
          id: index + 1,
          createdAt: new Date(),
        })) as FeatureVote[],
    ),
  ]);

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
        <Pricing />
        <Roadmap initialFeatures={features} />
        <Waitlist initialCount={stats.waitlistCount} />
        <FAQ />
      </main>
      <Footer />
    </>
  );
}
