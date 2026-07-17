import type { ComponentType } from 'react'
import { template as lessonConfirmation } from './lesson-confirmation'
import { template as lessonReminder } from './lesson-reminder'
import { template as lessonUpdate } from './lesson-update'

export interface TemplateEntry {
  component: ComponentType<any>
  subject: string | ((data: Record<string, any>) => string)
  displayName?: string
  previewData?: Record<string, any>
  /** Fixed recipient — overrides caller-provided recipientEmail when set. */
  to?: string
}

export const TEMPLATES: Record<string, TemplateEntry> = {
  'lesson-confirmation': lessonConfirmation,
  'lesson-reminder': lessonReminder,
  'lesson-update': lessonUpdate,
}
