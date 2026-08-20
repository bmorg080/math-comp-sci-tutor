# Brian Morgan Stem Tutor

I have a tutoring business. I want my students to be able to schedule appointments with me and pay for lessons. Students can select from a list of possible lesson types, whose prices vary. After purchasing and scheduling a lesson, we are both emailed a Zoom link for the proper time.



I have a calendar on the website where students can click on open times. Once a student has selected the time, the app schedules a Zoom meeting with me and the student, and we're both emailed a confirmation with the lesson time and Zoom link.



## Accounts



- One account per family, shared by parent and student — either can log in using their own email/password, both linked to the same account.

- A parent email is required at signup. A student email is optional; if added, it's linked to the same shared account (not a separate login).

- One account can be associated with multiple students (siblings), each with their own lesson history.

- Timezone is captured at signup and used for all scheduling and displayed times.



## Admin functions



- Update customer profiles

- View a list of all customers and all previous and scheduled lessons

- Edit schedule

  - Cancel lessons (triggers automatic refund/credit to the customer, per cancellation policy below)

  - Create lessons

- Edit subjects and pricing

  - Change pricing for specific customers (this custom price is shown to that customer at checkout, not hidden — no surprise pricing)

- Refund payments



## Customer functions



- View a list of previous lessons and scheduled lessons

- Purchase lessons and lesson packages

- Schedule and cancel lessons



## Packages & Credits



- Customers can purchase a single lesson (1 hour) or a bundle of 5 lessons for a 10% discount.

- Package credits are shared across all students on the account.

- Credits expire 9 months after purchase. *(Placeholder — adjust if you want a different window.)*

- Unused, unexpired credits can be manually refunded by admin on request (not automatic).



## Cancellation & No-Show Policy



- Customers can cancel a scheduled lesson for free if done more than 24 hours before the start time — the credit/payment is returned.

- Cancellations within 24 hours of the lesson forfeit the credit/payment.

- No-shows are treated the same as a late cancellation — credit/payment is forfeited.

- If admin cancels a lesson (e.g. tutor unavailable), the customer is automatically refunded or credited, regardless of timing.



## Notifications



- Confirmation email (with Zoom link and time) sent to both parties immediately after scheduling.

- Reminder email sent to both parties 24 hours before the lesson.



## Customer Journey



1. Customer sees the tutor's bio and a background paragraph about services offered.

2. On the homepage, user can create an account or log in.

3. Once logged in, customer sees a table of subjects tutored, with prices per hour for each (including any custom pricing that applies to them).

4. Customer purchases a single lesson or a 5-lesson bundle (10% discount).

5. Customer sees the tutor's schedule and open appointments (in the customer's local timezone) and clicks a time, in 1-hour segments, to book.

6. If the customer doesn't already have an applicable credit, they're prompted to pay by credit card before the booking is confirmed.

7. Both parties receive a confirmation email with the Zoom link and lesson time; a reminder follows 24 hours before the lesson.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/49d2214a-e455-4ac6-b356-00a68368d58e).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
