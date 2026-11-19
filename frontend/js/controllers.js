class PulsoController {
    static currentPanel = null;
    static playerFilter = '';
    static cache = { jugadores: [], mediciones: [], pruebas: [], anotaciones: [], ultimoIA: null };

    static async init() {
        this.bindNav();
        this.bindAuth();
        this.bindModals();
        this.bindContact();
        await this.refreshSessionUI();
    }

    static notify(message) {
        const toast = document.getElementById('toast');
        if (!toast) return;
        toast.textContent = message;
        toast.classList.add('show');
        clearTimeout(this._toastTimer);
        this._toastTimer = setTimeout(() => toast.classList.remove('show'), 3400);
    }

    static escapeHtml(text) {
        return String(text ?? '').replace(/[&<>"']/g, ch => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
        }[ch]));
    }

    static semaforoFatiga(fatiga) {
        const val = Number(fatiga || 0);
        if (val >= 7) return { label: 'Fatiga Alta', cls: 'alta' };
        if (val >= 4) return { label: 'Fatiga Media', cls: 'media' };
        return { label: 'Fatiga Baja', cls: 'baja' };
    }

    static bindNav() {
        const menuToggle = document.getElementById('menuToggle');
        const mainNav = document.getElementById('mainNav');
        menuToggle?.addEventListener('click', () => {
            const open = mainNav.classList.toggle('open');
            menuToggle.setAttribute('aria-expanded', String(open));
        });
        mainNav?.querySelectorAll('a').forEach(a => a.addEventListener('click', () => {
            mainNav.classList.remove('open');
        }));
    }

    static bindAuth() {
        const tabs = document.querySelectorAll('.auth-tab');
        const loginForm = document.getElementById('loginForm');
        const registerForm = document.getElementById('registerForm');

        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                tabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                const isLogin = tab.dataset.authTab === 'login';
                loginForm.classList.toggle('hidden', !isLogin);
                registerForm.classList.toggle('hidden', isLogin);
            });
        });

        loginForm?.addEventListener('submit', async (e) => {
            e.preventDefault();
            try {
                const res = await PulsoModel.login(
                    document.getElementById('loginEmail').value,
                    document.getElementById('loginPassword').value
                );
                PulsoModel.setSession(res.usuario);
                this.currentPanel = null;
                loginForm.reset();
                this.notify(`Sesión iniciada como ${res.usuario.nombre} (${res.usuario.rol})`);
                await this.refreshSessionUI();
            } catch (err) {
                this.notify(err.message);
            }
        });

        registerForm?.addEventListener('submit', async (e) => {
            e.preventDefault();
            try {
                const res = await PulsoModel.register({
                    nombre: document.getElementById('regNombre').value,
                    email: document.getElementById('regEmail').value,
                    rol: document.getElementById('regRol').value,
                    password: document.getElementById('regPassword').value
                });
                PulsoModel.setSession(res.usuario);
                this.currentPanel = null;
                registerForm.reset();
                this.notify(`Cuenta creada · Bienvenido ${res.usuario.nombre}`);
                await this.refreshSessionUI();
            } catch (err) {
                this.notify(err.message);
            }
        });

        const logout = async () => {
            PulsoModel.clearSession();
            this.currentPanel = null;
            this.cache.ultimoIA = null;
            this.notify('Sesión cerrada.');
            await this.refreshSessionUI();
        };

        document.getElementById('btnLogout')?.addEventListener('click', logout);
        document.getElementById('btnSwitchUser')?.addEventListener('click', logout);
    }

    static getMenuForRole(rol) {
        const r = (rol || '').toLowerCase();
        if (r === 'jugador') {
            return [
                { key: 'mi-registro', icon: '↗', label: 'Mi registro diario' },
                { key: 'mi-evolucion', icon: '◷', label: 'Mi evolución' }
            ];
        }
        if (r === 'administrador') {
            return [
                { key: 'admin-plantel', icon: '♙', label: 'Plantel y altas' },
                { key: 'admin-supervision', icon: '▤', label: 'Supervisión general' }
            ];
        }
        // Entrenador / Cuerpo técnico
        return [
            { key: 'resumen', icon: '◫', label: 'Resumen semanal' },
            { key: 'jugadores', icon: '♙', label: 'Jugadores' },
            { key: 'mediciones', icon: '⌁', label: 'Mediciones' },
            { key: 'informes', icon: '▤', label: 'Informes e IA' }
        ];
    }

    static renderToolsForRole(rol) {
        const tools = document.getElementById('workspaceTools');
        if (!tools) return;
        const r = (rol || '').toLowerCase();

        if (r === 'jugador') {
            tools.innerHTML = `
                <div>
                    <span class="tool-icon">↗</span>
                    <div>
                        <b>Registro diario del jugador</b>
                        <p>Registra tu frecuencia cardíaca, fatiga/RPE y velocidad máxima tras el entrenamiento.</p>
                    </div>
                </div>
                <div class="tools-actions">
                    <button type="button" class="button button-lime" id="openModal">Registrar mi medición <span>↗</span></button>
                </div>
            `;
        } else if (r === 'administrador') {
            tools.innerHTML = `
                <div>
                    <span class="tool-icon">＋</span>
                    <div>
                        <b>Administración del plantel</b>
                        <p>Da de alta nuevos jugadores y revisa el estado de los registros en la base de datos.</p>
                    </div>
                </div>
                <div class="tools-actions">
                    <button type="button" class="button button-lime" id="openPlayerModal">＋ Dar de alta jugador <span>↗</span></button>
                </div>
            `;
        } else {
            tools.innerHTML = `
                <div>
                    <span class="tool-icon">＋</span>
                    <div>
                        <b>Herramientas del cuerpo técnico</b>
                        <p>Registra mediciones del plantel, incorpora jugadores o genera análisis con IA.</p>
                    </div>
                </div>
                <div class="tools-actions">
                    <button type="button" class="outline-small" id="openPlayerModal">＋ Nuevo jugador</button>
                    <button type="button" class="button button-lime" id="openModal">Registrar medición <span>↗</span></button>
                </div>
            `;
        }

        document.getElementById('openModal')?.addEventListener('click', () => {
            document.getElementById('modalBackdrop').hidden = false;
        });
        document.getElementById('openPlayerModal')?.addEventListener('click', () => {
            document.getElementById('playerModalBackdrop').hidden = false;
        });
    }

    static async refreshSessionUI() {
        const user = PulsoModel.getSession();
        const chip = document.getElementById('sessionChip');
        const btnLogout = document.getElementById('btnLogout');
        const headerCta = document.getElementById('headerCta');
        const lockedNotice = document.getElementById('lockedNotice');
        const workspace = document.getElementById('appWorkspace');
        const tools = document.getElementById('workspaceTools');
        const banner = document.getElementById('authActiveBanner');
        const forms = document.querySelectorAll('.auth-form');
        const tabs = document.querySelector('.auth-tabs');

        if (!user) {
            chip.textContent = 'Sin sesión activa';
            chip.classList.remove('logged');
            btnLogout?.classList.add('hidden');
            headerCta?.classList.remove('hidden');
            lockedNotice?.classList.remove('hidden');
            workspace?.classList.add('hidden');
            tools?.classList.add('hidden');
            banner?.classList.add('hidden');
            tabs?.classList.remove('hidden');
            document.querySelector('.auth-tab[data-auth-tab="login"]')?.click();
            return;
        }

        chip.textContent = `${user.nombre} · ${user.rol}`;
        chip.classList.add('logged');
        btnLogout?.classList.remove('hidden');
        headerCta?.classList.add('hidden');
        lockedNotice?.classList.add('hidden');
        workspace?.classList.remove('hidden');
        tools?.classList.remove('hidden');

        banner?.classList.remove('hidden');
        tabs?.classList.add('hidden');
        forms.forEach(f => f.classList.add('hidden'));
        document.getElementById('activeUserName').textContent = user.nombre;
        document.getElementById('activeUserMeta').textContent = `Rol: ${user.rol} · ${user.email}`;

        const initials = user.nombre.split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase() || '').join('') || 'US';
        document.getElementById('sidebarAvatar').textContent = initials;
        document.getElementById('sidebarUserName').textContent = user.nombre;
        document.getElementById('sidebarUserRole').textContent = `Rol: ${user.rol}`;
        document.getElementById('roleBadgeSidebar').textContent = String(user.rol).toUpperCase();
        document.getElementById('roleChipTop').innerHTML = `ROL <b>${this.escapeHtml(String(user.rol).toUpperCase())}</b>`;

        const menuItems = this.getMenuForRole(user.rol);
        const navContainer = document.getElementById('roleSidebarNav');
        if (navContainer) {
            navContainer.innerHTML = menuItems.map((m, idx) => `
                <button type="button" class="side-link ${idx === 0 ? 'active' : ''}" data-panel="${m.key}">
                    <span>${m.icon}</span> ${this.escapeHtml(m.label)}
                </button>
            `).join('');
            navContainer.querySelectorAll('.side-link').forEach(btn => {
                btn.addEventListener('click', () => this.showPanel(btn.dataset.panel));
            });
        }

        this.renderToolsForRole(user.rol);

        const aiHealth = await PulsoModel.checkAiHealth();
        const aiLabel = document.getElementById('aiConnectionLabel');
        if (aiLabel) {
            aiLabel.textContent = aiHealth.groq_api_key_configured
                ? `● IA activa: Groq (${aiHealth.model})`
                : '● IA activa: Reglas + seudonimización';
        }

        await this.loadAllData();
        const defaultKey = menuItems[0]?.key || 'resumen';
        this.showPanel(this.currentPanel || defaultKey);
    }

    static async loadAllData() {
        const [jugadores, mediciones, pruebas, anotaciones] = await Promise.all([
            PulsoModel.getJugadores(),
            PulsoModel.getMediciones(),
            PulsoModel.getPruebasFisicas(),
            PulsoModel.getAnotaciones()
        ]);
        this.cache.jugadores = jugadores;
        this.cache.mediciones = mediciones;
        this.cache.pruebas = pruebas;
        this.cache.anotaciones = anotaciones;

        const sel = document.getElementById('mJugadorSelect');
        if (sel) {
            sel.innerHTML = jugadores.map(j =>
                `<option value="${j.id}">#${j.numero_camiseta} · ${this.escapeHtml(j.nombre)} (${this.escapeHtml(j.posicion)})</option>`
            ).join('');
        }
    }

    static showPanel(key) {
        this.currentPanel = key;
        document.querySelectorAll('.side-link').forEach(b => b.classList.toggle('active', b.dataset.panel === key));

        const titles = {
            'mi-registro': ['Mi registro diario (Jugador)', 'Registra tu carga diaria y consulta tu último estado.'],
            'mi-evolucion': ['Mi evolución personal', 'Revisa el historial de mediciones y pruebas registradas.'],
            'admin-plantel': ['Gestión de plantel (Administrador)', 'Registra jugadores y consulta la nómina activa.'],
            'admin-supervision': ['Supervisión general del sistema', 'Vista de control de registros de mediciones y pruebas.'],
            'resumen': ['Resumen semanal (Entrenador)', 'Lectura general del plantel, carga y estado físico.'],
            'jugadores': ['Jugadores del plantel', 'Busca y revisa los jugadores y su semáforo de fatiga.'],
            'mediciones': ['Registro de mediciones', 'Historial completo de mediciones del plantel.'],
            'informes': ['Informes e Análisis IA', 'Clasificación y resumen con seudonimización y Groq.']
        };

        const info = titles[key] || ['Panel', ''];
        document.getElementById('panelTitle').textContent = info[0];
        document.getElementById('panelSubtitle').textContent = info[1];

        const container = document.getElementById('panelContent');
        if (key === 'mi-registro') container.innerHTML = this.renderJugadorRegistro();
        else if (key === 'mi-evolucion') container.innerHTML = this.renderJugadorEvolucion();
        else if (key === 'admin-plantel') {
            container.innerHTML = this.renderAdminPlantel();
            this.bindPlayerSearch();
        }
        else if (key === 'admin-supervision') container.innerHTML = this.renderAdminSupervision();
        else if (key === 'resumen') container.innerHTML = this.renderResumenEntrenador();
        else if (key === 'jugadores') {
            container.innerHTML = this.renderJugadoresEntrenador();
            this.bindPlayerSearch();
        }
        else if (key === 'mediciones') container.innerHTML = this.renderMediciones();
        else if (key === 'informes') {
            container.innerHTML = this.renderInformesIA();
            this.bindIAForm();
        }
    }

    // --- VISTAS ROL JUGADOR ---
    static renderJugadorRegistro() {
        const ultima = this.cache.mediciones[this.cache.mediciones.length - 1];
        const sem = ultima ? this.semaforoFatiga(ultima.fatiga_nivel) : { label: 'Sin registros', cls: 'baja' };
        return `
            <div class="metric-grid">
                <article class="metric-card">
                    <span>ÚLTIMA FC REGISTRADA</span>
                    <strong>${ultima ? `${this.escapeHtml(ultima.frecuencia_cardiaca)} BPM` : '—'}</strong>
                    <small>Frecuencia cardíaca</small>
                    <div class="metric-symbol">♥</div>
                </article>
                <article class="metric-card">
                    <span>ÚLTIMA FATIGA / RPE</span>
                    <strong>${ultima ? `${this.escapeHtml(ultima.fatiga_nivel)} / 10` : '—'}</strong>
                    <small><span class="status-tag ${sem.cls}">${sem.label}</span></small>
                    <div class="metric-symbol">↗</div>
                </article>
                <article class="metric-card">
                    <span>VELOCIDAD PICO</span>
                    <strong>${ultima ? `${this.escapeHtml(ultima.velocidad_maxima)} km/h` : '—'}</strong>
                    <small>Registro más reciente</small>
                    <div class="metric-symbol">◷</div>
                </article>
            </div>
            <div class="data-card">
                <div class="card-head">
                    <div>
                        <h4>Registrar mi día de entrenamiento</h4>
                        <p>Completa tu medición diaria de forma rápida</p>
                    </div>
                    <button type="button" class="button button-lime" onclick="document.getElementById('openModal').click()">Abrir formulario de medición ↗</button>
                </div>
                <p class="auth-sub">Tip sencillo: registra tu fatiga/RPE al finalizar la sesión para que el cuerpo técnico pueda detectar sobrecarga a tiempo.</p>
            </div>
        `;
    }

    static renderJugadorEvolucion() {
        const rows = this.cache.mediciones.slice().reverse().map(m => {
            const sem = this.semaforoFatiga(m.fatiga_nivel);
            return `
                <tr>
                    <td><b>${this.escapeHtml(m.jugador)}</b></td>
                    <td>${this.escapeHtml(m.frecuencia_cardiaca)} BPM</td>
                    <td><span class="rpe-chip">${this.escapeHtml(m.fatiga_nivel)} / 10</span></td>
                    <td><span class="status-tag ${sem.cls}">${sem.label}</span></td>
                    <td>${this.escapeHtml(m.velocidad_maxima)} km/h</td>
                    <td>${this.escapeHtml(m.fecha_registro)}</td>
                </tr>
            `;
        }).join('') || '<tr><td colspan="6">Aún no hay mediciones en el historial.</td></tr>';

        return `
            <div class="data-card">
                <div class="card-head">
                    <div><h4>Historial de mediciones y carga</h4><p>Seguimiento de evolución en el tiempo</p></div>
                </div>
                <div class="table-wrap">
                    <table>
                        <thead><tr><th>JUGADOR</th><th>FC</th><th>FATIGA</th><th>SEMÁFORO</th><th>VEL. MÁX</th><th>FECHA</th></tr></thead>
                        <tbody>${rows}</tbody>
                    </table>
                </div>
            </div>
        `;
    }

    // --- VISTAS ROL ADMINISTRADOR ---
    static renderAdminPlantel() {
        const q = this.playerFilter.trim().toLowerCase();
        const filtrados = this.cache.jugadores.filter(j =>
            !q || j.nombre.toLowerCase().includes(q) || (j.posicion || '').toLowerCase().includes(q)
        );
        const rows = filtrados.map(j => `
            <tr>
                <td>#${this.escapeHtml(j.id)}</td>
                <td><b>#${this.escapeHtml(j.numero_camiseta)}</b></td>
                <td><b>${this.escapeHtml(j.nombre)}</b></td>
                <td>${this.escapeHtml(j.posicion)}</td>
                <td>${this.escapeHtml(j.edad)} años</td>
            </tr>
        `).join('') || '<tr><td colspan="5">No hay jugadores que coincidan con la búsqueda.</td></tr>';

        return `
            <div class="metric-grid">
                <article class="metric-card"><span>TOTAL JUGADORES</span><strong>${this.cache.jugadores.length}</strong><small>Nómina activa</small></article>
                <article class="metric-card"><span>MEDICIONES EN BD</span><strong>${this.cache.mediciones.length}</strong><small>Registros almacenados</small></article>
                <article class="metric-card"><span>PRUEBAS EN BD</span><strong>${this.cache.pruebas.length}</strong><small>Evaluaciones cargadas</small></article>
            </div>
            <div class="data-card">
                <div class="card-head">
                    <div><h4>Nómina del plantel</h4><p>Administración de fichas de jugadores</p></div>
                    <div style="display:flex;gap:8px;flex-wrap:wrap">
                        <input type="search" id="playerSearchInput" class="filter-input" placeholder="Buscar por nombre o posición..." value="${this.escapeHtml(this.playerFilter)}">
                        <button type="button" class="button button-lime" onclick="document.getElementById('openPlayerModal').click()">＋ Nuevo jugador</button>
                    </div>
                </div>
                <div class="table-wrap">
                    <table>
                        <thead><tr><th>ID</th><th>DORSAL</th><th>NOMBRE</th><th>POSICIÓN</th><th>EDAD</th></tr></thead>
                        <tbody>${rows}</tbody>
                    </table>
                </div>
            </div>
        `;
    }

    static renderAdminSupervision() {
        return `
            <div class="data-card">
                <div class="card-head">
                    <div><h4>Resumen de actividad del sistema</h4><p>Control de integridad y volumen de datos</p></div>
                    <button type="button" class="outline-small" id="btnRefreshAdmin">Actualizar datos ↻</button>
                </div>
                <p class="auth-sub">
                    Usuarios/sesiones activas gestionadas vía <code>/auth/login</code> y <code>/auth/register</code> ·
                    Jugadores: <b>${this.cache.jugadores.length}</b> ·
                    Mediciones: <b>${this.cache.mediciones.length}</b> ·
                    Pruebas físicas: <b>${this.cache.pruebas.length}</b> ·
                    Anotaciones: <b>${this.cache.anotaciones.length}</b>.
                </p>
            </div>
        `;
    }

    // --- VISTAS ROL ENTRENADOR ---
    static renderResumenEntrenador() {
        const { jugadores, mediciones, pruebas } = this.cache;
        const avgFatiga = mediciones.length
            ? (mediciones.reduce((acc, m) => acc + Number(m.fatiga_nivel || 0), 0) / mediciones.length).toFixed(1)
            : '0.0';
        const alertas = mediciones.filter(m => Number(m.fatiga_nivel) >= 7).length;

        return `
            <div class="metric-grid">
                <article class="metric-card"><span>PLANTEL ACTIVO</span><strong>${jugadores.length}</strong><small>Jugadores registrados</small><div class="metric-symbol">♙</div></article>
                <article class="metric-card"><span>FATIGA PROMEDIO</span><strong>${avgFatiga}</strong><small>Escala 1–10 · ${pruebas.length} pruebas</small><div class="metric-symbol">↗</div></article>
                <article class="metric-card"><span>FATIGA ALTA (≥ 7)</span><strong>${alertas}</strong><small>Registros a revisar</small><div class="metric-symbol">!</div></article>
            </div>
            <div class="data-card">
                <div class="card-head">
                    <div><h4>Atajo de análisis inteligente</h4><p>Revisa estado y resumen con IA de cualquier jugador del plantel</p></div>
                    <button type="button" class="button button-lime" onclick="PulsoController.showPanel('informes')">Ir a Informes e IA ↗</button>
                </div>
                <p class="auth-sub">Usa la pestaña <strong>Informes e IA</strong> en el menú lateral para obtener clasificación (<em>normal / alerta / riesgo</em>) y síntesis para decisiones técnicas.</p>
            </div>
        `;
    }

    static renderJugadoresEntrenador() {
        const q = this.playerFilter.trim().toLowerCase();
        const filtrados = this.cache.jugadores.filter(j =>
            !q || j.nombre.toLowerCase().includes(q) || (j.posicion || '').toLowerCase().includes(q)
        );

        const rows = filtrados.map(j => {
            const ultimaMed = [...this.cache.mediciones].reverse().find(m => m.jugador === j.nombre);
            const sem = ultimaMed ? this.semaforoFatiga(ultimaMed.fatiga_nivel) : { label: 'Sin medición', cls: 'baja' };
            return `
                <tr>
                    <td><b>#${this.escapeHtml(j.numero_camiseta)}</b></td>
                    <td><b>${this.escapeHtml(j.nombre)}</b></td>
                    <td>${this.escapeHtml(j.posicion)}</td>
                    <td>${this.escapeHtml(j.edad)} años</td>
                    <td><span class="status-tag ${sem.cls}">${sem.label}</span></td>
                </tr>
            `;
        }).join('') || '<tr><td colspan="5">Sin jugadores registrados.</td></tr>';

        return `
            <div class="data-card">
                <div class="card-head">
                    <div><h4>Plantel y semáforo de fatiga</h4><p>Filtra por nombre o posición</p></div>
                    <input type="search" id="playerSearchInput" class="filter-input" placeholder="Buscar jugador o posición..." value="${this.escapeHtml(this.playerFilter)}">
                </div>
                <div class="table-wrap">
                    <table>
                        <thead><tr><th>DORSAL</th><th>JUGADOR</th><th>POSICIÓN</th><th>EDAD</th><th>ESTADO FATIGA</th></tr></thead>
                        <tbody>${rows}</tbody>
                    </table>
                </div>
            </div>
        `;
    }

    static renderMediciones() {
        const rows = this.cache.mediciones.slice().reverse().map(m => {
            const sem = this.semaforoFatiga(m.fatiga_nivel);
            return `
                <tr>
                    <td><b>${this.escapeHtml(m.jugador)}</b></td>
                    <td>${this.escapeHtml(m.frecuencia_cardiaca)} BPM</td>
                    <td><span class="rpe-chip">${this.escapeHtml(m.fatiga_nivel)} / 10</span></td>
                    <td><span class="status-tag ${sem.cls}">${sem.label}</span></td>
                    <td>${this.escapeHtml(m.velocidad_maxima)} km/h</td>
                    <td>${this.escapeHtml(m.fecha_registro)}</td>
                </tr>
            `;
        }).join('') || '<tr><td colspan="6">Sin mediciones registradas.</td></tr>';

        return `
            <div class="data-card">
                <div class="card-head">
                    <div><h4>Historial de mediciones</h4><p>Total: ${this.cache.mediciones.length} registros</p></div>
                    <button type="button" class="outline-small" onclick="document.getElementById('openModal').click()">＋ Nueva medición</button>
                </div>
                <div class="table-wrap">
                    <table>
                        <thead><tr><th>JUGADOR</th><th>FC</th><th>FATIGA</th><th>SEMÁFORO</th><th>VEL. MÁX</th><th>FECHA</th></tr></thead>
                        <tbody>${rows}</tbody>
                    </table>
                </div>
            </div>
        `;
    }

    static renderInformesIA() {
        const options = this.cache.jugadores.map(j =>
            `<option value="${j.id}">#${j.numero_camiseta} · ${this.escapeHtml(j.nombre)} (${this.escapeHtml(j.posicion)})</option>`
        ).join('');

        const ia = this.cache.ultimoIA;
        const resultadoHtml = ia ? `
            <div class="ia-box">
                <div class="ia-box-head">
                    <div>
                        <strong>${this.escapeHtml(ia.jugador_nombre)}</strong>
                        <span class="ia-meta"> · Alias seudonimizado: <code>${this.escapeHtml(ia.alias_seudonimizado)}</code></span>
                    </div>
                    <span class="status-tag ${this.escapeHtml(ia.clasificacion)}">● ${this.escapeHtml(String(ia.clasificacion).toUpperCase())}</span>
                </div>
                <p class="ia-summary">${this.escapeHtml(ia.resumen_ia)}</p>
                <div class="ia-meta">
                    FC Promedio: <b>${ia.metricas_agregadas?.promedio_fc ?? '-'}</b> BPM ·
                    Fatiga Promedio: <b>${ia.metricas_agregadas?.promedio_fatiga ?? '-'}</b> ·
                    Motor: <b>${this.escapeHtml(ia.metadata_ia?.proveedor || 'Reglas')}</b>
                </div>
            </div>
        ` : '<p class="auth-sub" style="margin-top:12px">Selecciona un jugador y pulsa "Analizar con IA" para generar la clasificación y el resumen.</p>';

        return `
            <div class="data-card">
                <div class="card-head">
                    <div>
                        <h4>Servicio de Inteligencia Artificial (Groq + Reglas)</h4>
                        <p>Envía métricas agregadas y seudonimizadas desde el backend FastAPI</p>
                    </div>
                </div>
                <form id="iaAnalyzeForm" class="form-row">
                    <div>
                        <label for="iaJugadorSelect">Jugador a analizar</label>
                        <select id="iaJugadorSelect" required>${options}</select>
                    </div>
                    <div style="display:flex;align-items:flex-end">
                        <button type="submit" class="button button-lime" style="width:100%">Analizar con IA <span>↗</span></button>
                    </div>
                </form>
                ${resultadoHtml}
            </div>
        `;
    }

    static bindPlayerSearch() {
        const input = document.getElementById('playerSearchInput');
        input?.addEventListener('input', (e) => {
            this.playerFilter = e.target.value;
            this.showPanel(this.currentPanel);
        });
        document.getElementById('btnRefreshAdmin')?.addEventListener('click', async () => {
            await this.loadAllData();
            this.showPanel(this.currentPanel);
            this.notify('Datos actualizados desde la base de datos.');
        });
    }

    static bindIAForm() {
        const form = document.getElementById('iaAnalyzeForm');
        form?.addEventListener('submit', async (e) => {
            e.preventDefault();
            const jugadorId = document.getElementById('iaJugadorSelect').value;
            if (!jugadorId) return;
            try {
                const res = await PulsoModel.analizarJugadorIA(jugadorId);
                this.cache.ultimoIA = res;
                this.showPanel('informes');
                this.notify(`Análisis IA generado (${res.clasificacion.toUpperCase()})`);
            } catch (err) {
                this.notify(err.message);
            }
        });
    }

    static bindContact() {
        const form = document.getElementById('contactForm');
        form?.addEventListener('submit', (e) => {
            e.preventDefault();
            const nombre = document.getElementById('cNombre').value.trim();
            form.reset();
            this.notify(`Gracias ${nombre}, tu mensaje de contacto fue registrado.`);
        });
    }

    static bindModals() {
        const mBackdrop = document.getElementById('modalBackdrop');
        const mForm = document.getElementById('measurementForm');
        document.getElementById('closeModal')?.addEventListener('click', () => { mBackdrop.hidden = true; mForm.reset(); });

        mForm?.addEventListener('submit', async (e) => {
            e.preventDefault();
            const res = await PulsoModel.crearMedicion({
                jugador_id: Number(document.getElementById('mJugadorSelect').value),
                frecuencia_cardiaca: Number(document.getElementById('mFc').value),
                fatiga_nivel: Number(document.getElementById('mFatiga').value),
                velocidad_maxima: Number(document.getElementById('mVel').value)
            });
            if (res.status === 'success') {
                mBackdrop.hidden = true;
                mForm.reset();
                await this.loadAllData();
                this.showPanel(this.currentPanel);
                this.notify('Medición guardada en la base de datos.');
            } else {
                this.notify(res.message || 'Error al guardar medición.');
            }
        });

        const pBackdrop = document.getElementById('playerModalBackdrop');
        const pForm = document.getElementById('playerForm');
        document.getElementById('closePlayerModal')?.addEventListener('click', () => { pBackdrop.hidden = true; pForm.reset(); });

        pForm?.addEventListener('submit', async (e) => {
            e.preventDefault();
            const user = PulsoModel.getSession();
            const res = await PulsoModel.crearJugador({
                nombre: document.getElementById('jNombre').value,
                posicion: document.getElementById('jPosicion').value,
                edad: Number(document.getElementById('jEdad').value),
                numero_camiseta: Number(document.getElementById('jDorsal').value),
                usuario_id: user?.id || 1
            });
            if (res.status === 'success') {
                pBackdrop.hidden = true;
                pForm.reset();
                await this.loadAllData();
                this.showPanel(this.currentPanel);
                this.notify('Jugador registrado correctamente.');
            } else {
                this.notify(res.message || 'Error al guardar jugador.');
            }
        });
    }
}