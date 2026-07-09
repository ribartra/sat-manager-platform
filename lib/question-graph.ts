export interface GraphArtifact {
  id: string;
  label: string;
  latex: string;
  kind: "expression" | "point";
}

interface GraphQuestionInput {
  stem: string;
  stimulus?: string | null;
  explanation?: string | null;
  options?: { label: string; text: string }[];
}

const formulaPattern = /(\$\$[\s\S]+?\$\$|\\\[[\s\S]+?\\\]|\$[^$\n]+?\$|\\\([\s\S]+?\\\))/g;
const pointPattern = /^\(?\s*-?\d+(?:\.\d+)?\s*,\s*-?\d+(?:\.\d+)?\s*\)?$/;
const graphExpressionPattern = /\by\s*=/i;

function stripMathDelimiters(value: string) {
  return value
    .trim()
    .replace(/^\$\$|\$\$$/g, "")
    .replace(/^\\\[|\\\]$/g, "")
    .replace(/^\$|\$$/g, "")
    .replace(/^\\\(|\\\)$/g, "")
    .trim();
}

function normalizeLatex(value: string) {
  return stripMathDelimiters(value)
    .replace(/\s+/g, " ")
    .replace(/−/g, "-")
    .trim();
}

function extractFormulas(content: string | null | undefined) {
  if (!content) return [];
  return [...content.matchAll(formulaPattern)].map((match) => normalizeLatex(match[0]));
}

function isPoint(latex: string) {
  return pointPattern.test(latex);
}

function isGraphExpression(latex: string) {
  return graphExpressionPattern.test(latex);
}

function addArtifact(
  artifacts: GraphArtifact[],
  seen: Set<string>,
  artifact: Omit<GraphArtifact, "id">
) {
  const key = `${artifact.kind}:${artifact.latex}`;
  if (seen.has(key)) return;
  seen.add(key);
  artifacts.push({ ...artifact, id: `${artifact.kind}-${artifacts.length + 1}` });
}

export function extractQuestionGraphArtifacts(question: GraphQuestionInput): GraphArtifact[] {
  const artifacts: GraphArtifact[] = [];
  const seen = new Set<string>();

  for (const formula of extractFormulas(question.stem)) {
    if (isPoint(formula)) addArtifact(artifacts, seen, { kind: "point", label: "Given point", latex: formula });
    if (isGraphExpression(formula)) addArtifact(artifacts, seen, { kind: "expression", label: "Question equation", latex: formula });
  }

  for (const formula of extractFormulas(question.stimulus)) {
    if (isPoint(formula)) addArtifact(artifacts, seen, { kind: "point", label: "Given point", latex: formula });
    if (isGraphExpression(formula)) addArtifact(artifacts, seen, { kind: "expression", label: "Stimulus equation", latex: formula });
  }

  for (const option of question.options ?? []) {
    for (const formula of extractFormulas(option.text)) {
      if (isGraphExpression(formula)) {
        addArtifact(artifacts, seen, { kind: "expression", label: `Choice ${option.label}`, latex: formula });
      }
      if (isPoint(formula)) {
        addArtifact(artifacts, seen, { kind: "point", label: `Choice ${option.label}`, latex: formula });
      }
    }
  }

  return artifacts.slice(0, 10);
}
