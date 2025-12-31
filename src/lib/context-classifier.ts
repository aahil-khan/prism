import type { PageEvent } from "~/types/page-event"

/**
 * Classifies pages into context categories using pattern recognition
 * instead of hardcoded domain lists
 */

export type PageContext = 
  | 'development'
  | 'learning'
  | 'shopping'
  | 'research'
  | 'social'
  | 'entertainment'
  | 'productivity'
  | 'news'
  | 'general'

/**
 * Classify a page into a context category using URL patterns and title signals
 */
export function classifyPageContext(page: PageEvent): PageContext {
  try {
    const url = new URL(page.url)
    const domain = url.hostname.toLowerCase()
    const path = url.pathname.toLowerCase()
    const title = (page.title || '').toLowerCase()

    // Development signals
    if (
      domain.includes('github') ||
      domain.includes('gitlab') ||
      domain.includes('bitbucket') ||
      domain.includes('stackoverflow') ||
      domain.includes('stackexchange') ||
      domain.includes('npmjs') ||
      title.includes('documentation') ||
      title.includes('api reference') ||
      title.includes('api docs') ||
      path.includes('/docs/') ||
      path.includes('/api/') ||
      path.includes('/reference/') ||
      domain.endsWith('.dev')
    ) {
      return 'development'
    }

    // Learning signals
    if (
      domain.includes('youtube') && (title.includes('tutorial') || title.includes('how to') || title.includes('learn')) ||
      domain.includes('udemy') ||
      domain.includes('coursera') ||
      domain.includes('edx') ||
      domain.includes('khanacademy') ||
      domain.includes('pluralsight') ||
      domain.includes('codecademy') ||
      domain.includes('freecodecamp') ||
      title.includes('tutorial') ||
      title.includes('how to') ||
      title.includes('learn') ||
      title.includes('course') ||
      title.includes('lesson') ||
      domain.endsWith('.edu')
    ) {
      return 'learning'
    }

    // Shopping signals
    if (
      domain.includes('amazon') ||
      domain.includes('ebay') ||
      domain.includes('etsy') ||
      domain.includes('shopify') ||
      domain.includes('aliexpress') ||
      path.includes('/cart') ||
      path.includes('/checkout') ||
      path.includes('/product') ||
      path.includes('/shop') ||
      title.includes('buy') ||
      title.includes('shop') ||
      title.includes('cart') ||
      title.includes('price') ||
      title.includes('deal')
    ) {
      return 'shopping'
    }

    // Research signals
    if (
      domain.includes('wikipedia') ||
      domain.includes('arxiv') ||
      domain.includes('scholar.google') ||
      domain.includes('researchgate') ||
      domain.includes('jstor') ||
      domain.includes('pubmed') ||
      title.includes('paper') ||
      title.includes('research') ||
      title.includes('study') ||
      title.includes('journal') ||
      title.includes('article') ||
      path.includes('/wiki/')
    ) {
      return 'research'
    }

    // Social media signals
    if (
      domain.includes('twitter') ||
      domain.includes('x.com') ||
      domain.includes('reddit') ||
      domain.includes('linkedin') ||
      domain.includes('facebook') ||
      domain.includes('instagram') ||
      domain.includes('tiktok') ||
      domain.includes('discord') ||
      domain.includes('slack') && !path.includes('/apps/') || // Exclude Slack app pages
      title.includes('tweet') ||
      title.includes('post') ||
      path.includes('/status/') ||
      path.includes('/r/')
    ) {
      return 'social'
    }

    // Entertainment signals
    if (
      domain.includes('youtube') && !title.includes('tutorial') ||
      domain.includes('netflix') ||
      domain.includes('hulu') ||
      domain.includes('twitch') ||
      domain.includes('spotify') ||
      domain.includes('vimeo') ||
      domain.includes('imgur') ||
      title.includes('watch') ||
      title.includes('stream') ||
      title.includes('video') ||
      title.includes('music') ||
      path.includes('/watch')
    ) {
      return 'entertainment'
    }

    // Productivity signals
    if (
      domain.includes('notion') ||
      domain.includes('trello') ||
      domain.includes('asana') ||
      domain.includes('jira') ||
      domain.includes('monday') ||
      domain.includes('airtable') ||
      domain.includes('google.com/calendar') ||
      domain.includes('docs.google') ||
      domain.includes('sheets.google') ||
      domain.includes('drive.google') ||
      domain.includes('mail.google') ||
      domain.includes('outlook') ||
      title.includes('calendar') ||
      title.includes('tasks') ||
      title.includes('notes')
    ) {
      return 'productivity'
    }

    // News signals
    if (
      domain.includes('news') ||
      domain.includes('nytimes') ||
      domain.includes('bbc') ||
      domain.includes('cnn') ||
      domain.includes('reuters') ||
      domain.includes('bloomberg') ||
      domain.includes('techcrunch') ||
      domain.includes('theverge') ||
      domain.includes('medium') && title.includes('news') ||
      domain.endsWith('.news') ||
      title.includes('breaking') ||
      title.includes('headlines')
    ) {
      return 'news'
    }

    // Default to general
    return 'general'
  } catch (error) {
    // If URL parsing fails, return general
    return 'general'
  }
}

/**
 * Check if two pages belong to the same context
 */
export function isSameContext(page1: PageEvent, page2: PageEvent): boolean {
  return classifyPageContext(page1) === classifyPageContext(page2)
}
