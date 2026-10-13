/**
 * Helper cập nhật Title và Meta SEO động theo ngữ cảnh trang / tab / việc làm
 */
export function updateSEO({ title, description, keywords, canonicalUrl }) {
  if (typeof document === 'undefined') return;

  // Cập nhật Document Title
  if (title) {
    document.title = title.includes('WorkLink') ? title : `${title} | WorkLink`;
  }

  // Cập nhật Meta Description
  if (description) {
    let metaDesc = document.querySelector('meta[name="description"]');
    if (!metaDesc) {
      metaDesc = document.createElement('meta');
      metaDesc.name = 'description';
      document.head.appendChild(metaDesc);
    }
    metaDesc.content = description;

    let ogDesc = document.querySelector('meta[property="og:description"]');
    if (ogDesc) ogDesc.content = description;
  }

  // Cập nhật Meta Keywords
  if (keywords) {
    let metaKeywords = document.querySelector('meta[name="keywords"]');
    if (!metaKeywords) {
      metaKeywords = document.createElement('meta');
      metaKeywords.name = 'keywords';
      document.head.appendChild(metaKeywords);
    }
    metaKeywords.content = keywords;
  }

  // Cập nhật Canonical
  if (canonicalUrl) {
    let canonical = document.querySelector('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement('link');
      canonical.rel = 'canonical';
      document.head.appendChild(canonical);
    }
    canonical.href = canonicalUrl;
  }
}
