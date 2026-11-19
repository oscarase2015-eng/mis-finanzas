import { useRef, useState } from 'react';
import { save, type Account } from '../db';
import { Modal } from './ui';

/** Color de fondo de la tarjeta de una cuenta (negro por defecto) */
export const faceColor = (a: Pick<Account, 'faceColor'>) => a.faceColor || '#000000';

function hexToRgb(hex: string) {
  const n = parseInt(hex.replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
/** true si el color es claro (entonces el texto va oscuro) */
export function isLight(hex: string) {
  const [r, g, b] = hexToRgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.36;
}
/** Estilo de la cara de la tarjeta: color de fondo, mismo patrón de puntos, texto legible */
export function faceStyle(a: Pick<Account, 'faceColor'>): React.CSSProperties {
  const bg = faceColor(a);
  const light = isLight(bg);
  return {
    backgroundColor: bg,
    color: light ? '#111' : '#f2f2f4',
    ['--face-muted' as string]: light ? 'rgba(0,0,0,0.55)' : '#9a9ba1',
    ['--face-dot' as string]: light ? 'rgba(0,0,0,0.09)' : 'rgba(255,255,255,0.07)',
    ['--face-line' as string]: light ? 'rgba(0,0,0,0.14)' : 'rgba(255,255,255,0.12)',
  };
}

function hsvToHex(h: number, s: number, v: number) {
  const f = (n: number) => {
    const k = (n + h / 60) % 6;
    return v - v * s * Math.max(0, Math.min(k, 4 - k, 1));
  };
  return '#' + [f(5), f(3), f(1)].map((x) => Math.round(x * 255).toString(16).padStart(2, '0')).join('');
}
function hexToHsv(hex: string) {
  const [r, g, b] = hexToRgb(hex).map((x) => x / 255);
  const max = Math.max(r, g, b);
  const d = max - Math.min(r, g, b);
  let h = 0;
  if (d) h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return { h: (h * 60 + 360) % 360, s: max ? d / max : 0, v: max };
}

const PRESETS = ['#000000', '#1c1d21', '#3a3b40', '#6e6f76', '#d71921', '#e8e6df', '#ffffff'];

export function ColorWheelModal({ account, also = [], onClose, onMore }: { account: Account; also?: Account[]; onClose: () => void; onMore?: () => void }) {
  const start = hexToHsv(faceColor(account));
  const [h, setH] = useState(start.h);
  const [sat, setSat] = useState(start.s);
  const [v, setV] = useState(start.v);
  const wheel = useRef<HTMLDivElement>(null);
  const color = hsvToHex(h, sat, v);

  const pick = (e: React.PointerEvent) => {
    const r = wheel.current!.getBoundingClientRect();
    const dx = e.clientX - (r.left + r.width / 2);
    const dy = e.clientY - (r.top + r.height / 2);
    const rad = r.width / 2;
    setH(((Math.atan2(dx, -dy) * 180) / Math.PI + 360) % 360);
    setSat(Math.min(1, Math.hypot(dx, dy) / rad));
    if (v < 0.15) setV(1);
  };
  const setHex = (hex: string) => {
    const x = hexToHsv(hex);
    setH(x.h);
    setSat(x.s);
    setV(x.v);
  };
  const ang = (h * Math.PI) / 180;

  return (
    <Modal
      title="Color de la tarjeta"
      onClose={onClose}
      footer={
        <>
          {onMore && (
            <button className="btn ghost" onClick={onMore}>
              Editar datos
            </button>
          )}
          <span className="spacer" />
          <button className="btn" onClick={onClose}>
            Cancelar
          </button>
          <button
            className="btn primary"
            onClick={async () => {
              for (const x of [account, ...also]) await save<Account>('accounts', { id: x.id, faceColor: color });
              onClose();
            }}
          >
            Guardar
          </button>
        </>
      }
    >
      <div className="cw">
        <div className="acc-face cw-preview" style={faceStyle({ faceColor: color })}>
          <div className="acc-face-top">
            <span className="grow">{account.name}</span>
            <span className="cc-face-chip" />
          </div>
          <span className="acc-face-amount">L 0.00</span>
        </div>
        <div
          ref={wheel}
          className="cw-wheel"
          style={{ ['--v' as string]: String(1 - v) }}
          onPointerDown={(e) => {
            (e.target as Element).setPointerCapture(e.pointerId);
            pick(e);
          }}
          onPointerMove={(e) => e.buttons && pick(e)}
          role="slider"
          aria-label="Rueda de color"
          aria-valuenow={Math.round(h)}
        >
          <span className="cw-marker" style={{ left: `${50 + 50 * sat * Math.sin(ang)}%`, top: `${50 - 50 * sat * Math.cos(ang)}%`, background: color }} />
        </div>
        <label className="cw-row">
          <span className="small muted">Brillo</span>
          <input type="range" min={0} max={100} value={Math.round(v * 100)} onChange={(e) => setV(Number(e.target.value) / 100)} style={{ ['--to' as string]: hsvToHex(h, sat, 1) }} className="cw-range" />
        </label>
        <div className="cw-presets">
          {PRESETS.map((p) => (
            <button key={p} type="button" className={`swatch ${p === color ? 'on' : ''}`} style={{ background: p, border: '1px solid var(--line)' }} onClick={() => setHex(p)} aria-label={p} />
          ))}
          <span className="cw-hex">{color.toUpperCase()}</span>
        </div>
      </div>
    </Modal>
  );
}
