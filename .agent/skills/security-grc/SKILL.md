---
name: security-grc
description: "Enterprise security, governance, risk, and compliance with strategic leadership, architecture, and testing. USE WHEN developing security policies, conducting risk assessments, managing compliance frameworks, or building GRC programs."
triggers:
  - "security assessment"
  - "grc management"
  - "compliance"
  - "security architecture"
  - "risk management"
  - "security testing"
---

# Security GRC

## Purpose

Enterprise security, governance, risk, and compliance (GRC) combining strategic leadership, technical security architecture, and offensive security testing. Provides comprehensive frameworks for Zero Trust Architecture and multi-organization security.

**Agents:** chief-security-officer, security-architect, security-test-analyst

---

## Sub-Skills

### GRC Management (Governance, Risk, and Compliance)

**Core Domains:**

#### 1. Governance
- **Policy Management:** Security policy development, standards, control frameworks, version control
- **Program Structure:** Governance framework design, committees, decision-making, escalation
- **Documentation:** Administrative guides, security standards, procedures, compliance matrices

#### 2. Risk Management
- **Risk Assessment:** Asset identification, threat/vulnerability analysis, risk prioritization
- **Risk Frameworks:** NIST RMF, ISO 31000, FAIR, OCTAVE
- **Risk Monitoring:** KRIs, risk register, continuous assessment, executive reporting

#### 3. Compliance Management
- **Multi-Framework:** HIPAA, PCI DSS, DIACAP, RMF, IRS, CJIS, GDPR, ISO 27001
- **Compliance Activities:** Requirements mapping, control implementation, evidence collection, audits
- **Audit Coordination:** Internal/external audit management, finding remediation, CAP tracking

**Frameworks & Standards:**

| Framework | Primary Focus |
|---|---|
| **NIST CSF** | Identify, Protect, Detect, Respond, Recover |
| **NIST SP800-53** | Security and privacy controls |
| **NIST RMF** | Risk Management Framework |
| **CIS Controls v8** | 18 critical security controls |
| **ISO 27001** | Information Security Management System |
| **PCI DSS** | Payment card industry data security |
| **HIPAA/HITECH** | Healthcare data protection |

**Key Activities:**

1. **Policy Governance:** Identification, drafting, stakeholder review, publication, training
2. **Risk Assessment Cycle:** Asset inventory, threat analysis, vulnerability assessment, impact determination, risk treatment
3. **Compliance Lifecycle:** Requirements analysis, gap assessment, implementation, validation, reporting
4. **Audit Management:** Pre-audit prep, audit execution, remediation, post-audit lessons learned

**Tools:**
- GRC Platforms: ServiceNow GRC, RSA Archer, MetricStream, LogicGate, OneTrust
- Risk Tools: RiskLens, RiskWatch, Resolver
- Compliance Tools: Vanta, Drata, AuditBoard
- Assessment: Nessus, Qualys, OpenVAS, CIS-CAT

**Metrics:**
- Policy coverage percentage
- Compliance rate by framework
- Vulnerability remediation rate
- Control effectiveness scores
- Audit finding distribution

---

### DevSecOps (Development Security Operations)

**Integration Points:**
- Security in development lifecycle
- Secure coding practices
- Automated security testing
- Vulnerability scanning in CI/CD
- Security policy enforcement
- Incident response coordination

---

### Policy-as-Code

**Core Concept:** Define security ground truth declaratively — policies are code, auditable, version-controlled, and enforceable in CI/CD pipelines.

#### Technologies & Frameworks

| Tool | Purpose | Language |
|------|---------|----------|
| **OPA (Open Policy Agent)** | General-purpose policy engine | Rego |
| **Rego** | Declarative policy language for OPA | Rego |
| **Checkov** | Static analysis for IaC security (Terraform, CloudFormation, K8s, Dockerfiles) | Python/YAML |
| **Cursor Rules** | IDE-enforced coding standards and security patterns | YAML/JSON |
| **OpenSCAP** | SCAP-based compliance scanning and remediation (NIST, CIS, STIG profiles) | XCCDF/OVAL |
| **Greenbone (OpenVAS)** | Network vulnerability scanning, authenticated checks, SCAP integration | — |

#### Implementation Patterns

1. **Declarative Ground Truth**: Define what "compliant" looks like as code, not documentation
2. **Policy Evaluation Pipeline**: Code commit → OPA/Checkov gate → pass/fail → deploy/block
3. **Continuous Compliance**: Greenbone scheduled scans + OpenSCAP baseline enforcement
4. **Shift-Left Enforcement**: Cursor rules catch violations at write-time, Checkov at commit-time, OPA at deploy-time

#### Key Activities
- Write Rego policies for infrastructure guardrails (network segmentation, encryption requirements, access controls)
- Configure Checkov custom checks for organizational standards
- Deploy OpenSCAP profiles (CIS benchmarks, STIGs) across Linux/Windows fleets
- Integrate Greenbone vulnerability management into assessment workflows
- Define Cursor rules for secure coding patterns (no hardcoded secrets, required auth checks, input validation)

---

### MITRE ATT&CK Framework

**Purpose:** Map adversary tactics, techniques, and procedures (TTPs) to detection, prevention, and response capabilities.

#### Integration Points
- **Threat Modeling**: Map architecture threats to ATT&CK techniques
- **Detection Engineering**: Build detections aligned to ATT&CK technique IDs
- **Incident Response**: Classify incidents by ATT&CK tactic/technique
- **Gap Analysis**: Identify unmonitored techniques in current security stack
- **Red Team Planning**: Structure offensive tests around ATT&CK matrices

#### Matrices
- **Enterprise ATT&CK**: Windows, macOS, Linux, Cloud, Network, Containers
- **Mobile ATT&CK**: Android, iOS
- **ICS ATT&CK**: Industrial control systems

#### Key Tactics (Enterprise)
1. Reconnaissance (TA0043)
2. Resource Development (TA0042)
3. Initial Access (TA0001)
4. Execution (TA0002)
5. Persistence (TA0003)
6. Privilege Escalation (TA0004)
7. Defense Evasion (TA0005)
8. Credential Access (TA0006)
9. Discovery (TA0007)
10. Lateral Movement (TA0008)
11. Collection (TA0009)
12. Command & Control (TA0011)
13. Exfiltration (TA0010)
14. Impact (TA0040)

---

### Security Hardening & Defense Strategies

**Core Disciplines:**

#### Linux Security Hardening
- Kernel hardening (sysctl parameters, SELinux/AppArmor enforcement)
- Service minimization and attack surface reduction
- File system permissions, SUID/SGID audit
- SSH hardening, PAM configuration, sudo policies
- Audit framework (auditd) and log integrity
- CIS Benchmark and STIG compliance via OpenSCAP

#### Windows Security Hardening
- Group Policy hardening, LAPS deployment
- Windows Defender configuration, ASR rules
- PowerShell constrained language mode, script block logging
- Active Directory security (tiered admin model, protected users group)
- Event log forwarding and Sysmon deployment
- CIS Benchmark compliance and STIG enforcement

#### Network Security Fundamentals
- Network segmentation and micro-segmentation
- Firewall rule optimization and egress filtering
- IDS/IPS deployment and tuning
- DNS security (DNSSEC, DNS sinkholing, DNS monitoring)
- TLS/mTLS implementation and certificate management
- Network access control (802.1X, NAC)

#### Wireless Network Security
- WPA3 enterprise deployment
- Rogue AP detection and wireless IDS
- Certificate-based wireless authentication (EAP-TLS)
- Wireless network segmentation (guest, corporate, IoT)
- Wireless penetration testing methodologies

---

### Incident Response & Threat Containment

**IR Lifecycle (NIST SP 800-61):**
1. **Preparation**: IR plans, playbooks, communication templates, tool readiness
2. **Detection & Analysis**: Alert triage, IOC identification, severity classification
3. **Containment**: Network isolation, account disablement, endpoint quarantine
4. **Eradication**: Malware removal, vulnerability patching, credential rotation
5. **Recovery**: System restoration, monitoring enhancement, return to operations
6. **Lessons Learned**: Post-incident review, playbook updates, control improvements

**Threat Containment Strategies:**
- **Short-term**: Network isolation, DNS sinkhole, firewall blocks
- **Long-term**: Patch deployment, architecture changes, policy updates
- **Evidence Preservation**: Memory dumps, disk images, log collection before remediation

---

### Digital Forensics & Evidence Collection

**Forensic Disciplines:**
- **Disk Forensics**: Image acquisition (dd, FTK Imager), file system analysis, deleted file recovery, timeline generation
- **Memory Forensics**: Volatile data capture, process analysis, malware detection (Volatility framework)
- **Network Forensics**: Packet capture analysis, flow data, connection reconstruction
- **Log Forensics**: Log correlation, timeline reconstruction, anomaly detection

**Evidence Handling:**
- Chain of custody documentation
- Write-blocking for evidence acquisition
- Cryptographic hashing (SHA-256) for integrity verification
- Secure evidence storage and access controls

---

### Malware Analysis & IOC Extraction

**Analysis Approaches:**
- **Static Analysis**: File hashing, string extraction, PE/ELF header analysis, YARA rule matching
- **Dynamic Analysis**: Sandbox execution, API call monitoring, network behavior analysis
- **Reverse Engineering**: Disassembly (Ghidra, IDA), decompilation, control flow analysis

**Indicators of Compromise (IOC) Analysis:**
- **Network IOCs**: IP addresses, domains, URLs, JA3/JA3S hashes, User-Agent strings
- **Host IOCs**: File hashes (MD5/SHA-256), file paths, registry keys, mutex names, scheduled tasks
- **Behavioral IOCs**: Process trees, API call patterns, lateral movement indicators
- **IOC Sharing**: STIX/TAXII format, MISP integration, OpenIOC

**IOC Lifecycle:**
1. Collection from threat feeds, incident data, malware analysis
2. Validation and deduplication
3. Enrichment with context (ATT&CK mapping, threat actor attribution)
4. Distribution to detection systems (SIEM, EDR, firewall)
5. Expiration and review

---

## Workflow: Enterprise Security Assessment

Comprehensive organizational security posture evaluation (2-4 weeks for initial assessment).

### Assessment Phases

**Phase 1: Planning & Scoping (3-5 days)**
- Kick-off meeting, objective definition, scope, resource planning, documentation review
- **Deliverable:** Assessment Plan

**Phase 2: Information Gathering (5-10 days)**
- Document review (policies, architecture, diagrams)
- Stakeholder interviews (technical and business)
- System inventory (applications, infrastructure, critical assets)
- **Deliverable:** Information Gathering Report

**Phase 3: Technical Assessment (10-15 days)**
- Vulnerability Assessment (Nessus, OpenVAS, NMAP)
- Configuration Review (network, servers, databases, cloud)
- Access Control Review (user accounts, privileges, RBAC, MFA)
- Security Control Testing (technical and process)
- **Deliverable:** Technical Assessment Report

**Phase 4: Compliance Validation (5-7 days)**
- Control Mapping (map controls to framework)
- Evidence Collection (screenshots, configs, logs, policies)
- Gap Analysis (implementation status, effectiveness, compliance status)
- **Deliverable:** Compliance Gap Analysis Report

**Phase 5: Risk Assessment (3-5 days)**
- Threat Identification (external, internal, environmental)
- Vulnerability Analysis (technical, process, human factors)
- Impact Analysis (business impact, impact levels)
- Likelihood Assessment
- Risk Calculation (Risk = Impact × Likelihood)
- **Deliverable:** Risk Assessment Report

**Phase 6: Findings Analysis (5-7 days)**
- Consolidation and deduplication
- Root Cause Analysis
- Finding Prioritization (P1-P4)
- **Deliverable:** Prioritized Findings List

**Phase 7: Recommendations (3-5 days)**
- Remediation Recommendations (per finding)
- Strategic Recommendations
- Roadmap Development (short/medium/long-term)
- **Deliverable:** Remediation Roadmap

**Phase 8: Reporting (5-7 days)**
- Executive Summary
- Detailed Report (methodology, scope, findings, recommendations)
- Presentation Materials
- **Deliverable:** Final Assessment Report Package

**Phase 9: Out-Brief & Follow-up (2-3 days)**
- Executive Out-Brief
- Technical Out-Brief
- Follow-up Planning and Tracking
- **Deliverable:** Out-Brief Summary and Action Items

---

## Embedded Rules

### Zero Trust Architecture Principles

**Core Principle:** "Never trust, always verify"

#### Three Core Principles
1. **Verify Explicitly** — Authenticate/authorize on all data points
2. **Use Least Privilege Access** — JIT, JEA, risk-based, session-based
3. **Assume Breach** — Micro-segmentation, end-to-end encryption, monitoring

#### Implementation Architecture
- **Control Plane:** Policy Decision Point (PDP), Policy Enforcement Point (PEP), Policy Admin Point (PAP)
- **Data Plane:** Identity Provider (IdP), CDM, Industry Compliance, Threat Intelligence, SIEM

#### Zero Trust Maturity Levels
- **Level 0:** Traditional (perimeter-based)
- **Level 1:** Initial (MFA, basic inventory)
- **Level 2:** Developing (MFA all, device checks, app segmentation)
- **Level 3:** Advanced (risk-based auth, micro-segmentation, JIT)
- **Level 4:** Optimal (continuous auth, dynamic segmentation, AI/ML)

---

### Multi-Organization Isolation

**Rule:** Maintain complete isolation between organization contexts with no shared data storage.

**Implementation:**
- Separate repository per organization (`org-<uuid>/`)
- Explicit context switching (environment variable: `CURRENT_ORG_CONTEXT`)
- No automatic context inference
- Data sanitization for central outputs (UUID, no client names)
- Support 3+ concurrent contexts minimum

---

## Integration Points

### Input Requirements
- Business strategy and objectives
- Risk tolerance levels
- Budget constraints
- Regulatory requirements
- Asset inventories
- Threat intelligence
- System documentation

### Output Deliverables
- Security strategy roadmap
- Risk assessment and risk registers
- Compliance status reports
- Assessment reports and remediation roadmaps
- Policy and standards documentation
- Executive briefings and board presentations

### Collaboration
- **Internal:** CSO, CIO, CTO, CEO, CFO, Development teams, IT Ops, Legal, HR
- **External:** Regulatory bodies, Industry peers, Vendors, Auditors, Law enforcement

## Tools & Technologies

### Vulnerability & Assessment
- **Nessus** (vulnerability scanning)
- **Qualys** (cloud security)
- **Rapid7 Nexpose** (vulnerability management)
- **Greenbone/OpenVAS** (open-source vulnerability management — scanner, manager, GSA web interface)

### Endpoint & Network
- **CrowdStrike** (EDR/XDR)
- **Microsoft Defender** (endpoint security)
- **Palo Alto Networks** (next-gen firewall)
- **Suricata/Snort** (IDS/IPS)
- **Zeek** (network security monitoring)

### GRC & Compliance
- **ServiceNow GRC** (governance platform)
- **Vanta** (automated compliance)
- **Drata** (continuous compliance)

### Policy-as-Code & Compliance Automation
- **OPA/Rego** (policy engine and language)
- **Checkov** (IaC static analysis)
- **OpenSCAP** (SCAP compliance scanning)
- **Greenbone** (scheduled vulnerability assessments)

### Identity & Access
- **Azure AD/Okta** (identity management)
- **Privileged Identity Management (PIM)**
- **Just-in-Time (JIT) access solutions**

### Forensics & Malware Analysis
- **Volatility** (memory forensics)
- **Ghidra** (reverse engineering)
- **YARA** (malware pattern matching)
- **FTK Imager** (disk forensics)
- **Wireshark/tcpdump** (network forensics)
- **MISP** (threat intelligence sharing)

---

## Success Metrics

### Security Posture
- Reduction in security incidents
- MTTD and MTTR improvements
- Vulnerability remediation rates
- Compliance audit results

### Organizational Impact
- Team retention and development
- Budget efficiency
- Stakeholder satisfaction
- Zero Trust implementation progress
- DevSecOps maturity

### Compliance
- Compliance rate by framework
- Audit finding reduction
- Control effectiveness
- Regulatory audit success
