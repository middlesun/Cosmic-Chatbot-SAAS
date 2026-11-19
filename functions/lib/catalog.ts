import { getSupabaseCreds } from './workspace-auth';

export interface DirectoryEntry {
  id: string;
  name: string;
  url: string;
  tags: string[];
  category: string;
  domain_rating: number;
  description: string;
  pricing_type: 'free' | 'freemium' | 'paid';
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export function normalizeDirectoryTags(rawTags: unknown): string[] {
  const parts: string[] = Array.isArray(rawTags)
    ? rawTags.map((t) => String(t || '').trim())
    : typeof rawTags === 'string'
      ? rawTags.split(/[,;|]+/).map((t) => t.trim())
      : [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const tag of parts) {
    if (!tag) continue;
    const key = tag.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      out.push(tag.slice(0, 40));
    }
  }
  return out;
}

function deriveDirectoryNameFromUrl(rawUrl: string): string {
  try {
    const u = new URL(rawUrl.startsWith('http') ? rawUrl : `https://${rawUrl}`);
    const host = u.hostname.replace(/^www\./i, '');
    const base = host.split('.')[0] || host;
    return base ? base.charAt(0).toUpperCase() + base.slice(1) : 'Directory';
  } catch {
    return 'Directory';
  }
}

function normalizeDirectoryRow(row: any): DirectoryEntry {
  const rawTags = normalizeDirectoryTags(row?.tags);
  const fallbackTags =
    rawTags.length > 0
      ? rawTags
      : row?.category && row.category !== 'general'
        ? [String(row.category)]
        : [];
  return {
    id: String(row?.id || ''),
    name: String(row?.name || 'Untitled Directory'),
    url: String(row?.url || ''),
    tags: fallbackTags,
    category: String(row?.category || 'general'),
    domain_rating: Number(row?.domain_rating ?? 70) || 0,
    description: String(row?.description || ''),
    pricing_type: (row?.pricing_type as 'free' | 'freemium' | 'paid') || 'free',
    is_active: row?.is_active !== false,
    created_at: String(row?.created_at || new Date().toISOString()),
    updated_at: String(row?.updated_at || new Date().toISOString()),
  };
}

const BULK_DOMAIN_DIRECTORY_SPECS: Array<[string, string[]]> = [
  ['aitoptools.com', ['AI', 'Tools', 'Directory']],
  ['aitoolsdirectory.com', ['AI', 'Tools', 'Directory']],
  ['submitator.com', ['AI', 'Marketing', 'Directory']],
  ['backlinkbot.ai', ['Backlinks', 'SEO', 'Directory']],
  ['gptbot.io', ['AI', 'Tools', 'Directory']],
  ['startupsubmit.app', ['Startups', 'AI', 'Directory']],
  ['submitsaas.com', ['SaaS', 'AI', 'Directory']],
  ['theaisearchdirectory.com', ['AI', 'Search', 'Directory']],
  ['toolscout.ai', ['AI', 'Tools', 'Directory']],
  ['aisuperhub.io', ['AI', 'Tools', 'Directory']],
  ['bestofai.io', ['AI', 'Tools', 'Directory']],
  ['aitoolscapital.com', ['AI', 'Tools', 'Leaderboard']],
  ['submitwell.com', ['AI', 'Tools', 'Directory']],
  ['scrolllaunch.com', ['Launchpad', 'AI', 'Tools']],
  ['peerpush.com', ['Launchpad', 'Startups', 'Discovery']],
  ['codehype.ai', ['SaaS', 'Directory', 'Startups']],
  ['findly.tools', ['Tools', 'Discovery', 'Directory']],
  ['index.dodopayments.com', ['Startups', 'Indie', 'SaaS']],
  ['turbo0.com', ['Tools', 'Directory', 'Discovery']],
  ['toolpilot.ai', ['AI', 'Tools', 'Directory']],
  ['csswinner.com', ['Design', 'Showcase', 'Directory']],
  ['goodaitools.com', ['AI', 'Tools', 'Productivity']],
  ['activesearchresults.com', ['Search', 'Backlinks', 'Directory']],
  ['plerdy.com', ['SaaS', 'Tools', 'Directory']],
  ['tools.launchllama.co', ['Launchpad', 'Startups', 'Directory']],
  ['linkcentre.com', ['Backlinks', 'Directory', 'General']],
  ['productwatch.io', ['Launchpad', 'Startups', 'Tech']],
  ['tekpon.com', ['SaaS', 'B2B', 'Software']],
  ['viesearch.com', ['Search', 'Backlinks', 'Directory']],
  ['aidirectori.es', ['AI', 'Directory', 'Startups']],
  ['aibase.com', ['AI', 'Tools', 'Directory']],
  ['allmyfaves.com', ['Bookmarks', 'Discovery', 'Directory']],
  ['openhunts.com', ['Launchpad', 'Startups', 'Alternative']],
  ['therundown.ai', ['AI', 'Newsletter', 'Tools']],
  ['tinystartups.com', ['Launchpad', 'Startups', 'Indie']],
  ['layers.to', ['Design', 'Showcase', 'Community']],
  ['whatlaunched.today', ['Launchpad', 'Startups', 'Discovery']],
  ['craftwork.design', ['Design', 'UI', 'Resources']],
  ['magicbox.tools', ['AI', 'Tools', 'Directory']],
  ['aitools.inc', ['AI', 'Tools', 'Directory']],
  ['saaspirate.com', ['SaaS', 'Deals', 'Directory']],
  ['uno.directory', ['AI', 'Tools', 'Directory']],
  ['landingfolio.com', ['Design', 'Landing Pages', 'Inspiration']],
  ['nocode.tech', ['No-Code', 'Tools', 'Directory']],
  ['microlaunch.net', ['Launchpad', 'Tech', 'Startups']],
  ['saascity.io', ['SaaS', 'Launchpad', 'Directory']],
  ['earlyhunt.com', ['Launchpad', 'AI', 'Startups']],
  ['recent.design', ['Design', 'Inspiration', 'Showcase']],
  ['indiehunt.io', ['Launchpad', 'Indie', 'AI']],
  ['toolfio.com', ['SaaS', 'AI', 'Tools']],
  ['dailybot.com', ['AI', 'Tools', 'Directory']],
  ['siteswebdirectory.com', ['Backlinks', 'Directory', 'General']],
  ['saasgrow.app', ['SaaS', 'Startups', 'Build in Public']],
  ['toolfinder.com', ['AI', 'Tools', 'Productivity']],
  ['aithor.com', ['AI', 'Tools', 'Directory']],
  ['dailypings.com', ['Launchpad', 'Startups', 'Discovery']],
  ['productwing.com', ['SaaS', 'Software', 'Directory']],
  ['aixcollection.com', ['AI', 'Tools', 'Directory']],
  ['builtatlightspeed.com', ['Design', 'Templates', 'UI']],
  ['aitoolnet.com', ['AI', 'Tools', 'Directory']],
  ['launchvault.dev', ['Launchpad', 'Startups', 'Tech']],
  ['shinylaunch.com', ['Launchpad', 'Startups', 'Discovery']],
  ['saasaitools.com', ['SaaS', 'AI', 'Tools']],
  ['dododirectory.com', ['Backlinks', 'Business', 'Directory']],
  ['curated.design', ['Design', 'Inspiration', 'Showcase']],
  ['mylaunchstash.com', ['Launchpad', 'Startups', 'Software']],
  ['promoteproject.com', ['Startups', 'Backlinks', 'Directory']],
  ['makerthrive.com', ['Makers', 'Tools', 'Directory']],
  ['sumodir.com', ['SaaS', 'Startups', 'Directory']],
  ['shipboost.io', ['Launchpad', 'Startups', 'Discovery']],
  ['toolhunter.ai', ['AI', 'Tools', 'Directory']],
  ['viberank.dev', ['Launchpad', 'Developers', 'Directory']],
  ['rankinpublic.xyz', ['Launchpad', 'SaaS', 'Indie']],
  ['thatappshow.com', ['Software', 'Apps', 'Directory']],
  ['trustiner.com', ['Software', 'B2B', 'SaaS']],
  ['best-ai.org', ['AI', 'Tools', 'Directory']],
  ['saaswheel.com', ['SaaS', 'Workflows', 'Directory']],
  ['aigc160.com', ['AI', 'Content', 'Tools']],
  ['bai.tools', ['AI', 'Tools', 'Directory']],
  ['besttoolvault.com', ['Software', 'Tools', 'Directory']],
  ['huntfortools.com', ['Software', 'Tools', 'Directory']],
  ['poweruptools.com', ['AI', 'Productivity', 'Tools']],
  ['alterbase.co', ['SaaS', 'Alternatives', 'Software']],
  ['launchscroll.com', ['Launchpad', 'Software', 'Discovery']],
  ['postmake.io', ['Tools', 'Makers', 'Directory']],
  ['projecthunt.me', ['Launchpad', 'Startups', 'Indie']],
  ['solvertools.com', ['Software', 'Workflows', 'Tools']],
  ['tidyrepo.com', ['WordPress', 'Plugins', 'Directory']],
  ['vibecodinglist.com', ['Vibe Coding', 'Indie', 'Launchpad']],
  ['appsytools.com', ['Software', 'Tools', 'Marketing']],
  ['beamtools.com', ['Software', 'Workflows', 'Tools']],
  ['confettisaas.com', ['SaaS', 'Startups', 'Directory']],
  ['deadsimplesites.com', ['Design', 'Minimal', 'Showcase']],
  ['fuse.kiwi', ['Discovery', 'Web', 'Directory']],
  ['productlistdir.com', ['Software', 'Tools', 'Directory']],
  ['saasfield.com', ['SaaS', 'AI', 'Directory']],
  ['toshilist.com', ['Software', 'Tools', 'Directory']],
  ['mystarttools.com', ['Startups', 'Tools', 'Directory']],
  ['stackdirectory.com', ['Software', 'Stack', 'Directory']],
  ['submithunt.com', ['Launchpad', 'Startups', 'Directory']],
  ['toolfinddir.com', ['AI', 'Tools', 'Directory']],
  ['sitepromotiondirectory.com', ['Backlinks', 'SEO', 'Directory']],
  ['softwarebolt.com', ['Software', 'Tools', 'Directory']],
  ['tinyhunt.dev', ['Launchpad', 'Tech', 'Indie']],
  ['aiscout.net', ['AI', 'Tools', 'Directory']],
  ['ashlist.com', ['Software', 'Tools', 'Directory']],
  ['bestofai.com', ['AI', 'Tools', 'Directory']],
  ['saasroots.com', ['SaaS', 'Startups', 'Directory']],
  ['saastoolsdir.com', ['SaaS', 'Tools', 'Directory']],
  ['dirs.cc', ['Tools', 'Products', 'Directory']],
  ['toolsignal.com', ['Software', 'Tools', 'Directory']],
  ['toptrendtools.com', ['Software', 'Productivity', 'Tools']],
  ['darkmodedesign.com', ['Design', 'Inspiration', 'Showcase']],
  ['productburst.com', ['Launchpad', 'Startups', 'Marketing']],
  ['saashubdirectory.com', ['SaaS', 'Tools', 'Directory']],
  ['startuplist.ing', ['Startups', 'SaaS', 'Directory']],
  ['toolslisthq.com', ['Software', 'Tools', 'Directory']],
  ['1000.tools', ['Tools', 'Directory', 'Discovery']],
  ['startups.watch', ['Startups', 'Discovery', 'Directory']],
  ['startupaideas.com', ['AI', 'Startups', 'Tools']],
  ['superaiboom.com', ['AI', 'Tools', 'Automation']],
  ['themegatools.com', ['Software', 'Tools', 'Directory']],
  ['tinytoolhub.com', ['Tools', 'Indie', 'Directory']],
  ['featuredtool.com', ['Tools', 'Discovery', 'Directory']],
  ['productfame.com', ['Launchpad', 'Startups', 'Discovery']],
  ['victrays.com', ['AI', 'Prompts', 'Tools']],
  ['nocodelist.co', ['No-Code', 'Tools', 'Directory']],
  ['theapptools.com', ['AI', 'Apps', 'Tools']],
  ['thetoolsverse.com', ['AI', 'Tools', 'Directory']],
  ['businesshunt.co', ['Business', 'Launchpad', 'Directory']],
  ['flatui.com', ['Design', 'UI', 'Showcase']],
  ['rankyourai.com', ['AI', 'Tools', 'Directory']],
  ['shipyardhq.dev', ['Launchpad', 'Startups', 'Developers']],
  ['aitoolsrecap.com', ['AI', 'Directory', 'Tools']],
  ['listingbott.com', ['Directory', 'Submission', 'SEO']],
  ['hyzenpro.com', ['AI', 'Tools', 'Directory']],
  ['saastr.ai', ['AI', 'Agents', 'B2B']],
  ['microsaasdirectory.com', ['Micro-SaaS', 'SaaS', 'Directory']],
  ['listmysaas.xyz', ['SaaS', 'Directory', 'Startups']],
  ['startupbricks.in', ['Startups', 'SaaS', 'AI']],
  ['easysubmits.com', ['SaaS', 'Directory', 'Submission']],
  ['postyourbuildideas.com/launch', ['Launchpad', 'Startups', 'Indie']],
  ['megalaun.ch', ['Launchpad', 'Startups', 'Discovery']],
  ['shipdesk.dev', ['Launchpad', 'Developers', 'Indie']],
  ['freeaidirectory.com', ['AI', 'Tools', 'Directory']],
  ['dailyaitools.ai', ['AI', 'Tools', 'Directory']],
  ['toolala.io', ['AI', 'Tools', 'Directory']],
  ['makesuccessonline.com', ['Startups', 'Tools', 'Directory']],
  ['automateo.app', ['AI', 'Automation', 'Directory']],
  ['eliteai.tools', ['AI', 'Tools', 'Directory']],
  ['nanolaunch.online', ['Launchpad', 'Indie', 'Startups']],
  ['launchaitools.io', ['AI', 'Launchpad', 'Tools']],
  ['trylaunch.ai', ['Launchpad', 'AI', 'Startups']],
  ['launchwoo.com', ['Launchpad', 'Startups', 'Directory']],
  ['every-ai.com', ['AI', 'Tools', 'Directory']],
];

const BULK_DOMAIN_DIRECTORY_ID_SET = new Set(
  BULK_DOMAIN_DIRECTORY_SPECS.map(([domain]) => `dir-${domain.replace(/[^a-z0-9]+/g, '-')}`)
);

export function getDefaultDirectories(): DirectoryEntry[] {
  const now = new Date().toISOString();
  return [
    { id: 'dir-product-hunt', name: 'Product Hunt', url: 'https://www.producthunt.com/posts/new', tags: ['Launchpad', 'Startups', 'Tech'], category: 'launchpads', domain_rating: 91, description: 'Premier tech launch platform with global audience', pricing_type: 'free', is_active: true, created_at: now, updated_at: now },
    { id: 'dir-betalist', name: 'BetaList', url: 'https://betalist.com/submit', tags: ['Launchpad', 'Early Stage', 'Beta'], category: 'launchpads', domain_rating: 76, description: 'Early-stage startup discovery & beta subscriber acquisition', pricing_type: 'freemium', is_active: true, created_at: now, updated_at: now },
    { id: 'dir-devpost', name: 'Devpost', url: 'https://devpost.com/software/new', tags: ['Launchpad', 'Developers', 'Indie'], category: 'launchpads', domain_rating: 84, description: 'Developer & indie hacker project showcase', pricing_type: 'free', is_active: true, created_at: now, updated_at: now },
    { id: 'dir-launching-next', name: 'Launching Next', url: 'https://www.launchingnext.com/submit/', tags: ['Launchpad', 'Startups'], category: 'launchpads', domain_rating: 70, description: 'Curated daily showcase of promising new startups', pricing_type: 'free', is_active: true, created_at: now, updated_at: now },
    { id: 'dir-killerstartups', name: 'KillerStartups', url: 'https://www.killerstartups.com/submit-startup/', tags: ['Launchpad', 'Reviews', 'Startups'], category: 'launchpads', domain_rating: 74, description: 'Startup reviews and discovery community', pricing_type: 'freemium', is_active: true, created_at: now, updated_at: now },
    { id: 'dir-startupbase', name: 'StartupBase', url: 'https://startupbase.io/submit', tags: ['Launchpad', 'Makers', 'Community'], category: 'launchpads', domain_rating: 68, description: 'Community for makers to share new tech products', pricing_type: 'free', is_active: true, created_at: now, updated_at: now },
    { id: 'dir-futurepedia', name: 'Futurepedia', url: 'https://www.futurepedia.io/submit-tool', tags: ['AI', 'Tools', 'Discovery'], category: 'ai', domain_rating: 81, description: 'Largest AI tools catalog with 450K+ monthly visitors', pricing_type: 'freemium', is_active: true, created_at: now, updated_at: now },
    { id: 'dir-toolify', name: 'Toolify.ai', url: 'https://www.toolify.ai/submit', tags: ['AI', 'Tools', 'Directory'], category: 'ai', domain_rating: 79, description: 'Top AI discovery engine with 1.2M+ monthly visits', pricing_type: 'paid', is_active: true, created_at: now, updated_at: now },
    { id: 'dir-taaft', name: 'Theres An AI For That', url: 'https://theresanaiforthat.com/submit/', tags: ['AI', 'Aggregator', 'Tools'], category: 'ai', domain_rating: 83, description: 'Massive AI aggregator with smart search', pricing_type: 'paid', is_active: true, created_at: now, updated_at: now },
    { id: 'dir-aivalley', name: 'AI Valley', url: 'https://aivalley.ai/submit', tags: ['AI', 'Newsletter', 'Tools'], category: 'ai', domain_rating: 72, description: 'Curated AI repository and daily newsletter', pricing_type: 'free', is_active: true, created_at: now, updated_at: now },
    { id: 'dir-topai', name: 'TopAI.tools', url: 'https://topai.tools/submit', tags: ['AI', 'Productivity', 'Marketing'], category: 'ai', domain_rating: 75, description: 'High-DR catalog for AI productivity and marketing tools', pricing_type: 'freemium', is_active: true, created_at: now, updated_at: now },
    { id: 'dir-futuretools', name: 'FutureTools', url: 'https://www.futuretools.io/submit-a-tool', tags: ['AI', 'Software', 'Tools'], category: 'ai', domain_rating: 78, description: 'Curated AI software directory by Matt Wolfe', pricing_type: 'free', is_active: true, created_at: now, updated_at: now },
    { id: 'dir-saashub', name: 'SaaSHub', url: 'https://www.saashub.com/submit', tags: ['SaaS', 'Alternatives', 'Software'], category: 'saas', domain_rating: 78, description: 'High-traffic software alternative & comparison engine', pricing_type: 'free', is_active: true, created_at: now, updated_at: now },
    { id: 'dir-alternativeto', name: 'AlternativeTo', url: 'https://alternativeto.net/software/add/', tags: ['SaaS', 'Alternatives', 'Software'], category: 'saas', domain_rating: 86, description: 'Authority crowdsourced software directory & alternatives', pricing_type: 'free', is_active: true, created_at: now, updated_at: now },
    { id: 'dir-sourceforge', name: 'SourceForge', url: 'https://sourceforge.net/create/', tags: ['SaaS', 'B2B', 'Reviews'], category: 'saas', domain_rating: 92, description: 'Global business software directory & user review platform', pricing_type: 'free', is_active: true, created_at: now, updated_at: now },
    { id: 'dir-capterra', name: 'Capterra Community', url: 'https://www.capterra.com/vendors/', tags: ['SaaS', 'B2B', 'Enterprise'], category: 'saas', domain_rating: 91, description: 'Gartner business software listing program', pricing_type: 'free', is_active: true, created_at: now, updated_at: now },
    { id: 'dir-getapp', name: 'GetApp', url: 'https://www.getapp.com/vendor/', tags: ['SaaS', 'Cloud', 'B2B'], category: 'saas', domain_rating: 89, description: 'Discover & compare business apps and cloud tools', pricing_type: 'free', is_active: true, created_at: now, updated_at: now },
    { id: 'dir-softwareadvice', name: 'Software Advice', url: 'https://www.softwareadvice.com/vendor/', tags: ['SaaS', 'B2B', 'Directory'], category: 'saas', domain_rating: 88, description: 'B2B software directory and buyer guidance', pricing_type: 'free', is_active: true, created_at: now, updated_at: now },
    { id: 'dir-indiehackers', name: 'Indie Hackers Products', url: 'https://www.indiehackers.com/products', tags: ['Indie', 'Micro-SaaS', 'Community'], category: 'indie', domain_rating: 88, description: 'Showcase your profitable micro-SaaS and side projects', pricing_type: 'free', is_active: true, created_at: now, updated_at: now },
    { id: 'dir-microns', name: 'Microns.io', url: 'https://www.microns.io/', tags: ['Indie', 'Micro-SaaS', 'Startups'], category: 'indie', domain_rating: 69, description: 'Marketplace and showcase for bootstrap indie startups', pricing_type: 'free', is_active: true, created_at: now, updated_at: now },
    { id: 'dir-uneed', name: 'Uneed Best', url: 'https://www.uneed.best/submit-a-tool', tags: ['Indie', 'Launchpad', 'Tools'], category: 'indie', domain_rating: 73, description: 'Daily hand-picked tools for web builders and makers', pricing_type: 'freemium', is_active: true, created_at: now, updated_at: now },
    { id: 'dir-startupbuffer', name: 'StartupBuffer', url: 'https://startupbuffer.com/site/submit', tags: ['Indie', 'Growth', 'Startups'], category: 'indie', domain_rating: 66, description: 'Promote your startup to growth hackers & founders', pricing_type: 'free', is_active: true, created_at: now, updated_at: now },
    { id: 'dir-sideprojectors', name: 'SideProjectors', url: 'https://www.sideprojectors.com/', tags: ['Indie', 'Side Projects'], category: 'indie', domain_rating: 65, description: 'Showcase and discover side projects from indie developers', pricing_type: 'free', is_active: true, created_at: now, updated_at: now },
    { id: 'dir-feedough', name: 'Feedough', url: 'https://www.feedough.com/', tags: ['Indie', 'Startups', 'Business'], category: 'indie', domain_rating: 77, description: 'Startup and business model guide listing', pricing_type: 'freemium', is_active: true, created_at: now, updated_at: now },
    { id: 'dir-crunchbase', name: 'Crunchbase', url: 'https://www.crunchbase.com/add-new', tags: ['Backlinks', 'SEO', 'Investors'], category: 'backlinks', domain_rating: 92, description: 'World premier company information and investor database', pricing_type: 'free', is_active: true, created_at: now, updated_at: now },
    { id: 'dir-f6s', name: 'F6S', url: 'https://www.f6s.com/', tags: ['Backlinks', 'Founders', 'Startups'], category: 'backlinks', domain_rating: 85, description: 'Global network for founders, accelerators & startups', pricing_type: 'free', is_active: true, created_at: now, updated_at: now },
    { id: 'dir-clutch', name: 'Clutch.co', url: 'https://clutch.co/get-listed', tags: ['Backlinks', 'B2B', 'Reviews'], category: 'backlinks', domain_rating: 90, description: 'Leading ratings & reviews for B2B service firms', pricing_type: 'free', is_active: true, created_at: now, updated_at: now },
    { id: 'dir-trustpilot', name: 'Trustpilot', url: 'https://business.trustpilot.com/', tags: ['Backlinks', 'Reviews', 'Authority'], category: 'backlinks', domain_rating: 93, description: 'Global consumer review platform & brand authority link', pricing_type: 'freemium', is_active: true, created_at: now, updated_at: now },
    { id: 'dir-alltopstartups', name: 'AllTopStartups', url: 'https://alltopstartups.com/submit-startup/', tags: ['Backlinks', 'SEO', 'Startups'], category: 'backlinks', domain_rating: 71, description: 'Resource hub for entrepreneurs with high-authority backlink', pricing_type: 'free', is_active: true, created_at: now, updated_at: now },
    { id: 'dir-feedmystartup', name: 'FeedMyStartup', url: 'https://www.feedmystartup.com/submit/', tags: ['Backlinks', 'Startups', 'Reviews'], category: 'backlinks', domain_rating: 64, description: 'Fast review submission platform for fresh SaaS products', pricing_type: 'free', is_active: true, created_at: now, updated_at: now },
    ...BULK_DOMAIN_DIRECTORY_SPECS.map(([domain, tags]) => ({
      id: `dir-${domain.replace(/[^a-z0-9]+/g, '-')}`,
      name: domain.split('/')[0],
      url: `https://${domain}`,
      tags,
      category: (tags[0] || 'general').toLowerCase(),
      domain_rating: 0,
      description: '',
      pricing_type: 'free' as const,
      is_active: true,
      created_at: now,
      updated_at: now,
    })),
  ];
}

let inMemoryDirectoriesFallback: DirectoryEntry[] | null = null;

function getMemoryDirectories(): DirectoryEntry[] {
  if (!inMemoryDirectoriesFallback) {
    inMemoryDirectoriesFallback = getDefaultDirectories();
  }
  return inMemoryDirectoriesFallback;
}

export async function loadDirectoriesFromEnv(env: any, includeInactive = false): Promise<{ items: DirectoryEntry[]; source: string }> {
  const { url, anonKey, serviceKey } = getSupabaseCreds(env);
  const key = serviceKey || anonKey;
  if (url && key) {
    try {
      const filter = includeInactive ? '' : '&is_active=eq.true';
      const res = await fetch(`${url}/rest/v1/directories?select=*${filter}&order=domain_rating.desc,name.asc`, {
        headers: { apikey: key, Authorization: `Bearer ${key}` },
      });
      if (res.ok) {
        const rows = await res.json();
        if (Array.isArray(rows) && rows.length > 0) {
          const existingIds = new Set(rows.map((r: any) => String(r?.id || '')));
          const existingUrls = new Set(rows.map((r: any) => String(r?.url || '').trim().toLowerCase().replace(/\/+$/, '')));
          const extraDefaults = getDefaultDirectories().filter(
            (d) =>
              BULK_DOMAIN_DIRECTORY_ID_SET.has(d.id) &&
              !existingIds.has(d.id) &&
              !existingUrls.has(String(d.url || '').trim().toLowerCase().replace(/\/+$/, ''))
          );
          if (extraDefaults.length > 0) {
            await fetch(`${url}/rest/v1/directories`, {
              method: 'POST',
              headers: {
                apikey: key,
                Authorization: `Bearer ${key}`,
                'Content-Type': 'application/json',
                Prefer: 'resolution=ignore-duplicates',
              },
              body: JSON.stringify(extraDefaults),
            }).catch(() => {});
            const merged = [...rows.map(normalizeDirectoryRow), ...extraDefaults];
            return { items: merged, source: 'supabase' };
          }
          return { items: rows.map(normalizeDirectoryRow), source: 'supabase' };
        }
        const defaults = getDefaultDirectories();
        await fetch(`${url}/rest/v1/directories`, {
          method: 'POST',
          headers: {
            apikey: key,
            Authorization: `Bearer ${key}`,
            'Content-Type': 'application/json',
            Prefer: 'resolution=merge-duplicates',
          },
          body: JSON.stringify(defaults),
        }).catch(() => {});
        return { items: defaults, source: 'supabase-seeded' };
      }
    } catch {}
  }
  const items = getMemoryDirectories();
  const filtered = includeInactive ? items : items.filter((d) => d.is_active !== false);
  return { items: filtered.map(normalizeDirectoryRow), source: 'default' };
}

function buildDirectoryEntryForSave(input: Partial<DirectoryEntry>, idxSeed = 0): DirectoryEntry | null {
  const rawUrl = String(input.url || '').trim();
  if (!rawUrl) return null;
  const normalizedUrl = /^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`;
  const now = new Date().toISOString();
  const id = (input.id || `dir-${Date.now()}-${idxSeed}-${Math.random().toString(36).slice(2, 6)}`).trim();
  const tags = normalizeDirectoryTags(input.tags);
  const name = (input.name || deriveDirectoryNameFromUrl(normalizedUrl)).trim();
  return {
    id,
    name: name || 'Untitled Directory',
    url: normalizedUrl,
    tags,
    category: (input.category || tags[0] || 'general').trim().toLowerCase(),
    domain_rating: Math.max(0, Math.min(100, Number(input.domain_rating ?? 70) || 0)),
    description: (input.description || '').trim(),
    pricing_type: 'free',
    is_active: input.is_active !== false,
    created_at: input.created_at || now,
    updated_at: now,
  };
}

export async function upsertDirectoryFromEnv(env: any, input: Partial<DirectoryEntry>): Promise<{ item: DirectoryEntry; source: string }> {
  const item = buildDirectoryEntryForSave(input) || {
    id: (input.id || `dir-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`).trim(),
    name: (input.name || 'Untitled Directory').trim(),
    url: (input.url || '').trim(),
    tags: normalizeDirectoryTags(input.tags),
    category: 'general',
    domain_rating: Math.max(0, Math.min(100, Number(input.domain_rating ?? 70) || 0)),
    description: (input.description || '').trim(),
    pricing_type: 'free' as const,
    is_active: input.is_active !== false,
    created_at: input.created_at || new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const { url, anonKey, serviceKey } = getSupabaseCreds(env);
  const key = serviceKey || anonKey;
  if (url && key) {
    try {
      const res = await fetch(`${url}/rest/v1/directories`, {
        method: 'POST',
        headers: {
          apikey: key,
          Authorization: `Bearer ${key}`,
          'Content-Type': 'application/json',
          Prefer: 'resolution=merge-duplicates,return=representation',
        },
        body: JSON.stringify(item),
      });
      if (res.ok) {
        const rows = await res.json();
        return { item: rows?.[0] ? normalizeDirectoryRow(rows[0]) : item, source: 'supabase' };
      }
    } catch {}
  }

  const mem = getMemoryDirectories();
  const idx = mem.findIndex((d) => d.id === item.id);
  if (idx >= 0) {
    item.created_at = mem[idx].created_at || item.created_at;
    mem[idx] = item;
  } else {
    mem.unshift(item);
  }
  return { item, source: 'memory' };
}

export async function upsertDirectoriesBulkFromEnv(env: any, inputs: Array<Partial<DirectoryEntry>>): Promise<{ items: DirectoryEntry[]; source: string }> {
  const built: DirectoryEntry[] = [];
  const seenUrls = new Set<string>();
  inputs.forEach((raw, idx) => {
    const item = buildDirectoryEntryForSave(raw, idx);
    if (!item) return;
    const urlKey = item.url.toLowerCase().replace(/\/+$/, '');
    if (seenUrls.has(urlKey)) return;
    seenUrls.add(urlKey);
    built.push(item);
  });

  if (built.length === 0) {
    return { items: [], source: 'empty' };
  }

  const { url, anonKey, serviceKey } = getSupabaseCreds(env);
  const key = serviceKey || anonKey;
  if (url && key) {
    try {
      const res = await fetch(`${url}/rest/v1/directories`, {
        method: 'POST',
        headers: {
          apikey: key,
          Authorization: `Bearer ${key}`,
          'Content-Type': 'application/json',
          Prefer: 'resolution=merge-duplicates,return=representation',
        },
        body: JSON.stringify(built),
      });
      if (res.ok) {
        const rows = await res.json();
        const saved = Array.isArray(rows) ? rows.map(normalizeDirectoryRow) : built;
        return { items: saved, source: 'supabase' };
      }
    } catch {}
  }

  const mem = getMemoryDirectories();
  const existingUrlMap = new Map<string, number>();
  mem.forEach((d, i) => {
    existingUrlMap.set(String(d.url || '').toLowerCase().replace(/\/+$/, ''), i);
  });

  for (const item of [...built].reverse()) {
    const urlKey = item.url.toLowerCase().replace(/\/+$/, '');
    const existingIdx = existingUrlMap.get(urlKey);
    if (existingIdx !== undefined) {
      item.id = mem[existingIdx].id;
      item.created_at = mem[existingIdx].created_at || item.created_at;
      mem[existingIdx] = item;
    } else {
      mem.unshift(item);
    }
  }
  return { items: built, source: 'memory' };
}

export async function deleteDirectoryFromEnv(env: any, id: string): Promise<boolean> {
  const { url, anonKey, serviceKey } = getSupabaseCreds(env);
  const key = serviceKey || anonKey;
  if (url && key) {
    try {
      const res = await fetch(`${url}/rest/v1/directories?id=eq.${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: { apikey: key, Authorization: `Bearer ${key}` },
      });
      if (res.ok) return true;
    } catch {}
  }
  inMemoryDirectoriesFallback = getMemoryDirectories().filter((d) => d.id !== id);
  return true;
}

export function buildDirectoryListsByCategory(items: DirectoryEntry[]) {
  const grouped: Record<string, Array<{ id: string; name: string; dr: string; desc: string; url: string; pricing_type: string }>> = {};
  for (const item of items) {
    const cat = (item.category || 'launchpads').trim().toLowerCase();
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push({
      id: item.id,
      name: item.name,
      dr: `DR ${Number(item.domain_rating || 0)}`,
      desc: item.description || '',
      url: item.url,
      pricing_type: item.pricing_type || 'free',
    });
  }
  return grouped;
}

export function getWorkspaceSelectorRecipes(tier: 'basic' | 'pro') {
  const generic = {
    commentComposers: [
      '#comment',
      'textarea[name="comment"]',
      'form#commentform textarea',
      '.comment-form textarea',
      'textarea.comment-textarea',
      'textarea[id*="comment" i]',
      'textarea[name*="comment" i]',
      'textarea[placeholder*="comment" i]',
      'textarea[placeholder*="reply" i]',
      'textarea[placeholder*="thoughts" i]',
      'textarea[placeholder*="response" i]',
      'div[role="textbox"][contenteditable="true"]',
      'div[contenteditable="true"].comment-input',
      'div[contenteditable="true"]',
      'textarea',
    ],
    submitButtons: [
      '#submit',
      'input[type="submit"]',
      'button[type="submit"]',
      'button.comment-submit',
    ],
  };

  if (tier !== 'pro') {
    return {
      version: '1.3.0',
      tier: 'basic',
      generic,
      platforms: {},
      webmail: {},
      dm: {},
      directoryDetection: {
        knownHosts: [],
      },
    };
  }

  return {
    version: '1.3.0',
    tier: 'pro',
    generic,
    platforms: {
      youtube: {
        hosts: ['youtube.com', 'youtu.be'],
        badgeText: 'Context: 💬 YouTube Comment',
        sectionScroll: ['ytd-comments', '#comments'],
        placeholders: [
          'ytd-comments #placeholder-area',
          '#simplebox-placeholder',
          '#placeholder-area',
          'ytd-comment-simplebox-renderer #placeholder-area',
          'ytd-commentbox #placeholder-area',
          'ytd-comments ytd-comment-dialog-renderer',
          '#comments #placeholder-area',
          'ytd-comment-simplebox-renderer',
          'yt-formatted-string#placeholder-text',
        ],
        composers: [
          'ytd-commentbox #contenteditable-root',
          '#contenteditable-root[contenteditable="true"]',
          'div#contenteditable-textarea[contenteditable="true"]',
          'ytd-comments [contenteditable="true"]',
          'tp-yt-paper-input-container [contenteditable="true"]',
          '#comment-simplebox [contenteditable="true"]',
        ],
        submitButtons: [
          'ytd-commentbox #submit-button button',
          'ytd-commentbox #submit-button',
          'ytd-commentbox yt-button-renderer#submit-button',
          'ytd-button-renderer#submit-button button',
          '#submit-button button',
          '#comments #submit-button button',
          '#submit-button',
        ],
        threadContext: {
          title: ['h1.ytd-watch-metadata yt-formatted-string', '#title h1', 'h1.title', 'ytd-watch-flexy h1'],
          body: ['ytd-expandable-video-description-body-renderer', '#description-inline-expander', '#description', '#snippet'],
          author: ['ytd-channel-name a', '#channel-name a', '#owner-sub-count'],
        },
      },
      reddit: {
        hosts: ['reddit.com'],
        badgeText: 'Context: 💬 Reddit Comment',
        placeholders: [],
        composers: [
          'shreddit-comment-composer div[role="textbox"]',
          'div[role="textbox"][contenteditable="true"]',
          'shreddit-async-loader [contenteditable="true"]',
          'shreddit-composer div[contenteditable="true"]',
          'textarea[name="comment"]',
          'div[data-testid="comment-composer"] [contenteditable="true"]',
          'shreddit-comment-composer textarea',
        ],
        submitButtons: [
          'shreddit-comment-composer button[type="submit"]',
          'shreddit-comment-composer [slot="submit-button"]',
          'button.comment-submit-button',
          'button[slot="submit-button"]',
          'button[type="submit"]',
        ],
        threadContext: {
          title: ['h1', '[slot="title"]', 'shreddit-post [slot="title"]', '.post-title'],
          body: ['div[id*="-post-rtjson-content"]', '[slot="text-body"]', 'shreddit-post [slot="text-body"]', 'div.entry div.usertext-body'],
          author: ['shreddit-post [slot="authorName"]', 'a[href*="/user/"]', '[data-testid="post_author"]'],
        },
      },
      twitter: {
        hosts: ['twitter.com', 'x.com'],
        badgeText: 'Context: 🐦 X/Twitter Reply',
        placeholders: [
          'div[data-testid="tweetTextarea_0"]',
          'div[data-testid="tweetTextarea_0_placeholder"]',
          'div[role="textbox"][data-testid*="tweet" i]',
          'div[data-testid="inline_reply"]',
          'div[aria-label*="Post text" i]',
          'div[aria-label*="Reply" i]',
        ],
        composers: [
          '.public-DraftEditor-content[contenteditable="true"]',
          'div[data-testid="tweetTextarea_0"] [contenteditable="true"]',
          'div[data-testid="tweetTextarea_0"]',
          'div[data-testid="tweetTextarea_1"]',
          'div[role="textbox"][data-testid*="tweet" i]',
          'div[aria-label*="Post text" i][role="textbox"]',
          'div[aria-label*="Reply" i][role="textbox"]',
          '.public-DraftEditor-content',
          'div[data-contents="true"]',
        ],
        submitButtons: [
          'button[data-testid="tweetButtonInline"]',
          'button[data-testid="tweetButton"]',
          'div[data-testid="tweetButtonInline"]',
          'div[data-testid="tweetButton"]',
        ],
        threadContext: {
          title: ['article[data-testid="tweet"] [data-testid="tweetText"]'],
          body: ['article div[data-testid="tweetText"]'],
          author: ['article[data-testid="tweet"] [data-testid="User-Name"]'],
        },
      },
      pinterest: {
        hosts: ['pinterest.com'],
        badgeText: 'Context: 📌 Pinterest Comment',
        placeholders: [
          '[data-test-id="activity-item-text-box"]',
          '[data-test-id*="comment-input" i]',
          '[data-test-id*="comment" i][role="button"]',
          'div[role="button"][aria-label*="comment" i]',
          'button[aria-label*="comment" i]',
          'div[data-test-id="rich-comment-box"]',
          'div[data-test-id="editor-input"]',
        ],
        composers: [
          '[data-test-id="activity-item-text-box"] [contenteditable="true"]',
          '[data-test-id="rich-comment-box"] [contenteditable="true"]',
          'div[contenteditable="true"][data-test-id*="comment" i]',
          '[data-test-id="comment-input"] [contenteditable="true"]',
          '[data-test-id="comment-input"]',
          'div[role="textbox"][data-test-id*="comment" i]',
          'div[contenteditable="true"][aria-label*="comment" i]',
          'textarea[aria-label*="comment" i]',
          'div[contenteditable="true"][role="textbox"]',
        ],
        submitButtons: [
          'button[data-test-id="activity-item-submit-button"]',
          '[data-test-id="activity-item-submit-button"] button',
          'button[type="submit"][aria-label*="comment" i]',
          '[data-test-id="activity-item-submit-button"]',
        ],
        threadContext: {
          title: ['h1', '[data-test-id="pin-title"]'],
          body: ['[data-test-id="pin-description"]', 'div[data-test-id*="description"]'],
          author: [],
        },
      },
      instagram: {
        hosts: ['instagram.com'],
        badgeText: 'Context: 📷 Instagram Comment',
        placeholders: [],
        composers: [
          'form textarea[aria-label*="Add a comment" i]',
          'textarea[aria-label*="Add a comment" i]',
          'textarea[aria-label*="comment" i]',
          '[data-testid="post-comment-input-textarea"]',
          'div[role="textbox"][aria-label*="comment" i]',
          'form textarea',
        ],
        submitButtons: [
          'form button[type="submit"]',
          'form div[role="button"][tabindex="0"]',
        ],
      },
      linkedin: {
        hosts: ['linkedin.com'],
        badgeText: 'Context: 💼 LinkedIn Comment',
        placeholders: [],
        composers: [
          '.comments-comment-box__editor [contenteditable="true"]',
          '.comments-comment-box__editor',
          'div[role="textbox"][aria-label*="comment" i]',
          'div.share-creation-state__text-editor [contenteditable="true"]',
          '.ql-editor',
        ],
        submitButtons: [
          'button.comments-comment-box__submit-button',
          'button.msg-form__send-button',
          'button.comments-comment-box__submit-button--cr',
        ],
        threadContext: {
          title: ['.feed-shared-update-v2__description', 'div.update-components-text'],
          body: ['.feed-shared-update-v2__description', 'div.update-components-text'],
          author: ['.update-components-actor__name'],
        },
      },
      tiktok: {
        hosts: ['tiktok.com'],
        badgeText: 'Context: 🎵 TikTok Comment',
        composers: [
          'div[data-e2e="comment-input"] [contenteditable="true"]',
          'div[contenteditable="true"][data-e2e="comment-input"]',
          'div[role="textbox"][data-e2e*="comment" i]',
        ],
        submitButtons: [
          'div[data-e2e="comment-post"]',
          'button[data-e2e="comment-post"]',
        ],
      },
      threads: {
        hosts: ['threads.net'],
        badgeText: 'Context: 🧵 Threads Reply',
        composers: [
          'div[data-testid*="composer" i] [contenteditable="true"]',
          'div[aria-label*="Reply" i][contenteditable="true"]',
        ],
        submitButtons: [
          'div[role="button"]:has(span)',
          'button[type="submit"]',
        ],
      },
      bluesky: {
        hosts: ['bsky.app', 'blueskyweb.xyz'],
        badgeText: 'Context: 🦋 Bluesky Reply',
        composers: [
          'div[data-testid="composerTextInput"] [contenteditable="true"]',
          'div[data-testid="composerTextInput"]',
          'div[data-testid="postComposerTextInput"]',
        ],
        submitButtons: ['button[data-testid="composerPublishBtn"]', 'button[type="submit"]'],
      },
      quora: {
        hosts: ['quora.com'],
        badgeText: 'Context: ❓ Quora Answer',
        composers: ['div.q-box[contenteditable="true"]', 'div.doc.inline_editor_content'],
        submitButtons: ['button[type="submit"]'],
      },
      facebook: {
        hosts: ['facebook.com'],
        badgeText: 'Context: 💬 Facebook Comment',
        composers: [
          'div[role="textbox"][aria-label*="Write a comment" i]',
          'div[role="textbox"][aria-label*="Write an answer" i]',
          'div[role="textbox"][aria-label*="Write a reply" i]',
          'div[role="textbox"][contenteditable="true"]',
        ],
        submitButtons: ['div[aria-label*="Comment" i][role="button"]', 'button[type="submit"]'],
      },
      disqus: {
        hosts: ['disqus.com'],
        badgeText: 'Context: 💬 Disqus Comment',
        composers: ['#message', '#post-message', '.textarea-wrapper [contenteditable="true"]', 'textarea.textarea'],
        submitButtons: ['button[type="submit"]'],
      },
    },
    webmail: {
      gmail: {
        hosts: ['mail.google.com'],
        subject: ['input[name="subjectbox"]', 'input[placeholder="Subject"]', 'input[aria-label="Subject"]'],
        body: ['div[role="textbox"][aria-label*="Body" i]', 'div[aria-label="Message Body" i]', 'div[role="textbox"]'],
      },
      outlook: {
        hosts: ['outlook.live.com', 'outlook.office.com', 'outlook.office365.com'],
        subject: ['input[aria-label*="Add a subject" i]', 'input[aria-label*="Subject" i]', 'input[placeholder*="subject" i]'],
        body: ['div[role="textbox"][aria-label*="Message body" i]', 'div[contenteditable="true"]'],
      },
      yahoo: {
        hosts: ['mail.yahoo.com'],
        subject: ['input[data-test-id="compose-subject"]', 'input[placeholder*="Subject" i]'],
        body: ['div[data-test-id="rte"]', 'div[role="textbox"]'],
      },
    },
    dm: {
      twitter: {
        hosts: ['twitter.com', 'x.com'],
        pathIncludes: '/messages',
        composers: ['[data-testid="dmComposerTextInput"]', 'div[role="textbox"][data-testid*="dm" i]'],
      },
      linkedin: {
        hosts: ['linkedin.com'],
        pathIncludes: '/messaging',
        composers: ['.msg-form__contenteditable', 'div[role="textbox"][aria-label*="Write a message" i]', 'div[role="textbox"][aria-label*="message" i]'],
      },
      instagram: {
        hosts: ['instagram.com'],
        pathIncludes: '/direct',
        composers: ['div[role="textbox"][aria-label*="Message" i]', 'textarea[placeholder*="Message" i]'],
      },
    },
    directoryDetection: {
      knownHosts: [
        'producthunt.com',
        'saashub.com',
        'theresanaiforthat.com',
        'toolify.ai',
        'futurepedia.io',
        'betalist.com',
        'startupstash.com',
        'uneed.best',
        'indiehackers.com',
        'alternativeto.net',
      ],
    },
  };
}

export function getWorkspaceRandomnessDicts(tier: 'basic' | 'pro'): string {
  if (tier !== 'pro') {
    return `(app | tool | platform)\n(quick | fast | rapid)`;
  }
  return `(app | tool | platform | software | utility)
(founders | builders | creators | entrepreneurs | developers)
(great | awesome | solid | fantastic | incredible)
(quick | fast | rapid | instant)
(laptop | mac | desktop | computer)
(workflow | process | pipeline | setup)`;
}

export interface ExtensionRelease {
  id: string;
  version: string;
  title: string;
  summary: string;
  download_url: string;
  file_size: string;
  is_latest: boolean;
  released_at: string;
}

export interface ChangelogEntry {
  id: string;
  version: string;
  title: string;
  category: 'feature' | 'improvement' | 'fix';
  description: string;
  published_at: string;
}

export function getDefaultReleases(): ExtensionRelease[] {
  return [
    {
      id: 'rel-v1-3-0',
      version: 'v1.3.0',
      title: 'Smart Poster v1.3.0 (Latest)',
      summary: 'Smart Context Detection across social/DM/article/webmail/directory/contact pages, starred & draggable comment ordering, campaign-aware AI rewriting, and synced User Dashboard.',
      download_url: '/api/download/extension?version=v1.3.0',
      file_size: '~522 KB',
      is_latest: true,
      released_at: '2026-11-14T08:05:25.008Z',
    },
    {
      id: 'rel-v1-2-0',
      version: 'v1.2.0',
      title: 'Smart Poster v1.2.0',
      summary: 'Supabase Cloud Sync, Google OAuth login, 3+3 AI reply generation (Organic, Trojan Bridge, Direct Promo), and Anti-Ban preflight protection.',
      download_url: '/api/download/extension?version=v1.2.0',
      file_size: '~500 KB',
      is_latest: false,
      released_at: '2026-09-18T10:00:00.000Z',
    },
    {
      id: 'rel-v1-1-0',
      version: 'v1.1.0',
      title: 'Smart Poster v1.1.0',
      summary: 'Multi-Platform Keyword Radar, 1-click Opportunity Queue launcher, Twitter clean domain rule, and domain/thread suppression lists.',
      download_url: '/api/download/extension?version=v1.1.0',
      file_size: '~470 KB',
      is_latest: false,
      released_at: '2026-08-05T10:00:00.000Z',
    },
    {
      id: 'rel-v1-0-0',
      version: 'v1.0.0',
      title: 'Smart Poster v1.0.0',
      summary: 'Initial Manifest V3 Universal Side Panel with multi-length directory form filler, contact form automation, and local campaign profiles.',
      download_url: '/api/download/extension?version=v1.0.0',
      file_size: '~420 KB',
      is_latest: false,
      released_at: '2026-06-20T10:00:00.000Z',
    },
  ];
}

export function getDefaultChangelog(): ChangelogEntry[] {
  return [
    {
      id: 'chg-130-ai-assistant',
      version: 'v1.3.0',
      title: 'AI Assistant Upgrade: Full Marketing Content Creator',
      category: 'feature',
      description: 'Upgraded the AI Assistant into a versatile content creator and marketing copy generator. Beyond filling SmartPoster modules, use it to brainstorm campaigns, scan reference pages, and craft promotional copy, social threads, emails, and marketing assets for your entire business.',
      published_at: '2026-11-14T08:05:25.008Z',
    },
    {
      id: 'chg-130-images-gallery',
      version: 'v1.3.0',
      title: 'Dedicated Promotional Images Gallery',
      category: 'feature',
      description: 'Save, label, and organize promotional banners, product screenshots, and marketing creatives in a dedicated per-campaign Gallery—synced between the Dashboard and Chrome Extension for instant drag-and-drop onto any webpage.',
      published_at: '2026-11-13T15:30:00.000Z',
    },
    {
      id: 'chg-130-comment-priority',
      version: 'v1.3.0',
      title: 'Comment Favorites (Starring) & Drag-and-Drop Priority Reordering',
      category: 'feature',
      description: 'Star your top-converting comment variations to keep favorites pinned at the top, and drag-and-drop to reorder your comment list by priority with automatic sequential numbering.',
      published_at: '2026-11-11T16:45:00.000Z',
    },
    {
      id: 'chg-130-velocity-guard',
      version: 'v1.3.0',
      title: 'Anti-Ban Velocity Tracker & Rolling Hourly Guard',
      category: 'feature',
      description: 'Live per-platform daily counters and rolling 60-minute rate monitoring (SAFE, CAUTION, SLOW DOWN) built directly into the extension to help prevent shadowbans and spam flags during outreach sessions.',
      published_at: '2026-11-09T14:20:00.000Z',
    },
    {
      id: 'chg-130-single-pass-editors',
      version: 'v1.3.0',
      title: 'Reliable Single-Pass Insertion for X (Twitter) & Modern Rich-Text Editors',
      category: 'fix',
      description: 'Resolved duplicate/undeletable text issues in X/Twitter Draft.js and modern editors (Pinterest, YouTube, Reddit, LinkedIn), and added automatic scroll-and-highlight guidance straight to the native Reply/Post button.',
      published_at: '2026-11-07T11:10:00.000Z',
    },
    {
      id: 'chg-130-cloud-vault',
      version: 'v1.3.0',
      title: 'Cross-Device Cloud Sync & Media Asset Vault',
      category: 'feature',
      description: 'Sync your campaigns, uploaded logos/favicons/screenshots, comment images, suppression lists, and posting rules automatically across devices when signed in with Google.',
      published_at: '2026-11-05T17:00:00.000Z',
    },
    {
      id: 'chg-130-dashboard',
      version: 'v1.3.0',
      title: 'Full-Screen Left-Hand User Dashboard',
      category: 'feature',
      description: 'Edit campaigns, review reports, configure AI settings, browse the Admin-curated Directory Database, download releases, and review release notes in a full-width browser workspace synced directly with your Chrome Side Panel.',
      published_at: '2026-11-03T13:15:00.000Z',
    },
    {
      id: 'chg-130-research',
      version: 'v1.3.0',
      title: 'Research & Automated Competitor Alerts (Zero API Keys)',
      category: 'feature',
      description: 'Keywords is now Research! Track brand keywords and competitors with automatic high-intent phrases ("Alternative to X", "Best alternative to X"), instant native feed polling, and 1-click Google Alerts RSS capture.',
      published_at: '2026-11-02T10:30:00.000Z',
    },
    {
      id: 'chg-130-dir-bookmarks',
      version: 'v1.3.0',
      title: 'Directory Table Bookmarks & Custom User Directories',
      category: 'feature',
      description: 'Browse all Admin-managed directories in a sortable table, star favorites for quick access, and add your own custom directories.',
      published_at: '2026-11-01T09:45:00.000Z',
    },
    {
      id: 'chg-120-twitter-fix',
      version: 'v1.2.0',
      title: 'Twitter / X Clean Domain Formatting Fix',
      category: 'fix',
      description: 'Fixed duplicate URL glitches on X/Twitter replies by automatically formatting links cleanly without protocol prefixes when enabled in Posting Rules.',
      published_at: '2026-09-18T10:00:00.000Z',
    },
  ];
}

export async function loadReleasesFromEnv(env: any): Promise<{ items: ExtensionRelease[]; source: string }> {
  const { url, anonKey, serviceKey } = getSupabaseCreds(env);
  const key = serviceKey || anonKey;
  if (url && key) {
    try {
      const res = await fetch(`${url}/rest/v1/extension_releases?select=*&order=released_at.desc`, {
        headers: { apikey: key, Authorization: `Bearer ${key}` },
      });
      if (res.ok) {
        const rows = await res.json();
        if (Array.isArray(rows) && rows.length > 0) {
          return { items: rows, source: 'supabase' };
        }
      }
    } catch {
      // Fallback to built-in releases
    }
  }
  return { items: getDefaultReleases(), source: 'default' };
}

export async function loadChangelogFromEnv(env: any): Promise<{ items: ChangelogEntry[]; source: string }> {
  const { url, anonKey, serviceKey } = getSupabaseCreds(env);
  const key = serviceKey || anonKey;
  if (url && key) {
    try {
      const res = await fetch(`${url}/rest/v1/changelog_entries?select=*&order=published_at.desc`, {
        headers: { apikey: key, Authorization: `Bearer ${key}` },
      });
      if (res.ok) {
        const rows = await res.json();
        if (Array.isArray(rows) && rows.length > 0) {
          return { items: rows, source: 'supabase' };
        }
      }
    } catch {
      // Fallback to built-in changelog
    }
  }
  return { items: getDefaultChangelog(), source: 'default' };
}
