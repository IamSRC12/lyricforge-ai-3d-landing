import {
  lazy,
  Suspense,
  type ComponentType,
} from "react";

import { motion } from "framer-motion";
import {
  ArrowRight,
  AudioWaveform,
  BadgeCheck,
  BrainCircuit,
  Check,
  ChevronRight,
  Clock3,
  Download,
  Film,
  Gauge,
  Layers3,
  Menu,
  Music2,
  Play,
  ShieldCheck,
  Sparkles,
  WandSparkles,
  Zap,
} from "lucide-react";

const Scene3D = lazy(() => import("./Scene3D"));

type Feature = {
  icon: ComponentType<{ size?: number; strokeWidth?: number }>;
  title: string;
  description: string;
  accent: string;
};

const features: Feature[] = [
  {
    icon: BrainCircuit,
    title: "AI-powered synchronization",
    description:
      "Align your original lyrics to word-level Whisper timestamps without replacing the words you wrote.",
    accent: "purple",
  },
  {
    icon: WandSparkles,
    title: "Motion that understands music",
    description:
      "Generate karaoke highlights and animation choices based on emotion, tempo, rhythm, and lyrical meaning.",
    accent: "blue",
  },
  {
    icon: Gauge,
    title: "Frame-accurate export",
    description:
      "Render deterministic frames through Canvas, WebCodecs, and FFmpeg instead of unreliable screen recording.",
    accent: "cyan",
  },
];

const workflow = [
  {
    number: "01",
    title: "Add lyrics and audio",
    description:
      "Paste lyrics or import supported document and audio formats.",
  },
  {
    number: "02",
    title: "Analyse and synchronize",
    description:
      "Detect language, transcribe audio, clean tags, and align every word.",
  },
  {
    number: "03",
    title: "Direct the visual style",
    description:
      "Adjust fonts, motion, backgrounds, timing, highlights, and effects.",
  },
  {
    number: "04",
    title: "Export at 60 FPS",
    description:
      "Produce a frame-accurate video with synchronized audio and visuals.",
  },
];

const faqs = [
  {
    question: "Does LyricForge replace my lyrics with an AI transcript?",
    answer:
      "No. Your supplied lyrics remain the source of truth. Whisper creates a timestamp reference, then LyricForge aligns your original words to that reference.",
  },
  {
    question: "Can I correct synchronization manually?",
    answer:
      "Yes. The editor is designed around professional correction tools including segment handles, word-boundary dragging, split and merge actions, and millisecond nudging.",
  },
  {
    question: "Are API keys stored on a remote server?",
    answer:
      "No. In the local-first architecture, API credentials are stored locally. The desktop edition can use operating-system-backed storage through Electron.",
  },
  {
    question: "Why not use MediaRecorder for export?",
    answer:
      "MediaRecorder captures playback in real time and can introduce dropped frames or synchronization drift. LyricForge renders deterministic frames with Canvas and WebCodecs before muxing audio and video.",
  },
  {
    question: "Will it work without an internet connection?",
    answer:
      "Editing and local project management can work offline. Cloud AI analysis requires a connection unless local AI models are added later.",
  },
];

function GithubIcon({ size = 17 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
      <path d="M9 18c-4.51 2-5-2-7-2" />
    </svg>
  );
}

function Logo(): React.JSX.Element {
  return (
    <a href="/" className="brand" aria-label="LyricForge AI home">
      <span className="brand-mark">
        <AudioWaveform size={20} strokeWidth={2.4} />
      </span>

      <span>
        LyricForge
        <strong>AI</strong>
      </span>
    </a>
  );
}

function PrimaryCTA({
  compact = false,
  onClick,
}: {
  compact?: boolean;
  onClick?: () => void;
}): React.JSX.Element {
  return (
    <motion.a
      href="/upload"
      onClick={(e) => {
        if (onClick) {
          e.preventDefault();
          onClick();
        }
      }}
      className={`button button-primary ${
        compact ? "button-compact" : ""
      }`}
      whileHover={{
        scale: 1.035,
        boxShadow: "0 0 38px rgba(124, 58, 237, 0.55)",
      }}
      whileTap={{ scale: 0.98 }}
    >
      Start creating
      <ArrowRight size={18} />
    </motion.a>
  );
}

function Navigation({ onGetStarted }: { onGetStarted?: () => void }): React.JSX.Element {
  return (
    <header className="site-header">
      <div className="container nav-inner">
        <Logo />

        <nav className="desktop-navigation" aria-label="Main navigation">
          <a href="#features">Features</a>
          <a href="#workflow">Workflow</a>
          <a href="#pricing">Pricing</a>
          <a href="#faq">FAQ</a>
        </nav>

        <div className="nav-actions">
          <a className="text-link desktop-only" href="#demo">
            View demo
          </a>

          <PrimaryCTA compact onClick={onGetStarted} />

          <button
            type="button"
            className="mobile-menu"
            aria-label="Open navigation"
          >
            <Menu size={21} />
          </button>
        </div>
      </div>
    </header>
  );
}

function HeroSection({ onGetStarted }: { onGetStarted?: () => void }): React.JSX.Element {
  return (
    <section className="hero">
      <Suspense
        fallback={<div className="scene-placeholder" aria-hidden="true" />}
      >
        <Scene3D />
      </Suspense>

      <div className="hero-grid" aria-hidden="true" />
      <div className="hero-vignette" aria-hidden="true" />

      <div className="container hero-content">
        <motion.div
          className="hero-copy"
          initial={{ opacity: 0, y: 28 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.75, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="announcement">
            <Sparkles size={15} />
            Local-first AI lyrical video production
            <ChevronRight size={15} />
          </div>

          <h1>
            Create lyrical videos
            <span className="gradient-text"> in minutes.</span>
          </h1>

          <p className="hero-subheadline">
            AI-powered
            <span>•</span>
            Word-perfect sync
            <span>•</span>
            60 FPS export
          </p>

          <p className="hero-description">
            Transform your lyrics and audio into expressive, professionally
            synchronized videos—then refine every word, frame, and animation.
          </p>

          <div className="hero-actions">
            <PrimaryCTA onClick={onGetStarted} />

            <motion.a
              href="#demo"
              className="button button-secondary"
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.98 }}
            >
              <span className="play-icon">
                <Play size={15} fill="currentColor" />
              </span>
              Watch preview
            </motion.a>
          </div>

          <div className="hero-trust-row">
            <span>
              <ShieldCheck size={16} />
              Local-first
            </span>

            <span>
              <BadgeCheck size={16} />
              Manual timing tools
            </span>

            <span>
              <Film size={16} />
              Frame-accurate
            </span>
          </div>
        </motion.div>
      </div>

      <a
        className="scroll-indicator"
        href="#features"
        aria-label="Scroll to features"
      >
        <span />
      </a>
    </section>
  );
}

function FeatureSection(): React.JSX.Element {
  return (
    <section id="features" className="section features-section">
      <div className="container">
        <motion.div
          className="section-heading"
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.35 }}
          transition={{ duration: 0.55 }}
        >
          <span className="eyebrow">Designed for precision</span>

          <h2>
            AI speed without giving up
            <span className="gradient-text"> creative control.</span>
          </h2>

          <p>
            Automation gets you close. A professional timeline lets you make it
            exact.
          </p>
        </motion.div>

        <div className="feature-grid">
          {features.map((feature, index) => {
            const Icon = feature.icon;

            return (
              <motion.article
                key={feature.title}
                className={`glass-card feature-card accent-${feature.accent}`}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.25 }}
                transition={{
                  duration: 0.55,
                  delay: index * 0.1,
                }}
                whileHover={{ y: -8 }}
              >
                <div className="feature-icon">
                  <Icon size={25} strokeWidth={1.8} />
                </div>

                <h3>{feature.title}</h3>
                <p>{feature.description}</p>

                <span className="card-link">
                  Explore feature
                  <ArrowRight size={15} />
                </span>
              </motion.article>
            );
          })}
        </div>

        <div className="metric-row">
          <div>
            <strong>60</strong>
            <span>FPS preview and export</span>
          </div>

          <div>
            <strong>30+</strong>
            <span>Motion presets</span>
          </div>

          <div>
            <strong>500+</strong>
            <span>Timeline segments</span>
          </div>

          <div>
            <strong>10 ms</strong>
            <span>Manual timing nudge</span>
          </div>
        </div>
      </div>
    </section>
  );
}

function EditorMockup(): React.JSX.Element {
  const segments = [
    { text: "I can see", width: "16%" },
    { text: "the colors", width: "21%" },
    { text: "inside", width: "15%" },
    { text: "your eyes", width: "23%" },
  ];

  return (
    <div className="editor-window">
      <div className="editor-topbar">
        <div className="window-controls">
          <span />
          <span />
          <span />
        </div>

        <span className="project-name">
          <Music2 size={14} />
          Midnight Echoes.lforge
        </span>

        <button type="button">
          Export
          <ArrowRight size={13} />
        </button>
      </div>

      <div className="editor-main">
        <aside className="editor-tools">
          <span className="active">
            <Layers3 size={17} />
          </span>
          <span>
            <Music2 size={17} />
          </span>
          <span>
            <Sparkles size={17} />
          </span>
        </aside>

        <div className="editor-preview">
          <div className="preview-orb orb-one" />
          <div className="preview-orb orb-two" />

          <div className="preview-lyrics">
            <small>00:42.180</small>
            <strong>
              I can see the colors
              <br />
              <span>inside your eyes</span>
            </strong>
          </div>

          <div className="safe-area" />
        </div>

        <aside className="properties-panel">
          <span className="panel-label">Typography</span>

          <div className="fake-select">
            Montserrat
            <ChevronRight size={12} />
          </div>

          <div className="property-row">
            <span>Size</span>
            <strong>84 px</strong>
          </div>

          <div className="property-row">
            <span>Weight</span>
            <strong>700</strong>
          </div>

          <div className="color-row">
            <span className="color purple" />
            <span className="color blue" />
            <span className="color cyan" />
            <span className="color white" />
          </div>

          <span className="panel-label panel-label-spaced">
            Animation
          </span>

          <div className="fake-select">
            Karaoke fill
            <ChevronRight size={12} />
          </div>
        </aside>
      </div>

      <div className="editor-timeline">
        <div className="timeline-controls">
          <button type="button" aria-label="Play">
            <Play size={13} fill="currentColor" />
          </button>

          <span>00:42.18 / 03:45.00</span>
        </div>

        <div className="timeline-content">
          <div className="waveform-row">
            {Array.from({ length: 70 }, (_, index) => (
              <span
                key={index}
                style={{
                  height: `${
                    18 +
                    Math.abs(
                      Math.sin(index * 0.52) * 22 +
                        Math.cos(index * 0.2) * 9
                    )
                  }px`,
                }}
              />
            ))}
          </div>

          <div className="segment-row">
            {segments.map((segment) => (
              <div
                key={segment.text}
                style={{ width: segment.width }}
              >
                {segment.text}
              </div>
            ))}
          </div>

          <div className="mock-playhead">
            <span />
          </div>
        </div>
      </div>
    </div>
  );
}

function DemoSection(): React.JSX.Element {
  return (
    <section id="demo" className="section demo-section">
      <div className="container">
        <motion.div
          className="demo-copy"
          initial={{ opacity: 0, x: -30 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.6 }}
        >
          <span className="eyebrow">Professional timeline</span>

          <h2>
            Every lyric.
            <br />
            Every beat.
            <br />
            <span className="gradient-text">Every frame.</span>
          </h2>

          <p>
            Review low-confidence words, drag segment boundaries, split lines,
            and nudge timestamps by milliseconds.
          </p>

          <ul className="check-list">
            <li>
              <Check size={17} />
              Word-level timing and confidence
            </li>

            <li>
              <Check size={17} />
              Multi-track visual timeline
            </li>

            <li>
              <Check size={17} />
              Non-destructive manual adjustments
            </li>

            <li>
              <Check size={17} />
              Live karaoke highlighting
            </li>
          </ul>
        </motion.div>

        <motion.div
          className="editor-mockup-wrapper"
          initial={{ opacity: 0, scale: 0.94, rotateY: -5 }}
          whileInView={{ opacity: 1, scale: 1, rotateY: 0 }}
          viewport={{ once: true, amount: 0.25 }}
          transition={{ duration: 0.8 }}
        >
          <div className="mockup-glow" />
          <EditorMockup />
        </motion.div>
      </div>
    </section>
  );
}

function WorkflowSection(): React.JSX.Element {
  return (
    <section id="workflow" className="section workflow-section">
      <div className="container">
        <div className="section-heading compact">
          <span className="eyebrow">From audio to final render</span>
          <h2>A complete workflow in four steps.</h2>
        </div>

        <div className="workflow-grid">
          {workflow.map((step, index) => (
            <motion.article
              key={step.number}
              className="workflow-item"
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ delay: index * 0.08 }}
            >
              <span className="workflow-number">{step.number}</span>
              <div className="workflow-line" />
              <h3>{step.title}</h3>
              <p>{step.description}</p>
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  );
}

function PricingSection({ onGetStarted }: { onGetStarted?: () => void }): React.JSX.Element {
  return (
    <section id="pricing" className="section pricing-section">
      <div className="container pricing-layout">
        <div className="pricing-copy">
          <span className="eyebrow">One-time ownership</span>

          <h2>
            Build once.
            <br />
            Create without a subscription.
          </h2>

          <p>
            A perpetual desktop license designed for creators, agencies, music
            studios, and commercial production teams.
          </p>

          <div className="ownership-points">
            <span>
              <ShieldCheck size={18} />
              Local-first processing
            </span>

            <span>
              <Download size={18} />
              Desktop application
            </span>

            <span>
              <Zap size={18} />
              GPU-aware export
            </span>
          </div>
        </div>

        <motion.div
          className="pricing-card"
          initial={{ opacity: 0, y: 34 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
        >
          <div className="popular-badge">Perpetual license</div>

          <span className="pricing-label">LyricForge Studio</span>

          <div className="price">
            <sup>$</sup>
            <strong>749</strong>
            <span>USD</span>
          </div>

          <p className="price-description">
            One payment. Use the application for commercial lyrical video
            production.
          </p>

          <ul>
            <li>
              <Check size={17} />
              Complete AI synchronization workflow
            </li>

            <li>
              <Check size={17} />
              Professional canvas and timeline editor
            </li>

            <li>
              <Check size={17} />
              30+ animation presets
            </li>

            <li>
              <Check size={17} />
              720p and 1080p export
            </li>

            <li>
              <Check size={17} />
              Browser and desktop architecture
            </li>

            <li>
              <Check size={17} />
              Source-code license option
            </li>
          </ul>

          <PrimaryCTA onClick={onGetStarted} />

          <small>
            AI provider usage fees are billed separately by the provider.
          </small>
        </motion.div>
      </div>
    </section>
  );
}

function FAQSection(): React.JSX.Element {
  return (
    <section id="faq" className="section faq-section">
      <div className="container faq-layout">
        <div>
          <span className="eyebrow">Questions and answers</span>
          <h2>Built transparently.</h2>
          <p>
            No impossible synchronization promises and no hidden capture-based
            export pipeline.
          </p>
        </div>

        <div className="faq-list">
          {faqs.map((faq) => (
            <details key={faq.question}>
              <summary>
                {faq.question}
                <span>+</span>
              </summary>

              <p>{faq.answer}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

function FinalCTA({ onGetStarted }: { onGetStarted?: () => void }): React.JSX.Element {
  return (
    <section className="section final-cta-section">
      <div className="container">
        <motion.div
          className="final-cta"
          initial={{ opacity: 0, scale: 0.96 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true, amount: 0.4 }}
        >
          <div className="cta-orb cta-orb-one" />
          <div className="cta-orb cta-orb-two" />

          <span className="eyebrow">
            <Sparkles size={15} />
            Your lyrics deserve motion
          </span>

          <h2>
            Turn your next song into a
            <span className="gradient-text"> visual experience.</span>
          </h2>

          <p>
            Upload your lyrics and audio, create the initial synchronization,
            then direct every detail.
          </p>

          <PrimaryCTA onClick={onGetStarted} />
        </motion.div>
      </div>
    </section>
  );
}

function Footer(): React.JSX.Element {
  return (
    <footer className="site-footer">
      <div className="container footer-inner">
        <div>
          <Logo />
          <p>
            AI-assisted lyrical video creation with professional manual
            control.
          </p>
        </div>

        <div className="footer-links">
          <a href="#features">Features</a>
          <a href="#pricing">Pricing</a>
          <a href="#faq">FAQ</a>
          <a href="/" aria-label="LyricForge GitHub repository">
            <GithubIcon size={17} />
          </a>
        </div>
      </div>

      <div className="container footer-bottom">
        <span>
          © {new Date().getFullYear()} LyricForge AI. All rights reserved.
        </span>

        <span>
          <Clock3 size={14} />
          Local-first architecture
        </span>
      </div>
    </footer>
  );
}

export function LandingPage({ onGetStarted }: { onGetStarted?: () => void }): React.JSX.Element {
  return (
    <div className="landing-page">
      <Navigation onGetStarted={onGetStarted} />

      <main>
        <HeroSection onGetStarted={onGetStarted} />
        <FeatureSection />
        <DemoSection />
        <WorkflowSection />
        <PricingSection onGetStarted={onGetStarted} />
        <FAQSection />
        <FinalCTA onGetStarted={onGetStarted} />
      </main>

      <Footer />
    </div>
  );
}

export default LandingPage;
