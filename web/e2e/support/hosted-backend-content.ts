import type {
  DefenseLimits,
  DefenseSessionListItem,
} from '@/components/features/defense/model/defense-types'
import type { LocalizedString } from '@/i18n/i18n'

/**
 * The material the fake backend serves: the problems a competition sets, their official solutions, the
 * examiner's own lines, the caps a conversation runs under, and one conversation about a handout the
 * site no longer carries.
 */

/**
 * The statements a competition sets, in the order it sets them.
 *
 * Real typeset maths rather than filler, since what these exercise is a student reading a problem and
 * arguing about it.
 */
export const STATEMENTS: LocalizedString[] = [
  {
    sk: 'Nájdite všetky dvojice kladných celých čísel $(a, b)$ také, že $a^2 + b$ aj $b^2 + a$ sú druhé mocniny celých čísel.',
    cs: 'Najděte všechny dvojice kladných celých čísel $(a, b)$ takové, že $a^2 + b$ i $b^2 + a$ jsou druhé mocniny celých čísel.',
    en: 'Find all pairs of positive integers $(a, b)$ such that both $a^2 + b$ and $b^2 + a$ are perfect squares.',
  },
  {
    sk: 'Nech $ABC$ je ostrouhlý trojuholník s výškami $AD$, $BE$ a $CF$. Dokážte, že priamka $EF$ je kolmá na priamku $AO$, kde $O$ je stred opísanej kružnice trojuholníka $ABC$.',
    cs: 'Nechť $ABC$ je ostroúhlý trojúhelník s výškami $AD$, $BE$ a $CF$. Dokažte, že přímka $EF$ je kolmá na přímku $AO$, kde $O$ je střed kružnice opsané trojúhelníku $ABC$.',
    en: 'Let $ABC$ be an acute triangle with altitudes $AD$, $BE$ and $CF$. Prove that the line $EF$ is perpendicular to the line $AO$, where $O$ is the circumcentre of triangle $ABC$.',
  },
  {
    sk: 'Na tabuli je napísaných $n$ jednotiek. V každom kroku zmažeme dve čísla $x$ a $y$ a napíšeme namiesto nich $\\frac{x + y}{4}$. Pre ktoré $n$ vieme dosiahnuť, aby na tabuli zostalo jediné číslo aspoň $\\frac{1}{n}$?',
    cs: 'Na tabuli je napsáno $n$ jedniček. V každém kroku smažeme dvě čísla $x$ a $y$ a napíšeme místo nich $\\frac{x + y}{4}$. Pro která $n$ dokážeme docílit, aby na tabuli zbylo jediné číslo alespoň $\\frac{1}{n}$?',
    en: 'The number $1$ is written on a board $n$ times. At each step we erase two numbers $x$ and $y$ and write $\\frac{x + y}{4}$ in their place. For which $n$ can we make the single remaining number at least $\\frac{1}{n}$?',
  },
]

/**
 * The official solution to each of {@link STATEMENTS}, in the order the competition sets them.
 *
 * Real arguments, since what these exercise is a student reading one back once their entry is over.
 */
export const SOLUTIONS: LocalizedString[] = [
  {
    sk: 'Bez ujmy na všeobecnosti nech $a \\le b$. Potom $b^2 < b^2 + a$ a zároveň $b^2 + a \\le b^2 + b < (b+1)^2$, takže $b^2 + a$ leží ostro medzi dvoma susednými druhými mocninami. Taká dvojica teda neexistuje.',
    cs: 'Bez újmy na obecnosti nechť $a \\le b$. Pak $b^2 < b^2 + a$ a zároveň $b^2 + a \\le b^2 + b < (b+1)^2$, takže $b^2 + a$ leží ostře mezi dvěma sousedními druhými mocninami. Taková dvojice tedy neexistuje.',
    en: 'Assume without loss of generality that $a \\le b$. Then $b^2 < b^2 + a$ and $b^2 + a \\le b^2 + b < (b+1)^2$, so $b^2 + a$ lies strictly between two consecutive squares. No such pair exists.',
  },
  {
    sk: 'Body $B$, $C$, $E$, $F$ ležia na kružnici s priemerom $BC$, takže $\\angle AFE = \\angle ACB$. Dotyčnica k opísanej kružnici v bode $A$ zviera s $AB$ ten istý uhol, takže je rovnobežná s $EF$. Keďže $OA$ je na túto dotyčnicu kolmá, je kolmá aj na $EF$.',
    cs: 'Body $B$, $C$, $E$, $F$ leží na kružnici s průměrem $BC$, takže $\\angle AFE = \\angle ACB$. Tečna ke kružnici opsané v bodě $A$ svírá s $AB$ tentýž úhel, takže je rovnoběžná s $EF$. Protože $OA$ je na tuto tečnu kolmá, je kolmá i na $EF$.',
    en: 'The points $B$, $C$, $E$, $F$ lie on the circle with diameter $BC$, so $\\angle AFE = \\angle ACB$. The tangent to the circumcircle at $A$ makes the same angle with $AB$, hence it is parallel to $EF$. Since $OA$ is perpendicular to that tangent, it is perpendicular to $EF$.',
  },
  {
    sk: 'Sledujme súčet čísel na tabuli. Krok nahrádzajúci $x$ a $y$ číslom $\\frac{x+y}{4}$ ho zmenší presne o $\\frac{3(x+y)}{4}$, takže súčet nikdy nerastie. Odtiaľ sa dá ohraničiť posledné číslo a dopočítať, pre ktoré $n$ je hranica $\\frac{1}{n}$ ešte dosiahnuteľná.',
    cs: 'Sledujme součet čísel na tabuli. Krok nahrazující $x$ a $y$ číslem $\\frac{x+y}{4}$ jej zmenší přesně o $\\frac{3(x+y)}{4}$, takže součet nikdy neroste. Odtud lze omezit poslední číslo a dopočítat, pro která $n$ je hranice $\\frac{1}{n}$ ještě dosažitelná.',
    en: 'Follow the sum of the numbers on the board. A step replacing $x$ and $y$ by $\\frac{x+y}{4}$ decreases it by exactly $\\frac{3(x+y)}{4}$, so the sum never grows. That bounds the final number, and the bound settles which $n$ can still reach $\\frac{1}{n}$.',
  },
]

/** The examiner's opening line, which the backend serves and every transcript starts on. */
export const OPENER =
  'Tell me how you approached this one. Start wherever your argument starts, not where the problem does.'

/**
 * What the examiner says next, cycled by how many turns the student has spent.
 *
 * A fake cannot argue, so these probe without claiming to have read anything. They are also what an
 * assertion names, which a live examiner could never be.
 */
export const SCRIPTED_REPLIES = [
  'That is a step, but it is not yet a reason. What forces it to hold rather than merely happen to?',
  'Take the case you skipped over. Does the same argument survive it, or does it need a second idea?',
  'You are asserting the bound. Show me where it comes from, in one line if you can.',
  'Good. Now the other direction: what would have to be true for this to fail?',
]

/** The caps every defense here is held to, standing in for the deployment's own setup. */
export const LIMITS: DefenseLimits = {
  maxCandidateChars: 4000,
  maxFeedbackCommentChars: 1000,
  maxMessagesPerDefense: 20,
}

/**
 * A conversation held about a handout the site no longer carries, so a spec can tell a control a graded
 * conversation is refused from one the list has lost altogether.
 */
export const HANDOUT_SESSION: DefenseSessionListItem = {
  id: 'session-handout',
  target: { kind: 'handout', handoutContentId: 'gone', environmentId: 'gone-1' },
  statement: 'Prove that every positive integer has a unique factorisation into primes.',
  lastActivityAt: new Date(0).toISOString(),
  lastStudentMessage:
    'Induction on the size of the number, with the smallest prime factor peeled off.',
  isGraded: false,
}
