import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Menu, X } from 'lucide-react';
import FloatingScrollControls from '../FloatingScrollControls';
import { BirthChartPreviewPanel } from './BirthChartPreviewPanel';
import {
  CompanionCarousel,
  DialogueShowcase,
  EditorialImage,
  EditorialReveal,
  ParallaxFrame,
} from './EditorialPrimitives';
import {
  BIRTHCHART_CONTENT,
  CONSULTATION_CONTENT,
  GUIDANCE_CONTENT,
  HERO_CONTENT,
  SUPPORT_CONTENT,
} from './landingData';

type PillarId = (typeof HERO_CONTENT.pillars)[number]['id'];

const HomeLandingPage: React.FC = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activePillar, setActivePillar] = useState<PillarId>('birthchart');
  const [heroScrollY, setHeroScrollY] = useState(0);

  // Track subtle hero parallax safely when reduced motion is off
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;

    let rafId = 0;
    const onScroll = () => {
      if (rafId) return;
      rafId = window.requestAnimationFrame(() => {
        rafId = 0;
        const y = Math.min(window.scrollY, 700);
        setHeroScrollY(y);
      });
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (rafId) window.cancelAnimationFrame(rafId);
    };
  }, []);

  // Scroll-spy for active pillar highlight in the segmented strip
  useEffect(() => {
    if (typeof window === 'undefined' || typeof IntersectionObserver === 'undefined') return;
    const ids: PillarId[] = ['birthchart', 'consultation', 'guidance', 'support'];
    const elements = ids
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => Boolean(el));

    if (elements.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        if (visible[0]?.target?.id) {
          setActivePillar(visible[0].target.id as PillarId);
        }
      },
      { rootMargin: '-25% 0px -55% 0px', threshold: [0.05, 0.25, 0.5] }
    );

    elements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  const scrollToPillar = (id: PillarId) => {
    setActivePillar(id);
    setMobileMenuOpen(false);
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="min-h-screen bg-[#FAF7F2] text-[#3D3830] font-['Plus_Jakarta_Sans',sans-serif] selection:bg-[#EAE3D7] flex flex-col overflow-x-clip">
      {/* Three-Zone Frosted Top Bar */}
      <header className="fixed top-0 inset-x-0 z-40 w-full px-4 md:px-8 pt-3.5 sm:pt-4 animate-cc-slide-down">
        <div className="mx-auto max-w-7xl flex items-center justify-between gap-8 rounded-2xl bg-[#EAE3D7]/80 backdrop-blur-md px-5 py-3 border border-[#3D3830]/10">
          {/* Zone 1: Single-line Brand Wordmark */}
          <Link
            to="/"
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            className="font-['Cormorant_Garamond',serif] text-xl font-medium tracking-tight text-[#3D3830] whitespace-nowrap shrink-0 transition-opacity duration-200 hover:opacity-80"
          >
            Cosmic Council
          </Link>

          {/* Zone 2: Clean Single-Line Nav Links */}
          <nav className="hidden md:flex items-center gap-4 lg:gap-6">
            <Link
              to="/"
              onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
              className="text-sm font-medium text-[#3D3830] py-1 border-b border-[#3D3830]/60 transition-colors duration-200 whitespace-nowrap shrink-0"
            >
              Home
            </Link>
            <Link
              to="/home-2"
              className="text-sm font-medium text-[#5C5449] hover:text-[#3D3830] py-1 border-b border-transparent hover:border-[#3D3830]/40 transition-colors duration-200 whitespace-nowrap shrink-0"
            >
              Home #2
            </Link>
            {HERO_CONTENT.pillars.map((pillar) => (
              <button
                key={pillar.id}
                type="button"
                onClick={() => scrollToPillar(pillar.id)}
                className="text-sm font-medium text-[#5C5449] hover:text-[#3D3830] py-1 border-b border-transparent hover:border-[#3D3830]/40 transition-colors duration-200 whitespace-nowrap shrink-0 cursor-pointer"
              >
                {pillar.label}
              </button>
            ))}
          </nav>

          {/* Zone 3: Single Primary Action + Mobile Drawer Toggle */}
          <div className="flex items-center gap-3 shrink-0">
            <Link
              to="/app/login"
              className="group inline-flex items-center gap-2 rounded-full bg-[#4A453D] px-5 py-2.5 text-xs font-medium text-[#FAF7F2] transition-all duration-200 hover:bg-[#38342E] active:scale-[0.97] whitespace-nowrap shrink-0"
            >
              <span>Login</span>
              <ArrowRight className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-0.5" />
            </Link>

            <button
              type="button"
              aria-label="Open navigation menu"
              onClick={() => setMobileMenuOpen((prev) => !prev)}
              className="md:hidden inline-flex h-10 w-10 items-center justify-center rounded-full border border-[#3D3830]/15 bg-[#FDFBF7] text-[#3D3830] hover:bg-[#F1ECE3] active:scale-95 transition-all duration-200 cursor-pointer"
            >
              {mobileMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {/* Mobile Dropdown Drawer */}
        {mobileMenuOpen && (
          <div className="md:hidden mx-auto max-w-7xl mt-2 rounded-2xl bg-[#FDFBF7] border border-[#3D3830]/10 p-5 shadow-lg space-y-4 animate-cc-drawer-in">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <Link
                to="/"
                onClick={() => {
                  setMobileMenuOpen(false);
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className="text-left font-medium text-[#3D3830] py-2"
              >
                Home
              </Link>
              <Link
                to="/home-2"
                onClick={() => setMobileMenuOpen(false)}
                className="text-left font-medium text-[#5C5449] hover:text-[#3D3830] py-2"
              >
                Home #2
              </Link>
              {HERO_CONTENT.pillars.map((pillar) => (
                <button
                  key={pillar.id}
                  type="button"
                  onClick={() => scrollToPillar(pillar.id)}
                  className="text-left font-medium text-[#5C5449] hover:text-[#3D3830] py-2 cursor-pointer"
                >
                  {pillar.label}
                </button>
              ))}
            </div>
            <div className="pt-3 border-t border-[#3D3830]/10 flex items-center gap-3">
              <Link
                to="/app/login"
                onClick={() => setMobileMenuOpen(false)}
                className="flex-1 text-center rounded-full bg-[#4A453D] px-4 py-2.5 text-xs font-medium text-[#FAF7F2] active:scale-[0.98] transition-transform"
              >
                Login with Gmail
              </Link>
            </div>
          </div>
        )}
      </header>

      <main className="flex-1">
        {/* HERO SECTION — Expansive Scenic Orange Dawn Lake + Editorial Typography (No Hero CTA) */}
        <section className="relative min-h-[82svh] sm:min-h-[88svh] flex flex-col justify-between overflow-hidden bg-[#F2DEC5]">
          {/* Scenic Backdrop with Gentle Scroll Parallax */}
          <div
            aria-hidden="true"
            className="absolute inset-0 will-change-transform motion-reduce:transform-none"
            style={{
              transform: `translate3d(0, ${(heroScrollY * 0.14).toFixed(1)}px, 0) scale(${(
                1.03 +
                heroScrollY * 0.00008
              ).toFixed(4)})`,
            }}
          >
            <img
              src={HERO_CONTENT.imageUrl}
              alt={HERO_CONTENT.imageAlt}
              loading="eager"
              referrerPolicy="no-referrer"
              className="h-full w-full object-cover object-center"
            />
          </div>

          {/* Measured Luminous Top Scrim for WCAG AA Contrast while keeping lake reflection serene */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[#FAF3E8]/92 via-[#F7E7D2]/62 to-[#F4EFE6]/15 sm:via-[#F7E7D2]/48"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-[#F4EFE6] via-[#F4EFE6]/55 to-transparent"
          />

          {/* Hero Copy Block — Upper Editorial Composition */}
          <div className="relative z-10 mx-auto w-full max-w-6xl px-5 sm:px-8 pt-28 sm:pt-36 md:pt-40 pb-20 sm:pb-28">
            <div className="max-w-3xl space-y-5 sm:space-y-6 animate-cc-slide-up">
              <h1
                className="font-['Cormorant_Garamond',serif] text-[clamp(2.5rem,6vw,4.75rem)] font-medium leading-[1.04] tracking-[-0.015em] text-[#2E2720]"
                style={{ textWrap: 'balance' }}
              >
                <span className="block">{HERO_CONTENT.headlineLine1}</span>
                <span className="block">{HERO_CONTENT.headlineLine2}</span>
              </h1>

              <p className="max-w-[60ch] text-[15px] sm:text-lg leading-[1.68] text-[#3F372E]">
                {HERO_CONTENT.body}
              </p>
            </div>
          </div>

          {/* Bottom spacer letting the lone tree & water reflection breathe cleanly */}
          <div className="relative z-10 h-20 sm:h-28" aria-hidden="true" />
        </section>

        {/* PILLAR TOGGLE STRIP — [ Birth Chart | Consultation | Guidance | Support ] */}
        <div className="relative z-20 bg-[#F4EFE6]">
          <div className="mx-auto max-w-4xl px-4 sm:px-6 -mt-8 sm:-mt-9 pb-4">
            <nav
              aria-label="Cosmic Council core pillars"
              className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 rounded-2xl bg-[#FDFBF7]/92 backdrop-blur-md p-1.5 border border-[#3D3830]/12 shadow-[0_14px_34px_-18px_rgba(61,56,48,0.22)]"
            >
              {HERO_CONTENT.pillars.map((pillar) => {
                const isActive = activePillar === pillar.id;
                return (
                  <button
                    key={pillar.id}
                    type="button"
                    onClick={() => scrollToPillar(pillar.id)}
                    className={`min-h-[42px] rounded-xl px-3 py-2 text-xs sm:text-sm font-medium transition-all duration-200 whitespace-nowrap truncate cursor-pointer ${
                      isActive
                        ? 'bg-[#3D3830] text-[#FAF7F2] shadow-sm'
                        : 'text-[#5C5449] hover:text-[#3D3830] hover:bg-[#EAE3D7]/60'
                    }`}
                  >
                    {pillar.label}
                  </button>
                );
              })}
            </nav>
          </div>
        </div>

        {/* PILLAR 01 — DEEP BIRTH CHART ANALYSIS (Warm Champagne Parchment) */}
        <section
          id="birthchart"
          className="scroll-mt-24 bg-gradient-to-b from-[#F4EFE6] via-[#F4EFE6] to-[#F8F4EC] pt-14 sm:pt-20 pb-20 sm:pb-28"
        >
          <div className="mx-auto max-w-6xl px-5 sm:px-8 space-y-16 sm:space-y-24">
            {/* Editorial Opener */}
            <EditorialReveal>
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-12 items-end">
                <div className="lg:col-span-7 space-y-3">
                  <p className="text-xs sm:text-sm font-medium text-[#7D6C58]">
                    {BIRTHCHART_CONTENT.indexLabel}
                  </p>
                  <h2
                    className="font-['Cormorant_Garamond',serif] text-[clamp(2rem,4.2vw,3.35rem)] font-medium leading-[1.08] tracking-tight text-[#3D3830]"
                    style={{ textWrap: 'balance' }}
                  >
                    {BIRTHCHART_CONTENT.headline}
                  </h2>
                </div>
                <p className="lg:col-span-5 text-base sm:text-lg leading-[1.65] text-[#5C5449]">
                  {BIRTHCHART_CONTENT.lead}
                </p>
              </div>
            </EditorialReveal>

            {/* Luminous Parchment Birth Chart + Interactive Multi-Layer Indicators */}
            <EditorialReveal delay={80}>
              <div className="space-y-7">
                <BirthChartPreviewPanel />
                <p className="max-w-3xl text-base sm:text-lg leading-[1.7] text-[#4C443B]">
                  {BIRTHCHART_CONTENT.closingLead}
                </p>
              </div>
            </EditorialReveal>

            {/* Depth of Analysis — Asymmetric Editorial Specification */}
            <EditorialReveal>
              <div className="pt-8 border-t border-[#3D3830]/12 grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-start">
                <div className="lg:col-span-5 space-y-4 lg:sticky lg:top-28">
                  <h3
                    className="font-['Cormorant_Garamond',serif] text-[clamp(1.75rem,3vw,2.5rem)] font-medium leading-[1.12] text-[#3D3830]"
                    style={{ textWrap: 'balance' }}
                  >
                    {BIRTHCHART_CONTENT.depthHeading}
                  </h3>
                  <p className="text-sm sm:text-base leading-[1.7] text-[#5C5449]">
                    {BIRTHCHART_CONTENT.depthIntro}
                  </p>
                </div>

                <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-x-10 gap-y-8">
                  {BIRTHCHART_CONTENT.features.map((item, idx) => (
                    <div
                      key={item.title}
                      className="pt-4 border-t border-[#3D3830]/12 space-y-2"
                    >
                      <p className="font-['JetBrains_Mono',monospace] tabular-nums text-[11px] text-[#8B7355]">
                        0{idx + 1}
                      </p>
                      <h4 className="text-base font-semibold text-[#3D3830] leading-snug">
                        {item.title}
                      </h4>
                      <p className="text-sm leading-relaxed text-[#5C5449]">
                        {item.description}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </EditorialReveal>
          </div>
        </section>

        {/* PILLAR 02 — ONE-ON-ONE CONSULTATIONS (Luminous Warm Ivory) */}
        <section
          id="consultation"
          className="scroll-mt-24 bg-gradient-to-b from-[#F8F4EC] via-[#FAF7F2] to-[#F7F3EB] pt-16 sm:pt-24 pb-20 sm:pb-28 border-t border-[#3D3830]/8"
        >
          <div className="mx-auto max-w-6xl px-5 sm:px-8 space-y-16 sm:space-y-24">
            {/* Editorial Opener + Triptych */}
            <div className="space-y-10 sm:space-y-12">
              <EditorialReveal>
                <div className="max-w-3xl space-y-4">
                  <p className="text-xs sm:text-sm font-medium text-[#7D6C58]">
                    {CONSULTATION_CONTENT.indexLabel}
                  </p>
                  <h2
                    className="font-['Cormorant_Garamond',serif] text-[clamp(2rem,4.2vw,3.35rem)] font-medium leading-[1.08] tracking-tight text-[#3D3830]"
                    style={{ textWrap: 'balance' }}
                  >
                    {CONSULTATION_CONTENT.headline}
                  </h2>
                  <p className="text-base sm:text-lg leading-[1.65] text-[#5C5449]">
                    {CONSULTATION_CONTENT.lead}
                  </p>
                </div>
              </EditorialReveal>

              {/* Staggered 3-Portrait Editorial Gallery */}
              <EditorialReveal delay={80}>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-5 items-start">
                  {CONSULTATION_CONTENT.triptych.map((portrait, idx) => (
                    <figure
                      key={portrait.alt}
                      className={`space-y-2.5 ${
                        idx === 1 ? 'sm:mt-6' : idx === 2 ? 'sm:mt-3' : ''
                      }`}
                    >
                      <ParallaxFrame
                        strength={idx === 1 ? 14 : 9}
                        className="aspect-[3/4] rounded-2xl sm:rounded-3xl border border-[#3D3830]/10"
                      >
                        <EditorialImage
                          src={portrait.src}
                          alt={portrait.alt}
                          className="h-full w-full"
                          imgClassName="object-top"
                        />
                      </ParallaxFrame>
                      <figcaption className="text-xs text-[#7D6C58] px-1">
                        {portrait.caption}
                      </figcaption>
                    </figure>
                  ))}
                </div>
              </EditorialReveal>

              <EditorialReveal>
                <p className="max-w-3xl text-base sm:text-lg leading-[1.7] text-[#4C443B]">
                  {CONSULTATION_CONTENT.bridgeCopy}
                </p>
              </EditorialReveal>
            </div>

            {/* Realistic Animated Consultation Dialogue (Dev) */}
            <EditorialReveal>
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
                <div className="lg:col-span-5 space-y-4 lg:pt-4">
                  <h3
                    className="font-['Cormorant_Garamond',serif] text-[clamp(1.75rem,3.2vw,2.6rem)] font-medium leading-[1.12] text-[#3D3830]"
                    style={{ textWrap: 'balance' }}
                  >
                    {CONSULTATION_CONTENT.dialogueHeading}
                  </h3>
                  <p className="text-sm sm:text-base leading-[1.7] text-[#5C5449]">
                    {CONSULTATION_CONTENT.bridgeCopy}
                  </p>
                </div>

                <div className="lg:col-span-7">
                  <DialogueShowcase
                    companion={CONSULTATION_CONTENT.dialogueCompanion}
                    lines={CONSULTATION_CONTENT.dialogueLines}
                    footnote={CONSULTATION_CONTENT.dialogueFootnote}
                    surfaceClassName="bg-[#FDFBF7]"
                    userBubbleClassName="bg-[#EBE4D8] text-[#3D3830]"
                    companionBubbleClassName="bg-[#F6F2EA] text-[#3D3830] border border-[#3D3830]/10"
                  />
                </div>
              </div>
            </EditorialReveal>

            {/* 8 Consultation Qualities */}
            <EditorialReveal>
              <div className="pt-8 border-t border-[#3D3830]/12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-8 gap-y-9">
                {CONSULTATION_CONTENT.features.map((item) => (
                  <div key={item.title} className="space-y-2">
                    <h4 className="text-base font-semibold text-[#3D3830] leading-snug">
                      {item.title}
                    </h4>
                    <p className="text-sm leading-relaxed text-[#5C5449]">
                      {item.description}
                    </p>
                  </div>
                ))}
              </div>
            </EditorialReveal>

            {/* Horizontal Companion Carousel — Spiritual Guides */}
            <EditorialReveal>
              <div className="pt-4">
                <CompanionCarousel
                  title={CONSULTATION_CONTENT.carouselTitle}
                  items={CONSULTATION_CONTENT.carouselItems}
                />
              </div>
            </EditorialReveal>
          </div>
        </section>

        {/* PILLAR 03 — FINDING REAL SOLUTIONS (Soft Sage Mist) */}
        <section
          id="guidance"
          className="scroll-mt-24 bg-gradient-to-b from-[#F2F3EE] via-[#EFF2EC] to-[#EEF1EB] pt-16 sm:pt-24 pb-20 sm:pb-28 border-t border-[#3D3830]/8"
        >
          <div className="mx-auto max-w-6xl px-5 sm:px-8 space-y-16 sm:space-y-24">
            {/* Opener + Expansive Sunlit Studio Photo */}
            <div className="space-y-10 sm:space-y-12">
              <EditorialReveal>
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-12 items-end">
                  <div className="lg:col-span-6 space-y-3">
                    <p className="text-xs sm:text-sm font-medium text-[#5A6655]">
                      {GUIDANCE_CONTENT.indexLabel}
                    </p>
                    <h2
                      className="font-['Cormorant_Garamond',serif] text-[clamp(2rem,4.2vw,3.35rem)] font-medium leading-[1.08] tracking-tight text-[#343A32]"
                      style={{ textWrap: 'balance' }}
                    >
                      {GUIDANCE_CONTENT.headline}
                    </h2>
                  </div>
                  <div className="lg:col-span-6 space-y-3">
                    <p className="text-base sm:text-lg leading-[1.65] text-[#4E574B]">
                      {GUIDANCE_CONTENT.lead1}
                    </p>
                    <p className="text-base sm:text-lg font-medium leading-[1.6] text-[#343A32]">
                      {GUIDANCE_CONTENT.lead2}
                    </p>
                  </div>
                </div>
              </EditorialReveal>

              <EditorialReveal delay={80}>
                <ParallaxFrame
                  strength={16}
                  className="aspect-[16/10] sm:aspect-[16/9] rounded-3xl border border-[#343A32]/12"
                >
                  <EditorialImage
                    src={GUIDANCE_CONTENT.studioImageUrl}
                    alt={GUIDANCE_CONTENT.studioImageAlt}
                    className="h-full w-full"
                    warmGrade={false}
                  />
                </ParallaxFrame>
              </EditorialReveal>
            </div>

            {/* Reversed Dialogue Split (Ethan — Candid Friend) */}
            <EditorialReveal>
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
                <div className="lg:col-span-5 lg:order-2 space-y-4 lg:pt-4">
                  <h3
                    className="font-['Cormorant_Garamond',serif] text-[clamp(1.75rem,3.2vw,2.6rem)] font-medium leading-[1.12] text-[#343A32]"
                    style={{ textWrap: 'balance' }}
                  >
                    <span className="block">{GUIDANCE_CONTENT.dialogueHeadingLine1}</span>
                    <span className="block">{GUIDANCE_CONTENT.dialogueHeadingLine2}</span>
                  </h3>
                  <p className="text-sm sm:text-base leading-[1.7] text-[#4E574B]">
                    {GUIDANCE_CONTENT.dialogueIntro}
                  </p>
                </div>

                <div className="lg:col-span-7 lg:order-1">
                  <DialogueShowcase
                    companion={GUIDANCE_CONTENT.dialogueCompanion}
                    lines={GUIDANCE_CONTENT.dialogueLines}
                    footnote={GUIDANCE_CONTENT.dialogueFootnote}
                    surfaceClassName="bg-[#FAFBF8]"
                    userBubbleClassName="bg-[#E1E6DC] text-[#343A32]"
                    companionBubbleClassName="bg-[#F2F5EF] text-[#343A32] border border-[#343A32]/10"
                  />
                </div>
              </div>
            </EditorialReveal>

            {/* 4 Life Areas Editorial Photography Grid */}
            <div className="space-y-8">
              <EditorialReveal>
                <h3
                  className="font-['Cormorant_Garamond',serif] text-[clamp(1.75rem,3.2vw,2.6rem)] font-medium leading-[1.12] text-[#343A32]"
                  style={{ textWrap: 'balance' }}
                >
                  {GUIDANCE_CONTENT.lifeAreasTitle}
                </h3>
              </EditorialReveal>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 sm:gap-8">
                {GUIDANCE_CONTENT.lifeAreas.map((area, idx) => (
                  <EditorialReveal key={area.title} delay={idx * 60}>
                    <article className="space-y-3.5 group">
                      <div className="aspect-[4/3] w-full rounded-2xl sm:rounded-3xl overflow-hidden border border-[#343A32]/10">
                        <EditorialImage
                          src={area.imageUrl}
                          alt={area.alt}
                          className="h-full w-full"
                          imgClassName="transition-transform duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-[1.03]"
                        />
                      </div>
                      <div className="space-y-1 px-0.5">
                        <h4 className="text-base sm:text-lg font-semibold text-[#343A32]">
                          {area.title}
                        </h4>
                        <p className="text-sm leading-relaxed text-[#4E574B]">
                          {area.description}
                        </p>
                      </div>
                    </article>
                  </EditorialReveal>
                ))}
              </div>
            </div>

            {/* 6 Real-Solutions Pillars */}
            <EditorialReveal>
              <div className="pt-8 border-t border-[#343A32]/12 space-y-10">
                <h3
                  className="font-['Cormorant_Garamond',serif] text-[clamp(1.75rem,3vw,2.5rem)] font-medium leading-[1.12] text-[#343A32]"
                  style={{ textWrap: 'balance' }}
                >
                  {GUIDANCE_CONTENT.featuresTitle}
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-10 gap-y-8">
                  {GUIDANCE_CONTENT.features.map((item) => (
                    <div
                      key={item.title}
                      className="pt-4 border-t border-[#343A32]/10 space-y-2"
                    >
                      <h4 className="text-base font-semibold text-[#343A32] leading-snug">
                        {item.title}
                      </h4>
                      <p className="text-sm leading-relaxed text-[#4E574B]">
                        {item.description}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </EditorialReveal>

            {/* Horizontal Carousel — Your Own Circle of Guidance */}
            <EditorialReveal>
              <CompanionCarousel
                title={GUIDANCE_CONTENT.carouselTitle}
                items={GUIDANCE_CONTENT.carouselItems}
                caption={GUIDANCE_CONTENT.carouselCaption}
              />
            </EditorialReveal>
          </div>
        </section>

        {/* PILLAR 04 — EMOTIONAL SUPPORT (Earthy Peach Linen) */}
        <section
          id="support"
          className="scroll-mt-24 bg-gradient-to-b from-[#F5ECE4] via-[#F6ECE4] to-[#F3E7DD] pt-16 sm:pt-24 pb-24 sm:pb-32 border-t border-[#3D3830]/8"
        >
          <div className="mx-auto max-w-6xl px-5 sm:px-8 space-y-16 sm:space-y-24">
            {/* Opener + Warm Sunlit Window Photo */}
            <div className="space-y-10 sm:space-y-12">
              <EditorialReveal>
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-12 items-end">
                  <div className="lg:col-span-6 space-y-3">
                    <p className="text-xs sm:text-sm font-medium text-[#7D6154]">
                      {SUPPORT_CONTENT.indexLabel}
                    </p>
                    <h2
                      className="font-['Cormorant_Garamond',serif] text-[clamp(2rem,4.2vw,3.35rem)] font-medium leading-[1.08] tracking-tight text-[#3D342E]"
                      style={{ textWrap: 'balance' }}
                    >
                      <span className="block">{SUPPORT_CONTENT.headlineLine1}</span>
                      <span className="block">{SUPPORT_CONTENT.headlineLine2}</span>
                    </h2>
                  </div>
                  <div className="lg:col-span-6 space-y-3">
                    <p className="text-base sm:text-lg leading-[1.65] text-[#66544B]">
                      {SUPPORT_CONTENT.lead1}
                    </p>
                    <p className="text-sm sm:text-base leading-[1.7] text-[#4D4039]">
                      {SUPPORT_CONTENT.lead2}
                    </p>
                  </div>
                </div>
              </EditorialReveal>

              <EditorialReveal delay={80}>
                <ParallaxFrame
                  strength={16}
                  className="aspect-[16/10] sm:aspect-[16/9] rounded-3xl border border-[#3D342E]/12"
                >
                  <EditorialImage
                    src={SUPPORT_CONTENT.windowImageUrl}
                    alt={SUPPORT_CONTENT.windowImageAlt}
                    className="h-full w-full"
                    warmGrade={false}
                  />
                </ParallaxFrame>
              </EditorialReveal>
            </div>

            {/* Dialogue 1 — Mira (Listener) */}
            <EditorialReveal>
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
                <div className="lg:col-span-5 space-y-4 lg:pt-4">
                  <h3
                    className="font-['Cormorant_Garamond',serif] text-[clamp(1.75rem,3.2vw,2.6rem)] font-medium leading-[1.12] text-[#3D342E]"
                    style={{ textWrap: 'balance' }}
                  >
                    {SUPPORT_CONTENT.dialogue1Heading}
                  </h3>
                  <p className="text-sm sm:text-base leading-[1.7] text-[#5C4C44]">
                    {SUPPORT_CONTENT.dialogue1Intro}
                  </p>
                </div>

                <div className="lg:col-span-7">
                  <DialogueShowcase
                    companion={SUPPORT_CONTENT.dialogue1Companion}
                    lines={SUPPORT_CONTENT.dialogue1Lines}
                    footnote={SUPPORT_CONTENT.dialogueFootnote}
                    surfaceClassName="bg-[#FDF9F6]"
                    userBubbleClassName="bg-[#ECE0D6] text-[#3D342E]"
                    companionBubbleClassName="bg-[#F9F2EC] text-[#3D342E] border border-[#3D342E]/10"
                  />
                </div>
              </div>
            </EditorialReveal>

            {/* 6 Emotional Support Qualities */}
            <EditorialReveal>
              <div className="pt-8 border-t border-[#3D342E]/12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-10 gap-y-8">
                {SUPPORT_CONTENT.features.map((item) => (
                  <div
                    key={item.title}
                    className="pt-4 border-t border-[#3D342E]/10 space-y-2"
                  >
                    <h4 className="text-base font-semibold text-[#3D342E] leading-snug">
                      {item.title}
                    </h4>
                    <p className="text-sm leading-relaxed text-[#5C4C44]">
                      {item.description}
                    </p>
                  </div>
                ))}
              </div>
            </EditorialReveal>

            {/* Dialogue 2 — Aira (Mood Lifter) */}
            <EditorialReveal>
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
                <div className="lg:col-span-5 lg:order-2 space-y-3">
                  <h3
                    className="font-['Cormorant_Garamond',serif] text-[clamp(1.75rem,3.2vw,2.6rem)] font-medium leading-[1.12] text-[#3D342E]"
                    style={{ textWrap: 'balance' }}
                  >
                    {SUPPORT_CONTENT.dialogue2Heading}
                  </h3>
                </div>

                <div className="lg:col-span-7 lg:order-1">
                  <DialogueShowcase
                    companion={SUPPORT_CONTENT.dialogue2Companion}
                    lines={SUPPORT_CONTENT.dialogue2Lines}
                    footnote={SUPPORT_CONTENT.dialogueFootnote}
                    surfaceClassName="bg-[#FDF9F6]"
                    userBubbleClassName="bg-[#ECE0D6] text-[#3D342E]"
                    companionBubbleClassName="bg-[#F9F2EC] text-[#3D342E] border border-[#3D342E]/10"
                  />
                </div>
              </div>
            </EditorialReveal>

            {/* Horizontal Carousel — Different Personalities */}
            <EditorialReveal>
              <CompanionCarousel
                title={SUPPORT_CONTENT.carouselTitle}
                items={SUPPORT_CONTENT.carouselItems}
              />
            </EditorialReveal>
          </div>
        </section>
      </main>

      {/* QUIET FOOTER (Lower CTA / Pricing / FAQ deliberately omitted per scope) */}
      <footer className="border-t border-[#3D3830]/10 bg-[#EFE7DD] py-9">
        <div className="mx-auto max-w-7xl px-5 sm:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#5C5449]">
          <div className="flex flex-wrap items-center gap-3">
            <span className="font-['Cormorant_Garamond',serif] text-lg font-medium text-[#3D3830]">
              Cosmic Council
            </span>
            <span aria-hidden="true">·</span>
            <span>Clarity, counsel &amp; emotional companionship</span>
          </div>

          <div className="flex flex-wrap items-center gap-5">
            <Link to="/home-2" className="hover:text-[#3D3830] transition-colors">
              Home #2
            </Link>
            <Link to="/blog" className="hover:text-[#3D3830] transition-colors">
              Journal
            </Link>
            <Link to="/app/login" className="hover:text-[#3D3830] transition-colors">
              Login
            </Link>
          </div>
        </div>
      </footer>

      <FloatingScrollControls />
    </div>
  );
};

export default HomeLandingPage;
