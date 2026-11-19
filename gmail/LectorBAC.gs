/**
 * Mis Finanzas · Lector de notificaciones de BAC Credomatic (Google Apps Script)
 *
 * Revisa tu Gmail cada 5 minutos, lee las notificaciones de BAC y las manda
 * a la bandeja "Por revisar" de la app. Tú solo confirmas cuenta y categoría.
 *
 * Instalación (una sola vez):
 *  1. Entra a https://script.google.com con tu cuenta de Gmail > Nuevo proyecto.
 *  2. Borra lo que trae y pega este archivo completo. Guarda.
 *  3. Configuración del proyecto (engranaje) > Propiedades del script > agrega:
 *       APP_EMAIL     = el correo con el que entras a Mis Finanzas
 *       APP_PASSWORD  = la contraseña de Mis Finanzas
 *  4. Arriba elige la función "probar" > Ejecutar. Acepta los permisos.
 *     En "Registro de ejecución" verás los gastos que encontró (no envía nada).
 *  5. Elige la función "instalar" > Ejecutar. Desde ahí corre solo cada 5 minutos.
 */

const SUPABASE_URL = 'https://klpclwfywtiqyoszjhsx.supabase.co';
const SUPABASE_KEY = 'sb_publishable_Vp_ysb05JlUUXMFpN4e0MQ_MBh73jC2'; // llave pública (no es secreta)
const BUSQUEDA = '(from:baccredomatic.com OR "BAC Credomatic") newer_than:7d';
const ETIQUETA = 'finanzas-registrado';

/** Corre cada 5 minutos: lee correos nuevos y los envía a la app */
function revisarCorreos() {
  const etiqueta = GmailApp.getUserLabelByName(ETIQUETA) || GmailApp.createLabel(ETIQUETA);
  const hilos = GmailApp.search(BUSQUEDA, 0, 100).filter(function (h) {
    return !h.getLabels().some(function (l) { return l.getName() === ETIQUETA; });
  });
  const items = [];
  const listos = [];
  hilos.forEach(function (hilo) {
    let todos = true;
    hilo.getMessages().forEach(function (m) {
      const r = leerCorreo(m);
      if (r === null) { todos = false; return; } // no es una notificación de gasto
      if (r !== 'omitir') items.push(r);
    });
    if (todos) listos.push(hilo);
  });
  if (items.length) enviar(items);
  listos.forEach(function (h) { h.addLabel(etiqueta); });
  console.log('Enviados: ' + items.length);
}

/** Muestra lo que encontraría, sin enviar nada */
function probar() {
  GmailApp.search('(from:baccredomatic.com OR "BAC Credomatic") newer_than:30d', 0, 20).forEach(function (h) {
    h.getMessages().forEach(function (m) {
      const r = leerCorreo(m);
      let info = r === null ? 'no reconocido' : JSON.stringify(r);
      if (r === null && /informa/i.test(m.getSubject())) info += ' | TEXTO: ' + textos(m)[1].replace(/\s+/g, ' ').slice(0, 700);
      console.log(m.getSubject() + ' -> ' + info);
    });
  });
  const p = PropertiesService.getScriptProperties();
  if (!p.getProperty('APP_EMAIL') || !p.getProperty('APP_PASSWORD')) console.log('OJO: faltan APP_EMAIL y APP_PASSWORD en Propiedades del script.');
  else { iniciarSesion(); console.log('Inicio de sesión en Mis Finanzas: OK'); }
}

/** Crea el disparador cada 5 minutos (ejecútala una vez) */
function instalar() {
  ScriptApp.getProjectTriggers().forEach(function (t) { ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('revisarCorreos').timeBased().everyMinutes(5).create();
  revisarCorreos();
  console.log('Listo: revisará tu correo cada 5 minutos.');
}

/** Devuelve el elemento para la bandeja, 'omitir' (p. ej. rechazada) o null si no se reconoce */
function leerCorreo(m) {
  const tx = textos(m);
  let texto = tx[0];
  let r = interpretar(texto, m.getDate());
  if (r === null) { texto = tx[1]; r = interpretar(texto, m.getDate()); }
  if (!r || r === 'omitir') return r;
  r.id = 'gmail:' + m.getId();
  r.raw = (m.getSubject() + ' · ' + texto.replace(/\s+/g, ' ')).slice(0, 600);
  return r;
}

/** [texto plano, texto sacado del HTML] */
function textos(m) {
  let plano = '';
  try { plano = m.getPlainBody() || ''; } catch (e) {}
  return [plano, htmlATexto(m.getBody() || '')];
}

function htmlATexto(h) {
  return h.replace(/<(style|script|head)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<br\s*\/?>|<\/(td|th|tr|p|div|li|h\d|table)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/&quot;/gi, '"').replace(/&lt;/gi, '<').replace(/&gt;/gi, '>')
    .replace(/&#(\d+);/g, function (_, n) { return String.fromCharCode(+n); })
    .replace(/&([aeiou])acute;/gi, '$1').replace(/&ntilde;/gi, 'n').replace(/&[a-z]+;/gi, ' ');
}

/** Interpreta el texto de la notificación. Separado para poder probarlo. */
function interpretar(texto, fechaCorreo) {
  const t = texto.replace(/\s+/g, ' ');
  const num = '([\\d.,]+)';
  const mon = '(USD|US\\$|\\$|HNL|LPS?\\.?|L\\.?)';
  const base = { source: 'gmail', type: 'gasto', status: 'pendiente', cardLast4: null };

  // Formato 1: compra con tarjeta ("BAC Credomatic Informa: VISA 8572 ... Comercio Monto Horario ...")
  // a) "Comercio Monto ANTHROPIC* CLAUDE SUB USD 20 Horario 2026/11/19-10:03:02" (formato real de BAC)
  let c = t.match(new RegExp('Comercio:?\\s+Monto:?\\s+(.{1,120}?)\\s+' + mon + '\\s*' + num + '\\s+Horario:?\\s+(\\d{4})[/-](\\d{1,2})[/-](\\d{1,2})', 'i'));
  // b) "Comercio Monto Horario ANTHROPIC* CLAUDE SUB USD 20 2026/11/19-10:03:02"
  if (!c) c = t.match(new RegExp('Horario:?\\s+(.{1,120}?)\\s+' + mon + '\\s*' + num + '\\s+(\\d{4})[/-](\\d{1,2})[/-](\\d{1,2})', 'i'));
  if (c) {
    if (/\b(Rechazad|Denegad|Declinad)/i.test(t)) return 'omitir';
    const tarjeta = t.match(/(?:VISA|MASTERCARD|MASTER CARD|AMEX|AMERICAN EXPRESS)[^\d]{0,15}(\d{4})/i);
    return Object.assign(base, {
      merchant: c[1].trim(), currency: moneda(c[2]), amount: centavos(c[3]),
      date: c[4] + '-' + pad(c[5]) + '-' + pad(c[6]), cardLast4: tarjeta ? tarjeta[1] : null,
    });
  }

  // Formato 2: movimiento de cuenta ("en su cuenta en USD, número *****4901, por un monto de 6.13 USD")
  c = t.match(new RegExp('cuenta en (\\w+),? n[uú]mero\\s*[*xX]*(\\d{4}),?\\s*por un monto de\\s*' + num + '\\s*' + mon + '?', 'i'));
  if (c) {
    const f = t.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    const entrada = /(recibid|acreditad|dep[oó]sito a su cuenta|ha recibido)/i.test(t);
    return Object.assign(base, {
      type: entrada ? 'ingreso' : 'gasto',
      merchant: 'Movimiento cuenta ****' + c[2], currency: moneda(c[4] || c[1]), amount: centavos(c[3]),
      date: f ? f[3] + '-' + pad(f[2]) + '-' + pad(f[1]) : iso(fechaCorreo), cardLast4: c[2],
    });
  }
  return null;
}

function moneda(s) { return /USD|\$/i.test(s) ? 'USD' : 'HNL'; }
function pad(n) { return ('0' + n).slice(-2); }
function iso(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
function centavos(s) {
  s = String(s).replace(/[.,]$/, '');
  // "1,234.56" o "1.234,56" -> 123456
  if (/,\d{1,2}$/.test(s) && s.indexOf('.') < s.lastIndexOf(',')) s = s.replace(/\./g, '').replace(',', '.');
  else s = s.replace(/,/g, '');
  return Math.round(parseFloat(s) * 100);
}

function iniciarSesion() {
  const p = PropertiesService.getScriptProperties();
  const res = UrlFetchApp.fetch(SUPABASE_URL + '/auth/v1/token?grant_type=password', {
    method: 'post', contentType: 'application/json', muteHttpExceptions: true,
    headers: { apikey: SUPABASE_KEY },
    payload: JSON.stringify({ email: p.getProperty('APP_EMAIL'), password: p.getProperty('APP_PASSWORD') }),
  });
  if (res.getResponseCode() !== 200) throw new Error('No pude entrar a Mis Finanzas: ' + res.getContentText());
  return JSON.parse(res.getContentText()).access_token;
}

function enviar(items) {
  const token = iniciarSesion();
  const payload = {
    items: items.map(function (d) {
      // updated_at fijo (fecha del correo): si se reenvía, nunca pisa lo que ya confirmaste en la app
      const ts = Date.parse(d.date + 'T12:00:00Z') || 1;
      d.createdAt = ts; d.updatedAt = ts; d.deleted = 0;
      return { tbl: 'inbox', id: d.id, data: d, updated_at: ts, deleted: 0 };
    }),
  };
  const res = UrlFetchApp.fetch(SUPABASE_URL + '/rest/v1/rpc/push_records', {
    method: 'post', contentType: 'application/json', muteHttpExceptions: true,
    headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + token },
    payload: JSON.stringify(payload),
  });
  if (res.getResponseCode() >= 300) throw new Error('Error al enviar: ' + res.getContentText());
}
