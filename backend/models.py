from typing import Literal, Optional
from pydantic import BaseModel, Field


class UsuarioRegistro(BaseModel):
    nombre: str = Field(..., min_length=2, max_length=100)
    email: str = Field(..., min_length=5, max_length=100)
    password: str = Field(..., min_length=6, max_length=255)
    rol: Literal["Jugador", "Entrenador", "Administrador"] = "Jugador"


class UsuarioLogin(BaseModel):
    email: str
    password: str


class Jugador(BaseModel):
    nombre: str = Field(..., min_length=2, max_length=100)
    posicion: str = Field(..., min_length=2, max_length=50)
    edad: int = Field(..., ge=10, le=50)
    numero_camiseta: int = Field(..., ge=1, le=99)
    usuario_id: Optional[int] = 1


class Medicion(BaseModel):
    jugador_id: int = Field(..., gt=0)
    frecuencia_cardiaca: int = Field(..., ge=35, le=230)
    fatiga_nivel: int = Field(..., ge=1, le=10)
    velocidad_maxima: float = Field(..., ge=0.0, le=45.0)


class PruebaFisica(BaseModel):
    jugador_id: int = Field(..., gt=0)
    tipo_prueba: str = Field(..., min_length=2, max_length=100)
    resultado: float = Field(..., gt=0)


class Anotacion(BaseModel):
    jugador_id: int = Field(..., gt=0)
    partido: str = Field(..., min_length=1, max_length=100)
    minuto: int = Field(..., ge=0, le=130)
    descripcion: str = Field(..., min_length=2, max_length=1000)


class SolicitudAnalisisIA(BaseModel):
    jugador_id: int = Field(..., gt=0)