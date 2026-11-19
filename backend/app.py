import hashlib
import secrets
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from ai_service import (
    clasificar_estado_por_reglas,
    generar_resumen_con_groq,
    seudonimizar_jugador,
)
from database import get_db_connection
from models import (
    Anotacion,
    Jugador,
    Medicion,
    PruebaFisica,
    SolicitudAnalisisIA,
    UsuarioLogin,
    UsuarioRegistro,
)

app = FastAPI(title="Pulso API", version="1.2")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _hash_password(password: str) -> str:
    salt = secrets.token_hex(8)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt.encode("utf-8"), 100_000).hex()
    return f"{salt}${digest}"


def _verificar_password(password: str, stored: str) -> bool:
    if "$" not in stored:
        # Compatibilidad con contraseñas semilla en texto plano si existieran
        return secrets.compare_digest(password, stored)
    salt, expected_hex = stored.split("$", 1)
    actual_hex = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt.encode("utf-8"), 100_000).hex()
    return secrets.compare_digest(actual_hex, expected_hex)


@app.get("/")
def read_root():
    return {"message": "¡Bienvenido al backend de Pulso! ⚽"}


@app.get("/health/ai")
def health_ai():
    import os
    has_key = bool(os.getenv("GROQ_API_KEY", "").strip())
    return {
        "status": "ok",
        "groq_api_key_configured": has_key,
        "model": os.getenv("GROQ_MODEL", "llama-3.1-8b-instant"),
    }


@app.get("/test-db")
def test_database_connection():
    conn = get_db_connection()
    if conn:
        conn.close()
        return {"status": "success", "message": "¡Conexión exitosa a SQL Server desde FastAPI!"}
    return {"status": "error", "message": "No se pudo establecer la conexión con la base de datos."}


# --- AUTENTICACIÓN Y CUENTAS ---
@app.post("/auth/register")
def registrar_usuario(usuario: UsuarioRegistro):
    conn = get_db_connection()
    if not conn:
        raise HTTPException(status_code=503, detail="Sin conexión a la base de datos")
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT id FROM USUARIO WHERE email = ?", (usuario.email.strip().lower(),))
        if cursor.fetchone():
            raise HTTPException(status_code=400, detail="El correo electrónico ya está registrado")

        password_hash = _hash_password(usuario.password)
        cursor.execute(
            "INSERT INTO USUARIO (nombre, email, password, rol) VALUES (?, ?, ?, ?)",
            (usuario.nombre.strip(), usuario.email.strip().lower(), password_hash, usuario.rol),
        )
        conn.commit()

        cursor.execute(
            "SELECT id, nombre, email, rol FROM USUARIO WHERE email = ?",
            (usuario.email.strip().lower(),),
        )
        row = cursor.fetchone()
        return {
            "status": "success",
            "message": "Cuenta creada correctamente",
            "usuario": {"id": row[0], "nombre": row[1], "email": row[2], "rol": row[3]},
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cursor.close()
        conn.close()


@app.post("/auth/login")
def iniciar_sesion(credenciales: UsuarioLogin):
    conn = get_db_connection()
    if not conn:
        raise HTTPException(status_code=503, detail="Sin conexión a la base de datos")
    cursor = conn.cursor()
    try:
        cursor.execute(
            "SELECT id, nombre, email, password, rol FROM USUARIO WHERE email = ?",
            (credenciales.email.strip().lower(),),
        )
        row = cursor.fetchone()
        if not row or not _verificar_password(credenciales.password, row[3]):
            raise HTTPException(status_code=401, detail="Correo o contraseña incorrectos")

        return {
            "status": "success",
            "message": "Inicio de sesión exitoso",
            "usuario": {
                "id": row[0],
                "nombre": row[1],
                "email": row[2],
                "rol": row[4],
            },
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cursor.close()
        conn.close()


# --- JUGADORES ---
@app.get("/jugadores")
def get_jugadores():
    conn = get_db_connection()
    if not conn:
        return {"error": "Sin conexión"}
    cursor = conn.cursor()
    cursor.execute("SELECT id, nombre, posicion, edad, numero_camiseta FROM JUGADOR")
    cols = [c[0] for c in cursor.description]
    res = [dict(zip(cols, row)) for row in cursor.fetchall()]
    cursor.close()
    conn.close()
    return {"total": len(res), "jugadores": res}


@app.post("/jugadores")
def crear_jugador(jugador: Jugador):
    conn = get_db_connection()
    if not conn:
        return {"error": "Sin conexión"}
    cursor = conn.cursor()
    try:
        cursor.execute(
            "INSERT INTO JUGADOR (nombre, posicion, edad, numero_camiseta, usuario_id) VALUES (?, ?, ?, ?, ?)",
            (jugador.nombre, jugador.posicion, jugador.edad, jugador.numero_camiseta, jugador.usuario_id),
        )
        conn.commit()
        return {"status": "success", "message": f"Jugador {jugador.nombre} creado"}
    except Exception as e:
        return {"status": "error", "message": str(e)}
    finally:
        cursor.close()
        conn.close()


# --- MEDICIONES ---
@app.get("/mediciones")
def get_mediciones():
    conn = get_db_connection()
    if not conn:
        return {"error": "Sin conexión"}
    cursor = conn.cursor()
    cursor.execute(
        "SELECT m.id, j.nombre AS jugador, m.frecuencia_cardiaca, m.fatiga_nivel, m.velocidad_maxima, m.fecha_registro "
        "FROM MEDICION m JOIN JUGADOR j ON m.jugador_id = j.id"
    )
    cols = [c[0] for c in cursor.description]
    res = [dict(zip(cols, row)) for row in cursor.fetchall()]
    cursor.close()
    conn.close()
    return {"total": len(res), "mediciones": res}


@app.post("/mediciones")
def crear_medicion(medicion: Medicion):
    conn = get_db_connection()
    if not conn:
        return {"error": "Sin conexión"}
    cursor = conn.cursor()
    try:
        cursor.execute(
            "INSERT INTO MEDICION (jugador_id, frecuencia_cardiaca, fatiga_nivel, velocidad_maxima) VALUES (?, ?, ?, ?)",
            (medicion.jugador_id, medicion.frecuencia_cardiaca, medicion.fatiga_nivel, medicion.velocidad_maxima),
        )
        conn.commit()
        return {"status": "success", "message": "Medición registrada"}
    except Exception as e:
        return {"status": "error", "message": str(e)}
    finally:
        cursor.close()
        conn.close()


# --- PRUEBAS FISICAS ---
@app.get("/pruebas-fisicas")
def get_pruebas_fisicas():
    conn = get_db_connection()
    if not conn:
        return {"error": "Sin conexión"}
    cursor = conn.cursor()
    cursor.execute(
        "SELECT p.id, j.nombre AS jugador, p.tipo_prueba, p.resultado, p.fecha "
        "FROM PRUEBA_FISICA p JOIN JUGADOR j ON p.jugador_id = j.id"
    )
    cols = [c[0] for c in cursor.description]
    res = [dict(zip(cols, row)) for row in cursor.fetchall()]
    cursor.close()
    conn.close()
    return {"total": len(res), "pruebas_fisicas": res}


@app.post("/pruebas-fisicas")
def crear_prueba_fisica(prueba: PruebaFisica):
    conn = get_db_connection()
    if not conn:
        return {"error": "Sin conexión"}
    cursor = conn.cursor()
    try:
        cursor.execute(
            "INSERT INTO PRUEBA_FISICA (jugador_id, tipo_prueba, resultado) VALUES (?, ?, ?)",
            (prueba.jugador_id, prueba.tipo_prueba, prueba.resultado),
        )
        conn.commit()
        return {"status": "success", "message": "Prueba física registrada"}
    except Exception as e:
        return {"status": "error", "message": str(e)}
    finally:
        cursor.close()
        conn.close()


# --- ANOTACIONES ---
@app.get("/anotaciones")
def get_anotaciones():
    conn = get_db_connection()
    if not conn:
        return {"error": "Sin conexión"}
    cursor = conn.cursor()
    cursor.execute(
        "SELECT a.id, j.nombre AS jugador, a.partido, a.minuto, a.descripcion "
        "FROM ANOTACION a JOIN JUGADOR j ON a.jugador_id = j.id"
    )
    cols = [c[0] for c in cursor.description]
    res = [dict(zip(cols, row)) for row in cursor.fetchall()]
    cursor.close()
    conn.close()
    return {"total": len(res), "anotaciones": res}


@app.post("/anotaciones")
def crear_anotacion(anotacion: Anotacion):
    conn = get_db_connection()
    if not conn:
        return {"error": "Sin conexión"}
    cursor = conn.cursor()
    try:
        cursor.execute(
            "INSERT INTO ANOTACION (jugador_id, partido, minuto, descripcion) VALUES (?, ?, ?, ?)",
            (anotacion.jugador_id, anotacion.partido, anotacion.minuto, anotacion.descripcion),
        )
        conn.commit()
        return {"status": "success", "message": "Anotación registrada"}
    except Exception as e:
        return {"status": "error", "message": str(e)}
    finally:
        cursor.close()
        conn.close()


# --- SERVICIO DE IA (GROQ + REGLAS + SEUDONIMIZACIÓN) ---
@app.post("/ia/analizar-jugador")
async def analizar_jugador_ia(solicitud: SolicitudAnalisisIA):
    conn = get_db_connection()
    if not conn:
        raise HTTPException(status_code=503, detail="Sin conexión a la base de datos")
    cursor = conn.cursor()
    try:
        cursor.execute(
            "SELECT id, nombre, posicion, numero_camiseta FROM JUGADOR WHERE id = ?",
            (solicitud.jugador_id,),
        )
        jugador_row = cursor.fetchone()
        if not jugador_row:
            raise HTTPException(status_code=404, detail="Jugador no encontrado")

        jugador_id, nombre_real, posicion, dorsal = jugador_row

        cursor.execute(
            "SELECT frecuencia_cardiaca, fatiga_nivel, velocidad_maxima, fecha_registro "
            "FROM MEDICION WHERE jugador_id = ? ORDER BY fecha_registro DESC, id DESC",
            (jugador_id,),
        )
        med_cols = [c[0] for c in cursor.description]
        mediciones = [dict(zip(med_cols, r)) for r in cursor.fetchall()]

        cursor.execute(
            "SELECT tipo_prueba, resultado, fecha "
            "FROM PRUEBA_FISICA WHERE jugador_id = ? ORDER BY fecha DESC, id DESC",
            (jugador_id,),
        )
        prue_cols = [c[0] for c in cursor.description]
        pruebas = [dict(zip(prue_cols, r)) for r in cursor.fetchall()]

        alias = seudonimizar_jugador(jugador_id, posicion)
        metricas = clasificar_estado_por_reglas(mediciones, pruebas)

        pruebas_serializables = [
            {
                "tipo_prueba": p["tipo_prueba"],
                "resultado": p["resultado"],
                "fecha": str(p["fecha"]),
            }
            for p in pruebas[:5]
        ]
        ia_resultado = await generar_resumen_con_groq(alias, metricas, pruebas_serializables)

        return {
            "status": "success",
            "jugador_id": jugador_id,
            "jugador_nombre": nombre_real,
            "dorsal": dorsal,
            "posicion": posicion,
            "alias_seudonimizado": alias,
            "clasificacion": metricas["estado"],
            "metricas_agregadas": metricas,
            "resumen_ia": ia_resultado["resumen"],
            "metadata_ia": {
                "proveedor": ia_resultado["proveedor"],
                "modelo": ia_resultado["modelo"],
                "usando_llm": ia_resultado["usando_llm"],
            },
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cursor.close()
        conn.close()