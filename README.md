# Witnessed

An Expo and React Native journaling prototype that turns a private reflection into a structured, supportive response. The project explores mobile interaction design, voice input, server-mediated AI, rate limiting, crisis-aware presentation, and local export.

> Portfolio note: this is an exploratory software prototype, not a clinical product or a deployed mental-health service.

## Portfolio highlights

- Typed React Native navigation and multi-screen workflow
- Text and speech-to-text journal input
- Mood and response-tone controls
- Structured AI response schema
- PDF and text export
- Server-side provider integration through a Netlify Function
- Server-side rate limiting with Upstash
- Explicit crisis and human-referral presentation states

## Technology

- Expo 51 and React Native 0.74
- TypeScript
- React Navigation
- Netlify Functions
- OpenAI API called only from the server function
- Upstash Redis rate limiting

## Local setup

Install dependencies and copy `.env.example` to a local `.env`. Only `EXPO_PUBLIC_API_URL` is intended for the mobile bundle. Provider and Redis credentials belong in the Netlify deployment environment and must never use the `EXPO_PUBLIC_` prefix.

```text
npm install
npm start
```

The included EAS identifiers are placeholders; configure a separate Expo project before building distributable binaries.

## Privacy and safety boundaries

Journal text can contain highly sensitive personal information. This prototype sends an entry to the configured server function and AI provider only after the user confirms submission. It does not include a production privacy program, encrypted account storage, clinical validation, or regulatory compliance certification.

Before any real-world deployment:

- Publish clear consent, retention, deletion, and subprocessors disclosures.
- Avoid collecting names, addresses, medical-record data, or other unnecessary identifiers.
- Configure server-side rate limiting; the function fails closed when it is unavailable.
- Restrict allowed web origins if a browser build is deployed.
- Add authentication, abuse controls, monitoring, and a deletion workflow.
- Conduct independent mental-health safety, privacy, and accessibility reviews.

Witnessed is a reflective journaling aid—not therapy, diagnosis, crisis response, or medical advice. Emergency messaging must direct users to appropriate local human services.

## Repository hygiene

No journal entries, API credentials, Redis credentials, deployment tokens, build artifacts, or signing files are included. The repository uses synthetic examples only.

The public repository starts with this sanitized portfolio edition; earlier experimental history was intentionally not imported.
