import React from 'react'
import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from '@react-email/components'
import type { TemplateEntry } from './registry'

interface Props {
  kind?: 'cancelled' | 'rescheduled'
  recipientName?: string
  studentName?: string
  subjectName?: string
  // For cancellations: the (former) lesson time
  // For reschedules: the NEW time
  whenForRecipient?: string
  whenForOther?: string
  otherLabel?: string
  // Reschedule-only: previous time in recipient's tz
  previousWhenForRecipient?: string
  // Cancellation-only
  refunded?: boolean
  lateCancel?: boolean
  reason?: string
  zoomLink?: string
  isTutor?: boolean
}

const Email = ({
  kind = 'cancelled',
  recipientName = 'there',
  studentName = 'the student',
  subjectName = 'a lesson',
  whenForRecipient = '',
  whenForOther = '',
  otherLabel = '',
  previousWhenForRecipient = '',
  refunded = false,
  lateCancel = false,
  reason = '',
  zoomLink = '',
  isTutor = false,
}: Props) => {
  const isCancel = kind === 'cancelled'
  const title = isCancel ? 'Lesson cancelled' : 'Lesson rescheduled'
  const preview = isCancel
    ? `${subjectName} lesson cancelled`
    : `${subjectName} lesson moved to ${whenForRecipient}`

  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>{preview}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>{title}</Heading>
          <Text style={text}>Hi {recipientName},</Text>
          <Text style={text}>
            {isCancel
              ? `The ${subjectName} lesson${isTutor ? ` with ${studentName}` : ''} has been cancelled.`
              : `The ${subjectName} lesson${isTutor ? ` with ${studentName}` : ''} has been moved to a new time.`}
          </Text>

          <Section style={card}>
            <Text style={label}>Student</Text>
            <Text style={value}>{studentName}</Text>
            <Text style={label}>Subject</Text>
            <Text style={value}>{subjectName}</Text>

            {!isCancel && previousWhenForRecipient && (
              <>
                <Text style={label}>Previous time</Text>
                <Text style={{ ...value, textDecoration: 'line-through', color: '#8a7660' }}>
                  {previousWhenForRecipient}
                </Text>
              </>
            )}

            <Text style={label}>{isCancel ? 'Was scheduled for' : 'New time (your time)'}</Text>
            <Text style={value}>{whenForRecipient}</Text>

            {whenForOther && otherLabel && (
              <>
                <Text style={label}>{otherLabel}</Text>
                <Text style={value}>{whenForOther}</Text>
              </>
            )}

            {isCancel && !isTutor && (
              <>
                <Text style={label}>Credit</Text>
                <Text style={value}>
                  {refunded
                    ? 'Refunded to your account'
                    : lateCancel
                      ? 'Not refunded (cancelled inside the policy window)'
                      : 'Not refunded'}
                </Text>
              </>
            )}

            {reason && (
              <>
                <Text style={label}>Reason</Text>
                <Text style={value}>{reason}</Text>
              </>
            )}
          </Section>

          {!isCancel && zoomLink && (
            <>
              <Text style={text}>The Zoom link stays the same:</Text>
              <Link href={zoomLink} style={button}>
                Open Zoom link
              </Link>
              <Text style={muted}>
                Or copy this link: <Link href={zoomLink}>{zoomLink}</Link>
              </Text>
            </>
          )}

          <Hr style={hr} />
          <Text style={muted}>
            {isCancel
              ? 'You can book a new lesson anytime from your dashboard.'
              : 'Manage your lessons anytime from your dashboard.'}
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: Email,
  subject: (data: Record<string, any>) => {
    const kind = data.kind === 'rescheduled' ? 'rescheduled' : 'cancelled'
    const subj = data.subjectName ?? 'lesson'
    if (kind === 'cancelled') {
      return data.isTutor
        ? `Cancelled: ${subj} with ${data.studentName ?? 'student'}`
        : `Your ${subj} lesson was cancelled`
    }
    return data.isTutor
      ? `Rescheduled: ${subj} with ${data.studentName ?? 'student'}`
      : `Your ${subj} lesson was rescheduled`
  },
  displayName: 'Lesson update (cancel / reschedule)',
  previewData: {
    kind: 'rescheduled',
    recipientName: 'Alex',
    studentName: 'Jordan',
    subjectName: 'Algebra',
    previousWhenForRecipient: 'Tuesday, Mar 4 at 4:00 PM EST',
    whenForRecipient: 'Wednesday, Mar 5 at 5:00 PM EST',
    whenForOther: 'Wednesday, Mar 5 at 2:00 PM PST',
    otherLabel: "Tutor's time",
    zoomLink: 'https://zoom.us/j/1234567890',
    isTutor: false,
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Georgia, "Times New Roman", serif' }
const container = { padding: '32px 28px', maxWidth: '560px', margin: '0 auto' }
const h1 = { fontSize: '24px', color: '#3d2b1f', margin: '0 0 16px' }
const text = { fontSize: '16px', lineHeight: '24px', color: '#3d2b1f', margin: '0 0 12px' }
const card = {
  background: '#faf6ef',
  border: '1px solid #ecdfc8',
  borderRadius: '10px',
  padding: '18px 20px',
  margin: '18px 0',
}
const label = {
  fontSize: '12px',
  textTransform: 'uppercase' as const,
  letterSpacing: '0.06em',
  color: '#8a7660',
  margin: '10px 0 2px',
}
const value = { fontSize: '15px', color: '#3d2b1f', margin: '0' }
const button = {
  display: 'inline-block',
  background: '#b8532b',
  color: '#ffffff',
  padding: '12px 20px',
  borderRadius: '8px',
  textDecoration: 'none',
  fontWeight: 600,
  margin: '8px 0 12px',
}
const muted = { fontSize: '13px', color: '#7a6a58', margin: '8px 0' }
const hr = { borderColor: '#ecdfc8', margin: '24px 0' }
