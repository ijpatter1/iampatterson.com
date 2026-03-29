/**
 * Returns a BigQuery SQL expression that URL-decodes a column.
 * Handles both + (space) and common percent-encoded characters.
 *
 * Usage in .sqlx: ${url_decode("column_name")}
 */
function url_decode(column) {
  return `REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(
    ${column},
    '+', ' '),
    '%20', ' '),
    '%26', '&'),
    '%3D', '='),
    '%2B', '+'),
    '%25', '%')`;
}

module.exports = { url_decode };
