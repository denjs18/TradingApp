/**
 * Parser pour la feuille "Suivi PEA" du fichier Excel de suivi DCA.
 *
 * Structure de la feuille :
 * - Row 0 : labels de sections
 * - Row 1 : noms des instruments (S&P500, MSCI World, Airbus, …) à intervalles de 6 ou 7 colonnes
 * - Row 2 : données courantes (prix actuel, qty totale, total investi)
 * - Row 3 : sous-headers (Prix, Quantité, Frais, Total, …)
 * - Row 4+ : données mensuelles (1 ligne = 1 mois)
 *
 * Par instrument le bloc fait 6 colonnes (ou 7 si l'instrument verse des dividendes) :
 * [Prix, Qty_mois, Qty_totale_cumulée, (Dividendes?), Frais, Montant_mois, Total_cumulé]
 */

export interface InstrumentMonth {
  prix: number | null;
  qty_month: number;
  qty_total: number;
  dividendes: number;
  frais: number;
  montant_mois: number;
  total_cumule: number;
}

export interface PEAMonth {
  row_num: number;
  year: number;
  month_name: string;
  total_invested_month: number;
  dividendes_total: number;
  instruments: Record<string, InstrumentMonth>;
}

export interface InstrumentMeta {
  name: string;
  col_start: number;
  has_dividendes: boolean;
  ticker?: string;
}

export interface PEAData {
  instruments: InstrumentMeta[];
  months: PEAMonth[];
  current: Record<string, { prix: number | null; qty_total: number; total_cumule: number }>;
}

const INSTRUMENT_TICKERS: Record<string, string> = {
  "S&P500":                  "PUST.PA",
  "MSCI World":              "LCWL.PA",
  "Airbus":                  "AIR.PA",
  "MSCI USA x2":             "BX4.PA",
  "S&P Blackrock":           "ISPY.PA",
  "ETF Aerospace & Defence": "AERO.PA",
  "STMIcroeletronics":       "STM.PA",
  "STMicroelectronics":      "STM.PA",
  "Dassault":                "DSY.PA",
  "Carrefour":               "CA.PA",
  "Sword Group":             "SWORD.PA",
  "Alstom":                  "ALO.PA",
  "Pays émergents":          "PAEEM.PA",
};

function toNum(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = typeof v === "number" ? v : parseFloat(String(v).replace(",", "."));
  return isNaN(n) ? null : n;
}

function toNumDef(v: unknown, def = 0): number {
  return toNum(v) ?? def;
}

// Detect instruments from row[1]: non-null strings at col >= 5
function detectInstruments(row1: unknown[], row3: unknown[]): InstrumentMeta[] {
  const instruments: InstrumentMeta[] = [];
  for (let c = 5; c < row1.length; c++) {
    const val = row1[c];
    if (val && typeof val === "string" && val.trim().length > 2) {
      const name = val.trim();
      // Detect if this block has a "Dividendes" sub-column by scanning row3 in this block
      let has_dividendes = false;
      for (let d = c + 1; d < Math.min(c + 8, row1.length); d++) {
        if (row3[d] && typeof row3[d] === "string" &&
            String(row3[d]).toLowerCase().includes("divid")) {
          has_dividendes = true;
          break;
        }
        // Stop if we hit the next instrument name
        if (d > c + 1 && row1[d] && typeof row1[d] === "string") break;
      }
      instruments.push({
        name,
        col_start: c,
        has_dividendes,
        ticker: INSTRUMENT_TICKERS[name],
      });
    }
  }
  return instruments;
}

// Parse one instrument block for a monthly row
function parseInstrumentBlock(
  row: unknown[],
  col_start: number,
  has_dividendes: boolean
): InstrumentMonth {
  const prix       = toNum(row[col_start]);
  const qty_month  = toNumDef(row[col_start + 1]);
  const qty_total  = toNumDef(row[col_start + 2]);

  if (has_dividendes) {
    // [Prix, Qty_mois, Qty_total, Dividendes, Frais, Montant_mois, Total_cumulé]
    return {
      prix,
      qty_month,
      qty_total,
      dividendes:    toNumDef(row[col_start + 3]),
      frais:         toNumDef(row[col_start + 4]),
      montant_mois:  toNumDef(row[col_start + 5]),
      total_cumule:  toNumDef(row[col_start + 6]),
    };
  } else {
    // [Prix, Qty_mois, Qty_total, Frais, Montant_mois, Total_cumulé]
    return {
      prix,
      qty_month,
      qty_total,
      dividendes:    0,
      frais:         toNumDef(row[col_start + 3]),
      montant_mois:  toNumDef(row[col_start + 4]),
      total_cumule:  toNumDef(row[col_start + 5]),
    };
  }
}

// ── Onglet "Résumé" : valeurs réelles faisant foi ──────────────────────
// Colonnes AM = "PEA" (valeur réelle), AN = "Investi" (montant investi réel)
export interface PEAResumePoint {
  date: string;
  value: number;     // valeur réelle du portefeuille PEA ce mois-là
  invested: number;  // montant réellement investi (cumulé)
}

const MONTHS_FR_SHORT = ["jan", "fév", "mar", "avr", "mai", "juin",
  "juil", "aoû", "sep", "oct", "nov", "déc"];

function fmtResumeDate(v: unknown, idx: number): string {
  if (v instanceof Date) return `${MONTHS_FR_SHORT[v.getMonth()]} ${v.getFullYear()}`;
  const n = toNum(v);
  if (n && n > 30000) { // numéro de série Excel
    const d = new Date(Date.UTC(1899, 11, 30) + n * 86400000);
    return `${MONTHS_FR_SHORT[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
  }
  return String(v ?? idx + 1);
}

export function parseResume(rows: unknown[][]): PEAResumePoint[] {
  // Repérer la cellule d'en-tête "PEA" suivie de "Investi"
  let peaCol = -1, invCol = -1, headerRow = -1;
  for (let r = 0; r < rows.length && peaCol < 0; r++) {
    const row = (rows[r] as unknown[]) || [];
    for (let c = 0; c < row.length; c++) {
      if (String(row[c]).trim() === "PEA" && String(row[c + 1]).trim() === "Investi") {
        peaCol = c; invCol = c + 1; headerRow = r; break;
      }
    }
  }
  if (peaCol < 0) return [];

  // Colonne date : chercher l'en-tête "Temps", sinon colonne B (index 1)
  let dateCol = 1;
  const hdr = (rows[headerRow] as unknown[]) || [];
  for (let c = 0; c < hdr.length; c++) {
    if (String(hdr[c]).trim().toLowerCase() === "temps") { dateCol = c; break; }
  }

  const points: PEAResumePoint[] = [];
  for (let r = headerRow + 1; r < rows.length; r++) {
    const row = (rows[r] as unknown[]) || [];
    const v = toNum(row[peaCol]);
    const inv = toNum(row[invCol]);
    if (v == null && inv == null) {
      if (points.length) break; // fin du tableau
      continue;
    }
    points.push({
      date: fmtResumeDate(row[dateCol], points.length),
      value: v ?? 0,
      invested: inv ?? 0,
    });
  }
  return points;
}

export function parseSuiviPEA(rows: unknown[][]): PEAData {
  if (rows.length < 5) return { instruments: [], months: [], current: {} };

  const row1 = rows[1] as unknown[];
  const row2 = rows[2] as unknown[];
  const row3 = rows[3] as unknown[];

  const instruments = detectInstruments(row1, row3);

  // Current state from row2
  const current: PEAData["current"] = {};
  for (const inst of instruments) {
    current[inst.name] = {
      prix:        toNum(row2[inst.col_start]),
      qty_total:   toNumDef(row2[inst.col_start + 1]),
      total_cumule: toNumDef(row2[inst.col_start + (inst.has_dividendes ? 6 : 5)]),
    };
  }

  // Monthly rows start at index 4
  const months: PEAMonth[] = [];
  let current_year = 2024;

  for (let i = 4; i < rows.length; i++) {
    const row = rows[i] as unknown[];
    const month_name = row[4];
    if (!month_name || typeof month_name !== "string") continue;

    // row_num can be string "1" or number
    const row_num_raw = row[0];
    if (row_num_raw == null) continue; // future empty rows

    const row_num = toNumDef(row_num_raw);
    if (row[1]) current_year = toNumDef(row[1], current_year);

    const total_month = toNumDef(row[2]);
    const divs_total  = toNumDef(row[3]);

    const inst_data: Record<string, InstrumentMonth> = {};
    for (const inst of instruments) {
      inst_data[inst.name] = parseInstrumentBlock(row, inst.col_start, inst.has_dividendes);
    }

    months.push({
      row_num,
      year: current_year,
      month_name: month_name.trim(),
      total_invested_month: total_month,
      dividendes_total: divs_total,
      instruments: inst_data,
    });
  }

  return { instruments, months, current };
}
