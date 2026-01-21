// Em: src/lib/firebaseAdmin.ts

import * as admin from 'firebase-admin';

// Esta linha verifica se o app já foi inicializado para evitar erros durante o desenvolvimento (hot-reloading)
if (!admin.apps.length) {
    admin.initializeApp({
        // As credenciais são carregadas automaticamente das variáveis de ambiente
        // no Render se você configurou o 'GOOGLE_CREDENTIALS'.
        // Se estiver rodando localmente, você precisa de um arquivo de chave de serviço.
    });
}

// Exporta a instância do banco de dados para ser usada em outros arquivos
const db = admin.firestore();

export { admin, db };
