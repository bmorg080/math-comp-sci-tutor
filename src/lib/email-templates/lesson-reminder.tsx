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
  recipientName?: string
  studentName?: string
  subjectName?: string
  whenForRecipient?: string
  zoomLink?: string
  isTutor?: boolean
}

const Email = ({
  recipientName = 'there',
  studentName = 'the student',
  subjectName = 'a lesson',
  whenForRecipient = '',
  zoomLink = '',
  isTutor = false,
}: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>
      Reminder: {subjectName} lesson tomorrow — {whenForRecipient}
    </Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Lesson tomorrow</Heading>
        <Text style={text}>Hi {recipientName},</Text>
        <Text style={text}>
          {isTutor
            ? `Reminder: you have a ${subjectName} lesson with ${studentName} in about 24 hours.`
            : `Reminder: your ${subjectName} lesson is coming up in about 24 hours.`}
        </Text>

        <Section style={card}>
          <Text style={label}>Student</Text>
          <Text style={value}>{studentName}</Text>
          <Text style={label}>Subject</Text>
          <Text style={value}>{subjectName}</Text>
          <Text style={label}>When (your time)</Text>
          <Text style={value}>{whenForRecipient}</Text>
          <Text style={label}>Duration</Text>
          <Text style={value}>1 hour</Text>
        </Section>

        {zoomLink && (
          <>
            <Text style={text}>Join with the same Zoom link:</Text>
            <Link href={zoomLink} style={button}>
              Open Zoom link
            </Link>
            <Text style={muted}>
              Or copy: <Link href={zoomLink}>{zoomLink}</Link>
            </Text>
          </>
        )}

        <Hr style={hr} />
        <Text style={muted}>
          Need to cancel or reschedule? Sign in to your dashboard. Cancellations
          within 24 hours are non-refundable.
        </Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: Email,
  subject: (data: Record<string, any>) =>
    `Reminder: ${data.subjectName ?? 'lesson'} tomorrow`,
  displayName: 'Lesson reminder (24h)',
  previewData: {
    recipientName: 'Alex',
    studentName: 'Jordan',
    subjectName: 'Algebra',
    whenForRecipient: 'Tuesday, Mar 4 at 4:00 PM EST',
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
