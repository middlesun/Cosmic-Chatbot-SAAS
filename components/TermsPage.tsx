import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import MetaTags from './MetaTags';
import FloatingScrollControls from './FloatingScrollControls';

const LAST_UPDATED = 'November 25, 2026';

const TermsPage: React.FC = () => {
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, []);

  return (
    <div className="min-h-screen bg-[#FAF7F2] text-[#3D3830] font-['Plus_Jakarta_Sans',sans-serif] flex flex-col">
      <MetaTags
        title="Terms of Service | CosmicCouncil"
        description="Read the CosmicCouncil Terms of Service covering account usage, Credit Points, membership plans, and astrological guidance disclaimers."
        canonicalUrl="https://www.cosmiccouncil.pro/terms"
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
              to="/privacy"
              className="text-xs font-medium text-[#5C5449] hover:text-[#3D3830] transition-colors whitespace-nowrap"
            >
              Privacy
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
              Terms of Service
            </h1>
            <p className="text-base text-[#5C5449] leading-relaxed">
              These Terms of Service govern your access to and use of CosmicCouncil (cosmiccouncil.pro), including our birth chart tools, AI astrology consultations, specialist companions, and written research reports.
            </p>
          </header>

          <div className="rounded-3xl bg-[#FDFBF7] border border-[#3D3830]/10 p-6 sm:p-10 space-y-8 text-sm sm:text-[15px] leading-[1.8] text-[#5C5449]">
            <section className="space-y-3">
              <h2 className="font-serif text-2xl font-medium text-[#3D3830]">
                1. Acceptance of Terms
              </h2>
              <p>
                By creating an account or using CosmicCouncil, you agree to be bound by these Terms of Service and our{' '}
                <Link
                  to="/privacy"
                  className="font-medium text-[#3D3830] underline underline-offset-4 hover:text-[#8B7355]"
                >
                  Privacy Policy
                </Link>
                . You must be at least 18 years old (or the age of legal majority in your jurisdiction) to register an account or make purchases on CosmicCouncil.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="font-serif text-2xl font-medium text-[#3D3830]">
                2. Nature of Service &amp; Guidance Disclaimer
              </h2>
              <p>
                CosmicCouncil offers astrological chart calculations, multi-system Jyotish and Western interpretations, and reflective AI guidance for personal insight, timing awareness, and educational purposes only.
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li>CosmicCouncil does not provide medical, psychiatric, legal, tax, or regulated financial advice.</li>
                <li>Astrological interpretations are probabilistic and contemplative in nature; CosmicCouncil makes no guarantees regarding specific future events or outcomes.</li>
                <li>You remain solely responsible for your personal, health, relationship, career, and financial decisions.</li>
              </ul>
            </section>

            <section className="space-y-3">
              <h2 className="font-serif text-2xl font-medium text-[#3D3830]">
                3. Accounts &amp; Acceptable Use
              </h2>
              <p>
                You are responsible for maintaining the security of your login credentials and all activity under your CosmicCouncil account. You agree not to:
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Create multiple free accounts to farm welcome credits or bypass profile limits.</li>
                <li>Attempt to extract system prompts, reverse-engineer proprietary scoring engines, or scrape CosmicCouncil services using automated tools.</li>
                <li>Use CosmicCouncil to harass, harm, or violate the privacy rights of others, or submit unlawful content.</li>
              </ul>
              <p>
                CosmicCouncil reserves the right to suspend or terminate accounts that engage in abuse, fraudulent chargebacks, or violations of these Terms.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="font-serif text-2xl font-medium text-[#3D3830]">
                4. Credit Points, Membership Plans &amp; Payments
              </h2>
              <ul className="list-disc pl-6 space-y-2">
                <li>
                  <strong className="font-semibold text-[#3D3830]">Credit Points:</strong> Purchased and welcome Credit Points may be used across CosmicCouncil chat consultations and deep-research reports. Top-up Credit Points do not expire while your account remains active.
                </li>
                <li>
                  <strong className="font-semibold text-[#3D3830]">Membership Plans:</strong> Paid plans (such as Professional and Guru) expand saved birth-profile capacity and include recurring monthly Credit Points as displayed at checkout.
                </li>
                <li>
                  <strong className="font-semibold text-[#3D3830]">Checkout &amp; Billing:</strong> Payments are processed securely through Dodo Payments in supported currencies. Prices and plan inclusions may be updated prospectively.
                </li>
                <li>
                  <strong className="font-semibold text-[#3D3830]">Refunds &amp; Billing Support:</strong> Because digital credits and AI reports are fulfilled immediately upon generation, consumed credits are generally non-refundable unless required by law or due to a verified technical error. For billing assistance, contact{' '}
                  <a
                    href="mailto:support@cosmiccouncil.pro"
                    className="font-medium text-[#3D3830] underline underline-offset-4 hover:text-[#8B7355]"
                  >
                    support@cosmiccouncil.pro
                  </a>
                  .
                </li>
              </ul>
            </section>

            <section className="space-y-3">
              <h2 className="font-serif text-2xl font-medium text-[#3D3830]">
                5. Intellectual Property
              </h2>
              <p>
                All CosmicCouncil software, editorial copy, visual design, brand marks, astrological synthesis workflows, and system configurations remain the exclusive intellectual property of CosmicCouncil. You retain ownership of the personal birth details and notes you enter, and you receive a personal, non-exclusive license to view, download, and use reports generated for your own or authorized client consultations within your active plan limits.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="font-serif text-2xl font-medium text-[#3D3830]">
                6. Availability &amp; Limitation of Liability
              </h2>
              <p>
                CosmicCouncil is provided on an &ldquo;as is&rdquo; and &ldquo;as available&rdquo; basis. While we strive for high accuracy and uninterrupted uptime, we cannot warrant error-free availability at all times. To the fullest extent permitted by applicable law, CosmicCouncil shall not be liable for any indirect, incidental, consequential, or special damages arising from your use of the platform.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="font-serif text-2xl font-medium text-[#3D3830]">
                7. Updates &amp; Contact
              </h2>
              <p>
                We may revise these Terms of Service from time to time. Continued use of CosmicCouncil after updated Terms take effect constitutes acceptance of the revised Terms. Questions may be sent to{' '}
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
            <Link to="/privacy" className="hover:text-[#3D3830] transition-colors">
              Privacy
            </Link>
            <Link to="/terms" className="font-medium text-[#3D3830]">
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

export default TermsPage;
