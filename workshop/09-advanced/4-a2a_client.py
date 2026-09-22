"""A2A example — client half. Discovers the agent's capabilities from its
published agent card, then sends it a message over HTTP.

Run 4-a2a_server.py first, in a separate terminal, then: uv run 4-a2a_client.py
"""

import asyncio

import httpx
from a2a.client import A2ACardResolver, ClientConfig, ClientFactory, create_text_message_object

AGENT_URL = "http://127.0.0.1:9000"


async def main() -> None:
    async with httpx.AsyncClient(timeout=60.0) as httpx_client:
        resolver = A2ACardResolver(httpx_client, AGENT_URL)
        card = await resolver.get_agent_card()
        print(f"Discovered agent: {card.name} — {card.description}")

        config = ClientConfig(httpx_client=httpx_client, streaming=False)
        client = ClientFactory(config).create(card)
        message = create_text_message_object(content="What is 125 plus 375?")

        async for event in client.send_message(message):
            task, _update = event if isinstance(event, tuple) else (event, None)
            if hasattr(task, "artifacts") and task.artifacts:
                text = task.artifacts[-1].parts[-1].root.text
                print(f"Agent answered: {text.strip()}")
            else:
                print(event)


if __name__ == "__main__":
    asyncio.run(main())
