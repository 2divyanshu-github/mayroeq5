// scripts/sum_tables.js
import fs from 'fs';
import { chromium } from 'playwright';

/**
 * Replace the URLs below with the actual links for Seed 44 .. Seed 53
 * Example:
 * const urls = [
 *   'https://example.com/seed44',
 *   ...
 * ];
 */
const urls = [
  'https://example.com/seed44',
  'https://example.com/seed45',
  'https://example.com/seed46',
  'https://example.com/seed47',
  'https://example.com/seed48',
  'https://example.com/seed49',
  'https://example.com/seed50',
  'https://example.com/seed51',
  'https://example.com/seed52',
  'https://example.com/seed53'
];

function parseNumberFromString(s) {
  if (s === null || s === undefined) return null;
  // Normalize whitespace
  let str = String(s).trim();
  if (str === '') return null;

  // Remove currency symbols and non-numeric letters except ., -, parentheses, comma
  // Keep parentheses for negative numbers like (1,234.56)
  str = str.replace(/[^\d\.\-,\(\)\s]/g, '');

  // If parentheses used for negative numbers, convert to -value
  const isParenNeg = /^\s*\(.*\)\s*$/.test(str);
  str = str.replace(/[()]/g, '');

  // Remove spaces
  str = str.replace(/\s+/g, '');

  // Remove thousands separators (commas) but not decimal point
  // If there are multiple dots, we try to keep last as decimal separator
  const dotCount = (str.match(/\./g) || []).length;
  if (dotCount <= 1) {
    str = str.replace(/,/g, '');
  } else {
    // fallback: remove all commas and remove all dots except the last
    str = str.replace(/,/g, '');
    const lastDotIndex = str.lastIndexOf('.');
    str = str.slice(0, lastDotIndex).replace(/\./g, '') + str.slice(lastDotIndex);
  }

  // Now parse float
  let value = Number(str);
  if (Number.isNaN(value)) {
    // Try replacing comma decimal separator (e.g., "1234,56")
    const alt = str.replace(/,/g, '.');
    value = Number(alt);
    if (Number.isNaN(value)) return null;
  }

  if (isParenNeg) value = -Math.abs(value);
  return value;
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  let grandTotal = 0;
  console.log('Starting table scraping for', urls.length, 'URLs');

  for (const url of urls) {
    try {
      console.log('Visiting', url);
      await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
      // Wait a moment for dynamic tables to render if necessary
      await page.waitForTimeout(500);

      // Evaluate in page: find all table cells and try to parse numbers
      const numbersOnPage = await page.evaluate(() => {
        // Collect text from all table cells (td, th)
        const texts = [];
        const cells = Array.from(document.querySelectorAll('table td, table th'));
        for (const c of cells) {
          const txt = c.innerText || c.textContent || '';
          if (txt && txt.trim()) texts.push(txt.trim());
        }
        // Fallback: if no <table> tags found, maybe tabular divs exist - try common classes
        if (cells.length === 0) {
          const rows = Array.from(document.querySelectorAll('[role="table"] [role="cell"], [role="gridcell"]'));
          for (const r of rows) {
            const txt = r.innerText || r.textContent || '';
            if (txt && txt.trim()) texts.push(txt.trim());
          }
        }
        return texts;
      });

      let pageTotal = 0;
      for (const t of numbersOnPage) {
        // Attempt to extract number-like substrings (can be multiple numbers in one cell)
        // Use regex to find groups of digits, commas, dots, parentheses, minus
        const matches = t.match(/[\-()]*\s*[0-9][0-9\.,\(\)\s]*[0-9]/g);
        if (!matches) continue;
        for (const m of matches) {
          // Transfer to Node side for parsing robustness
          // We will return the raw matches; parsing happens in Node context below
        }
      }

      // Instead of parsing in page, re-query the individual cell texts in Node by getting the array
      // (we already have numbersOnPage)
      for (const txt of numbersOnPage) {
        // extract potential number-like tokens from the text cell
        const tokens = txt.match(/[\-()]*\s*[0-9][0-9\.,\(\)\s]*[0-9]/g);
        if (!tokens) continue;
        for (const token of tokens) {
          // send token back to Node-side parsing function via string
          // We'll collect them in an array and parse below
          // but for simplicity parse here using a simple method (not available in browser)
        }
      }

      // Because complex parsing is handled in Node, request cell texts and parse here
      const cellTexts = numbersOnPage; // already obtained

      for (const cellText of cellTexts) {
        const tokenMatches = cellText.match(/[\-()]*\s*[0-9][0-9\.,\(\)\s]*[0-9]/g);
        if (!tokenMatches) continue;
        for (const tk of tokenMatches) {
          // send the raw token to Node parser function by writing to stdout placeholder
          // but we are in Node already: parseNumberFromString is available
          const parsed = null; // placeholder to satisfy linter
        }
      }

      // Parse and sum in Node context: (we can't call Node functions inside page.evaluate above)
      // So re-evaluate cell texts via page.$$eval for fidelity
      const rawCellTexts = await page.$$eval('table td, table th', nodes => nodes.map(n => n.innerText || n.textContent || ''));
      let pageNumbersTotal = 0;
      if (rawCellTexts.length === 0) {
        // fallback to role-based cells
        const alt = await page.$$eval('[role="table"] [role="cell"], [role="gridcell"]', nodes => nodes.map(n => n.innerText || n.textContent || ''));
        for (const s of alt) {
          const tokens = s.match(/[\-()]*\s*[0-9][0-9\.,\(\)\s]*[0-9]/g);
          if (!tokens) continue;
          for (const t of tokens) {
            const v = parseNumberFromString(t);
            if (v !== null) pageNumbersTotal += v;
          }
        }
      } else {
        for (const s of rawCellTexts) {
          const tokens = s.match(/[\-()]*\s*[0-9][0-9\.,\(\)\s]*[0-9]/g);
          if (!tokens) continue;
          for (const t of tokens) {
            const v = parseNumberFromString(t);
            if (v !== null) pageNumbersTotal += v;
          }
        }
      }

      console.log(`Page subtotal for ${url}: ${pageNumbersTotal}`);
      grandTotal += pageNumbersTotal;
    } catch (err) {
      console.error(`Error processing ${url}:`, err.message || err);
    }
  }

  console.log('======================================');
  console.log('GRAND TOTAL (sum of all numbers in all tables across pages):', grandTotal);
  console.log('======================================');

  await browser.close();
  // Exit with success
  process.exit(0);
})();
