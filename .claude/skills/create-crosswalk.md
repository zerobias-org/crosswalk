# Create Crosswalk Skill

Create crosswalk packages from ZeroBias tasks with automatic dependency resolution and proper task management.

## Trigger

```
/create-crosswalk [task-id]
```

**Arguments:**
- `task-id` (optional): ZeroBias task UUID or task name. If not provided, will prompt for input.

## Examples

```
/create-crosswalk bbd73958-f3f6-4ec7-a2ed-79cb105c9c19
/create-crosswalk "NIST 800-218 to CNCF SSCP"
/create-crosswalk
```

---

## Workflow

### Step 1: Get Task Details

**IMPORTANT: Task Lookup Limitations**

The ZeroBias API has specific lookup behaviors:

| Input | Method | Notes |
|-------|--------|-------|
| **UUID** | `platform.Task.get({ id: uuid })` | Direct lookup, fastest |
| **Task name** | `portal.Task.search({ searchTaskBody: { search: "name" }})` | Searches name & description |
| **Task code** | NOT directly searchable | Code field is not indexed |

**Recommended approach:**
```javascript
// If UUID provided (contains dashes, 36 chars)
if (input.match(/^[0-9a-f-]{36}$/i)) {
  const task = zerobias_execute("platform.Task.get", { id: input })
}

// If task name provided (search)
else {
  const results = zerobias_execute("portal.Task.search", {
    searchTaskBody: { search: input }
  })
  // Find exact match or prompt user to select
  const task = results.items.find(t => t.name === input) || results.items[0]
}
```

### Step 2: Extract Task Information

The task provides all the information needed:

| Field | Source | Example |
|-------|--------|---------|
| **Task ID** | `task.id` | `bbd73958-f3f6-4ec7-a2ed-79cb105c9c19` |
| **Task Code** | `task.code` | `contextDev-42` |
| **Name** | `task.name` | `NIST 800-218 v1.1 to CNCF SSCP v1` |
| **Description** | `task.description` | `Create a crosswalk mapping...` |
| **Branch Name** | `task.customFields.branchName` | `feature/crosswalk-nist-800218-cncf-sscp` |
| **Repository URL** | `task.customFields.repoUrl` | `https://github.com/zerobias-org/crosswalk` |
| **Artifact Type** | `task.customFields.artifactType` | `crosswalk` |
| **Vendor** | `task.customFields.vendor` | (if set) |
| **Suite** | `task.customFields.suite` | (if set) |
| **Version** | `task.customFields.version` | (if set) |
| **Parent Task** | `task.customFields.parentTaskId` | (if dependency subtask) |

### Step 3: Determine Crosswalk Details

**From customFields:**
```javascript
const artifactType = task.customFields.artifactType  // crosswalk
const branchName = task.customFields.branchName      // feature/crosswalk-...
const repoUrl = task.customFields.repoUrl            // https://github.com/zerobias-org/crosswalk
const vendor = task.customFields.vendor              // may need to parse from name
```

**Parse source URL from description:**
```javascript
const urlMatch = task.description.match(/https?:\/\/[^\s]+/)
const sourceUrl = urlMatch ? urlMatch[0] : null
```

**Parse source/target frameworks from task name:**
- Task name: `NIST 800-218 v1.1 to CNCF SSCP v1` -> source: `nist/800-218/v1.1`, target: `cncf/sscp/v1`

**Crosswalk-specific fields to determine:**

| Field | Description | Example |
|-------|-------------|---------|
| **sourceVendor** | Vendor of source framework | `nist` |
| **sourceSuite** | Suite of source framework | `800-218` |
| **sourceVersion** | Version of source framework | `v1_1` |
| **targetVendor** | Vendor of target framework | `cncf` |
| **targetSuite** | Suite of target framework | `sscp` |
| **targetVersion** | Version of target framework | `v1` |

### Step 4: Update Task to In Progress

```javascript
// Find "Start" transition from task.nextTransitions
const startTransition = task.nextTransitions.find(t => t.status === "in_progress")

// Get your party ID
const party = zerobias_execute("platform.Party.getMyParty", {})

zerobias_execute("platform.Task.update", {
  id: task.id,
  updateTask: {
    assigned: party.id,  // Party ID, NOT principal ID
    customFields: {
      artifactType: "crosswalk",
      repoUrl: "https://github.com/zerobias-org/crosswalk",
      branchName: branchName
    },
    transitionId: startTransition.id
  }
})

zerobias_execute("platform.Task.addComment", {
  id: task.id,
  newTaskComment: {
    commentMarkdown: `**Started:** Beginning crosswalk creation.

**Task:** ${task.code}
**Type:** crosswalk
**Source Framework:** ${sourceVendor}/${sourceSuite}/${sourceVersion}
**Target Framework:** ${targetVendor}/${targetSuite}/${targetVersion}
**Branch:** ${branchName}
**Repo:** https://github.com/zerobias-org/crosswalk`
  }
})
```

### Step 5: Check Dependencies (MANDATORY)

**CRITICAL: Crosswalks are at the END of the dependency chain. BOTH source and target frameworks MUST exist.**

```
vendor → suite → framework/standard/benchmark → crosswalk
```

**Check BOTH framework dependencies exist:**
```javascript
// 1. Check source framework exists
const sourceFrameworks = zerobias_execute("portal.Framework.search", {
  searchFrameworkBody: { search: `${sourceVendor} ${sourceSuite}` }
})
const sourceExists = sourceFrameworks.items.some(f =>
  f.code?.toLowerCase().includes(sourceVendor.toLowerCase()) &&
  f.code?.toLowerCase().includes(sourceSuite.toLowerCase())
)

// 2. Check target framework exists
const targetFrameworks = zerobias_execute("portal.Framework.search", {
  searchFrameworkBody: { search: `${targetVendor} ${targetSuite}` }
})
const targetExists = targetFrameworks.items.some(f =>
  f.code?.toLowerCase().includes(targetVendor.toLowerCase()) &&
  f.code?.toLowerCase().includes(targetSuite.toLowerCase())
)

// 3. If either framework is missing, create subtasks and complete them first
if (!sourceExists || !targetExists) {
  // 1. Create subtasks for missing framework(s) (and their vendor/suite deps)
  // 2. Complete with: /create-framework {framework-task-id}
  // 3. Then resume this task
}
```

**Also check the suite dependency for the crosswalk package:**
```javascript
// The crosswalk package.json depends on a suite package
// Check the primary suite exists (typically the source framework's suite)
const suites = zerobias_execute("portal.Suite.search", {
  searchSuiteBody: { search: `${sourceVendor} ${sourceSuite}` }
})
const suiteExists = suites.items.some(s =>
  s.vendorCode?.toLowerCase() === sourceVendor.toLowerCase()
)
```

**If dependencies are missing:** Create subtasks for vendor/suite/framework as needed, following the dependency chain order.

### Step 6: Navigate to Repository

Use `task.customFields.repoUrl` to identify the repository:

```javascript
// Map repoUrl to local path
const repoMap = {
  "https://github.com/zerobias-org/crosswalk": "/path/to/zerobias-org/crosswalk",
}
```

### Step 7: Create Branch from Task

**Use the branch name from task:**

```bash
git checkout main
git pull origin main
git checkout -b {task.customFields.branchName}
```

### Step 8: Create Package Structure

Crosswalk packages are organized by `package/{vendor}/{suite}/{version}/`:

```bash
# Create package directory
mkdir -p package/{sourceVendor}/{sourceSuite}/{sourceVersion}_{targetVendor}_{targetSuite}_{targetVersion}
```

**Directory naming convention:**
- Path: `package/{sourceVendor}/{sourceSuite}/{sourceVersion}_{targetVendor}_{targetSuite}_{targetVersion}/`
- Example: `package/nist/800-218/v1_1_cncf_sscp_v1/`
- Example: `package/aiuc/aiuc_1/v1_csa_aicm_v1/`

**Required files:**

```
package/{sourceVendor}/{sourceSuite}/{sourceVersion}_{target}/
├── package.json          # @zerobias-org/crosswalk-{name}
├── index.yml             # Crosswalk metadata (source/target frameworks)
├── elements.yml          # Mapping elements
├── .npmrc                # Registry configuration
└── versions/
    └── 1.0.0.yml         # Version-specific data (optional)
```

### Step 9: Create package.json

```json
{
  "name": "@zerobias-org/crosswalk-{sourceVendor}-{sourceSuite}-{sourceVersion}_{targetVendor}_{targetSuite}_{targetVersion}",
  "version": "1.0.0",
  "description": "Crosswalk mapping {Source Framework Name} to {Target Framework Name}",
  "author": "team@zerobias.com",
  "license": "ISC",
  "type": "module",
  "repository": {
    "type": "git",
    "url": "git@github.com:zerobias-org/crosswalk.git",
    "directory": "package/{sourceVendor}/{sourceSuite}/{folderName}/"
  },
  "scripts": {
    "correct:deps": "tsx ../../../../scripts/correctDeps.ts",
    "validate": "tsx ../../../../scripts/validate.ts"
  },
  "publishConfig": {
    "registry": "https://npm.pkg.github.com/"
  },
  "files": [
    "index.yml",
    "elements.yml",
    "versions/**",
    "baselines/**",
    "elements/**"
  ],
  "zerobias": {
    "dataloader-version": "1.0.0",
    "import-artifact": "crosswalk",
    "package": "{sourceVendor}.{sourceSuite}.{sourceVersion}_{targetVendor}_{targetSuite}_{targetVersion}.crosswalk"
  },
  "dependencies": {
    "@zerobias-org/framework-{sourceVendor}-{sourceSuite}-{sourceVersion}": "latest",
    "@zerobias-org/framework-{targetVendor}-{targetSuite}-{targetVersion}": "latest"
  }
}
```

**CRITICAL package.json rules:**
- **Metadata key**: `zerobias` (NOT `auditmation`)
- **Package value**: `{vendor}.{suite}.{version}.crosswalk` (NO `zerobias.` prefix)
- **Dataloader version**: `"1.0.0"`
- **Runner**: `tsx` (NOT `ts-node`)
- **Type**: `"type": "module"` required
- **Dependencies**: BOTH source and target framework packages

**If a framework dependency is on @auditlogic (not yet on @zerobias-org):**
- Use `@auditlogic/framework-{name}` instead of `@zerobias-org/framework-{name}`
- Known @auditlogic-only packages:
  - `@auditlogic/framework-nist-800218-v1.1`
  - `@auditlogic/framework-owasp-samm-v1.0`
  - `@auditlogic/framework-csa-ccm-v4.0.12`
  - `@auditlogic/framework-owasp-asvs-v4.0.3`
  - `@auditlogic/framework-nist-80053-rev5`
  - `@auditlogic/benchmark-owasp-wstg-v5`
- Verify with `npm view @auditlogic/package-name` before using

**Some crosswalks also include a suite dependency:**
```json
"dependencies": {
  "@auditlogic/framework-nist-800218-v1.1": "latest",
  "@zerobias-org/framework-cncf-sscp-v1": "latest",
  "@zerobias-org/suite-nist-800-218": "latest"
}
```

### Step 10: Create .npmrc

**Default (all deps on @zerobias-org):**
```
@zerobias-org:registry=https://pkg.zerobias.org/
//pkg.zerobias.org/:_authToken=${ZB_TOKEN}
```

**If package depends on @auditlogic packages, also add:**
```
@auditlogic:registry=https://npm.pkg.github.com/
//npm.pkg.github.com/:_authToken=${NPM_TOKEN}
@zerobias-org:registry=https://pkg.zerobias.org/
//pkg.zerobias.org/:_authToken=${ZB_TOKEN}
```

### Step 11: Create index.yml

```yaml
id: {generate-uuid-v4}
name: {Source Framework Name} to {Target Framework Name}
description: >-
  This crosswalk maps {source} requirements to {target} controls,
  demonstrating alignment between the two frameworks.
externalId: {Source Short Name} to {Target Short Name}
code: {sourceVendor}_{sourceSuite}_{sourceVersion}_{targetVendor}_{targetSuite}_{targetVersion}
status: active
targetStandard: {targetVendor}.{targetSuite}.{targetVersion}.framework
sourceStandard: {sourceVendor}.{sourceSuite}.{sourceVersion}.framework
url: {optional-source-url}
```

**CRITICAL:**
- Generate new UUID v4 for `id`
- `targetStandard` and `sourceStandard` use dot notation: `vendor.suite.version.framework`
- Valid status values: `active`, `verified`, `inactive`, `deprecated` (NOT `draft` or `published`)

### Step 12: Create elements.yml

```yaml
elements:
  - id: {generate-uuid-v4}
    targetElement: {target-element-code}
    sourceElement: {source-element-code}
    relationshipType: {relationship}
    strengthOfRelationship: {1-10}
  - id: {generate-uuid-v4}
    targetElement: {target-element-code}
    sourceElement: {source-element-code}
    relationshipType: {relationship}
    strengthOfRelationship: {1-10}
```

**Valid relationship types (from platform schema `crosswalkElementRelationshipType`):**
- `equals` - Requirements are essentially the same
- `subset_of` - Source is a subset of target
- `superset_of` - Source encompasses target
- `intersects` - Partial overlap between requirements

**IMPORTANT:** Only these 4 values are accepted by the dataloader. Do NOT use `related`, `equivalent`, `complementary`, or any other values.

**Strength of relationship:** Integer 1-10 (10 = strongest alignment)

**Element mapping best practices:**
- Each element needs a unique UUID v4
- `targetElement` and `sourceElement` reference element codes from the respective frameworks
- Fetch source documentation to validate mappings
- One source element can map to multiple target elements (and vice versa)

### Step 13: Populate Mappings from Source

1. Fetch source documentation from URL in `task.description`
2. Parse both framework structures (elements/controls/requirements)
3. Create element mappings based on:
   - Requirements text comparison
   - Control objective alignment
   - Industry-standard crosswalk references
4. Each mapping must have a unique UUID

### Step 14: Validate

```bash
npm run validate
```

The validation script checks:
- Package.json structure and naming conventions
- `zerobias` metadata section
- index.yml required fields and valid status values
- Elements reference valid element types
- UUID format validation

### Step 15: Commit Using Task Info

```bash
git add .
git commit -m "feat({sourceVendor}-{sourceSuite}): ${task.name}

- Add crosswalk with {N} element mappings
- Source: ${sourceUrl}
- Maps ${sourceFramework} to ${targetFramework}

Task: ${task.code}
Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

### Step 16: Push Using Task Branch

```bash
git push origin {task.customFields.branchName}
```

### Step 17: Create Pull Request

**IMPORTANT:** PRs must target the `dev` branch (not `main`).

```bash
gh pr create --base dev \
  --title "feat({sourceVendor}-{sourceSuite}): ${task.name}" \
  --body "$(cat <<'EOF'
## Summary
- **Task:** ${task.code} - ${task.name}
- **Type:** crosswalk
- **Branch:** ${task.customFields.branchName}
- **Package:** @zerobias-org/crosswalk-${packageName}
- **Elements:** {count} mappings

## Frameworks Mapped
- **Source:** ${sourceFramework} (`${sourceStandard}`)
- **Target:** ${targetFramework} (`${targetStandard}`)

## Dependencies
- Source framework: @zerobias-org/framework-${sourcePackage} (or @auditlogic/...)
- Target framework: @zerobias-org/framework-${targetPackage} (or @auditlogic/...)

## Source
${sourceUrl from task.description}

## Task Reference
- **Task Code:** ${task.code}
- **Task ID:** ${task.id}
- **Assigned:** ${task.assigned.contactName}
- **Boundary:** ${task.boundary.name}

## Validation
- [x] `npm run validate` passes
- [x] All elements have valid UUIDs
- [x] Relationship types are valid
- [x] Source and target framework references are correct

Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

### Step 18: Update Task with Completion

```javascript
zerobias_execute("platform.Task.addComment", {
  id: task.id,
  newTaskComment: {
    commentMarkdown: `## Crosswalk Created

**Task:** ${task.code}
**Package:** @zerobias-org/crosswalk-${packageName}
**Elements:** ${elementCount} mappings
**Source:** ${sourceFramework}
**Target:** ${targetFramework}
**Branch:** ${branchName}
**PR:** ${prUrl}

### Next Steps
- PR needs review and merge (target: dev branch)
- After merge, crosswalk available in catalog`
  }
})

// Find "Peer Review" transition to move to awaiting_approval
const reviewTransition = task.nextTransitions.find(t => t.status === "awaiting_approval")
zerobias_execute("platform.Task.update", {
  id: task.id,
  updateTask: { transitionId: reviewTransition.id }
})
```

---

## Dependency Resolution

When a required dependency doesn't exist:

### 1. Create Subtask

```javascript
zerobias_execute("platform.Task.create", {
  newTask: {
    name: `Create ${depType}: ${depName}`,
    description: `Required dependency for ${task.code}: ${task.name}

Parent Task: ${task.code}
Parent Task ID: ${task.id}`,
    status: "todo",
    customFields: {
      artifactType: depType,
      vendor: vendorCode,
      suite: suiteCode,
      repoUrl: depRepoUrl,
      branchName: `feature/${depType}-${depName}`,
      parentTaskId: task.id,
      parentTaskCode: task.code
    }
  }
})
```

### 2. Block Parent Task

```javascript
// Note: "blocked" may not be a standard transition in all workflows
// Check task.nextTransitions for available options
// If no blocked transition exists, just add a comment explaining the block

zerobias_execute("platform.Task.addComment", {
  id: task.id,
  newTaskComment: {
    commentMarkdown: `**Status: Blocked**

Missing dependency: ${depType} '${depName}'
Subtask created: ${subtask.code}

Will resume when dependency is completed.`
  }
})
```

### 3. Process Dependencies (in order)

Crosswalks may require multiple dependencies. Process in chain order:

```
1. /create-vendor {vendor-task-id}     (if vendor missing)
2. /create-suite {suite-task-id}       (if suite missing)
3. /create-framework {framework-task-id} (if framework missing)
4. Resume: /create-crosswalk {this-task-id}
```

### 4. Unblock Parent

```javascript
// Get parent task to find available transitions
const parentTask = zerobias_execute("platform.Task.get", { id: parentTaskId })
const startTransition = parentTask.nextTransitions.find(t => t.status === "in_progress")

zerobias_execute("platform.Task.update", {
  id: parentTaskId,
  updateTask: { transitionId: startTransition.id }
})
```

---

## Linking Tasks

Link crosswalk task to related tasks (framework tasks, parent tasks):

```javascript
const relatesToLinkType = "b8bd95d0-b33c-11f0-8af3-dfaccf31600e"

// Link to source framework task
zerobias_execute("platform.Resource.linkResources", {
  fromResource: crosswalkTaskId,
  toResource: sourceFrameworkTaskId,
  linkType: relatesToLinkType
})

// Link to target framework task
zerobias_execute("platform.Resource.linkResources", {
  fromResource: crosswalkTaskId,
  toResource: targetFrameworkTaskId,
  linkType: relatesToLinkType
})
```

**Note:** Use `toResource` (not `toResourceId`), and `linkType` must be a UUID.

---

## Task Custom Fields Reference

| Field | Required For | Description |
|-------|--------------|-------------|
| `artifactType` | `todo` transition | Type: `crosswalk` |
| `repoUrl` | `in_progress` transition | `https://github.com/zerobias-org/crosswalk` |
| `branchName` | `in_progress` transition | Git branch name |
| `fixVersion` | `released` transition | Version being released |
| `vendor` | (recommended) | Source vendor code |
| `suite` | (recommended) | Source suite code |
| `version` | (recommended) | Crosswalk version identifier |
| `parentTaskId` | (for subtasks) | Parent task UUID |
| `parentTaskCode` | (for subtasks) | Parent task code |

---

## Workflow Transitions Reference

| Transition | Target Status | ID |
|------------|---------------|-----|
| Start | in_progress | `7f140bbe-4c10-54ac-922c-460c66392fad` |
| Peer Review | awaiting_approval | `f017a447-0994-594d-9417-39cbc9a4de88` |
| Accept | released | `1d2e9381-f609-5e26-8bc6-7bbb65a9048d` |
| Reject | in_progress | `dda277e6-12d4-581b-922c-4e80d58d9083` |
| Cancel | cancelled | `711aa97f-f0bf-5c56-936f-f5e54d9de1f3` |

**Note:** Always get actual IDs from `task.nextTransitions`.

---

## Error Handling

### Missing Required Fields

If `task.customFields.branchName` or `task.customFields.repoUrl` not set:
1. Check if task status allows setting them
2. Generate appropriate values
3. Update task with values before proceeding

### Validation Fails

1. Read validation errors
2. Fix issues (common: invalid status, missing UUIDs, bad package naming)
3. Re-validate
4. If persistent, add comment explaining blocker

### Framework Dependencies Not Found

1. Check both `@zerobias-org` and `@auditlogic` registries
2. Use `npm view @zerobias-org/framework-{name}` and `npm view @auditlogic/framework-{name}`
3. If framework exists on `@auditlogic`, use that scope and update `.npmrc`
4. If framework doesn't exist anywhere, create subtask to build it first

### Repository Not Found

1. Check repoUrl mapping to local path
2. If not found, inform user to clone
3. Do not proceed without repo

---

## Dependency Chain

```
vendor → suite → framework/standard/benchmark → crosswalk
```

- **Crosswalks REQUIRE frameworks** - BOTH source and target must exist
- **Frameworks REQUIRE suites AND vendors** - full chain must be complete
- Crosswalks are at the END of the chain - they have the most dependencies

---

## References

- **Meta-repo CLAUDE.md:** `../../CLAUDE.md`
- **ContentArtifacts.md:** `../../ContentArtifacts.md`
- **Crosswalk CLAUDE.md:** `CLAUDE.md` (in repo root)
- **Templates:** `templates/`
- **Creation script:** `scripts/createNewCrosswalk.sh`
- **Validation script:** `scripts/validate.ts`
