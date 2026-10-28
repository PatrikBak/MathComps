import * as Sentry from '@sentry/nextjs'

import { SENTRY_OPTIONS } from '@/lib/error-reporting/sentry-options'

// Browser faults reach Better Stack from the first script on
Sentry.init(SENTRY_OPTIONS)
