import { useContent } from '../App';

// One or two lines of "why" shown after an answer, so every question leaves a fact behind.
export function Explain({ termId }: { termId: string }) {
  const idx = useContent();
  const term = idx.termsById.get(termId);
  if (!term) return null;
  const group = idx.groupsById.get(term.groupId);
  const f = term.facts ?? {};
  const lines: [string, string][] = [];
  if (f.transmits) lines.push(['passes through', f.transmits]);
  if (f.location) lines.push(['where', f.location]);
  if (f.definition) lines.push(['what', f.definition.replace(/___/g, term.name)]);
  if (f.note) lines.push(['note', f.note]);
  if (!lines.length) return null;
  return (
    <div className="explain">
      <div className="eyebrow">{term.name}{group ? ` · ${group.title}` : ''}{f.category ? ` · ${f.category}` : ''}</div>
      {lines.slice(0, 2).map(([k, v]) => (
        <div key={k} className="explain-line"><span>{k}</span>{v}</div>
      ))}
    </div>
  );
}
