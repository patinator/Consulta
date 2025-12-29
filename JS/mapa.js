let db = [], fCuadraActiva = null, sugIdx = -1;
let capR = L.layerGroup(), capE = L.layerGroup(), capC = L.layerGroup();

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
// ORIGINAL
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);

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
    const colors = ['#2ecc71','#e74c3c','#9b59b6','#f1c40f','#3498db','#e67e22','#1abc9c'];
    let hash = 0;
    for (let i = 0; i < id.length; i++) hash = id.charCodeAt(i) + ((hash << 5) - hash);
    return colors[Math.abs(hash) % colors.length];
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

function generarInforme() {
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

    const ventana = window.open('', 'Reporte', 'width=900,height=1100');
    let htmlContent = "";

    if (esRuta) {
        // --- INFORME DE RUTA: AJUSTE DE ÁREA IMPRIMIBLE ---
        htmlContent = `
            <div class="a4-page ruta-layout">
                <div id="map-static" class="map-ruta"></div>
                <div class="info-container">
                    <h2 class="report-title">DETALLE TÉCNICO DE RUTA</h2>
                    <table class="ruta-table">
                        ${generarFilasTabla(datosArray, 2, 100)}
                    </table>
                </div>
                <div class="footer-stamp">Generado el: ${new Date().toLocaleString()}</div>
            </div>`;
    } else {
        // --- INFORME DE CUADRA (CON MARGEN DE SEGURIDAD) ---
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
                <div id="map-static" class="map-cuadra"></div>
                <div class="servicios-grid">${listadoHTML}</div>
            </div>`;
    }

    ventana.document.write(`
        <html>
        <head>
            <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
            <style>
                @page { size: A4 portrait; margin: 0; }
                body { font-family: Arial, sans-serif; margin: 0; padding: 0; background: #333; }
                .toolbar { width: 100%; background: #000; padding: 10px; text-align: center; position: sticky; top: 0; z-index: 9999; }
                .btn-print { padding: 10px 30px; background: #27ae60; color: white; border: none; cursor: pointer; font-weight: bold; border-radius: 4px; }
                
                /* AJUSTE DE ÁREA IMPRIMIBLE (Seguridad contra recortes) */
                .a4-page { 
                    width: 210mm; 
                    height: 285mm; /* Bajamos de 297 a 285 para que entre en el área de impresión */
                    background: white; 
                    margin: 10px auto; 
                    box-sizing: border-box; 
                    position: relative;
                    overflow: hidden;
                }

                /* Estilos Informe Ruta */
                .ruta-layout { display: flex; flex-direction: column; padding: 10mm; }
                .map-ruta { width: 100%; height: 220mm; border: 1px solid #000; flex-shrink: 0; }
                .info-container { flex-grow: 1; margin-top: 10px; }
                .report-title { font-size: 16px; text-align: center; border-bottom: 2px solid #000; padding-bottom: 5px; margin: 5px 0 10px 0; }
                .ruta-table { width: 100%; border-collapse: collapse; }
                .ruta-table td { border: 1px solid #ddd; padding: 6px; vertical-align: top; }
                
                /* Estilos Informe Cuadra */
                .cuadra-title { font-size: 18px; text-align: center; border-bottom: 2px solid #000; padding-bottom: 5px; margin: 0 0 10px 0; }
                .map-cuadra { width: 100%; height: 100mm; border: 1px solid #000; margin-bottom: 15px; }
                .servicios-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
                .turno-block { margin-bottom: 5px; }
                .turno-header { background: #333; color: white; font-size: 10px; padding: 3px 8px; font-weight: bold; }
                .cuadra-table { width: 100%; border-collapse: collapse; font-size: 9px; border: 1px solid #ccc; }
                .cuadra-table td { padding: 3px; border-bottom: 1px solid #eee; }

                .label { display: block; font-size: 8px; font-weight: bold; color: #666; text-transform: uppercase; }
                .value { font-size: 11px; font-weight: bold; }
                .footer-stamp { position: absolute; bottom: 5mm; right: 10mm; font-size: 8px; color: #999; }

                @media print { 
                    .toolbar { display: none; } 
                    body { background: white; } 
                    .a4-page { margin: 0; border: none; box-shadow: none; height: 100vh; } 
                }
            </style>
        </head>
        <body>
            <div class="toolbar"><button class="btn-print" onclick="window.print()">IMPRIMIR PDF</button></div>
            ${htmlContent}
            <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
            <script>
                const map = L.map('map-static', { zoomControl: false, dragging: false, scrollWheelZoom: false, attributionControl: false });
                L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);
                const geoData = ${JSON.stringify(capasActivas)};
                if(geoData.length > 0) {
                    const layer = L.geoJSON(geoData, { style: { color: "#e74c3c", weight: 10, opacity: 1 } }).addTo(map);
                    map.fitBounds(layer.getBounds(), {padding: [${esRuta ? 40 : 150}, ${esRuta ? 40 : 150}]});
                }
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