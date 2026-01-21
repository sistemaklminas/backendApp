// Em: src/types/express.d.ts

import { DecodedIdToken } from 'firebase-admin/auth';

// Estende a interface 'User' para incluir a propriedade 'role'
interface UserProfile extends DecodedIdToken {
    role?: 'admin' | 'parent' | 'user'; // Defina os roles que você usa
}

// Estende a interface 'Request' do Express
declare global {
    namespace Express {
        export interface Request {
            user?: UserProfile; // Agora 'req.user' é um tipo conhecido
        }
    }
}
