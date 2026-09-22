"""Weather Forecaster example — agent autonomously chains NWS API calls.
Ollama primary, Bedrock fallback. Run: uv run 1-weather_forecaster.py
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

# from strands_tools import http_request
from model_provider import get_model
from strands import Agent
from strands.vended_tools import http_request, web_fetch

model = get_model()

WEATHER_SYSTEM_PROMPT = """You are a weather assistant with HTTP capabilities. You can:
1. Make HTTP requests to the National Weather Service API
2. Process and display weather forecast data
3. Provide weather information for locations in the United States

When retrieving weather information:
1. First get grid info via https://api.weather.gov/points/{latitude},{longitude}
2. Then use the returned forecast URL to get the actual forecast

Format weather data in a human-readable way, highlight temperature, precipitation,
and alerts, handle errors gracefully, and explain conditions clearly."""

weather_agent = Agent(
    model=model,
    agent_id="weather_agent",
    system_prompt=WEATHER_SYSTEM_PROMPT,
    tools=[http_request, web_fetch]
)


if __name__ == "__main__":
    weather_agent("What's the weather like in Seattle? (lat 47.6062, lon -122.3321)")
