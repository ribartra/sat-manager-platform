// Account names are stored as "First Last": every word with its first letter in capitals and the rest
// in lower case ("ALEJANDRO ABUSADA" → "Alejandro Abusada"), also after a hyphen or apostrophe
// ("maría-josé o'neil" → "María-José O'Neil"). Spanish particles inside a name stay lower case
// ("Juan DE LA Cruz" → "Juan de la Cruz"). A short all-caps word in a name that is not all caps is
// kept as an acronym ("SAT Teacher", "QA Admin"). Applied when an account or invitation is created or
// edited.

const PARTICLES = new Set(["de", "del", "la", "las", "los", "y", "e", "da", "do", "dos"]);

const capitalize = (part: string) => (part ? part.charAt(0).toLocaleUpperCase("es") + part.slice(1).toLocaleLowerCase("es") : part);

export function formatPersonName(raw: string): string {
  const words = raw.trim().replace(/\s+/g, " ").split(" ").filter(Boolean);
  // A short all-caps word in a name that is not all caps is an acronym ("SAT Teacher", "QA Admin").
  const allCaps = words.join("") === words.join("").toLocaleUpperCase("es");
  return words
    .map((word, index) => {
      const lower = word.toLocaleLowerCase("es");
      if (index > 0 && index < words.length - 1 && PARTICLES.has(lower)) return lower;
      if (!allCaps && word.length <= 3 && /^\p{Lu}+$/u.test(word)) return word;
      return word
        .split(/([-'’])/)
        .map((part) => (/^[-'’]$/.test(part) ? part : capitalize(part)))
        .join("");
    })
    .join(" ");
}

/** formatPersonName for optional names (null / blank stay null). */
export function formatOptionalPersonName(raw: string | null | undefined): string | null {
  const value = formatPersonName(raw ?? "");
  return value || null;
}
