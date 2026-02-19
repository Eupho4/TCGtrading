require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL
});

async function createFinalBackup() {
    try {
        console.log('🔄 Creando backup final de la base de datos...');
        
        // 1. Verificar cuántas cartas hay
        const countResult = await pool.query('SELECT COUNT(*) as total FROM cards');
        const totalCards = countResult.rows[0].total;
        
        console.log(`📊 Cartas en BD: ${totalCards.toLocaleString()}`);
        
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
        
        // 3. Obtener todas las cartas
        console.log('📦 Exportando todas las cartas...');
        const cardsResult = await pool.query('SELECT * FROM cards ORDER BY id');
        const allCards = cardsResult.rows;
        
        // 4. Crear backup JSON
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const jsonFile = path.join(__dirname, `tcg_complete_backup_${timestamp}.json`);
        
        const backupData = {
            metadata: {
                timestamp: new Date().toISOString(),
                totalCards: totalCards,
                version: 'TCGdex Complete v2.0',
                exportMethod: 'Node.js Direct Export'
            },
            statistics: statsData,
            cards: allCards
        };
        
        fs.writeFileSync(jsonFile, JSON.stringify(backupData, null, 2));
        
        const fileStats = fs.statSync(jsonFile);
        const fileSizeMB = (fileStats.size / (1024 * 1024)).toFixed(2);
        
        // 5. Crear archivo de instrucciones
        const instructionsFile = path.join(__dirname, `tcg_backup_${timestamp}_INSTRUCTIONS.txt`);
        const instructions = `
INSTRUCCIONES PARA RESTAURAR LA BASE DE DATOS
============================================

🎯 ESTE BACKUP CONTIENEN TODAS LAS CARTAS DE TCGDEX

📊 ESTADÍSTICAS:
- Cartas: ${totalCards.toLocaleString()}
- Sets: ${statsData.sets}
- Tipos: ${statsData.types}
- Rarezas: ${statsData.rarities}
- Artistas: ${statsData.artists}
- Con ataques: ${statsData.with_attacks}
- Con debilidades: ${statsData.with_weaknesses}
- Tamaño archivo JSON: ${fileSizeMB} MB

📁 ARCHIVOS:
- Backup JSON: tcg_complete_backup_${timestamp}.json
- Instrucciones: tcg_backup_${timestamp}_INSTRUCTIONS.txt

🛠️ PASOS PARA RESTAURAR EN NUEVO PC:

1. INSTALAR POSTGRESQL
   - Descargar desde: https://www.postgresql.org/download/windows/
   - Usar password: Badalona.17
   - Puerto: 5432

2. CREAR BASE DE DATOS
   - Abrir "SQL Shell (psql)"
   - Ejecutar: CREATE DATABASE pokemon_tcg;

3. RESTAURAR DESDE JSON
   - Copiar este archivo a nuevo PC
   - Ejecutar script: import-json-to-db.js
   - O usar: node -e "const fs = require('fs'); const { Pool } = require('pg'); const data = JSON.parse(fs.readFileSync('tcg_complete_backup_${timestamp}.json')); const pool = new Pool({connectionString: 'postgresql://postgres:Badalona.17@localhost:5432/pokemon_tcg'}); pool.query('BEGIN').then(() => { const promises = data.cards.map(card => pool.query('INSERT INTO cards (id, name, number, set_id, rarity_id, hp, types, subtypes, rules, images, tcgplayer, cardmarket, legal, artist, flavor_text, national_pokedex_numbers, attacks, weaknesses, resistances, retreat_cost, converted_retreat_cost) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)', [card.id, card.name, card.number, card.set_id, card.rarity_id, card.hp, card.types, card.subtypes, card.rules, card.images, card.tcgplayer, card.cardmarket, card.legal, card.artist, card.flavor_text, card.national_pokedex_numbers, card.attacks, card.weaknesses, card.resistances, card.retreat_cost, card.converted_retreat_cost])); return Promise.all(promises); }).then(() => pool.query('COMMIT')).then(() => console.log('✅ Restauración completada')).catch(err => console.error('❌ Error:', err)).finally(() => pool.end());"

4. CONFIGURAR PROYECTO
   - Copiar carpeta TCGtrading completa
   - Actualizar .env si es necesario
   - Ejecutar: node server-hybrid.js

5. VERIFICAR
   - Abrir http://localhost:3000
   - Buscar "charizard"
   - Deberías ver resultados

📋 PARA SUBIR A LA NUBE:
1. Sube tcg_complete_backup_${timestamp}.json a Google Drive/Dropbox
2. Sube tcg_backup_${timestamp}_INSTRUCTIONS.txt
3. Sube toda la carpeta TCGtrading
4. Listo para descargar en casa

🎉 ¡TODO LISTO PARA CAMBIAR DE PC!

NOTAS:
- Este backup contiene ${totalCards.toLocaleString()} cartas de TCGdex
- Las URLs de imágenes están guardadas
- Todos los datos (ataques, debilidades, sets) están incluidos
- Formato JSON es más portable que SQL
- Puedes abrir este archivo en cualquier editor de texto
`;
        
        fs.writeFileSync(instructionsFile, instructions);
        
        console.log('\n✅ BACKUP FINAL CREADO CON ÉXITO');
        console.log('=' .repeat(60));
        console.log(`📁 Archivo JSON: ${jsonFile}`);
        console.log(`📝 Instrucciones: ${instructionsFile}`);
        console.log(`📊 Tamaño: ${fileSizeMB} MB`);
        console.log(`🃏 Cartas: ${totalCards.toLocaleString()}`);
        console.log(`📦 Sets: ${statsData.sets}`);
        console.log(`⚔️ Con ataques: ${statsData.with_attacks}`);
        console.log(`🛡️ Con debilidades: ${statsData.with_weaknesses}`);
        
        console.log('\n🎯 ¡TODO COMPLETO! LISTO PARA PASAR A LA NUBE Y LUEGO A CASA');
        
    } catch (error) {
        console.error('❌ Error creando backup:', error.message);
    } finally {
        await pool.end();
    }
}

// Ejecutar backup
createFinalBackup();
