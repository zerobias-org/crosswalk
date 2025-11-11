# CLAUDE.md - Community Crosswalk Repository

This file provides guidance to Claude Code (claude.ai/code) when working with crosswalk content in this repository.

## Project Overview

This is the **ZeroBias Community Crosswalk Repository** containing open-source crosswalk mappings between different compliance frameworks. Crosswalks enable requirement-to-requirement mapping across standards, allowing organizations to demonstrate compliance with multiple frameworks simultaneously.

**Repository Role:** Community-contributed crosswalk mappings between compliance frameworks

This repository follows the same structure as `auditlogic/crosswalk` but contains community-contributed, open-source crosswalk mappings.

## Current Status

⚠️ **AI-Assisted Development Workflows Needed**

This CLAUDE.md is a placeholder. Comprehensive AI-assisted development workflows for creating and maintaining crosswalks are planned but not yet implemented.

**What's Needed:**
- Step-by-step workflows for creating new crosswalks
- Requirement alignment and mapping strategies
- Validation procedures for mapping accuracy
- Publishing and versioning guidelines
- Testing with framework updates
- Collaboration with standards organizations

## Repository Structure

```
crosswalk/
├── package/zerobias/          # Community crosswalk packages
│   └── <crosswalk-name>/      # Individual crosswalk mapping
│       ├── package.json       # NPM package configuration
│       ├── index.yml          # Crosswalk metadata
│       ├── mappings.yml       # Requirement-to-requirement mappings
│       ├── CHANGELOG.md       # Version history
│       └── npm-shrinkwrap.json
├── scripts/                   # Creation and validation scripts
├── lerna.json                 # Monorepo configuration
└── README.md
```

## File Format Reference

**Source of Truth:** `../../auditmation/platform/dataloader/src/processors/crosswalk/`

**Key Files:**
- `CrosswalkArtifactLoader.ts` - Main processor
- `CrosswalkFileHandler.ts` - File processing

**Expected Structure:**
- `index.yml` - Crosswalk metadata (name, description, source/target frameworks)
- `mappings.yml` - Requirement mappings
- `package.json` - Must include `auditmation.import-artifact: "crosswalk"`

## Crosswalk Concept

### What is a Crosswalk?

A crosswalk maps requirements between two compliance frameworks:

**Example: SOC 2 → ISO 27001**
```yaml
# mappings.yml
mappings:
  - source:
      framework: aicpa.soc2.2022
      requirement: CC6.1  # Logical and Physical Access Controls
    target:
      framework: iso.27001.2022
      requirement: A.9.1.1  # Access Control Policy
    relationship: equivalent
```

**Relationship Types:**
- `equivalent` - Requirements are essentially the same
- `subset` - Source is a subset of target
- `superset` - Source encompasses target
- `related` - Requirements are related but not equivalent
- `complementary` - Requirements work together

## Integration with Platform

### Dataloader Integration
**Handler Location:** `../../auditmation/platform/dataloader/src/processors/crosswalk/`
**Database Table:** `catalog.crosswalk`

### Usage in Platform
- **Audit Planning:** Show which SOC 2 controls also satisfy ISO 27001
- **Gap Analysis:** Identify requirements not covered by current controls
- **Multi-Framework Compliance:** Leverage existing controls across frameworks
- **Evidence Reuse:** Use same evidence for multiple framework requirements

## Related Documentation

- **[Root CLAUDE.md](../../CLAUDE.md)** - Meta-repo guidance
- **[ContentArtifacts.md](../../ContentArtifacts.md)** - Content catalog system
- **[auditlogic/crosswalk/CLAUDE.md](../../auditlogic/crosswalk/CLAUDE.md)** - Proprietary crosswalks (same pattern)
- **[auditmation/platform/dataloader/CLAUDE.md](../../auditmation/platform/dataloader/CLAUDE.md)** - Dataloader processor
- **[auditlogic/standard/CLAUDE.md](../../auditlogic/standard/CLAUDE.md)** - Framework definitions
- **[zerobias-org/framework/CLAUDE.md](../framework/CLAUDE.md)** - Community frameworks

## Important Notes

### Community vs Proprietary

**This Repository (zerobias-org/crosswalk):**
- Open-source, community-contributed crosswalks
- Public GitHub repository
- MIT/Apache license
- Community validation and updates

**Proprietary Repository (auditlogic/crosswalk):**
- Closed-source, professionally validated crosswalks
- Private GitHub repository
- Commercial license
- Expert review and certification

Both follow identical structure and use same dataloader processor.

### Mapping Accuracy

Crosswalk mappings should be:
- Validated by compliance experts
- Reviewed against official framework documentation
- Updated when frameworks change
- Tested with real-world use cases
- Peer-reviewed by community

## Future Development

Once AI-assisted development workflows are implemented, this CLAUDE.md will include:
- Creating new crosswalk from template
- Mapping requirements between frameworks
- Validation and testing procedures
- Publishing to NPM registry
- Updating mappings when frameworks change
- Collaboration workflows for community review

---

**Last Updated:** 2025-11-11
**Maintainers:** ZeroBias Community

