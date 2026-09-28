import type { Grade } from '../engine/match';

export function Feedback({ grade, given, strictNote }: { grade: Grade; given: string; strictNote?: boolean }) {
  const { verdict, canonical, siblingName } = grade;
  return (
    <div className={`feedback ${verdict}`}>
      {verdict === 'correct' && <>Correct: <b>{canonical}</b></>}
      {verdict === 'close' && (
        <>
          Close, check the spelling: <b>{canonical}</b>
          <small>you wrote “{given}” · counts as correct, logged as a spelling miss</small>
        </>
      )}
      {verdict === 'sibling' && (
        <>
          No. That is the <b>{siblingName}</b>. This is the <b>{canonical}</b>.
        </>
      )}
      {verdict === 'wrong' && (
        <>
          No. This is the <b>{canonical}</b>.
          {grade.spelling && strictNote && <small>strict spelling is on; a near-miss counts as wrong</small>}
        </>
      )}
    </div>
  );
}
