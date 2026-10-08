import { createFileRoute } from "@tanstack/react-router";
import { HoldingPage } from "@/components/HoldingPage";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Brian Morgan Tutoring | Math & Computer Science Tutor" },
      {
        name: "description",
        content:
          "Brian Morgan tutors math from pre-algebra through calculus, SAT math prep, and AP Computer Science A online. Get in touch by email.",
      },
      {
        property: "og:title",
        content: "Brian Morgan Tutoring | Math & Computer Science Tutor",
      },
      {
        property: "og:description",
        content:
          "Private online math and computer science tutoring with Brian Morgan. Email to get in touch.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://brianmorgantutor.com/" },
      { name: "twitter:card", content: "summary" },
    ],
    links: [{ rel: "canonical", href: "https://brianmorgantutor.com/" }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "EducationalOrganization",
          name: "Brian Morgan Tutoring",
          url: "https://brianmorgantutor.com/",
          email: "brian@brianmorgantutor.com",
          description:
            "Private online math and computer science tutoring: pre-algebra through calculus, SAT math prep, and AP Computer Science A.",
        }),
      },
    ],
  }),

  component: HoldingPage,
});
