const fs = require('fs');

const filePath = 'C:\\Users\\PC1\\Desktop\\TCGtrading\\server-hybrid.js';
let content = fs.readFileSync(filePath, 'utf8');

// Buscar y reemplazar la sección de formateo de cartas
const oldCode = `        const formattedCards = cards.map(card => {
            var setInfo = setsCache && setsCache[card.set_id] ? setsCache[card.set_id] : { name: card.set_id || '', series: '' };
            return {
                id: card.id,
                name: card.name,
                number: card.number,
                hp: card.hp,
                types: card.types,
                subtypes: card.subtypes,
                rules: card.rules,
                images: card.images,`;

const newCode = `        const formattedCards = cards.map(card => {
            var setInfo = setsCache && setsCache[card.set_id] ? setsCache[card.set_id] : { name: card.set_id || '', series: '' };
            
            // Arreglar URLs de imágenes de TCGdex añadiendo extensión
            var images = card.images;
            if (images && typeof images === 'object') {
                if (images.small && !images.small.match(/\\.(jpg|png|webp)$/i)) {
                    images = {
                        small: images.small + '/high.webp',
                        large: (images.large || images.small) + '/high.webp'
                    };
                }
            }
            
            return {
                id: card.id,
                name: card.name,
                number: card.number,
                hp: card.hp,
                types: card.types,
                subtypes: card.subtypes,
                rules: card.rules,
                images: images,`;

if (content.includes(oldCode)) {
    content = content.replace(oldCode, newCode);
    fs.writeFileSync(filePath, content, 'utf8');
    console.log('✅ Archivo modificado correctamente');
} else {
    console.log('❌ No se encontró el código a reemplazar');
    console.log('Buscando variantes...');
    if (content.includes('images: card.images,')) {
        console.log('✅ Encontrado images: card.images,');
    }
}
