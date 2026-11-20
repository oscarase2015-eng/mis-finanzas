/**
 * Íconos de línea (mismo trazo que el menú de navegación).
 * Las categorías y objetivos guardan un nombre de ícono; los datos viejos traían
 * emojis, así que también se traducen aquí.
 */
export const GLYPHS: Record<string, string> = {
  cart: 'M3 4h2l2.4 10.2a1 1 0 0 0 1 .8h8.9a1 1 0 0 0 1-.8L20 8H6.2M9 19.5h.01M17 19.5h.01',
  home: 'M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z',
  bolt: 'M13 3L5 13h6l-1 8 8-10h-6z',
  car: 'M5 16V11l2-5h10l2 5v5M3 16h18v3h-3v-3M6 16v3H3M7.5 13h.01M16.5 13h.01',
  health: 'M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.5-7 10-7 10zM12 9v5M9.5 11.5h5',
  school: 'M2 9l10-5 10 5-10 5zM6 11v5c3 2 9 2 12 0v-5M22 9v6',
  shirt: 'M8 3l-5 3 2 4 3-1.5V21h8V8.5L19 10l2-4-5-3c-.5 1.5-2 2.5-4 2.5S8.5 4.5 8 3z',
  film: 'M4 5h16v14H4zM4 9h16M4 15h16M8 5v4M16 5v4M8 15v4M16 15v4',
  family: 'M8 8a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zM16 8a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zM3 21v-6a5 5 0 0 1 10 0M11 21v-5a5 5 0 0 1 10 0v5',
  bank: 'M3 9l9-5 9 5M5 10v8M10 10v8M14 10v8M19 10v8M3 20h18',
  gift: 'M4 11h16v9H4zM3 7h18v4H3zM12 7v13M12 7c-1-3-5-4-5-1.5S12 7 12 7zM12 7c1-3 5-4 5-1.5S12 7 12 7z',
  box: 'M3 7l9-4 9 4v10l-9 4-9-4zM3 7l9 4 9-4M12 11v10',
  briefcase: 'M3 7h18v13H3zM8 7V4h8v3M3 12h18',
  party: 'M4 20l5-13 8 8zM14 4v2M18 6l-1.5 1.5M20 10h-2M15 9c1-1 2-1 3 0',
  send: 'M21 3L10 14M21 3l-7 18-4-7-7-4z',
  store: 'M4 9l1.5-5h13L20 9M4 9h16v2a3 3 0 0 1-6 0 3 3 0 0 1-4 0 3 3 0 0 1-6 0zM5 13v7h14v-7M10 20v-4h4v4',
  trend: 'M3 17l6-6 4 4 8-8M15 7h6v6',
  key: 'M14 10a4 4 0 1 0-4.6 3.95L3 20v1h3v-2h2v-2h2l1.05-1.05A4 4 0 0 0 14 10zM15.5 8.5h.01',
  undo: 'M9 14L4 9l5-5M4 9h10a6 6 0 0 1 0 12h-3',
  plus: 'M12 5v14M5 12h14',
  tag: 'M3 12V4h8l10 10-8 8zM7.5 7.5h.01',
  target: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM12 12h.01',
  card: 'M3 7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM3 10h18M7 15h4',
  cash: 'M3 6h18v12H3zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM6 9v.01M18 15v.01',
  piggy: 'M5 11a7 6 0 0 1 12-2h2l1 3-2 1v3l-2 1v2h-3v-1.5a8 8 0 0 1-3 0V20H7v-2.5A6 6 0 0 1 5 11zM15 10h.01M9 7.5h4',
  phone: 'M7 3h10v18H7zM11 18h2',
  wallet: 'M3 7a2 2 0 0 1 2-2h12v4M3 7v11a2 2 0 0 0 2 2h15V9H5a2 2 0 0 1-2-2zM16 14.5h.01',
  swap: 'M7 4L3 8l4 4M3 8h14M17 20l4-4-4-4M21 16H7',
  down: 'M12 4v16M5 13l7 7 7-7',
  inbox: 'M4 13l2-8h12l2 8M4 13v6h16v-6M4 13h5l1 2h4l1-2h5',
  handshake: 'M12 3v18M17 7.5c0-1.9-2.2-3-5-3s-5 1.1-5 3 2.2 2.8 5 3.5 5 1.6 5 3.5-2.2 3-5 3-5-1.1-5-3',
  list: 'M4 6h16M4 12h16M4 18h10',
  gear: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z',
  plane: 'M10 14l-7-3 2-2 7 1 4-5c1-1 3-1 3 0s-1 2-2 3l-5 4 1 7-2 2-3-7z',
  ring: 'M12 21a6 6 0 1 0 0-12 6 6 0 0 0 0 12zM9 4h6l-3 5z',
  shield: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z',
  laptop: 'M5 5h14v10H5zM2 19h20',
  baby: 'M12 21a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM12 7c0-2 1-4 3-4M9.5 13h.01M14.5 13h.01M10 16.5c1 .7 3 .7 4 0',
  sun: 'M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4',
  chart: 'M4 20V10M10 20V4M16 20v-7M22 20H2',
  repeat: 'M17 2l4 4-4 4M3 11V9a3 3 0 0 1 3-3h15M7 22l-4-4 4-4M21 13v2a3 3 0 0 1-3 3H3',
  check: 'M5 12l5 5 9-10',
  alert: 'M12 3l10 18H2zM12 10v5M12 18h.01',
};

const EMOJI: Record<string, string> = {
  '🛒': 'cart', '🏠': 'home', '💡': 'bolt', '🚗': 'car', '🩺': 'health', '🎓': 'school', '👕': 'shirt', '🎬': 'film',
  '👨‍👩‍👧': 'family', '🏦': 'bank', '🎁': 'gift', '📦': 'box', '💼': 'briefcase', '🎉': 'party', '💸': 'send', '🏪': 'store',
  '📈': 'trend', '🔑': 'key', '↩️': 'undo', '➕': 'plus', '📁': 'tag', '🎯': 'target', '💳': 'card', '💵': 'cash', '🐷': 'piggy',
  '📱': 'phone', '✈️': 'plane', '💍': 'ring', '🛟': 'shield', '💻': 'laptop', '👶': 'baby', '🏖️': 'sun', '🏥': 'health',
};

/** Ícono a partir de un nombre o de un emoji guardado en datos antiguos */
export const glyphKey = (v?: string | null) => (v && GLYPHS[v] ? v : (v && EMOJI[v]) || 'tag');

export function Glyph({ name, size = 20, className }: { name?: string | null; size?: number; className?: string }) {
  const k = glyphKey(name);
  return (
    <svg className={`glyph ${className ?? ''}`} viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={GLYPHS[k]} />
    </svg>
  );
}

/** Íconos que se pueden elegir para categorías y objetivos */
export const PICKABLE = ['cart', 'home', 'bolt', 'car', 'health', 'school', 'shirt', 'film', 'family', 'bank', 'gift', 'box', 'briefcase', 'party', 'send', 'store', 'trend', 'key', 'target', 'card', 'cash', 'piggy', 'phone', 'plane', 'ring', 'shield', 'laptop', 'baby', 'sun', 'tag'];

export function GlyphPicker({ value, onChange }: { value: string; onChange: (k: string) => void }) {
  const cur = glyphKey(value);
  return (
    <div className="icon-pick">
      {PICKABLE.map((k) => (
        <button type="button" key={k} className={k === cur ? 'on' : ''} onClick={() => onChange(k)} aria-label={k}>
          <Glyph name={k} />
        </button>
      ))}
    </div>
  );
}
