const Database = require('better-sqlite3');
const db = new Database('registro.db');

// Lista del usuario
const listaUsuario = ` $ 305.314,00
 $ 186.957,75
 $ 385.860,00
 $ 81.466,00
 $ 1.379.031,60
 $ 74.260,90
 $ 23.645,45
 $ 11.638,00
 $ 26.898,00
 $ 4.212,00
 $ 26.898,00
 $ 58.190,00
 $ 232.760,00
 $ 6.176,00
 $ 9.436,00
 $ 18.872,00
 $ 11.638,00
 $ 18.872,00
 $ 350.960,00
 $ 4.149,77
 $ 191.112,00
 $ 93.993,43
 $ 39.774,25
 $ 502.583,00
 $ 18.872,00
 $ 247.479,75
 $ 122.152,84
 $ 9.436,00
 $ 4.878,53
 $ 656.570,00
 $ -544.920,00
 $ 26.898,00
 $ 490.650,00
 $ 29.071,12
 $ 1.727.424,00
 $ 68.587,97
 $ 216.203,15
 $ 311.999,00
 $ 1.744,00
 $ 17.797,41
 $ 9.436,00
 $ 17.122,65
 $ 9.436,00
 $ 26.898,00
 $ 22.180,00
 $ 484.822,00
 $ 247.756,00
 $ 417.406,29
 $ 361.570,00
 $ 22.180,00
 $ 332.602,00
 $ 918.405,00
 $ 401.710,00
 $ 1.096.996,00
 $ 29.100,00
 $ 414.580,00
 $ 765.003,21
 $ 368.934,00
 $ 22.180,00
 $ 137.698,00
 $ 144.351,84
 $ 687.874,00
 $ 489.988,00
 $ 28.958,00
 $ 84.586,00
 $ 225.716,00
 $ 200.067,00
 $ 1.910,40
 $ 200.400,00
 $ 1.281.770,00
 $ -
 $ 138.556,00
 $ 10.251,73
 $ 352.453,00
 $ 339.889,28
 $ 22.180,00
 $ 36.897,63
 $ 344.785,36
 $ 22.180,00
 $ 2.741.909,00
 $ 522.868,00
 $ 1.303.160,71
 $ 650.872,00
 $ 660.332,00
 $ 145.316,00
 $ 36.960,00
 $ 322.375,76
 $ 550.880,00
 $ 494.080,00
 $ 630.768,00
 $ 399.798,00
 $ 370.150,00
 $ 780.818,00
 $ 2.546.339,00
 $ 1.328.559,20
 $ 118.940,00
 $ 4.718,00
 $ 2.259.515,84
 $ 1.700.988,00
 $ 1.779.895,69
 $ 121.698,00
 $ 74.010,50
 $ 3.209.084,00
 $ 442.134,00
 $ 621.372,00
 $ 3.550,00
 $ 6.920,00
 $ 216.799,59
 $ 116.708,00
 $ 2.768.934,00
 $ 710.871,50
 $ 1.218.045,00
 $ 262.386,62
 $ 307.532,00
 $ 36.960,00
 $ 1.601.138,00
 $ 195.476,00
 $ 109.743,00
 $ 729.478,00
 $ 710,00
 $ 287.952,80
 $ 93.150,00
 $ 419.866,00
 $ 212.400,00
 $ 747.434,00
 $ 112.541,09
 $ 16.691,00
 $ 1.560,00
 $ 1.890,00
 $ 1.301.300,00
 $ 403.096,00
 $ 2.137.825,00
 $ 6.920,00
 $ 4.718,00
 $ 696.681,00
 $ 215.250,00
 $ 86.250,00
 $ 240.376,00
 $ 1.252.318,00
 $ 1.020.462,16
 $ 1.177.762,00
 $ 9.436,00
 $ 442.535,09
 $ -59.714,00
 $ 159.848,00
 $ 687.240,00
 $ 1.912.330,00
 $ 240.900,00
 $ 1.187.480,00
 $ 1.913.374,00
 $ 6.920,00
 $ 448.865,42
 $ 125.588,00
 $ 39.957,58
 $ 212.588,00
 $ 597.976,00
 $ 1.142.196,00
 $ 13.980,00
 $ 16.500,00
 $ 240.900,00
 $ 710,00
 $ 228.648,00
 $ 1.890,00
 $ 8.250,00
 $ 8.250,00
 $ 268.225,00
 $ 1.005.898,00
 $ 740,00
 $ 48.157,79
 $ 319.180,00
 $ 80.838,00
 $ 468.975,00
 $ 624.776,00
 $ 59.888,25
 $ 71.381,25
 $ 533.074,00
 $ 625.949,72
 $ 1.331.315,00
 $ 743.086,49
 $ 423.675,00
 $ 59.888,25
 $ 22.180,00
 $ 105.119,71
 $ 59.888,25
 $ 1.725.017,75
 $ 8.250,00
 $ 74.250,00
 $ 6.920,00
 $ 36.020,00
 $ 13.840,00
 $ 24.750,00
 $ 2.682.952,00
 $ 793.552,22
 $ 351.696,00
 $ 769.950,00
 $ 766.918,00
 $ 615.979,50
 $ 788.114,00
 $ 372.150,22
 $ 99.009,09
 $ 710,00
 $ 74.250,00
 $ 246.758,00
 $ 6.920,00
 $ 444.594,00
 $ 695.400,00
 $ 3.107.747,00
 $ 22.830,00
 $ 646.425,00
 $ 36.020,00
 $ 1.261.189,00
 $ 7.600,00
 $ 2.305.038,00
 $ 2.214.258,00
 $ 190.630,00`;

// Parsear lista del usuario
const lineasUsuario = listaUsuario.split('\n')
  .map(l => l.trim())
  .filter(l => l && l !== '$ -')
  .map(l => {
    let limpio = l.replace(/\$/g, '').replace(/\s/g, '').trim();
    limpio = limpio.replace(/\./g, '').replace(',', '.');
    return parseFloat(limpio);
  })
  .filter(n => !isNaN(n));

// Obtener de la DB
const egresosDB = db.prepare(`
  SELECT monto
  FROM movimientos_cc
  WHERE cuenta_id = 51 AND tipo_movimiento = 'EGRESO'
  ORDER BY fecha ASC, id ASC
`).all().map(e => e.monto);

console.log('=== COMPARACIÓN SICARDI EGRESOS ===\n');
console.log(`Lista usuario: ${lineasUsuario.length} egresos`);
console.log(`Base de datos: ${egresosDB.length} egresos`);

// Crear mapas de frecuencia
const mapaUsuario = {};
const mapaDB = {};

lineasUsuario.forEach(m => {
  const key = m.toFixed(2);
  mapaUsuario[key] = (mapaUsuario[key] || 0) + 1;
});

egresosDB.forEach(m => {
  const key = m.toFixed(2);
  mapaDB[key] = (mapaDB[key] || 0) + 1;
});

// Encontrar diferencias
const montosUsuario = Object.keys(mapaUsuario);
const montosDB = Object.keys(mapaDB);

console.log('\n=== MONTOS SOLO EN USUARIO ===');
let soloEnUsuario = [];
montosUsuario.forEach(monto => {
  const cantUsuario = mapaUsuario[monto];
  const cantDB = mapaDB[monto] || 0;
  if (cantUsuario > cantDB) {
    const diferencia = cantUsuario - cantDB;
    console.log(`$${parseFloat(monto).toLocaleString('es-AR')} - Veces en usuario: ${cantUsuario}, en DB: ${cantDB} (${diferencia} de más)`);
    for (let i = 0; i < diferencia; i++) {
      soloEnUsuario.push(parseFloat(monto));
    }
  }
});

console.log('\n=== MONTOS SOLO EN DB ===');
let soloEnDB = [];
montosDB.forEach(monto => {
  const cantDB = mapaDB[monto];
  const cantUsuario = mapaUsuario[monto] || 0;
  if (cantDB > cantUsuario) {
    const diferencia = cantDB - cantUsuario;
    console.log(`$${parseFloat(monto).toLocaleString('es-AR')} - Veces en DB: ${cantDB}, en usuario: ${cantUsuario} (${diferencia} de más)`);
    for (let i = 0; i < diferencia; i++) {
      soloEnDB.push(parseFloat(monto));
    }
  }
});

const sumaSoloUsuario = soloEnUsuario.reduce((a, b) => a + b, 0);
const sumaSoloDB = soloEnDB.reduce((a, b) => a + b, 0);

console.log('\n=== RESUMEN ===');
console.log(`Total solo en usuario: $${sumaSoloUsuario.toLocaleString('es-AR', {minimumFractionDigits: 2})}`);
console.log(`Total solo en DB: $${sumaSoloDB.toLocaleString('es-AR', {minimumFractionDigits: 2})}`);
console.log(`Diferencia neta: $${(sumaSoloDB - sumaSoloUsuario).toLocaleString('es-AR', {minimumFractionDigits: 2})}`);

db.close();
