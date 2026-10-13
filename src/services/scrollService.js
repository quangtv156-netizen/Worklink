/**
 * WorkLink Smooth Auto-Scroll Service
 * Provides smooth, reliable scrolling to sections across the app with sticky header offset.
 */

export const scrollToElement = (elementId, offset = 80, delay = 50) => {
  setTimeout(() => {
    const el = document.getElementById(elementId);
    if (el) {
      const elementPosition = el.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.pageYOffset - offset;

      window.scrollTo({
        top: Math.max(0, offsetPosition),
        behavior: 'smooth'
      });
    }
  }, delay);
};

export const scrollToJobResults = (delay = 120) => {
  scrollToElement('job-results-section', 85, delay);
};

export const scrollToFilterBar = (delay = 50) => {
  scrollToElement('filter-bar-section', 85, delay);
};

export const scrollToTop = () => {
  window.scrollTo({
    top: 0,
    behavior: 'smooth'
  });
};
