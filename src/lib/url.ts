export function publicSurveyUrl(slug: string): string {
  return `${window.location.origin}/s/${slug}`
}
