/**
 * Returns a BigQuery SQL expression that URL-decodes a column.
 * Handles + (space) and common percent-encoded characters in both
 * uppercase (%2B) and lowercase (%2b) forms.
 *
 * Decode order matters: %25/%25 (literal %) must be decoded FIRST (innermost)
 * to prevent double-decoding. Then all other %XX patterns, then + last.
 * E.g., %252B → (step 1: %25→%) → %2B → (step 2: %2B→+) → +
 *
 * Only handles the most common URL-encoded characters found in marketing
 * URLs and UTM parameters. For full URL decoding, use a UDF.
 *
 * Usage in .sqlx: ${url_decode("column_name")}
 */
function url_decode(column) {
  // Innermost REPLACE executes first.
  // Order: %25→% first, then %XX patterns (upper+lower), then +→space last.
  const steps = [
    ["'%25'", "'%'"], // Must be first: decode literal percent signs
    ["'%20'", "' '"], // Space
    ["'%26'", "'&'"], // Ampersand
    ["'%3D'", "'='"], // Equals
    ["'%3d'", "'='"], // Equals (lowercase)
    ["'%2F'", "'/'"], // Slash
    ["'%2f'", "'/'"], // Slash (lowercase)
    ["'%3A'", "':'"], // Colon
    ["'%3a'", "':'"], // Colon (lowercase)
    ["'%3F'", "'?'"], // Question mark
    ["'%3f'", "'?'"], // Question mark (lowercase)
    ["'%23'", "'#'"], // Hash
    ["'%40'", "'@'"], // At sign
    ["'%2B'", "'+'"], // Plus (literal)
    ["'%2b'", "'+'"], // Plus (literal, lowercase)
    ["'+'", "' '"], // Must be last: + means space in URL encoding
  ];

  let sql = column;
  for (const [from, to] of steps) {
    sql = `REPLACE(${sql}, ${from}, ${to})`;
  }
  return sql;
}

module.exports = { url_decode };
