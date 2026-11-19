Markdown
# PULSO — Plataforma de Seguimiento Físico y Rendimiento Deportivo

Pulso es una aplicación web orientada al seguimiento físico y la evolución de jugadores de fútbol, centralizando mediciones, pruebas físicas, reportes por rol y análisis asistido por Inteligencia Artificial con criterios de privacidad y seudonimización.

## Características principales

- **Acceso previo obligatorio (Autenticación)**: El panel de registro y consulta permanece bloqueado hasta que el usuario inicie sesión o cree una cuenta.
- **Paneles diferenciados por rol**:
  - **Entrenador (Cuerpo técnico)**: Resumen del plantel, consulta y filtro de jugadores, historial de mediciones, semáforo de fatiga e informes con análisis IA.
  - **Jugador**: Registro diario de carga física y consulta de evolución/historial.
  - **Administrador**: Alta de jugadores, consulta de nómina y supervisión general del estado del sistema.
- **Registro y consulta de métricas**: Frecuencia cardíaca (BPM), nivel de fatiga/RPE (1–10) y velocidad máxima (km/h), además de pruebas físicas y anotaciones.
- **Servicio de IA con seudonimización**: Clasificación por reglas (`normal`, `alerta`, `riesgo`) y generación de resumen orientativo mediante Groq usando alias seudonimizados (`ATLETA_...`) para proteger la identidad del jugador.
- **Secciones informativas**: Listado vertical de funciones, preguntas frecuentes (FAQ) y canales de contacto/redes.

## Estructura del proyecto

```text
pulso-app/
├── backend/
│   ├── app.py
│   ├── ai_service.py
│   ├── .env
│   └── ...
├── frontend/
│   ├── index.html
│   ├── css/
│   │   └── style.css
│   └── js/
│       ├── models.js
│       ├── controllers.js
│       └── app.js
└── README.md
Configuración y ejecución local
1. Backend (FastAPI + Uvicorn)
Ubícate en la carpeta backend/ e instala las dependencias necesarias en tu entorno virtual.

Crea o revisa el archivo backend/.env con tus variables de entorno (incluyendo GROQ_API_KEY y GROQ_MODEL, por ejemplo openai/gpt-oss-20b).

Inicia el servidor:

Bash
uvicorn app:app --reload
El servicio quedará disponible en http://127.0.0.1:8000 (documentación interactiva en http://127.0.0.1:8000/docs).

2. Frontend
Abre frontend/index.html mediante un servidor local (como Live Server en VS Code) o en el navegador apuntando a la carpeta del frontend.

Inicia sesión o registra una cuenta para desbloquear el panel según el rol seleccionado.
