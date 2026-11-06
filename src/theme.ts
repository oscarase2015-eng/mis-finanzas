export type Theme = 'auto' | 'light' | 'dark';

export function getTheme(): Theme {
  try {
    return (localStorage.getItem('theme') as Theme) || 'auto';
  } catch {
    return 'auto';
  }
}

export function applyTheme(t: Theme = getTheme()) {
  try {
    localStorage.setItem('theme', t);
  } catch {
    /* sin almacenamiento */
  }
  if (t === 'auto') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.setAttribute('data-theme', t);
}

export function remember(key: string, value?: string): string | null {
  try {
    if (value !== undefined) localStorage.setItem(key, value);
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
