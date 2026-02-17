# 🔥 REGLAS SIMPLES DE FIREBASE - SOLUCIÓN RÁPIDA

## ⚡ Copia y Pega Estas Reglas EXACTAMENTE:

```json
{
  "rules": {
    ".read": "auth != null",
    ".write": "auth != null"
  }
}
```

## 📝 Pasos:

1. **Abre Firebase Console:**
   - https://console.firebase.google.com
   - Selecciona tu proyecto

2. **Ve a Realtime Database → Rules**

3. **BORRA TODO y pega lo de arriba**

4. **Click en "Publish"**

## ⚠️ IMPORTANTE:

- Estas reglas son TEMPORALES para desarrollo
- Permiten que cualquier usuario autenticado lea/escriba TODO
- Funcionarán inmediatamente para resolver el error "Permission denied"

## ✅ Después de Publicar:

1. Espera 30 segundos
2. Recarga tu web con Ctrl+F5
3. Los chats deberían funcionar

## 🔒 Para Producción:

Una vez que funcione, puedes volver a las reglas más restrictivas del archivo `database.rules.json`.