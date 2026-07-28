from pipeline.narrate import format_drivers, generate_explanation


class _FakeMessage:
    def __init__(self, content: str) -> None:
        self.content = content


class _FakeLLM:
    def __init__(self, response_text: str) -> None:
        self.response_text = response_text
        self.last_prompt: str | None = None

    def invoke(self, prompt: str) -> _FakeMessage:
        self.last_prompt = prompt
        return _FakeMessage(self.response_text)


def test_format_drivers_includes_feature_and_value():
    top3 = [{"feature": "delivery_delta_days", "shap_value": 0.3, "feature_value": 5.0}]
    text = format_drivers(top3)
    assert "delivery_delta_days" in text
    assert "5.0" in text


def test_generate_explanation_calls_llm_and_returns_stripped_content():
    llm = _FakeLLM("  Hohes Risiko wegen später Lieferung.  ")
    top3 = [{"feature": "delivery_delta_days", "shap_value": 0.3, "feature_value": 5.0}]

    result = generate_explanation(top3, risk_score=0.72, llm=llm)

    assert result == "Hohes Risiko wegen später Lieferung."
    assert "72%" in llm.last_prompt
    assert "delivery_delta_days" in llm.last_prompt
