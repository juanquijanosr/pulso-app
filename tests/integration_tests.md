# Informe de Pruebas y Validación — Sistema PULSO

## 1. Objetivo y alcance
Validar el funcionamiento integral de **PULSO** en su flujo de autenticación, diferenciación de vistas por rol (**Entrenador**, **Jugador** y **Administrador**), registro y consulta de datos físicos, y análisis asistido por Inteligencia Artificial con seudonimización y contingencia (*fallback*).

## 2. Entorno de pruebas
- **Backend:** FastAPI servido con `uvicorn app:app --reload` en `http://127.0.0.1:8000` (documentación en `/docs`).
- **Frontend:** Interfaz web (`frontend/index.html`, `models.js`, `controllers.js`, `app.js`) servida localmente (ej. Live Server en `http://127.0.0.1:5500`).
- **Servicio de IA:** `ai_service.py` con clasificación determinista por reglas (`normal`, `alerta`, `riesgo`), alias seudonimizado (`ATLETA_...`) y consulta a Groq (`openai/gpt-oss-20b` o modelo configurado en `.env`).

## 3. Casos de prueba ejecutados

| ID | Módulo / Escenario | Pasos de prueba | Resultado esperado | Estado |
| :--- | :--- | :--- | :--- | :--- |
| **CP-01** | **Bloqueo previo a sesión** | Abrir el frontend sin sesión iniciada y navegar a `#acceso-panel`. | El panel de operación permanece bloqueado hasta iniciar sesión o crear una cuenta. | Aprobado |
| **CP-02** | **Registro de usuario (`POST /auth/register`)** | Completar nombre, rol, correo y contraseña (mín. 6 caracteres) y enviar. | Se crea la cuenta en el backend, se guarda la sesión activa y se desbloquea el panel. | Aprobado |
| **CP-03** | **Inicio de sesión (`POST /auth/login`)** | Ingresar correo y contraseña válidos; probar también credenciales erróneas. | Con datos válidos inicia sesión y muestra el rol; con datos inválidos rechaza el acceso con mensaje de error. | Aprobado |
| **CP-04** | **Paneles diferenciados por rol** | Iniciar sesión sucesivamente como **Jugador**, **Entrenador** y **Administrador**. | Cada rol muestra únicamente su menú y acciones correspondientes (registro/evolución personal; resumen, plantel, mediciones e IA; alta de jugadores y supervisión). | Aprobado |
| **CP-05** | **Alta y consulta de jugadores** | Registrar un jugador (nombre, posición, dorsal, edad) y usar el buscador/filtro. | El jugador queda persistido, aparece en el listado y el filtro reduce resultados en tiempo real. | Aprobado |
| **CP-06** | **Registro y consulta de mediciones** | Registrar medición con FC (BPM), fatiga/RPE (1–10) y velocidad máxima (km/h). | Se almacena la medición, se actualiza el historial y se refleja el semáforo de fatiga. | Aprobado |
| **CP-07** | **Análisis IA y seudonimización (`ia/analizar-jugador`)** | Seleccionar un jugador en **Informes e IA** y ejecutar el análisis. | Devuelve alias seudonimizado (`ATLETA_...`), clasificación (`normal` / `alerta` / `riesgo`), métricas agregadas y resumen orientativo. | Aprobado |
| **CP-08** | **Contingencia / Fallback de IA** | Simular o probar con clave inválida (`401`), modelo retirado (`404`) o sin conexión a Groq. | El sistema no se cae; aplica la clasificación por reglas y entrega un resumen de respaldo (*fallback*) aclarando que es apoyo orientativo. | Aprobado |

## 4. Evidencias y verificaciones clave
- **Conectividad:** Verificación de respuesta activa de `uvicorn` en `http://127.0.0.1:8000` antes de operar el frontend (evitando errores `ERR_CONNECTION_REFUSED` / `Failed to fetch`).
- **Privacidad (Habeas Data):** Comprobación de que el envío al LLM utiliza alias seudonimizados en lugar de datos personales directos del jugador.
- **Resiliencia:** Comprobación del modo *fallback* ante errores HTTP de la API externa (`401` / `404` / timeout).

## 5. Conclusiones
Las funcionalidades principales de autenticación, control por rol, persistencia de jugadores y mediciones, y análisis con IA operan de forma integrada y cuentan con mecanismos de respaldo ante fallos externos. Los análisis generados son de apoyo para el cuerpo técnico y no sustituyen el criterio médico o físico profesional.
