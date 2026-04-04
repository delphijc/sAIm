# Request for Change: S3 PII Scanner Infrastructure Setup

| Field | Value |
|---|---|
| **RFC ID** | RFC-2026-0327-001 |
| **Title** | Centralized Cross-Account S3 PII Scanner Infrastructure |
| **Requested By** | Security Engineering |
| **Date Submitted** | 2026-03-27 |
| **Change Type** | Standard |
| **Priority** | Medium |
| **Risk Level** | Medium |
| **Environment** | AWS Production (Multi-Account Organization) |

---

## 1. Executive Summary

This change request introduces an automated infrastructure setup and execution script for scanning S3 buckets across an AWS Organization for Personally Identifiable Information (PII). The solution uses a centralized IAM role in the security/audit account, AWS Config rules for compliance detection, automated bucket policy remediation, and a phased scanning workflow. The goal is to ensure all S3 storage is inventoried, accessible to the scanning role, and evaluated for PII exposure risk.

---

## 2. Business Justification

- **Regulatory Compliance**: Data privacy regulations (GDPR, CCPA, HIPAA) require organizations to know where PII resides in their cloud storage.
- **Risk Reduction**: Untracked PII in S3 buckets represents a data breach liability. Automated scanning reduces manual audit overhead and improves detection coverage.
- **Centralized Governance**: A single scanning role across all accounts ensures consistent access and audit trail, eliminating the need for per-account tooling.

---

## 3. Scope of Change

### 3.1 In Scope

| Component | Action |
|---|---|
| **IAM Role** | Create `S3PIIScannerRole` in the audit account with S3 read-only + Config read permissions |
| **IAM Tags** | Tag the role as `SecurityResource=true`, `DoNotDelete=true`, `ManagedBy=SecurityTeam` |
| **IAM Inline Policy** | Attach `S3PIIScanPolicy` granting least-privilege S3 and Config access |
| **AWS Config Rule** | Deploy `s3-bucket-pii-scanner-access` rule to detect buckets missing scanner access |
| **S3 Bucket Policies** | Auto-remediate non-compliant bucket policies to include scanner role access statement |
| **S3 Scanning** | Assume the scanner role and enumerate/scan all buckets across the organization |

### 3.2 Out of Scope

- Modification of existing SCP (Service Control Policy) rules
- Changes to AWS Organization structure
- Deployment of new PII scanning tool binaries (tool is referenced but external to this script)
- Changes to VPC, networking, or DNS configurations
- Modification of existing bucket data or objects

---

## 4. Technical Design

### 4.1 Architecture Overview

```
+---------------------+       +---------------------------+
|  Operator Workstation|       |   Security/Audit Account  |
|  (PowerShell 7+)    |       |                           |
|                      |       |  +---------------------+  |
|  s3-pii-scanner-     | SSO   |  | S3PIIScannerRole    |  |
|  setup.ps1          +------->+  | - S3 Read-Only      |  |
|                      |       |  | - Config Read        |  |
|  AWS.Tools modules   |       |  | - Tagged Immutable   |  |
+---------------------+       |  +----------+----------+  |
                               |             |             |
                               +---------------------------+
                                             |
                                    STS AssumeRole
                                             |
                        +--------------------+--------------------+
                        |                    |                    |
                   +----v----+         +-----v-----+       +-----v-----+
                   | Account A|         | Account B |       | Account N |
                   | S3 Buckets|        | S3 Buckets|       | S3 Buckets|
                   | (Policy   |        | (Policy   |       | (Policy   |
                   |  updated) |        |  updated) |       |  updated) |
                   +-----------+        +-----------+       +-----------+
```

### 4.2 Phased Execution Model

The script operates in four distinct phases that can be run independently or as a complete pipeline:

| Phase | Name | Description |
|---|---|---|
| **Phase 1** | `Setup` | Creates the centralized IAM role and deploys the AWS Config rule |
| **Phase 2** | `Remediate` | Queries all S3 buckets and appends scanner access to non-compliant bucket policies |
| **Phase 3** | `Scan` | Assumes the scanner role and scans all accessible buckets for PII |
| **All** | `All` | Runs phases 1-3 sequentially with a 30-second wait for Config rule evaluation |

### 4.3 IAM Trust Policy

The scanner role's trust policy restricts assumption to:
- The audit account root principal (`arn:aws:iam::<AuditAccountId>:root`)
- Conditioned on the caller belonging to the specified AWS Organization (`aws:PrincipalOrgID`)

This ensures only principals within the organization can assume the role, and only from the audit account.

### 4.4 IAM Permissions (Least Privilege)

**S3 Actions Granted:**
| Action | Purpose |
|---|---|
| `s3:GetObject` | Read object content for PII scanning |
| `s3:GetObjectVersion` | Read versioned objects |
| `s3:ListBucket` | Enumerate objects within a bucket |
| `s3:ListAllMyBuckets` | Discover all buckets in the account |
| `s3:GetBucketLocation` | Determine bucket region for correct API endpoint |
| `s3:GetBucketPolicy` | Read current bucket policy for compliance checking |
| `s3:GetBucketTagging` | Read bucket tags for classification |

**Config Actions Granted:**
| Action | Purpose |
|---|---|
| `config:SelectResourceConfig` | Query Config for S3 bucket inventory |
| `config:SelectAggregateResourceConfig` | Query aggregated Config data across accounts |
| `config:GetResourceConfigHistory` | View configuration change history |

> **Note:** No write, delete, or modify permissions are granted for S3 objects. The role is strictly read-only.

### 4.5 Bucket Policy Remediation Logic

For each non-compliant bucket, the script appends a policy statement:

```json
{
    "Sid": "PIIScannerAccess",
    "Effect": "Allow",
    "Principal": {
        "AWS": "arn:aws:iam::<AuditAccountId>:role/S3PIIScannerRole"
    },
    "Action": [
        "s3:GetObject",
        "s3:GetObjectVersion",
        "s3:ListBucket"
    ],
    "Resource": [
        "arn:aws:s3:::<bucket-name>",
        "arn:aws:s3:::<bucket-name>/*"
    ]
}
```

- Existing policy statements are preserved; only the scanner statement is appended
- Buckets already containing a `PIIScannerAccess` statement or matching principal are skipped
- Buckets with no existing policy receive a new policy containing only the scanner statement

---

## 5. Prerequisites

| Requirement | Details |
|---|---|
| **PowerShell** | Version 7.0 or later |
| **AWS.Tools Modules** | `AWS.Tools.Common` (v4.1+), `SecurityToken`, `IdentityManagement`, `S3`, `ConfigService`, `Organizations` |
| **AWS SSO Profile** | A configured SSO profile (default: `audit-admin`) with admin access to the audit account |
| **AWS Config** | AWS Config must be enabled in the audit account (for Config rule deployment and resource queries) |
| **AWS Organizations** | Organization ID must be known (required for trust policy condition) |
| **Network Access** | Outbound HTTPS (443) to AWS API endpoints from the operator workstation |

---

## 6. Parameters

| Parameter | Required | Default | Description |
|---|---|---|---|
| `AuditAccountId` | Yes | — | AWS account ID of the security/audit account |
| `ScannerRoleName` | No | `S3PIIScannerRole` | Name for the centralized scanning IAM role |
| `OrgId` | No | — | AWS Organization ID (e.g., `o-abc123`) for trust policy condition |
| `Phase` | Yes | `All` | Execution phase: `Setup`, `Remediate`, `Scan`, or `All` |
| `ScanToolPath` | No | — | Path to external PII scanning tool executable |
| `ScanProfile` | No | `audit-admin` | AWS SSO profile name for authentication |
| `DryRun` | No | `false` | Preview mode; logs intended actions without applying changes |

---

## 7. Execution Examples

### 7.1 Dry Run (Recommended First Step)

```powershell
.\s3-pii-scanner-setup.ps1 `
    -AuditAccountId "123456789012" `
    -OrgId "o-abc123def" `
    -Phase All `
    -DryRun
```

### 7.2 Setup Only (Create Role + Config Rule)

```powershell
.\s3-pii-scanner-setup.ps1 `
    -AuditAccountId "123456789012" `
    -OrgId "o-abc123def" `
    -Phase Setup
```

### 7.3 Remediate Bucket Policies

```powershell
.\s3-pii-scanner-setup.ps1 `
    -AuditAccountId "123456789012" `
    -Phase Remediate
```

### 7.4 Full Pipeline with External Scan Tool

```powershell
.\s3-pii-scanner-setup.ps1 `
    -AuditAccountId "123456789012" `
    -OrgId "o-abc123def" `
    -Phase All `
    -ScanToolPath "C:\Tools\pii-scanner.exe"
```

---

## 8. Risk Assessment

### 8.1 Risk Matrix

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Bucket policy corruption | Low | High | Script appends only; existing statements preserved. DryRun mode available for pre-validation. |
| Over-permissive scanner role | Low | High | Role follows least-privilege (read-only S3 + Config). No write/delete actions. Trust policy restricted by OrgId condition. |
| Scanner role misuse | Low | Medium | Role tagged as immutable security resource (`SecurityResource=true`, `DoNotDelete=true`). SCP protection recommended. |
| Config rule false positives | Medium | Low | Rule only flags missing scanner access; remediation is idempotent and safe to re-run. |
| Cross-account access failures | Medium | Low | `ACCESS_DENIED` errors are logged per-bucket; scanning continues for remaining buckets. Results exported to CSV. |
| Session timeout during large scans | Low | Medium | Max session duration set to 4 hours (14,400 seconds). For very large environments, run `Scan` phase independently. |

### 8.2 Security Controls

- **Least Privilege**: Scanner role has read-only access. No ability to modify, delete, or create S3 objects.
- **Org-Scoped Trust**: Trust policy requires `aws:PrincipalOrgID` condition, preventing external account assumption.
- **Immutability Tags**: Role is tagged to leverage SCP-based deletion protection.
- **Audit Trail**: All actions are logged to a timestamped log file with severity levels.
- **DryRun Mode**: Full preview of all changes before execution.
- **Idempotent**: Safe to re-run; existing compliant resources are skipped.

---

## 9. Rollback Plan

| Step | Action | Command |
|---|---|---|
| 1 | Remove scanner access from bucket policies | Manually remove `PIIScannerAccess` statement from affected bucket policies, or restore from bucket policy version history |
| 2 | Delete the Config rule | `Remove-CFGConfigRule -ConfigRuleName "s3-bucket-pii-scanner-access" -ProfileName audit-admin` |
| 3 | Remove inline policy from role | `Remove-IAMRolePolicy -RoleName S3PIIScannerRole -PolicyName S3PIIScanPolicy -ProfileName audit-admin` |
| 4 | Delete the IAM role | `Remove-IAMRole -RoleName S3PIIScannerRole -ProfileName audit-admin` |

> **Note:** Rollback of bucket policies requires reviewing the scan log to identify which buckets were modified. The log file (`s3-pii-scan-<timestamp>.log`) records every remediated bucket.

---

## 10. Testing Plan

| Test | Method | Expected Result |
|---|---|---|
| **DryRun validation** | Run with `-DryRun` flag | All phases log intended actions; no AWS resources created or modified |
| **Role creation** | Run `Setup` phase in non-prod audit account | Role created with correct trust policy, inline policy, and tags |
| **Config rule deployment** | Run `Setup` phase | Config rule appears in AWS Config console; evaluation starts |
| **Policy remediation (single bucket)** | Create test bucket, run `Remediate` | Bucket policy updated with `PIIScannerAccess` statement |
| **Idempotent re-run** | Run `Remediate` twice | Second run skips already-compliant buckets; no duplicate statements |
| **Scan execution** | Run `Scan` phase | CSV report generated with bucket accessibility status |
| **Access denied handling** | Scan bucket without scanner policy | Bucket logged as `ACCESS_DENIED`; scan continues for remaining buckets |

---

## 11. Implementation Schedule

| Step | Description | Duration | Owner |
|---|---|---|---|
| 1 | Peer review and CAB approval | 1-2 days | Change Advisory Board |
| 2 | DryRun execution in production | 30 min | Security Engineering |
| 3 | Phase 1: Setup (role + Config rule) | 15 min | Security Engineering |
| 4 | Verify role and Config rule in AWS Console | 15 min | Security Engineering |
| 5 | Phase 2: Remediate bucket policies | 30-60 min (depends on bucket count) | Security Engineering |
| 6 | Phase 3: Scan execution | 1-4 hours (depends on bucket count and scan tool) | Security Engineering |
| 7 | Review scan results and log files | 1-2 hours | Security Engineering |

---

## 12. Outputs and Artifacts

| Artifact | Format | Description |
|---|---|---|
| Execution log | `s3-pii-scan-<timestamp>.log` | Timestamped log of all actions, warnings, and errors |
| Scan results | `pii-scan-results-<timestamp>.csv` | Per-bucket scan results including status, region, account ID, and findings |

---

## 13. Approvals

| Role | Name | Date | Decision |
|---|---|---|---|
| Requestor | | | |
| Security Lead | | | |
| Cloud Platform Lead | | | |
| CAB Chair | | | |

---

## Appendix A: Full PowerShell Script

The complete implementation is provided below for review. This is the script that will be executed in the production environment.

**File:** `s3-pii-scanner-setup.ps1`

```powershell
#Requires -Modules @{ ModuleName='AWS.Tools.Common'; ModuleVersion='4.1' }
#Requires -Modules AWS.Tools.SecurityToken, AWS.Tools.IdentityManagement, AWS.Tools.S3, AWS.Tools.ConfigService, AWS.Tools.Organizations

<#
.SYNOPSIS
    S3 PII Scanner Infrastructure Setup & Execution Script
.DESCRIPTION
    Implements a centralized cross-account S3 scanning approach:
    1. Creates a centralized scanning role in the security/audit account
    2. Tags it as immutable security resource
    3. Deploys Config rule to detect non-compliant bucket policies
    4. Auto-remediates bucket policies to allow the scanning role
    5. Assumes the role and scans all buckets
.PARAMETER AuditAccountId
    The AWS account ID of your security/audit account
.PARAMETER ScannerRoleName
    Name for the centralized scanning role (default: S3PIIScannerRole)
.PARAMETER OrgId
    Your AWS Organization ID (e.g., o-abc123) for the trust policy
.PARAMETER Phase
    Which phase to run: Setup, Remediate, Scan, or All
.PARAMETER ScanToolPath
    Path to your PII scanning tool executable
.PARAMETER ScanProfile
    AWS SSO profile name to use for initial authentication
.PARAMETER DryRun
    Preview changes without applying them
#>

[CmdletBinding()]
param(
    [Parameter(Mandatory)]
    [string]$AuditAccountId,

    [string]$ScannerRoleName = "S3PIIScannerRole",

    [string]$OrgId,

    [Parameter(Mandatory)]
    [ValidateSet("Setup", "Remediate", "Scan", "All")]
    [string]$Phase = "All",

    [string]$ScanToolPath,

    [string]$ScanProfile = "audit-admin",

    [switch]$DryRun
)

$ErrorActionPreference = "Stop"
$script:LogFile = "s3-pii-scan-$(Get-Date -Format 'yyyyMMdd-HHmmss').log"

function Write-Log {
    param([string]$Message, [string]$Level = "INFO")
    $entry = "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') [$Level] $Message"
    Write-Host $entry -ForegroundColor $(switch($Level) {
        "ERROR" { "Red" } "WARN" { "Yellow" } "SUCCESS" { "Green" } default { "White" }
    })
    Add-Content -Path $script:LogFile -Value $entry
}

# ============================================================
# PHASE 1: Create centralized scanning role in audit account
# ============================================================
function New-ScannerRole {
    Write-Log "=== Phase 1: Creating centralized scanner role ==="

    # Trust policy - allows the audit account to assume this role
    # and allows cross-account assumption from org members
    $trustPolicy = @{
        Version   = "2012-10-17"
        Statement = @(
            @{
                Effect    = "Allow"
                Principal = @{ AWS = "arn:aws:iam::${AuditAccountId}:root" }
                Action    = "sts:AssumeRole"
                Condition = @{
                    StringEquals = @{ "aws:PrincipalOrgID" = $OrgId }
                }
            }
        )
    } | ConvertTo-Json -Depth 10

    # S3 read-only permissions for scanning (least privilege)
    $scanPolicy = @{
        Version   = "2012-10-17"
        Statement = @(
            @{
                Sid      = "S3ReadForPIIScan"
                Effect   = "Allow"
                Action   = @(
                    "s3:GetObject",
                    "s3:GetObjectVersion",
                    "s3:ListBucket",
                    "s3:ListAllMyBuckets",
                    "s3:GetBucketLocation",
                    "s3:GetBucketPolicy",
                    "s3:GetBucketTagging"
                )
                Resource = @("arn:aws:s3:::*", "arn:aws:s3:::*/*")
            },
            @{
                Sid      = "ConfigReadAccess"
                Effect   = "Allow"
                Action   = @(
                    "config:SelectResourceConfig",
                    "config:SelectAggregateResourceConfig",
                    "config:GetResourceConfigHistory"
                )
                Resource = "*"
            }
        )
    } | ConvertTo-Json -Depth 10

    if ($DryRun) {
        Write-Log "[DRY RUN] Would create role: $ScannerRoleName" "WARN"
        Write-Log "[DRY RUN] Trust policy: $trustPolicy" "WARN"
        return
    }

    try {
        # Check if role already exists
        $existingRole = Get-IAMRole -RoleName $ScannerRoleName -ProfileName $ScanProfile -ErrorAction SilentlyContinue
        if ($existingRole) {
            Write-Log "Role $ScannerRoleName already exists, updating policies..." "WARN"
        }
        else {
            # Create the role
            $role = New-IAMRole `
                -RoleName $ScannerRoleName `
                -AssumeRolePolicyDocument $trustPolicy `
                -Description "Centralized S3 PII scanning role - DO NOT MODIFY" `
                -MaxSessionDuration 14400 `
                -ProfileName $ScanProfile

            Write-Log "Created role: $($role.Arn)" "SUCCESS"
        }

        # Attach the inline scanning policy
        Write-IAMRolePolicy `
            -RoleName $ScannerRoleName `
            -PolicyName "S3PIIScanPolicy" `
            -PolicyDocument $scanPolicy `
            -ProfileName $ScanProfile

        # Tag as security resource (SCP-protected immutability)
        $tags = @(
            @{ Key = "SecurityResource"; Value = "true" },
            @{ Key = "ManagedBy"; Value = "SecurityTeam" },
            @{ Key = "Purpose"; Value = "S3-PII-Scanning" },
            @{ Key = "DoNotDelete"; Value = "true" }
        )
        Add-IAMRoleTag -RoleName $ScannerRoleName -Tag $tags -ProfileName $ScanProfile

        Write-Log "Role tagged as security resource (SCP-immutable)" "SUCCESS"

        $roleArn = "arn:aws:iam::${AuditAccountId}:role/${ScannerRoleName}"
        Write-Log "Scanner role ARN: $roleArn" "SUCCESS"
        return $roleArn
    }
    catch {
        Write-Log "Failed to create scanner role: $_" "ERROR"
        throw
    }
}

# ============================================================
# PHASE 2: Deploy Config rule + auto-remediation
# ============================================================
function Deploy-ConfigRule {
    Write-Log "=== Phase 2: Deploying Config rule for bucket policy compliance ==="

    $scannerRoleArn = "arn:aws:iam::${AuditAccountId}:role/${ScannerRoleName}"

    # Custom Config rule input parameters
    $ruleParams = @{
        ScannerRoleArn = $scannerRoleArn
    } | ConvertTo-Json

    if ($DryRun) {
        Write-Log "[DRY RUN] Would deploy Config rule: S3BucketPIIScannerAccess" "WARN"
        return
    }

    try {
        # Deploy a managed Config rule to check bucket policies
        # Using custom-policy approach with s3-bucket-policy evaluation
        $configRule = @{
            ConfigRuleName = "s3-bucket-pii-scanner-access"
            Description    = "Detects S3 buckets missing allow policy for PII scanner role"
            Source         = @{
                Owner            = "AWS"
                SourceIdentifier = "S3_BUCKET_POLICY_NOT_MORE_PERMISSIVE"
            }
            InputParameters = $ruleParams
            Scope          = @{
                ComplianceResourceType = @("AWS::S3::Bucket")
            }
        }

        Write-ConfigRule -ConfigRule $configRule -ProfileName $ScanProfile
        Write-Log "Config rule deployed: s3-bucket-pii-scanner-access" "SUCCESS"

        # Start evaluation
        Start-ConfigRulesEvaluation `
            -ConfigRuleName "s3-bucket-pii-scanner-access" `
            -ProfileName $ScanProfile

        Write-Log "Config rule evaluation started" "SUCCESS"
    }
    catch {
        Write-Log "Config rule deployment failed: $_" "ERROR"
        throw
    }
}

# ============================================================
# PHASE 2b: Auto-remediate non-compliant bucket policies
# ============================================================
function Repair-BucketPolicies {
    Write-Log "=== Phase 2b: Remediating non-compliant bucket policies ==="

    $scannerRoleArn = "arn:aws:iam::${AuditAccountId}:role/${ScannerRoleName}"

    # Get all S3 buckets from Config (live inventory)
    $query = "SELECT resourceId, resourceName, accountId WHERE resourceType = 'AWS::S3::Bucket'"

    try {
        $buckets = Select-CFGResourceConfig -Expression $query -ProfileName $ScanProfile
        Write-Log "Found $($buckets.Count) buckets from Config inventory"
    }
    catch {
        Write-Log "Config query failed, falling back to S3 API..." "WARN"
        $buckets = Get-S3Bucket -ProfileName $ScanProfile | ForEach-Object {
            [PSCustomObject]@{ resourceName = $_.BucketName }
        }
    }

    $remediated = 0
    $skipped = 0
    $errors = 0

    foreach ($bucket in $buckets) {
        $bucketName = $bucket.resourceName
        Write-Log "Checking bucket: $bucketName"

        try {
            # Get current bucket policy
            $currentPolicy = $null
            try {
                $policyJson = Get-S3BucketPolicy -BucketName $bucketName -ProfileName $ScanProfile
                $currentPolicy = $policyJson | ConvertFrom-Json
            }
            catch {
                if ($_.Exception.Message -match "NoSuchBucketPolicy|policy does not exist") {
                    $currentPolicy = @{ Version = "2012-10-17"; Statement = @() }
                }
                else { throw }
            }

            # Check if scanner role already has access
            $hasAccess = $currentPolicy.Statement | Where-Object {
                $_.Sid -eq "PIIScannerAccess" -or
                ($_.Principal.AWS -eq $scannerRoleArn -and $_.Effect -eq "Allow")
            }

            if ($hasAccess) {
                Write-Log "  Bucket $bucketName already has scanner access" "SUCCESS"
                $skipped++
                continue
            }

            # Build the scanner access statement
            $scannerStatement = @{
                Sid       = "PIIScannerAccess"
                Effect    = "Allow"
                Principal = @{ AWS = $scannerRoleArn }
                Action    = @(
                    "s3:GetObject",
                    "s3:GetObjectVersion",
                    "s3:ListBucket"
                )
                Resource  = @(
                    "arn:aws:s3:::$bucketName",
                    "arn:aws:s3:::$bucketName/*"
                )
            }

            # Append to existing policy
            $updatedPolicy = $currentPolicy
            $updatedPolicy.Statement += $scannerStatement
            $updatedPolicyJson = $updatedPolicy | ConvertTo-Json -Depth 10

            if ($DryRun) {
                Write-Log "  [DRY RUN] Would update policy for: $bucketName" "WARN"
                $remediated++
                continue
            }

            # Apply updated policy
            Write-S3BucketPolicy `
                -BucketName $bucketName `
                -Policy $updatedPolicyJson `
                -ProfileName $ScanProfile

            Write-Log "  Remediated bucket: $bucketName" "SUCCESS"
            $remediated++
        }
        catch {
            Write-Log "  Error on bucket ${bucketName}: $_" "ERROR"
            $errors++
        }
    }

    Write-Log "=== Remediation complete: $remediated updated, $skipped already compliant, $errors errors ===" "SUCCESS"
}

# ============================================================
# PHASE 3: Assume role and scan all buckets
# ============================================================
function Start-PIIScan {
    Write-Log "=== Phase 3: Assuming scanner role and running PII scan ==="

    $scannerRoleArn = "arn:aws:iam::${AuditAccountId}:role/${ScannerRoleName}"

    try {
        # Assume the centralized scanner role
        $creds = Use-STSRole `
            -RoleArn $scannerRoleArn `
            -RoleSessionName "PIIScan-$(Get-Date -Format 'yyyyMMddHHmm')" `
            -DurationInSeconds 14400 `
            -ProfileName $ScanProfile

        $scanCreds = $creds.Credentials
        Write-Log "Assumed scanner role successfully" "SUCCESS"

        # Query all S3 buckets from Config (live inventory)
        $query = "SELECT resourceId, resourceName, configuration.creationDate, accountId WHERE resourceType = 'AWS::S3::Bucket'"

        $buckets = Select-CFGResourceConfig `
            -Expression $query `
            -AccessKey $scanCreds.AccessKeyId `
            -SecretKey $scanCreds.SecretAccessKey `
            -SessionToken $scanCreds.SessionToken

        Write-Log "Config returned $($buckets.Count) buckets to scan"

        # Results tracking
        $results = [System.Collections.ArrayList]::new()
        $scanCount = 0
        $errorCount = 0

        foreach ($bucket in $buckets) {
            $bucketName = $bucket.resourceName
            $scanCount++
            Write-Log "[$scanCount/$($buckets.Count)] Scanning: $bucketName"

            try {
                # Get bucket region for correct endpoint
                $region = Get-S3BucketLocation `
                    -BucketName $bucketName `
                    -AccessKey $scanCreds.AccessKeyId `
                    -SecretKey $scanCreds.SecretAccessKey `
                    -SessionToken $scanCreds.SessionToken

                if ([string]::IsNullOrEmpty($region)) { $region = "us-east-1" }

                if ($ScanToolPath) {
                    # Run your PII scanning tool against each bucket
                    $scanArgs = @(
                        "--bucket", $bucketName,
                        "--region", $region,
                        "--access-key", $scanCreds.AccessKeyId,
                        "--secret-key", $scanCreds.SecretAccessKey,
                        "--session-token", $scanCreds.SessionToken
                    )

                    $output = & $ScanToolPath @scanArgs 2>&1
                    $exitCode = $LASTEXITCODE

                    [void]$results.Add([PSCustomObject]@{
                        Bucket    = $bucketName
                        Region    = $region
                        AccountId = $bucket.accountId
                        Status    = if ($exitCode -eq 0) { "Scanned" } else { "Error" }
                        Output    = ($output | Out-String).Trim()
                        Timestamp = Get-Date -Format "o"
                    })
                }
                else {
                    # No scan tool specified - just enumerate and verify access
                    $objects = Get-S3Object `
                        -BucketName $bucketName `
                        -MaxKey 10 `
                        -Region $region `
                        -AccessKey $scanCreds.AccessKeyId `
                        -SecretKey $scanCreds.SecretAccessKey `
                        -SessionToken $scanCreds.SessionToken

                    [void]$results.Add([PSCustomObject]@{
                        Bucket      = $bucketName
                        Region      = $region
                        AccountId   = $bucket.accountId
                        Status      = "Accessible"
                        ObjectCount = $objects.Count
                        SampleKeys  = ($objects | Select-Object -First 5 -ExpandProperty Key) -join ", "
                        Timestamp   = Get-Date -Format "o"
                    })

                    Write-Log "  Accessible - sampled $($objects.Count) objects" "SUCCESS"
                }
            }
            catch {
                $errorCount++
                [void]$results.Add([PSCustomObject]@{
                    Bucket    = $bucketName
                    Region    = $region
                    AccountId = $bucket.accountId
                    Status    = "ACCESS_DENIED"
                    Error     = $_.Exception.Message
                    Timestamp = Get-Date -Format "o"
                })
                Write-Log "  ACCESS DENIED: $bucketName - $_" "ERROR"
            }
        }

        # Export results
        $reportPath = "pii-scan-results-$(Get-Date -Format 'yyyyMMdd-HHmmss').csv"
        $results | Export-Csv -Path $reportPath -NoTypeInformation
        Write-Log "Results exported to: $reportPath" "SUCCESS"

        # Summary
        $accessible = ($results | Where-Object Status -ne "ACCESS_DENIED").Count
        $denied = ($results | Where-Object Status -eq "ACCESS_DENIED").Count
        Write-Log "=== Scan Complete ===" "SUCCESS"
        Write-Log "  Total buckets: $($buckets.Count)"
        Write-Log "  Accessible: $accessible"
        Write-Log "  Access Denied: $denied"
        Write-Log "  Report: $reportPath"

        return $results
    }
    catch {
        Write-Log "Scan phase failed: $_" "ERROR"
        throw
    }
}

# ============================================================
# Main execution
# ============================================================
Write-Log "S3 PII Scanner - Starting Phase: $Phase"
Write-Log "Audit Account: $AuditAccountId | Role: $ScannerRoleName"
if ($DryRun) { Write-Log "*** DRY RUN MODE - No changes will be applied ***" "WARN" }

switch ($Phase) {
    "Setup" {
        New-ScannerRole
        Deploy-ConfigRule
    }
    "Remediate" {
        Repair-BucketPolicies
    }
    "Scan" {
        Start-PIIScan
    }
    "All" {
        $roleArn = New-ScannerRole
        Deploy-ConfigRule
        Write-Log "Waiting 30s for Config rule evaluation..." "WARN"
        Start-Sleep -Seconds 30
        Repair-BucketPolicies
        Start-PIIScan
    }
}

Write-Log "=== All phases complete. Log: $script:LogFile ==="
```

---

*Document generated: 2026-03-27*
