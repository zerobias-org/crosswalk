# Changelog

All notable changes to this project will be documented in this file.

## [0.0.1] - 2026-02-05

### Added
- Initial crosswalk mapping between AIUC-1 v1 and OWASP LLM Top 10 v2025
- 34 control mappings showing how AIUC-1 controls mitigate LLM vulnerabilities
- Vulnerability coverage:
  - LLM01 (Prompt Injection) → B001, B002, B006
  - LLM02 (Insecure Output Handling) → B003, B004, B007
  - LLM03 (Training Data Poisoning) → A001, A002, A003
  - LLM04 (Model DoS) → D001, D002, D003
  - LLM05 (Supply Chain) → B005, B008, E013
  - LLM06 (Sensitive Info Disclosure) → A004, A005, A006, A007
  - LLM07 (Insecure Plugin) → B004, B008, B009
  - LLM08 (Excessive Agency) → C001, C002, E001, E003
  - LLM09 (Overreliance) → C003, D004, E002, E011
  - LLM10 (Model Theft) → A007, B001, B002, B009
