import os
import pyodbc
from dotenv import load_dotenv

load_dotenv()


def get_db_connection():
    server = os.getenv("DB_SERVER", r"localhost\SQLEXPRESS")
    database = os.getenv("DB_NAME", "pulso_db")
    driver = os.getenv("DB_DRIVER", "ODBC Driver 17 for SQL Server")
    trusted = os.getenv("DB_TRUSTED_CONNECTION", "yes")
    user = os.getenv("DB_USER")
    password = os.getenv("DB_PASSWORD")

    if trusted.lower() == "yes" and not user:
        connection_string = (
            f"DRIVER={{{driver}}};"
            f"SERVER={server};"
            f"DATABASE={database};"
            f"Trusted_Connection=yes;"
        )
    else:
        connection_string = (
            f"DRIVER={{{driver}}};"
            f"SERVER={server};"
            f"DATABASE={database};"
            f"UID={user};"
            f"PWD={password};"
            f"TrustServerCertificate=yes;"
        )

    try:
        return pyodbc.connect(connection_string)
    except Exception as e:
        print(f"Error al conectar a la base de datos: {e}")
        return None