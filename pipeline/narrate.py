PROMPT_TEMPLATE = (
    "Ein Machine-Learning-Modell schätzt das Risiko, dass eine "
    "Online-Bestellung eine schlechte Kundenbewertung (1-2 Sterne) bekommt, "
    "auf {risk_score:.0%}. Die wichtigsten Einflussfaktoren laut "
    "SHAP-Analyse:\n{drivers_text}\n\n"
    "Formuliere in 1-2 kurzen Sätzen auf Deutsch, verständlich für "
    "Nicht-Techniker, warum diese Bestellung dieses Risiko hat. Nenne "
    "konkrete Zahlen aus den Faktoren."
)


def format_drivers(top3: list[dict]) -> str:
    return "\n".join(
        f"- {d['feature']} = {d['feature_value']:.1f} (SHAP-Beitrag: {d['shap_value']:+.3f})"
        for d in top3
    )


def generate_explanation(top3: list[dict], risk_score: float, llm) -> str:
    prompt = PROMPT_TEMPLATE.format(risk_score=risk_score, drivers_text=format_drivers(top3))
    response = llm.invoke(prompt)
    return response.content.strip()
