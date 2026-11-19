const API_URL = 'http://127.0.0.1:8000';

class PulsoModel {
    static getSession() {
        try {
            return JSON.parse(localStorage.getItem('pulso_session') || 'null');
        } catch {
            return null;
        }
    }

    static setSession(usuario) {
        localStorage.setItem('pulso_session', JSON.stringify(usuario));
    }

    static clearSession() {
        localStorage.removeItem('pulso_session');
    }

    static async login(email, password) {
        const res = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || 'Credenciales inválidas');
        return data;
    }

    static async register(payload) {
        const res = await fetch(`${API_URL}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || 'No se pudo crear la cuenta');
        return data;
    }

    static async checkAiHealth() {
        try {
            const res = await fetch(`${API_URL}/health/ai`);
            return await res.json();
        } catch {
            return { status: 'offline', groq_api_key_configured: false };
        }
    }

    static async analizarJugadorIA(jugadorId) {
        const res = await fetch(`${API_URL}/ia/analizar-jugador`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ jugador_id: Number(jugadorId) })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || 'Error en el servicio de IA');
        return data;
    }

    static async getJugadores() {
        const res = await fetch(`${API_URL}/jugadores`);
        const data = await res.json();
        return data.jugadores || [];
    }

    static async crearJugador(jugadorData) {
        const res = await fetch(`${API_URL}/jugadores`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(jugadorData)
        });
        return await res.json();
    }

    static async getMediciones() {
        const res = await fetch(`${API_URL}/mediciones`);
        const data = await res.json();
        return data.mediciones || [];
    }

    static async crearMedicion(medicionData) {
        const res = await fetch(`${API_URL}/mediciones`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(medicionData)
        });
        return await res.json();
    }

    static async getPruebasFisicas() {
        const res = await fetch(`${API_URL}/pruebas-fisicas`);
        const data = await res.json();
        return data.pruebas_fisicas || [];
    }

    static async crearPruebaFisica(pruebaData) {
        const res = await fetch(`${API_URL}/pruebas-fisicas`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(pruebaData)
        });
        return await res.json();
    }

    static async getAnotaciones() {
        const res = await fetch(`${API_URL}/anotaciones`);
        const data = await res.json();
        return data.anotaciones || [];
    }

    static async crearAnotacion(anotacionData) {
        const res = await fetch(`${API_URL}/anotaciones`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(anotacionData)
        });
        return await res.json();
    }
}