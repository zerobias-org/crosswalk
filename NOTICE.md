# Content Attribution Notices

The crosswalk packages in this repository reproduce mapping data whose source
material is owned by third parties and used under their published licenses.
This file records the attribution those licenses require. It travels with the
repository; the same notices apply to the npm packages published from it.

The `"license"` field in each package's `package.json` describes the packaging
and build scaffolding, not the mapped content. The content licenses below
govern the substantive mapping data.

---

## Secure Controls Framework (SCF)

**Applies to:** every package under `package/scf/scf/`.

These crosswalks reproduce control-mapping relations — focal-document element
ID ↔ SCF control ID pairs, the Set Theory Relationship Mapping (STRM)
relationship type, and the strength-of-relationship value — from the
**Secure Controls Framework (SCF)** published by the
Secure Controls Framework Council, LLC.

- **Source:** [Secure Controls Framework](https://securecontrolsframework.com/) —
  STRM mappings as distributed via the
  [official SCF spreadsheet](https://github.com/securecontrolsframework/securecontrolsframework)
  and the [published STRM documents](https://securecontrolsframework.com/set-theory-relationship-mapping-strm/)
- **Copyright:** © Secure Controls Framework Council, LLC
- **License:** [Creative Commons Attribution-NoDerivatives 4.0 International (CC BY-ND 4.0)](https://creativecommons.org/licenses/by-nd/4.0/)
- **Changes:** the mapping data has been converted from the officially
  distributed spreadsheet format into YAML for machine consumption. The
  mapping content itself — element pairs, relationship types, and strength
  values — is reproduced verbatim and unmodified. No mappings have been
  added, removed, edited, or re-scored.

SCF controls are used in this solution. This repository and the ZeroBias
platform are not endorsed by, affiliated with, or sponsored by the Secure
Controls Framework Council, LLC.

Per the CC BY-ND 4.0 license, this content may be redistributed verbatim with
this attribution, but modified or derivative versions of the SCF mapping data
may not be distributed. Do not edit the mapping content of these packages;
regenerate them from the officially published SCF sources instead.
