/**
 * Returns a BigQuery SQL expression that URL-decodes a column.
 * Handles + (space) and common percent-encoded characters.
 *
 * Decode order matters: %25 (literal %) must be decoded FIRST (innermost)
 * to prevent double-decoding. Then all other %XX patterns, then + last.
 * E.g., %252B → (step 1: %25→%) → %2B → (step 2: %2B→+) → +
 *
 * Usage in .sqlx: ${url_decode("column_name")}
 */
function url_decode(column) {
  // Innermost REPLACE executes first.
  // Order: %25→% first, then %XX patterns, then +→space last
  const steps = [
    ["'%25'", "'%'"], // Must be first: decode literal percent signs
    ["'%20'", "' '"], // Space
    ["'%26'", "'&'"], // Ampersand
    ["'%3D'", "'='"], // Equals
    ["'%2F'", "'/'"], // Slash
    ["'%3A'", "':'"], // Colon
    ["'%3F'", "'?'"], // Question mark
    ["'%23'", "'#'"], // Hash
    ["'%40'", "'@'"], // At sign
    ["'%2B'", "'+'"], // Plus (literal)
    ["'+'", "' '"], // Must be last: + means space in URL encoding
  ];

  let sql = column;
  for (const [from, to] of steps) {
    sql = `REPLACE(${sql}, ${from}, ${to})`;
  }
  return sql;
}

module.exports = { url_decode };
