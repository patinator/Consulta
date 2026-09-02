let db = [], fCuadraActiva = null, sugIdx = -1;
let capR = L.layerGroup(), capE = L.layerGroup(), capC = L.layerGroup();

const mapasBase = {
    'URBASUR': L.tileLayer('Browser/teselas/{z}/{x}/{y}.png', {
        attribution: '&copy; URBA'
    }),
    'carto_light': L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; CARTO'
    }),
    'osm': L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap'
    }),
    // REEMPLAZO DE GCBA: Mapa Oficial del Instituto Geográfico Nacional (IGN)
    'ign': L.tileLayer('https://wms.ign.gob.ar/geoserver/gwc/service/tms/1.0.0/capabaseargenmap@EPSG%3A3857@png/{z}/{x}/{-y}.png', {
        attribution: '&copy; Instituto Geográfico Nacional',
        minZoom: 3,
        maxZoom: 18
    }),
    // GOOGLE STREETS (Solo dibujo/callejero)
   'google_streets': L.tileLayer('https://{s}.google.com/vt/lyrs=p&x={x}&y={y}&z={z}', {
    maxZoom: 20,
    subdomains: ['mt0','mt1','mt2','mt3'],
    attribution: '&copy; Google Maps'
    })
};

// Objeto único de colores (Global)
const coloresPuntos = {
    'VERDE': '#0eb654',      // Verde
    'LATERAL': '#ff1900',    // Rojo
    'BILATERAL': '#ff8800',  // Naranja (Ajustado según tu código hex)
    'SOTERRADO': '#ffcc00'  // Amarillo
    //'CESTO': '#000000'       // Negro
};

// Objeto para almacenar las capas
let capasContenedores = {
    verdes: null,
    laterales: null,
    bilaterales: null,
    soterrados: null
    //cestos: null
};

// Diccionario para vincular ID de HTML con nombre de capa
const mappingChecks = {
    'check-verdes': 'verdes',
    'check-laterales': 'laterales',
    'check-bilaterales': 'bilaterales',
    'check-soterrados': 'soterrados'
    //'check-cestos': 'cestos'
};

function inicializarCapasPuntos() {
    const crearEstiloPunto = (color) => ({
        radius: 5,
        fillColor: color,
        color: "#fff",
        weight: 1,
        opacity: 1,
        fillOpacity: 0.9
    });

    const crearContenidoPopup = (f) => {
        const p = f.properties;
        return `<div style="font-size:11px; font-family: Arial;">
                <b style="color:#333; border-bottom:1px solid #eee; display:block; margin-bottom:4px;">DATOS DEL EQUIPO</b>
                <b>ID:</b> ${p.ID_EQUIPO || 'S/D'}<br>
                <b>Calle:</b> ${p.CALLE || 'S/D'}<br>
                <b>Altura:</b> ${p.ALTURA || 'S/D'}<br>
                <b>Tipo:</b> ${p.COD_EQUIPA || 'VERDE'}<br>
                <b>Ubicación:</b> ${p.UBICACIÓN || 'S/D'}
            </div>`;
    };

    // 1. Procesar VERDES
    if (window.Verdes) {
        capasContenedores.verdes = L.geoJSON(window.Verdes, {
            pointToLayer: (f, latlng) => L.circleMarker(latlng, crearEstiloPunto(coloresPuntos.VERDE)).bindPopup(crearContenidoPopup(f))
        });
    }

    // 2. Procesar PR
    if (window.PR) {
        const crearCapaFiltrada = (valorFiltro, color) => {
            return L.geoJSON(window.PR, {
                filter: (f) => (f.properties.COD_EQUIPA || "").toString().trim().toUpperCase() === valorFiltro,
                pointToLayer: (f, latlng) => L.circleMarker(latlng, crearEstiloPunto(color)).bindPopup(crearContenidoPopup(f))
            });
        };

        capasContenedores.laterales = crearCapaFiltrada('LATERAL', coloresPuntos.LATERAL);
        capasContenedores.bilaterales = crearCapaFiltrada('BILATERAL', coloresPuntos.BILATERAL);
        capasContenedores.soterrados = crearCapaFiltrada('SOTERRADO', coloresPuntos.SOTERRADO);
        //capasContenedores.cestos = crearCapaFiltrada('CESTO', coloresPuntos.CESTO);
    }

    // 3. Vincular Eventos
    const mapping = { 'check-verdes': 'verdes', 'check-laterales': 'laterales', 'check-bilaterales': 'bilaterales', 'check-soterrados': 'soterrados', 'check-cestos': 'cestos' };
    Object.keys(mapping).forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('change', function() {
                const capa = capasContenedores[mapping[id]];
                if (capa) this.checked ? map.addLayer(capa) : map.removeLayer(capa);
            });
        }
    });
}

// Ejecutar cuando el mapa esté listo
document.addEventListener('DOMContentLoaded', () => {
    // Asegúrate de que tu objeto 'map' ya esté creado aquí
    inicializarCapasPuntos();
});

// Asignar los eventos
Object.keys(mappingChecks).forEach(id => {
    document.getElementById(id).addEventListener('change', function(e) {
        const capaKey = mappingChecks[id];
        if (e.target.checked) {
            capasContenedores[capaKey].addTo(map);
        } else {
            map.removeLayer(capasContenedores[capaKey]);
        }
    });
});

// 1. Procesar Datos Operativos
try {
    const l = datosCrudos.trim().split(/\r?\n/);
    const h = l[0].split(';');
    db = l.slice(1).map(row => {
        let o = {}, v = row.split(';');
        h.forEach((name, i) => o[name.trim()] = v[i] ? v[i].trim() : "");
        return o;
    });
} catch(e) { console.error("Error cargando base de datos:", e); }

// 2. Inicializar Mapa
var map = L.map('map', {
    attributionControl: false,
    zoomControl: false,
    fadeAnimation: false,
    
    // --- CONTROL DE ZOOM INTERMEDIO ---
    zoomSnap: 0.25,      // Permite pasos de zoom de 0.25 en 0.25 (ej: 15.25, 15.5, 15.75)
    zoomDelta: 0.25      // Define cuánto cambia el zoom al usar la rueda del mouse o la API
}).setView([-34.6188, -58.4034], 15.5); // Ahora puedes pasar decimales directamente aquí
// const map = L.map('map').setView([-34.63, -58.36], 15);
// Variable para rastrear la capa actual
let capaBaseActual = mapasBase['URBASUR'];

// 2. Inicializar el mapa con la capa por defecto
capaBaseActual.addTo(map);

// 3. Función para cambiar el mapa base
// En el evento change del selector:
document.getElementById('selector-mapa').addEventListener('change', function(e) {
    const seleccion = e.target.value;
    map.removeLayer(capaBaseActual);
    
    capaBaseActual = mapasBase[seleccion];
    capaBaseActual.addTo(map);

    // Si elegís GCBA, forzamos un re-dibujado para evitar que quede gris
    if (seleccion === 'gcba') {
        map.invalidateSize();
    }
});


//version 2
// L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
//     attribution: '&copy; OpenStreetMap &copy; CARTO',
//     subdomains: 'abcd',
//     maxZoom: 20
// }).addTo(map);

//version 3
// L.tileLayer('https://tiles.stadiamaps.com/tiles/alidade_smooth/{z}/{x}/{y}{r}.png', {
//     attribution: '&copy; Stadia Maps &copy; OpenStreetMap'
// }).addTo(map);

/* 
// 3. Capa Z7 (Permanente)
if (typeof Z7 !== 'undefined') {
    L.geoJSON(Z7, {
        style: { color: "#2c3e50", weight: 2, opacity: 0.6, fillColor: "#34495e", fillOpacity: 0.1, interactive: false }
    }).addTo(map);
}
 */
// 4. Activar Capas Operativas
capR.addTo(map); capE.addTo(map); capC.addTo(map);

// 5. Capa Invisible de Selección de Cuadras
const baseGeo = L.geoJSON(misRutas, { 
    style: { 
        stroke: true,        // Activamos el borde
        color: 'transparent', // Pero lo hacemos invisible
        weight: 20,           // Le damos grosor para que sea fácil clickear
        fillColor: '#000',    // Color de relleno (no se verá)
        fillOpacity: 0,       // Totalmente transparente
        interactive: true     // Obligatorio para capturar el clic
    },
    onEachFeature: (f, l) => {
        l.on('click', (e) => {
            L.DomEvent.stopPropagation(e);
            console.log("Click detectado en:", f.properties.NOMOFICIAL);
            limpiarCapas(true, true);
            mostrarFicha(f);
        });
    }
}).addTo(map);

// Aseguramos que el cursor cambie al pasar por encima
baseGeo.on('mouseover', function() {
    document.getElementById('map').style.cursor = 'pointer';
});
baseGeo.on('mouseout', function() {
    document.getElementById('map').style.cursor = '';
});

baseGeo.bringToFront(); // Que esté por encima de Z7

// --- FUNCIONES DE CONTROL ---

function toggleL() { 
    const p = document.getElementById('panel-izq');
    p.classList.toggle('collapsed');
    document.querySelector('.btn-L').innerText = p.classList.contains('collapsed') ? "▶" : "◀";
    setTimeout(() => map.invalidateSize(), 350);
}

function toggleR() { 
    const p = document.getElementById('panel-der');
    p.classList.toggle('active');
    document.querySelector('.btn-R').innerText = p.classList.contains('active') ? "▶" : "◀";
    setTimeout(() => map.invalidateSize(), 350);
}

function limpiarCombos() {
    document.getElementById('cbSrv').selectedIndex = 0;
    ['dTur','dFre','dRut'].forEach(id => document.getElementById(id).classList.add('hidden'));
}

function limpiarBusquedaRuta() { document.getElementById('inRuta').value = ""; }

function limpiarTodoBusqueda() {
    document.getElementById('inCalle').value = "";
    document.getElementById('inCalle2').value = "";
    document.getElementById('inAlt').value = "";
    document.getElementById('sugList').classList.add('hidden');
    document.getElementById('sugList2').classList.add('hidden');
    sugIdx = -1; // Muy importante reiniciar el índice aquí
}

function limpiarCapas(rutas = true, cuadra = true) {
    if(rutas) { capR.clearLayers(); capE.clearLayers(); }
    if(cuadra) { capC.clearLayers(); fCuadraActiva = null; }
}

function getColor(id) {
    if (!id) return '#3388ff';
    let hash = 0;
    for (let i = 0; i < id.length; i++) {
        hash = id.charCodeAt(i) + ((hash << 5) - hash);
    }
    // Usamos el número áureo para dispersar los colores (360 * 0.618033...)
    // Esto hace que IDs correlativos (4113, 4114) tengan colores muy distintos
    const hue = Math.abs(hash * 137.5) % 360; 
    return `hsl(${hue}, 80%, 45%)`;
}


function dibujar(ids) {
    limpiarCapas(true, true);
    
    // Convertimos IDs a String/Números limpios para evaluar rangos
    const esRutaUnica = ids.length === 1;
    const primerIdNum = esRutaUnica ? parseInt(ids[0], 10) : null;
    const esRango4000 = esRutaUnica && (primerIdNum >= 4000 && primerIdNum <= 4999);

    // Set para no repetir la etiqueta de una misma calle en la misma vista
    const callesEtiquetadas = new Set();

    const geo = L.geoJSON(misRutas, {
        filter: f => {
            const keys = Object.keys(f.properties);
            for(let i = 20; i < keys.length; i++) {
                let val = String(f.properties[keys[i]]);
                if(ids.includes(val) && val !== "null") { 
                    f._match = val; 
                    return true; 
                }
            }
            return false;
        },
        style: f => ({ 
            color: esRutaUnica ? "#e74c3c" : getColor(f._match || ""), 
            weight: 8, 
            opacity: 0.8, 
            interactive: false 
        }),

    }).addTo(capR);
    
    // REGLA 3: Mostrar etiquetas de NÚMERO DE RUTA solo si hay varias rutas seleccionadas (combo / servicio)
    // (Se descarta si es ruta única, tanto fuera como dentro del rango 4000-4999)
    if (!esRutaUnica) {
        let labels = new Set();
        geo.eachLayer(l => {
            if(l.feature && l.feature._match && !labels.has(l.feature._match)) {
                L.marker(l.getBounds().getCenter(), { 
                    interactive: false, 
                    icon: L.divIcon({ 
                        className: 'ruta-label', 
                        html: l.feature._match, 
                        iconSize: [null, null] 
                    }) 
                }).addTo(capE);
                labels.add(l.feature._match);
            }
        });
    }

    if(geo.getLayers().length) map.fitBounds(geo.getBounds(), {padding: [40, 40]});
}

function mostrarFicha(f) {
    fCuadraActiva = f;

    capC.clearLayers();
    L.geoJSON(f, { style: { color: "#e67e22", weight: 12, opacity:0.8, interactive: false } }).addTo(capC);
    map.fitBounds(L.geoJSON(f).getBounds(), {padding:[300,300]});
    //map.setZoom(map.getBoundsZoom(l.getBounds()) - 1);
    // OPCIÓN B (Si la A no es suficiente): Forzar un nivel menos de zoom después del ajuste
    //map.setZoom(50); // Baja un nivel de zoom extra para ver más contexto

    
    const p = f.properties;
    let rIds = [];
    Object.keys(p).slice(20).forEach(k => { if(p[k] && p[k]!=="null") rIds.push(p[k]); });

    document.getElementById('sb-contenido').innerHTML = `
        <div class="data-card"><span>Calle / Altura</span><p>${p.CALLE_N4 || 'Sin Dato'}</p></div>
        <div class="data-card"><span>Barrio</span><p>${p.BARRIO || '-'}</p></div>
        <div class="data-card"><span>Comuna</span><p>${p.COMUNA || '-'}</p></div>
        <div class="data-card"><span>Desde</span><p>${p.DESDE || '-'}</p></div>
        <div class="data-card"><span>Hasta</span><p>${p.HASTA || '-'}</p></div>
        <!-- <div class="data-card"><span>Nombre Anterior</span><p>${p.NOMANTER || '-'}</p></div> -->
        <div class="data-card"><span>Longitud</span><p>${p.LONG ? parseFloat(p.LONG).toFixed(2) : '0.00'} m</p></div>
        <h4 style="margin:20px 0 5px; font-size:10px; color:var(--primary); border-bottom:1px solid #ddd;">RUTAS DISPONIBLES</h4>
        <table class="tech-table">
            <thead><tr><th>RUTA</th><th>SERVICIO</th><th>TURNO</th><th>FREC.</th></tr></thead>
            <tbody>
            ${rIds.map(id => {
                const m = db.find(d => d.RUTA == id);
                return `<tr onclick="verRuta('${id}')"><td><b>${id}</b></td><td>${m?m.NOM_SERVIC:'-'}</td><td>${m?m.TURNO:'-'}</td><td>${m?m.FRECUENCIA:'-'}</td></tr>`;
            }).join('')}
            </tbody>
        </table>`;
    document.getElementById('panel-der').classList.add('active');
}

function verRuta(id) {
    const m = db.find(d => d.RUTA == id);
    if(!m) return;

    
    dibujar([id]);
    document.getElementById('sb-contenido').innerHTML = `
        ${fCuadraActiva ? '<button class="btn-back" onclick="mostrarFicha(fCuadraActiva)">← VOLVER A CUADRA</button>' : ''}
        <h3 style="color:var(--danger); margin-top:0;">DETALLE RUTA ${id}</h3>
        <div class="data-card"><span>Servicio</span><p>${m.NOM_SERVIC}</p></div>
        <div class="data-card"><span>Cód. Servicio</span><p>${m.COD_SERVIC}</p></div>
        <div class="data-card"><span>Turno</span><p>${m.TURNO}</p></div>
        <div class="data-card"><span>Frecuencia</span><p>${m.FRECUENCIA}</p></div>
        <div class="data-card"><span>Sector</span><p>${m.SECTOR}</p></div>
        <div class="data-card"><span>Días</span><p>${m.DIA_PREST}</p></div>
        <div class="data-card"><span>Hora Inicio</span><p>${m.HORA_INI}</p></div>
        <div class="data-card"><span>Comuna</span><p>${m.COMUNA}</p></div>
        <div class="data-card"><span>Actualización</span><p>${m.FECHA_ACT}</p></div>`;
    document.getElementById('panel-der').classList.add('active');
    const btnInforme = document.getElementById('btn-imprimir');
    if(btnInforme) btnInforme.style.display = 'block'; // Mostrar siempre en cuadra única
}

function mostrarInformeMultiple(ids) {
    document.getElementById('sb-contenido').innerHTML = `
        <h3 style="color:var(--primary); margin-top:0;">RESUMEN DE SELECCIÓN</h3>
        <p style="font-size:12px; color:#666;">Se visualizan ${ids.length} rutas en el mapa.</p>
        <table class="tech-table">
            <thead><tr><th>RUTA</th><th>SERVICIO</th><th>TURNO</th></tr></thead>
            <tbody>
            ${ids.map(id => {
                const m = db.find(d => d.RUTA == id);
                return `<tr onclick="verRuta('${id}')"><td><b>${id}</b></td><td>${m?m.NOM_SERVIC:'-'}</td><td>${m?m.TURNO:'-'}</td></tr>`;
            }).join('')}
            </tbody>
        </table>`;
    document.getElementById('panel-der').classList.add('active');
}

function initCombos() {
    const isC = document.getElementById('checkCodigo').checked;
    const s = document.getElementById('cbSrv');
    const campo = isC ? 'COD_SERVIC' : 'NOM_SERVIC';
    s.innerHTML = '<option value="">Seleccione Servicio...</option>';
    [...new Set(db.map(d=>d[campo]))].filter(x=>x).sort().forEach(v=>s.innerHTML+=`<option value="${v}">${v}</option>`);
    ['dTur','dFre','dRut'].forEach(id=>document.getElementById(id).classList.add('hidden'));
}

function manejarFiltros(e) {
    const isC = document.getElementById('checkCodigo').checked;
    const srv = document.getElementById('cbSrv').value;
    const tur = document.getElementById('cbTur'), fre = document.getElementById('cbFre'), rut = document.getElementById('cbRut');
    const campo = isC ? 'COD_SERVIC' : 'NOM_SERVIC';
    
    // Referencia al botón (asegúrate de que este ID sea el correcto en tu HTML)
    const btnInforme = document.getElementById('btn-imprimir'); 

    if(e.target.id==='cbSrv') {
        document.getElementById('dTur').classList.toggle('hidden', !srv);
        tur.innerHTML = '<option value="">Seleccione Turno...</option>';
        [...new Set(db.filter(d=>d[campo]===srv).map(x=>x.TURNO))].forEach(t=>tur.innerHTML+=`<option value="${t}">${t}</option>`);
    }
    else if(e.target.id==='cbTur') {
        document.getElementById('dFre').classList.toggle('hidden', !tur.value);
        fre.innerHTML = '<option value="">Seleccione Frecuencia...</option>';
        [...new Set(db.filter(d=>d[campo]===srv && d.TURNO===tur.value).map(x=>x.FRECUENCIA))].forEach(f=>fre.innerHTML+=`<option value="${f}">${f}</option>`);
    }
    else if(e.target.id==='cbFre') {
        document.getElementById('dRut').classList.remove('hidden');
        const filtered = db.filter(d=>d[campo]===srv && d.TURNO===tur.value && d.FRECUENCIA===fre.value);
        rut.innerHTML = '<option value="todas">--- MOSTRAR TODAS ---</option>';
        filtered.forEach(r=>rut.innerHTML+=`<option value="${r.RUTA}">${r.RUTA}</option>`);
        const ids = filtered.map(x=>x.RUTA);
        
        // AL FILTRAR POR FRECUENCIA SE MUESTRAN TODAS -> OCULTAMOS BOTÓN
        if(btnInforme) btnInforme.style.display = 'none'; 
        
        dibujar(ids);
        mostrarInformeMultiple(ids);
    }
    else if(e.target.id==='cbRut') {
        if(rut.value==='todas') {
            const ids = db.filter(d=>d[campo]===srv && d.TURNO===tur.value && d.FRECUENCIA===fre.value).map(x=>x.RUTA);
            
            // SI ELIGE "TODAS" -> OCULTAMOS BOTÓN
            if(btnInforme) btnInforme.style.display = 'none'; 
            
            dibujar(ids);
            mostrarInformeMultiple(ids);
        } else {
            // SI ELIGE UNA RUTA ESPECÍFICA -> MOSTRAR BOTÓN
            if(btnInforme) btnInforme.style.display = 'block'; 
            
            verRuta(rut.value);
        }
    }
}

function sugerir(t, listId) {
    const list = document.getElementById(listId);
    if(t.length < 3) { list.classList.add('hidden'); return; }
    
    const ops = [...new Set(misRutas.features
        .map(f => f.properties.NOMOFICIAL)
        .filter(n => n && n.includes(t.toUpperCase())))]
        .sort().slice(0, 10);

    const inputId = (listId === 'sugList') ? 'inCalle' : 'inCalle2';
    
    list.innerHTML = ops.map(o => 
        `<div class="suggestion-item" onclick="selCalle('${o}', '${inputId}')">${o}</div>`
    ).join('');
    
    list.classList.toggle('hidden', !ops.length);
}

function selCalle(nombre, targetId) { 
    // Forzamos el uso del targetId que viene de la sugerencia
    const input = document.getElementById(targetId);
    if (input) {
        input.value = nombre; 
    }
    
    // Ocultar ambas listas
    document.querySelectorAll('.suggestion-list').forEach(l => l.classList.add('hidden'));
    
    // LÓGICA DE FLUJO:
    if(targetId === 'inCalle') {
        // Si es la calle 1, vamos a la altura
        document.getElementById('inAlt').focus();
    } else if (targetId === 'inCalle2') {
        // Si es la calle 2, BUSCAMOS AUTOMÁTICAMENTE
        buscarInterseccion();
    }
}

function buscarCuadra() {
    const c = document.getElementById('inCalle').value.toUpperCase(), a = parseInt(document.getElementById('inAlt').value);
    const f = misRutas.features.find(feat => {
        const p = feat.properties;
        return p.NOMOFICIAL === c && a >= Math.min(p.ALT_IZQINI, p.ALT_IZQFIN) && a <= Math.max(p.ALT_IZQINI, p.ALT_IZQFIN);
    });
    if(f) { limpiarCapas(true, true); mostrarFicha(f); } else alert("Dirección no encontrada");
}

function buscarInterseccion() {
    const c1 = document.getElementById('inCalle').value.toUpperCase().trim();
    const c2 = document.getElementById('inCalle2').value.toUpperCase().trim();

    if (!c1 || !c2) return alert("Ingrese ambas calles para buscar el cruce.");

    const cuadrasC1 = misRutas.features.filter(f => f.properties.NOMOFICIAL === c1);
    const cuadrasC2 = misRutas.features.filter(f => f.properties.NOMOFICIAL === c2);

    if (cuadrasC1.length === 0 || cuadrasC2.length === 0) {
        return alert("No se encontró una de las calles en la base de datos.");
    }

    let encontrada = null;
    let puntoCruce = null;

    // Tolerancia para considerar que dos puntos son el mismo (aprox 1 metro)
    const tolerancia = 0.0001; 

    for (let f1 of cuadrasC1) {
        // Obtenemos coordenadas aplanadas (por si es MultiLineString)
        const coords1 = f1.geometry.type === "MultiLineString" 
                        ? f1.geometry.coordinates.flat() 
                        : f1.geometry.coordinates;
        
        for (let f2 of cuadrasC2) {
            const coords2 = f2.geometry.type === "MultiLineString" 
                            ? f2.geometry.coordinates.flat() 
                            : f2.geometry.coordinates;

            for (let p1 of coords1) {
                for (let p2 of coords2) {
                    // Comparamos con margen de error
                    const distLat = Math.abs(p1[1] - p2[1]);
                    const distLon = Math.abs(p1[0] - p2[0]);

                    if (distLat < tolerancia && distLon < tolerancia) {
                        encontrada = f1;
                        puntoCruce = [p1[1], p1[0]]; // Guardamos para el marcador [lat, lon]
                        break;
                    }
                }
                if (encontrada) break;
            }
            if (encontrada) break;
        }
        if (encontrada) break;
    }

    if (encontrada && puntoCruce) {
        limpiarCapas(true, true);
        mostrarFicha(encontrada);

        // Agregamos el marcador en el cruce
        const marker = L.circleMarker(puntoCruce, {
            radius: 10,
            fillColor: "#ffec00",
            color: "#000",
            weight: 2,
            opacity: 1,
            fillOpacity: 0.8
        }).addTo(capC); // Lo agregamos a la capa de cuadras para que se limpie solo después

        marker.bindPopup(`<b>Intersección</b><br>${c1} y ${c2}`).openPopup();
        
        map.setView(puntoCruce, 18);
    } else {
        alert("No se detectó un punto de contacto técnico entre las calles. Verifique que los nombres coincidan exactamente con la base.");
    }
}

function navTeclado(e) {
    const items = document.querySelectorAll('.suggestion-item');
    if(!items.length) return;

    // Detectamos automáticamente si estamos en inCalle o inCalle2
    const inputId = e.target.id; 

    if(e.key === "ArrowDown") { 
        e.preventDefault(); 
        sugIdx = (sugIdx + 1) % items.length; 
        highlight(items); 
    } 
    else if(e.key === "ArrowUp") { 
        e.preventDefault(); 
        sugIdx = (sugIdx - 1 + items.length) % items.length; 
        highlight(items); 
    } 
    else if(e.key === "Enter") { 
        e.preventDefault(); 
        if(sugIdx > -1) {
            // Pasamos el texto Y el id del input actual
            selCalle(items[sugIdx].innerText, inputId); 
            // Reiniciamos el índice para la próxima búsqueda
            sugIdx = -1; 
        } 
    }
}

function highlight(items) { items.forEach((it,i)=>it.classList.toggle('active', i===sugIdx)); }

function busquedaGlobal() { 
    const r = document.getElementById('inRuta').value.trim(); 
    if(r) { limpiarCapas(true, true); verRuta(r); } 
}

function limpiarTodo() { 
    limpiarCapas(true, true); 
    document.getElementById('panel-der').classList.remove('active'); 
    map.setView([-34.6188, -58.4034], 13);
    document.querySelectorAll('input, select').forEach(el => el.value = "");
    ['dTur','dFre','dRut'].forEach(id=>document.getElementById(id).classList.add('hidden'));
}

function inicializarCapasPuntos() {
    // Esta función interna asegura que el estilo use SIEMPRE los colores de tu constante global
    const obtenerEstiloPunto = (tipo) => ({
        radius: 5,
        fillColor: coloresPuntos[tipo] || '#333333', // Usa el color del objeto global
        color: "#fff",
        weight: 1,
        opacity: 1,
        fillOpacity: 0.9
    });

    const crearContenidoPopup = (f) => {
        const p = f.properties;
        return `<div style="font-size:11px; font-family: Arial;">
                <b style="color:#333; border-bottom:1px solid #eee; display:block; margin-bottom:4px;">DATOS DEL EQUIPO</b>
                <b>ID:</b> ${p.ID_EQUIPO || 'S/D'}<br>
                <b>Calle:</b> ${p.CALLE || 'S/D'}<br>
                <b>Altura:</b> ${p.ALTURA || 'S/D'}<br>
                <b>Tipo:</b> ${p.COD_EQUIPA || 'VERDE'}<br>
                <b>Ubicación:</b> ${p.UBICACIÓN || 'S/D'}
            </div>`;
    };

    // 1. Procesar VERDES
    if (window.Verdes) {
        capasContenedores.verdes = L.geoJSON(window.Verdes, {
            pointToLayer: (f, latlng) => L.circleMarker(latlng, obtenerEstiloPunto('VERDE')).bindPopup(crearContenidoPopup(f))
        });
    }

    // 2. Procesar PR (Laterales, Bilaterales, Soterrados, Cestos)
    if (window.PR) {
        const crearCapaFiltrada = (valorFiltro) => {
            return L.geoJSON(window.PR, {
                filter: (f) => {
                    const valor = (f.properties.COD_EQUIPA || "").toString().trim().toUpperCase();
                    return valor === valorFiltro;
                },
                pointToLayer: (f, latlng) => L.circleMarker(latlng, obtenerEstiloPunto(valorFiltro)).bindPopup(crearContenidoPopup(f))
            });
        };

        capasContenedores.laterales = crearCapaFiltrada('LATERAL');
        capasContenedores.bilaterales = crearCapaFiltrada('BILATERAL');
        capasContenedores.soterrados = crearCapaFiltrada('SOTERRADO');
        //capasContenedores.cestos = crearCapaFiltrada('CESTO');
    }

    // 3. Vincular Eventos a Checkboxes
    const mapping = { 
        'check-verdes': 'verdes', 
        'check-laterales': 'laterales', 
        'check-bilaterales': 'bilaterales', 
        'check-soterrados': 'soterrados'
        //'check-cestos': 'cestos' 
    };

    Object.keys(mapping).forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.onchange = function() {
                const capa = capasContenedores[mapping[id]];
                if (capa) {
                    if (this.checked) {
                        capa.addTo(map);
                    } else {
                        map.removeLayer(capa);
                    }
                }
            };
        }
    });
}

// Función auxiliar para crear el círculo
function crearMarcador(latlng, color) {
    return L.circleMarker(latlng, {
        radius: 6,
        fillColor: color,
        color: "#fff",
        weight: 1,
        opacity: 1,
        fillOpacity: 0.9
    });
}

function generarInforme() {
    // 1. CAPTURA DE CONTENIDO Y VALIDACIÓN
    const contenido = document.getElementById('sb-contenido');
    if (!contenido || !contenido.innerHTML.trim()) return alert("Seleccione algo para reportar.");

    const esMultiruta = contenido.innerHTML.includes("TODAS LAS RUTAS") || contenido.innerHTML.includes("RESULTADOS DE BÚSQUEDA");
    if (esMultiruta) {
        return alert("Por favor, seleccione una ruta o cuadra específica para generar el informe técnico.");
    }

    // 2. CAPTURA DE DATOS TÉCNICOS
    const datosArray = Array.from(contenido.querySelectorAll('.data-card')).map(card => ({
        label: card.querySelector('span')?.innerText.trim() || "",
        valor: card.querySelector('p')?.innerText.trim() || ""
    }));

    const esRuta = contenido.innerHTML.includes("DETALLE RUTA");
    const esRutaBarr = contenido.innerHTML.includes("DETALLE RUTA 4");
    // 3. OBTENCIÓN DE VALORES CLAVE
    const obtenerValor = (txt) => datosArray.find(d => d.label.toLowerCase().includes(txt.toLowerCase()))?.valor || "";

    // 4. CAPTURA DE CAPAS (Líneas y Puntos)
    let puntosParaInforme = [];
    const mappingNombres = { 'verdes': 'VERDE', 'laterales': 'LATERAL', 'bilaterales': 'BILATERAL', 'soterrados': 'SOTERRADO' };

    Object.keys(mappingNombres).forEach(key => {
        if (typeof capasContenedores !== 'undefined' && capasContenedores[key] && map.hasLayer(capasContenedores[key])) {
            puntosParaInforme.push(capasContenedores[key].toGeoJSON());
        }
    });

    const capasActivas = [];
    if (typeof capR !== 'undefined') capR.eachLayer(l => capasActivas.push(l.toGeoJSON()));
    if (typeof capC !== 'undefined') capC.eachLayer(l => capasActivas.push(l.toGeoJSON()));

    const ventana = window.open('', 'Reporte', 'width=1100,height=800');

    // =========================================================================
    // CASO 1: REPORTE DE RUTA (FORMATO A3 LANDSCAPE o AA Portrait)
    // =========================================================================
    if (esRuta) {
        const numRuta = obtenerValor("ruta") || contenido.querySelector('h3')?.innerText.replace(/[^0-9-]/g, '') || "";
        const servicioVal = obtenerValor("Servicio") || "SERVICIO";
        const codservicioVal = obtenerValor("Cód. Servicio") || "CODSERVICIO";
        const turnoVal = obtenerValor("TURNO") || "TURNO";
        if (turnoVal == 'M') turno="Turno Mañana";
        if (turnoVal == 'T') turno="Turno Tarde";
        if (turnoVal == 'N') turno="Turno Noche";
        const frecuenciaVal = obtenerValor("Frecuencia") || "FRECUENCIA";
        const diasVal = obtenerValor("Días") || "DIAS";
        const horaVal = obtenerValor("Hora Inicio") || "HORA";
        const versionVal = obtenerValor("Actualización") || "FECHA";
        const comunaVal = obtenerValor("comuna") || "0";

        if (esRutaBarr) {
            ventana.document.write(`
                <!DOCTYPE html>
                <html lang="es">
                <head>
                    <meta charset="UTF-8">
                    <title>7${codservicioVal}${turnoVal}${numRuta}${frecuenciaVal}</title>
                    <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" integrity="sha384-sHL9NAb7lN7rfvG5lfHpm643Xkcjzp4jFvuavGOndn6pjVqS6ny56CAt3nsEVT4H" crossorigin=""/>
                    <style>
                        @page { size: A4 portrait; margin: 0; }
                        body { margin: 0; padding: 0; background-color: #525659; font-family: Arial, sans-serif; display: flex; justify-content: center; }
                        .page { width: 210mm; height: 297mm; background: white; position: relative; box-sizing: border-box; margin: 20px auto; box-shadow: 0 0 15px rgba(0,0,0,0.5); overflow: hidden; }
                        #map { position: absolute; bottom: 43mm; right: 14mm; width: 182mm; height: 240mm; border: 0px solid #000; background-color: #ffffff !important; z-index: 1; }
                        #marcomap {position: absolute; bottom: 42mm; right: 13mm; width: 184mm; height: 242mm; border: 1px solid #000000; z-index: 1;}
                        .leaflet-container, .leaflet-pane, .leaflet-tile-pane { background-color: #ffffff !important; }
                        
                        .label-calle {
                            background: transparent !important;
                            border: none !important;
                            box-shadow: none !important;
                            font-family: Arial, sans-serif;
                            font-size: 12pt;
                            font-weight: bold;
                            color: #c111111;
                            text-shadow: 
                                -1px -1px 0 #fff,  
                                1px -1px 0 #fff,
                                -1px  1px 0 #fff,
                                1px  1px 0 #fff;
                            padding: 8px 7px;
                            white-space: nowrap;
                        }

                        /* Oculta las puntas o flechas indicadoras de los tooltips */
                        .leaflet-tooltip-left::before,
                        .leaflet-tooltip-right::before,
                        .leaflet-tooltip-above::before,
                        .leaflet-tooltip-below::before {
                            display: none !important;
                        }
                            
                        .cajetin {
                            position: absolute;
                            bottom: 13mm;
                            right: 13mm;
                            width: 184mm;
                            height: 28mm;
                            background: #ffffff;
                            border: 1px solid #000000;
                            z-index: 1000;
                            box-sizing: border-box;
                            display: grid;
                            grid-template-columns: 80mm 1fr 24mm;
                            font-family: Arial, Helvetica, sans-serif;
                            color: #000000;
                        }

                        /* CELDAS DEL CAJETÍN */
                        .cell {
                            position: relative;
                            border-right: 1px solid #000000;
                            border-bottom: 1px solid #000000;
                            box-sizing: border-box;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            text-align: center;
                            padding: 1px 3px;
                        }

                        .cell-no-bottom { border-bottom: none; }
                        .cell-no-right { border-right: none; }

                        /* Columna 1 (Izquierda) */
                        /* Columna 2 (Central Grid Interno) */
                        .c1-row1 {
                            grid-column: 1;
                            grid-row: 1;
                            font-size: 8pt;
                            font-weight: bold;
                            flex-direction: column;
                            line-height: 1;
                        }

                        .c1-row2 {
                            grid-column: 1;
                            grid-row: 2 / span 2;
                            font-size: 9pt;
                            line-height: 1;
                            text-transform: uppercase;
                        }

                        /* Columna 2 (Central Grid Interno) */
                        .c2-grid {
                            grid-column: 2;
                            grid-row: 1 / span 3;
                            display: grid;
                            grid-template-columns: 1fr 22mm;
                            grid-template-rows: 8mm 8mm 12mm;
                        }

                        /* Etiquetas técnicas grises superiores */
                        .label-tech {
                            position: absolute;
                            top: 1px;
                            left: 1px;
                            font-family: Arial, sans-serif;
                            font-size: 4.5pt;
                            font-weight: bold;
                            background: #dcdcdc;
                            padding: 0px 2px;
                            letter-spacing: 0.3px;
                            text-transform: uppercase;
                        }

                        .val-text {
                            font-size: 10pt;
                            width: 100%;
                        }

                        /* RUTA (Texto Grande) */
                        .val-ruta {
                            font-size: 21pt;
                            font-weight: bold;
                            letter-spacing: 0.5px;
                        }

                        /* Columna 3 (Logo) */
                        .c3-logo {
                            grid-column: 3;
                            grid-row: 1 / span 3;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            padding: 2px;
                            box-sizing: border-box;
                        }

                        .c3-logo img {
                            max-width: 95%;
                            max-height: 95%;
                            object-fit: contain;
                        }
                        .btn-print {
                            position: fixed;
                            top: 20px;
                            left: 20px;
                            padding: 12px 24px;
                            background: #27ae60;
                            color: white;
                            border: none;
                            border-radius: 4px;
                            font-weight: bold;
                            cursor: pointer;
                            z-index: 9999;
                            box-shadow: 0 2px 5px rgba(0,0,0,0.3);
                            font-size: 14px;
                        }
                        
                        /* Oculta las puntas o flechas indicadoras de los tooltips */
                        .leaflet-tooltip-left::before,
                        .leaflet-tooltip-right::before,
                        .leaflet-tooltip-above::before,
                        .leaflet-tooltip-below::before {
                            display: none !important;
                        }
                            
                        @media print { body { background: none; } .page { margin: 0; box-shadow: none; } .btn-print { display: none; } }

                    </style>
                </head>
                <body>
                    <button class="btn-print" onclick="window.print()">Imprimir / Guardar PDF (A4)</button>
                    <div class="page">
                        <div id="marcomap"></div>
                        <div id="map"></div>

                        <!-- CAJETÍN TÉCNICO -->
                        <div class="cajetin">
                            <!-- Bloque Izquierdo -->
                            <div class="cell c1-row1">
                                <div>SERVICIO PÚBLICO DE HIGIENE URBANA</div>
                                <div>LICITACION PÚBLICA Nº 997/2013 - ZONA 07</div>
                            </div>
                            <div class="cell c1-row2 cell-no-bottom">
                                <span id="lblNombreServicio">${servicioVal}
                            </div>
                            <!-- Bloque Central -->
                            <div class="c2-grid">
                                <!-- Frecuencia -->
                                <div class="cell" style="grid-column: 1; grid-row: 1;">
                                    <span class="label-tech">FRECUENCIA</span>
                                    <span class="val-text" id="lblFrecuencia">${frecuenciaVal} - ${diasVal}</span>
                                </div>
                                <!-- Versión -->
                                <div class="cell" style="grid-column: 2; grid-row: 1;">
                                    <span class="label-tech">VERSION</span>
                                    <span class="val-text" id="lblVersion">${versionVal}</span>
                                </div>
                                <!-- Turno -->
                                <div class="cell" style="grid-column: 1; grid-row: 2;">
                                    <span class="label-tech">TURNO</span>
                                    <span class="val-text" id="lblTurno">${turno} - ${horaVal} h</span>
                                </div>
                                <!-- Comuna -->
                                <div class="cell" style="grid-column: 2; grid-row: 2;">
                                    <span class="label-tech">COMUNA</span>
                                    <span class="val-text" id="lblComuna">${comunaVal}</span>
                                </div>
                                <!-- Ruta -->
                                <div class="cell cell-no-bottom" style="grid-column: 1 / span 2; grid-row: 3;">
                                    <span class="label-tech">RUTA</span>
                                    <span class="val-text val-ruta" id="lblRuta">7${codservicioVal}${turnoVal}-${numRuta}-${frecuenciaVal}</span>
                                </div>
                            </div>

                            <!-- Bloque Derecho (Logo) -->
                            <div class="c3-logo cell-no-bottom">
                                <img src="logo.png" alt="URBASUR" onerror="this.src='https://via.placeholder.com/100x100?text=URBASUR'">
                            </div>
                        </div>
                    </div>

                    <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js" integrity="sha384-cxOPjt7s7Iz04uaHJceBmS+qpjv2JkIHNVcuOrM+YHwZOmJGBXI00mdUXEq65HTH" crossorigin=""></script>
                    <script>
                        var map = L.map('map', {
                            attributionControl: false,
                            zoomControl: false,
                            fadeAnimation: false,
                            zoomSnap: 0.25,
                            zoomDelta: 0.25
                        }).setView([-34.6195, -58.4365], 15.5);

                        L.control.attribution({prefix: false}).addTo(map);

                        L.tileLayer('Browser/teselas/{z}/{x}/{y}.png', {
                            minZoom: 3, maxZoom: 19, tms: false
                        }).addTo(map);

                        const lineas = ${JSON.stringify(capasActivas)};
                        const puntos = ${JSON.stringify(puntosParaInforme)};
                        const colsPuntos = ${typeof coloresPuntos !== 'undefined' ? JSON.stringify(coloresPuntos) : '{}'};

                        let layerLineas;
                        const callesEtiquetadas = new Set();

                        if(lineas.length > 0) {
                            layerLineas = L.geoJSON(lineas, { 
                                style: { color: "#e74c3c", weight: 23, opacity: 0.8 },
                                onEachFeature: (feature, layer) => {
                                    const nombreCalle = feature.properties ? feature.properties.NOMOFICIAL : null;
                                    
                                    if (nombreCalle && nombreCalle.trim() !== "" && !callesEtiquetadas.has(nombreCalle)) {
                                        callesEtiquetadas.add(nombreCalle);

                                        // Agregamos el texto alineado al vector una vez que la capa se añade al mapa
                                        layer.on('add', function() {
                                            const originalPath = layer._path;
                                            if (!originalPath) return;

                                            let latlngs = layer.getLatLngs();
                                            if (Array.isArray(latlngs[0])) latlngs = latlngs[0];
                                            if (!latlngs || latlngs.length < 2) return;

                                            // Proyección a pantalla únicamente para calcular el ángulo
                                            const p1 = map.latLngToContainerPoint(latlngs[0]);
                                            const p2 = map.latLngToContainerPoint(latlngs[latlngs.length - 1]);

                                            // Ángulo de inclinación del tramo (-180° a 180°)
                                            let angulo = Math.atan2(p2.y - p1.y, p2.x - p1.x) * (180 / Math.PI);
                                            const estaBocaAbajo = angulo > 90 || angulo < -90;

                                            const svg = map.getPanes().overlayPane.querySelector('svg');
                                            if (!svg) return;

                                            let targetPathId = 'path-calle-' + Math.random().toString(36).substr(2, 9);

                                            if (estaBocaAbajo) {
                                                // Invertimos las coordenadas geográficas (LatLng)
                                                const latlngsInvertidos = [...latlngs].reverse();

                                                // Creamos una polilínea transparente paralela con la dirección invertida
                                                const polylineInv = L.polyline(latlngsInvertidos, {
                                                    stroke: false,
                                                    fill: false,
                                                    interactive: false
                                                }).addTo(map);

                                                // Asignamos el ID al path de la polilínea invertida generada por Leaflet
                                                if (polylineInv._path) {
                                                    polylineInv._path.setAttribute('id', targetPathId);
                                                } else {
                                                    // Fallback por si aún no se renderizó la polilínea en el DOM
                                                    originalPath.setAttribute('id', targetPathId);
                                                }
                                            } else {
                                                originalPath.setAttribute('id', targetPathId);
                                            }

                                            // Creación de la etiqueta de texto
                                            const textNode = document.createElementNS('http://www.w3.org/2000/svg', 'text');
                                            textNode.setAttribute('dy', '3'); 

                                            // --- REGLAS CLAVE PARA EVITAR RECORTE Y MANTENER TAMAÑO ---
                                            textNode.style.overflow = 'visible'; // Evita el recortes de bordes en el texto
                                            textNode.style.fontSize = '10pt';     // Tamaño de fuente original fijo
                                            textNode.style.fontWeight = 'bold';
                                            textNode.style.fontFamily = 'Arial, sans-serif';
                                            textNode.style.fill = '#111111';
                                            textNode.style.stroke = '#ffffff';
                                            textNode.style.strokeWidth = '2px';
                                            textNode.style.strokeLinejoin = 'round';
                                            textNode.style.paintOrder = 'stroke fill';

                                            const textPath = document.createElementNS('http://www.w3.org/2000/svg', 'textPath');
                                            textPath.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href', '#' + targetPathId);
                                            textPath.setAttribute('startOffset', '50%');
                                            textPath.setAttribute('text-anchor', 'middle');
                                            textPath.textContent = nombreCalle;

                                            textNode.appendChild(textPath);
                                            svg.appendChild(textNode);
                                        });
                                    }
                                }
                            }).addTo(map);
                        }

                        puntos.forEach(gj => {
                            L.geoJSON(gj, {
                                pointToLayer: (f, latlng) => {
                                    let cod = (f.properties.COD_EQUIPA || "VERDE").toString().trim().toUpperCase();
                                    return L.circleMarker(latlng, { radius: 5, fillColor: colsPuntos[cod] || "#000", color: "#fff", weight: 1, fillOpacity: 0.9 });
                                }
                            }).addTo(map);
                        });

                        if (layerLineas) {
                            setTimeout(() => {
                                map.invalidateSize();
                                map.fitBounds(layerLineas.getBounds(), { padding: [45, 45] });
                            }, 350);
                        }
                    </script>
                </body>
                </html>
            `);
        }
        else {
                        ventana.document.write(`
                <!DOCTYPE html>
                <html lang="es">
                <head>
                    <meta charset="UTF-8">
                    <title>7${codservicioVal}${turnoVal}${numRuta}${frecuenciaVal}</title>
                    <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" integrity="sha384-sHL9NAb7lN7rfvG5lfHpm643Xkcjzp4jFvuavGOndn6pjVqS6ny56CAt3nsEVT4H" crossorigin=""/>
                    <style>
                        @page { size: A3 landscape; margin: 0; }
                        body { margin: 0; padding: 0; background-color: #525659; font-family: Arial, sans-serif; display: flex; justify-content: center; }
                        .page { width: 420mm; height: 297mm; background: white; position: relative; box-sizing: border-box; margin: 20px auto; box-shadow: 0 0 15px rgba(0,0,0,0.5); overflow: hidden; }
                        #map { position: absolute; bottom: 13mm; right: 13mm; width: 388mm; height: 270mm; border: 1.5px solid #000; background-color: #ffffff !important; z-index: 1; }
                        .leaflet-container, .leaflet-pane, .leaflet-tile-pane { background-color: #ffffff !important; }
                        
                        /* CAJETÍN TÉCNICO */
                        .cajetin { position: absolute; bottom: 13mm; right: 13mm; width: 98mm; height: 44mm; background: #ffffff; border: 1px solid #000000; z-index: 1000; display: flex; flex-direction: column; box-sizing: border-box; font-family: Arial, sans-serif; color: #000000; }
                        .cajetin-row-1 { height: 9mm; border-bottom: 1px solid #000000; display: flex; flex-direction: column; justify-content: center; align-items: center; text-align: center; font-weight: bold; font-size: 9pt; line-height: 1.1; }
                        .cajetin-row-2 { height: 10mm; border-bottom: 1px solid #000000; display: flex; justify-content: center; align-items: center; text-align: center; font-weight: normal; font-size: 10pt; letter-spacing: 0.2px; }
                        .cajetin-body { height: 26mm; display: flex; }
                        .cajetin-info { width: 74mm; display: flex; flex-direction: column; }
                        .info-row { position: relative; display: flex; align-items: flex-end; border-bottom: 1px solid #000000; box-sizing: border-box; padding-bottom: 1mm; padding-left: 2mm; }
                        .info-row-frecuencia { height: 9mm; padding-left: 12mm;}
                        .info-row-turno { height: 9mm; padding-left: 12mm; }
                        .info-row-bottom { height: 8mm; border-bottom: none; padding-bottom: 0; padding-left: 0; }
                        .label-tech { position: absolute; top: 1px; left: 2px; font-family: 'Tahoma', sans-serif; font-size: 5pt; font-weight: bold; background: #e0e0e0; padding: 0px 2px; letter-spacing: 0.5px; }
                        .value-text { font-size: 10pt; font-weight: normal; width: 100%; }
                        .col-cell { position: relative; height: 100%; display: flex; align-items: flex-end; justify-content: center; border-right: 1px solid #000000; box-sizing: border-box; padding-bottom: 1mm; }
                        .col-cell:last-child { border-right: none; }
                        .col-version { width: 22mm; }
                        .col-ruta { width: 40mm; }
                        .col-comuna { width: 12mm; }
                        .col-cell .value-text { text-align: center; font-size: 10pt; }
                        .cajetin-logo { width: 24mm; height: 26mm; border-left: 1px solid #000000; display: flex; align-items: center; justify-content: center; padding: 1mm; box-sizing: border-box; }
                        .cajetin-logo img { max-width: 100%; max-height: 100%; object-fit: contain; }
                        
                        .btn-print { position: fixed; top: 20px; left: 20px; padding: 12px 24px; background: #27ae60; color: white; border: none; border-radius: 4px; font-weight: bold; cursor: pointer; z-index: 9999; box-shadow: 0 2px 5px rgba(0,0,0,0.3); font-size: 14px; }
                        @media print { body { background: none; } .page { margin: 0; box-shadow: none; } .btn-print { display: none; } }
                    </style>
                </head>
                <body>
                    <button class="btn-print" onclick="window.print()">Imprimir / Guardar PDF (A3)</button>
                    <div class="page">
                        <div id="map"></div>
                        <div class="cajetin">
                            <div class="cajetin-row-1">
                                <div>SERVICIO PÚBLICO DE HIGIENE URBANA</div>
                                <div>LICITACION PÚBLICA N 997/2013 - ZONA 07</div>
                            </div>
                            <div class="cajetin-row-2">
                                ${servicioVal}
                            </div>
                            <div class="cajetin-body">
                                <div class="cajetin-info">
                                    <div class="info-row info-row-frecuencia">
                                        <span class="label-tech">FRECUENCIA</span>
                                        <div class="value-text" style="text-align: left;">${frecuenciaVal} - ${diasVal}</div>
                                    </div>
                                    <div class="info-row info-row-turno">
                                        <span class="label-tech">TURNO</span>
                                        <div class="value-text" style="text-align: left;">${turno} - ${horaVal} h</div>
                                    </div>
                                    <div class="info-row info-row-bottom">
                                        <div class="col-cell col-version">
                                            <span class="label-tech">VERSION</span>
                                            <span class="value-text">${versionVal}</span>
                                        </div>
                                        <div class="col-cell col-ruta">
                                            <span class="label-tech">RUTA</span>
                                            <span class="value-text">7${codservicioVal}${turnoVal}-${numRuta}-${frecuenciaVal}</span>
                                        </div>
                                        <div class="col-cell col-comuna">
                                            <span class="label-tech">COMUNA</span>
                                            <span class="value-text">${comunaVal}</span>
                                        </div>
                                    </div>
                                </div>
                                <div class="cajetin-logo">
                                    <img src="logo.png" alt="URBASUR" onerror="this.src='https://via.placeholder.com/100x100?text=URBASUR'">
                                </div>
                            </div>
                        </div>
                    </div>

                    <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js" integrity="sha384-cxOPjt7s7Iz04uaHJceBmS+qpjv2JkIHNVcuOrM+YHwZOmJGBXI00mdUXEq65HTH" crossorigin=""></script>
                    <script>
                        var map = L.map('map', {
                            attributionControl: false,
                            zoomControl: false,
                            fadeAnimation: false,
                            zoomSnap: 0.25,      // Permite pasos de zoom de 0.25 en 0.25 (ej: 15.25, 15.5, 15.75)
                            zoomDelta: 0.25      // Define cuánto cambia el zoom al usar la rueda del mouse o la API
                        }).setView([-34.6188, -58.4034], 15.5); // Ahora puedes pasar decimales directamente aquí
                        L.control.attribution({prefix: false}).addTo(map);

                        L.tileLayer('Browser/teselas/{z}/{x}/{y}.png', {
                            minZoom: 3, maxZoom: 19, tms: false
                        }).addTo(map);

                        const lineas = ${JSON.stringify(capasActivas)};
                        const puntos = ${JSON.stringify(puntosParaInforme)};
                        const colsPuntos = ${typeof coloresPuntos !== 'undefined' ? JSON.stringify(coloresPuntos) : '{}'};

                        let layerLineas;
                        if(lineas.length > 0) {
                            layerLineas = L.geoJSON(lineas, { 
                                style: { color: "#e74c3c", weight: 10, opacity: 0.7 } 
                            }).addTo(map);
                        }

                        puntos.forEach(gj => {
                            L.geoJSON(gj, {
                                pointToLayer: (f, latlng) => {
                                    let cod = (f.properties.COD_EQUIPA || "VERDE").toString().trim().toUpperCase();
                                    return L.circleMarker(latlng, { radius: 5, fillColor: colsPuntos[cod] || "#000", color: "#fff", weight: 1, fillOpacity: 0.9 });
                                }
                            }).addTo(map);
                        });

                        if (layerLineas) {
                            setTimeout(() => {
                                map.invalidateSize();
                                map.fitBounds(layerLineas.getBounds(), { padding: [45, 45] });
                            }, 350);
                        }
                    <\/script>
                </body>
                </html>
            `);
        }
    } 
    // =========================================================================
    // CASO 2: REPORTE DE CUADRA (FORMATO A4 VERTICAL ESTÁNDAR)
    // =========================================================================
    else {
        const calle = obtenerValor("calle");
        const barrio = obtenerValor("barrio");
        const comunaVal = obtenerValor("comuna");
        const tituloInforme = `${calle} - ${barrio} - COMUNA ${comunaVal}`;

        const rutasBrutas = [];
        contenido.querySelectorAll('.tech-table tbody tr').forEach(tr => {
            const cols = tr.querySelectorAll('td');
            if(cols.length >= 4) {
                const tAbrev = cols[2].innerText.trim().toUpperCase();
                let tComp = (tAbrev === "M") ? "MAÑANA" : (tAbrev === "T") ? "TARDE" : (tAbrev === "N") ? "NOCHE" : tAbrev;
                rutasBrutas.push({ ruta: cols[0].innerText.trim(), servicio: cols[1].innerText.trim(), turno: tComp, frec: cols[3].innerText.trim() });
            }
        });

        const listadoHTML = ["MAÑANA", "TARDE", "NOCHE"].map(t => {
            const filtradas = rutasBrutas.filter(r => r.turno === t);
            if (!filtradas.length) return "";
            return `<div class="turno-block"><div class="turno-header">TURNO: ${t}</div><table class="cuadra-table">${filtradas.map(r => `<tr><td style="width:40px"><b>${r.ruta}</b></td><td>${r.servicio}</td><td align="right">${r.frec}</td></tr>`).join('')}</table></div>`;
        }).join('');
        
        const tablaSuperior = `<div class="servicios-grid">${listadoHTML}</div>`;

        ventana.document.write(`
            <!DOCTYPE html>
            <html lang="es">
            <head>
                <meta charset="UTF-8">
                <title>Reporte Técnico - Cuadra</title>
                <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" integrity="sha384-sHL9NAb7lN7rfvG5lfHpm643Xkcjzp4jFvuavGOndn6pjVqS6ny56CAt3nsEVT4H" crossorigin=""/>
                <style>
                    @page { size: A4 portrait; margin: 0; }
                    body { font-family: Arial, sans-serif; margin: 0; padding: 0; background: #eee; }
                    .toolbar { background: #000; padding: 10px; text-align: center; position: sticky; top: 0; z-index: 999; }
                    .toolbar button { padding: 8px 16px; background: #27ae60; color: white; border: none; font-weight: bold; cursor: pointer; border-radius: 4px; }
                    .a4-page { width: 210mm; height: 297mm; background: white; margin: 10px auto; padding: 10mm; box-sizing: border-box; display: flex; flex-direction: column; }
                    .report-title { font-size: 22px; text-align: center; border-bottom: 3px solid #000; margin: 0 0 20px 0; padding-bottom: 8px; text-transform: uppercase; font-weight: bold; }
                    .servicios-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; }
                    .turno-header { background: #333; color: white; font-size: 10px; padding: 4px 8px; font-weight: bold; }
                    .cuadra-table { width: 100%; border-collapse: collapse; font-size: 10px; border: 1px solid #ccc; }
                    .cuadra-table td { padding: 4px; border-bottom: 1px solid #eee; }
                    #map-static { flex-grow: 1; width: 100%; border: 1px solid #000; background-color: #ffffff !important; }
                    .footer-stamp { font-size: 8px; color: #999; text-align: right; margin-top: 5px; }
                    @media print { .toolbar { display: none; } body { background: white; } .a4-page { margin: 0; border: none; } }
                </style>
            </head>
            <body>
                <div class="toolbar"><button onclick="window.print()">IMPRIMIR PDF</button></div>
                <div class="a4-page">
                    <h1 class="report-title">${tituloInforme}</h1>
                    <div style="margin-bottom:15px;">${tablaSuperior}</div>
                    <div id="map-static"></div>
                    <div class="footer-stamp">Generado el: ${new Date().toLocaleString()}</div>
                </div>
                <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js" integrity="sha384-cxOPjt7s7Iz04uaHJceBmS+qpjv2JkIHNVcuOrM+YHwZOmJGBXI00mdUXEq65HTH" crossorigin=""></script>
                <script>
                    const map = L.map('map-static', { zoomControl: false, attributionControl: false, fadeAnimation: false });
                    L.tileLayer('file:///E:/online/Consulta/Browser/Teselas/{z}/{x}/{y}.png', {
                        minZoom: 3, maxZoom: 19, tms: false
                    }).addTo(map);

                    const lineas = ${JSON.stringify(capasActivas)};
                    const puntos = ${JSON.stringify(puntosParaInforme)};
                    const colsPuntos = ${typeof coloresPuntos !== 'undefined' ? JSON.stringify(coloresPuntos) : '{}'};

                    let layerLineas;
                    if(lineas.length > 0) {
                        layerLineas = L.geoJSON(lineas, { 
                            style: { color: "#e74c3c", weight: 12, opacity: 0.8 } 
                        }).addTo(map);
                    }

                    puntos.forEach(gj => {
                        L.geoJSON(gj, {
                            pointToLayer: (f, latlng) => {
                                let cod = (f.properties.COD_EQUIPA || "VERDE").toString().trim().toUpperCase();
                                return L.circleMarker(latlng, { radius: 5, fillColor: colsPuntos[cod] || "#000", color: "#fff", weight: 1, fillOpacity: 0.9 });
                            }
                        }).addTo(map);
                    });

                    if (layerLineas) {
                        setTimeout(() => {
                            map.invalidateSize();
                            map.fitBounds(layerLineas.getBounds(), { padding: [50, 50] });
                            map.setZoom(map.getZoom() - 1);
                        }, 350);
                    }
                <\/script>
            </body>
            </html>
        `);
    }

    ventana.document.close();
}

    function generarFilasTabla(datos, cols, max) {
        let html = '';
        for (let i = 0; i < Math.min(datos.length, max); i += cols) {
            html += '<tr>';
            for (let j = 0; j < cols; j++) {
                const item = datos[i + j];
                // Usamos item.label original para mostrar en la tabla
                html += `<td style="width:${100/cols}%">${item ? `<span class="label">${item.label}</span><span class="value">${item.valor}</span>` : ''}</td>`;
            }
            html += '</tr>';
        }
        return html;
    }
// Iniciar Combos al cargar

initCombos();