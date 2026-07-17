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
  whenForOther?: string
  otherLabel?: string
  zoomLink?: string
  isTutor?: boolean
}

const Email = ({
  recipientName = 'there',
  studentName = 'the student',
  subjectName = 'a lesson',
  whenForRecipient = '',
  whenForOther = '',
  otherLabel = '',
  zoomLink = '',
  isTutor = false,
}: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>
      {isTutor
        ? `New lesson booked: ${subjectName} with ${studentName}`
        : `Your ${subjectName} lesson is confirmed`}
    </Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>
          {isTutor ? 'New lesson booked' : 'Lesson confirmed'}
        </Heading>
        <Text style={text}>Hi {recipientName},</Text>
        <Text style={text}>
          {isTutor
            ? `${studentName} just booked a ${subjectName} lesson with you.`
            : `Your ${subjectName} lesson with STEM Tutor is confirmed.`}
        </Text>

        <Section style={card}>
          <Text style={label}>Student</Text>
          <Text style={value}>{studentName}</Text>
          <Text style={label}>Subject</Text>
          <Text style={value}>{subjectName}</Text>
          <Text style={label}>When (your time)</Text>
          <Text style={value}>{whenForRecipient}</Text>
          {whenForOther && otherLabel && (
            <>
              <Text style={label}>{otherLabel}</Text>
              <Text style={value}>{whenForOther}</Text>
            </>
          )}
          <Text style={label}>Duration</Text>
          <Text style={value}>1 hour</Text>
        </Section>

        {zoomLink && (
          <>
            <Text style={text}>Join the lesson via Zoom:</Text>
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
          Need to reschedule? Sign in to your dashboard to manage your lessons.
        </Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: Email,
  subject: (data: Record<string, any>) =>
    data.isTutor
      ? `New lesson booked: ${data.subjectName ?? 'lesson'} with ${data.studentName ?? 'student'}`
      : `Your ${data.subjectName ?? 'lesson'} is confirmed`,
  displayName: 'Lesson confirmation',
  previewData: {
    recipientName: 'Alex',
    studentName: 'Jordan',
    subjectName: 'Algebra',
    whenForRecipient: 'Tuesday, Mar 4 at 4:00 PM EST',
    whenForOther: 'Tuesday, Mar 4 at 1:00 PM PST',
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
