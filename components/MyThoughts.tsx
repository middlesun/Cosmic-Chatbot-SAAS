import React, { useRef, useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { articlesData } from './articleData';
import { slugify } from '../types';
import type { SanityArticleItem } from '../lib/sanity';

interface MyThoughtsProps {
  onBookReading?: () => void;
  activeIdx?: number | null;
  setActiveIdx?: (idx: number | null) => void;
  sanityPosts?: SanityArticleItem[];
}

interface MergedArticle {
  slug: string;
  title: string;
  description: string;
  category: string;
  readingTime: string;
  content: string;
  source: 'static' | 'sanity';
}

function estimateReadingTime(text: string): string {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  const mins = Math.max(2, Math.round(words / 200));
  return `${mins} min read`;
}

const MyThoughts: React.FC<MyThoughtsProps> = ({
  onBookReading,
  activeIdx: propActiveIdx,
  setActiveIdx,
  sanityPosts: externalSanityPosts,
}) => {
  const { slug } = useParams<{ slug?: string }>();
  const navigate = useNavigate();
  const thoughtsRef = useRef<HTMLDivElement>(null);
  const [fetchedSanityPosts, setFetchedSanityPosts] = useState<SanityArticleItem[]>([]);

  useEffect(() => {
    if (externalSanityPosts) return;
    let cancelled = false;
    fetch('/api/blog/posts')
      .then((res) => (res.ok ? res.json() : { posts: [] }))
      .then((json: { posts?: SanityArticleItem[] }) => {
        if (!cancelled && Array.isArray(json.posts)) {
          setFetchedSanityPosts(json.posts);
        }
      })
      .catch(() => {
        // Silently retain static articles if Sanity is unavailable
      });
    return () => {
      cancelled = true;
    };
  }, [externalSanityPosts]);

  const combinedArticles: MergedArticle[] = useMemo(() => {
    const staticItems: MergedArticle[] = articlesData.map((art) => ({
      slug: slugify(art.title),
      title: art.title,
      description: art.description,
      category: art.category,
      readingTime: art.readingTime,
      content: art.content,
      source: 'static',
    }));

    const sanitySource = externalSanityPosts || fetchedSanityPosts;
    const seenSlugs = new Set(staticItems.map((item) => item.slug));
    const sanityItems: MergedArticle[] = sanitySource
      .filter((post) => post.slug && post.title && !seenSlugs.has(post.slug))
      .map((post) => ({
        slug: post.slug,
        title: post.title,
        description: post.description,
        category: post.category || 'Jyotish Essay',
        readingTime: estimateReadingTime(post.content || post.description || ''),
        content: post.content || post.description,
        source: 'sanity',
      }));

    return [...sanityItems, ...staticItems];
  }, [externalSanityPosts, fetchedSanityPosts]);

  // Compute active index based on route slug or props
  let activeIdx: number | null = null;
  if (slug) {
    const foundIdx = combinedArticles.findIndex((art) => art.slug === slug);
    activeIdx = foundIdx !== -1 ? foundIdx : null;
  } else if (propActiveIdx !== undefined && propActiveIdx !== null) {
    activeIdx = propActiveIdx;
  }

  // Scroll to the article container top when opening or switching articles
  useEffect(() => {
    if (activeIdx !== null && thoughtsRef.current) {
      const offsetTop = thoughtsRef.current.getBoundingClientRect().top + window.scrollY - 80;
      window.scrollTo({ top: offsetTop, behavior: 'smooth' });
    }
  }, [activeIdx]);

  const handleBack = () => {
    if (setActiveIdx) {
      setActiveIdx(null);
    } else {
      navigate('/blog');
    }
  };

  const handleArticleClick = (idx: number) => {
    if (setActiveIdx) {
      setActiveIdx(idx);
    } else {
      const art = combinedArticles[idx];
      navigate(`/blog/${art.slug}`);
    }
  };

  const renderArticleContent = (text: string) => {
    const renderWithBold = (str: string) => {
      const parts = str.split('**');
      return parts.map((part, i) => {
        if (i % 2 === 1) {
          return <strong key={i} className="font-bold text-slate-900">{part}</strong>;
        }
        return part;
      });
    };

    const paragraphs = text.split('\n\n');
    return paragraphs.map((para, index) => {
      const trimmed = para.trim();
      if (!trimmed) return null;

      // Check horizontal lines or dividers
      if (trimmed.startsWith('════') || trimmed.startsWith('---') || trimmed.startsWith('-----') || trimmed.startsWith('-------------------')) {
        return <hr key={index} className="my-10 border-t-2 border-[#7c6d5e]/15 border-dashed" />;
      }

      // Check blockquotes
      if (trimmed.startsWith('> ')) {
        return (
          <blockquote key={index} className="border-l-4 border-[#7c6d5e]/30 pl-4 py-1 my-6 italic text-slate-600 bg-slate-50/50 rounded-r-md leading-relaxed text-base md:text-lg">
            {renderWithBold(trimmed.substring(2).trim())}
          </blockquote>
        );
      }

      // Check headings
      if (trimmed.startsWith('# ')) {
        return (
          <h1 key={index} className="font-serif text-2xl md:text-3xl font-semibold text-indigo-950 mt-8 mb-4 leading-tight tracking-tight">
            {renderWithBold(trimmed.substring(2))}
          </h1>
        );
      }
      if (trimmed.startsWith('## ')) {
        return (
          <h2 key={index} className="font-serif text-xl md:text-2xl font-semibold text-indigo-950 mt-7 mb-3 leading-tight tracking-tight">
            {renderWithBold(trimmed.substring(3))}
          </h2>
        );
      }
      if (trimmed.startsWith('### ')) {
        return (
          <h3 key={index} className="font-serif text-base md:text-lg font-normal text-slate-900 mt-6 mb-3 leading-relaxed">
            {renderWithBold(trimmed.substring(4))}
          </h3>
        );
      }
      if (trimmed.startsWith('#### ')) {
        return (
          <h4 key={index} className="font-serif text-base md:text-lg font-normal text-indigo-950 mt-6 mb-2 leading-relaxed">
            {renderWithBold(trimmed.substring(5))}
          </h4>
        );
      }

      // Check image placeholder
      if (trimmed === '[IMAGE_PLACEHOLDER]') {
        return (
          <div key={index} className="my-12 p-3 bg-white rounded-3xl border border-[#7c6d5e]/15 shadow-xl overflow-hidden">
            <img 
              src="https://www.cosmiccouncil.pro/aiastrologer-reddit.png" 
              alt="AI vs Astrologer Reddit Discussion" 
              referrerPolicy="no-referrer"
              className="w-full max-w-2xl mx-auto rounded-2xl shadow-inner border border-slate-100"
            />
          </div>
        );
      }

      // Check bullet list items
      if (trimmed.startsWith('- ') || trimmed.startsWith('* ') || trimmed.startsWith('• ') || trimmed.startsWith('\t• ')) {
        const items = trimmed.split('\n').map(item => item.replace(/^(\t|-|\*|•)\s*/, ''));
        return (
          <ul key={index} className="list-disc pl-6 space-y-3 my-6 text-slate-700 text-base md:text-lg leading-relaxed font-normal">
            {items.map((it, i) => {
              return <li key={i}>{renderWithBold(it)}</li>;
            })}
          </ul>
        );
      }

      // Check numbered items (e.g. 1. or 1 - ) or special headers
      if (/^\d+[\s.-]/.test(trimmed) || trimmed.startsWith('Article #')) {
        if (trimmed.length < 80) {
          return (
            <h4 key={index} className="font-serif text-base md:text-lg font-normal text-indigo-950 mt-6 mb-2 leading-relaxed">
              {renderWithBold(trimmed)}
            </h4>
          );
        }
      }

      return (
        <p key={index} className="text-slate-700 text-base md:text-lg leading-relaxed font-normal mb-6 whitespace-pre-line">
          {renderWithBold(trimmed)}
        </p>
      );
    });
  };

  const activeArticle = activeIdx !== null ? combinedArticles[activeIdx] : null;

  return (
    <section ref={thoughtsRef} id="my-thoughts-section" className="bg-white py-24 md:py-32 border-t border-[#7c6d5e]/10">
      <div className="max-w-5xl mx-auto px-6">
        
        {activeArticle === null ? (
          /* LIST VIEW */
          <div className="animate-fade-in">
            {/* Breadcrumb Navigation */}
            <nav className="flex items-center gap-2 text-xs font-semibold text-[#7c6d5e]/70 uppercase tracking-widest mb-8 justify-center">
              <span className="hover:text-indigo-950 cursor-pointer transition-colors" onClick={() => navigate('/')}>Home</span>
              <span>/</span>
              <span className="text-indigo-950 font-bold">Blog</span>
            </nav>

            <div className="max-w-3xl mx-auto text-center mb-16">
              <h1 className="font-serif text-3xl md:text-5xl font-medium text-indigo-950 tracking-tight leading-tight">
                Vedic Astrology Blog & Essays
              </h1>
            </div>

            {/* Editorial Grid Card Layout */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {combinedArticles.map((art, idx) => (
                <div 
                  key={art.slug} 
                  onClick={() => handleArticleClick(idx)}
                  className="group bg-[#FAF9F6] border border-[#7c6d5e]/15 rounded-2xl p-8 md:p-10 flex flex-col justify-between hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 cursor-pointer"
                >
                  <div className="space-y-4">
                    <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider font-mono text-slate-400">
                      <span className="text-[#7c6d5e]">{art.category}</span>
                      <span>{art.readingTime}</span>
                    </div>
                    <h3 className="font-serif text-2xl font-semibold text-slate-900 group-hover:text-[#7c6d5e] transition-colors duration-300 leading-tight">
                      {art.title}
                    </h3>
                    <p className="text-slate-500 text-sm leading-relaxed font-light line-clamp-3">
                      {art.description}
                    </p>
                  </div>

                  <div className="pt-6">
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[#7c6d5e] hover:text-indigo-950 transition-colors duration-300">
                      Read Now 
                      <span className="transition-transform duration-300 group-hover:translate-x-1">→</span>
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {onBookReading && (
              <div className="mt-16 text-center">
                <button 
                  onClick={onBookReading}
                  className="inline-flex items-center gap-2 text-sm font-semibold text-[#7c6d5e] border-b border-[#7c6d5e]/30 pb-1 hover:border-[#7c6d5e] transition-colors cursor-pointer group"
                >
                  Want me to analyse YOUR chart instead? Book Your Reading
                  <svg className="w-4 h-4 transition-transform group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M17 8l4 4m0 0l-4 4m4-4H3" />
                  </svg>
                </button>
              </div>
            )}
          </div>
        ) : (
          /* ARTICLE DETAIL VIEW */
          <div className="animate-fade-in max-w-4xl mx-auto">
            {/* Breadcrumb Navigation */}
            <nav className="flex items-center gap-2 text-xs font-semibold text-[#7c6d5e]/70 uppercase tracking-widest mb-8">
              <span className="hover:text-indigo-950 cursor-pointer transition-colors" onClick={() => navigate('/')}>Home</span>
              <span>/</span>
              <span className="hover:text-indigo-950 cursor-pointer transition-colors" onClick={handleBack}>Blog</span>
              <span>/</span>
              <span className="text-indigo-950 font-bold truncate max-w-[150px] sm:max-w-[300px]" title={activeArticle.title}>{activeArticle.title}</span>
            </nav>

            {/* Back Button */}
            <button 
              onClick={handleBack}
              className="inline-flex items-center gap-2 text-sm font-semibold text-[#7c6d5e] hover:text-indigo-950 transition-colors mb-12 cursor-pointer group"
            >
              <svg className="w-5 h-5 transition-transform group-hover:-translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Back to Blog
            </button>

            {/* Article Header */}
            <div className="space-y-4 mb-10 pb-8 border-b border-slate-100">
              <div className="flex items-center gap-4 text-xs font-bold uppercase tracking-wider font-mono text-[#7c6d5e]">
                <span>{activeArticle.category}</span>
                <span className="w-1.5 h-1.5 rounded-full bg-slate-300"></span>
                <span>{activeArticle.readingTime}</span>
              </div>
              <h1 className="font-serif text-3xl md:text-5xl font-semibold text-slate-900 leading-tight tracking-tight">
                {activeArticle.title}
              </h1>
              <p className="text-slate-500 text-base md:text-lg font-light leading-relaxed max-w-3xl italic">
                {activeArticle.description}
              </p>
            </div>

            {/* Article Content */}
            <div className="max-w-none font-serif text-slate-800 leading-relaxed mb-20">
              {activeArticle.source === 'sanity' ? (
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    h1: ({ children }) => (
                      <h1 className="font-serif text-2xl md:text-3xl font-semibold text-indigo-950 mt-8 mb-4 leading-tight tracking-tight">
                        {children}
                      </h1>
                    ),
                    h2: ({ children }) => (
                      <h2 className="font-serif text-xl md:text-2xl font-semibold text-indigo-950 mt-7 mb-3 leading-tight tracking-tight">
                        {children}
                      </h2>
                    ),
                    h3: ({ children }) => (
                      <h3 className="font-serif text-base md:text-lg font-medium text-slate-900 mt-6 mb-3 leading-relaxed">
                        {children}
                      </h3>
                    ),
                    p: ({ children }) => (
                      <p className="text-slate-700 text-base md:text-lg leading-relaxed font-normal mb-6">
                        {children}
                      </p>
                    ),
                    ul: ({ children }) => (
                      <ul className="list-disc pl-6 space-y-3 my-6 text-slate-700 text-base md:text-lg leading-relaxed">
                        {children}
                      </ul>
                    ),
                    ol: ({ children }) => (
                      <ol className="list-decimal pl-6 space-y-3 my-6 text-slate-700 text-base md:text-lg leading-relaxed">
                        {children}
                      </ol>
                    ),
                    blockquote: ({ children }) => (
                      <blockquote className="border-l-4 border-[#7c6d5e]/30 pl-4 py-1 my-6 italic text-slate-600 bg-slate-50/50 rounded-r-md leading-relaxed text-base md:text-lg">
                        {children}
                      </blockquote>
                    ),
                    a: ({ href, children }) => (
                      <a href={href} className="text-[#7c6d5e] underline underline-offset-4 hover:text-indigo-950">
                        {children}
                      </a>
                    ),
                  }}
                >
                  {activeArticle.content}
                </ReactMarkdown>
              ) : (
                renderArticleContent(activeArticle.content)
              )}
            </div>

            {/* Other Articles Section */}
            <div className="mt-24 pt-16 border-t border-[#7c6d5e]/20">
              <h3 className="font-serif text-2xl md:text-3xl font-semibold text-slate-900 mb-10 tracking-tight">
                Other Essays & Thoughts
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {combinedArticles
                  .map((art, idx) => ({ art, idx }))
                  .filter(({ idx }) => idx !== activeIdx)
                  .slice(0, 2)
                  .map(({ art, idx }) => (
                    <div 
                      key={art.slug} 
                      onClick={() => handleArticleClick(idx)}
                      className="group bg-[#FAF9F6] border border-[#7c6d5e]/15 rounded-2xl p-8 flex flex-col justify-between hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 cursor-pointer"
                    >
                      <div className="space-y-3">
                        <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider font-mono text-slate-400">
                          <span className="text-[#7c6d5e]">{art.category}</span>
                          <span>{art.readingTime}</span>
                        </div>
                        <h4 className="font-serif text-xl font-semibold text-slate-900 group-hover:text-[#7c6d5e] transition-colors duration-300 leading-tight">
                          {art.title}
                        </h4>
                        <p className="text-slate-500 text-xs leading-relaxed font-light line-clamp-3">
                          {art.description}
                        </p>
                      </div>

                      <div className="pt-6">
                        <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[#7c6d5e]">
                          Read Now 
                          <span className="transition-transform duration-300 group-hover:translate-x-1">→</span>
                        </span>
                      </div>
                    </div>
                  ))}
              </div>
            </div>

            {onBookReading && (
              <div className="mt-16 text-center border-t border-slate-100 pt-12">
                <button 
                  onClick={onBookReading}
                  className="inline-flex items-center gap-2 px-12 py-4 bg-[#10B981] hover:bg-[#059669] text-white rounded-full text-lg font-bold shadow-xl transition-all duration-300 transform hover:scale-[1.03] active:scale-[0.98] cursor-pointer"
                >
                  Book your Reading
                  <svg className="w-5 h-5 text-white animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
                  </svg>
                </button>
              </div>
            )}
          </div>
        )}

      </div>
    </section>
  );
};

export default MyThoughts;
