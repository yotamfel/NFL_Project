# Update Guide

You are updating the NFL DATA platform guide (`client/src/pages/Guide.jsx`) to reflect a recent change or new feature.

## Steps

1. **Understand what changed.** Read the description of the change (passed as $ARGUMENTS, or inferred from the current conversation context). If unclear, look at recent git changes: `git diff HEAD~1 HEAD --stat` and read the relevant files.

2. **Read the current Guide.** Read `client/src/pages/Guide.jsx` to understand the current structure — especially the `CONTENT.en.sections` and `CONTENT.he.sections` arrays.

3. **Decide where the update goes.** Each section has an `id` matching a platform feature (players, profile, comparison, draft, trends, smart, saved, glossary). Pick the right section, or add a new one if the feature is entirely new.

4. **Write the update in both languages.** The `en` and `he` objects must stay in sync — every section/subsection added to one must be added to the other. Hebrew technical terms (stat names, feature names) stay in English even in the Hebrew version.

5. **Edit Guide.jsx.** Add or update the relevant subsections. Follow the existing pattern exactly:
   - String body → plain paragraph
   - Array body → bullet list (each item is a string; items with `—` get the part before `—` bolded)

6. **Build and verify.** Run `cd client && npm run build` and confirm it succeeds with no errors.

7. **Report.** Tell the user what was added/changed in the Guide and in which section.

## Content guidelines

- Be concise but complete: one subsection per distinct concept.
- Explain the WHY and HOW, not just the WHAT.
- For new stat columns: follow the pattern `STAT_NAME — Full name: one-sentence explanation.`
- For new pages/tabs: add a full section with at minimum an overview subsection.
- Don't duplicate content that already exists in the Guide.
- Scroll/UI improvements don't need Guide entries unless they change how a feature is used.
