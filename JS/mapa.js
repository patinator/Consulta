let db = [], fCuadraActiva = null, sugIdx = -1;
let capR = L.layerGroup(), capE = L.layerGroup(), capC = L.layerGroup();

const mapasBase = {
    'osm': L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap'
    }),
    'carto_light': L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; CARTO'
    }),
    // REEMPLAZO DE GCBA: Mapa Oficial del Instituto Geográfico Nacional (IGN)
    'ign': L.tileLayer('https://wms.ign.gob.ar/geoserver/gwc/service/tms/1.0.0/capabaseargenmap@EPSG%3A3857@png/{z}/{x}/{-y}.png', {
        attribution: '&copy; Instituto Geográfico Nacional',
        minZoom: 3,
        maxZoom: 18
    }),
    // GOOGLE STREETS (Solo dibujo/callejero)
    'google_streets': L.tileLayer('https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', {
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
const map = L.map('map').setView([-34.63, -58.36], 13);
// Variable para rastrear la capa actual
let capaBaseActual = mapasBase['osm'];

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


// 3. Capa Z7 (Permanente)
if (typeof Z7 !== 'undefined') {
    L.geoJSON(Z7, {
        style: { color: "#2c3e50", weight: 2, opacity: 0.6, fillColor: "#34495e", fillOpacity: 0.1, interactive: false }
    }).addTo(map);
}

// 4. Activar Capas Operativas
capR.addTo(map); capE.addTo(map); capC.addTo(map);

// 5. Capa Invisible de Selección de Cuadras
const baseGeo = L.geoJSON(misRutas, { 
    style: { 
        stroke: true,        // Activamos el borde
        color: 'transparent', // Pero lo hacemos invisible
        weight: 10,           // Le damos grosor para que sea fácil clickear
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
function limpiarTodoBusqueda() { limpiarCombos(); limpiarBusquedaRuta(); }

function limpiarCapas(rutas = true, cuadra = true) {
    if(rutas) { capR.clearLayers(); capE.clearLayers(); }
    if(cuadra) { capC.clearLayers(); fCuadraActiva = null; }
}

function getColor(id) {
    let hash = 0;
    for (let i = 0; i < id.length; i++) hash = id.charCodeAt(i) + ((hash << 5) - hash);
    return coloresPuntos[Math.abs(hash) % coloresPuntos.length];
}

function dibujar(ids) {
    limpiarCapas(true, true);
    const geo = L.geoJSON(misRutas, {
        filter: f => {
            const keys = Object.keys(f.properties);
            for(let i = 20; i < keys.length; i++) {
                let val = String(f.properties[keys[i]]);
                if(ids.includes(val) && val !== "null") { f._match = val; return true; }
            }
            return false;
        },
        style: f => ({ color: ids.length === 1 ? "#e74c3c" : getColor(f._match), weight: 6, opacity: 0.8, interactive: false })
    }).addTo(capR);
    
    let labels = new Set();
    geo.eachLayer(l => {
        if(!labels.has(l.feature._match)) {
            L.marker(l.getBounds().getCenter(), { interactive: false, icon: L.divIcon({ className:'ruta-label', html: l.feature._match, iconSize:[null,null] }) }).addTo(capE);
            labels.add(l.feature._match);
        }
    });
    if(geo.getLayers().length) map.fitBounds(geo.getBounds(), {padding:[40,40]});
}

function mostrarFicha(f) {
    fCuadraActiva = f;

    capC.clearLayers();
    L.geoJSON(f, { style: { color: "#e67e22", weight: 12, opacity:0.8, interactive: false } }).addTo(capC);
    map.fitBounds(L.geoJSON(f).getBounds(), {padding:[100,100]});
    
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
        <div class="data-card"><span>Actualización</span><p>${m.FECHA_ACT}</p></div>`;
    document.getElementById('panel-der').classList.add('active');
    
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
        dibujar(ids);
        mostrarInformeMultiple(ids);
    }
    else if(e.target.id==='cbRut') {
        if(rut.value==='todas') {
            const ids = db.filter(d=>d[campo]===srv && d.TURNO===tur.value && d.FRECUENCIA===fre.value).map(x=>x.RUTA);
            dibujar(ids);
            mostrarInformeMultiple(ids);
        } else {
            verRuta(rut.value);
        }
    }
}

function sugerir(t) {
    const list = document.getElementById('sugList');
    if(t.length < 3) { list.classList.add('hidden'); return; }
    const ops = [...new Set(misRutas.features.map(f=>f.properties.NOMOFICIAL).filter(n=>n && n.includes(t.toUpperCase())))].sort().slice(0,10);
    list.innerHTML = ops.map(o=>`<div class="suggestion-item" onclick="selCalle('${o}')">${o}</div>`).join('');
    list.classList.toggle('hidden', !ops.length);
}

function selCalle(n) { document.getElementById('inCalle').value=n; document.getElementById('sugList').classList.add('hidden'); document.getElementById('inAlt').focus(); }

function buscarCuadra() {
    const c = document.getElementById('inCalle').value.toUpperCase(), a = parseInt(document.getElementById('inAlt').value);
    const f = misRutas.features.find(feat => {
        const p = feat.properties;
        return p.NOMOFICIAL === c && a >= Math.min(p.ALT_IZQINI, p.ALT_IZQFIN) && a <= Math.max(p.ALT_IZQINI, p.ALT_IZQFIN);
    });
    if(f) { limpiarCapas(true, true); mostrarFicha(f); } else alert("Dirección no encontrada");
}

function navTeclado(e) {
    const items = document.querySelectorAll('.suggestion-item');
    if(!items.length) return;
    if(e.key==="ArrowDown") { e.preventDefault(); sugIdx=(sugIdx+1)%items.length; highlight(items); }
    else if(e.key==="ArrowUp") { e.preventDefault(); sugIdx=(sugIdx-1+items.length)%items.length; highlight(items); }
    else if(e.key==="Enter") { e.preventDefault(); if(sugIdx>-1) selCalle(items[sugIdx].innerText); }
}

function highlight(items) { items.forEach((it,i)=>it.classList.toggle('active', i===sugIdx)); }

function busquedaGlobal() { 
    const r = document.getElementById('inRuta').value.trim(); 
    if(r) { limpiarCapas(true, true); verRuta(r); } 
}

function limpiarTodo() { 
    limpiarCapas(true, true); 
    document.getElementById('panel-der').classList.remove('active'); 
    map.setView([-34.63, -58.36], 13);
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
    // 1. CAPTURA DE PUNTOS Y COLORES ACTIVOS
    let puntosParaInforme = [];
    let tiposActivosParaLeyenda = [];
    const mappingNombres = { 
        'verdes': 'VERDE', 
        'laterales': 'LATERAL', 
        'bilaterales': 'BILATERAL', 
        'soterrados': 'SOTERRADO' 
        //'cestos': 'CESTO' 
    };

    Object.keys(capasContenedores).forEach(key => {
        if (capasContenedores[key] && map.hasLayer(capasContenedores[key])) {
            puntosParaInforme.push(capasContenedores[key].toGeoJSON());
            tiposActivosParaLeyenda.push(mappingNombres[key]);
        }
    });

    // 2. CAPTURA DE CONTENIDO TÉCNICO
    const contenido = document.getElementById('sb-contenido');
    if (!contenido || !contenido.innerHTML.trim()) return alert("Seleccione algo para reportar.");

    const esRuta = contenido.innerHTML.includes("DETALLE RUTA");
    
    const datosArray = Array.from(contenido.querySelectorAll('.data-card')).map(card => ({
        label: card.querySelector('span').innerText.toLowerCase().trim(),
        valor: card.querySelector('p').innerText.trim()
    }));

    const capasActivas = [];
    capR.eachLayer(l => capasActivas.push(l.toGeoJSON()));
    capC.eachLayer(l => capasActivas.push(l.toGeoJSON()));

    // 3. GENERAR HTML DE LA LEYENDA (Usando coloresPuntos global)
    let leyendaHTML = "";
    if (tiposActivosParaLeyenda.length > 0) {
        leyendaHTML = `
            <div style="position: absolute; bottom: 15px; left: 15px; z-index: 1000; background: white; padding: 6px; border: 1.5px solid #000; font-size: 9px; font-family: Arial, sans-serif; min-width: 100px;">
                <b style="border-bottom: 1px solid #ccc; display: block; margin-bottom: 4px; font-size: 8px; letter-spacing: 0.5px;">REFERENCIAS</b>
                ${tiposActivosParaLeyenda.map(tipo => `
                    <div style="display: flex; align-items: center; margin-bottom: 3px;">
                        <div style="width: 10px; height: 10px; background: ${coloresPuntos[tipo]}; border: 1px solid #fff; border-radius: 50%; margin-right: 7px; box-shadow: 0 0 1px #000;"></div>
                        <span style="font-weight: bold; color: #333;">${tipo}</span>
                    </div>
                `).join('')}
            </div>`;
    }

    const ventana = window.open('', 'Reporte', 'width=900,height=1100');
    let htmlContent = "";

    // 4. CONSTRUCCIÓN DEL LAYOUT (RUTA O CUADRA)
    if (esRuta) {
        htmlContent = `
            <div class="a4-page ruta-layout">
                <div style="position: relative; width: 100%; flex-shrink: 0;">
                    <div id="map-static" class="map-ruta"></div>
                    ${leyendaHTML}
                </div>
                <div class="info-container">
                    <h2 class="report-title">DETALLE TÉCNICO DE RUTA</h2>
                    <table class="ruta-table">
                        ${generarFilasTabla(datosArray, 2, 100)}
                    </table>
                </div>
                <div class="footer-stamp">Generado el: ${new Date().toLocaleString()}</div>
            </div>`;
    } else {
        const calle = datosArray.find(d => d.label.includes("calle"))?.valor || "";
        const barrio = datosArray.find(d => d.label.includes("barrio"))?.valor || "";
        const comunaVal = datosArray.find(d => d.label.includes("comuna"))?.valor || "";
        const tituloCompleto = `${calle} - ${barrio} - COMUNA ${comunaVal}`;

        const rutasBrutas = [];
        const filas = contenido.querySelectorAll('.tech-table tbody tr');
        filas.forEach(tr => {
            const cols = tr.querySelectorAll('td');
            if(cols.length >= 4) {
                const tAbrev = cols[2].innerText.trim().toUpperCase();
                let tComp = (tAbrev === "M") ? "MAÑANA" : (tAbrev === "T") ? "TARDE" : (tAbrev === "N") ? "NOCHE" : tAbrev;
                rutasBrutas.push({ ruta: cols[0].innerText.trim(), servicio: cols[1].innerText.trim(), turno: tComp, frec: cols[3].innerText.trim() });
            }
        });

        const ordenTurnos = ["MAÑANA", "TARDE", "NOCHE"];
        const listadoHTML = ordenTurnos.map(t => {
            const filtradas = rutasBrutas.filter(r => r.turno === t);
            if (filtradas.length === 0) return "";
            return `
                <div class="turno-block">
                    <div class="turno-header">TURNO: ${t}</div>
                    <table class="cuadra-table">
                        <tbody>
                            ${filtradas.map(r => `<tr><td style="width:35px"><b>${r.ruta}</b></td><td>${r.servicio}</td><td align="right">${r.frec}</td></tr>`).join('')}
                        </tbody>
                    </table>
                </div>`;
        }).join('');

        htmlContent = `
            <div class="a4-page" style="padding: 8mm;">
                <h1 class="cuadra-title">${tituloCompleto}</h1>
                <div style="position: relative;">
                    <div id="map-static" class="map-cuadra"></div>
                    ${leyendaHTML}
                </div>
                <div class="servicios-grid">${listadoHTML}</div>
                <div class="footer-stamp">Generado el: ${new Date().toLocaleString()}</div>
            </div>`;
    }

    // 5. ESCRITURA DEL DOCUMENTO FINAL
    ventana.document.write(`
        <html>
        <head>
            <title>Reporte de Gestión</title>
            <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
            <style>
                @page { size: A4 portrait; margin: 0; }
                body { font-family: Arial, sans-serif; margin: 0; padding: 0; background: #333; }
                .toolbar { width: 100%; background: #000; padding: 10px; text-align: center; position: sticky; top: 0; z-index: 9999; }
                .btn-print { padding: 10px 30px; background: #27ae60; color: white; border: none; cursor: pointer; font-weight: bold; border-radius: 4px; }
                .a4-page { width: 210mm; height: 285mm; background: white; margin: 10px auto; box-sizing: border-box; position: relative; overflow: hidden; }
                .ruta-layout { display: flex; flex-direction: column; padding: 10mm; }
                .map-ruta { width: 100%; height: 215mm; border: 1px solid #000; }
                .report-title { font-size: 16px; text-align: center; border-bottom: 2px solid #000; padding-bottom: 5px; margin: 5px 0 10px 0; }
                .ruta-table { width: 100%; border-collapse: collapse; }
                .ruta-table td { border: 1px solid #ddd; padding: 6px; vertical-align: top; }
                .cuadra-title { font-size: 18px; text-align: center; border-bottom: 2px solid #000; padding-bottom: 5px; margin: 0 0 10px 0; }
                .map-cuadra { width: 100%; height: 100mm; border: 1px solid #000; margin-bottom: 15px; }
                .servicios-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
                .turno-header { background: #333; color: white; font-size: 10px; padding: 3px 8px; font-weight: bold; }
                .cuadra-table { width: 100%; border-collapse: collapse; font-size: 9px; border: 1px solid #ccc; }
                .cuadra-table td { padding: 3px; border-bottom: 1px solid #eee; }
                .label { display: block; font-size: 8px; font-weight: bold; color: #666; text-transform: uppercase; }
                .value { font-size: 11px; font-weight: bold; }
                .footer-stamp { position: absolute; bottom: 5mm; right: 10mm; font-size: 8px; color: #999; }
                @media print { .toolbar { display: none; } body { background: white; } .a4-page { margin: 0; border: none; box-shadow: none; height: 100vh; } }
            </style>
        </head>
        <body>
            <div class="toolbar"><button class="btn-print" onclick="window.print()">IMPRIMIR PDF</button></div>
            ${htmlContent}
            <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
            <script>
                // Dentro de generarInforme, en ventana.document.write:

                // Dentro de generarInforme (ventana.document.write)
                const map = L.map('map-static', { zoomControl: false, dragging: false, scrollWheelZoom: false, attributionControl: false });

                const urlActual = '${capaBaseActual._url}';
                const isGoogle = urlActual.includes('google');
                const isIGN = urlActual.includes('ign.gob.ar');

                L.tileLayer(urlActual, {
                    subdomains: isGoogle ? ['mt0','mt1','mt2','mt3'] : ['a','b','c'],
                    tms: isIGN, // El IGN también usa inversión de eje Y
                    maxZoom: 18
                }).addTo(map);

                // LÍNEAS (Rojo) - Prioridad de Zoom
                const geoData = ${JSON.stringify(capasActivas)};
                if(geoData.length > 0) {
                    const l = L.geoJSON(geoData, { style: { color: "#e74c3c", weight: 10, opacity: 1 } }).addTo(map);
                    map.fitBounds(l.getBounds(), { padding: [${esRuta ? 40 : 150}, ${esRuta ? 40 : 150}] });
                }

                // PUNTOS (Contenedores) - Colores Globales y Popups
                const puntosData = ${JSON.stringify(puntosParaInforme)};
                const cols = ${JSON.stringify(coloresPuntos)};

                puntosData.forEach(geojson => {
                    L.geoJSON(geojson, {
                        pointToLayer: (f, latlng) => {
                            const p = f.properties;
                            
                            // Normalización de tipo (Si COD_EQUIPA no existe o es nulo, es VERDE)
                            let cod = (p.COD_EQUIPA || "").toString().trim().toUpperCase();
                            if (!cod) cod = 'VERDE';

                            const popupHTML = \`
                                <div style="font-size:10px; min-width:140px; font-family:Arial;">
                                    <b style="color:#d35400; display:block; border-bottom:1px solid #eee; margin-bottom:3px;">DATOS EQUIPO</b>
                                    <b>ID:</b> \${p.ID_EQUIPO || 'S/D'}<br>
                                    <b>Calle:</b> \${p.CALLE || 'S/D'}<br>
                                    <b>Altura:</b> \${p.ALTURA || 'S/D'}<br>
                                    <b>Tipo:</b> \${cod}<br>
                                    <b>Ubicación:</b> \${p.UBICACIÓN || 'S/D'}
                                </div>\`;

                            return L.circleMarker(latlng, {
                                radius: 5,
                                fillColor: cols[cod] || cols['VERDE'],
                                color: "#fff",
                                weight: 1,
                                fillOpacity: 0.9
                            }).bindPopup(popupHTML);
                        }
                    }).addTo(map);
                });
            </script>
        </body>
        </html>
    `);

    function generarFilasTabla(datos, cols, max) {
        let html = '';
        for (let i = 0; i < Math.min(datos.length, max); i += cols) {
            html += '<tr>';
            for (let j = 0; j < cols; j++) {
                const item = datos[i + j];
                html += `<td style="width:${100/cols}%">${item ? `<span class="label">${item.label}</span><span class="value">${item.valor}</span>` : ''}</td>`;
            }
            html += '</tr>';
        }
        return html;
    }
    ventana.document.close();
}
// Iniciar Combos al cargar
initCombos();