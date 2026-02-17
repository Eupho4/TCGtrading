const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

class ExcelExporter {
    constructor() {
        this.dbPath = path.join(__dirname, 'data/cards.db');
        this.db = new sqlite3.Database(this.dbPath);
    }

    // Crear archivo CSV optimizado para Excel
    async createExcelFriendlyCSV() {
        return new Promise((resolve, reject) => {
            console.log('📊 Creando archivo CSV optimizado para Excel...');
            
            const csvPath = path.join(__dirname, 'exported_data', 'cards_excel_friendly.csv');
            this.ensureDirectoryExists(path.dirname(csvPath));
            
            const writeStream = fs.createWriteStream(csvPath);
            
            // Escribir encabezados CSV optimizados para Excel
            writeStream.write('ID,Nombre,Set,Serie,Numero,Rareza,Tipo,Subtipo,Imagen Pequeña,Imagen Grande,TCGPlayer Precio Bajo,TCGPlayer Precio Medio,TCGPlayer Precio Alto,TCGPlayer Precio Mercado,Cardmarket Precio Promedio,Cardmarket Precio Bajo,Cardmarket Precio Tendencia,Ultima Actualizacion\n');
            
            let count = 0;
            this.db.each(`
                SELECT 
                    id,
                    name,
                    set_name,
                    series,
                    number,
                    rarity,
                    types,
                    subtypes,
                    images,
                    tcgplayer,
                    cardmarket,
                    last_updated
                FROM cards 
                WHERE name IS NOT NULL AND name != ''
                ORDER BY series, set_name, number
            `, (err, row) => {
                if (err) {
                    reject(err);
                    return;
                }
                
                // Procesar datos JSON
                let images = {};
                let tcgplayer = {};
                let cardmarket = {};
                
                try {
                    if (row.images) images = JSON.parse(row.images);
                    if (row.tcgplayer) tcgplayer = JSON.parse(row.tcgplayer);
                    if (row.cardmarket) cardmarket = JSON.parse(row.cardmarket);
                } catch (e) {
                    // Ignorar errores de JSON
                }
                
                // Extraer precios de TCGPlayer
                const tcgLow = this.extractPrice(tcgplayer, 'low');
                const tcgMid = this.extractPrice(tcgplayer, 'mid');
                const tcgHigh = this.extractPrice(tcgplayer, 'high');
                const tcgMarket = this.extractPrice(tcgplayer, 'market');
                
                // Extraer precios de Cardmarket
                const cmAvg = this.extractPrice(cardmarket, 'averageSellPrice');
                const cmLow = this.extractPrice(cardmarket, 'lowPrice');
                const cmTrend = this.extractPrice(cardmarket, 'trendPrice');
                
                // Crear fila CSV
                const csvRow = [
                    this.escapeCSV(row.id || ''),
                    this.escapeCSV(row.name || ''),
                    this.escapeCSV(row.set_name || ''),
                    this.escapeCSV(row.series || ''),
                    this.escapeCSV(row.number || ''),
                    this.escapeCSV(row.rarity || ''),
                    this.escapeCSV(row.types || ''),
                    this.escapeCSV(row.subtypes || ''),
                    this.escapeCSV(images.small || ''),
                    this.escapeCSV(images.large || ''),
                    tcgLow,
                    tcgMid,
                    tcgHigh,
                    tcgMarket,
                    cmAvg,
                    cmLow,
                    cmTrend,
                    this.escapeCSV(row.last_updated || '')
                ].join(',') + '\n';
                
                writeStream.write(csvRow);
                count++;
                
                if (count % 1000 === 0) {
                    console.log(`📝 Procesadas ${count} cartas...`);
                }
            }, (err) => {
                if (err) {
                    reject(err);
                } else {
                    writeStream.end();
                    console.log(`✅ CSV Excel-friendly exportado: ${count} cartas en ${csvPath}`);
                    resolve(csvPath);
                }
            });
        });
    }

    // Extraer precio de un objeto de precios
    extractPrice(priceObj, key) {
        if (!priceObj || !priceObj.prices) return '';
        
        // Buscar en diferentes estructuras de precios
        const prices = priceObj.prices;
        
        // Buscar directamente
        if (prices[key]) return prices[key];
        
        // Buscar en subcategorías (holofoil, normal, etc.)
        for (const category in prices) {
            if (prices[category] && prices[category][key]) {
                return prices[category][key];
            }
        }
        
        return '';
    }

    // Crear directorio si no existe
    ensureDirectoryExists(dirPath) {
        if (!fs.existsSync(dirPath)) {
            fs.mkdirSync(dirPath, { recursive: true });
        }
    }

    // Escapar texto para CSV
    escapeCSV(text) {
        if (text === null || text === undefined) return '';
        const str = String(text);
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
            return '"' + str.replace(/"/g, '""') + '"';
        }
        return str;
    }

    // Cerrar conexión
    close() {
        this.db.close();
    }
}

// Función principal
async function main() {
    const exporter = new ExcelExporter();
    
    try {
        console.log('🚀 Creando archivo Excel-friendly...\n');
        
        await exporter.createExcelFriendlyCSV();
        
        console.log('\n🎉 ¡Archivo Excel-friendly creado!');
        console.log('📁 Archivo guardado en: /workspace/exported_data/cards_excel_friendly.csv');
        console.log('📊 Este archivo está optimizado para abrir en Excel con:');
        console.log('   - Encabezados en español');
        console.log('   - Precios separados en columnas individuales');
        console.log('   - URLs de imágenes separadas');
        console.log('   - Datos limpios y organizados');
        
    } catch (error) {
        console.error('❌ Error durante la exportación:', error);
    } finally {
        exporter.close();
    }
}

// Ejecutar si se llama directamente
if (require.main === module) {
    main();
}

module.exports = ExcelExporter;