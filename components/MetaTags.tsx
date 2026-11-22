import React, { useEffect } from 'react';

interface MetaTagsProps {
  title: string;
  description: string;
  canonicalUrl: string;
  ogType?: string;
  schemaData?: object;
  noIndex?: boolean;
}

const MetaTags: React.FC<MetaTagsProps> = ({
  title,
  description,
  canonicalUrl,
  ogType = 'website',
  schemaData,
  noIndex = false
}) => {
  useEffect(() => {
    // 1. Update Title
    document.title = title;

    // Helper to get or create meta tag element
    const getOrCreateMeta = (nameOrProperty: string, attrName: 'name' | 'property' = 'name') => {
      let element = document.querySelector(`meta[${attrName}="${nameOrProperty}"]`);
      if (!element) {
        element = document.createElement('meta');
        element.setAttribute(attrName, nameOrProperty);
        document.head.appendChild(element);
      }
      return element;
    };

    // 2. Update standard metadata
    getOrCreateMeta('description').setAttribute('content', description);
    getOrCreateMeta('robots').setAttribute('content', noIndex ? 'noindex, nofollow' : 'index, follow');

    // 3. Update Open Graph Metadata
    getOrCreateMeta('og:title', 'property').setAttribute('content', title);
    getOrCreateMeta('og:description', 'property').setAttribute('content', description);
    getOrCreateMeta('og:url', 'property').setAttribute('content', canonicalUrl);
    getOrCreateMeta('og:type', 'property').setAttribute('content', ogType);
    getOrCreateMeta('og:site_name', 'property').setAttribute('content', 'Cosmic Council');
    getOrCreateMeta('og:image', 'property').setAttribute('content', 'https://www.cosmiccouncil.pro/favicon.png');

    // 4. Update Twitter Card Metadata
    getOrCreateMeta('twitter:card').setAttribute('content', 'summary_large_image');
    getOrCreateMeta('twitter:title').setAttribute('content', title);
    getOrCreateMeta('twitter:description').setAttribute('content', description);
    getOrCreateMeta('twitter:image').setAttribute('content', 'https://www.cosmiccouncil.pro/favicon.png');

    // 5. Update Canonical Link
    let canonicalLink = document.querySelector('link[rel="canonical"]');
    if (!canonicalLink) {
      canonicalLink = document.createElement('link');
      canonicalLink.setAttribute('rel', 'canonical');
      document.head.appendChild(canonicalLink);
    }
    canonicalLink.setAttribute('href', canonicalUrl);

    // 6. Update/Inject Schema JSON-LD
    let schemaScript = document.querySelector('script[type="application/ld+json"]#page-schema');
    if (schemaData) {
      if (!schemaScript) {
        schemaScript = document.createElement('script');
        schemaScript.setAttribute('type', 'application/ld+json');
        schemaScript.setAttribute('id', 'page-schema');
        document.head.appendChild(schemaScript);
      }
      schemaScript.textContent = JSON.stringify(schemaData);
    } else {
      if (schemaScript) {
        schemaScript.remove();
      }
    }
  }, [title, description, canonicalUrl, ogType, schemaData]);

  return null;
};

export default MetaTags;
