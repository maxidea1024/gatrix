# Stale Feature Flag Removal

Your task is to remove the stale feature flag `{{FLAG_KEY}}` from this codebase.

**Keep branch**: `{{KEEP_BRANCH}}` — always treat this flag as permanently **{{KEEP_BRANCH}}**.
**Reason it is stale**: {{FLAG_REASON}}

---

## ⚠️ Critical Safety Rules — Read First

These rules override everything else. When in doubt, do NOT make the change.

1. **Minimal changes only.** Touch only what is directly related to the flag `{{FLAG_KEY}}`.
   Do not refactor, rename, reformat, or reorganise anything that is not flag-related.
   If you find other code smells or issues while working, leave them alone.

2. **When in doubt, skip it.** If you are not 100% sure a piece of code is controlled
   exclusively by this flag, do not touch it. Leave a comment instead:
   ```
   // TODO(stale-flag-cleanup): verify this is safe to remove with {{FLAG_KEY}}
   ```

3. **Never change runtime behaviour.** The `{{KEEP_BRANCH}}` code path must behave
   exactly as it did before. Do not change logic, add optimisations, or alter
   side-effects in the kept code.

4. **Never delete files unless they are 100% flag-only.** Only delete a file if every
   meaningful line in it exists solely because of this flag. If there is any doubt,
   keep the file and just remove the flag-related lines.

5. **Never modify test logic.** You may remove test cases that exclusively test the
   `{{REMOVE_BRANCH}}` branch of `{{FLAG_KEY}}`, but do not alter, merge, or rewrite
   any other test logic. If the test file becomes empty, delete it.

6. **Do not touch unrelated flags.** If you encounter references to other feature flags
   while working, leave them completely untouched.

7. **Do not remove the flag from the Gatrix dashboard.** Only clean up source code.

---

## Flag Details

| Field | Value |
|-------|-------|
| Flag key | `{{FLAG_KEY}}` |
| camelCase | `{{FLAG_KEY_CAMEL}}` |
| PascalCase | `{{FLAG_KEY_PASCAL}}` |
| snake_case | `{{FLAG_KEY_SNAKE}}` |
| SCREAMING_SNAKE | `{{FLAG_KEY_SCREAMING_SNAKE}}` |
| Keep branch | `{{KEEP_BRANCH}}` |
| Remove branch | `{{REMOVE_BRANCH}}` |
| Last modified | {{LAST_MODIFIED}} |

---

## Step-by-Step Instructions

### Step 1 – Search for all usages

> **If a "Files Containing This Flag" section appears above, start there.**
> Those files were found by a pre-scan. Limit your search to those files first.
> Only do a broader search if you believe the pre-scan may have missed something
> (e.g. the flag key was split across lines or generated at runtime).

Search for **all** of the naming variants listed in the table above.
Also search for the flag key used as a dictionary/map key, object property,
or inside strings and comments.

List every file that contains a reference before making any changes.

### Step 2 – Classify each reference

For each reference, decide its type before changing anything:

- **Direct check** — `if (flag.isEnabled('{{FLAG_KEY}}'))`, `isEnabled(FLAGS.MY_FLAG)`, etc.
- **Constant definition** — `const MY_FLAG = '{{FLAG_KEY}}'`
- **Type / interface** — a TypeScript/type field whose only purpose is this flag
- **Test case** — a unit or integration test specifically for this flag's behaviour
- **Comment / documentation** — a reference in a comment or doc string
- **Unclear** — anything that does not fit cleanly into the above categories

**Only process the clear categories.** Mark unclear ones with a TODO comment and skip them.

### Step 3 – Remove direct conditional checks

For each direct check controlled by `{{FLAG_KEY}}`:

- Assume the flag is permanently **{{KEEP_BRANCH}}**, so the condition is always `{{KEEP_BRANCH_BOOL}}`.
- Inline the **`{{KEEP_BRANCH}}`** branch directly; remove the **`{{REMOVE_BRANCH}}`** branch.
- Remove the `else` block (or `if` block, depending on which branch you are keeping).
- Do **not** change variable names, spacing, or formatting of the kept code beyond
  what is necessary to remove the conditional wrapper.

Example (keep=enabled):
```
// Before
if (client.isEnabled('{{FLAG_KEY}}')) {
    doNewThing();
} else {
    doOldThing();
}

// After
doNewThing();
```

If the conditional is a ternary:
```
// Before
const value = isEnabled ? newValue : oldValue;
// After (keep=enabled)
const value = newValue;
```

### Step 4 – Remove constant definitions

If the flag key is stored in a dedicated constant (e.g. `const FEATURE_MY_FLAG = '{{FLAG_KEY}}'`)
and that constant is **used only** for this flag's checks:

- Remove the constant definition.
- Replace all usages of the constant with the inlined `{{KEEP_BRANCH}}` logic from Step 3.

If the constant is exported and used in multiple files, check every usage before removing.
If any usage is unclear, leave the constant and add a TODO comment.

### Step 5 – Remove now-unused imports and dead code

After simplifying all usages:

- Remove `import` / `require` statements that are now unused **solely because of this change**.
- Do not remove imports that are still referenced elsewhere.
- Remove helper functions that are now unreachable **only if** their only callers were
  the flag conditionals you just removed. If the function is exported, be conservative:
  check all files for usages first.

### Step 6 – Clean up flag-only files

If a file now contains no meaningful code (only whitespace, empty exports, or unreachable stubs)
**because of this flag removal**, delete the file.

If the file has any other purpose, keep it.

### Step 7 – Verify

Run the following in order and fix any errors before committing:

1. Type checker — `tsc --noEmit` (or the equivalent for this project)
2. Linter — `eslint`, `ruff`, `flutter analyze`, etc. if configured
3. Unit tests (fast ones only) — skip e2e / integration / slow test suites

If verification fails and you cannot fix the error without changing unrelated code,
**revert the change for that file** and leave a TODO comment explaining why.

### Step 8 – Commit

Stage only the files you modified for this flag. Then commit:

```
chore: remove stale flag {{FLAG_KEY}}

{{FLAG_REASON}}. Always keep {{KEEP_BRANCH}} path.
```

Do not squash or amend previous commits. Do not push.

---

## What NOT to do

- ❌ Do not rename variables or functions (even if the name contains the flag key)
- ❌ Do not reformat code that you did not have to touch for the removal
- ❌ Do not add new abstractions, helpers, or utilities
- ❌ Do not fix linting warnings that predate this change
- ❌ Do not update dependencies or configuration files
- ❌ Do not remove logging or telemetry calls unless they only exist inside the removed branch
- ❌ Do not break import cycles by reorganising modules
- ❌ Do not touch CI/CD configs, Dockerfiles, or infrastructure files
