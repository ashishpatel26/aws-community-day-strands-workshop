# Bedrock Model Pricing Comparison (ap-south-1)

## ✅ Final choice

| Role | Model ID | $/1M in | $/1M out |
|---|---|---|---|
| Text/chat | `global.anthropic.claude-haiku-4-5-20251001-v1:0` | not public, check console | — |
| Multimodal | `qwen.qwen3-vl-235b-a22b` | $0.53 | $2.66 |
| Embeddings | `amazon.titan-embed-image-v1` | check console | — |

Pulled via `aws bedrock list-foundation-models` + AWS public pricing page
(aws.amazon.com/bedrock/pricing). Prices per 1M tokens, US East on-demand
unless noted. Verify current numbers in console before workshop — pricing
shifts.

**Status: all invoke calls currently blocked with `ValidationException:
Operation not allowed`** — Model access not yet granted in console. Fix:
Bedrock console → Model access → Modify model access → select models →
submit. Needed before ANY of these work (chat, Knowledge Bases, AgentCore).

---

## Text-only chat models, cheapest first

| Model | Input $/1M | Output $/1M | Inference type |
|---|---|---|---|
| Ministral 3B | $0.10 | $0.10 | ON_DEMAND |
| gpt-oss-20b | $0.0721 | $0.3090 | ON_DEMAND |
| Ministral 8B | $0.15 | $0.15 | ON_DEMAND |
| Palmyra Vision 7B | $0.15 | $0.60 | — (also multimodal, see below) |
| Qwen3 Next 80B A3B | $0.15 | $1.20 | ON_DEMAND |
| gpt-oss-120b | $0.1545 | $0.6180 | ON_DEMAND |
| DeepSeek v3.2 | $0.62 | $1.85 | ON_DEMAND |
| Claude Haiku 4.5 | not public (check console) | not public | INFERENCE_PROFILE |
| Claude 3.5 Sonnet | $6.00 | $30.00 | INFERENCE_PROFILE |

## Multimodal (image input) models, cheapest first

| Model | Input $/1M | Output $/1M | Inference type |
|---|---|---|---|
| **Palmyra Vision 7B** (Writer) | $0.15 | $0.60 | — cheapest true vision-chat |
| **Qwen3 VL 235B A22B** (`qwen.qwen3-vl-235b-a22b`) | $0.53 | $2.66 | ON_DEMAND — recommended pick |
| Claude 3 Haiku (`anthropic.claude-3-haiku-20240307-v1:0`) | not scraped | not scraped | ON_DEMAND — older, simpler than 4.5's profile requirement |
| Claude Haiku 4.5 | not public | not public | INFERENCE_PROFILE — needs `global.anthropic.claude-haiku-4-5-...` ARN |
| Amazon Nova Lite | not scraped | not scraped | INFERENCE_PROFILE |

**Recommended for `1-multimodal_optional.py`**: `qwen.qwen3-vl-235b-a22b` —
cheapest confirmed price, `ON_DEMAND` (no inference-profile ARN lookup
needed, simpler to wire up).

## Image generation (separate from vision-understanding)

| Model | Price |
|---|---|
| Stable Image (various, Remove BG / Erase / Inpaint / etc.) | $0.07-0.08 per generation |

`1-multimodal_optional.py`'s artist agent needs one of these; critic agent
needs a vision-understanding model from the table above.

## Embedding models (needed for Knowledge Bases)

| Model | Inference type |
|---|---|
| `amazon.titan-embed-image-v1` | ON_DEMAND |
| `amazon.titan-embed-image-v1:0` | PROVISIONED |
| `cohere.embed-v4:0` | INFERENCE_PROFILE |

Grant access to at least one of these in console alongside chat models, or
Knowledge Bases setup will hit the same "Operation not allowed" wall.

---

## How this list was built (repeatable)

```powershell
# full model list with inference type + modalities
aws bedrock list-foundation-models --region ap-south-1 --output json > models.json

# filter to multimodal (image input) only
uv run python -c "
import json
data = json.load(open('models.json'))
for m in data['modelSummaries']:
    if 'IMAGE' in m.get('inputModalities', []):
        print(m['modelId'], '|', m['providerName'], '|', m.get('inferenceTypesSupported'))
"
```

Pricing itself isn't in the CLI — cross-reference model IDs against
**console → Model catalog → click model → Pricing tab**, or the public page
aws.amazon.com/bedrock/pricing (Anthropic-specific model pricing, e.g.
Haiku 4.5, is often missing from the public page — check console directly).
