"""Multimodal example — artist agent generates images, critic agent evaluates.
Chat/text agent: Bedrock primary, Ollama fallback. NOTE: qwen2.5:7b (the
Ollama fallback) is text-only, no vision, and generate_image needs an
image-gen backend Ollama doesn't provide either. This only fully works when
Bedrock is reachable (model access granted) — see MODEL_PRICING.md in this
folder for the recommended vision model (qwen.qwen3-vl-235b-a22b) to swap in
for the critic agent once Bedrock vision support is wired up.
Run: uv run 1-multimodal_optional.py
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from model_provider import get_model
from strands import Agent
from strands_tools import generate_image, image_reader

text_model = get_model()
# vision_model = BedrockModel(model_id="qwen.qwen3-vl-235b-a22b", region_name="ap-south-1")

artist = Agent(
    model=text_model,
    tools=[generate_image],
    system_prompt=(
        "You will be instructed to generate a number of images of a given subject. "
        "Vary the prompt for each generated image to create a variety of options. "
        "Your final output must contain ONLY a comma-separated list of the "
        "filesystem paths of generated images."
    ),
)

critic = Agent(
    model=text_model,  # swap to vision_model once available locally
    tools=[image_reader],
    system_prompt=(
        "You will be provided with a list of filesystem paths, each containing an "
        "image. Describe each image, and then choose which one is best. "
        "Your final line of output must be: FINAL DECISION: <path to final decision image>"
    ),
)


if __name__ == "__main__":
    result = artist("Generate 3 images of a dog")
    print(critic(str(result)))
