require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL
});

// Función para crear backup completo de la base de datos
async function createCompleteBackup() {
    try {
        console.log('🔄 Creando backup completo de la base de datos...');
        
        // 1. Verificar cuántas cartas hay
        const countResult = await pool.query('SELECT COUNT(*) as total FROM cards');
        const totalCards = countResult.rows[0].total;
        
        console.log(`📊 Cartas en BD: ${totalCards.toLocaleString()}`);
        
        if (totalCards === 0) {
            console.log('❌ La base de datos está vacía. No se puede crear backup.');
            return;
        }
        
        // 2. Obtener estadísticas
        const stats = await pool.query(`
            SELECT 
                COUNT(DISTINCT set_id) as sets,
                COUNT(DISTINCT types) as types,
                COUNT(DISTINCT rarity_id) as rarities,
                COUNT(DISTINCT artist) as artists,
                COUNT(CASE WHEN attacks::text != '[]' THEN 1 END) as with_attacks,
                COUNT(CASE WHEN weaknesses::text != '[]' THEN 1 END) as with_weaknesses
            FROM cards
        `);
        
        const statsData = stats.rows[0];
        
        // 3. Crear backup SQL usando pg_dump
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupFile = path.join(__dirname, `tcg_complete_backup_${timestamp}.sql`);
        
        console.log('📦 Creando archivo SQL...');
        
        // Extraer datos de conexión
        const dbUrl = process.env.DATABASE_URL;
        const urlParts = new URL(dbUrl);
        
        const pgDumpCommand = `pg_dump -h ${urlParts.hostname} -p ${urlParts.port || 5432} -U ${urlParts.username} -d ${urlParts.pathname.slice(1)} > "${backupFile}"`;
        
        return new Promise((resolve, reject) => {
            exec(pgDumpCommand, { 
                env: { 
                    ...process.env, 
                    PGPASSWORD: urlParts.password 
                } 
            }, (error, stdout, stderr) => {
                if (error) {
                    console.error('❌ Error en pg_dump:', error);
                    reject(error);
                    return;
                }
                
                if (stderr) {
                    console.log('⚠️ Warnings de pg_dump:', stderr);
                }
                
                // Verificar que el archivo se creó
                if (fs.existsSync(backupFile)) {
                    const stats = fs.statSync(backupFile);
                    const fileSizeMB = (stats.size / (1024 * 1024)).toFixed(2);
                    
                    console.log('✅ Backup creado exitosamente:');
                    console.log(`📁 Archivo: ${backupFile}`);
                    console.log(`📊 Tamaño: ${fileSizeMB} MB`);
                    console.log(`🃏 Cartas: ${totalCards.toLocaleString()}`);
                    console.log(`📦 Sets: ${statsData.sets}`);
                    console.log(`🔥 Tipos: ${statsData.types}`);
                    console.log(`💎 Rarezas: ${statsData.rarities}`);
                    console.log(`🎨 Artistas: ${statsData.artists}`);
                    console.log(`⚔️ Con ataques: ${statsData.with_attacks}`);
                    console.log(`🛡️ Con debilidades: ${statsData.with_weaknesses}`);
                    
                    // 4. Crear archivo de instrucciones
                    const instructionsFile = backupFile.replace('.sql', '_INSTRUCTIONS.txt');
                    const instructions = `
INSTRUCCIONES PARA RESTAURAR LA BASE DE DATOS
============================================

1. Instalar PostgreSQL en el nuevo ordenador
2. Crear base de datos vacía:
   CREATE DATABASE pokemon_tcg;

3. Restaurar el backup:
   psql -h localhost -U postgres -d pokemon_tcg < tcg_complete_backup_${timestamp}.sql

4. Actualizar archivo .env con los datos de conexión:
   DATABASE_URL=postgresql://postgres:tu_password@localhost:5432/pokemon_tcg

ESTADÍSTICAS DEL BACKUP:
- Cartas: ${totalCards.toLocaleString()}
- Sets: ${statsData.sets}
- Tipos: ${statsData.types}
- Rarezas: ${statsData.rarities}
- Artistas: ${statsData.artists}
- Con ataques: ${statsData.with_attacks}
- Con debilidades: ${statsData.with_weaknesses}
- Tamaño archivo: ${fileSizeMB} MB

NOTAS:
- Este backup contiene TODAS las cartas de TCGdex
- Las URLs de imágenes están guardadas pero no descargadas
- Puedes subir este archivo a Google Drive, Dropbox, etc.
- Para usar en otro PC, solo necesitas PostgreSQL y seguir estos pasos
`;
                    
                    fs.writeFileSync(instructionsFile, instructions);
                    console.log(`📝 Instrucciones guardadas en: ${instructionsFile}`);
                    
                    resolve({
                        backupFile,
                        instructionsFile,
                        stats: {
                            totalCards,
                            fileSizeMB,
                            ...statsData
                        }
                    });
                    
                } else {
                    reject(new Error('No se pudo crear el archivo de backup'));
                }
            });
        });
        
    } catch (error) {
        console.error('❌ Error creando backup:', error.message);
        throw error;
    } finally {
        await pool.end();
    }
}

// Función para crear backup JSON adicional
async function createJSONBackup() {
    try {
        console.log('📦 Creando backup JSON adicional...');
        
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const jsonFile = path.join(__dirname, `tcg_cards_${timestamp}.json`);
        
        // Obtener todas las cartas
        const cardsResult = await pool.query('SELECT * FROM cards ORDER BY id');
        
        const backupData = {
            metadata: {
                timestamp: new Date().toISOString(),
                totalCards: cardsResult.rows.length,
                version: 'TCGdex Complete v1.0'
            },
            cards: cardsResult.rows
        };
        
        fs.writeFileSync(jsonFile, JSON.stringify(backupData, null, 2));
        
        const stats = fs.statSync(jsonFile);
        const fileSizeMB = (stats.size / (1024 * 1024)).toFixed(2);
        
        console.log(`✅ Backup JSON creado: ${jsonFile} (${fileSizeMB} MB)`);
        
        return jsonFile;
        
    } catch (error) {
        console.error('❌ Error creando backup JSON:', error.message);
        throw error;
    }
}

// Ejecutar backup completo
async function runBackup() {
    try {
        console.log('🚀 Iniciando backup completo de la base de datos...');
        
        // 1. Backup SQL principal
        const sqlBackup = await createCompleteBackup();
        
        // 2. Backup JSON adicional (opcional)
        const jsonBackup = await createJSONBackup();
        
        console.log('\n🎉 BACKUP COMPLETO FINALIZADO');
        console.log('================================');
        console.log('📁 Archivos creados:');
        console.log(`   • SQL: ${sqlBackup.backupFile}`);
        console.log(`   • JSON: ${jsonBackup}`);
        console.log(`   • Instrucciones: ${sqlBackup.instructionsFile}`);
        
        console.log('\n📋 PASOS SIGUIENTES:');
        console.log('1. Sube estos archivos a Google Drive/Dropbox');
        console.log('2. En el nuevo PC, instala PostgreSQL');
        console.log('3. Sigue las instrucciones del archivo *_INSTRUCTIONS.txt');
        console.log('4. Copia también la carpeta completa del proyecto');
        
        console.log('\n✅ ¡Listo para cambiar de PC sin perder nada!');
        
    } catch (error) {
        console.error('❌ Error en backup:', error.message);
    }
}

// Ejecutar backup
runBackup();
