import { handshapes } from '../src/handshapes.js';
import { templateFor } from '../src/classifier.js';
for (const id of (process.argv[2] ?? 'A,S,1,B,4,R,U,O,C').split(',')) {
  const t = templateFor(handshapes().get(id)!); const f = t.features;
  console.log(id.padEnd(6), Object.entries(f.fingers).map(([k, v]) => `${k[0]} m${v.mcp.toFixed(0)} p${v.pip.toFixed(0)} d${v.dip.toFixed(0)} s${v.spread.toFixed(0)} e${v.extension.toFixed(2)}`).join(' | '), '| thumb', f.thumb.tip.map(x => (x*100).toFixed(1)).join(','), 'cross', f.crossing.toFixed(4), 'contacts', t.contacts.join(','));
}
