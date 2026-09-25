"""Tests for model_provider fallback logic. No live network calls —
mocks Bedrock/Agent so tests run offline and fast.
Run: uv run pytest workshop/test_model_provider.py -v
"""

from unittest.mock import MagicMock, patch

import model_provider


def test_ollama_success_returns_ollama_model():
    with patch("strands.Agent") as mock_agent_cls, patch(
        "strands.models.ollama.OllamaModel"
    ) as mock_ollama_cls:
        mock_ollama_cls.return_value = MagicMock(name="ollama_instance")
        mock_agent_cls.return_value = MagicMock(return_value="pong")

        model = model_provider.get_model()

        mock_ollama_cls.assert_called_once_with(
            host=model_provider.OLLAMA_HOST,
            model_id=model_provider.OLLAMA_MODEL_ID,
            additional_args={"think": False},
        )
        assert model is mock_ollama_cls.return_value


def test_ollama_failure_falls_back_to_bedrock():
    with patch("strands.Agent") as mock_agent_cls, patch(
        "strands.models.ollama.OllamaModel"
    ), patch("strands.models.BedrockModel") as mock_bedrock_cls:
        mock_agent_cls.side_effect = Exception("blocked")
        mock_bedrock_cls.return_value = MagicMock(name="bedrock_instance")

        model = model_provider.get_model()

        mock_bedrock_cls.assert_called_once_with(
            model_id=model_provider.BEDROCK_MODEL_ID,
            region_name=model_provider.BEDROCK_REGION,
        )
        assert model is mock_bedrock_cls.return_value


def test_config_constants_are_sane():
    assert model_provider.BEDROCK_MODEL_ID
    assert model_provider.BEDROCK_REGION == "ap-south-1"
    assert model_provider.OLLAMA_HOST.startswith("http://")
    assert model_provider.OLLAMA_MODEL_ID
