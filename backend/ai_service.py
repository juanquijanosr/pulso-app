import hashlib
import os
from typing import Any, Dict, List
import httpx
from dotenv import load_dotenv

load_dotenv()

GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions"
DEFAULT_GROQ_MODEL = os.getenv("GROQ_MODEL", "openai/gpt-oss-20b")


def seudonimizar_jugador(jugador_id: int, posicion: str | None) -> str:
    """Genera un alias no identificable (Habeas Data) sin exponer nombre real ni correo."""
    salt = os.getenv("PSEUDONYM_SALT", "pulso-arch-salt")
    digest = hashlib.sha256(f"{salt}:{jugador_id}".encode("utf-8")).hexdigest()[:8]
    pos_tag = (posicion or "PLANTEL").upper().replace(" ", "_")[:12]
    return f"ATLETA_{pos_tag}_{digest}"


def clasificar_estado_por_reglas(
    mediciones: List[Dict[str, Any]],
    pruebas: List[Dict[str, Any]],
) -> Dict[str, Any]:
    """Clasificación determinista (normal / alerta / riesgo) antes de llamar al LLM."""
    if not mediciones:
        return {
            "estado": "normal",
            "motivo_regla": "Sin mediciones recientes registradas; se mantiene estado base.",
            "promedio_fc": None,
            "promedio_fatiga": None,
            "velocidad_maxima_pico": None,
            "total_mediciones": 0,
            "total_pruebas": len(pruebas),
        }

    fcs = [float(m["frecuencia_cardiaca"]) for m in mediciones if m.get("frecuencia_cardiaca") is not None]
    fatigas = [float(m["fatiga_nivel"]) for m in mediciones if m.get("fatiga_nivel") is not None]
    vels = [float(m["velocidad_maxima"]) for m in mediciones if m.get("velocidad_maxima") is not None]

    prom_fc = round(sum(fcs) / len(fcs), 1) if fcs else 0.0
    prom_fatiga = round(sum(fatigas) / len(fatigas), 2) if fatigas else 0.0
    vel_max = round(max(vels), 1) if vels else 0.0

    # Escala compatible tanto con 1-5 como con RPE 1-10
    if prom_fatiga >= 7.5 or (prom_fatiga >= 4.2 and max(fatigas, default=0) >= 5) or prom_fc >= 185:
        estado = "riesgo"
        motivo = "Nivel elevado de fatiga percibida o frecuencia cardíaca alta sostenida."
    elif prom_fatiga >= 5.0 or (prom_fatiga >= 3.0 and prom_fc >= 168):
        estado = "alerta"
        motivo = "Carga o fatiga moderada-alta; conviene vigilar recuperación y dosificación."
    else:
        estado = "normal"
        motivo = "Indicadores dentro de rangos esperados para la carga registrada."

    return {
        "estado": estado,
        "motivo_regla": motivo,
        "promedio_fc": prom_fc,
        "promedio_fatiga": prom_fatiga,
        "velocidad_maxima_pico": vel_max,
        "total_mediciones": len(mediciones),
        "total_pruebas": len(pruebas),
    }


async def generar_resumen_con_groq(
    alias_atleta: str,
    metricas: Dict[str, Any],
    pruebas_resumen: List[Dict[str, Any]],
) -> Dict[str, Any]:
    """Solicita a Groq un resumen breve de apoyo al cuerpo técnico usando datos seudonimizados."""
    api_key = os.getenv("GROQ_API_KEY", "").strip()
    resumen_fallback = (
        f"[{alias_atleta}] Estado clasificado como '{metricas['estado'].upper()}': "
        f"FC promedio de {metricas['promedio_fc']} BPM, fatiga promedio de {metricas['promedio_fatiga']} "
        f"en {metricas['total_mediciones']} mediciones y {metricas['total_pruebas']} pruebas físicas. "
        f"{metricas['motivo_regla']} (Apoyo orientativo para el cuerpo técnico, no reemplaza criterio médico/físico)."
    )

    if not api_key:
        return {
            "resumen": resumen_fallback,
            "proveedor": "reglas-locales (GROQ_API_KEY no configurada)",
            "modelo": None,
            "usando_llm": False,
        }

    prompt_sistema = (
        "Eres un asistente analítico de preparación física en fútbol. "
        "Recibirás métricas agregadas y seudonimizadas de un jugador (nunca nombres reales). "
        "Redacta un resumen breve (máximo 4 oraciones) en español claro para el cuerpo técnico, "
        "explicando el estado asignado y sugiriendo una recomendación práctica de carga o recuperación. "
        "Aclara brevemente que es apoyo a la decisión y no diagnóstico médico."
    )
    prompt_usuario = (
        f"Alias: {alias_atleta}\n"
        f"Clasificación por reglas: {metricas['estado']}\n"
        f"Métricas agregadas: {metricas}\n"
        f"Pruebas físicas recientes: {pruebas_resumen[:5]}"
    )

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }
    payload = {
        "model": DEFAULT_GROQ_MODEL,
        "temperature": 0.3,
        "max_tokens": 220,
        "messages": [
            {"role": "system", "content": prompt_sistema},
            {"role": "user", "content": prompt_usuario},
        ],
    }

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(GROQ_API_URL, headers=headers, json=payload)
            resp.raise_for_status()
            data = resp.json()
            texto = (
                data.get("choices", [{}])[0]
                .get("message", {})
                .get("content", "")
                .strip()
            )
            if not texto:
                texto = resumen_fallback
            return {
                "resumen": texto,
                "proveedor": "Groq",
                "modelo": DEFAULT_GROQ_MODEL,
                "usando_llm": True,
            }
    except Exception as e:
        return {
            "resumen": f"{resumen_fallback} (Fallback por error en API Groq: {e})",
            "proveedor": "Groq (fallback reglas)",
            "modelo": DEFAULT_GROQ_MODEL,
            "usando_llm": False,
        }