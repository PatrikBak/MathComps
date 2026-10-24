'use client'

import { useLocale, useTranslations } from 'next-intl'
import { useMemo } from 'react'

import { CountryFlag } from '@/components/shared/components/CountryFlag'
import { assertNever } from '@/components/shared/utils/assert-never'
import type { Locale } from '@/i18n/i18n'

import type { SchoolGrade, StudentBackground } from '../model/hosted-competition-types'

/**
 * Props for the {@link StudentDetails}.
 */
type StudentDetailsProps = {
  /** The student, as much of them as the details show. */
  student: StudentBackground
}

/**
 * Where a student competes from and where they are in school: a flag where they named a country, and a few words.
 */
export function StudentDetails({ student }: StudentDetailsProps) {
  // Copy for where a student is from and in school
  const t = useTranslations('competitions.studentDetails')

  // The language countries are named in
  const locale = useLocale() as Locale

  // What countries are called here
  const regionNames = useMemo(() => new Intl.DisplayNames([locale], { type: 'region' }), [locale])

  return (
    <span className="flex min-w-0 items-center gap-1.5">
      {/* The flag, or the room one takes, so the words line up with rows that have it */}
      {student.countryCode === null ? (
        <span aria-hidden className="w-3.5 shrink-0" />
      ) : (
        <CountryFlag
          code={student.countryCode}
          name={regionNames.of(student.countryCode) ?? student.countryCode}
          width={14}
          height={10}
          className="shrink-0 rounded-[2px]"
        />
      )}

      {/* Where they are in school */}
      <span className="min-w-0 truncate text-[10px] font-normal text-muted sm:text-xs">
        {schoolGradeWords(student.grade, t)}
      </span>
    </span>
  )
}

/**
 * Where a student is in school, in words.
 *
 * @param grade - Where they are.
 * @param t - Copy for where a student is from and in school.
 *
 * @returns The words.
 */
function schoolGradeWords(
  grade: SchoolGrade,
  t: ReturnType<typeof useTranslations<'competitions.studentDetails'>>
): string {
  // The words for each kind of school year
  switch (grade.kind) {
    // A year of primary school
    case 'primarySchool':
      return t('primarySchool', { year: grade.year })

    // A year of high school
    case 'highSchool':
      return t('highSchool', { year: grade.year })

    // Done with high school
    case 'pastHighSchool':
      return t('pastHighSchool')

    // Every grade is handled above
    default:
      return assertNever(grade)
  }
}
