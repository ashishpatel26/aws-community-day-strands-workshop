"""Shared model resolver: Ollama primary, Bedrock fallback.

Import get_model() instead of constructing OllamaModel/BedrockModel directly
in each example script.
"""

import logging

logger = logging.getLogger(__name__)

BEDROCK_MODEL_ID = "qwen.qwen3-235b-a22b-2507-v1:0"
BEDROCK_REGION = "ap-south-1"
OLLAMA_HOST = "http://localhost:11434"
OLLAMA_MODEL_ID = "qwen3.5:4b"


def get_model():
    """Return a working Strands model: Ollama if reachable, else Bedrock."""
    try:
        from strands import Agent
        from strands.models.ollama import OllamaModel

        model = OllamaModel(host=OLLAMA_HOST, model_id=OLLAMA_MODEL_ID)
        Agent(model=model, callback_handler=None)("ping")
        return model
    except Exception as e:
        logger.warning("Ollama unavailable (%s), falling back to Bedrock", e)
        from strands.models import BedrockModel

        return BedrockModel(model_id=BEDROCK_MODEL_ID, region_name=BEDROCK_REGION)


if __name__ == "__main__":
    m = get_model()
    print(f"Using: {type(m).__name__}")
