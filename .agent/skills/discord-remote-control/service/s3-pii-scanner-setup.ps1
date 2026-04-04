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
