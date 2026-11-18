export interface SanityArticleItem {
  id: string;
  slug: string;
  title: string;
  description: string;
  publishedAt: string;
  content: string;
  category?: string;
  source: 'sanity';
}

export function isSanityConfigured(): boolean {
  return Boolean(process.env.SANITY_PROJECT_ID);
}

let cachedSanityPosts: { fetchedAt: number; posts: SanityArticleItem[] } | null = null;

export async function fetchSanityBlogPosts(): Promise<SanityArticleItem[]> {
  const projectId = process.env.SANITY_PROJECT_ID;
  const dataset = process.env.SANITY_DATASET || 'production';

  if (!projectId) {
    return [];
  }

  if (cachedSanityPosts && Date.now() - cachedSanityPosts.fetchedAt < 5 * 60_000) {
    return cachedSanityPosts.posts;
  }

  const groqQuery = encodeURIComponent(
    `*[_type == "post" && defined(slug.current)] | order(publishedAt desc)[0...30]{
      _id,
      "slug": slug.current,
      title,
      "description": coalesce(excerpt, description, ""),
      publishedAt,
      category,
      "content": coalesce(markdownBody, pt::text(body), bodyText, "")
    }`
  );

  const url = `https://${projectId}.api.sanity.io/v2024-01-01/data/query/${dataset}?query=${groqQuery}`;

  try {
    const res = await fetch(url);
    if (!res.ok) {
      return [];
    }
    const json = (await res.json()) as {
      result?: Array<{
        _id: string;
        slug: string;
        title: string;
        description?: string;
        publishedAt?: string;
        category?: string;
        content?: string;
      }>;
    };

    const posts: SanityArticleItem[] = (json.result || [])
      .filter((r) => r.slug && r.title)
      .map((r) => ({
        id: r._id,
        slug: r.slug,
        title: r.title,
        description: r.description || '',
        publishedAt: r.publishedAt || new Date().toISOString().slice(0, 10),
        category: r.category || 'Jyotish Essay',
        content: r.content || '',
        source: 'sanity' as const,
      }));

    cachedSanityPosts = { fetchedAt: Date.now(), posts };
    return posts;
  } catch {
    return [];
  }
}
