---
name: git-commit-and-push
description: Use when the user asks to commit changes, prepare a git commit message, stage files, commit, or push changes while checking for generated, local-only, or sensitive files first.
---

# Git Commit and Push Workflow

When asked to commit changes:

1. Run `git status` and review the changed files.
2. Check for files that appear to be generated, temporary, local-only, build artifacts, IDE files, logs, caches, secrets, or environment-specific files.
3. If any files should likely be added to `.gitignore`, ask for confirmation before modifying `.gitignore` or proceeding with the commit.
4. Do not open, read, diff, or review file contents unless explicitly requested. Use only Git metadata, file names, directory names, and file paths to understand the scope of the changes.
5. Create a concise commit title that clearly summarizes the change.
   - Use a short sentence.
   - Make it easy to understand when scanning Git history.
   - Avoid vague messages such as "updates", "fixes", or "changes".
   - Focus on the outcome of the work.

6. Create a commit description that:
   - Summarizes the main changes included in the commit.
   - Uses clear professional language.
   - Is concise and practical.
   - Does not sound academic, overly formal, or AI-generated.
   - Focuses on what changed.

7. Show the proposed commit title and description and ask for confirmation.

8. After confirmation, execute:

```bash
git add .
git commit
git push
```

9. Use the generated commit title as the commit subject and the generated description as the commit body.
