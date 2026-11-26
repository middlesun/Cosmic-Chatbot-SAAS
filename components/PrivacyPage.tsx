import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import MetaTags from './MetaTags';
import FloatingScrollControls from './FloatingScrollControls';

const LAST_UPDATED = 'November 25, 2026';

const PrivacyPage: React.FC = () => {
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, []);

  return (
    <div className="min-h-screen bg-[#FAF7F2] text-[#3D3830] font-['Plus_Jakarta_Sans',sans-serif] flex flex-col">
      <MetaTags
        title="Privacy Policy | CosmicCouncil"
        description="Learn how CosmicCouncil collects, uses, and protects your account information, birth chart profiles, and consultation history."
        canonicalUrl="https://www.cosmiccouncil.pro/privacy"
      />

      <header className="sticky top-0 z-30 border-b border-[#3D3830]/10 bg-[#EAE3D7]/75 backdrop-blur-md">
        <div className="mx-auto max-w-5xl px-5 py-3.5 flex items-center justify-between gap-4">
          <Link
            to="/"
            className="font-serif text-xl font-medium tracking-tight text-[#3D3830] whitespace-nowrap"
          >
            CosmicCouncil
          </Link>
          <div className="flex items-center gap-4">
            <Link
              to="/"
              className="text-xs font-medium text-[#5C5449] hover:text-[#3D3830] transition-colors whitespace-nowrap"
            >
              Home
            </Link>
            <Link
              to="/terms"
              className="text-xs font-medium text-[#5C5449] hover:text-[#3D3830] transition-colors whitespace-nowrap"
            >
              Terms
            </Link>
            <Link
              to="/app/login"
              className="inline-flex items-center gap-1.5 rounded-full bg-[#4A453D] px-4 py-2 text-xs font-medium text-[#FAF7F2] hover:bg-[#38342E] transition-colors whitespace-nowrap"
            >
              <span>Login</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1 mx-auto w-full max-w-4xl px-5 sm:px-6 py-12 md:py-16">
        <div className="space-y-8">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-[#5C5449] hover:text-[#3D3830] transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Back to Home</span>
          </Link>

          <header className="space-y-3 border-b border-[#3D3830]/10 pb-8">
            <p className="text-xs font-medium text-[#8B8275]">
              Legal &middot; Last updated {LAST_UPDATED}
            </p>
            <h1 className="font-serif text-3xl md:text-5xl font-medium text-[#3D3830] leading-tight">
              Privacy Policy
            </h1>
            <p className="text-base text-[#5C5449] leading-relaxed">
              CosmicCouncil respects your privacy. This Privacy Policy explains how CosmicCouncil collects, processes, stores, and protects your personal details, birth chart data, and consultation history when you use our website and application.
            </p>
          </header>

          <div className="rounded-3xl bg-[#FDFBF7] border border-[#3D3830]/10 p-6 sm:p-10 space-y-8 text-sm sm:text-[15px] leading-[1.8] text-[#5C5449]">
            <section className="space-y-3">
              <h2 className="font-serif text-2xl font-medium text-[#3D3830]">
                1. Information We Collect
              </h2>
              <p>
                We collect only the information needed to provide accurate astrological calculations, personalized consultations, and secure account access on CosmicCouncil:
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li>
                  <strong className="font-semibold text-[#3D3830]">Account Information:</strong> Your name, email address, authentication identifiers (such as Google sign-in via Gmail or email/password), preferred language, and display settings.
                </li>
                <li>
                  <strong className="font-semibold text-[#3D3830]">Birth Chart &amp; Profile Details:</strong> Birth dates, birth times, birth locations (city, coordinates, and timezone), profile labels, and optional life-context notes you choose to save for yourself or others.
                </li>
                <li>
                  <strong className="font-semibold text-[#3D3830]">Consultation &amp; Report Content:</strong> Messages, questions, specialist companion threads, saved notes, and generated astrological reports created within your CosmicCouncil workspace.
                </li>
                <li>
                  <strong className="font-semibold text-[#3D3830]">Billing &amp; Transaction Metadata:</strong> Credit balance changes, membership tier status, currency preference, and payment confirmation records. Card and payment method details are handled directly by our payment processor (Dodo Payments) and are never stored by CosmicCouncil.
                </li>
                <li>
                  <strong className="font-semibold text-[#3D3830]">Technical &amp; Security Data:</strong> Basic request metadata, hashed IP addresses for rate limiting and abuse prevention, and browser storage for session continuity.
                </li>
              </ul>
            </section>

            <section className="space-y-3">
              <h2 className="font-serif text-2xl font-medium text-[#3D3830]">
                2. How We Use Your Information
              </h2>
              <ul className="list-disc pl-6 space-y-2">
                <li>To compute Vedic and Western astrological charts, planetary transits, dashas, and timing tools.</li>
                <li>To deliver personalized chat consultations, specialist insights, and multi-pass written reports.</li>
                <li>To manage your Credit Points balance, membership plan capacity, referrals, and purchase receipts.</li>
                <li>To send essential transactional emails such as account verification, password resets, and report delivery notices.</li>
                <li>To protect CosmicCouncil against unauthorized access, automated scraping, and free-tier abuse.</li>
              </ul>
            </section>

            <section className="space-y-3">
              <h2 className="font-serif text-2xl font-medium text-[#3D3830]">
                3. AI &amp; Third-Party Service Providers
              </h2>
              <p>
                CosmicCouncil relies on trusted infrastructure partners strictly to operate the service:
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li>
                  <strong className="font-semibold text-[#3D3830]">Authentication &amp; Database Hosting:</strong> Encrypted cloud database and user authentication services store your account, charts, and threads securely.
                </li>
                <li>
                  <strong className="font-semibold text-[#3D3830]">Ephemeris &amp; AI Inference Partners:</strong> Relevant birth-chart calculations and conversation prompts are transmitted securely server-side to generate your readings and reports.
                </li>
                <li>
                  <strong className="font-semibold text-[#3D3830]">Payments &amp; Transactional Email:</strong> Payment checkouts and service emails are processed only when you initiate a purchase, referral reward, or account notification.
                </li>
              </ul>
              <p>
                CosmicCouncil does not sell, rent, or trade your personal information or birth chart records to third-party advertisers or data brokers.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="font-serif text-2xl font-medium text-[#3D3830]">
                4. Cookies, Local Storage &amp; Analytics
              </h2>
              <p>
                CosmicCouncil uses essential browser storage and session cookies to keep you signed in, remember your chosen currency or astrology tradition mode, and preserve unsent onboarding drafts. We may also use privacy-conscious web analytics to understand aggregate traffic and improve reliability.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="font-serif text-2xl font-medium text-[#3D3830]">
                5. Data Retention &amp; Your Rights
              </h2>
              <p>
                We retain your saved birth profiles, consultation threads, and generated reports for as long as your CosmicCouncil account remains active so you can revisit them anytime. You can edit or delete saved birth profiles directly inside the app, and you may request complete account and personal data deletion by contacting us at{' '}
                <a
                  href="mailto:support@cosmiccouncil.pro"
                  className="font-medium text-[#3D3830] underline underline-offset-4 hover:text-[#8B7355]"
                >
                  support@cosmiccouncil.pro
                </a>
                .
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="font-serif text-2xl font-medium text-[#3D3830]">
                6. Changes &amp; Contact
              </h2>
              <p>
                We may update this Privacy Policy periodically as CosmicCouncil evolves. Material updates will be reflected by the &ldquo;Last updated&rdquo; date above. For privacy questions or data requests, email{' '}
                <a
                  href="mailto:support@cosmiccouncil.pro"
                  className="font-medium text-[#3D3830] underline underline-offset-4 hover:text-[#8B7355]"
                >
                  support@cosmiccouncil.pro
                </a>
                .
              </p>
            </section>
          </div>
        </div>
      </main>

      <footer className="border-t border-[#3D3830]/10 bg-[#F1ECE3] py-8">
        <div className="mx-auto max-w-5xl px-5 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#5C5449]">
          <span className="font-serif text-lg font-medium text-[#3D3830]">CosmicCouncil</span>
          <div className="flex flex-wrap items-center gap-5">
            <Link to="/" className="hover:text-[#3D3830] transition-colors">
              Home
            </Link>
            <Link to="/privacy" className="font-medium text-[#3D3830]">
              Privacy
            </Link>
            <Link to="/terms" className="hover:text-[#3D3830] transition-colors">
              Terms
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

export default PrivacyPage;
