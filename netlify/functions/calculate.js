// netlify/functions/calculate.js
// Όλη η λογική υπολογισμού τεκμηρίων — αόρατη στον browser

"use strict";

// ── ΒΟΗΘΗΤΙΚΕΣ ──
const nf  = v => parseFloat(String(v).replace(/\./g, "").replace(",", ".")) || 0;
const cl  = (v, a, b) => Math.min(b, Math.max(a, v));

// ── ΚΑΤΟΙΚΙΕΣ ──
function houseCalc(sqm, aux, tz, mono, own = 100, mo = 12, yr = 2025) {
  if (sqm <= 0 && aux <= 0) return 0;
  let b, a;
  if (yr >= 2025) {
    b = sqm <= 80  ? sqm * 28
      : sqm <= 120 ? 80*28 + (sqm-80)*45
      : sqm <= 200 ? 80*28 + 40*45 + (sqm-120)*77
      : sqm <= 300 ? 80*28 + 40*45 + 80*77 + (sqm-200)*140
      :              80*28 + 40*45 + 80*77 + 100*140 + (sqm-300)*280;
    a = aux * 28;
  } else {
    b = sqm <= 80  ? sqm * 40
      : sqm <= 120 ? 80*40 + (sqm-80)*65
      : sqm <= 200 ? 80*40 + 40*65 + (sqm-120)*110
      : sqm <= 300 ? 80*40 + 40*65 + 80*110 + (sqm-200)*200
      :              80*40 + 40*65 + 80*110 + 100*200 + (sqm-300)*400;
    a = aux * 40;
  }
  b += a;
  b *= tz;
  if (mono) b *= 1.2;
  return b * (cl(own,1,100)/100) * (cl(mo,1,12)/12);
}
const h2Calc = (sqm, aux, tz, mono, own=100, mo=12, yr=2025) =>
  houseCalc(sqm, aux, tz, mono, own, mo, yr) * 0.5;

// ── CO₂ ΑΥΤΟΚΙΝΗΤΟ (από 1/11/2010) ──
function co2Calc(c) {
  if (c <= 0)   return 0;
  if (c <= 122) return 2000;
  if (c <= 139) return 2000 + (c-122)*30;
  if (c <= 166) return 2000 + 510 + (c-139)*45;
  return 2000 + 510 + 1215 + (c-166)*60;
}

// ── ΚΥΒΙΚΑ ΑΥΤΟΚΙΝΗΤΟ (έως 31/10/2010) ──
// Η κλίμακα ενσωματώνει ήδη τη μείωση 50% — Ν.5246/2025
function ccCalc(c) {
  if (c <= 0) return 0;
  return c <= 1200 ? 2000
    : c <= 2000 ? 2000 + Math.ceil((c-1200)/100)*300
    : c <= 3000 ? 4400 + Math.ceil((c-2000)/100)*450
    :             8900 + Math.ceil((c-3000)/100)*600;
}

// ── ΣΚΑΦΟΣ ──
function boatCalc(type, lenRaw, sail, mo, own) {
  const L = Math.ceil(nf(lenRaw));
  if (L <= 0) return 0;
  let base = 0;
  if (type === "open") {
    base = L <= 5 ? 2800 : 2800 + (L-5)*1400;
  } else {
    if      (L <= 7)  base = 8400;
    else if (L <= 10) base = 8400 + (L-7)*2100;
    else if (L <= 12) base = 8400 + 6300 + (L-10)*4200;
    else if (L <= 15) base = 8400 + 6300 + 8400 + (L-12)*6510;
    else if (L <= 18) base = 8400 + 6300 + 8400 + 19530 + (L-15)*7000;
    else              base = 8400 + 6300 + 8400 + 19530 + 21000 + (L-18)*7700;
    if (sail) base *= 0.5;
  }
  return base * (cl(mo,1,12)/12) * (cl(own,1,100)/100);
}

// ── ΠΙΣΙΝΑ ──
function poolCalc(sqm, indoor, mo) {
  if (sqm <= 0) return 0;
  let b = sqm <= 60 ? sqm*160 : 60*160 + (sqm-60)*320;
  if (indoor) b *= 2;
  return b * (cl(mo,1,12)/12);
}

// ── ΑΕΡΟΣΚΑΦΟΣ ──
function aircraftCalc(type, metric, mo, own) {
  const m  = cl(mo,1,12);
  const op = cl(own,1,100)/100;
  let a = 0;
  if      (type === "anemoptero")                      a = 6000;
  else if (type === "ypam")                            a = 1500;
  else if (type === "koino" || type === "esotkaysis")  a = nf(metric)*65;
  else if (type === "stroviloeliko" || type === "elikoptero") a = nf(metric)*195;
  else if (type === "jet")                             a = nf(metric)*2;
  return a * (m/12) * op;
}

// ── ΚΥΡΙΟΣ ΥΠΟΛΟΓΙΣΜΟΣ ──
function calculate(data) {
  const {
    taxYear = 2025,
    family  = "agamos",
    isSyntax = false,
    // Κατοικίες
    mainHouse,
    secHouses = [],
    // Αυτοκίνητα
    cars = [],
    // Σκάφος
    boat,
    // Πισίνα
    pool,
    // Αεροσκάφος
    aircraft,
    // Δαπάνες απόκτησης
    cbuy  = 0,
    pbuy  = 0,
    loans = 0,
    oe    = 0,
    school = 0,
    staff  = 0,
    rentP  = 0,
    other  = 0,
    // Εισοδήματα
    incMain = 0,
    incRent = 0,
    incInt  = 0,
    incCap  = 0,
    incAl   = 0,
    incOther= 0,
    incAgro = 0,
  } = data;

  const pK = isSyntax ? 0.7 : 1;

  // Ελάχιστο τεκμήριο
  const minT = (family === "egamos" ? 2500 : 3000) * pK;

  // Κύρια κατοικία
  let house = 0;
  if (mainHouse) {
    house = houseCalc(
      nf(mainHouse.sqm), nf(mainHouse.aux), nf(mainHouse.tz),
      mainHouse.mono, nf(mainHouse.own), nf(mainHouse.mo), taxYear
    ) * pK;
  }

  // Δευτερεύουσες κατοικίες
  let house2Total = 0;
  for (const h of secHouses) {
    house2Total += h2Calc(
      nf(h.sqm), nf(h.aux), nf(h.tz),
      h.mono, nf(h.own), nf(h.mo), taxYear
    ) * pK;
  }

  // Αυτοκίνητα
  let carTotal = 0;
  for (const c of cars) {
    let a = 0;
    if      (taxYear >= 2025 && c.t === "ev")       a = (c.evPrice||"low") === "high" ? 2000 : 0;
    else if (taxYear <  2025 && c.t === "ev")       a = (c.evPrice||"low") === "high" ? 4000 : 0;
    else if (c.t === "historic" || c.t === "disabled") a = 0;
    else if (taxYear >= 2025 && c.t === "co2")      a = co2Calc(nf(c.co2));
    else                                             a = ccCalc(nf(c.cc));
    carTotal += a;
  }

  // Σκάφος
  let boat_ = 0;
  if (boat) {
    boat_ = boatCalc(boat.type, boat.len, boat.sail, nf(boat.mo), nf(boat.own));
  }

  // Πισίνα
  let pool_ = 0;
  if (pool) {
    pool_ = poolCalc(nf(pool.sqm), pool.indoor, nf(pool.mo));
  }

  // Αεροσκάφος
  let air_ = 0;
  if (aircraft) {
    air_ = aircraftCalc(aircraft.type, aircraft.metric, nf(aircraft.mo), nf(aircraft.own));
  }

  // Σύνολο τεκμηρίων διαβίωσης
  const tlife = Math.max(minT, house + house2Total + carTotal + boat_ + pool_ + air_);

  // Δαπάνες απόκτησης
  const tk = nf(cbuy) + nf(pbuy) + nf(loans) + nf(oe) + nf(school) + nf(staff) + nf(rentP) + nf(other);

  // Σύνολο τεκμηρίων
  const grand = tlife + tk;

  // Εισοδήματα
  const totalInc = nf(incMain) + nf(incRent)*0.95 + nf(incInt) + nf(incCap) + nf(incAl) + nf(incOther) + nf(incAgro);

  // Αποτέλεσμα
  const diff    = grand - totalInc;
  const needAnal = totalInc > 0 && diff > 0;
  const surplus  = totalInc > 0 && !needAnal ? totalInc - grand : 0;

  return {
    minT, house, house2Total, carTotal, boat_, pool_, air_,
    tlife, tk, grand,
    totalInc, diff: Math.max(0, diff), needAnal, surplus,
  };
}

// ── NETLIFY HANDLER ──
exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }
  try {
    const data   = JSON.parse(event.body);
    const result = calculate(data);
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(result),
    };
  } catch (err) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: err.message }),
    };
  }
};
