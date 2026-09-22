# AWS CLI v2 Installation, Configuration, and Setup Guide (Windows)

This guide walks you step-by-step through installing the AWS CLI v2 on Windows, resolving common PATH issues, generating IAM credentials, configuring the CLI for **Amazon Bedrock / AgentCore** (`ap-south-1`), handling credential rotation, and verifying account connectivity.

---

## Table of Contents
1. [Important Security Notice (Key Rotation)](#1-important-security-notice-key-rotation)
2. [Step 1: Install AWS CLI v2 on Windows](#step-1-install-aws-cli-v2-on-windows)
3. [Step 2: Fix CommandNotFoundException (PATH Configuration)](#step-2-fix-commandnotfoundexception-path-configuration)
4. [Step 3: Generate AWS IAM Credentials](#step-3-generate-aws-iam-credentials)
5. [Step 4: Run `aws configure`](#step-4-run-aws-configure)
6. [Step 5: Verify Connection & Bedrock Access](#step-5-verify-connection--bedrock-access)
7. [Appendix: Environment Variables & File Locations](#appendix-environment-variables--file-locations)

---

## 1. Important Security Notice (Key Rotation)

If an Access Key ID or Secret Access Key has ever been exposed or pasted into a public chat/repository, **deactivate and delete it immediately**.

### How to Rotate Keys in IAM:
1. Sign in to the [AWS Management Console](https://console.aws.amazon.com/iam/).
2. Navigate to **IAM** > **Users** > Select your username.
3. Click the **Security credentials** tab.
4. Locate the exposed key in the **Access keys** list:
   - Click **Actions** > **Deactivate**.
   - Click **Actions** > **Delete**.
5. Click **Create access key** to generate a new pair.
6. Re-run `aws configure` locally with the newly generated keys.

---

## Step 1: Install AWS CLI v2 on Windows

### Method A: MSI Installer (GUI)
1. Download the official installer: [AWSCLIV2.msi](https://awscli.amazonaws.com/AWSCLIV2.msi).
2. Double-click `AWSCLIV2.msi` to run the setup wizard.
3. Accept the license agreement and complete the installation.

### Method B: PowerShell Direct Command
Open PowerShell as Administrator and run:

```powershell
msiexec.exe /i https://awscli.amazonaws.com/AWSCLIV2.msi /qn
```

---

## Step 2: Fix CommandNotFoundException (PATH Configuration)

If running `aws --version` produces the error:
> `aws : The term 'aws' is not recognized as the name of a cmdlet...`

Follow these verification and repair steps:

### 1. Restart PowerShell
Existing terminal instances do not inherit updated `PATH` variables. Completely close PowerShell / Windows Terminal and launch a new session.

### 2. Verify Installation Path
Check if the binary was written to the default folder:

```powershell
Test-Path "C:\Program Files\Amazon\AWSCLIV2\aws.exe"
```
* If it returns `True`, the file is installed.
* If it returns `False`, check `C:\Program Files (x86)\Amazon\AWSCLIV2\aws.exe`.

### 3. Add to User PATH
Add the directory to your persistent user environment variables and update the current session:

```powershell
# Update User PATH permanently
[Environment]::SetEnvironmentVariable(
    "Path",
    [Environment]::GetEnvironmentVariable("Path", "User") + ";C:\Program Files\Amazon\AWSCLIV2",
    "User"
)

# Update current session PATH immediately
$env:Path += ";C:\Program Files\Amazon\AWSCLIV2"
```

### 4. Confirm Successful Detection
```powershell
aws --version
```
Expected output:
```text
aws-cli/2.x.x Python/3.x.x Windows/10 ...
```

---

## Step 3: Generate AWS IAM Credentials

To grant CLI access without using root credentials:

1. Open the [AWS Management Console](https://console.aws.amazon.com/).
2. In the search box, search for and open **IAM**.
3. In the left sidebar, click **Users**.
4. Select your user (or create a user and attach the necessary policies, e.g., `AmazonBedrockFullAccess` or `AdministratorAccess`).
5. Click the **Security credentials** tab.
6. Scroll down to **Access keys** and click **Create access key**.
7. Choose **Command Line Interface (CLI)** as the use case.
8. Check the confirmation box acknowledging recommendations and click **Next**.
9. Click **Create access key**.
10. Copy both:
    - **Access Key ID** (starts with `AKIA...`)
    - **Secret Access Key** (longer secret string)
    *(Optionally click **Download .csv file**).*

---

## Step 4: Run `aws configure`

Open PowerShell and execute:

```powershell
aws configure
```

Fill in the parameters interactively:

```text
AWS Access Key ID [None]: <YOUR_ACCESS_KEY_ID>
AWS Secret Access Key [None]: <YOUR_SECRET_ACCESS_KEY>
Default region name [None]: ap-south-1
Default output format [None]: json
```

### Region Rationale for Bedrock / AgentCore:
- **`ap-south-1` (Mumbai):** Recommended for lowest network latency and local data residency when building from or targeting South Asia. Bedrock AgentCore is supported here.
- **`us-east-1` (N. Virginia):** Recommended if you require access to newly previewed foundation models or specialized third-party agent features launched in US regions first.

---

## Step 5: Verify Connection & Bedrock Access

### 1. Check Caller Identity
Verify your CLI authenticates to AWS:

```powershell
aws sts get-caller-identity
```

Output should resemble:
```json
{
    "UserId": "AIDAXXXXXXXXXXXXXXXXX",
    "Account": "123456789012",
    "Arn": "arn:aws:iam::123456789012:user/your-username"
}
```

### 2. Verify Bedrock Access in `ap-south-1`
Test API reachability to Amazon Bedrock models in the Mumbai region:

```powershell
aws bedrock list-foundation-models --region ap-south-1 --output table --query "modelSummaries[*].[modelId,providerName]"
```

If successful, a table listing available models and their providers will be displayed.

---

## Appendix: Environment Variables & File Locations

### Windows Local Config Paths
The configuration created by `aws configure` is stored under your user profile:
- Credentials: `C:\Users\<YourUsername>\.aws\credentials`
- Region & Format Settings: `C:\Users\<YourUsername>\.aws\config`

### Session-Level Overrides (PowerShell)
You can temporarily override active settings inside a single PowerShell session:

```powershell
$env:AWS_ACCESS_KEY_ID="<KEY_ID>"
$env:AWS_SECRET_ACCESS_KEY="<SECRET_KEY>"
$env:AWS_DEFAULT_REGION="ap-south-1"
```