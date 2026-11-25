import React from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { articlesData } from './articleData';
import { slugify } from '../types';
import type { SanityArticleItem } from '../lib/sanity';
import MetaTags from './MetaTags';
import FloatingScrollControls from './FloatingScrollControls';

interface BlogPageProps {
  sanityPosts: SanityArticleItem[];
  sanityLoaded: boolean;
}

interface CombinedEssay {
  title: string;
  slug: string;
  category: string;
  readingTime: string;
  description: string;
  content: string;
  source: 'static' | 'sanity';
  publishedAt?: string;
}

const renderStaticParagraphs = (content: string) =>
  content
    .trim()
    .split('\n\n')
    .map((block, idx) => {
      const trimmed = block.trim();
      if (trimmed.startsWith('## ')) {
        return (
          <h2
            key={idx}
            className="font-serif text-2xl md:text-3xl font-medium text-[#3D3830] mt-10 mb-4 leading-tight"
          >
            {trimmed.replace('## ', '')}
          </h2>
        );
      }
      if (trimmed.startsWith('### ')) {
        return (
          <h3
            key={idx}
            className="font-serif text-xl md:text-2xl font-medium text-[#3D3830] mt-8 mb-3 leading-tight"
          >
            {trimmed.replace('### ', '')}
          </h3>
        );
      }
      const parts = trimmed.split(/(\*\*.*?\*\*)/g);
      return (
        <p key={idx} className="text-base md:text-[17px] leading-[1.8] text-[#5C5449] mb-5">
          {parts.map((part, pIdx) =>
            part.startsWith('**') && part.endsWith('**') ? (
              <strong key={pIdx} className="font-semibold text-[#3D3830]">
                {part.slice(2, -2)}
              </strong>
            ) : (
              part
            )
          )}
        </p>
      );
    });

const BlogPage: React.FC<BlogPageProps> = ({ sanityPosts, sanityLoaded }) => {
  const { slug } = useParams<{ slug?: string }>();
  const navigate = useNavigate();

  const essays: CombinedEssay[] = React.useMemo(() => {
    const seen = new Set<string>();
    const list: CombinedEssay[] = [];
    for (const art of articlesData) {
      const s = slugify(art.title);
      seen.add(s);
      list.push({
        title: art.title,
        slug: s,
        category: art.category,
        readingTime: art.readingTime,
        description: art.description,
        content: art.content,
        source: 'static',
      });
    }
    for (const p of sanityPosts) {
      if (!seen.has(p.slug)) {
        seen.add(p.slug);
        list.push({
          title: p.title,
          slug: p.slug,
          category: p.category || 'Jyotish Essay',
          readingTime: `${Math.max(2, Math.ceil((p.content || '').trim().split(/\s+/).length / 200))} min read`,
          description: p.description || '',
          content: p.content,
          source: 'sanity',
          publishedAt: p.publishedAt,
        });
      }
    }
    return list;
  }, [sanityPosts]);

  const activeEssay = slug ? essays.find((e) => e.slug === slug) : undefined;

  if (slug && !activeEssay && !sanityLoaded) {
    return (
      <div className="min-h-screen bg-[#FAF7F2] text-[#3D3830] flex items-center justify-center px-6">
        <p className="font-serif text-xl text-[#5C5449]">Loading essay...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAF7F2] text-[#3D3830] font-['Plus_Jakarta_Sans',sans-serif] flex flex-col">
      {activeEssay ? (
        <MetaTags
          title={`${activeEssay.title} | Cosmic Council Blog`}
          description={activeEssay.description}
          canonicalUrl={`https://www.cosmiccouncil.pro/blog/${activeEssay.slug}`}
          ogType="article"
        />
      ) : (
        <MetaTags
          title="Vedic Astrology Blog & Essays | Cosmic Council"
          description="Read essays, research notes, and practical Vedic astrology perspectives from Cosmic Council."
          canonicalUrl="https://www.cosmiccouncil.pro/blog"
        />
      )}

      <header className="sticky top-0 z-30 border-b border-[#3D3830]/10 bg-[#EAE3D7]/75 backdrop-blur-md">
        <div className="mx-auto max-w-5xl px-5 py-3.5 flex items-center justify-between gap-4">
          <Link
            to="/"
            className="font-serif text-xl font-medium tracking-tight text-[#3D3830] whitespace-nowrap"
          >
            Cosmic Council
          </Link>
          <div className="flex items-center gap-4">
            <Link
              to="/"
              className="text-xs font-medium text-[#5C5449] hover:text-[#3D3830] transition-colors whitespace-nowrap"
            >
              Home
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
        {slug && !activeEssay ? (
          <div className="py-16 text-center space-y-4">
            <h1 className="font-serif text-3xl font-medium text-[#3D3830]">Essay not found</h1>
            <button
              type="button"
              onClick={() => navigate('/blog')}
              className="inline-flex items-center gap-2 rounded-full border border-[#3D3830]/20 bg-[#FDFBF7] px-5 py-2.5 text-xs font-medium text-[#3D3830] hover:bg-[#F1ECE3] cursor-pointer"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>All essays</span>
            </button>
          </div>
        ) : activeEssay ? (
          <article className="space-y-8">
            <button
              type="button"
              onClick={() => navigate('/blog')}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-[#5C5449] hover:text-[#3D3830] transition-colors cursor-pointer"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>All essays</span>
            </button>

            <header className="space-y-3 border-b border-[#3D3830]/10 pb-8">
              <div className="flex items-center gap-2 text-xs text-[#8B8275]">
                <span className="font-medium text-[#5C5449]">{activeEssay.category}</span>
                <span aria-hidden="true">·</span>
                <span className="font-['DM_Sans',sans-serif] tabular-nums">
                  {activeEssay.readingTime}
                </span>
              </div>
              <h1 className="font-serif text-3xl md:text-5xl font-medium text-[#3D3830] leading-tight">
                {activeEssay.title}
              </h1>
              {activeEssay.description && (
                <p className="text-base text-[#5C5449] leading-relaxed">
                  {activeEssay.description}
                </p>
              )}
            </header>

            <div className="max-w-none">
              {activeEssay.source === 'sanity' ? (
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    h2: ({ children }) => (
                      <h2 className="font-serif text-2xl md:text-3xl font-medium text-[#3D3830] mt-10 mb-4 leading-tight">
                        {children}
                      </h2>
                    ),
                    h3: ({ children }) => (
                      <h3 className="font-serif text-xl md:text-2xl font-medium text-[#3D3830] mt-8 mb-3 leading-tight">
                        {children}
                      </h3>
                    ),
                    p: ({ children }) => (
                      <p className="text-base md:text-[17px] leading-[1.8] text-[#5C5449] mb-5">
                        {children}
                      </p>
                    ),
                    ul: ({ children }) => (
                      <ul className="list-disc pl-6 space-y-2.5 my-5 text-[#5C5449]">{children}</ul>
                    ),
                    ol: ({ children }) => (
                      <ol className="list-decimal pl-6 space-y-2.5 my-5 text-[#5C5449]">
                        {children}
                      </ol>
                    ),
                    blockquote: ({ children }) => (
                      <blockquote className="border-l-2 border-[#B8965A] pl-4 py-1 my-6 italic text-[#5C5449]">
                        {children}
                      </blockquote>
                    ),
                  }}
                >
                  {activeEssay.content}
                </ReactMarkdown>
              ) : (
                renderStaticParagraphs(activeEssay.content)
              )}
            </div>
          </article>
        ) : (
          <div className="space-y-10">
            <div className="space-y-2 border-b border-[#3D3830]/10 pb-8">
              <p className="text-xs font-medium text-[#8B8275]">Essays &amp; Research Notes</p>
              <h1 className="font-serif text-3xl md:text-5xl font-medium text-[#3D3830] tracking-tight">
                Vedic Astrology Blog &amp; Essays
              </h1>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {essays.map((art) => (
                <article
                  key={art.slug}
                  onClick={() => navigate(`/blog/${art.slug}`)}
                  className="group rounded-3xl bg-[#FDFBF7] border border-[#3D3830]/10 p-7 flex flex-col justify-between hover:border-[#3D3830]/25 hover:-translate-y-0.5 transition-all cursor-pointer"
                >
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-xs text-[#8B8275]">
                      <span className="font-medium text-[#5C5449]">{art.category}</span>
                      <span aria-hidden="true">·</span>
                      <span className="font-['DM_Sans',sans-serif] tabular-nums">
                        {art.readingTime}
                      </span>
                    </div>
                    <h2 className="font-serif text-2xl font-medium text-[#3D3830] group-hover:text-[#5C5449] transition-colors leading-snug">
                      {art.title}
                    </h2>
                    <p className="text-sm text-[#5C5449] leading-relaxed line-clamp-3">
                      {art.description}
                    </p>
                  </div>
                  <div className="pt-5">
                    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[#3D3830] underline underline-offset-4">
                      <span>Read Now</span>
                      <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                    </span>
                  </div>
                </article>
              ))}
            </div>
          </div>
        )}
      </main>

      <FloatingScrollControls />
    </div>
  );
};

export default BlogPage;
