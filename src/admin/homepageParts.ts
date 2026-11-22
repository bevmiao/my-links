import type { HomepageContent } from '../../shared/types'
import type { HomepageSectionBody, HomepageSectionRoute } from '../lib/api'

/** Route name and request body for each separately saved part of the homepage draft. */
export const HOMEPAGE_PARTS: {
  route: HomepageSectionRoute
  body: (d: HomepageContent) => HomepageSectionBody[HomepageSectionRoute]
}[] = [
  { route: 'sections', body: (d) => ({ items: d.sections }) },
  { route: 'intro', body: (d) => d.intro },
  { route: 'contact', body: (d) => d.contact },
  { route: 'skills', body: (d) => ({ items: d.skills }) },
  { route: 'open-to', body: (d) => ({ sentence: d.openTo }) },
  { route: 'story', body: (d) => d.story },
]

/** Which save route holds each field of HomepageContent (used to clear field errors on edit). */
export const ROUTE_FOR: Record<keyof HomepageContent, HomepageSectionRoute> = {
  sections: 'sections',
  intro: 'intro',
  contact: 'contact',
  skills: 'skills',
  openTo: 'open-to',
  story: 'story',
}

/** Parts whose local edits differ from the saved draft. */
export function changedParts(saved: HomepageContent, draft: HomepageContent) {
  return HOMEPAGE_PARTS.filter((p) => JSON.stringify(p.body(saved)) !== JSON.stringify(p.body(draft)))
}
