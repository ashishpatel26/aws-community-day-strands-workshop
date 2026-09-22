# Bedrock Fallback Setup — Module 5

For students whose laptops can't run qwen2.5:7b locally (under 8GB RAM,
Ollama install issues, conference wifi too slow for the 4.7GB pull), Amazon
Bedrock is the fallback: same Strands `Agent` code, one line swapped.

## Final model choices

| Role | Model ID | Notes |
|---|---|---|
| Text/chat | `global.anthropic.claude-haiku-4-5-20251001-v1:0` | use the `global.` prefixed inference profile ID, not the bare model ID — Haiku 4.5 requires `INFERENCE_PROFILE`, bare ID fails |
| Multimodal | `qwen.qwen3-vl-235b-a22b` | `ON_DEMAND`, no profile ARN needed |
| Embeddings | `amazon.titan-embed-image-v1` | `ON_DEMAND` |

Full pricing comparison: `MODEL_PRICING.md` in this folder.

**Before any of these work**: Bedrock console → Model access → grant access
to all three (one-time, account+region wide). Every call currently fails
with `ValidationException: Operation not allowed` until this is done —
confirmed independent of IAM policy, model choice, or inference type.

This doc assumes AWS CLI v2 is already installed and configured — if not,
walk through `aws_cli_setup_configuration_guide.md` in the repo root first
(covers install, PATH fix, IAM key generation, `aws configure`).

---

## 1. Verify your setup is already working

You (the instructor) already have this confirmed:

```powershell
aws sts get-caller-identity
```
```
{
    "UserId": "...",
    "Account": "123456789012",
    "Arn": "arn:aws:iam::123456789012:user/your-username"
}
```

Region is `ap-south-1` (Mumbai) — confirmed via `aws configure get region`.

---

## 2. Confirm Bedrock model access

```powershell
aws bedrock list-foundation-models --region ap-south-1 --output table --query "modelSummaries[*].[modelId,providerName]"
```

Should return a table of available models. From your account, confirmed
available in `ap-south-1` includes:

| Model ID | Provider |
|---|---|
| `anthropic.claude-haiku-4-5-20251001-v1:0` | Anthropic |
| `anthropic.claude-sonnet-4-6` | Anthropic |
| `anthropic.claude-fable-5` | Anthropic |
| `openai.gpt-oss-120b-1:0` | OpenAI |
| `qwen.qwen3-235b-a22b-2507-v1:0` | Qwen |
| `deepseek.v3.2` | DeepSeek |

**For the workshop, use `anthropic.claude-haiku-4-5-20251001-v1:0`** —
cheapest/fastest Anthropic model, good enough for demo-scale agent calls,
keeps a 30-person room's Bedrock bill sane. Don't default the room to Sonnet.

---

## 3. Model catalog console (screenshot reference)

Bedrock console → **Build → Model catalog** (`Amazon Bedrock > Model catalog`)
shows all 254 available models, serverless vs marketplace, filterable by
provider/modality. This is where students can browse if they want to try a
different model than the one used in the demo.

**Known gotcha your screenshot surfaces**: the banner —
> "Anthropic requires first-time customers to submit use case details before
> invoking a model, once per account or once at the organization's
> management account."

If any student's AWS account has never called an Anthropic model on Bedrock
before, their **first** API call will fail until they click **Submit use
case details** in that banner and it's approved. This can take time — **have
students do this check the day before**, not live in the workshop.

To check if a student's account already cleared this: have them run the
`aws bedrock list-foundation-models` command above. If it lists Anthropic
models but their agent code still throws `AccessDeniedException` /
`ValidationException` on first call, this use-case-details step is the
likely cause — direct them to the console banner shown in the screenshot.

---

## 4. IAM permissions needed

Minimum IAM policy for a student to run Bedrock-backed agents (attach to
their IAM user, or use `AmazonBedrockFullAccess` for simplicity during a
workshop — tighten for production):

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "bedrock:InvokeModel",
                "bedrock:InvokeModelWithResponseStream",
                "bedrock:ListFoundationModels"
            ],
            "Resource": "*"
        }
    ]
}
```

---

## 5. Code change: Ollama → Bedrock

This is the entire swap. Everything else in a Strands `Agent` script stays
identical — tools, system prompts, multi-agent structure, all of it.

**Before (Ollama, local):**
```python
from strands.models.ollama import OllamaModel

model = OllamaModel(host="http://localhost:11434", model_id="qwen2.5:7b")
```

**After (Bedrock):**
```python
from strands.models import BedrockModel

model = BedrockModel(
    model_id="anthropic.claude-haiku-4-5-20251001-v1:0",
    region_name="ap-south-1",
)
```

No API key needed in code — `BedrockModel` picks up credentials from the AWS
CLI config (`~/.aws/credentials`) automatically, same as any boto3 client.

---

## 6. Live demo script

Use `01-fundamentals/2-weather_forecaster.py` for the live swap demo — it's
the simplest single-agent script, easiest to follow the diff live.

1. Show it running against Ollama (already works from Module 1).
2. Open the file, swap the two lines above.
3. Re-run: `uv run 2-weather_forecaster.py`
4. Same output, different backend — that's the whole point.

---

## 7. Cost awareness for the room

Bedrock is pay-per-token, unlike local Ollama (free after the model
download). For a 30-person room each running a few agent calls during a
20-minute module:

- Haiku 4.5 pricing is low (~$0.001-ish per typical demo call) — 30 students
  × a handful of calls each stays in low single-digit dollars total.
- **Don't let students loop agent calls unbounded** (e.g. a graph with no
  `max_node_executions`) against Bedrock during the demo — the loop-guard
  concept from Module 3 matters more here than it did against free local
  Ollama.
- Set a budget alert on the AWS account used for the workshop if opening
  Bedrock access broadly (e.g. shared workshop IAM user), so no surprise.

---

## Checklist before 26 Sep

- [ ] Confirm `aws sts get-caller-identity` works on the demo machine morning-of
- [ ] Re-run `aws bedrock list-foundation-models --region ap-south-1` morning-of
      — confirms account verification hasn't regressed (it has bitten us once
      already during dev, see Readme.md known issues)
- [ ] Confirm Anthropic "use case details" banner is cleared on demo account
- [ ] Decide: give students a shared read-only Bedrock demo credential, or
      have each set up their own IAM user beforehand (shared is faster for a
      4hr workshop, but means you own the whole room's cost + blast radius)
- [ ] Set a billing alert if opening broad Bedrock access
