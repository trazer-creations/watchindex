export function platformLabel(slug: string): string {
  return slug
    .split('-')
    .map((w) => (w === 'tv' ? 'TV' : w[0].toUpperCase() + w.slice(1)))
    .join(' ');
}

export function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-US', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}
