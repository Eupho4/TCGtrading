const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

class DatabaseExporter {
    constructor() {
        this.dbPath = path.join(__dirname, 'data/cards.db');
        this.db = new sqlite3.Database(this.dbPath);
    }

    // Exportar a CSV
    async exportToCSV() {
        return new Promise((resolve, reject) => {
            console.log('📊 Exportando a CSV...');
            
            const csvPath = path.join(__dirname, 'exported_data', 'cards.csv');
            this.ensureDirectoryExists(path.dirname(csvPath));
            
            const writeStream = fs.createWriteStream(csvPath);
            
            // Escribir encabezados CSV
            writeStream.write('ID,Name,Set Name,Series,Number,Rarity,Types,Subtypes,TCGPlayer URL,Cardmarket URL,Last Updated\n');
            
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
                    tcgplayer,
                    cardmarket,
                    last_updated
                FROM cards 
                ORDER BY series, set_name, number
            `, (err, row) => {
                if (err) {
                    reject(err);
                    return;
                }
                
                // Escapar comillas y formatear para CSV
                const csvRow = [
                    this.escapeCSV(row.id || ''),
                    this.escapeCSV(row.name || ''),
                    this.escapeCSV(row.set_name || ''),
                    this.escapeCSV(row.series || ''),
                    this.escapeCSV(row.number || ''),
                    this.escapeCSV(row.rarity || ''),
                    this.escapeCSV(row.types || ''),
                    this.escapeCSV(row.subtypes || ''),
                    this.escapeCSV(row.tcgplayer || ''),
                    this.escapeCSV(row.cardmarket || ''),
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
                    console.log(`✅ CSV exportado: ${count} cartas en ${csvPath}`);
                    resolve(csvPath);
                }
            });
        });
    }

    // Exportar a JSON
    async exportToJSON() {
        return new Promise((resolve, reject) => {
            console.log('📊 Exportando a JSON...');
            
            const jsonPath = path.join(__dirname, 'exported_data', 'cards.json');
            this.ensureDirectoryExists(path.dirname(jsonPath));
            
            this.db.all(`
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
                ORDER BY series, set_name, number
            `, (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    const data = {
                        exportDate: new Date().toISOString(),
                        totalCards: rows.length,
                        cards: rows.map(row => ({
                            ...row,
                            images: row.images ? JSON.parse(row.images) : null,
                            tcgplayer: row.tcgplayer ? JSON.parse(row.tcgplayer) : null,
                            cardmarket: row.cardmarket ? JSON.parse(row.cardmarket) : null
                        }))
                    };
                    
                    fs.writeFileSync(jsonPath, JSON.stringify(data, null, 2));
                    console.log(`✅ JSON exportado: ${rows.length} cartas en ${jsonPath}`);
                    resolve(jsonPath);
                }
            });
        });
    }

    // Exportar estadísticas
    async exportStats() {
        return new Promise((resolve, reject) => {
            console.log('📊 Generando estadísticas...');
            
            const statsPath = path.join(__dirname, 'exported_data', 'database_stats.json');
            this.ensureDirectoryExists(path.dirname(statsPath));
            
            const stats = {};
            
            // Estadísticas generales
            this.db.get('SELECT COUNT(*) as total FROM cards', (err, row) => {
                if (err) {
                    reject(err);
                    return;
                }
                stats.totalCards = row.total;
                
                // Estadísticas por serie
                this.db.all(`
                    SELECT series, COUNT(*) as count 
                    FROM cards 
                    WHERE series IS NOT NULL AND series != ''
                    GROUP BY series 
                    ORDER BY count DESC
                `, (err, seriesRows) => {
                    if (err) {
                        reject(err);
                        return;
                    }
                    stats.bySeries = seriesRows;
                    
                    // Estadísticas por rareza
                    this.db.all(`
                        SELECT rarity, COUNT(*) as count 
                        FROM cards 
                        WHERE rarity IS NOT NULL AND rarity != ''
                        GROUP BY rarity 
                        ORDER BY count DESC
                    `, (err, rarityRows) => {
                        if (err) {
                            reject(err);
                            return;
                        }
                        stats.byRarity = rarityRows;
                        
                        // Estadísticas por subtipos
                        this.db.all(`
                            SELECT subtypes, COUNT(*) as count 
                            FROM cards 
                            WHERE subtypes IS NOT NULL AND subtypes != ''
                            GROUP BY subtypes 
                            ORDER BY count DESC
                            LIMIT 20
                        `, (err, subtypeRows) => {
                            if (err) {
                                reject(err);
                                return;
                            }
                            stats.bySubtypes = subtypeRows;
                            
                            // Guardar estadísticas
                            stats.exportDate = new Date().toISOString();
                            fs.writeFileSync(statsPath, JSON.stringify(stats, null, 2));
                            console.log(`✅ Estadísticas exportadas en ${statsPath}`);
                            resolve(statsPath);
                        });
                    });
                });
            });
        });
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
    const exporter = new DatabaseExporter();
    
    try {
        console.log('🚀 Iniciando exportación de base de datos...\n');
        
        // Exportar todos los formatos
        await exporter.exportToCSV();
        console.log('');
        
        await exporter.exportToJSON();
        console.log('');
        
        await exporter.exportStats();
        console.log('');
        
        console.log('🎉 ¡Exportación completada!');
        console.log('📁 Archivos guardados en: /workspace/exported_data/');
        console.log('   - cards.csv (formato Excel compatible)');
        console.log('   - cards.json (datos completos)');
        console.log('   - database_stats.json (estadísticas)');
        
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

module.exports = DatabaseExporter;