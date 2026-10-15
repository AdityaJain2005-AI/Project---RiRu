# Privacy policy template

This file is a template for a student project. It is not legal advice and it is not a published policy until a maintainer reviews it.

## What RiRu stores

- A guest or demo profile, face-scan metadata, ingredient-scan text, routine rows, check-ins, and consent events.
- A face photo or label photo is discarded after analysis unless storage is configured and the user turns retention on. The default is to delete the photo after analysis.
- Prices exist only when the user pastes them.

## What is not sent to the chat model

The recovery clinician note is kept for the user’s own export. It is not included in the public recovery response and it is not sent to the language model.

Chat uses short knowledge-pack excerpts. With no API key, chat stays unconfigured.

## Export and delete

`GET /api/v1/me/export` returns the user’s stored rows, including an active clinician note.

`DELETE /api/v1/me/data` removes that user’s child rows. The shared demo user row is kept so the demo account still exists. A guest delete removes the guest user.

## Contact

Replace this sentence with a real contact before publishing the policy.
