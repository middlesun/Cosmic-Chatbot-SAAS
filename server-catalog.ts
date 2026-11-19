import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const LOCAL_STORE_PATH = path.join(__dirname, '.smartposter-catalog-store.json');

export interface DirectoryEntry {
  id: string;
  name: string;
  url: string;
  tags: string[];
  category?: string;
  domain_rating: number;
  description: string;
  pricing_type?: string;
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

export interface UserWorkspacePrefs {
  user_id: string;
  bookmarked_directory_ids: string[];
  custom_directories: any[];
  research_config: Record<string, any>;
  updated_at: string;
}

export interface UserCloudStatePayload {
  brands?: any[];
  deletedBrandIds?: string[];
  userSettings?: Record<string, any> | null;
  completedUrls?: Record<string, any>;
  deletedCompletedIds?: string[];
  clearCompletedUrls?: boolean;
  workspacePrefs?: {
    bookmarked_directory_ids?: string[];
    custom_directories?: any[];
    research_config?: Record<string, any>;
    updated_at?: string;
  };
  masterLogs?: any[];
  errorLogs?: any[];
  clearMasterLogs?: boolean;
  clearErrorLogs?: boolean;
}

export interface UserCloudStateRecord {
  brands: any[];
  deletedBrandTombstones: Record<string, string>;
  userSettings: Record<string, any> | null;
  completedUrls: Record<string, any>;
  workspacePrefs: UserWorkspacePrefs;
  masterLogs: any[];
  errorLogs: any[];
  updatedAt: string;
}

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
      pricing_type: 'free',
      is_active: true,
      created_at: now,
      updated_at: now,
    })),
  ];
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

export function buildDirectoryListsByCategory(items: DirectoryEntry[]): Record<string, Array<{ id: string; name: string; dr: string; desc: string; url: string; tags: string[] }>> {
  const grouped: Record<string, Array<{ id: string; name: string; dr: string; desc: string; url: string; tags: string[] }>> = {};
  for (const item of items) {
    const tags = normalizeDirectoryTags(item.tags);
    const cat = (item.category || tags[0] || 'general').trim().toLowerCase();
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push({
      id: item.id,
      name: item.name,
      dr: `DR ${Number(item.domain_rating || 0)}`,
      desc: item.description || '',
      url: item.url,
      tags,
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
        hosts: ['threads.net', 'threads.com'],
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
        hosts: ['facebook.com', 'fb.com'],
        badgeText: 'Context: 💬 Facebook Comment',
        composers: [
          'div[role="textbox"][aria-label*="Write a comment" i]',
          'div[role="textbox"][aria-label*="Write an answer" i]',
          'div[role="textbox"][aria-label*="Write a reply" i]',
          'div[role="textbox"][contenteditable="true"]',
        ],
        submitButtons: ['div[aria-label*="Comment" i][role="button"]', 'button[type="submit"]'],
      },
      medium: {
        hosts: ['medium.com'],
        badgeText: 'Context: 📝 Medium Comment',
        composers: [
          'div[role="textbox"][aria-label*="response" i]',
          'div[data-testid="response-editor"] [contenteditable="true"]',
          'div[contenteditable="true"][aria-placeholder*="What are your thoughts" i]',
          'div[role="textbox"]',
        ],
        submitButtons: ['button[data-testid="ResponseSubmitButton"]', 'button[type="submit"]'],
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
        body: ['div[role="textbox"][aria-label*="Message Body" i]', 'div[aria-label="Message Body" i]', 'div.Am.Al.editable[role="textbox"]'],
      },
      outlook: {
        hosts: ['outlook.live.com', 'outlook.office.com', 'outlook.office365.com', 'outlook.cloud.microsoft'],
        subject: ['input[aria-label*="Add a subject" i]', 'input[aria-label*="Subject" i]', 'input[placeholder*="subject" i]'],
        body: ['div[role="textbox"][aria-label*="Message body" i]', 'div[aria-label*="Message body" i][contenteditable="true"]'],
      },
      yahoo: {
        hosts: ['mail.yahoo.com'],
        subject: ['input[data-test-id="compose-subject"]', 'input[placeholder*="Subject" i]'],
        body: ['div[data-test-id="rte"]', 'div[data-test-id="rte"] [contenteditable="true"]'],
      },
    },
    dm: {
      twitter: {
        hosts: ['twitter.com', 'x.com'],
        pathIncludes: '/messages',
        composers: ['[data-testid="dmComposerTextInput"]', 'div[role="textbox"][data-testid*="dm" i]'],
      },
      facebook: {
        hosts: ['messenger.com', 'facebook.com', 'fb.com'],
        pathIncludes: '/messages',
        composers: ['div[role="textbox"][aria-label*="Message" i]', 'div[role="textbox"][aria-label*="Aa" i]'],
      },
      linkedin: {
        hosts: ['linkedin.com'],
        pathIncludes: '/messaging',
        composers: ['.msg-form__contenteditable', 'div[role="textbox"][aria-label*="Write a message" i]'],
      },
      instagram: {
        hosts: ['instagram.com'],
        pathIncludes: '/direct',
        composers: ['div[role="textbox"][aria-label*="Message" i]', 'textarea[placeholder*="Message" i]'],
      },
      pinterest: {
        hosts: ['pinterest.com'],
        pathIncludes: '/messages',
        composers: ['textarea[placeholder*="message" i]', 'div[role="textbox"][aria-label*="message" i]'],
      },
      tiktok: {
        hosts: ['tiktok.com'],
        pathIncludes: '/messages',
        composers: ['div[data-e2e="message-input"] [contenteditable="true"]', 'div[contenteditable="true"][placeholder*="Send a message" i]'],
      },
      reddit: {
        hosts: ['reddit.com', 'chat.reddit.com'],
        pathIncludes: '/message/compose',
        composers: ['textarea[aria-label*="message" i]', 'div[contenteditable="true"][aria-label*="message" i]'],
      },
      quora: {
        hosts: ['quora.com'],
        pathIncludes: '/messages',
        composers: ['div[contenteditable="true"][aria-label*="message" i]', 'textarea[placeholder*="message" i]'],
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
        'g2.com',
        'capterra.com',
        'getapp.com',
        'softwaresuggest.com',
        'launchingnext.com',
        'microlaunch.net',
        'tinystartups.com',
        'aitoolsdirectory.com',
        'topai.tools',
        'aidirectory.org',
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
      released_at: new Date().toISOString(),
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

interface LocalStore {
  directories: DirectoryEntry[];
  releases: ExtensionRelease[];
  changelog: ChangelogEntry[];
  workspacePrefs: Record<string, UserWorkspacePrefs>;
  userCloudState?: Record<string, UserCloudStateRecord>;
  extensionVaults?: Record<string, ExtensionVaultRecord>;
}

export interface ExtensionVaultRecord {
  vaultId: string;
  snapshot: Record<string, any>;
  updatedAt: string;
}

function readLocalStore(): LocalStore {
  try {
    if (fs.existsSync(LOCAL_STORE_PATH)) {
      const raw = fs.readFileSync(LOCAL_STORE_PATH, 'utf-8');
      const parsed = JSON.parse(raw);
      return {
        directories: Array.isArray(parsed.directories) && parsed.directories.length ? parsed.directories : getDefaultDirectories(),
        releases: Array.isArray(parsed.releases) && parsed.releases.length ? parsed.releases : getDefaultReleases(),
        changelog: Array.isArray(parsed.changelog) && parsed.changelog.length ? parsed.changelog : getDefaultChangelog(),
        workspacePrefs: parsed.workspacePrefs && typeof parsed.workspacePrefs === 'object' ? parsed.workspacePrefs : {},
        userCloudState: parsed.userCloudState && typeof parsed.userCloudState === 'object' ? parsed.userCloudState : {},
        extensionVaults: parsed.extensionVaults && typeof parsed.extensionVaults === 'object' ? parsed.extensionVaults : {},
      };
    }
  } catch (err) {
    console.warn('[CatalogStore] Failed reading local store:', err);
  }
  return {
    directories: getDefaultDirectories(),
    releases: getDefaultReleases(),
    changelog: getDefaultChangelog(),
    workspacePrefs: {},
    userCloudState: {},
    extensionVaults: {},
  };
}

function writeLocalStore(store: LocalStore) {
  try {
    fs.writeFileSync(LOCAL_STORE_PATH, JSON.stringify(store, null, 2), 'utf-8');
  } catch (err) {
    console.warn('[CatalogStore] Failed writing local store:', err);
  }
}

function getSupabaseCreds() {
  const rawUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
  const url = rawUrl.trim().replace(/\/+$/, '');
  const key = (
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KE ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    ''
  ).trim();
  return { url, key, configured: Boolean(url && key) };
}

// ==========================================
// DIRECTORIES CRUD
// ==========================================
function normalizeDirectoryRow(row: any): DirectoryEntry {
  const rawTags = normalizeDirectoryTags(row?.tags);
  const fallbackTags = rawTags.length > 0 ? rawTags : (row?.category && row.category !== 'general' ? [String(row.category)] : []);
  return {
    id: String(row?.id || ''),
    name: String(row?.name || 'Untitled Directory'),
    url: String(row?.url || ''),
    tags: fallbackTags,
    category: row?.category || 'general',
    domain_rating: Number(row?.domain_rating ?? 70) || 0,
    description: String(row?.description || ''),
    pricing_type: row?.pricing_type || 'free',
    is_active: row?.is_active !== false,
    created_at: String(row?.created_at || new Date().toISOString()),
    updated_at: String(row?.updated_at || new Date().toISOString()),
  };
}

export async function loadDirectories(includeInactive = false): Promise<{ items: DirectoryEntry[]; source: string }> {
  const { url, key, configured } = getSupabaseCreds();
  if (configured) {
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
        // Auto-seed defaults into Supabase if table is empty
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
    } catch (err) {
      console.warn('[Directories] Supabase load fallback:', err);
    }
  }
  const store = readLocalStore();
  const localIds = new Set(store.directories.map((d) => String(d?.id || '')));
  const localUrls = new Set(store.directories.map((d) => String(d?.url || '').trim().toLowerCase().replace(/\/+$/, '')));
  const missingLocal = getDefaultDirectories().filter(
    (d) =>
      BULK_DOMAIN_DIRECTORY_ID_SET.has(d.id) &&
      !localIds.has(d.id) &&
      !localUrls.has(String(d.url || '').trim().toLowerCase().replace(/\/+$/, ''))
  );
  if (missingLocal.length > 0) {
    store.directories.push(...missingLocal);
    writeLocalStore(store);
  }
  const rawItems = includeInactive ? store.directories : store.directories.filter((d) => d.is_active !== false);
  return { items: rawItems.map(normalizeDirectoryRow), source: 'local' };
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

export async function upsertDirectory(input: Partial<DirectoryEntry>): Promise<{ item: DirectoryEntry; source: string }> {
  const item = buildDirectoryEntryForSave(input) || {
    id: (input.id || `dir-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`).trim(),
    name: (input.name || 'Untitled Directory').trim(),
    url: (input.url || '').trim(),
    tags: normalizeDirectoryTags(input.tags),
    category: 'general',
    domain_rating: Math.max(0, Math.min(100, Number(input.domain_rating ?? 70) || 0)),
    description: (input.description || '').trim(),
    pricing_type: 'free',
    is_active: input.is_active !== false,
    created_at: input.created_at || new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const { url, key, configured } = getSupabaseCreds();
  if (configured) {
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
    } catch (err) {
      console.warn('[Directories] Supabase upsert fallback:', err);
    }
  }

  const store = readLocalStore();
  const idx = store.directories.findIndex((d) => d.id === item.id);
  if (idx >= 0) {
    item.created_at = store.directories[idx].created_at || item.created_at;
    store.directories[idx] = item;
  } else {
    store.directories.unshift(item);
  }
  writeLocalStore(store);
  return { item, source: 'local' };
}

export async function upsertDirectoriesBulk(inputs: Array<Partial<DirectoryEntry>>): Promise<{ items: DirectoryEntry[]; source: string }> {
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

  const { url, key, configured } = getSupabaseCreds();
  if (configured) {
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
    } catch (err) {
      console.warn('[Directories] Supabase bulk upsert fallback:', err);
    }
  }

  const store = readLocalStore();
  const existingUrlMap = new Map<string, number>();
  store.directories.forEach((d, i) => {
    existingUrlMap.set(String(d.url || '').toLowerCase().replace(/\/+$/, ''), i);
  });

  for (const item of [...built].reverse()) {
    const urlKey = item.url.toLowerCase().replace(/\/+$/, '');
    const existingIdx = existingUrlMap.get(urlKey);
    if (existingIdx !== undefined) {
      item.id = store.directories[existingIdx].id;
      item.created_at = store.directories[existingIdx].created_at || item.created_at;
      store.directories[existingIdx] = item;
    } else {
      store.directories.unshift(item);
    }
  }
  writeLocalStore(store);
  return { items: built, source: 'local' };
}

export async function deleteDirectory(id: string): Promise<boolean> {
  const { url, key, configured } = getSupabaseCreds();
  if (configured) {
    try {
      const res = await fetch(`${url}/rest/v1/directories?id=eq.${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: { apikey: key, Authorization: `Bearer ${key}` },
      });
      if (res.ok) return true;
    } catch (err) {
      console.warn('[Directories] Supabase delete fallback:', err);
    }
  }
  const store = readLocalStore();
  store.directories = store.directories.filter((d) => d.id !== id);
  writeLocalStore(store);
  return true;
}

// ==========================================
// EXTENSION RELEASES CRUD
// ==========================================
export async function loadReleases(): Promise<{ items: ExtensionRelease[]; source: string }> {
  const { url, key, configured } = getSupabaseCreds();
  if (configured) {
    try {
      const res = await fetch(`${url}/rest/v1/extension_releases?select=*&order=released_at.desc`, {
        headers: { apikey: key, Authorization: `Bearer ${key}` },
      });
      if (res.ok) {
        const rows = await res.json();
        if (Array.isArray(rows) && rows.length > 0) {
          return { items: rows, source: 'supabase' };
        }
        const defaults = getDefaultReleases();
        await fetch(`${url}/rest/v1/extension_releases`, {
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
    } catch (err) {
      console.warn('[Releases] Supabase load fallback:', err);
    }
  }
  const store = readLocalStore();
  const items = [...store.releases].sort((a, b) => new Date(b.released_at).getTime() - new Date(a.released_at).getTime());
  return { items, source: 'local' };
}

export async function upsertRelease(input: Partial<ExtensionRelease>): Promise<{ item: ExtensionRelease; source: string }> {
  const now = new Date().toISOString();
  const versionClean = (input.version || 'v1.3.0').trim();
  const id = (input.id || `rel-${versionClean.replace(/[^a-zA-Z0-9._-]/g, '-')}`).trim();
  const item: ExtensionRelease = {
    id,
    version: versionClean,
    title: (input.title || `Smart Poster ${versionClean}`).trim(),
    summary: (input.summary || '').trim(),
    download_url: (input.download_url || `/api/download/extension?version=${encodeURIComponent(versionClean)}`).trim(),
    file_size: (input.file_size || '~520 KB').trim(),
    is_latest: Boolean(input.is_latest),
    released_at: input.released_at || now,
  };

  const { url, key, configured } = getSupabaseCreds();
  if (configured) {
    try {
      if (item.is_latest) {
        await fetch(`${url}/rest/v1/extension_releases?id=neq.${encodeURIComponent(item.id)}`, {
          method: 'PATCH',
          headers: {
            apikey: key,
            Authorization: `Bearer ${key}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ is_latest: false }),
        }).catch(() => {});
      }
      const res = await fetch(`${url}/rest/v1/extension_releases`, {
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
        return { item: rows?.[0] || item, source: 'supabase' };
      }
    } catch (err) {
      console.warn('[Releases] Supabase upsert fallback:', err);
    }
  }

  const store = readLocalStore();
  if (item.is_latest) {
    store.releases = store.releases.map((r) => ({ ...r, is_latest: false }));
  }
  const idx = store.releases.findIndex((r) => r.id === item.id);
  if (idx >= 0) {
    store.releases[idx] = item;
  } else {
    store.releases.unshift(item);
  }
  writeLocalStore(store);
  return { item, source: 'local' };
}

export async function deleteRelease(id: string): Promise<boolean> {
  const { url, key, configured } = getSupabaseCreds();
  if (configured) {
    try {
      const res = await fetch(`${url}/rest/v1/extension_releases?id=eq.${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: { apikey: key, Authorization: `Bearer ${key}` },
      });
      if (res.ok) return true;
    } catch (err) {
      console.warn('[Releases] Supabase delete fallback:', err);
    }
  }
  const store = readLocalStore();
  store.releases = store.releases.filter((r) => r.id !== id);
  writeLocalStore(store);
  return true;
}

// ==========================================
// CHANGELOG / NEW FEATURES CRUD
// ==========================================
export async function loadChangelog(): Promise<{ items: ChangelogEntry[]; source: string }> {
  const { url, key, configured } = getSupabaseCreds();
  if (configured) {
    try {
      const res = await fetch(`${url}/rest/v1/changelog_entries?select=*&order=published_at.desc`, {
        headers: { apikey: key, Authorization: `Bearer ${key}` },
      });
      if (res.ok) {
        const rows = await res.json();
        if (Array.isArray(rows) && rows.length > 0) {
          return { items: rows, source: 'supabase' };
        }
        const defaults = getDefaultChangelog();
        await fetch(`${url}/rest/v1/changelog_entries`, {
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
    } catch (err) {
      console.warn('[Changelog] Supabase load fallback:', err);
    }
  }
  const store = readLocalStore();
  const items = [...store.changelog].sort((a, b) => new Date(b.published_at).getTime() - new Date(a.published_at).getTime());
  return { items, source: 'local' };
}

export async function upsertChangelog(input: Partial<ChangelogEntry>): Promise<{ item: ChangelogEntry; source: string }> {
  const now = new Date().toISOString();
  const id = (input.id || `chg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`).trim();
  const category = ['feature', 'improvement', 'fix'].includes(String(input.category)) ? (input.category as 'feature' | 'improvement' | 'fix') : 'feature';
  const item: ChangelogEntry = {
    id,
    version: (input.version || 'v1.3.0').trim(),
    title: (input.title || 'New Feature').trim(),
    category,
    description: (input.description || '').trim(),
    published_at: input.published_at || now,
  };

  const { url, key, configured } = getSupabaseCreds();
  if (configured) {
    try {
      const res = await fetch(`${url}/rest/v1/changelog_entries`, {
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
        return { item: rows?.[0] || item, source: 'supabase' };
      }
    } catch (err) {
      console.warn('[Changelog] Supabase upsert fallback:', err);
    }
  }

  const store = readLocalStore();
  const idx = store.changelog.findIndex((c) => c.id === item.id);
  if (idx >= 0) {
    store.changelog[idx] = item;
  } else {
    store.changelog.unshift(item);
  }
  writeLocalStore(store);
  return { item, source: 'local' };
}

export async function deleteChangelog(id: string): Promise<boolean> {
  const { url, key, configured } = getSupabaseCreds();
  if (configured) {
    try {
      const res = await fetch(`${url}/rest/v1/changelog_entries?id=eq.${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: { apikey: key, Authorization: `Bearer ${key}` },
      });
      if (res.ok) return true;
    } catch (err) {
      console.warn('[Changelog] Supabase delete fallback:', err);
    }
  }
  const store = readLocalStore();
  store.changelog = store.changelog.filter((c) => c.id !== id);
  writeLocalStore(store);
  return true;
}

// ==========================================
// USER WORKSPACE PREFS (Bookmarks, Custom Dirs, Research Config)
// ==========================================
export async function loadUserWorkspacePrefs(userId: string, userToken?: string): Promise<UserWorkspacePrefs> {
  const empty: UserWorkspacePrefs = {
    user_id: userId,
    bookmarked_directory_ids: [],
    custom_directories: [],
    research_config: {},
    updated_at: new Date().toISOString(),
  };
  if (!userId) return empty;

  const { url, key, configured } = getSupabaseCreds();
  if (configured) {
    try {
      const authHeader = userToken ? `Bearer ${userToken}` : `Bearer ${key}`;
      const res = await fetch(`${url}/rest/v1/user_workspace_prefs?user_id=eq.${encodeURIComponent(userId)}&select=*`, {
        headers: { apikey: key, Authorization: authHeader },
      });
      if (res.ok) {
        const rows = await res.json();
        if (Array.isArray(rows) && rows[0]) {
          return rows[0];
        }
      }
    } catch (err) {
      console.warn('[WorkspacePrefs] Supabase load fallback:', err);
    }
  }

  const store = readLocalStore();
  return store.workspacePrefs[userId] || empty;
}

const DEFAULT_RESEARCH_PLATFORMS_SERVER: Record<string, boolean> = {
  twitter: true,
  tiktok: false,
  youtube: true,
  instagram: false,
  facebook: false,
  threads: false,
  pinterest: false,
  linkedin: true,
  reddit: true,
  quora: true,
  medium: true,
  hackernews: true,
  web: true,
};

function toServerMs(val: any): number {
  if (!val) return 0;
  if (typeof val === 'number') return Number.isFinite(val) ? val : 0;
  const ms = new Date(val).getTime();
  return Number.isFinite(ms) ? ms : 0;
}

function mergeResearchConfigServer(existingCfg: any, incomingCfg: any): Record<string, any> {
  const a = existingCfg && typeof existingCfg === 'object' ? existingCfg : {};
  const b = incomingCfg && typeof incomingCfg === 'object' ? incomingCfg : {};
  if (Object.keys(b).length === 0) return a;
  if (Object.keys(a).length === 0) return b;
  const aCid = String(a.campaignId || a._campaignId || '').trim();
  const bCid = String(b.campaignId || b._campaignId || '').trim();
  if (aCid && bCid && aCid !== bCid) {
    return b;
  }

  const aMs = toServerMs(a.updatedAt || a.lastPolledAt);
  const bMs = toServerMs(b.updatedAt || b.lastPolledAt);
  const newer = bMs >= aMs ? b : a;
  const older = bMs >= aMs ? a : b;

  const mergeTombstoneMap = (mapA: any, mapB: any, lowerKeys = false): Record<string, string> => {
    const out: Record<string, string> = {};
    [mapA, mapB].forEach((m) => {
      if (!m || typeof m !== 'object') return;
      Object.entries(m).forEach(([k, ts]) => {
        const clean = String(k || '').trim();
        const key = lowerKeys ? clean.toLowerCase() : clean;
        if (!key || !ts) return;
        if (!out[key] || toServerMs(ts) > toServerMs(out[key])) {
          out[key] = String(ts);
        }
      });
    });
    return out;
  };

  const deletedFeedUrls = mergeTombstoneMap(a.deletedFeedUrls, b.deletedFeedUrls, false);
  const deletedKeywords = mergeTombstoneMap(a.deletedKeywords, b.deletedKeywords, true);
  const deletedCompetitors = mergeTombstoneMap(a.deletedCompetitors, b.deletedCompetitors, true);
  const deletedSavedFeedIds = mergeTombstoneMap(a.deletedSavedFeedIds, b.deletedSavedFeedIds, false);

  const shouldKeepWithTombstone = (inA: boolean, inB: boolean, delMs: number) => {
    if (!delMs || delMs <= 0) return true;
    if (inA && aMs > delMs) return true;
    if (inB && bMs > delMs) return true;
    return false;
  };

  const genericTerms = new Set(['', 'google alert rss', 'custom alert rss']);
  const feedMap = new Map<string, any>();
  [
    ...(Array.isArray(older.alertFeeds) ? older.alertFeeds : []),
    ...(Array.isArray(newer.alertFeeds) ? newer.alertFeeds : []),
  ].forEach((rawFeed: any) => {
    if (!rawFeed || typeof rawFeed !== 'object') return;
    const url = String(rawFeed.url || '').trim();
    if (!url) return;
    const delMs = toServerMs(deletedFeedUrls[url]);
    const addedMs = toServerMs(rawFeed.addedAt);
    if (delMs > 0 && delMs >= addedMs) return;

    const existing = feedMap.get(url);
    if (!existing) {
      feedMap.set(url, {
        ...rawFeed,
        id: rawFeed.id || `gaf-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        url,
        term: String(rawFeed.term || 'Google Alert RSS').trim(),
        managedBySmartPoster: Boolean(rawFeed.managedBySmartPoster),
        signature: String(rawFeed.signature || ''),
        addedAt: rawFeed.addedAt || new Date().toISOString(),
      });
    } else {
      const exTerm = String(existing.term || '').trim();
      const nwTerm = String(rawFeed.term || '').trim();
      const exGeneric = genericTerms.has(exTerm.toLowerCase());
      const nwGeneric = genericTerms.has(nwTerm.toLowerCase());
      const chosenTerm = !nwGeneric && (exGeneric || nwTerm.length > exTerm.length) ? nwTerm : exTerm;
      const exAddMs = toServerMs(existing.addedAt);
      const nwAddMs = toServerMs(rawFeed.addedAt);
      const chosenAddedAt = nwAddMs > 0 && (exAddMs === 0 || nwAddMs < exAddMs) ? rawFeed.addedAt : existing.addedAt;
      feedMap.set(url, {
        ...existing,
        ...rawFeed,
        id: existing.id || rawFeed.id,
        url,
        term: chosenTerm || 'Google Alert RSS',
        managedBySmartPoster:
          rawFeed.managedBySmartPoster !== undefined
            ? Boolean(rawFeed.managedBySmartPoster)
            : Boolean(existing.managedBySmartPoster),
        signature: String(rawFeed.signature || existing.signature || ''),
        addedAt: chosenAddedAt,
      });
    }
  });

  const kwOrder: string[] = [];
  const kwSeen = new Set<string>();
  const aKwSet = new Set<string>();
  const bKwSet = new Set<string>();
  (Array.isArray(a.keywords) ? a.keywords : []).forEach((k: any) => {
    const clean = String(typeof k === 'string' ? k : k?.text || '').trim();
    if (clean) aKwSet.add(clean.toLowerCase());
  });
  (Array.isArray(b.keywords) ? b.keywords : []).forEach((k: any) => {
    const clean = String(typeof k === 'string' ? k : k?.text || '').trim();
    if (clean) bKwSet.add(clean.toLowerCase());
  });
  [...(Array.isArray(newer.keywords) ? newer.keywords : []), ...(Array.isArray(older.keywords) ? older.keywords : [])].forEach((k: any) => {
    const clean = String(typeof k === 'string' ? k : k?.text || '').trim();
    if (!clean) return;
    const key = clean.toLowerCase();
    if (kwSeen.has(key)) return;
    const delMs = toServerMs(deletedKeywords[key]);
    if (!shouldKeepWithTombstone(aKwSet.has(key), bKwSet.has(key), delMs)) return;
    kwSeen.add(key);
    kwOrder.push(clean);
  });

  const compMap = new Map<string, any>();
  const aCompSet = new Set<string>();
  const bCompSet = new Set<string>();
  const normComp = (c: any) => {
    if (!c) return null;
    const name = String(typeof c === 'string' ? c : c.name || '').trim();
    if (!name) return null;
    const queries = Array.isArray(c.queries)
      ? c.queries.map((q: any) => ({ text: String(q?.text || '').trim(), enabled: q?.enabled !== false })).filter((q: any) => q.text)
      : [
          { text: `Alternative to ${name}`, enabled: true },
          { text: `Alternate to ${name}`, enabled: true },
          { text: `Best alternative to ${name}`, enabled: true },
          { text: `${name} vs`, enabled: true },
        ];
    return {
      id: typeof c === 'object' && c.id ? c.id : `comp-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
      name,
      queries,
      ...(typeof c === 'object' && c.orQuery ? { orQuery: String(c.orQuery).trim() } : {}),
      ...(typeof c === 'object' && c.mode ? { mode: String(c.mode) } : {}),
    };
  };
  (Array.isArray(a.competitors) ? a.competitors : []).forEach((c: any) => {
    const nc = normComp(c);
    if (nc) aCompSet.add(nc.name.toLowerCase());
  });
  (Array.isArray(b.competitors) ? b.competitors : []).forEach((c: any) => {
    const nc = normComp(c);
    if (nc) bCompSet.add(nc.name.toLowerCase());
  });
  [...(Array.isArray(newer.competitors) ? newer.competitors : []), ...(Array.isArray(older.competitors) ? older.competitors : [])].forEach((raw: any) => {
    const nc = normComp(raw);
    if (!nc) return;
    const key = nc.name.toLowerCase();
    const delMs = toServerMs(deletedCompetitors[key]);
    if (!shouldKeepWithTombstone(aCompSet.has(key), bCompSet.has(key), delMs)) return;
    if (!compMap.has(key)) {
      compMap.set(key, nc);
    } else {
      const existing = compMap.get(key);
      const qMap = new Map<string, any>();
      (existing.queries || []).forEach((q: any) => qMap.set(q.text.toLowerCase(), { ...q }));
      (nc.queries || []).forEach((q: any) => {
        const qk = q.text.toLowerCase();
        if (!qMap.has(qk)) qMap.set(qk, { ...q });
      });
      existing.queries = Array.from(qMap.values());
    }
  });

  const statusRank: Record<string, number> = { new: 1, dismissed: 2, queued: 3 };
  const threadMap = new Map<string, any>();
  [...(Array.isArray(a.discoveredThreads) ? a.discoveredThreads : []), ...(Array.isArray(b.discoveredThreads) ? b.discoveredThreads : [])].forEach((t: any) => {
    if (!t || typeof t !== 'object') return;
    const url = String(t.url || '').trim();
    if (!url) return;
    const existing = threadMap.get(url);
    const tStatus = t.status || 'new';
    if (!existing) {
      threadMap.set(url, { ...t, url, status: tStatus });
    } else {
      const exRank = statusRank[existing.status || 'new'] || 1;
      const tRank = statusRank[tStatus] || 1;
      const winnerStatus = tRank >= exRank ? tStatus : existing.status;
      const exTs = toServerMs(existing.publishedAt || existing.addedAt || existing.fetchedAt);
      const tTs = toServerMs(t.publishedAt || t.addedAt || t.fetchedAt);
      const base = tTs > exTs ? { ...existing, ...t } : { ...t, ...existing };
      threadMap.set(url, { ...base, url, id: existing.id || t.id, status: winnerStatus });
    }
  });
  const mergedThreads = Array.from(threadMap.values())
    .sort((x, y) => toServerMs(y.publishedAt || y.addedAt || y.fetchedAt) - toServerMs(x.publishedAt || x.addedAt || x.fetchedAt))
    .slice(0, 300);

  const savedFeedMap = new Map<string, any>();
  const normSavedFeedItems = (items: any[]) => {
    const out: any[] = [];
    const seenUrls = new Set<string>();
    (Array.isArray(items) ? items : []).forEach((it: any) => {
      if (!it || typeof it !== 'object') return;
      const url = String(it.url || '').trim();
      if (!url) return;
      const key = url.split('#')[0].replace(/\/+$/, '').toLowerCase();
      if (seenUrls.has(key)) return;
      seenUrls.add(key);
      out.push({
        id: it.id || `sfi-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        title: String(it.title || 'Saved Thread').trim(),
        url,
        platform: String(it.platform || 'web'),
        matchedTerm: String(it.matchedTerm || ''),
        publishedAt: it.publishedAt || '',
        source: String(it.source || ''),
        intentScore: typeof it.intentScore === 'number' ? it.intentScore : undefined,
        savedAt: it.savedAt || new Date().toISOString(),
      });
    });
    return out;
  };
  [
    { list: older.savedFeeds, cfgMs: bMs >= aMs ? aMs : bMs },
    { list: newer.savedFeeds, cfgMs: bMs >= aMs ? bMs : aMs },
  ].forEach(({ list, cfgMs }) => {
    (Array.isArray(list) ? list : []).forEach((rawSf: any) => {
      if (!rawSf || typeof rawSf !== 'object') return;
      const id = String(rawSf.id || '').trim();
      if (!id) return;
      const delMs = toServerMs(deletedSavedFeedIds[id]);
      const sfActivityMs = Math.max(toServerMs(rawSf.updatedAt), toServerMs(rawSf.createdAt)) || cfgMs;
      if (delMs > 0 && delMs >= sfActivityMs) return;

      const items = normSavedFeedItems(rawSf.items);
      const existing = savedFeedMap.get(id);
      if (!existing) {
        const createdAt = rawSf.createdAt || rawSf.updatedAt || new Date().toISOString();
        savedFeedMap.set(id, {
          ...rawSf,
          id,
          name: String(rawSf.name || 'Saved Feed').trim() || 'Saved Feed',
          items,
          createdAt,
          updatedAt: rawSf.updatedAt || createdAt,
        });
      } else {
        const mergedItems = normSavedFeedItems([...(existing.items || []), ...items]);
        const exUpMs = toServerMs(existing.updatedAt || existing.createdAt);
        const nwUpMs = toServerMs(rawSf.updatedAt || rawSf.createdAt);
        const winner = nwUpMs >= exUpMs ? rawSf : existing;
        const exCrMs = toServerMs(existing.createdAt);
        const nwCrMs = toServerMs(rawSf.createdAt);
        const createdAt = nwCrMs > 0 && (exCrMs === 0 || nwCrMs < exCrMs) ? rawSf.createdAt : existing.createdAt;
        savedFeedMap.set(id, {
          ...existing,
          ...rawSf,
          id,
          name: String(winner.name || existing.name || 'Saved Feed').trim() || 'Saved Feed',
          items: mergedItems,
          createdAt,
          updatedAt: nwUpMs >= exUpMs ? (rawSf.updatedAt || rawSf.createdAt) : existing.updatedAt,
        });
      }
    });
  });

  const normTimeframeVal = (tf: any) =>
    tf === '24h' || tf === 'week' || tf === 'month' || tf === 'all' ? tf : '';

  const aPollMs = toServerMs(a.lastPolledAt);
  const bPollMs = toServerMs(b.lastPolledAt);
  const lastPolledAt = bPollMs > aPollMs ? b.lastPolledAt : (a.lastPolledAt || b.lastPolledAt || null);
  const maxUpdatedMs = Math.max(aMs, bMs);
  const updatedAt = maxUpdatedMs > 0
    ? (bMs >= aMs ? (b.updatedAt || b.lastPolledAt) : (a.updatedAt || a.lastPolledAt))
    : null;
  const campaignId = bCid || aCid || undefined;

  return {
    ...(campaignId ? { campaignId } : {}),
    frequency: newer.frequency || older.frequency || 'daily',
    quality: newer.quality || older.quality || 'best',
    feedTimeframe: normTimeframeVal(newer.feedTimeframe) || normTimeframeVal(older.feedTimeframe) || 'week',
    platforms: {
      ...DEFAULT_RESEARCH_PLATFORMS_SERVER,
      ...(older.platforms || {}),
      ...(newer.platforms || {}),
    },
    keywords: kwOrder,
    competitors: Array.from(compMap.values()),
    alertFeeds: Array.from(feedMap.values()),
    discoveredThreads: mergedThreads,
    savedFeeds: Array.from(savedFeedMap.values()),
    deletedFeedUrls,
    deletedKeywords,
    deletedCompetitors,
    deletedSavedFeedIds,
    managedAlertSignature:
      newer.managedAlertSignature !== undefined
        ? String(newer.managedAlertSignature || '')
        : String(older.managedAlertSignature || ''),
    alertsActive: newer.alertsActive !== undefined ? newer.alertsActive !== false : older.alertsActive !== false,
    lastPolledAt: lastPolledAt || null,
    updatedAt: updatedAt || null,
  };
}

function mergeNestedRecordServer(loserObj: any, winnerObj: any): any {
  if (!loserObj || typeof loserObj !== 'object') return winnerObj;
  if (!winnerObj || typeof winnerObj !== 'object') return loserObj;
  const out: any = { ...loserObj, ...winnerObj };
  Object.keys(loserObj).forEach((k) => {
    const lv = loserObj[k];
    const wv = winnerObj[k];
    if (wv === undefined || wv === null) {
      out[k] = lv;
    } else if (Array.isArray(lv) && Array.isArray(wv) && wv.length === 0 && lv.length > 0 && winnerObj[k] === undefined) {
      out[k] = lv;
    } else if (typeof lv === 'string' && lv.trim() && typeof wv === 'string' && !wv.trim() && !(k in winnerObj)) {
      out[k] = lv;
    }
  });
  return out;
}

function mergeBrandRecordsServer(existingBrand: any, incomingBrand: any): any {
  if (!existingBrand) return incomingBrand;
  if (!incomingBrand) return existingBrand;
  const exMs = toServerMs(existingBrand.updatedAt);
  const inMs = toServerMs(incomingBrand.updatedAt);
  const incomingWins = inMs >= exMs;
  const winner = incomingWins ? incomingBrand : existingBrand;
  const loser = incomingWins ? existingBrand : incomingBrand;
  const equalOrMissingTimestamp = exMs === 0 || inMs === 0 || exMs === inMs;

  const mergedRc = mergeResearchConfigServer(existingBrand.researchConfig, incomingBrand.researchConfig);
  const maxMs = Math.max(exMs, inMs, toServerMs(mergedRc?.updatedAt));

  const merged: any = { ...loser, ...winner };
  ['brandInfo', 'brandAssets', 'directory', 'contact', 'social', 'support', 'autopilot', 'postingRules', 'customData', 'safeDomain'].forEach((sectionKey) => {
    if (loser[sectionKey] || winner[sectionKey]) {
      merged[sectionKey] = mergeNestedRecordServer(loser[sectionKey], winner[sectionKey]);
    }
  });

  if (loser.support || winner.support) {
    const lSup = loser.support || {};
    const wSup = winner.support || {};
    const sup: any = { ...(merged.support || {}) };
    ['faqs', 'macros'].forEach((sKey) => {
      const wArr = Array.isArray(wSup[sKey]) ? wSup[sKey] : null;
      const lArr = Array.isArray(lSup[sKey]) ? lSup[sKey] : null;
      if (!wArr && lArr) sup[sKey] = lArr;
      else if (equalOrMissingTimestamp && wArr && wArr.length === 0 && lArr && lArr.length > 0) sup[sKey] = lArr;
    });
    merged.support = sup;
  }

  if (loser.brandAssets || winner.brandAssets) {
    const lBa = loser.brandAssets || {};
    const wBa = winner.brandAssets || {};
    const ba: any = { ...(merged.brandAssets || {}) };
    ['links', 'videos', 'handles', 'proof', 'tone', 'mediaRoles'].forEach((subKey) => {
      if (lBa[subKey] || wBa[subKey]) {
        ba[subKey] = mergeNestedRecordServer(lBa[subKey], wBa[subKey]);
      }
    });
    ['features', 'benefits', 'competitors', 'galleryCategories', 'customLinks', 'customSections', 'shortPitches'].forEach((arrKey) => {
      const wArr = Array.isArray(wBa[arrKey]) ? wBa[arrKey] : null;
      const lArr = Array.isArray(lBa[arrKey]) ? lBa[arrKey] : null;
      if (!wArr && lArr) ba[arrKey] = lArr;
      else if (equalOrMissingTimestamp && wArr && wArr.length === 0 && lArr && lArr.length > 0) ba[arrKey] = lArr;
    });
    if (lBa.proof || wBa.proof) {
      ba.proof = { ...(ba.proof || {}) };
      ['metrics', 'testimonials'].forEach((pKey) => {
        const wArr = Array.isArray(wBa.proof?.[pKey]) ? wBa.proof[pKey] : null;
        const lArr = Array.isArray(lBa.proof?.[pKey]) ? lBa.proof[pKey] : null;
        if (!wArr && lArr) ba.proof[pKey] = lArr;
        else if (equalOrMissingTimestamp && wArr && wArr.length === 0 && lArr && lArr.length > 0) ba.proof[pKey] = lArr;
      });
    }
    merged.brandAssets = ba;
  }

  ['emails', 'dms', 'articles', 'socialPosts', 'savedKeywordStacks', 'keywords', 'savedUrlSets', 'gallery', 'suppressionList'].forEach((arrKey) => {
    const wArr = Array.isArray(winner[arrKey]) ? winner[arrKey] : null;
    const lArr = Array.isArray(loser[arrKey]) ? loser[arrKey] : null;
    if (!wArr && lArr) {
      merged[arrKey] = lArr;
    } else if (equalOrMissingTimestamp && wArr && wArr.length === 0 && lArr && lArr.length > 0) {
      merged[arrKey] = lArr;
    }
  });

  const wComments = Array.isArray(winner.social?.comments) ? winner.social.comments : (Array.isArray(winner.comments) ? winner.comments : null);
  const lComments = Array.isArray(loser.social?.comments) ? loser.social.comments : (Array.isArray(loser.comments) ? loser.comments : null);
  if ((!wComments || (equalOrMissingTimestamp && wComments.length === 0)) && lComments && lComments.length > 0) {
    merged.social = { ...(merged.social || {}), comments: lComments };
    merged.comments = lComments;
  } else if (wComments) {
    merged.social = { ...(merged.social || {}), comments: wComments };
  }

  const tagSeen = new Set<string>(['general']);
  const mergedTags: string[] = ['General'];
  const pushServerTag = (raw: any) => {
    const cleaned = String(raw || '').replace(/\s+/g, ' ').trim();
    if (!cleaned || cleaned.toLowerCase() === 'all') return;
    const lower = cleaned.toLowerCase();
    if (tagSeen.has(lower)) return;
    tagSeen.add(lower);
    mergedTags.push(cleaned);
  };
  (Array.isArray(winner.commentTags) ? winner.commentTags : []).forEach(pushServerTag);
  if (equalOrMissingTimestamp || !Array.isArray(winner.commentTags) || winner.commentTags.length === 0) {
    (Array.isArray(loser.commentTags) ? loser.commentTags : []).forEach(pushServerTag);
  }
  (Array.isArray(merged.social?.comments) ? merged.social.comments : []).forEach((c: any) => {
    if (c && typeof c === 'object' && Array.isArray(c.tags)) {
      c.tags.forEach(pushServerTag);
    }
  });
  merged.commentTags = mergedTags;
  merged.activeCommentPool = String(winner.activeCommentPool || loser.activeCommentPool || 'all').trim() || 'all';

  ['taglines', 'pitches', 'summaries', 'descriptions', 'slides'].forEach((dirArrKey) => {
    const wArr = Array.isArray(winner.directory?.[dirArrKey]) ? winner.directory[dirArrKey] : null;
    const lArr = Array.isArray(loser.directory?.[dirArrKey]) ? loser.directory[dirArrKey] : null;
    if ((!wArr || (equalOrMissingTimestamp && wArr.length === 0)) && lArr && lArr.length > 0) {
      merged.directory = { ...(merged.directory || {}), [dirArrKey]: lArr };
    }
  });

  if (winner.isUntouchedDefault && (!loser.isUntouchedDefault || maxMs > 0)) {
    delete merged.isUntouchedDefault;
  }

  merged.researchConfig = mergedRc;
  if (maxMs > 0) {
    merged.updatedAt = new Date(maxMs).toISOString();
  }
  return merged;
}

export async function saveUserWorkspacePrefs(
  userId: string,
  prefs: Partial<UserWorkspacePrefs>,
  userToken?: string
): Promise<UserWorkspacePrefs> {
  const current = await loadUserWorkspacePrefs(userId, userToken);
  const merged: UserWorkspacePrefs = {
    user_id: userId,
    bookmarked_directory_ids: Array.isArray(prefs.bookmarked_directory_ids)
      ? prefs.bookmarked_directory_ids
      : current.bookmarked_directory_ids || [],
    custom_directories: Array.isArray(prefs.custom_directories)
      ? prefs.custom_directories
      : current.custom_directories || [],
    research_config: prefs.research_config && typeof prefs.research_config === 'object'
      ? mergeResearchConfigServer(current.research_config, prefs.research_config)
      : current.research_config || {},
    updated_at: new Date().toISOString(),
  };

  const { url, key, configured } = getSupabaseCreds();
  if (configured && userId) {
    try {
      const authHeader = userToken ? `Bearer ${userToken}` : `Bearer ${key}`;
      const res = await fetch(`${url}/rest/v1/user_workspace_prefs`, {
        method: 'POST',
        headers: {
          apikey: key,
          Authorization: authHeader,
          'Content-Type': 'application/json',
          Prefer: 'resolution=merge-duplicates,return=representation',
        },
        body: JSON.stringify(merged),
      });
      if (res.ok) {
        const rows = await res.json();
        if (rows?.[0]) return rows[0];
      }
    } catch (err) {
      console.warn('[WorkspacePrefs] Supabase save fallback:', err);
    }
  }

  const store = readLocalStore();
  store.workspacePrefs[userId] = merged;
  writeLocalStore(store);
  return merged;
}

// ==========================================
// FULL WEB-MODE CLOUD STATE (Brands, Settings, Completed URLs, Logs, Prefs)
// ==========================================
function getEmptyUserCloudRecord(userId: string): UserCloudStateRecord {
  return {
    brands: [],
    deletedBrandTombstones: {},
    userSettings: null,
    completedUrls: {},
    workspacePrefs: {
      user_id: userId,
      bookmarked_directory_ids: [],
      custom_directories: [],
      research_config: {},
      updated_at: new Date().toISOString(),
    },
    masterLogs: [],
    errorLogs: [],
    updatedAt: new Date().toISOString(),
  };
}

export async function loadUserCloudState(
  userId: string,
  userToken?: string
): Promise<{
  source: string;
  brands: any[];
  deletedBrandTombstones: Record<string, string>;
  userSettings: Record<string, any> | null;
  completedUrls: Record<string, any>;
  workspacePrefs: UserWorkspacePrefs;
  masterLogs: any[];
  errorLogs: any[];
}> {
  const store = readLocalStore();
  const localRecord = store.userCloudState?.[userId] || getEmptyUserCloudRecord(userId);
  if (!userId) {
    return { source: 'empty', ...localRecord };
  }

  const { url, key, configured } = getSupabaseCreds();
  if (!configured) {
    return { source: 'local', ...localRecord };
  }

  const authHeader = userToken ? `Bearer ${userToken}` : `Bearer ${key}`;
  const headers = { apikey: key, Authorization: authHeader };

  try {
    const [brandsRes, settingsRes, urlsRes, prefsRes, logsRes] = await Promise.all([
      fetch(`${url}/rest/v1/brands?user_id=eq.${encodeURIComponent(userId)}&select=*`, { headers }),
      fetch(`${url}/rest/v1/user_settings?user_id=eq.${encodeURIComponent(userId)}&select=*`, { headers }),
      fetch(`${url}/rest/v1/completed_urls?user_id=eq.${encodeURIComponent(userId)}&select=*`, { headers }),
      fetch(`${url}/rest/v1/user_workspace_prefs?user_id=eq.${encodeURIComponent(userId)}&select=*`, { headers }),
      fetch(`${url}/rest/v1/campaign_logs?user_id=eq.${encodeURIComponent(userId)}&order=created_at.desc&limit=200&select=*`, { headers }),
    ]);

    let anyOk = false;
    const brands: any[] = [];
    const deletedBrandTombstones: Record<string, string> = {};

    if (brandsRes.ok) {
      anyOk = true;
      const rows = await brandsRes.json().catch(() => []);
      (Array.isArray(rows) ? rows : []).forEach((row: any) => {
        const d = row.data || {};
        const delAt = row.deleted_at || d.deletedAt || null;
        if (delAt) {
          deletedBrandTombstones[row.id] = delAt;
        } else {
          brands.push({
            ...d,
            brandId: row.id,
            campaignId: d.campaignId || row.id,
            brandName: row.name || d.brandName || d.campaignName || 'Brand',
            campaignName: d.campaignName || row.name || d.brandName || 'Brand',
            updatedAt: row.updated_at || d.updatedAt || new Date().toISOString(),
          });
        }
      });
    }

    let userSettings: Record<string, any> | null = localRecord.userSettings;
    if (settingsRes.ok) {
      anyOk = true;
      const rows = await settingsRes.json().catch(() => []);
      if (Array.isArray(rows) && rows[0]) {
        userSettings = {
          ...(rows[0].settings || {}),
          updatedAt: rows[0].updated_at || rows[0].settings?.updatedAt || new Date().toISOString(),
        };
      } else {
        userSettings = null;
      }
    }

    const completedUrls: Record<string, any> = {};
    if (urlsRes.ok) {
      anyOk = true;
      const rows = await urlsRes.json().catch(() => []);
      (Array.isArray(rows) ? rows : []).forEach((row: any) => {
        completedUrls[row.id] = {
          id: row.id,
          brandId: row.brand_id,
          brandName: row.brand_name,
          url: row.url,
          domain: row.domain,
          category: row.category,
          completedAt: row.completed_at,
        };
      });
    }

    let workspacePrefs = localRecord.workspacePrefs;
    if (prefsRes.ok) {
      anyOk = true;
      const rows = await prefsRes.json().catch(() => []);
      if (Array.isArray(rows) && rows[0]) {
        workspacePrefs = rows[0];
      }
    }

    const masterLogs: any[] = [];
    const errorLogs: any[] = [];
    if (logsRes.ok) {
      anyOk = true;
      const rows = await logsRes.json().catch(() => []);
      (Array.isArray(rows) ? rows : []).forEach((row: any) => {
        const ts = row.created_at ? new Date(row.created_at).getTime() : Date.now();
        if (row.status === 'error') {
          errorLogs.push({
            id: row.client_log_id || row.id,
            module: row.module || 'extension',
            url: row.target_url || '',
            domain: row.domain || '',
            message: row.error || row.content_snippet || 'Error',
            details: row.details || {},
            timestamp: ts,
          });
        } else {
          masterLogs.push({
            id: row.client_log_id || row.id,
            brandId: row.brand_id || undefined,
            module: row.module || 'contact',
            targetUrl: row.target_url || '',
            domain: row.domain || '',
            campaignName: row.campaign_name || 'Default',
            contentSnippet: row.content_snippet || '',
            status: row.status || 'success',
            statusCode: row.status_code ?? (row.status === 'success' ? 200 : 500),
            error: row.error || null,
            details: row.details || {},
            timestamp: ts,
          });
        }
      });
    }

    if (anyOk) {
      return {
        source: 'supabase',
        brands: brandsRes.ok ? brands : localRecord.brands,
        deletedBrandTombstones: brandsRes.ok ? deletedBrandTombstones : localRecord.deletedBrandTombstones,
        userSettings,
        completedUrls: urlsRes.ok ? completedUrls : localRecord.completedUrls,
        workspacePrefs,
        masterLogs: logsRes.ok ? masterLogs : localRecord.masterLogs,
        errorLogs: logsRes.ok ? errorLogs : localRecord.errorLogs,
      };
    }
  } catch (err) {
    console.warn('[CloudState] Supabase load fallback:', err);
  }

  return { source: 'local', ...localRecord };
}

export const STORAGE_QUOTAS = {
  basic: 15 * 1024 * 1024,          // 15 MB
  pro: 250 * 1024 * 1024,           // 250 MB
  studio: 1024 * 1024 * 1024,       // 1 GB
  unlimited: 5 * 1024 * 1024 * 1024 // 5 GB
} as const;

export const MAX_SINGLE_MEDIA_BYTES = Math.floor(1.5 * 1024 * 1024); // 1.5 MB per image upload
const MAX_INLINE_DATA_URL_CHARS = 250_000; // ~187 KB binary ceiling inside JSONB rows

export function getStorageQuotaBytesForTier(tier: unknown): number {
  const t = String(tier || 'basic').trim().toLowerCase();
  if (t === 'unlimited' || t === 'agency' || t === 'admin' || t === 'team' || t === 'ultra' || t.startsWith('unlimited')) {
    return STORAGE_QUOTAS.unlimited;
  }
  if (t === 'studio' || t === 'growth') {
    return STORAGE_QUOTAS.studio;
  }
  if (t === 'pro' || t === 'lifetime' || t === 'premium' || t.startsWith('pro')) {
    return STORAGE_QUOTAS.pro;
  }
  return STORAGE_QUOTAS.basic;
}

function stripOversizedInlineDataUrls(val: any, depth = 0): any {
  if (depth > 8 || val == null) return val;
  if (typeof val === 'string') {
    if (val.startsWith('data:image/') && val.length > MAX_INLINE_DATA_URL_CHARS) {
      return '';
    }
    return val;
  }
  if (Array.isArray(val)) {
    return val.map((item) => stripOversizedInlineDataUrls(item, depth + 1));
  }
  if (typeof val === 'object') {
    const out: Record<string, any> = {};
    for (const [k, v] of Object.entries(val)) {
      out[k] = stripOversizedInlineDataUrls(v, depth + 1);
    }
    return out;
  }
  return val;
}

export function sanitizeBrandMediaPayloads(brands: any[]): any[] {
  if (!Array.isArray(brands)) return [];
  return brands.map((brand) => {
    if (!brand || typeof brand !== 'object') return brand;
    const cleaned = stripOversizedInlineDataUrls(brand);
    if (Array.isArray(cleaned.gallery)) {
      cleaned.gallery = cleaned.gallery.filter((item: any) => item && String(item.url || '').trim().length > 0);
    }
    return cleaned;
  });
}

export async function saveUserCloudState(
  userId: string,
  payload: UserCloudStatePayload,
  userToken?: string
): Promise<{ success: boolean; source: string; syncedAt: string }> {
  const nowIso = new Date().toISOString();
  const { url, key, configured } = getSupabaseCreds();
  const safeBrands = Array.isArray(payload?.brands) ? sanitizeBrandMediaPayloads(payload.brands) : undefined;
  const safePayload: UserCloudStatePayload = {
    ...payload,
    ...(safeBrands !== undefined ? { brands: safeBrands } : {}),
  };

  if (configured && userId) {
    const authHeader = userToken ? `Bearer ${userToken}` : `Bearer ${key}`;
    const baseHeaders = {
      apikey: key,
      Authorization: authHeader,
      'Content-Type': 'application/json',
    };
    const upsertHeaders = {
      ...baseHeaders,
      Prefer: 'resolution=merge-duplicates,return=representation',
    };

    try {
      const tasks: Promise<Response>[] = [];

      // 1. Brands + Soft-delete tombstones
      const brandRows: any[] = [];
      if (Array.isArray(safePayload.brands)) {
        safePayload.brands.forEach((b) => {
          const id = String(b?.brandId || b?.campaignId || '').trim();
          if (!id) return;
          const name = String(b.campaignName || b.brandName || b.brandInfo?.name || 'Brand');
          const updatedAt = b.updatedAt || nowIso;
          brandRows.push({
            id,
            user_id: userId,
            name,
            data: { ...b, brandId: id, campaignId: b.campaignId || id, updatedAt },
            updated_at: updatedAt,
            deleted_at: b.deletedAt || null,
          });
        });
      }
      if (Array.isArray(payload.deletedBrandIds)) {
        payload.deletedBrandIds.forEach((delId) => {
          const id = String(delId || '').trim();
          if (!id) return;
          brandRows.push({
            id,
            user_id: userId,
            name: 'Deleted Campaign',
            data: { brandId: id, deletedAt: nowIso, updatedAt: nowIso },
            updated_at: nowIso,
            deleted_at: nowIso,
          });
        });
      }
      if (brandRows.length > 0) {
        tasks.push(
          fetch(`${url}/rest/v1/brands?on_conflict=user_id,id`, {
            method: 'POST',
            headers: upsertHeaders,
            body: JSON.stringify(brandRows),
          })
        );
      }

      // 2. User Settings
      if (payload.userSettings && typeof payload.userSettings === 'object') {
        const updatedAt = payload.userSettings.updatedAt || nowIso;
        tasks.push(
          fetch(`${url}/rest/v1/user_settings?on_conflict=user_id`, {
            method: 'POST',
            headers: upsertHeaders,
            body: JSON.stringify([{
              user_id: userId,
              settings: { ...payload.userSettings, updatedAt },
              updated_at: updatedAt,
            }]),
          })
        );
      }

      // 3. Completed URLs (deletes + upserts)
      if (payload.clearCompletedUrls) {
        tasks.push(
          fetch(`${url}/rest/v1/completed_urls?user_id=eq.${encodeURIComponent(userId)}`, {
            method: 'DELETE',
            headers: baseHeaders,
          })
        );
      } else if (Array.isArray(payload.deletedCompletedIds) && payload.deletedCompletedIds.length > 0) {
        payload.deletedCompletedIds.forEach((delId) => {
          if (!delId) return;
          tasks.push(
            fetch(`${url}/rest/v1/completed_urls?user_id=eq.${encodeURIComponent(userId)}&id=eq.${encodeURIComponent(String(delId))}`, {
              method: 'DELETE',
              headers: baseHeaders,
            })
          );
        });
      }
      if (payload.completedUrls && typeof payload.completedUrls === 'object' && !payload.clearCompletedUrls) {
        const urlRows = Object.entries(payload.completedUrls)
          .map(([k, item]: [string, any]) => {
            const rec = item || {};
            const id = String(rec.id || k || rec.url || rec.domain || '').trim();
            if (!id) return null;
            return {
              id: id.slice(0, 500),
              user_id: userId,
              brand_id: String(rec.brandId || 'brand-default'),
              brand_name: String(rec.brandName || 'Brand'),
              url: String(rec.url || ''),
              domain: String(rec.domain || ''),
              category: String(rec.category || 'outreach'),
              completed_at: rec.completedAt || nowIso,
            };
          })
          .filter(Boolean);
        if (urlRows.length > 0) {
          tasks.push(
            fetch(`${url}/rest/v1/completed_urls?on_conflict=user_id,id`, {
              method: 'POST',
              headers: upsertHeaders,
              body: JSON.stringify(urlRows),
            })
          );
        }
      }

      // 4. Workspace Prefs
      if (payload.workspacePrefs && typeof payload.workspacePrefs === 'object') {
        const wp = payload.workspacePrefs;
        tasks.push(
          fetch(`${url}/rest/v1/user_workspace_prefs?on_conflict=user_id`, {
            method: 'POST',
            headers: upsertHeaders,
            body: JSON.stringify([{
              user_id: userId,
              bookmarked_directory_ids: Array.isArray(wp.bookmarked_directory_ids) ? wp.bookmarked_directory_ids : [],
              custom_directories: Array.isArray(wp.custom_directories) ? wp.custom_directories : [],
              research_config: wp.research_config && typeof wp.research_config === 'object' ? wp.research_config : {},
              updated_at: wp.updated_at || nowIso,
            }]),
          })
        );
      }

      // 5. Campaign Logs (Master + Error logs)
      if (payload.clearMasterLogs) {
        tasks.push(
          fetch(`${url}/rest/v1/campaign_logs?user_id=eq.${encodeURIComponent(userId)}&status=neq.error`, {
            method: 'DELETE',
            headers: baseHeaders,
          })
        );
      }
      if (payload.clearErrorLogs) {
        tasks.push(
          fetch(`${url}/rest/v1/campaign_logs?user_id=eq.${encodeURIComponent(userId)}&status=eq.error`, {
            method: 'DELETE',
            headers: baseHeaders,
          })
        );
      }
      const logRows: any[] = [];
      const seenLogIds = new Set<string>();
      if (Array.isArray(payload.masterLogs) && !payload.clearMasterLogs) {
        payload.masterLogs.slice(0, 200).forEach((l: any) => {
          if (!l) return;
          const clientId = String(l.id || `log_${l.timestamp || Date.now()}`);
          if (seenLogIds.has(clientId)) return;
          seenLogIds.add(clientId);
          logRows.push({
            user_id: userId,
            client_log_id: clientId,
            brand_id: l.brandId || null,
            module: String(l.module || 'contact'),
            target_url: String(l.targetUrl || l.url || l.domain || ''),
            domain: String(l.domain || ''),
            campaign_name: String(l.campaignName || 'Default'),
            content_snippet: String(l.contentSnippet || '').slice(0, 300),
            status: String(l.status || 'success'),
            status_code: Number.isFinite(Number(l.statusCode)) ? Number(l.statusCode) : null,
            error: l.error ? String(l.error).slice(0, 500) : null,
            details: l.details && typeof l.details === 'object' ? l.details : {},
            created_at: l.timestamp ? new Date(l.timestamp).toISOString() : nowIso,
          });
        });
      }
      if (Array.isArray(payload.errorLogs) && !payload.clearErrorLogs) {
        payload.errorLogs.slice(0, 100).forEach((e: any) => {
          if (!e) return;
          const clientId = String(e.id || `err_${e.timestamp || Date.now()}`);
          if (seenLogIds.has(clientId)) return;
          seenLogIds.add(clientId);
          logRows.push({
            user_id: userId,
            client_log_id: clientId,
            brand_id: null,
            module: String(e.module || 'extension'),
            target_url: String(e.url || e.domain || ''),
            domain: String(e.domain || ''),
            campaign_name: '',
            content_snippet: String(e.message || 'Error').slice(0, 300),
            status: 'error',
            status_code: 500,
            error: String(e.message || 'Error').slice(0, 500),
            details: e.details && typeof e.details === 'object' ? e.details : {},
            created_at: e.timestamp ? new Date(e.timestamp).toISOString() : nowIso,
          });
        });
      }
      if (logRows.length > 0) {
        tasks.push(
          fetch(`${url}/rest/v1/campaign_logs?on_conflict=user_id,client_log_id`, {
            method: 'POST',
            headers: upsertHeaders,
            body: JSON.stringify(logRows),
          })
        );
      }

      const responses = await Promise.all(tasks);
      if (responses.every((r) => r.ok)) {
        return { success: true, source: 'supabase', syncedAt: nowIso };
      }
    } catch (err) {
      console.warn('[CloudState] Supabase save fallback:', err);
    }
  }

  // Local Store fallback (dev/offline mode)
  const store = readLocalStore();
  if (!store.userCloudState) store.userCloudState = {};
  const existing = store.userCloudState[userId] || getEmptyUserCloudRecord(userId);

  if (Array.isArray(safePayload.brands)) {
    const brandMap = new Map<string, any>();
    existing.brands.forEach((b) => {
      const id = b?.brandId || b?.campaignId;
      if (id) brandMap.set(id, b);
    });
    safePayload.brands.forEach((b) => {
      const id = b?.brandId || b?.campaignId;
      if (id) {
        delete existing.deletedBrandTombstones[id];
        const prevBrand = brandMap.get(id);
        brandMap.set(id, prevBrand ? mergeBrandRecordsServer(prevBrand, b) : b);
      }
    });
    existing.brands = Array.from(brandMap.values());
  }
  if (Array.isArray(payload.deletedBrandIds)) {
    const delSet = new Set(payload.deletedBrandIds);
    payload.deletedBrandIds.forEach((id) => {
      if (id) existing.deletedBrandTombstones[id] = nowIso;
    });
    existing.brands = existing.brands.filter((b) => !delSet.has(b?.brandId || b?.campaignId));
  }
  if (payload.userSettings && typeof payload.userSettings === 'object') {
    existing.userSettings = { ...(existing.userSettings || {}), ...payload.userSettings, updatedAt: payload.userSettings.updatedAt || nowIso };
  }
  if (payload.clearCompletedUrls) {
    existing.completedUrls = {};
  } else {
    if (Array.isArray(payload.deletedCompletedIds)) {
      payload.deletedCompletedIds.forEach((id) => { delete existing.completedUrls[id]; });
    }
    if (payload.completedUrls && typeof payload.completedUrls === 'object') {
      existing.completedUrls = { ...existing.completedUrls, ...payload.completedUrls };
    }
  }
  if (payload.workspacePrefs && typeof payload.workspacePrefs === 'object') {
    existing.workspacePrefs = {
      user_id: userId,
      bookmarked_directory_ids: payload.workspacePrefs.bookmarked_directory_ids ?? existing.workspacePrefs.bookmarked_directory_ids,
      custom_directories: payload.workspacePrefs.custom_directories ?? existing.workspacePrefs.custom_directories,
      research_config: payload.workspacePrefs.research_config && typeof payload.workspacePrefs.research_config === 'object'
        ? mergeResearchConfigServer(existing.workspacePrefs.research_config, payload.workspacePrefs.research_config)
        : existing.workspacePrefs.research_config,
      updated_at: payload.workspacePrefs.updated_at || nowIso,
    };
    store.workspacePrefs[userId] = existing.workspacePrefs;
  }
  if (payload.clearMasterLogs) {
    existing.masterLogs = [];
  } else if (Array.isArray(payload.masterLogs)) {
    existing.masterLogs = payload.masterLogs.slice(0, 500);
  }
  if (payload.clearErrorLogs) {
    existing.errorLogs = [];
  } else if (Array.isArray(payload.errorLogs)) {
    existing.errorLogs = payload.errorLogs.slice(0, 200);
  }
  existing.updatedAt = nowIso;
  store.userCloudState[userId] = existing;
  writeLocalStore(store);

  return { success: true, source: 'local', syncedAt: nowIso };
}

function isVaultSnapshotMeaningful(snapshot: any): boolean {
  if (!snapshot || typeof snapshot !== 'object') return false;
  const brands = Array.isArray(snapshot.brandProfiles)
    ? snapshot.brandProfiles
    : (Array.isArray(snapshot.campaignProfiles) ? snapshot.campaignProfiles : []);
  const hasRealBrand = brands.some((b: any) => {
    if (!b || typeof b !== 'object') return false;
    const id = b.brandId || b.campaignId || '';
    if (id !== 'brand-focus-gummies-sample') return true;
    const name = String(b.brandName || b.campaignName || '').trim();
    const isDefaultName = !name || name === 'Focus Gummies - Sample Campaign' || name === 'Focus Gummies - Reddit Launch' || name === 'FocusGummies - reddit launch';
    const infoUrl = String(b.brandInfo?.url || '').trim();
    const isDefaultUrl = !infoUrl || infoUrl === 'https://focusgummies.co';
    if (!isDefaultName || !isDefaultUrl || (b.brandInfo?.name && b.brandInfo.name !== 'Focus Gummies')) return true;
    if (b.isUntouchedDefault || !b.updatedAt) return false;
    return true;
  });
  if (hasRealBrand) return true;
  if (snapshot.completedUrls && Object.keys(snapshot.completedUrls).length > 0) return true;
  if (Array.isArray(snapshot.masterLogs) && snapshot.masterLogs.length > 0) return true;
  if (Array.isArray(snapshot.savedUrlSets) && snapshot.savedUrlSets.length > 0) return true;
  if (Array.isArray(snapshot.suppressionList) && snapshot.suppressionList.length > 0) return true;
  if (snapshot.apiKey && String(snapshot.apiKey).trim()) return true;
  if (snapshot.directoryPrefs && ((snapshot.directoryPrefs.bookmarkedIds?.length || 0) > 0 || (snapshot.directoryPrefs.customDirectories?.length || 0) > 0)) return true;
  if (snapshot.researchConfig && ((snapshot.researchConfig.keywords?.length || 0) > 0 || (snapshot.researchConfig.competitors?.length || 0) > 0 || (snapshot.researchConfig.alertFeeds?.length || 0) > 0 || (snapshot.researchConfig.savedFeeds?.length || 0) > 0)) return true;
  return false;
}

export function loadExtensionVault(vaultId: string): ExtensionVaultRecord | null {
  if (!vaultId || typeof vaultId !== 'string') return null;
  const cleanId = vaultId.trim();
  if (!/^[a-zA-Z0-9_-]{16,128}$/.test(cleanId)) return null;
  const store = readLocalStore();
  return store.extensionVaults?.[cleanId] || null;
}

export function saveExtensionVault(
  vaultId: string,
  snapshot: Record<string, any>
): { success: boolean; updatedAt: string; preservedExisting?: boolean } {
  const cleanId = String(vaultId || '').trim();
  if (!/^[a-zA-Z0-9_-]{16,128}$/.test(cleanId)) {
    throw new Error('Invalid vault ID');
  }
  const nowIso = new Date().toISOString();
  const store = readLocalStore();
  if (!store.extensionVaults) store.extensionVaults = {};

  const existing = store.extensionVaults[cleanId];
  const incomingMeaningful = isVaultSnapshotMeaningful(snapshot);
  const existingMeaningful = existing ? isVaultSnapshotMeaningful(existing.snapshot) : false;

  // Never let a fresh/empty install overwrite an existing meaningful vault unless explicitly forced
  if (existingMeaningful && !incomingMeaningful && !snapshot?.forceOverwrite) {
    return {
      success: true,
      updatedAt: existing.updatedAt,
      preservedExisting: true,
    };
  }

  const sanitizedSnapshot: Record<string, any> = {
    ...(snapshot || {}),
    updatedAt: snapshot?.updatedAt || nowIso,
  };
  if (Array.isArray(sanitizedSnapshot.brandProfiles)) {
    sanitizedSnapshot.brandProfiles = sanitizeBrandMediaPayloads(sanitizedSnapshot.brandProfiles);
  }
  if (Array.isArray(sanitizedSnapshot.campaignProfiles)) {
    sanitizedSnapshot.campaignProfiles = sanitizeBrandMediaPayloads(sanitizedSnapshot.campaignProfiles);
  }
  delete sanitizedSnapshot.forceOverwrite;

  store.extensionVaults[cleanId] = {
    vaultId: cleanId,
    snapshot: sanitizedSnapshot,
    updatedAt: sanitizedSnapshot.updatedAt,
  };
  writeLocalStore(store);

  return { success: true, updatedAt: sanitizedSnapshot.updatedAt };
}

export function calculateBrandsAssistantStorageBytes(brands: any[]): number {
  if (!Array.isArray(brands) || brands.length === 0) return 0;
  let total = 0;
  for (const b of brands) {
    if (!b || typeof b !== 'object' || b.deletedAt) continue;
    try {
      const hasSessions = Array.isArray(b.assistantSessions) && b.assistantSessions.length > 0;
      if (hasSessions) {
        total += Buffer.byteLength(JSON.stringify(b.assistantSessions), 'utf8');
      } else if (b.assistantChat && typeof b.assistantChat === 'object') {
        const msgCount = Array.isArray(b.assistantChat.messages) ? b.assistantChat.messages.length : 0;
        const ctxCount = Array.isArray(b.assistantChat.scannedContexts) ? b.assistantChat.scannedContexts.length : 0;
        if (msgCount > 0 || ctxCount > 0) {
          total += Buffer.byteLength(JSON.stringify(b.assistantChat), 'utf8');
        }
      }
      if (Array.isArray(b.contentVault) && b.contentVault.length > 0) {
        total += Buffer.byteLength(JSON.stringify(b.contentVault), 'utf8');
      }
    } catch {}
  }
  return total;
}

export async function getUserStorageUsageBytes(
  userId: string,
  userToken?: string,
  preloadedBrands?: any[]
): Promise<number> {
  if (!userId) return 0;
  const { url, key, configured } = getSupabaseCreds();
  if (!configured) {
    const store = readLocalStore();
    const brands = Array.isArray(preloadedBrands)
      ? preloadedBrands
      : (store.userCloudState?.[userId]?.brands || []);
    return calculateBrandsAssistantStorageBytes(brands);
  }
  try {
    const authHeader = userToken ? `Bearer ${userToken}` : `Bearer ${key}`;
    const storagePromise = fetch(`${url}/storage/v1/object/list/brand-assets`, {
      method: 'POST',
      headers: {
        apikey: key,
        Authorization: authHeader,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prefix: `${userId}/`,
        limit: 1000,
        offset: 0,
        sortBy: { column: 'name', order: 'asc' },
      }),
    });

    const brandsPromise = Array.isArray(preloadedBrands)
      ? Promise.resolve(null)
      : fetch(`${url}/rest/v1/brands?user_id=eq.${encodeURIComponent(userId)}&deleted_at=is.null&select=id,data`, {
          headers: { apikey: key, Authorization: authHeader },
        });

    const [res, brandsRes] = await Promise.all([storagePromise, brandsPromise]);
    let mediaBytes = 0;
    if (res.ok) {
      const rows: any = await res.json().catch(() => []);
      if (Array.isArray(rows)) {
        mediaBytes = rows.reduce((sum, item) => sum + Number(item?.metadata?.size || item?.size || 0), 0);
      }
    }

    let brandsList: any[] = Array.isArray(preloadedBrands) ? preloadedBrands : [];
    if (!Array.isArray(preloadedBrands) && brandsRes && brandsRes.ok) {
      const brandRows: any = await brandsRes.json().catch(() => []);
      if (Array.isArray(brandRows)) {
        brandsList = brandRows.map((r: any) => (r?.data && typeof r.data === 'object' ? r.data : {})).filter(Boolean);
      }
    }

    const assistantTextBytes = calculateBrandsAssistantStorageBytes(brandsList);
    return mediaBytes + assistantTextBytes;
  } catch (err) {
    console.warn('[StorageUsage] Failed to calculate user storage usage:', err);
    return Array.isArray(preloadedBrands) ? calculateBrandsAssistantStorageBytes(preloadedBrands) : 0;
  }
}

export async function deleteUserBrandMedia(
  userId: string,
  assetUrlOrPath: string,
  userToken?: string
): Promise<{ success: boolean; deletedPath?: string }> {
  const raw = String(assetUrlOrPath || '').trim();
  if (!userId || !raw) return { success: false };

  let objectPath = raw;
  const marker = '/brand-assets/';
  const markerIdx = raw.indexOf(marker);
  if (markerIdx !== -1) {
    objectPath = raw.slice(markerIdx + marker.length).split('?')[0];
  }
  objectPath = objectPath.replace(/^\/+/, '');
  if (!objectPath.startsWith(`${userId}/`)) {
    return { success: false };
  }

  const { url, key, configured } = getSupabaseCreds();
  if (!configured) return { success: true, deletedPath: objectPath };
  try {
    const authHeader = userToken ? `Bearer ${userToken}` : `Bearer ${key}`;
    const res = await fetch(`${url}/storage/v1/object/brand-assets/${objectPath}`, {
      method: 'DELETE',
      headers: {
        apikey: key,
        Authorization: authHeader,
      },
    });
    return { success: res.ok, deletedPath: objectPath };
  } catch (err) {
    console.warn('[MediaDelete] Failed to remove Supabase Storage object:', err);
    return { success: false };
  }
}

export async function uploadUserBrandMedia(
  userId: string,
  dataUrl: string,
  filename: string,
  userToken?: string,
  tier: string = 'basic'
): Promise<{
  success: boolean;
  url: string;
  path?: string;
  sizeBytes?: number;
  storageUsedBytes?: number;
  storageLimitBytes?: number;
  storage: 'supabase' | 'inline';
  status?: number;
  quotaExceeded?: boolean;
  error?: string;
}> {
  const cleanDataUrl = String(dataUrl || '').trim();
  if (!cleanDataUrl.startsWith('data:image/')) {
    return { success: false, url: cleanDataUrl, storage: 'inline', status: 400, error: 'Valid image dataUrl is required.' };
  }

  const match = cleanDataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!match) {
    return { success: false, url: '', storage: 'inline', status: 400, error: 'Invalid base64 image payload.' };
  }
  const mimeType = match[1];
  const buffer = Buffer.from(match[2], 'base64');
  const sizeBytes = buffer.byteLength;
  const storageLimitBytes = getStorageQuotaBytesForTier(tier);

  if (sizeBytes > MAX_SINGLE_MEDIA_BYTES) {
    return {
      success: false,
      url: '',
      sizeBytes,
      storageLimitBytes,
      storage: 'inline',
      status: 413,
      quotaExceeded: false,
      error: 'Compressed image still exceeds 1.5 MB limit. Please upload a smaller image.',
    };
  }

  const { url, key, configured } = getSupabaseCreds();
  if (!configured || !userId) {
    if (cleanDataUrl.length > MAX_INLINE_DATA_URL_CHARS) {
      return {
        success: false,
        url: '',
        sizeBytes,
        storageLimitBytes,
        storage: 'inline',
        status: 413,
        quotaExceeded: true,
        error: 'Image is too large for inline fallback storage. Please configure cloud media storage or compress further.',
      };
    }
    return {
      success: true,
      url: cleanDataUrl,
      sizeBytes,
      storageUsedBytes: sizeBytes,
      storageLimitBytes,
      storage: 'inline',
    };
  }

  const usedBytes = await getUserStorageUsageBytes(userId, userToken);
  if (usedBytes + sizeBytes > storageLimitBytes) {
    const usedMb = (usedBytes / (1024 * 1024)).toFixed(1);
    const limitMb = Math.round(storageLimitBytes / (1024 * 1024));
    return {
      success: false,
      url: '',
      sizeBytes,
      storageUsedBytes: usedBytes,
      storageLimitBytes,
      storage: 'supabase',
      status: 413,
      quotaExceeded: true,
      error: `Media storage quota reached (${usedMb} MB / ${limitMb} MB). Delete old images or upgrade your plan for more storage.`,
    };
  }

  try {
    const safeName = String(filename || `asset-${Date.now()}.webp`).replace(/[^a-zA-Z0-9._-]/g, '_');
    const objectPath = `${userId}/${Date.now()}-${safeName}`;
    const authHeader = userToken ? `Bearer ${userToken}` : `Bearer ${key}`;

    const res = await fetch(`${url}/storage/v1/object/brand-assets/${objectPath}`, {
      method: 'POST',
      headers: {
        apikey: key,
        Authorization: authHeader,
        'Content-Type': mimeType,
        'x-upsert': 'true',
      },
      body: buffer,
    });

    if (res.ok) {
      return {
        success: true,
        url: `${url}/storage/v1/object/public/brand-assets/${objectPath}`,
        path: objectPath,
        sizeBytes,
        storageUsedBytes: usedBytes + sizeBytes,
        storageLimitBytes,
        storage: 'supabase',
      };
    }

    const errTxt = await res.text().catch(() => '');
    return {
      success: false,
      url: '',
      sizeBytes,
      storageUsedBytes: usedBytes,
      storageLimitBytes,
      storage: 'supabase',
      status: res.status === 413 ? 413 : 502,
      quotaExceeded: res.status === 413,
      error: errTxt ? `Cloud storage upload failed (${res.status}): ${errTxt.slice(0, 180)}` : `Cloud storage upload failed (HTTP ${res.status}).`,
    };
  } catch (err: any) {
    console.warn('[MediaUpload] Supabase Storage error:', err);
    return {
      success: false,
      url: '',
      sizeBytes,
      storageUsedBytes: usedBytes,
      storageLimitBytes,
      storage: 'supabase',
      status: 502,
      error: err?.message || 'Cloud media upload failed.',
    };
  }
}

// ==========================================
// RSS / ATOM FEED PARSER & DISCOVERY PROXY
// ==========================================
export type ResearchTimeframe = '24h' | 'week' | 'month' | 'all';

export function cleanPlainText(str: string): string {
  let text = String(str || '').replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1');
  for (let pass = 0; pass < 3; pass++) {
    const decoded = text
      .replace(/&amp;/gi, '&')
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/&quot;/gi, '"')
      .replace(/&apos;|&#0*39;|&#x0*27;/gi, "'")
      .replace(/&rsquo;|&lsquo;/gi, "'")
      .replace(/&rdquo;|&ldquo;/gi, '"')
      .replace(/&ndash;|&mdash;/gi, '-')
      .replace(/&nbsp;/gi, ' ')
      .replace(/&#(\d+);/g, (_m, dec) => {
        const code = Number(dec);
        return Number.isFinite(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : ' ';
      })
      .replace(/&#x([0-9a-f]+);/gi, (_m, hex) => {
        const code = parseInt(hex, 16);
        return Number.isFinite(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : ' ';
      });
    if (decoded === text) break;
    text = decoded;
  }
  return text.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function decodeXmlEntities(str: string): string {
  return cleanPlainText(str);
}

function extractTag(xmlBlock: string, tagName: string): string {
  const regex = new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`, 'i');
  const match = xmlBlock.match(regex);
  return match ? match[1] : '';
}

function unwrapGoogleRedirectUrl(rawUrl: string): string {
  try {
    const u = new URL(rawUrl);
    if (u.hostname.includes('google.') && u.pathname === '/url') {
      const inner = u.searchParams.get('url') || u.searchParams.get('q');
      if (inner && inner.startsWith('http')) return inner;
    }
  } catch (_) {}
  return rawUrl;
}

export function detectPlatformFromUrl(url: string): string {
  const lower = String(url || '').toLowerCase();
  if (lower.includes('reddit.com')) return 'reddit';
  if (lower.includes('twitter.com') || lower.includes('x.com')) return 'twitter';
  if (lower.includes('youtube.com') || lower.includes('youtu.be')) return 'youtube';
  if (lower.includes('tiktok.com')) return 'tiktok';
  if (lower.includes('instagram.com')) return 'instagram';
  if (lower.includes('facebook.com') || lower.includes('fb.com') || lower.includes('fb.watch')) return 'facebook';
  if (lower.includes('threads.net') || lower.includes('threads.com')) return 'threads';
  if (lower.includes('pinterest.')) return 'pinterest';
  if (lower.includes('linkedin.com')) return 'linkedin';
  if (lower.includes('quora.com')) return 'quora';
  if (lower.includes('medium.com')) return 'medium';
  if (lower.includes('news.ycombinator.com')) return 'hackernews';
  return 'web';
}

function computeThreadIntentScore(opts: {
  title: string;
  snippet: string;
  platform: string;
  publishedAt: string;
  source: string;
  commentsCount?: number;
}): number {
  let score = 25;
  const hay = `${opts.title} ${opts.snippet}`.toLowerCase();
  if (/\b(alternative|alternatives|alternate|competitor|vs\.?|versus|switch(?:ing)? from|replace)\b/.test(hay)) score += 28;
  if (/\b(recommend|recommendation|looking for|anyone know|anyone use|anyone tried|what(?:'s| is) the best|best tool|best app|best software|suggest)\b/.test(hay)) score += 25;
  if (hay.includes('?')) score += 8;
  if (opts.platform === 'reddit' || opts.platform === 'twitter' || opts.platform === 'quora' || opts.platform === 'threads') score += 15;
  else if (opts.platform === 'hackernews') score += 13;
  else if (opts.platform === 'youtube' || opts.platform === 'linkedin' || opts.platform === 'tiktok' || opts.platform === 'instagram' || opts.platform === 'facebook' || opts.platform === 'medium') score += 8;
  if (String(opts.source || '').toLowerCase().includes('google alerts')) score += 10;
  if (typeof opts.commentsCount === 'number' && opts.commentsCount >= 5) score += 6;
  const pubMs = Date.parse(opts.publishedAt || '');
  if (Number.isFinite(pubMs)) {
    const ageHours = Math.max(0, (Date.now() - pubMs) / 3600000);
    if (ageHours <= 24) score += 15;
    else if (ageHours <= 72) score += 9;
    else if (ageHours <= 168) score += 4;
  }
  return Math.max(0, Math.min(100, score));
}

function normalizeTimeframe(raw?: string): ResearchTimeframe {
  if (raw === '24h' || raw === 'week' || raw === 'month' || raw === 'all') return raw;
  return 'week';
}

function getTimeframeCutoffMs(timeframe: ResearchTimeframe): number {
  const now = Date.now();
  if (timeframe === '24h') return now - 24 * 3600 * 1000;
  if (timeframe === 'week') return now - 7 * 24 * 3600 * 1000;
  if (timeframe === 'month') return now - 30 * 24 * 3600 * 1000;
  return 0;
}

function getGoogleWhenToken(timeframe: ResearchTimeframe): string {
  if (timeframe === '24h') return 'when:1d';
  if (timeframe === 'week') return 'when:7d';
  if (timeframe === 'month') return 'when:30d';
  return '';
}

function buildGoogleNewsRssUrl(query: string, timeframe: ResearchTimeframe): string {
  const whenToken = getGoogleWhenToken(timeframe);
  const fullQuery = whenToken ? `${query} ${whenToken}` : query;
  return `https://news.google.com/rss/search?q=${encodeURIComponent(fullQuery)}&hl=en-US&gl=US&ceid=US:en`;
}

function wrapTermForBooleanQuery(term: string): string {
  const clean = String(term || '').trim();
  if (!clean) return '';
  if (/[()"]|\bOR\b|\bAND\b|site:/i.test(clean)) return clean;
  const words = clean.split(/\s+/).filter(Boolean);
  if (words.length >= 4) return `(${clean})`;
  return words.length > 1 ? `"${clean}"` : clean;
}

function buildCompactOrChunks(terms: string[], maxTermsPerChunk = 4, maxCharsPerChunk = 190): string[] {
  const cleaned = Array.from(new Set(terms.map((t) => wrapTermForBooleanQuery(t)).filter(Boolean)));
  const chunks: string[] = [];
  let current: string[] = [];
  for (const expr of cleaned) {
    const wrapped = expr.startsWith('(') && expr.endsWith(')') ? expr : `(${expr})`;
    const candidate = [...current, wrapped].join(' OR ');
    if (current.length > 0 && (current.length >= maxTermsPerChunk || candidate.length > maxCharsPerChunk)) {
      chunks.push(current.length === 1 ? current[0] : `(${current.join(' OR ')})`);
      current = [wrapped];
    } else {
      current.push(wrapped);
    }
  }
  if (current.length > 0) {
    chunks.push(current.length === 1 ? current[0] : `(${current.join(' OR ')})`);
  }
  return chunks;
}

interface TermCandidate {
  label: string;
  tokens: string[];
  words: string[];
}

function buildTermCandidates(keywords: string[], compQueries: string[]): TermCandidate[] {
  const out: TermCandidate[] = [];
  const seen = new Set<string>();
  const addCandidate = (raw: string, isCompetitor = false) => {
    const clean = String(raw || '').trim();
    if (!clean) return;
    const stripped = clean
      .replace(/^"|"$/g, '')
      .replace(/\s*\((?:alternative|alternate|vs|site:[^)]+)[^)]*\)\s*/gi, '')
      .replace(/^["']|["']$/g, '')
      .trim();
    const hadCompGroup = /\([^)]*\b(?:alternative|alternate|vs)\b[^)]*\)/i.test(clean);
    const label = isCompetitor && stripped && (hadCompGroup || !/\b(?:alternative|alternate|vs)\b/i.test(clean))
      ? `${stripped} (alt/vs)`
      : (stripped || clean);
    const key = label.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    const baseLower = stripped.toLowerCase();
    const tokens = baseLower.length >= 2 ? [baseLower] : [];
    const words = baseLower.split(/\s+/).filter((w) => w.length >= 3);
    out.push({ label, tokens, words });
  };
  keywords.forEach((k) => addCandidate(k, false));
  compQueries.forEach((c) => addCandidate(c, true));
  return out;
}

function resolveMatchedTerm(
  title: string,
  snippet: string,
  url: string,
  fallbackTerm: string,
  candidates: TermCandidate[]
): string {
  if (!candidates || candidates.length === 0) return fallbackTerm;
  const hay = `${title} ${snippet} ${url}`.toLowerCase();
  for (const cand of candidates) {
    if (cand.tokens.some((tok) => hay.includes(tok))) {
      return cand.label;
    }
  }
  let best: string | null = null;
  let bestScore = 0;
  for (const cand of candidates) {
    if (!cand.words || cand.words.length < 2) continue;
    const hits = cand.words.filter((w) => hay.includes(w)).length;
    const ratio = hits / cand.words.length;
    if (hits >= 2 && ratio >= 0.6 && ratio > bestScore) {
      bestScore = ratio;
      best = cand.label;
    }
  }
  return best || fallbackTerm;
}

export interface DiscoveredThread {
  id: string;
  title: string;
  url: string;
  snippet: string;
  platform: string;
  matchedTerm: string;
  publishedAt: string;
  source: string;
  intentScore?: number;
  status: 'new' | 'queued' | 'dismissed';
}

export function parseRssOrAtomXml(
  xmlText: string,
  matchedTerm: string,
  sourceLabel: string,
  termCandidates: TermCandidate[] = []
): DiscoveredThread[] {
  const items: DiscoveredThread[] = [];
  if (!xmlText || typeof xmlText !== 'string') return items;

  // Atom <entry> (used by Google Alerts RSS & Reddit RSS)
  const entryBlocks = xmlText.match(/<entry[\s\S]*?<\/entry>/gi) || [];
  for (const block of entryBlocks.slice(0, 50)) {
    const rawTitle = extractTag(block, 'title');
    const title = decodeXmlEntities(rawTitle) || 'Untitled Discussion';
    const linkMatch = block.match(/<link[^>]*href=["']([^"']+)["'][^>]*\/?>/i);
    let link = linkMatch ? linkMatch[1] : decodeXmlEntities(extractTag(block, 'link'));
    link = unwrapGoogleRedirectUrl(link.replace(/&amp;/g, '&'));
    if (!link || !link.startsWith('http')) continue;

    const rawContent = extractTag(block, 'content') || extractTag(block, 'summary');
    const snippet = decodeXmlEntities(rawContent).slice(0, 240);
    const publishedAt =
      decodeXmlEntities(extractTag(block, 'published')) ||
      decodeXmlEntities(extractTag(block, 'updated')) ||
      new Date().toISOString();
    const platform = detectPlatformFromUrl(link);
    const resolvedTerm = resolveMatchedTerm(title, snippet, link, matchedTerm, termCandidates);

    items.push({
      id: `thr-${Buffer.from(link).toString('base64').replace(/[^a-zA-Z0-9]/g, '').slice(0, 18)}`,
      title,
      url: link,
      snippet,
      platform,
      matchedTerm: resolvedTerm,
      publishedAt,
      source: sourceLabel,
      intentScore: computeThreadIntentScore({ title, snippet, platform, publishedAt, source: sourceLabel }),
      status: 'new',
    });
  }

  if (items.length > 0) return items;

  // Standard RSS <item> (Google News / Blog RSS)
  const rssBlocks = xmlText.match(/<item[\s\S]*?<\/item>/gi) || [];
  for (const block of rssBlocks.slice(0, 50)) {
    const title = decodeXmlEntities(extractTag(block, 'title')) || 'Untitled Result';
    let link = decodeXmlEntities(extractTag(block, 'link'));
    link = unwrapGoogleRedirectUrl(link);
    if (!link || !link.startsWith('http')) continue;
    const snippet = decodeXmlEntities(extractTag(block, 'description')).slice(0, 240);
    const publishedAt = decodeXmlEntities(extractTag(block, 'pubDate')) || new Date().toISOString();
    const platform = detectPlatformFromUrl(link);
    const resolvedTerm = resolveMatchedTerm(title, snippet, link, matchedTerm, termCandidates);

    items.push({
      id: `thr-${Buffer.from(link).toString('base64').replace(/[^a-zA-Z0-9]/g, '').slice(0, 18)}`,
      title,
      url: link,
      snippet,
      platform,
      matchedTerm: resolvedTerm,
      publishedAt,
      source: sourceLabel,
      intentScore: computeThreadIntentScore({ title, snippet, platform, publishedAt, source: sourceLabel }),
      status: 'new',
    });
  }

  return items;
}

export async function fetchFeedSafe(
  feedUrl: string,
  matchedTerm: string,
  sourceLabel: string,
  termCandidates: TermCandidate[] = []
): Promise<DiscoveredThread[]> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 7000);
    try {
      const res = await fetch(feedUrl, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; SmartPosterResearch/1.3; +https://smartposter.pro)',
          Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9, */*;q=0.8',
        },
      });
      if (!res.ok) return [];
      const text = await res.text();
      return parseRssOrAtomXml(text, matchedTerm, sourceLabel, termCandidates);
    } finally {
      clearTimeout(timer);
    }
  } catch (_) {
    return [];
  }
}

async function fetchRedditSearchWithFallback(
  term: string,
  sort: 'new' | 'comments' = 'new',
  timeframe: ResearchTimeframe = 'week',
  termCandidates: TermCandidate[] = []
): Promise<DiscoveredThread[]> {
  const tParam = timeframe === '24h' ? 'day' : timeframe;
  const jsonUrl = `https://www.reddit.com/search.json?q=${encodeURIComponent(term)}&sort=${sort}&t=${tParam}&limit=25`;
  const rssUrl = `https://www.reddit.com/search.rss?q=${encodeURIComponent(term)}&sort=${sort}&t=${tParam}`;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 6500);
    try {
      const res = await fetch(jsonUrl, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; SmartPosterResearch/1.3; +https://smartposter.pro)',
          Accept: 'application/json',
        },
      });
      if (res.ok) {
        const data: any = await res.json().catch(() => null);
        const children = Array.isArray(data?.data?.children) ? data.data.children : [];
        if (children.length > 0) {
          return children
            .map((child: any) => child?.data)
            .filter((post: any) => post && post.permalink)
            .map((post: any) => {
              const url = `https://www.reddit.com${post.permalink}`;
              const title = cleanPlainText(post.title || 'Reddit Discussion') || 'Reddit Discussion';
              const selftext = cleanPlainText(post.selftext || '');
              const sub = post.subreddit ? `r/${post.subreddit}` : '';
              const commentsCount = Number(post.num_comments || 0);
              const snippet = (selftext || `${sub} · ${commentsCount} comments`).slice(0, 240);
              const publishedAt = post.created_utc ? new Date(Number(post.created_utc) * 1000).toISOString() : new Date().toISOString();
              const resolvedTerm = /[()]|\bOR\b/i.test(term)
                ? resolveMatchedTerm(title, snippet, url, term, termCandidates)
                : term;
              return {
                id: `thr-${Buffer.from(url).toString('base64').replace(/[^a-zA-Z0-9]/g, '').slice(0, 18)}`,
                title,
                url,
                snippet,
                platform: 'reddit',
                matchedTerm: resolvedTerm,
                publishedAt,
                source: 'Reddit Live Search',
                intentScore: computeThreadIntentScore({
                  title,
                  snippet,
                  platform: 'reddit',
                  publishedAt,
                  source: 'Reddit Live Search',
                  commentsCount,
                }),
                status: 'new' as const,
              };
            });
        }
      }
    } finally {
      clearTimeout(timer);
    }
  } catch (_) {}
  return fetchFeedSafe(rssUrl, term, 'Reddit Live Feed', termCandidates);
}

async function fetchHackerNewsSafe(
  term: string,
  timeframe: ResearchTimeframe = 'week',
  termCandidates: TermCandidate[] = []
): Promise<DiscoveredThread[]> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 6500);
    try {
      const cutoffMs = getTimeframeCutoffMs(timeframe);
      const numericFilter = cutoffMs > 0 ? `&numericFilters=created_at_i>${Math.floor(cutoffMs / 1000)}` : '';
      const hnQuery = term
        .replace(/\([^)]*\b(?:alternative|alternate|vs)\b[^)]*\)/gi, ' alternative')
        .replace(/[()"]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      if (!hnQuery) return [];
      const hnUrl = `https://hn.algolia.com/api/v1/search_by_date?query=${encodeURIComponent(hnQuery)}&tags=(story,ask_hn,show_hn)${numericFilter}&hitsPerPage=20`;
      const res = await fetch(hnUrl, {
        signal: controller.signal,
        headers: { Accept: 'application/json' },
      });
      if (!res.ok) return [];
      const data: any = await res.json().catch(() => null);
      const hits = Array.isArray(data?.hits) ? data.hits : [];
      return hits
        .filter((h: any) => h && (h.objectID || h.url))
        .map((h: any) => {
          const discussionUrl = h.objectID ? `https://news.ycombinator.com/item?id=${h.objectID}` : String(h.url || '');
          const title = cleanPlainText(h.title || h.story_title || 'Hacker News Discussion') || 'Hacker News Discussion';
          const commentsCount = Number(h.num_comments || 0);
          const snippet = cleanPlainText(h.story_text || '').slice(0, 240)
            || `${Number(h.points || 0)} points · ${commentsCount} comments on Hacker News`;
          const publishedAt = h.created_at || (h.created_at_i ? new Date(Number(h.created_at_i) * 1000).toISOString() : new Date().toISOString());
          const resolvedTerm = resolveMatchedTerm(title, snippet, discussionUrl, hnQuery, termCandidates);
          return {
            id: `thr-${Buffer.from(discussionUrl).toString('base64').replace(/[^a-zA-Z0-9]/g, '').slice(0, 18)}`,
            title,
            url: discussionUrl,
            snippet,
            platform: 'hackernews',
            matchedTerm: resolvedTerm,
            publishedAt,
            source: 'Hacker News Live',
            intentScore: computeThreadIntentScore({
              title,
              snippet,
              platform: 'hackernews',
              publishedAt,
              source: 'Hacker News Live',
              commentsCount,
            }),
            status: 'new' as const,
          };
        });
    } finally {
      clearTimeout(timer);
    }
  } catch (_) {
    return [];
  }
}

async function runInBatches<T>(tasks: Array<() => Promise<T>>, batchSize = 8): Promise<T[]> {
  const results: T[] = [];
  for (let i = 0; i < tasks.length; i += batchSize) {
    const slice = tasks.slice(i, i + batchSize);
    const chunk = await Promise.all(slice.map((fn) => fn().catch(() => ([] as unknown as T))));
    results.push(...chunk);
  }
  return results;
}

const SITE_RSS_PLATFORMS: Array<{ key: string; label: string; siteExpr: string }> = [
  { key: 'twitter', label: 'X / Twitter Index RSS', siteExpr: '(site:x.com OR site:twitter.com)' },
  { key: 'youtube', label: 'YouTube Index RSS', siteExpr: 'site:youtube.com' },
  { key: 'linkedin', label: 'LinkedIn Index RSS', siteExpr: 'site:linkedin.com' },
  { key: 'quora', label: 'Quora Index RSS', siteExpr: 'site:quora.com' },
  { key: 'medium', label: 'Medium Index RSS', siteExpr: 'site:medium.com' },
];

export async function runResearchDiscovery(params: {
  keywords?: string[];
  competitorQueries?: string[];
  platforms?: Record<string, boolean>;
  alertFeeds?: { url: string; term?: string; label?: string }[];
  quality?: 'best' | 'all';
  timeframe?: ResearchTimeframe;
}): Promise<{ threads: DiscoveredThread[]; feedsChecked: number; timeframe: ResearchTimeframe }> {
  const keywords = (params.keywords || []).map((k) => String(k || '').trim()).filter(Boolean);
  const compQueries = (params.competitorQueries || []).map((q) => String(q || '').trim()).filter(Boolean);
  const allTerms = Array.from(new Set([...keywords, ...compQueries])).slice(0, 25);
  const timeframe = normalizeTimeframe(params.timeframe);
  const rawPlatforms = params.platforms && typeof params.platforms === 'object' ? params.platforms : {};
  const platforms: Record<string, boolean> = Object.keys(rawPlatforms).length > 0
    ? rawPlatforms
    : {
        reddit: true,
        twitter: true,
        youtube: true,
        linkedin: true,
        web: true,
        hackernews: true,
        quora: true,
        medium: true,
      };
  const alertFeeds = (params.alertFeeds || []).filter((f) => f && f.url && f.url.startsWith('http'));
  const termCandidates = buildTermCandidates(keywords, compQueries);
  const defaultFallbackLabel = termCandidates[0]?.label || keywords[0] || 'Opportunity';

  const tasks: Array<() => Promise<DiscoveredThread[]>> = [];
  let feedsChecked = 0;

  // 1. User's linked Google Alerts RSS feeds (highest precision, up to 35 feeds)
  for (const feed of alertFeeds.slice(0, 35)) {
    feedsChecked++;
    tasks.push(() => fetchFeedSafe(feed.url, feed.term || feed.label || 'Google Alert', 'Google Alerts RSS', termCandidates));
  }

  // 2. Compact OR-grouped Multi-Platform Discovery
  if (allTerms.length > 0) {
    if (platforms.reddit === true) {
      const redditChunks = buildCompactOrChunks(allTerms, 4, 190).slice(0, 6);
      for (const chunk of redditChunks) {
        feedsChecked++;
        tasks.push(() => fetchRedditSearchWithFallback(chunk, 'new', timeframe, termCandidates));
      }
    }

    if (platforms.hackernews === true) {
      for (const term of allTerms.slice(0, 10)) {
        feedsChecked++;
        tasks.push(() => fetchHackerNewsSafe(term, timeframe, termCandidates));
      }
    }

    const webChunks = buildCompactOrChunks(allTerms, 4, 180).slice(0, 6);
    const activeSiteExprs = SITE_RSS_PLATFORMS
      .filter((sp) => platforms[sp.key] === true)
      .map((sp) => sp.siteExpr);

    if (activeSiteExprs.length > 0) {
      const siteGroupExpr = activeSiteExprs.length === 1 ? activeSiteExprs[0] : `(${activeSiteExprs.join(' OR ')})`;
      for (const chunk of webChunks) {
        feedsChecked++;
        const rss = buildGoogleNewsRssUrl(`${chunk} ${siteGroupExpr}`, timeframe);
        tasks.push(() => fetchFeedSafe(rss, defaultFallbackLabel, 'Platform Index RSS', termCandidates));
      }
    }

    if (platforms.web === true) {
      for (const chunk of webChunks) {
        feedsChecked++;
        const webRss = buildGoogleNewsRssUrl(chunk, timeframe);
        tasks.push(() => fetchFeedSafe(webRss, defaultFallbackLabel, 'Web Discovery RSS', termCandidates));
      }
    }
  }

  const results = await runInBatches(tasks, 6);
  const flat = results.flat();
  const cutoffMs = getTimeframeCutoffMs(timeframe);

  // Deduplicate by normalized URL and apply strict timeframe floor
  const seen = new Set<string>();
  const deduped: DiscoveredThread[] = [];
  for (const item of flat) {
    if (!item || !item.url) continue;
    if (cutoffMs > 0) {
      const pubMs = Date.parse(item.publishedAt || '');
      if (Number.isFinite(pubMs) && pubMs > 0 && pubMs < cutoffMs) continue;
    }
    const normUrl = item.url.split('#')[0].replace(/\/+$/, '').toLowerCase();
    if (seen.has(normUrl)) continue;
    seen.add(normUrl);
    deduped.push(item);
  }

  // Sort by recency within high-intent tiers (newest first, with tie-break by intent)
  deduped.sort((a, b) => {
    const timeDiff = (Date.parse(b.publishedAt || '') || 0) - (Date.parse(a.publishedAt || '') || 0);
    if (Math.abs(timeDiff) > 3600000) return timeDiff;
    return Number(b.intentScore || 0) - Number(a.intentScore || 0);
  });

  const limit = params.quality === 'best' ? 150 : 300;
  return { threads: deduped.slice(0, limit), feedsChecked, timeframe };
}
